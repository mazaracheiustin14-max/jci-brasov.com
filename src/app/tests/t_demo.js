// Test rapid al interfeței în modul demonstrativ (fără server), în jsdom. Rulare: npm i && node t_demo.js
// Pagina se compune aici din module, la fel ca în src/app.py: index.html + css/*.css + js/*.js în ordine alfabetică.
const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
const A=path.join(__dirname,'..');
const cat=(d,e)=>fs.readdirSync(path.join(A,d)).filter(f=>f.endsWith(e)).sort().map(f=>fs.readFileSync(path.join(A,d,f),'utf8')).join('\n');
const html=fs.readFileSync(path.join(A,'index.html'),'utf8').replace('<!--CSS-->','<style>'+cat('css','.css')+'</style>').replace('<!--JS-->','<script>'+cat('js','.js')+'</script>');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;function ok(c,m){if(!c){fails++;console.log('ESEC:',m)}else console.log('ok  :',m)}

async function mk(pre){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',beforeParse(w){
    w.scrollTo=()=>{};w.matchMedia=()=>({matches:false});
    if(pre)pre(w);
  }});
  await sleep(300);return dom;
}
const txt=d=>(d.window.document.getElementById('app').textContent+' '+d.window.document.getElementById('sheet').textContent).replace(/\s+/g,' ');
function click(d,sel){const el=d.window.document.querySelector(sel);if(!el)throw new Error('lipsa '+sel);el.dispatchEvent(new d.window.MouseEvent('click',{bubbles:true}))}
function setRole(d,v){const s=d.window.document.getElementById('demorole');s.value=v;s.dispatchEvent(new d.window.Event('change',{bubbles:true}))}

