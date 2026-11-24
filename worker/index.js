import {legacyPolls,polls,questionBank,updatedQuestionBank} from './polls.js';
import {distractors} from './distractors.js';
import {page} from './page.js';

const pagesOrigin = 'https://stem-solano.github.io';

function withCors(request, response) {
  if (request.headers.get('Origin') === pagesOrigin) {
    response.headers.set('Access-Control-Allow-Origin', pagesOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Player-Key');
    response.headers.append('Vary', 'Origin');
  }
  return response;
}

const ttl = 12 * 60 * 60 * 1000;
const token = () => crypto.randomUUID();
const clean = value => String(value ?? '').slice(0, 120).trim();
const normalize = value => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const fail = (message,status=400) => json({error:message},status);

const stages = ['Opening round', 'Semifinal', 'Final face-off'];

const formats = {
  2: {polls:legacyPolls, questionsPerRound:2},
  3: {polls, questionsPerRound:5},
  4: {polls:questionBank, questionsPerRound:5},
  5: {polls:updatedQuestionBank, questionsPerRound:5}
};

function parseCustomQuestions(questions, count, dropdown) {
  if(!Array.isArray(questions) || questions.length!==count) throw new Error('Submit all question slots.');
  return questions.map((entry,index)=>{
    if(!entry || typeof entry.prompt!=='string' || typeof entry.answers!=='string'){
      throw new Error('Invalid question '+(index+1)+'.');
    }
    if(Number.isInteger(entry.bankIndex)) return null;
    const prompt=entry.prompt.trim();
    const rows=entry.answers.trim().split(/\r?\n/).filter(row=>row.trim());
    if(!prompt && !rows.length) return null;
    const failQuestion=message=>{throw new Error('Question '+(index+1)+': '+message);};
    if(!prompt || prompt.length>240) failQuestion('Enter a question of up to 240 characters.');
    if(rows.length<2 || rows.length>10) failQuestion('Enter 2 to 10 answers.');
    const seen=new Set();
    const answers=rows.map(row=>{
      const [label,points,...aliases]=row.split('|').map(part=>part.trim());
      if(!/^\d{1,3}$/.test(points??'') || Number(points)<1 || Number(points)>100){
        failQuestion('Give each answer a whole-number point value from 1 to 100.');
      }
      if(aliases.length>5) failQuestion('Use up to five alternate spellings per answer.');
      const spellings=new Set();
      for(const text of [label,...aliases]){
        const normalized=normalize(text);
        if(!normalized || text.length>120) failQuestion('Use 1 to 120 characters for each answer or alternate spelling.');
        if(seen.has(normalized) || seen.has(normalized+'s') || (normalized.endsWith('s') && seen.has(normalized.slice(0,-1)))){
          failQuestion('Use distinct spellings for different answers.');
        }
        spellings.add(normalized);
      }
      for(const spelling of spellings) seen.add(spelling);
      return [label,Number(points),...aliases];
    }).sort((a,b)=>b[1]-a[1]);
    const choices=(entry.distractors??'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
    if(dropdown && (choices.length<2 || choices.length>6)) failQuestion('Enter 2 to 6 non-scoring choices.');
    for(const choice of choices){
      const normalized=normalize(choice);
      if(!normalized || choice.length>120 || seen.has(normalized) || seen.has(normalized+'s') || (normalized.endsWith('s') && seen.has(normalized.slice(0,-1)))){
        failQuestion('Use distinct non-scoring choices of up to 120 characters.');
      }
      seen.add(normalized);
    }
    return ['Host question',prompt,null,null,answers,choices];
  });
}

const bankFor = state => state.version>=5 ? updatedQuestionBank : questionBank;
// The last 14 entries in the updated bank are available through manual selection.
const automaticBankFor = state => bankFor(state).slice(0,questionBank.length);

function questionAt(state, polls) {
  const bank=bankFor(state);
  if(state.tie) return bank[state.tie.bankIndex];
  return state.customQuestions?.[state.round] ??
    bank[state.selectedPolls?.[state.round]] ?? polls[state.round];
}

function choicesFor(poll) {
  const extras=poll[5]??distractors[questionBank.indexOf(poll)];
  return [...poll[4].map(([answer])=>answer),...extras].sort((a,b)=>a.localeCompare(b,'en'));
}

const questionCount = state => state.questionsPerRound ?? formats[state.version].questionsPerRound;
const questionToken = state => state.round+1+(state.tie ? state.tie.sequence*100 : 0);
const eligible = (state, team) => team.active && (!state.tie || state.tie.scores[team.key]!==undefined);

function startTiebreak(state, cutoff) {
  const count=questionCount(state)*3;
  const used=new Set(Array.from({length:count},(_,index)=>
    state.customQuestions?.[index] ? null : state.selectedPolls?.[index]??index));
  const available=automaticBankFor(state).map((_,index)=>index).filter(index=>!used.has(index));
  const sequence=(state.tieSequence??0)+1;
  state.tieSequence=sequence;
  state.tie={
    sequence,
    bankIndex:available[(sequence-1)%available.length],
    scores:state.tie?.scores??Object.fromEntries(cutoff.tied.map(t=>[t.key,0])),
    automatic:state.tie?.automatic??cutoff.automatic.map(t=>t.key),
    slots:state.tie?.slots??cutoff.slots
  };
}

function openQuestion(state, polls) {
  state.phase='open';
  state.guesses={};
  const stageIndex=Math.floor(state.round/questionCount(state));
  if(state.version>=4 && !state.tie && state.round%questionCount(state)===0){
    for(const team of state.teams.filter(t=>t.active)){
      team.roundScores??=[];
      team.roundScores[stageIndex]=0;
    }
  }
  const poll=questionAt(state,polls);
  const options=state.version>=4 ? choicesFor(poll) : poll[4].map(([label])=>label);
  for(const team of state.teams.filter(t=>t.ai && eligible(state,t))){
    state.guesses[team.key]={text:options[Math.floor(Math.random()*options.length)]};
  }
}

function qualification(state, stageIndex) {
  const limit = [4, 2, 1][stageIndex];
  const ranked = state.teams.filter(t=>t.active).sort((a,b)=>b.score-a.score);
  if(state.tie){
    const {scores,slots,automatic}=state.tie;
    const rankedTie=ranked.filter(t=>eligible(state,t)).sort((a,b)=>scores[b.key]-scores[a.key]);
    const cutoff=scores[rankedTie[slots-1].key];
    const ahead=rankedTie.filter(t=>scores[t.key]>cutoff);
    return {
      automatic:ranked.filter(t=>automatic.includes(t.key)).concat(ahead),
      tied:rankedTie.filter(t=>scores[t.key]===cutoff),
      slots:slots-ahead.length
    };
  }
  const cutoff = ranked[limit-1].score;
  const automatic = ranked.filter(t=>t.score>cutoff);
  const tied = ranked.filter(t=>t.score===cutoff);
  return {automatic, tied, slots:limit-automatic.length};
}

function view(state, role, team) {
  const {polls} = formats[state.version];
  const questionsPerRound=questionCount(state);
  const stageIndex = Math.floor(state.round / questionsPerRound);
  const questionNumber = state.round % questionsPerRound + 1;
  const poll = questionAt(state, polls);
  const reveal = state.phase === 'reveal';
  const live = state.phase === 'open' || reveal;
  const lastQuestion = reveal && questionNumber === questionsPerRound;
  const finalQuestion = state.round === questionsPerRound*3 - 1;
  const dropdown=state.version>=4;
  const showBoard=reveal && (!dropdown || role==='host');
  const showScores=!dropdown || role==='host' || role==='team';
  const whatIf=dropdown && team?.active===false;
  const canGuess=team && (eligible(state,team) || whatIf);
  const cutoff = lastQuestion ? qualification(state, stageIndex) : null;
  return {
    gameNumber:state.gameNumber??0, role, team: team?.name, eliminated: team?.active === false, round: questionToken(state), phase: state.phase,
    stage: live ? stages[stageIndex] : null, questionNumber: live ? questionNumber : null, questionsPerRound,
    ...(dropdown && showScores ? {scoreRounds:stages.slice(0,stageIndex+1)} : {}),
    dropdown, tieActive:!!state.tie, canGuess:!!canGuess,
    choices:dropdown && canGuess && state.phase==='open' ? choicesFor(poll) : [],
    lastQuestion, finalQuestion, winner: state.winner, qualified: state.qualified, category: live ? poll[0] : null,
    question: live ? poll[1] : null, slots: live && (!dropdown || role==='host') ? poll[4].length : null,
    source: showBoard && poll[2] ? (poll[2].startsWith('https://') ? poll[2] : 'https://yougov.com/en-us/' + poll[2]) : null,
    year: showBoard ? poll[3] : null, board: showBoard ? poll[4].map(([answer,points])=>({answer,points})) : [],
    tiebreak: role==='host' && cutoff && cutoff.tied.length>cutoff.slots ? {names:cutoff.tied.map(t=>t.name),slots:cutoff.slots} : null,
    ...(role==='host' && state.phase==='lobby' && state.version>=3 ? {
      questionBank:bankFor(state).map(([title,prompt])=>({title,prompt})),
      questionSetup: polls.slice(0,questionsPerRound*3).map((poll,index)=>{
        const custom=state.customQuestions?.[index];
        return {
          defaultPrompt:poll[1],
          bankIndex:custom ? null : (state.selectedPolls?.[index]??index),
          prompt:custom?.[1]??'',
          answers:custom?.[4].map(row=>row.join(' | ')).join('\n')??'',
          distractors:custom?.[5]?.join('\n')??''
        };
      })
    } : {}),
    whatIfPicks:whatIf ? team.whatIfPicks??[] : undefined,
    submitted: whatIf ? team.whatIfPicks?.at(-1)?.questionToken===questionToken(state) : team && Object.hasOwn(state.guesses,team.key),
    teams: state.teams.map(t=>({
      name:t.name, ai:t.ai === true, ...(showScores ? {score:t.score,...(dropdown ? {roundScores:t.roundScores??[]} : {}),...(state.tie && eligible(state,t) ? {tieScore:state.tie.scores[t.key]} : {})} : {}), active:t.active, eligible:eligible(state,t), submitted:Object.hasOwn(state.guesses,t.key),
      ...(showBoard && t.active ? {guess:state.guesses[t.key]?.text, points:state.guesses[t.key]?.points ?? 0} : {})
    }))
  };
}

async function api(request, db, path) {
  if (path === '/api/create' && request.method === 'POST') {
    const host = token();
    await db.prepare('DELETE FROM rooms WHERE created < ?').bind(Date.now()-ttl).run();
    for (let attempt=0; attempt<5; attempt++) {
      const number = crypto.getRandomValues(new Uint32Array(1))[0];
      const code = (number % 2176782336).toString(36).toUpperCase().padStart(6,'0');
      const state = {version:5,round:-1,phase:'lobby',teams:[],guesses:{}};
      const result = await db.prepare('INSERT OR IGNORE INTO rooms (code,host,created,state) VALUES (?,?,?,?)')
        .bind(code,host,Date.now(),JSON.stringify(state)).run();
      if(result.meta.changes) return json({code,key:host,role:'host'});
    }
    return fail('Could not create a room. Try again.',503);
  }
  const match = path.match(/^\/api\/room\/([A-Z0-9]{6})$/);
  if (!match) return fail('Page not found.',404);
  const code=match[1];
  const key=request.headers.get('X-Player-Key');
  const body=request.method==='POST' ? await request.json() : {};
  for(let attempt=0; attempt<10; attempt++){
    const row=await db.prepare('SELECT * FROM rooms WHERE code=? AND created>=?').bind(code,Date.now()-ttl).first();
    if(!row) return fail('Room not found or expired. Check the code with your host.',404);
    const state=JSON.parse(row.state);
    if(!Object.hasOwn(formats,state.version)) return fail('This room used an earlier format. Create a new room.',404);
    const {polls}=formats[state.version];
    const questionsPerRound=questionCount(state);
    const host=key===row.host;
    const team=state.teams.find(t=>t.key===key);
    if(request.method==='GET') {
      if(!host && !team && new URL(request.url).searchParams.get('watch')!=='1') return fail('Join the room to continue.',403);
      return json(view(state,host?'host':team?'team':'watch',team));
    }
    if(request.method!=='POST') return fail('Unsupported request.',405);
    let result;
    if(body.action==='join') {
      if(state.phase!=='lobby') return fail('This game has already started.');
      if(state.teams.length>=6) return fail('All six team slots are filled.');
      const name=clean(body.name).slice(0,26);
      if(!name) return fail('Enter a team name.');
      if(state.teams.some(t=>t.name.toLowerCase()===name.toLowerCase())) return fail('That team name is taken.');
      const newKey=token();
      state.teams.push({key:newKey,name,score:0,active:true});
      result={key:newKey,code,role:'team'};
    } else if((host || team) && (body.gameNumber??0)!==(state.gameNumber??0)){
      return fail('The host restarted the game. Try again from the current screen.',409);
    } else if(host && body.action==='restart' && state.phase!=='lobby'){
      state.gameNumber=(state.gameNumber??0)+1;
      state.round=-1;
      state.phase='lobby';
      state.guesses={};
      delete state.qualified;
      delete state.winner;
      delete state.tie;
      delete state.tieSequence;
      for(const team of state.teams){
        delete team.whatIfPicks;
        delete team.roundScores;
        team.score=0;
        team.active=true;
      }
    } else if(host && body.action==='setQuestionCount' && state.phase==='lobby' && state.version>=4){
      const count=body.count;
      if(!Number.isInteger(count) || count<1 || count>10) return fail('Choose 1 to 10 questions per round.');
      if(state.selectedPolls && count!==questionsPerRound){
        const selectedPolls=[];
        const customQuestions=[];
        const used=new Set();
        for(let stage=0;stage<stages.length;stage++){
          for(let slot=0;slot<Math.min(questionsPerRound,count);slot++){
            const previous=stage*questionsPerRound+slot;
            const next=stage*count+slot;
            selectedPolls[next]=state.selectedPolls[previous];
            customQuestions[next]=state.customQuestions[previous];
            if(!customQuestions[next]) used.add(selectedPolls[next]);
          }
        }
        for(let index=0;index<count*3;index++){
          if(selectedPolls[index]!==undefined) continue;
          const next=automaticBankFor(state).findIndex((_,bankIndex)=>!used.has(bankIndex));
          selectedPolls[index]=next;
          used.add(next);
        }
        state.selectedPolls=selectedPolls;
        state.customQuestions=customQuestions;
      }
      state.questionsPerRound=count;
    } else if(host && body.action==='saveQuestions' && state.phase==='lobby' && state.version>=3){
      try {
        const customQuestions=parseCustomQuestions(body.questions,questionsPerRound*3,state.version>=4);
        const used=new Set();
        const selectedPolls=body.questions.map((entry,index)=>{
          const bankIndex=entry.bankIndex??state.selectedPolls?.[index]??index;
          if(!Number.isInteger(bankIndex) || bankIndex<0 || bankIndex>=bankFor(state).length){
            throw new Error('Question '+(index+1)+': Choose a question from the bank.');
          }
          if(entry.bankIndex===null && !customQuestions[index]){
            throw new Error('Question '+(index+1)+': Enter your custom question and answers.');
          }
          if(!customQuestions[index]){
            if(used.has(bankIndex)) throw new Error('Question '+(index+1)+': This YouGov question is already used in an earlier slot.');
            used.add(bankIndex);
          }
          return bankIndex;
        });
        state.customQuestions=customQuestions;
        state.selectedPolls=selectedPolls;
      } catch(error) {
        return fail(error.message);
      }
    } else if(host && body.action==='advance' && body.round===questionToken(state) && body.phase===state.phase){
      if(state.phase==='lobby' && state.teams.length<6){
        if(body.fillWithAi!==true) return fail('All six teams must join before starting.');
        if(!state.teams.length) return fail('At least one human team must join first.');
        for(let number=1; state.teams.length<6; number++){
          const name='AI Team '+number;
          if(state.teams.some(t=>t.name.toLowerCase()===name.toLowerCase())) continue;
          state.teams.push({key:token(),name,score:0,active:true,ai:true});
        }
      }
      if(state.phase==='open'){
        state.phase='reveal';
        const answers=questionAt(state,polls)[4];
        for(const t of state.teams){
          const guess=state.guesses[t.key];
          if(!guess) continue;
          const answer=state.version>=4 ? answers.find(([label])=>label===guess.text) : answers.find(([label,,...aliases])=>[label,...aliases].some(alias=>{
            const value=normalize(alias);
            const input=normalize(guess.text);
            return value===input || value+'s'===input || value===input+'s';
          }));
          guess.points=answer?.[1] ?? 0;
          if(state.tie) state.tie.scores[t.key]+=guess.points;
          else {
            t.score+=guess.points;
            const stageIndex=Math.floor(state.round/questionsPerRound);
            if(t.roundScores?.[stageIndex]!=null) t.roundScores[stageIndex]+=guess.points;
          }
        }
      } else if(state.phase==='reveal' && (state.round+1)%questionsPerRound===0){
        const cutoff=qualification(state, Math.floor(state.round / questionsPerRound));
        const {automatic,tied,slots}=cutoff;
        if(state.version>=4 && tied.length>slots){
          startTiebreak(state,cutoff);
          openQuestion(state,polls);
        } else {
          const picks = Array.isArray(body.picks) ? [...new Set(body.picks)] : [];
          if(tied.length>slots && (picks.length!==slots || picks.some(name=>!tied.some(t=>t.name===name)))){
            return fail('Select '+slots+' tied team(s) before confirming.');
          }
          const selected=automatic.concat(tied.length===slots?tied:tied.filter(t=>picks.includes(t.name)));
          delete state.tie;
          if(state.round===questionsPerRound*3-1){
            state.winner=selected[0].name;
            state.phase='finished';
          } else {
            state.qualified=selected.map(t=>t.name);
            state.teams.forEach(t=>{t.active=selected.includes(t);});
            state.phase='advancement';
          }
        }
      } else if(['lobby','reveal','advancement'].includes(state.phase)){
        if(state.version<4 && state.phase==='advancement') state.teams.filter(t=>t.active).forEach(t=>{t.score=0;});
        state.round++;
        openQuestion(state,polls);
      } else return fail('The game has ended.');
    } else if(team && !team.ai && (eligible(state,team) || (state.version>=4 && !team.active)) && body.action==='guess'){
      const answer=clean(body.answer);
      if(state.phase!=='open'||body.round!==questionToken(state)) return fail('This round is closed.');
      if(!answer) return fail('Enter one guess.');
      if(state.version>=4 && !choicesFor(questionAt(state,polls)).includes(answer)) return fail('Select an answer from the list.');
      if(!team.active){
        team.whatIfPicks??=[];
        const question=questionAt(state,polls)[1];
        const token=questionToken(state);
        if(team.whatIfPicks.at(-1)?.questionToken===token) return json(view(state,'team',team));
        team.whatIfPicks.push({questionToken:token,question,answer});
      } else if(Object.hasOwn(state.guesses,team.key)) return json(view(state,'team',team));
      else state.guesses[team.key]={text:answer};
    } else return fail('That action is unavailable.',409);
    const saved=await db.prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE code=? AND revision=?')
      .bind(JSON.stringify(state),code,row.revision).run();
    if(saved.meta.changes) return json(result??view(state,host?'host':'team',team));
  }
  return fail('The room is busy. Try again.',503);
}

export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(path==='/') return new Response(page,{headers:{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff'}});
    if(!path.startsWith('/api/')) return fail('Page not found.',404);
    if(request.method==='OPTIONS') return withCors(request,new Response(null,{status:204}));
    try { return withCors(request,await api(request,env.DB,path)); }
    catch(error) { console.error(error.message); return withCors(request,fail('Could not reach the game server. Try again.',503)); }
  }
};
