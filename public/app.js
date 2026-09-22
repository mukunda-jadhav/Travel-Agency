const chat=document.querySelector('#chat');
const input=document.querySelector('#message');
const activity=document.querySelector('#activity');
const key='voyage-travel-demo-v1';
let state;
try{state=JSON.parse(localStorage.getItem(key))}catch{}
if(!state||!/^demo-[a-zA-Z0-9-]{3,80}$/.test(state.userId)||!Array.isArray(state.messages))state={userId:`demo-${crypto.randomUUID()}`,messages:[]};
let busy=false,enabled=false;
function save(){try{localStorage.setItem(key,JSON.stringify(state))}catch{}}
function bubble(text,who){const el=document.createElement('div');el.className=`msg ${who}`;const label=document.createElement('span');label.className='sender';label.textContent=who==='user'?'You':'Travel assistant';el.append(label,document.createTextNode(text));chat.append(el);chat.scrollTop=chat.scrollHeight;}
function append(text,who){state.messages.push({text,who});state.messages=state.messages.slice(-100);save();bubble(text,who)}
function lock(value){busy=value;document.querySelectorAll('button').forEach(b=>b.disabled=value||!enabled);input.disabled=value||!enabled;}
async function send(text){
  text=text.trim();if(!text||busy||!enabled)return;
  const pending=state.pending;
  if(pending&&pending.message!==text){activity.textContent='Retry your previous message first so the conversation stays in sync.';return}
  if(!pending){state.pending={message:text,messageId:crypto.randomUUID()};append(text,'user')}
  input.value='';lock(true);activity.classList.remove('error');activity.textContent='Your assistant is typing…';
  try{
    const response=await fetch('/api/demo/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:state.userId,...state.pending}),signal:AbortSignal.timeout(30000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to send message.');
    delete state.pending;append(data.reply,'bot');activity.textContent='';
  }catch(e){activity.classList.add('error');activity.textContent='Message not completed. Press Send to retry. '+(e.name==='TimeoutError'?'The request timed out.':e.message);input.value=text;save()}
  finally{lock(false);input.focus()}
}
document.querySelector('#composer').addEventListener('submit',e=>{e.preventDefault();send(input.value)});
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send(input.value)}});
document.querySelectorAll('[data-message]').forEach(b=>b.addEventListener('click',()=>send(b.dataset.message)));
document.querySelector('#reset').addEventListener('click',()=>send('/reset'));
for(const m of state.messages)if(typeof m.text==='string')bubble(m.text,m.who==='user'?'user':'bot');
if(!state.messages.length)append('Welcome! I can help you find flights, hotels and cabs, and save a demo booking. Where would you like to go?\n\nChoose an example or type your own request. No API keys or payment details needed.','bot');
if(state.pending){input.value=state.pending.message;activity.textContent='Your last message needs a retry. Press Send to continue.'}
lock(true);
fetch('/api/demo/config').then(r=>{if(!r.ok)throw new Error();return r.json()}).then(c=>{enabled=c.demoMode;document.querySelectorAll('[data-brand]').forEach(el=>el.textContent=c.appName);document.title=c.appName+' · Travel assistant';lock(false);if(!enabled)activity.textContent='Browser preview is available with DEMO_MODE=true. Use WhatsApp for connected mode.'}).catch(()=>{activity.textContent='Unable to connect. Check that the server is running, then reload.';lock(false)});
