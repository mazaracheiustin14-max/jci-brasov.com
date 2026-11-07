# Asistentul de pe site: buton flotant + panou de chat, pe toate paginile RO și EN.
# Rulat din post.py, după signup.run(), ca să stea după bara fixă de înscriere.
import glob

S = '/home/claude/site/'

T = {
    'ro': dict(
        fab='Întreabă-ne', title='Asistent JCI Brașov', sub='Răspunde din informațiile de pe site',
        hello='Bună! Te pot ajuta cu informații despre evenimentul din 26 noiembrie, sponsorizare, proiecte sau cum devii membru. Ce vrei să afli?',
        ph='Scrie întrebarea ta…', send='Trimite', close='Închide asistentul', typing='Scrie…', reset='Conversație nouă',
        note='Asistent automat. Pentru confirmări scrie la contact@jci-brasov.com. Întrebările se păstrează anonim, ca să îmbunătățim răspunsurile.',
        err='Nu am putut trimite mesajul. Verifică conexiunea sau scrie-ne la contact@jci-brasov.com.',
        sug=['Cât costă participarea pe 26 noiembrie?', 'Cum devin membru JCI Brașov?', 'Ce pachete de sponsorizare aveți?', 'Unde are loc evenimentul?'],
    ),
    'en': dict(
        fab='Ask us', title='JCI Brașov assistant', sub='Answers from the information on this site',
        hello='Hi! I can help with the 26 November event, sponsorship, projects or how to become a member. What would you like to know?',
        ph='Type your question…', send='Send', close='Close the assistant', typing='Typing…', reset='New conversation',
        note='Automated assistant. For confirmations, email contact@jci-brasov.com. Questions are stored anonymously to improve the answers.',
        err='The message could not be sent. Check your connection or email contact@jci-brasov.com.',
        sug=['How much does the 26 November event cost?', 'How do I become a member?', 'What sponsorship packages do you offer?', 'Where is the event held?'],
    ),
}

CSS = '''<style id="jchat-css">
#jchat{--jc-b:#0097D7;font-family:inherit}
#jchat .jc-fab{position:fixed;right:18px;bottom:18px;z-index:70;display:flex;align-items:center;gap:10px;height:54px;padding:0 20px 0 16px;border:0;border-radius:999px;background:var(--jc-b);color:#fff;font:inherit;font-weight:700;font-size:15px;cursor:pointer;box-shadow:0 14px 40px -10px rgba(0,151,215,.7),0 0 0 1px rgba(255,255,255,.12) inset;transition:transform .15s}
#jchat .jc-fab:hover{transform:translateY(-2px)}
#jchat .jc-fab svg{width:24px;height:24px;flex:none}
#jchat.open .jc-fab{display:none}
#jchat .jc-panel{position:fixed;right:18px;bottom:18px;z-index:71;width:380px;max-width:calc(100vw - 24px);height:min(600px,calc(100vh - 36px));display:none;flex-direction:column;background:#14113A;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:20px;overflow:hidden;box-shadow:0 30px 90px -20px rgba(0,0,0,.8),0 0 60px -20px rgba(0,151,215,.5)}
#jchat.open .jc-panel{display:flex}
#jchat .jc-head{display:flex;align-items:center;gap:12px;padding:14px 14px 14px 18px;background:radial-gradient(120% 140% at 0% 0%,rgba(0,151,215,.35),transparent 60%),#1A1646;border-bottom:1px solid rgba(255,255,255,.08)}
#jchat .jc-head b{display:block;font-size:15px;font-weight:800;letter-spacing:.02em}
#jchat .jc-head small{display:block;font-size:12px;color:#B9BBD6;margin-top:2px}
#jchat .jc-head .jc-t{flex:1;min-width:0}
#jchat .jc-ico{width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:#fff;cursor:pointer;display:grid;place-items:center;flex:none}
#jchat .jc-ico:hover{background:rgba(255,255,255,.16)}
#jchat .jc-ico svg{width:18px;height:18px}
#jchat .jc-log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
#jchat .jc-m{max-width:88%;padding:10px 14px;border-radius:16px;font-size:14.5px;line-height:1.5;word-wrap:break-word}
#jchat .jc-m p{margin:0 0 6px}#jchat .jc-m p:last-child{margin:0}
#jchat .jc-m ul{margin:4px 0;padding-left:18px}#jchat .jc-m li{margin:2px 0}
#jchat .jc-m a{color:#7FD3F7;text-decoration:underline;text-underline-offset:2px}
#jchat .jc-a{align-self:flex-start;background:#221E55;border-bottom-left-radius:6px}
#jchat .jc-u{align-self:flex-end;background:var(--jc-b);border-bottom-right-radius:6px}
#jchat .jc-typing{color:#B9BBD6;font-style:italic}
#jchat .jc-sug{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 10px}
#jchat .jc-sug button{border:1px solid rgba(0,151,215,.55);background:transparent;color:#fff;border-radius:999px;padding:7px 12px;font:inherit;font-size:13px;cursor:pointer;text-align:left}
#jchat .jc-sug button:hover{background:rgba(0,151,215,.18)}
#jchat form{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.08);background:#110E31}
#jchat textarea{flex:1;resize:none;height:44px;max-height:110px;padding:11px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:#0B0920;color:#fff;font:inherit;font-size:16px;line-height:1.35}
#jchat textarea:focus{outline:2px solid var(--jc-b);outline-offset:0;border-color:transparent}
#jchat .jc-send{width:44px;height:44px;border:0;border-radius:12px;background:var(--jc-b);color:#fff;cursor:pointer;display:grid;place-items:center;flex:none}
#jchat .jc-send:disabled{opacity:.5;cursor:default}
#jchat .jc-send svg{width:20px;height:20px}
#jchat .jc-note{font-size:11px;line-height:1.4;color:#8E90AE;padding:0 14px 10px;background:#110E31}
@media(max-width:900px){.sticky-cta.on~#jchat .jc-fab{bottom:80px}}
@media(max-width:560px){
#jchat .jc-fab{padding:0;width:54px;justify-content:center}
#jchat .jc-fab span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
#jchat .jc-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100%;height:100dvh;border-radius:0;border:0}
}
@media(prefers-reduced-motion:reduce){#jchat .jc-fab{transition:none}}
</style>'''

ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 10.5h7M8.5 14h4.5"/></svg>'
ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
ICON_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>'
ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>'


