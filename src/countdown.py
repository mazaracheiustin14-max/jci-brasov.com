# Cronometru până la Beyond the Initiative (26 nov 2026, 17:00 ora României = 15:00 UTC). Rulat din post.py.
import re, glob
S='/home/claude/site/'
T={'ro':dict(kicker='Până la Beyond the Initiative',d='Zile',h='Ore',m='Min',s='Sec',date='Joi, 26 noiembrie 2026, ora 17:00, CATTIA Brașov',cta='Rezervă-ți locul',live='Evenimentul a început. Te așteptăm la CATTIA Brașov.',done='Mulțumim tuturor celor care au fost alături de noi la Beyond the Initiative.',aria='Timp rămas până la eveniment'),
   'en':dict(kicker='Countdown to Beyond the Initiative',d='Days',h='Hours',m='Min',s='Sec',date='Thursday, 26 November 2026, 5:00 pm, CATTIA Brașov',cta='Save your seat',live='The event has started. See you at CATTIA Brașov.',done='Thank you to everyone who joined us at Beyond the Initiative.',aria='Time left until the event')}
WA='https://chat.whatsapp.com/KAzFP6u8oMZDeslr1SfsNs'
CSS="""
/* cronometru eveniment */
.countdown{background:#130F2D;color:#fff;padding:56px 0;border-top:1px solid rgba(255,255,255,.06);text-align:center}
.countdown .kicker{color:var(--teal);font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:13px}
.cd-clock{display:flex;justify-content:center;align-items:flex-start;gap:clamp(6px,2vw,22px);margin:18px 0 6px}
.cd-unit{display:flex;flex-direction:column;align-items:center;min-width:clamp(64px,13vw,150px)}
.cd-num{font-size:clamp(52px,11vw,124px);font-weight:700;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.cd-lab{margin-top:10px;font-size:clamp(13px,1.6vw,17px);color:rgba(255,255,255,.65)}
.cd-sep{font-size:clamp(40px,8vw,92px);font-weight:700;line-height:1.1;color:var(--blue)}
.countdown .cd-date{color:rgba(255,255,255,.8);margin:14px 0 22px;font-size:17px}
.countdown .cd-msg{font-size:clamp(20px,3vw,28px);font-weight:600;margin:18px 0}
.countdown.compact{background:transparent;border:0;padding:0 0 36px;text-align:left}
.countdown.compact .cd-clock{justify-content:flex-start}
.countdown.compact .cd-unit{align-items:flex-start;min-width:clamp(56px,9vw,96px)}
.countdown.compact .cd-num{font-size:clamp(40px,7vw,72px)}
.countdown.compact .cd-sep{font-size:clamp(32px,5.5vw,56px)}
"""
def block(lang,compact=False):
    t=T[lang]
    cls='countdown compact' if compact else 'countdown'
    unit=lambda k,lab:f'<div class="cd-unit"><span class="cd-num" data-u="{k}">00</span><span class="cd-lab">{lab}</span></div>'
    sep='<span class="cd-sep" aria-hidden="true">:</span>'
    clock=f'<div class="cd-clock" role="timer" aria-label="{t["aria"]}">'+unit('d',t['d'])+sep+unit('h',t['h'])+sep+unit('m',t['m'])+sep+unit('s',t['s'])+'</div>'
    extra='' if compact else f'<p class="cd-date">{t["date"]}</p><a class="btn btn-blue" href="{WA}" target="_blank" rel="noopener">{t["cta"]}</a>'
    wrap_open='' if compact else '<section class="'+cls+'" aria-label="'+t['kicker']+'"><div class="wrap">'
    wrap_close='' if compact else '</div></section>'
    inner=f'<div class="cd-box" data-live="{t["live"]}" data-done="{t["done"]}"><div class="kicker">{t["kicker"]}</div>{clock}{extra}</div>'
    if compact: return f'<div class="{cls}">{inner}</div>'
    return wrap_open+inner+wrap_close
JS="""<script>(function(){var start=Date.UTC(2026,10,26,15,0,0),end=Date.UTC(2026,10,26,20,30,0);
function pad(n){return(n<10?'0':'')+n}
function tick(){var now=Date.now(),boxes=document.querySelectorAll('.cd-box');
boxes.forEach(function(b){if(now>=start){var c=b.querySelector('.cd-clock');if(c&&!b.dataset.fin){b.dataset.fin=1;var p=document.createElement('p');p.className='cd-msg';p.textContent=now<end?b.dataset.live:b.dataset.done;c.replaceWith(p);}return;}
var s=Math.floor((start-now)/1000),v={d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60};
b.querySelectorAll('.cd-num').forEach(function(e){e.textContent=pad(v[e.dataset.u]);});});}
tick();setInterval(tick,1000);})();</script>"""
def run():
    for lang,pre in (('ro',''),('en','en/')):
        p=S+pre+'index.html'; t=open(p,encoding='utf-8').read()
        if 'class="countdown"' not in t:
            i=t.index('<section class="hero"'); j=t.index('</section>',i)+len('</section>')
            t=t[:j]+'\n'+block(lang)+t[j:]
            t=t.replace('</body>',JS+'\n</body>',1)
            open(p,'w',encoding='utf-8').write(t)
        p=S+pre+'eveniment.html'; t=open(p,encoding='utf-8').read()
        if 'countdown compact' not in t:
            t=t.replace('<div class="event-head">',block(lang,True)+'\n    <div class="event-head">',1)
            t=t.replace('</body>',JS+'\n</body>',1)
            open(p,'w',encoding='utf-8').write(t)
    css=S+'assets/css/style.css'; c=open(css,encoding='utf-8').read()
    if '.cd-clock' not in c: open(css,'a',encoding='utf-8').write(CSS)
