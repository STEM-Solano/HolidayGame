import {qrScript} from './qr.js';
export const renderPage = (apiOrigin = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TEAM FEUD – HOLIDAY EDITION</title>
<style>
:root{color-scheme:dark;--ink:#f9f5ee;--muted:#b7b7d1;--panel:#191b35;--line:#353853;--lime:#dbf979;--accent:#bfb0ff}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 75% 0%,#32265f 0%,transparent 49%),#101122;color:var(--ink);font:1rem system-ui,sans-serif;min-height:100vh}
main{max-width:1000px;margin:auto;padding:32px 20px 48px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:17px;margin-bottom:38px;font-weight:800}small, p{color:var(--muted)}p{line-height:1.55}h1{font-size:clamp(2.2rem,7vw,4.8rem);line-height:1.02;letter-spacing:-.055em;margin:.18em 0 .32em}h2{margin:0 0 15px}h3{margin:0 0 8px}.tag{color:var(--accent);font-weight:750;letter-spacing:.13em;text-transform:uppercase;font-size:.86rem}.grid{display:grid;grid-template-columns:1.45fr 1fr;gap:19px;margin-top:26px}.card{background:var(--panel);border:1px solid var(--line);padding:clamp(19px,4vw,32px);border-radius:21px}.highlight{border-color:#565084}.code{font-size:clamp(1.8rem,8vw,3rem);letter-spacing:.13em;color:var(--lime);font-weight:900;margin:7px 0 14px}.controls{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}button,input,#guess-answer,#question-count{font:inherit;border-radius:11px;min-height:47px}button{padding:10px 16px;font-weight:800;color:#151729;background:var(--lime);border:1px solid transparent;cursor:pointer}button.secondary{background:transparent;color:var(--ink);border-color:#62658a}button:disabled{opacity:.55;cursor:default}input,#guess-answer,#question-count{padding:10px 12px;width:100%;color:var(--ink);background:#111228;border:1px solid #62658a}label{display:block;font-weight:700;margin:12px 0 6px}form button{margin-top:14px}.team,.answer{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding:12px 0;overflow-wrap:anywhere}.answer em{font-style:normal;color:var(--lime);font-weight:850}.blank{color:var(--muted)}.points{font-variant-numeric:tabular-nums;color:var(--lime);font-weight:850}.question{font-size:clamp(1.65rem,5.5vw,3.2rem)}#message{color:#ffc9d3;min-height:1.5em;margin-top:16px}a{color:var(--accent)}.tie{display:flex;align-items:center;gap:10px}.tie input{width:22px;min-height:26px}.join-code{margin:18px 0 10px;display:grid;justify-items:start;gap:7px}.join-code canvas{width:min(100%,220px);height:auto;image-rendering:pixelated;border-radius:8px}:focus-visible{outline:3px solid var(--accent);outline-offset:3px}@media(max-width:640px){.grid{grid-template-columns:1fr}header{margin-bottom:24px}main{padding-top:20px}}
dialog{width:min(680px,calc(100% - 28px));max-height:90dvh;padding:24px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:16px}dialog::backdrop{background:#08091ab8}dialog details{padding:12px 0;border-bottom:1px solid var(--line)}dialog summary{cursor:pointer;font-weight:700}dialog select,dialog textarea{width:100%;padding:10px 12px;background:#111228;color:var(--ink);border:1px solid #62658a;border-radius:11px;font:inherit;resize:vertical}dialog [role=status]{color:#ffc9d3;flex-basis:100%;margin:0}dialog [role=status]:empty{display:none}dialog h3:not(:first-child){margin-top:18px}dialog .controls{position:sticky;bottom:-24px;padding:12px 0;background:var(--panel)}
</style></head><body><main>
<header><span>◈ &nbsp; TEAM FEUD – HOLIDAY EDITION</span><small>6 teams · 3 rounds</small></header>
<div id="app"></div><p id="message" role="status"></p>
<dialog id="question-editor" aria-labelledby="question-editor-title"></dialog></main><script>
${qrScript}
const apiOrigin=${JSON.stringify(apiOrigin)};
const root=document.querySelector('#app');
const notice=document.querySelector('#message');
const questionEditor=document.querySelector('#question-editor');
const urlCode=(new URLSearchParams(location.search).get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
const watching=new URLSearchParams(location.search).get('watch')==='1';
const storageKey='crowd-score-session-v2';
let saved=null;
try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
let session=watching && urlCode.length===6 ? {code:urlCode,role:'watch'} : saved && (!urlCode || saved.code===urlCode) ? saved : null;
let current=null, lastView='', busy=false, epoch=0;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const message=value=>notice.textContent=value;
function remember(value){
  session=value; epoch++; current=null; lastView='';
  if(value) localStorage.setItem(storageKey,JSON.stringify(value)); else localStorage.removeItem(storageKey);
}
async function request(path,body,key=session?.key){
  const response=await fetch(apiOrigin+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(key?{'X-Player-Key':key}:{})},body:body?JSON.stringify(body):undefined});
  const data=await response.json();
  if(!response.ok) throw Object.assign(new Error(data.error||'Request failed.'),{status:response.status});
  return data;
}
function home(){
  root.innerHTML='<div class="tag">Team Feud: Holiday Edition Survey guessing game</div><h1>Guess what<br>the crowd said.</h1><p>Guess the most popular answers from published YouGov polls. The host sets the number of questions per round. Six teams start. Four advance to the semifinal, then two face off in the final.</p><div class="grid"><section class="card highlight"><h2>Join a game</h2><form id="join"><label for="code">Room code</label><input id="code" name="code" value="'+esc(urlCode)+'" minlength="6" maxlength="6" pattern="[A-Za-z0-9]{6}" required autocomplete="off" autocapitalize="characters"><label for="name">Team name</label><input id="name" name="name" maxlength="26" required autocomplete="off"><button>Join team</button> <button type="submit" name="mode" value="watch" formnovalidate class="secondary">Watch live</button></form></section><section class="card"><h2>Host a game</h2><p>Share the room link, then open and score each question.</p><button id="create">Create room</button></section></div>';
}
function roomLink(watch=false){
  const link=new URL(location.pathname,location.origin);
  link.searchParams.set('room',session.code);
  if(watch)link.searchParams.set('watch','1');
  return link.href;
}

function drawJoinCode(canvas){
  const qr=new QREncoder(-1,0);
  qr.addData(roomLink());
  qr.make();
  const quiet=4, scale=8, size=qr.getModuleCount();
  canvas.width=canvas.height=(size+2*quiet)*scale;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#000';
  for(let row=0;row<size;row++){
    for(let col=0;col<size;col++)if(qr.isDark(row,col)){
      ctx.fillRect((col+quiet)*scale,(row+quiet)*scale,scale,scale);
    }
  }
}

function render(game){
  const signature=JSON.stringify(game);
  if(signature===lastView) return;
  lastView=signature;
  const historyOpen=root.querySelector('#what-if-history')?.open;
  const draft=root.querySelector('#guess-answer');
  const questionId=(game.gameNumber??0)+'-'+game.round;
  const priorDraft=draft?.dataset.question===questionId ? draft.value : '';
  const active=draft && document.activeElement===draft;
  const caret=active && draft instanceof HTMLInputElement ? draft.selectionStart : null;
  const host=game.role==='host';
  const viewer=game.role==='watch';
  const teams=[...game.teams].sort((a,b)=>Number(b.active)-Number(a.active)||(b.tieScore??b.score??0)-(a.tieScore??a.score??0));
  const scoreRounds=game.scoreRounds??[];
  const roundScoreDetails=team=>scoreRounds.length
    ? '<br><small>'+scoreRounds.map((round,index)=>esc(round)+' '+(team.roundScores?.[index]??'—')).join(' · ')+'</small>'
    : '';
  const teamList=teams.map(t=>'<div class="team"><div><strong>'+esc(t.name)+'</strong>'+(t.ai?' <small>· AI</small>':'')+(!t.active?' <small>· eliminated</small>':'')+(game.phase==='open'&&t.submitted?' <small>· locked in</small>':'')+(game.phase==='reveal'&&t.guess?'<br><small>'+esc(t.guess)+' · +'+t.points+'</small>':'')+roundScoreDetails(t)+'</div>'+(t.score===undefined?'':'<span class="points">'+t.score+(scoreRounds.length?' <small>total</small>':'')+(t.tieScore===undefined?'':' <small>· '+t.tieScore+' tiebreak</small>')+'</span>')+'</div>').join('');
  let panel='';
  if(game.phase==='lobby'){
    const emptySlots=6-teams.length;
    const aiStart=teams.length>0 && emptySlots>0
      ? '<button id="advance-ai">Start with '+emptySlots+' AI '+(emptySlots===1?'team':'teams')+'</button>'
      : '';
    const customCount=game.questionSetup?.filter(question=>question.prompt).length??0;
    const editQuestions=game.questionSetup
      ? '<button class="secondary" id="edit-questions">Edit questions'+(customCount?' ('+customCount+' custom)':'')+'</button>'
      : '';
    const countPicker=game.dropdown
      ? '<label for="question-count">Questions per round</label><select id="question-count">'+
        Array.from({length:10},(_,index)=>'<option'+(index+1===game.questionsPerRound?' selected':'')+'>'+(index+1)+'</option>').join('')+'</select>'
      : '';
    panel='<div class="tag">Lobby</div><h1>Room is open.</h1><div class="code">'+esc(session.code)+'</div><p>'+game.teams.length+' of 6 teams joined.</p>'+(host?countPicker+'<div class="join-code"><strong>Scan to join a team</strong><canvas id="join-qr" role="img" aria-label="QR code to join this room"></canvas></div><div class="controls"><button class="secondary" id="copy">Copy team link</button><button class="secondary" id="watch-copy">Copy spectator link</button><button id="advance" '+(teams.length!==6?'disabled':'')+'>Start opening round</button>'+aiStart+editQuestions+'</div>':'<p>Waiting for the host to start.</p>');
  } else if(game.phase==='advancement'){
    panel='<div class="tag">Advancement</div><h1 class="question">'+(game.qualified.length===4?'Semifinal teams':'Final face-off')+'</h1>'+game.qualified.map(name=>'<div class="answer"><strong>'+esc(name)+'</strong></div>').join('')+(host?'<div class="controls"><button id="advance">Start '+(game.qualified.length===4?'semifinal':'final')+'</button></div>':'<p>Waiting for the host to start the next round.</p>');
  } else if(game.phase==='finished'){
    panel='<div class="tag">Champion</div><h1 class="question">'+esc(game.winner)+'</h1>'+(host||!game.dropdown?'<p>'+teams.find(t=>t.name===game.winner).score+' total points.</p>':'');
  } else {
    const revealed=game.phase==='reveal';
    panel='<div class="tag">'+esc(game.stage)+(game.tieActive?' · Tiebreaker':' · Question '+game.questionNumber+' of '+(game.questionsPerRound??2))+'</div><h1 class="question">'+esc(game.question)+'</h1>';
    if(revealed){
      if(game.dropdown && !host) panel+='<p>Waiting for the host to continue.</p>';
      panel+=game.board.map((a,i)=>'<div class="answer"><span>'+(i+1)+'. '+esc(a.answer)+'</span><em>'+a.points+'</em></div>').join('');
      if(game.source) panel+='<p><a href="'+esc(game.source)+'" target="_blank" rel="noopener noreferrer">Source: YouGov plc, '+game.year+', © All rights reserved</a></p>';
      if(host){
        if(game.lastQuestion && game.tiebreak && !game.dropdown){
          panel+='<p>Tie at the cutoff. Select '+game.tiebreak.slots+' tied team(s) after your tiebreaker.</p>'+game.tiebreak.names.map(name=>'<label class="tie"><input type="checkbox" name="pick" value="'+esc(name)+'"> '+esc(name)+'</label>').join('');
        }
        panel+='<div class="controls"><button id="advance">'+(game.dropdown && game.tiebreak?(game.tieActive?'Next tiebreak question':'Start tiebreaker') : !game.lastQuestion?'Next question':(game.finalQuestion??game.round===6)?'Crown champion':'Show advancing teams')+'</button></div>';
      }
    }else{
      if(host) panel+='<p>'+teams.filter(t=>t.submitted).length+' of '+teams.filter(t=>t.eligible??t.active).length+' teams locked in.</p><button id="advance">Reveal results</button>';
      else if(viewer||(game.dropdown?!game.canGuess:game.eliminated)) panel+='<p>'+teams.filter(t=>t.submitted).length+' of '+teams.filter(t=>t.eligible??t.active).length+' teams locked in. Waiting for the host to continue.</p>';
      else if(game.submitted) panel+=game.eliminated?'<p>What If pick saved. Waiting for the host.</p>':'<p>Guess locked in. Waiting for the host.</p>';
      else if(game.dropdown) panel+='<form id="guess"><label for="guess-answer">Your team’s answer</label><select id="guess-answer" name="answer" data-question="'+questionId+'" required><option value="">Choose an answer</option>'+
        game.choices.map(choice=>'<option'+(choice===priorDraft?' selected':'')+'>'+esc(choice)+'</option>').join('')+'</select><button>'+(game.eliminated?'Save What If pick':'Lock in answer')+'</button></form>';
      else panel+='<form id="guess"><label for="guess-answer">Your team’s guess</label><input id="guess-answer" name="answer" data-question="'+questionId+'" value="'+esc(priorDraft)+'" maxlength="120" required autocomplete="off"><button>Lock in guess</button></form>';
      if(game.slots!==null) panel+='<p><small>'+game.slots+' answers on the board.</small></p>';
    }
  }
  if(game.dropdown && game.eliminated){
    panel+='<section><h2>What If</h2><p>Keep playing. Your picks are private to your team and do not affect the game results.</p>'+
      ((game.whatIfPicks??[]).length?'<details id="what-if-history"'+(historyOpen?' open':'')+'><summary>Your saved picks ('+(game.whatIfPicks??[]).length+')</summary><ol>'+
        game.whatIfPicks.map(pick=>'<li>'+esc(pick.question)+' <strong>'+esc(pick.answer)+'</strong></li>').join('')+'</ol></details>':'')+'</section>';
  }
  const roomControls='<div class="controls">'+(host&&game.phase!=='lobby'
    ? '<button class="secondary" id="restart">Start over</button>' : '')+
    '<button class="secondary" id="leave">Quit</button></div>';
  root.innerHTML='<div class="grid"><section class="card highlight">'+panel+'</section><aside class="card"><h2>'+(host||viewer&&!game.dropdown?'Scoreboard':viewer?'Teams':'Team '+esc(game.team))+'</h2>'+(teamList||'<p>No teams have joined yet.</p>')+roomControls+'</aside></div>';
  const canvas=root.querySelector('#join-qr');
  if(canvas)drawJoinCode(canvas);
  if(active && priorDraft!==undefined){
    const replacement=root.querySelector('#guess-answer');
    replacement?.focus();
    if(caret!==null && replacement instanceof HTMLInputElement) replacement.setSelectionRange(caret,caret);
  }
}
const endpoint=()=>'/api/room/'+session.code+(session.role==='watch'?'?watch=1':'');
async function refresh(){
  if(!session||busy)return;
  const version=epoch;
  try{
    const data=await request(endpoint());
    if(version!==epoch||busy)return;
    current=data; render(data);
  }catch(error){
    if(version!==epoch)return;
    if(error.status===403||error.status===404){if(session?.role==='watch'){session=null;lastView='';}else remember(null);home();}
    message(error.message);
  }
}
async function act(work){
  if(busy)return;
  busy=true; epoch++; message('');
  try{await work();}catch(error){message(error.message);}
  finally{busy=false;void refresh();}
}
function editQuestions(game){
  const count=game.questionsPerRound;
  const stages=['Opening round','Semifinal','Final face-off'];
  const slots=game.questionSetup.map((question,index)=>{
    const heading=index%count===0?'<h3>'+stages[Math.floor(index/count)]+'</h3>':'';
    const selected=question.prompt?'custom':String(question.bankIndex??index);
    const currentChoice=game.questionBank?.[Number(selected)];
    const picker=game.questionBank
      ? '<label for="bank-'+index+'">Question source</label><select id="bank-'+index+'" name="bank">'+
        '<option value="'+selected+'"></option></select>'
      : '';
    return heading+'<details><summary>Question '+(index%count+1)+' · <span>'+esc(currentChoice?.title??(question.prompt?'Custom':'Built-in'))+'</span></summary>'+
      picker+'<p class="bank-prompt"'+(selected==='custom'?' hidden':'')+'>'+esc(currentChoice?.prompt??question.defaultPrompt)+'</p>'+
      '<div class="custom-fields"'+(game.questionBank&&selected!=='custom'?' hidden':'')+'>'+
      '<label for="prompt-'+index+'">Custom question</label><input id="prompt-'+index+'" name="prompt" maxlength="240" value="'+esc(question.prompt)+'">'+
      '<label for="answers-'+index+'">Answers and points</label><textarea id="answers-'+index+'" name="answers" rows="4" maxlength="8500" placeholder="Hot chocolate | 40 | cocoa">'+esc(question.answers)+'</textarea>'+
      (game.dropdown?'<label for="distractors-'+index+'">Non-scoring choices</label><textarea id="distractors-'+index+'" name="distractors" rows="3" maxlength="730">'+esc(question.distractors)+'</textarea>':'')+'</div></details>';
  }).join('');
  const instructions=game.questionBank
    ? 'Choose '+count+' questions for each round from the '+game.questionBank.length+' YouGov questions, or write your own. Use each YouGov question once.'
    : 'Leave both fields blank to use the built-in question.';
  questionEditor.innerHTML='<h2 id="question-editor-title">Edit questions</h2><p>'+instructions+'</p><p>For custom questions, enter 2 to 10 answers, one per line. Use <strong>Answer | Points | Alternate spelling</strong>. Points must be whole numbers from 1 to 100.</p>'+(game.dropdown?'<p>Add 2 to 6 plausible non-scoring choices, one per line.</p>':'')+'<form>'+slots+'<div class="controls"><p role="status"></p><button>Save questions</button><button type="button" class="secondary" id="close-editor">Cancel</button></div></form>';
  if(game.questionBank) updateQuestionOptions(game.questionBank);
  questionEditor.scrollTop=0;
  questionEditor.showModal();
}
questionEditor.addEventListener('click',event=>{
  if(event.target.id==='close-editor') questionEditor.close();
});
function updateQuestionOptions(bank){
  const used=new Set();
  let cleared=false;
  for(const picker of questionEditor.querySelectorAll('select[name=bank]')){
    let selected=picker.value;
    if(used.has(selected)){
      selected='';
      cleared=true;
    }
    const options=bank.map(({title},index)=>{
      const value=String(index);
      return used.has(value)?'':'<option value="'+value+'">'+esc(title)+'</option>';
    }).join('');
    picker.innerHTML='<option value="" disabled>Choose a question</option>'+
      '<option value="custom">Write a custom question</option>'+options;
    picker.value=selected;
    const choice=selected===''?null:bank[Number(selected)];
    if(choice) used.add(selected);
    const slot=picker.closest('details');
    const prompt=slot.querySelector('.bank-prompt');
    prompt.hidden=!choice;
    prompt.textContent=choice?.prompt??'';
    slot.querySelector('.custom-fields').hidden=selected!=='custom';
    slot.querySelector('summary span').textContent=choice?.title??(selected==='custom'?'Custom':'Choose a question');
  }
  questionEditor.querySelector('[role=status]').textContent=cleared
    ? 'An earlier slot now uses that question. Choose a replacement for the cleared slot.'
    : '';
}
questionEditor.addEventListener('change',event=>{
  if(event.target.name==='bank') updateQuestionOptions(current.questionBank);
});
questionEditor.addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy) return;
  const form=new FormData(event.target);
  const answers=form.getAll('answers');
  const distractors=form.getAll('distractors');
  const bankChoices=[...event.target.querySelectorAll('select[name=bank]')].map(picker=>picker.value);
  const emptySlot=bankChoices.indexOf('');
  const status=questionEditor.querySelector('[role=status]');
  if(emptySlot!==-1){
    const picker=questionEditor.querySelector('#bank-'+emptySlot);
    picker.closest('details').open=true;
    picker.focus();
    status.textContent='Choose a question for every slot before saving.';
    return;
  }
  const questions=form.getAll('prompt').map((prompt,index)=>{
    const choice=bankChoices[index];
    if(choice && choice!=='custom') return {bankIndex:Number(choice),prompt:'',answers:''};
    return {bankIndex:choice==='custom'?null:undefined,prompt,answers:answers[index],distractors:distractors[index]};
  });
  const button=questionEditor.querySelector('button');
  status.textContent='';
  button.disabled=true;
  busy=true;
  epoch++;
  try{
    current=await request(endpoint(),{action:'saveQuestions',gameNumber:current.gameNumber,questions});
    render(current);
    questionEditor.close();
    message('Questions saved.');
  }catch(error){
    status.textContent=error.message;
    const question=Number(error.message.match(/^Question ([0-9]+):/)?.[1]);
    if(question){
      const slot=questionEditor.querySelectorAll('details')[question-1];
      slot.open=true;
      slot.scrollIntoView({block:'nearest'});
    }
  }finally{
    button.disabled=false;
    busy=false;
    void refresh();
  }
});
root.addEventListener('click',event=>{
  const id=event.target.id;
  if(id==='edit-questions' && !busy) editQuestions(current);
  if(id==='create')void act(async()=>{remember(await request('/api/create',{}));});
  if(id==='copy'||id==='watch-copy')void act(async()=>{
    const link=roomLink(id==='watch-copy');
    try{await navigator.clipboard.writeText(link);message('Link copied.');}
    catch{message('Room link: '+link);}
  });
  if(id==='advance'||id==='advance-ai')void act(async()=>{const game=await request(endpoint(),{action:'advance',gameNumber:current.gameNumber,fillWithAi:id==='advance-ai',phase:current.phase,round:current.round,picks:[...root.querySelectorAll('[name=pick]:checked')].map(input=>input.value)});current=game;render(game);});
  if(id==='restart' && !busy && confirm('Start over for everyone in this room? Scores and guesses will reset.')){
    void act(async()=>{
      current=await request(endpoint(),{action:'restart',gameNumber:current.gameNumber});
      render(current);
    });
  }
  if(id==='leave' && !busy){
    if(session.role==='host' && !confirm('Quit hosting and return to the home screen?')) return;
    if(session.role!=='watch') remember(null);
    location.href=location.pathname;
  }
});
root.addEventListener('change',event=>{
  if(event.target.id!=='question-count') return;
  const count=Number(event.target.value);
  event.target.value=current.questionsPerRound;
  void act(async()=>{
    current=await request(endpoint(),{action:'setQuestionCount',gameNumber:current.gameNumber,count});
    render(current);
  });
});
root.addEventListener('submit',event=>{
  event.preventDefault();
  const values=new FormData(event.target);
  if(event.target.id==='join' && event.submitter?.value==='watch'){
    const code=String(values.get('code')).trim().toUpperCase();
    if(!/^[A-Z0-9]{6}$/.test(code)){message('Enter a six-character room code.');return;}
    location.search=new URLSearchParams({room:code,watch:'1'}).toString();
    return;
  }
  if(event.target.id==='join')void act(async()=>{
    const code=String(values.get('code')).trim().toUpperCase();
    remember(await request('/api/room/'+encodeURIComponent(code),{action:'join',name:values.get('name')}));
  });
  if(event.target.id==='guess')void act(async()=>{
    const game=await request(endpoint(),{action:'guess',gameNumber:current.gameNumber,answer:values.get('answer'),round:current.round});
    current=game;render(game);
  });
});
if(session){root.textContent='Connecting to room…';void refresh();}else home();
setInterval(refresh,1400);
</script></body></html>`;

export const page = renderPage();