def html(t):
    return f'''<div id="jchat" data-hello="{t['hello']}" data-typing="{t['typing']}" data-err="{t['err']}">
<button type="button" class="jc-fab" aria-haspopup="dialog" aria-controls="jc-panel">{ICON_CHAT}<span>{t['fab']}</span></button>
<section class="jc-panel" id="jc-panel" role="dialog" aria-modal="false" aria-labelledby="jc-title">
<div class="jc-head"><div class="jc-t"><b id="jc-title">{t['title']}</b><small>{t['sub']}</small></div>
<button type="button" class="jc-ico jc-reset" aria-label="{t['reset']}" title="{t['reset']}">{ICON_R}</button>
<button type="button" class="jc-ico jc-close" aria-label="{t['close']}" title="{t['close']}">{ICON_X}</button></div>
<div class="jc-log" aria-live="polite"></div>
<div class="jc-sug">{''.join(f'<button type="button">{q}</button>' for q in t['sug'])}</div>
<form><label for="jc-in" class="sr-only">{t['ph']}</label><textarea id="jc-in" rows="1" maxlength="500" placeholder="{t['ph']}"></textarea>
<button type="submit" class="jc-send" aria-label="{t['send']}">{ICON_SEND}</button></form>
<div class="jc-note">{t['note']}</div>
</section></div>'''


