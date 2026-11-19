import {legacyPolls,polls} from './polls.js';
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
  3: {polls, questionsPerRound:5}
};

function qualification(state, stageIndex) {
  const limit = [4, 2, 1][stageIndex];
  const ranked = state.teams.filter(t=>t.active).sort((a,b)=>b.score-a.score);
  const cutoff = ranked[limit-1].score;
  const automatic = ranked.filter(t=>t.score>cutoff);
  const tied = ranked.filter(t=>t.score===cutoff);
  return {automatic, tied, slots:limit-automatic.length};
}

function view(state, role, team) {
  const {polls,questionsPerRound} = formats[state.version];
  const stageIndex = Math.floor(state.round / questionsPerRound);
  const questionNumber = state.round % questionsPerRound + 1;
  const poll = polls[state.round];
  const reveal = state.phase === 'reveal';
  const live = state.phase === 'open' || reveal;
  const lastQuestion = reveal && questionNumber === questionsPerRound;
  const finalQuestion = state.round === polls.length - 1;
  const cutoff = lastQuestion ? qualification(state, stageIndex) : null;
  return {
    role, team: team?.name, eliminated: team?.active === false, round: state.round + 1, phase: state.phase,
    stage: live ? stages[stageIndex] : null, questionNumber: live ? questionNumber : null, questionsPerRound,
    lastQuestion, finalQuestion, winner: state.winner, qualified: state.qualified, category: live ? poll[0] : null,
    question: live ? poll[1] : null, slots: live ? poll[4].length : null,
    source: reveal ? 'https://yougov.com/en-us/' + poll[2] : null,
    year: reveal ? poll[3] : null, board: reveal ? poll[4].map(([answer,points])=>({answer,points})) : [],
    tiebreak: cutoff && cutoff.tied.length>cutoff.slots ? {names:cutoff.tied.map(t=>t.name),slots:cutoff.slots} : null,
    submitted: team && Object.hasOwn(state.guesses,team.key),
    teams: state.teams.map(t=>({
      name:t.name, ai:t.ai === true, score:t.score, active:t.active, submitted:Object.hasOwn(state.guesses,t.key),
      ...(reveal && t.active ? {guess:state.guesses[t.key]?.text, points:state.guesses[t.key]?.points ?? 0} : {})
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
      const state = {version:3,round:-1,phase:'lobby',teams:[],guesses:{}};
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
    const {polls,questionsPerRound}=formats[state.version];
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
    } else if(host && body.action==='advance' && body.round===state.round+1 && body.phase===state.phase){
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
        const answers=polls[state.round][4];
        for(const t of state.teams){
          const guess=state.guesses[t.key];
          if(!guess) continue;
          const answer=answers.find(([label,,...aliases])=>[label,...aliases].some(alias=>{
            const value=normalize(alias);
            const input=normalize(guess.text);
            return value===input || value+'s'===input || value===input+'s';
          }));
          guess.points=answer?.[1] ?? 0;
          t.score+=guess.points;
        }
      } else if(state.phase==='reveal' && (state.round+1)%questionsPerRound===0){
        const {automatic,tied,slots}=qualification(state, Math.floor(state.round / questionsPerRound));
        const picks = Array.isArray(body.picks) ? [...new Set(body.picks)] : [];
        if(tied.length>slots && (picks.length!==slots || picks.some(name=>!tied.some(t=>t.name===name)))){
          return fail('Select '+slots+' tied team(s) before confirming.');
        }
        const selected=automatic.concat(tied.length===slots?tied:tied.filter(t=>picks.includes(t.name)));
        if(state.round===polls.length-1){
          state.winner=selected[0].name;
          state.phase='finished';
        } else {
          state.qualified=selected.map(t=>t.name);
          state.teams.forEach(t=>{t.active=selected.includes(t);});
          state.phase='advancement';
        }
      } else if(['lobby','reveal','advancement'].includes(state.phase)){
        if(state.phase==='advancement') state.teams.filter(t=>t.active).forEach(t=>{t.score=0;});
        state.round++;
        state.phase='open';
        state.guesses={};
        const answers=polls[state.round][4];
        for(const t of state.teams.filter(team=>team.active && team.ai)){
          const [answer]=answers[Math.floor(Math.random()*answers.length)];
          state.guesses[t.key]={text:answer};
        }
      } else return fail('The game has ended.');
    } else if(team?.active && !team.ai && body.action==='guess'){
      const answer=clean(body.answer);
      if(state.phase!=='open'||body.round!==state.round+1) return fail('This round is closed.');
      if(!answer) return fail('Enter one guess.');
      if(Object.hasOwn(state.guesses,team.key)) return json(view(state,'team',team));
      state.guesses[team.key]={text:answer};
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
