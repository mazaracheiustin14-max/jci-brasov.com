# Tema „campanie” pe tot site-ul: fundal închis, titluri mari cu majuscule, carduri închise cu lumină albastră.
# Inspirată din pagina Bank Friday, adaptată pe paleta JCI 2026 și Plus Jakarta Sans. Rulat din post.py.
S='/home/claude/site/'
CSS = r"""
/* ===== TEMA CAMPANIE (închisă) ===== */
:root{--bg:#0B0920;--card:#14113A;--card2:#1A1646;--txt:#FFFFFF;--soft:#B9BBD6;--muted:#A9ABC8;--line:rgba(255,255,255,.10);--mist:#0F0C2A;--paper:#0B0920}
body{background:var(--bg);color:var(--txt)}
a{color:#7FCDEE}
.section{background:var(--bg)}
.section.mist{background:var(--mist)}
.section.dark{background:var(--bg)}
.section+.section{border-top:1px solid rgba(255,255,255,.05)}
/* titluri de campanie */
h2,.page-intro h1,h1.as-h2{text-transform:uppercase;font-weight:800;letter-spacing:-.025em;line-height:1.02}
h2{font-size:clamp(34px,5.6vw,68px)}
h1.as-h2{font-size:clamp(38px,6vw,76px)}
.page-intro{background:radial-gradient(80% 120% at 50% 0%,rgba(0,151,215,.20),transparent 60%),var(--bg);text-align:center}
.page-intro h1{font-size:clamp(44px,8vw,104px)}
.page-intro p{margin-inline:auto}
.page-intro .crumb{justify-content:center}
.page-intro svg{opacity:.35}
.hero h1{text-transform:uppercase;font-weight:800;letter-spacing:-.03em;line-height:1;font-size:clamp(44px,6.4vw,92px)}
h2.as-h3,h2.as-h3t{text-transform:none;font-size:20px;letter-spacing:0;line-height:1.2;font-weight:700}
h2.as-h3t{font-size:19px}
h3{color:inherit}
/* antete de secțiune centrate */
.section>.wrap>.tag{display:table;margin-inline:auto}
.section>.wrap>h2,.section>.wrap>.lead{text-align:center;margin-inline:auto}
.lead,.dark .lead{color:var(--soft)}
.story p{color:var(--soft)}
.story strong{color:#fff}
/* carduri închise cu lumină */
.pillars li,.pack,.proj,.teaser,.fee,form.signup,.steps li,.benefits li,.quote,.mist .quote,.speaker,.facts div,.hcard{
  background:radial-gradient(120% 90% at 0% 0%,rgba(0,151,215,.16),transparent 55%),var(--card);
  border:1px solid var(--line);color:#fff}
.pack.hi{border:2px solid var(--blue);box-shadow:0 0 0 6px rgba(0,151,215,.08),0 30px 80px -30px rgba(0,151,215,.55)}
.teaser{color:#fff}
.teaser:hover{border-color:var(--blue);box-shadow:0 20px 60px -30px rgba(0,151,215,.6)}
.steps li{border-left:6px solid var(--blue)}
.steps li::before{color:#fff}
.pillars .n{background:var(--blue-ink)}
.quote p{color:#fff}
.quote small,.pack small,.fee small,.teaser small,.proj .status{color:var(--teal)}
.timeline .y{color:var(--teal)}
.timeline::before{background:rgba(255,255,255,.12)}
.timeline li::after{background:var(--bg)}
.proj.next{background:transparent;border:1px dashed rgba(255,255,255,.22)}
.proj .art-img{background:var(--card2)}
.proj .art-logo{background:#fff}
.person b{color:#fff}
.person span{color:var(--muted)}
.teaser .go,.person.lead-role span{color:#4FBDEB}
.hcard .badge{color:var(--ink)}
.btn-ghost.on-light{color:#fff}
.inkind,.venue,.over40,.form-note,.check{color:var(--soft)}
.venue b{color:#fff}
/* formulare pe fundal închis */
.field label{color:#fff}
.field input,.field select,.field textarea{background:#0F0C2C;color:#fff;border:1px solid rgba(255,255,255,.18)}
.field input::placeholder,.field textarea::placeholder{color:#7E80A3}
.field select option{background:#14113A;color:#fff}
.form-msg.ok{background:#0F3B3B;color:#CFF3F3}
.form-msg.info{background:#3A3200;color:#FFF3B8}
/* cronometru: aceeași bandă, fără chenar */
.countdown{background:radial-gradient(60% 120% at 50% 100%,rgba(0,151,215,.18),transparent 60%),var(--bg)}
.cd-num{font-weight:800}
footer{background:#07061A}
.section>.wrap>.cta-row{justify-content:center}
.section>.wrap>.inkind,.section>.wrap>.venue,.section>.wrap>.over40{text-align:center}
.fees{max-width:820px;margin-inline:auto}
.ticket dt{color:#55536B}
"""
def run():
    css=S+'assets/css/style.css'; c=open(css,encoding='utf-8').read()
    if 'TEMA CAMPANIE' not in c: open(css,'a',encoding='utf-8').write(CSS)