JS = r'''<script>
(function(){
var w=document.getElementById('jchat');if(!w)return;
var en=(document.documentElement.lang||'ro').slice(0,2)==='en',K='jci-chat-'+(en?'en':'ro');
var log=w.querySelector('.jc-log'),sug=w.querySelector('.jc-sug'),form=w.querySelector('form'),inp=w.querySelector('textarea'),btn=w.querySelector('.jc-send'),fab=w.querySelector('.jc-fab');
var msgs=[];try{msgs=JSON.parse(sessionStorage.getItem(K)||'[]')}catch(e){}
function save(){try{sessionStorage.setItem(K,JSON.stringify(msgs.slice(-20)))}catch(e){}}
function esc(s){return s.replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var L=en?{'eveniment#rezerva':'event registration form','eveniment#formular-sponsor':'partnership form','eveniment#parteneri':'sponsorship packages','eveniment#intrebari':'event FAQ','eveniment':'event page','implica-te':'Become a member','inscriere':'membership form','proiecte':'Projects','echipa':'Team','despre':'About us','contact':'Contact','':'home page'}
:{'eveniment#rezerva':'formularul de înscriere la eveniment','eveniment#formular-sponsor':'formularul de parteneriat','eveniment#parteneri':'pachetele de sponsorizare','eveniment#intrebari':'întrebările frecvente','eveniment':'pagina evenimentului','implica-te':'Devino membru','inscriere':'formularul de membru','proiecte':'Proiecte','echipa':'Echipa','despre':'Despre noi','contact':'Contact','':'prima pagină'};
function label(p){var k=p.replace(/^\/(en\/)?/,'');return L[k]||L[k.split('#')[0]]||('jci-brasov.com'+p)}
var PAGES=/^\/(en\/)?(eveniment|implica-te|inscriere|proiecte|echipa|despre|contact)?(#[a-z-]+)?$/;
function inline(s){
  s=esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  return s.replace(/(https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+)|([\w.+-]+@[\w-]+\.[\w.]+)|(\+40[\d ]{9,13}\d)|(^|[\s(])(\/(?:en\/)?[a-z-]*(?:#[a-z-]+)?)(?=[\s).,;:!?]|$)/g,function(m,wa,em,ph,pre,path){
    if(wa)return '<a href="'+wa+'" target="_blank" rel="noopener">'+(en?'WhatsApp community':'comunitatea WhatsApp')+'</a>';
    if(em)return '<a href="mailto:'+em+'">'+em+'</a>';
    if(ph)return '<a href="tel:'+ph.replace(/\s/g,'')+'">'+ph+'</a>';
    if(path&&PAGES.test(path))return pre+'<a href="'+path+'">'+label(path)+'</a>';
    return m;});
}
function fmt(t){
  var out='',list=false;
  t.split(/\n+/).forEach(function(l){l=l.trim();if(!l)return;
    var li=/^([-*•]|\d+[.)])\s+/.test(l);
    if(li){if(!list){out+='<ul>';list=true}out+='<li>'+inline(l.replace(/^([-*•]|\d+[.)])\s+/,''))+'</li>'}
    else{if(list){out+='</ul>';list=false}out+='<p>'+inline(l)+'</p>'}});
  return out+(list?'</ul>':'');
}
function add(role,text,cls){var d=document.createElement('div');d.className='jc-m '+(role==='user'?'jc-u':'jc-a')+(cls?' '+cls:'');
  if(role==='user')d.textContent=text;else d.innerHTML=fmt(text);log.appendChild(d);log.scrollTop=log.scrollHeight;return d}
function render(){log.innerHTML='';add('assistant',w.dataset.hello);msgs.forEach(function(m){add(m.role,m.content)});sug.style.display=msgs.length?'none':''}
function open(){w.classList.add('open');if(!log.childNodes.length)render();setTimeout(function(){inp.focus()},50)}
function close(){w.classList.remove('open');fab.focus()}
fab.addEventListener('click',open);
w.querySelector('.jc-close').addEventListener('click',close);
w.querySelector('.jc-reset').addEventListener('click',function(){msgs=[];save();render();inp.focus()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&w.classList.contains('open'))close()});
sug.addEventListener('click',function(e){if(e.target.tagName==='BUTTON')ask(e.target.textContent)});
inp.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit?form.requestSubmit():ask(inp.value)}});
inp.addEventListener('input',function(){inp.style.height='44px';inp.style.height=Math.min(inp.scrollHeight,110)+'px'});
form.addEventListener('submit',function(e){e.preventDefault();ask(inp.value)});
var busy=false;
function ask(q){q=(q||'').trim();if(!q||busy)return;busy=true;btn.disabled=true;inp.value='';inp.style.height='44px';sug.style.display='none';
  msgs.push({role:'user',content:q.slice(0,500)});save();add('user',q);
  var t=add('assistant',w.dataset.typing,'jc-typing');
  fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lang:en?'en':'ro',page:location.pathname,messages:msgs.slice(-8)})})
  .then(function(r){return r.json()}).then(function(j){t.remove();var a=(j&&j.answer)||w.dataset.err;add('assistant',a);if(j&&j.answer&&!j.limited){msgs.push({role:'assistant',content:a});save()}})
  .catch(function(){t.remove();add('assistant',w.dataset.err)})
  .then(function(){busy=false;btn.disabled=false;inp.focus()});
}
if(location.hash==='#asistent')open();
})();
</script>'''


def run():
    for p in glob.glob(S + '*.html') + glob.glob(S + 'en/*.html'):
        s = open(p, encoding='utf8').read()
        if 'id="jchat"' in s or '</body>' not in s or p.endswith(('inscriere-confirmata.html', 'multumim.html')):
            continue
        t = T['en' if '/en/' in p else 'ro']
        s = s.replace('</head>', CSS + '\n</head>', 1)
        s = s.replace('</body>', html(t) + '\n' + JS + '\n</body>', 1)
        open(p, 'w', encoding='utf8').write(s)


if __name__ == '__main__':
    run()