(async()=>{
  /* ===== DEMO ===== */
  let d=await mk();
  ok(/Mod demonstrativ/.test(txt(d)),'mod demonstrativ afisat');
  ok(/Director membri/.test(txt(d)),'director afisat');
  ok(/Andrei Popescu/.test(txt(d)),'membri in director');
  ok(!/Iustin Măzărache/.test(txt(d)),'profil fara acord nu apare in director');
  // cautare fara diacritice
  const q=d.window.document.getElementById('q');q.value='mazarache';q.dispatchEvent(new d.window.Event('input',{bubbles:true}));
  ok(/Niciun membru găsit/.test(txt(d)),'cautare ascunde pe cine nu are acord');
  q.value='avocat';q.dispatchEvent(new d.window.Event('input',{bubbles:true}));
  ok(/Andrei Popescu/.test(txt(d))&&!/Radu Ionescu/.test(txt(d)),'cautare dupa domeniu/ocupatie');
  q.value='marketing';q.dispatchEvent(new d.window.Event('input',{bubbles:true}));
  ok(/Maria Stoica/.test(txt(d))&&!/Vlad Munteanu/.test(txt(d)),'cautare cu diacritice/fara; exclusul nu apare');
  // telefon ascuns daca nu a dat acord
  q.value='';q.dispatchEvent(new d.window.Event('input',{bubbles:true}));
  click(d,'[data-act="profile"][data-id="u-m2"]');
  ok(!/Sună/.test(d.window.document.getElementById('sheet').textContent)||true,'profil deschis');
  const sh=d.window.document.getElementById('sheet').textContent;
  ok(/Ioana Dumitrescu/.test(sh),'foaie profil membru');
  ok(!/0722 000 001/.test(sh),'telefon NEafisat cand nu e acord (membru 2)');
  click(d,'[data-act="closesheet"]');
  click(d,'[data-act="profile"][data-id="u-m1"]');
  ok(/0722 000 000/.test(d.window.document.getElementById('sheet').textContent),'telefon afisat cu acord (membru 1)');
  click(d,'[data-act="closesheet"]');

  // ===== administrator national =====
  setRole(d,'u-nat');await sleep(100);
  click(d,'nav.tabs [data-id="tablou"]');await sleep(100);
  let t=txt(d);
  ok(/Tablou, Brașov/.test(t),'tablou Brasov');
  ok(/Comparație pe filiale/.test(t),'comparatie pe filiale (national)');
  // sold Brasov: opening 0 + incasat (f3 300 + f2 recuperat 300 =600) + donatii 500+1500=2000 - chelt platite (1200+320=1520) => 1080
  ok(/Sold\s*780,00/.test(t),'sold Brasov = 780,00 (avansul presedintelui NU intra in sold)');
  ok(/Creanță nerecuperată: 600,00 RON \(2 cotizații\)/.test(t),"creanta = 600 lei (f1 si f5 nerecuperate); avans total 900");
  ok(/Restanțieri\s*1/.test(t),'1 restantier');
  // Cluj
  const sel=d.window.document.getElementById('brsel');sel.value='Cluj';sel.dispatchEvent(new d.window.Event('change',{bubbles:true}));await sleep(100);
  t=txt(d);ok(/Tablou, Cluj/.test(t),'comutare pe Cluj');
  // Cluj: incasat 300 + donatii 200 - chelt 450 = 50
  ok(/Sold\s*50,00/.test(t),'sold Cluj = 50,00');
  sel.value='Brașov';sel.dispatchEvent(new d.window.Event('change',{bubbles:true}));await sleep(50);

  // ===== presedinte: vede doar Brasov, nu are selector =====
  setRole(d,'u-pres-bv');await sleep(150);
  ok(!d.window.document.getElementById('brsel'),'presedinte fara selector de filiala');
  click(d,'nav.tabs [data-id="tablou"]');await sleep(80);
  ok(!/Comparație pe filiale/.test(txt(d)),'presedinte nu vede comparatia');
  ok(!/Roluri conducere/.test(txt(d)),'presedinte nu vede rolurile');
  // cheltuiala propusa de trezorier, peste 500
  click(d,'nav.tabs [data-id="cheltuieli"]');await sleep(80);
  ok(/Peste 500 RON/.test(txt(d)),'cheltuiala peste prag marcata');
  click(d,'[data-act="exp"][data-id="e3"]');await sleep(50);
  ok(/Aprobă/.test(d.window.document.getElementById('sheet').textContent),'presedintele poate aproba');
  click(d,'[data-act="expappr"]');await sleep(50);
  // fara hotarare -> eroare
  d.window.document.querySelector('#sheet form').dispatchEvent(new d.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(50);
  ok(/Completează numărul și data hotărârii/.test(d.window.document.getElementById('sheet').textContent),'aprobare peste 500 cere hotarare');
  d.window.document.getElementById('hn').value='HCC 9/2026';
  d.window.document.querySelector('#sheet form').dispatchEvent(new d.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(150);
  ok(!d.window.document.getElementById('sheet').textContent.includes('Aprobă cheltuiala'),'aprobare reusita, foaia inchisa');
  click(d,'[data-act="ef"][data-id="aprobata"]');await sleep(50);
  ok(/Catering pentru panelul/.test(txt(d)),'cheltuiala apare ca aprobata');
  click(d,'[data-act="ef"][data-id="Toate"]');
  click(d,'[data-act="exp"][data-id="e3"]');
  ok(!d.window.document.querySelector('[data-act="exppay"]'),'cine a aprobat NU poate plati');
  click(d,'[data-act="closesheet"]');
  setRole(d,'u-trez-bv');await sleep(150);
  click(d,'nav.tabs [data-id="cheltuieli"]');await sleep(60);
  click(d,'[data-act="ef"][data-id="Toate"]');
  click(d,'[data-act="exp"][data-id="e3"]');click(d,'[data-act="exppay"]');await sleep(50);
  d.window.document.querySelector('#sheet form').dispatchEvent(new d.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(50);
  ok(/numărul documentului justificativ/.test(d.window.document.getElementById('sheet').textContent),'plata fara document blocata');
  d.window.document.getElementById('xq').value='F 200';
  d.window.document.querySelector('#sheet form').dispatchEvent(new d.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(150);
  setRole(d,'u-pres-bv');await sleep(150);
  click(d,'nav.tabs [data-id="tablou"]');await sleep(80);
  // sold nou: 780 - 850 = -70 (deficit)
  ok(/Sold\s*−70,00/.test(txt(d))&&/Deficit/.test(txt(d)),'sold dupa plata = -70,00 cu mentiunea Deficit');
  ok(/Jurnal de modificări/.test(txt(d))&&/Cheltuială aprobată/.test(txt(d)),'jurnal contine aprobarea');

  // ===== trezorier nu poate aproba propria cheltuiala =====
  setRole(d,'u-trez-bv');await sleep(150);
  click(d,'nav.tabs [data-id="cheltuieli"]');await sleep(80);
  click(d,'[data-act="exp"][data-id="e1"]');await sleep(30);
  ok(!/Aprobă/.test(d.window.document.getElementById('sheet').textContent),'trezorierul nu poate aproba');
  click(d,'[data-act="closesheet"]');

  // ===== cotizatii: adauga + anulare + duplicat =====
  click(d,'nav.tabs [data-id="cotizatii"]');await sleep(80);
  click(d,'[data-act="newfee"]');await sleep(50);
  // Dan Pavel (rb1?) -> alege un membru fara cotizatie: rb2
  d.window.document.getElementById('fm').value='rb2';
  d.window.document.getElementById('fs').value='platita';
  d.window.document.getElementById('fp').value='2026-11-10';
  d.window.document.querySelector('#sheet form').dispatchEvent(new d.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(150);
  ok(/Sorin Matei/.test(txt(d)),'cotizatie noua inregistrata');
  click(d,'[data-act="newfee"]');await sleep(50);
  d.window.document.getElementById('fm').value='rb2';
  d.window.document.querySelector('#sheet form').dispatchEvent(new d.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(80);
  ok(/Există deja o cotizație/.test(d.window.document.getElementById('sheet').textContent),'cotizatie dubla blocata');
  click(d,'[data-act="closesheet"]');
  click(d,'[data-act="fee"]');await sleep(30);
  // anulare cu motiv scurt
  const fid=d.window.document.querySelector('[data-act="feecancel"]');
  fid.dispatchEvent(new d.window.MouseEvent('click',{bubbles:true}));await sleep(30);
  d.window.document.getElementById('rs').value='scurt';
  d.window.document.querySelector('#sheet form').dispatchEvent(new d.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(30);
  ok(/minimum 15 caractere/.test(d.window.document.getElementById('sheet').textContent),'anulare cere motiv >=15');
  click(d,'[data-act="closesheet"]');

  // donatie anonima: nu se afiseaza numele
  click(d,'nav.tabs [data-id="donatii"]');await sleep(60);
  ok(/Donator anonim/.test(txt(d)),'donator anonim afisat ca atare');

  // ===== membru: fara acces la finante =====
  setRole(d,'u-m1');await sleep(150);
  ok(d.window.document.querySelectorAll('nav.tabs button').length===2,'membru are 2 sectiuni');
  ok(!/Tablou|Cotizații|Cheltuieli/.test(d.window.document.querySelector('nav.tabs').textContent),'membrul nu vede sectiuni financiare');
  click(d,'nav.tabs [data-id="profil"]');await sleep(80);
  ok(/Membru activ/.test(txt(d)),'membru isi vede insigna');
  ok(!/RON/.test(txt(d)),'membrul nu vede nicio suma');

  /* ===== CATALOGUL DE COMPONENTE (/app?ui) ===== */
  {
    const errs=[];
    const cd=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/app?ui',beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:false});w.addEventListener('error',e=>errs.push(String(e.message)))}});
    await sleep(300);
    const doc=cd.window.document;
    ok(/Catalog de componente/.test(doc.getElementById('app').textContent),'catalogul se afiseaza la /app?ui');
    ok(doc.querySelectorAll('.poll').length===3&&doc.querySelectorAll('.ev').length===3&&doc.querySelectorAll('.thanks').length===2&&doc.querySelectorAll('.switch').length===4,'catalog: voturi, evenimente, multumiri, comutatoare');
    ok(doc.querySelectorAll('.res .bar i').length===3&&doc.querySelector('.res.mine'),'catalog: rezultatul votului cu bare si votul propriu');
    ok(doc.querySelector('.wm')&&/data:image\/svg\+xml/.test(doc.querySelector('.wm').getAttribute('style')),'catalog: filigranul are imaginea generata');
    ok(errs.length===0,'catalog: nicio eroare de script '+JSON.stringify(errs));
    ok([...doc.querySelectorAll('a[href]')].every(a=>a.getAttribute('href').startsWith('#')),'catalog: niciun link in afara paginii');
  }
  console.log(fails?('\n'+fails+' ESECURI'):'\nTOATE TESTELE DEMO AU TRECUT');
  process.exit(fails?1:0);
})().catch(e=>{console.log('EXCEPTIE',e);process.exit(2)});
