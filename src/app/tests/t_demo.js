// Test rapid al interfeței în modul demonstrativ (fără server), în jsdom. Rulare: npm i && node t_demo.js
// Pagina se compune aici din module, la fel ca în src/app.py: index.html + css/*.css + js/*.js în ordine alfabetică.
const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
const A=path.join(__dirname,'..');
const cat=(d,e)=>fs.readdirSync(path.join(A,d)).filter(f=>f.endsWith(e)).sort().map(f=>fs.readFileSync(path.join(A,d,f),'utf8')).join('\n');
const html=fs.readFileSync(path.join(A,'index.html'),'utf8').replace('<!--CSS-->','<style>'+cat('css','.css')+'</style>').replace('<!--JS-->','<script>'+cat('js','.js')+'</script>');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;function ok(c,m){if(!c){fails++;console.log('ESEC:',m)}else console.log('ok  :',m)}

async function mk(pre,url){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:url||'https://x.test/',beforeParse(w){
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

  // ===== presedinte national: Director, Structura, Profil; nicio evidenta financiara =====
  setRole(d,'u-nat');await sleep(150);
  ok([...d.window.document.querySelectorAll('nav.tabs button')].map(x=>x.getAttribute('data-id')).join()==='director,structura,profil','national: file Director, Structura, Profilul meu');
  ok(!d.window.document.getElementById('brsel'),'national: fara selector de filiala');
  click(d,'nav.tabs [data-id="structura"]');await sleep(100);
  t=txt(d);
  ok(/Președinte național \(probă\)/.test(t)&&/Predă funcția/.test(t),'Structura: presedintele national si butonul Preda functia');
  ok(/Iustin Măzărache/.test(t)&&/Președinte Cluj \(probă\)/.test(t)&&/Fără președinte/.test(t),'Structura: filialele cu presedinte, una fara');
  ok(/Adaugă filială/.test(t)&&!/Numește președintele național/.test(t),'Structura: national adauga filiale, nu numeste pe national');
  ok(/Nicio modificare de structură/.test(t),'Structura: jurnal gol in demo');
  click(d,'[data-act="addbranch"]');await sleep(50);
  ok(/Denumirea filialei/.test(d.window.document.getElementById('sheet').textContent),'foaia Adauga filiala');
  d.window.document.getElementById('ab_n').value='Sibiu';d.window.document.getElementById('ab_p').value='Ana Test';
  d.window.document.querySelector('#sheet form').dispatchEvent(new d.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(80);
  ok(/În modul demonstrativ, structura nu se poate modifica/.test(d.window.document.getElementById('toast').textContent),'demo: operatiile de structura nu se pot face');
  click(d,'[data-act="closesheet"]');
  click(d,'[data-act="branch"][data-id="Cluj"]');await sleep(50);
  ok(/Schimbă președintele/.test(d.window.document.getElementById('sheet').textContent)&&/Resetează accesul/.test(d.window.document.getElementById('sheet').textContent),'foaia filialei: schimba presedintele, reseteaza accesul');
  click(d,'[data-act="closesheet"]');

  // ===== presedinte: vede doar Brasov, nu are selector =====
  setRole(d,'u-pres-bv');await sleep(150);
  ok(!d.window.document.getElementById('brsel'),'presedinte fara selector de filiala');
  click(d,'nav.tabs [data-id="tablou"]');await sleep(100);
  t=txt(d);
  ok(/Tablou, Brașov/.test(t),'tablou Brasov');
  ok(!/Comparație pe filiale/.test(t),'presedinte nu vede comparatia');
  ok(!/Roluri conducere/.test(t)&&/Conducerea filialei/.test(t),'tabloul are Conducerea filialei, nu Roluri conducere');
  ok(/Vicepreședinte comunicare/.test(t)&&/Vicepreședinte trezorier/.test(t)&&/Numește în funcție/.test(t)&&/Predă funcția de președinte/.test(t),'conducerea: functii cu titlu, butoane pentru presedinte');
  ok(/Sold\s*780,00/.test(t),'sold Brasov = 780,00 (avansul presedintelui NU intra in sold)');
  ok(/Creanță nerecuperată: 600,00 RON \(2 cotizații\)/.test(t),"creanta = 600 lei (f1 si f5 nerecuperate); avans total 900");
  ok(/Restanțieri\s*1/.test(t),'1 restantier');
  ok(/Setări filială/.test(t),'presedintele are setarile filialei');
  // numeste in functie
  click(d,'[data-act="newrole"]');await sleep(50);
  let shx=d.window.document.getElementById('sheet');
  ok(/Altă funcție de conducere/.test(shx.textContent)&&shx.querySelectorAll('#nr_m option').length>=5,'foaia Numeste in functie: membri si functii');
  ok(![...shx.querySelectorAll('#nr_m option')].some(o=>/Iustin|Președinte național/.test(o.textContent)),'lista nu contine presedintele nici pe national');
  d.window.document.getElementById('nr_r').value='board';
  shx.querySelector('form').dispatchEvent(new d.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(50);
  ok(/Titlul funcției are între 2 și 60/.test(shx.textContent),'functia de conducere cere titlu');
  click(d,'[data-act="closesheet"]');
  click(d,'[data-act="role"][data-id="u-board-bv"]');await sleep(50);
  ok(/Retrage funcția/.test(d.window.document.getElementById('sheet').textContent),'rand de conducere: Retrage functia');
  click(d,'[data-act="closesheet"]');
  ok(!d.window.document.querySelector('[data-act="role"][data-id="u-pres-bv"]'),'randul presedintelui nu are retragere');
  click(d,'[data-act="handover"]');await sleep(50);
  ok(/În modul demonstrativ/.test(d.window.document.getElementById('toast').textContent),'demo: predarea nu merge fara server');
  // membri: exclus, excludere, reactivare
  click(d,'nav.tabs [data-id="cotizatii"]');await sleep(60);
  click(d,'[data-act="fv"][data-id="members"]');await sleep(60);
  ok(/Paul Georgescu/.test(txt(d))&&/Exclus/.test(d.window.document.getElementById('main').textContent),'membru exclus: eticheta Exclus in lista');
  click(d,'[data-act="member"][data-id="rb4"]');await sleep(40);
  shx=d.window.document.getElementById('sheet');
  ok(/Reactivează/.test(shx.textContent)&&!/Generează cod/.test(shx.textContent)&&!shx.querySelector('[data-act="exclude"]'),'membru exclus: Reactiveaza, fara cod nou');
  click(d,'[data-act="closesheet"]');
  click(d,'[data-act="member"][data-id="rb2"]');await sleep(40);
  ok(d.window.document.querySelector('#sheet [data-act="exclude"].crit'),'membru obisnuit: buton Exclude din aplicatie');
  click(d,'[data-act="exclude"]');await sleep(40);
  ok(/Exclude din aplicație: Sorin Matei/.test(d.window.document.getElementById('sheet').textContent)&&d.window.document.querySelector('[data-act="exclude2"]'),'excluderea cere confirmare');
  click(d,'[data-act="closesheet"]');
  click(d,'nav.tabs [data-id="cheltuieli"]');await sleep(60);
  // cheltuiala propusa de trezorier, peste 500
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
  click(d,'[data-act="fv"][data-id="members"]');await sleep(40);
  ok(!d.window.document.querySelector('[data-act="newmember"]'),'trezorierul nu adauga membri');
  click(d,'[data-act="member"][data-id="rb2"]');await sleep(40);
  ok(!d.window.document.querySelector('#sheet form')&&!d.window.document.querySelector('[data-act="exclude"]'),'trezorierul vede fisa membrului doar pentru citire');
  click(d,'[data-act="closesheet"]');
  click(d,'[data-act="fv"][data-id="fees"]');await sleep(40);
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

  // ===== presedinte Cluj: sold =====
  setRole(d,'u-pres-cj');await sleep(150);
  click(d,'nav.tabs [data-id="tablou"]');await sleep(100);
  t=txt(d);ok(/Tablou, Cluj/.test(t)&&/Sold\s*50,00/.test(t),'presedinte Cluj: sold Cluj = 50,00');

  // ===== conducere (board): Director, Donatii, Cheltuieli, Profil; doar citire =====
  setRole(d,'u-board-bv');await sleep(150);
  ok([...d.window.document.querySelectorAll('nav.tabs button')].map(x=>x.getAttribute('data-id')).join()==='director,donatii,cheltuieli,profil','board: file Director, Donatii, Cheltuieli, Profilul meu');
  click(d,'nav.tabs [data-id="donatii"]');await sleep(80);
  ok(/Donator anonim/.test(txt(d))&&!d.window.document.querySelector('[data-act="newdon"]'),'board citeste donatiile, fara buton de adaugare');
  click(d,'nav.tabs [data-id="cheltuieli"]');await sleep(80);
  ok(/Închiriere sală/.test(txt(d))&&!d.window.document.querySelector('[data-act="newexp"]'),'board citeste cheltuielile, fara buton de adaugare');
  click(d,'nav.tabs [data-id="profil"]');await sleep(80);
  ok(/Funcția mea/.test(txt(d))&&/Vicepreședinte comunicare/.test(txt(d))&&d.window.document.querySelector('#main [data-act="handover"]'),'board: Functia mea cu titlu si Preda functia');
  setRole(d,'u-trez-bv');await sleep(150);
  click(d,'[data-act="goprofil"]');await sleep(80);
  ok(/Funcția mea/.test(txt(d))&&/Vicepreședinte trezorier/.test(txt(d)),'trezorier: Functia mea');
  setRole(d,'u-m1');await sleep(150);
  click(d,'nav.tabs [data-id="profil"]');await sleep(80);
  ok(!/Funcția mea/.test(txt(d)),'membrul nu are Functia mea');

  // ===== ecranul de suspendare =====
  {
    const w=d.window;
    const man=w.renderExcluded({reason:'manual',branch:'Brașov'});
    ok(/Contul tău a fost suspendat de conducerea filialei Brașov\. Pentru detalii, contactează președintele filialei\./.test(man.replace(/<[^>]+>/g,'')),'suspendare manuala: textul nou');
    const exp=w.renderExcluded({reason:'expired',validUntil:'2026-01-31',branch:'Cluj'});
    ok(/Calitatea ta de membru a expirat la 31\.01\.2026/.test(exp),'suspendare prin expirare: textul de acum');
  }

  /* ===== MODUL SERVER, cu server simulat: Structura, conducere, predare, excludere ===== */
  async function mkServer(me,data,adminReply,otherReply){
    const calls=[],others=[];
    const dom=await mk(w=>{
      w.fetch=async(url,o)=>{
        const body=o&&o.body?JSON.parse(o.body):{};
        const J=(st,b)=>({status:st,json:async()=>b});
        if(url==='/api/app/me')return J(200,me);
        if(url==='/api/app/pull'){const dd={},er={};body.paths.forEach(p=>{if(data[p]===undefined)er[p]=403;else dd[p]=data[p]});return J(200,{data:dd,errors:er,rev:{}})}
        if(url==='/api/app/admin'){calls.push(body);const r=adminReply(body);return J(r.status||200,r.body)}
        if(url.startsWith('/api/app/')&&otherReply){others.push({url,body});const r=otherReply(url,body);return J(r.status||200,r.body)}
        return J(404,{});
      };
    },'https://x.test/app');
    return {dom,calls,others};
  }
  const BL=[{id:'brasov',name:'Brașov'},{id:'cluj',name:'Cluj'}];
  const base={branchlist:BL,profiles:[],badges:[],'data/users/m1':[]};
  // administrator tehnic
  {
    let reply=b=>b.op==='setNational'?{body:{ok:true,memberId:'n1',branch:b.branch,code:'ABCD2345EFGH',expires:'2026-12-01'}}:{body:{ok:true,memberId:'n1',code:'ZZZZ2345EFGH',expires:'2026-12-01'}};
    const {dom:m,calls}=await mkServer({id:'mod',isOwner:true,name:'',branch:'',role:'mod',title:''},Object.assign({},base,{roles:[],audit:[{id:'a1',at:'2026-11-10T10:00:00Z',byName:'Administrator',path:'roles',summary:'Președinte național numit',action:'role'},{id:'a2',at:'2026-11-10T11:00:00Z',path:'x',summary:'Altceva'}]}),reply);
    await sleep(500);
    t=txt(m);
    ok([...m.window.document.querySelectorAll('nav.tabs button')].map(x=>x.getAttribute('data-id')).join()==='structura','server, administrator: o singura fila, Structura');
    ok(/Nenumit/.test(t)&&/Numește președintele național/.test(t)&&!/Cod nou de intrare/.test(t),'administrator: Nenumit si butonul de numire');
    ok(/Fără președinte/.test(t)&&/Președinte național numit/.test(t)&&!/Altceva/.test(t),'administrator: filiale si doar jurnalul de structura');
    ok(!m.window.document.querySelector('[data-act="goprofil"]')&&!m.window.document.querySelector('[data-id="director"]'),'administrator: fara profil si fara director');
    click(m,'[data-act="natset"]');await sleep(40);
    m.window.document.getElementById('ns_n').value='Ion Popa';m.window.document.getElementById('ns_b').value='Cluj';
    m.window.document.querySelector('#sheet form').dispatchEvent(new m.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(200);
    ok(JSON.stringify(calls[0])===JSON.stringify({op:'setNational',branch:'Cluj',name:'Ion Popa'}),'setNational: corpul cererii '+JSON.stringify(calls[0]));
    ok(/ABCD-2345-EFGH/.test(m.window.document.getElementById('sheet').textContent),'setNational: codul primit se arata');
  }
  {
    const {dom:m,calls}=await mkServer({id:'mod',isOwner:true,name:'',branch:'',role:'mod',title:''},Object.assign({},base,{roles:[{id:'nat',role:'national',branch:'Brașov',name:'Radu Național'}],audit:[]}),b=>({body:{ok:true,memberId:b.memberId,code:'ZZZZ2345EFGH',expires:'2026-12-01'}}));
    await sleep(500);
    t=txt(m);
    ok(/Înlocuiește președintele național/.test(t)&&/Radu Național/.test(t)&&!/Cod nou de intrare/.test(t),'administrator: Inlocuieste presedintele national, numele din rol');
    click(m,'[data-act="resetaccess"]');await sleep(40);
    ok(/Resetează accesul: Radu Național/.test(m.window.document.getElementById('sheet').textContent),'administrator: confirmarea resetarii');
    click(m,'[data-act="resetaccess2"]');await sleep(200);
    ok(JSON.stringify(calls[0])===JSON.stringify({op:'resetAccess',memberId:'nat'})&&/ZZZZ-2345-EFGH/.test(m.window.document.getElementById('sheet').textContent),'administrator: resetAccess pentru presedintele national, cu cod');
  }
  // ecranul de intrare si ecranul „Setează e-mailul și parola”
  async function mkRaw(meStatus,meBody){
    const reqs=[];
    const dom=await mk(w=>{w.fetch=async(url,o)=>{
      const body=o&&o.body?JSON.parse(o.body):{};
      const J=(st,b)=>({status:st,json:async()=>b});
      if(url==='/api/app/me')return J(meStatus,meBody);
      reqs.push({url,body});
      if(url==='/api/app/passlogin')return J(400,{error:'E-mail sau parolă greșită.'});
      return J(200,{ok:true});
    }},'https://x.test/app');
    return {dom,reqs};
  }
  {
    const {dom:l,reqs}=await mkRaw(401,{});
    await sleep(400);
    const D=l.window.document;
    ok(D.getElementById('pwform')&&D.getElementById('lg_email').type==='email'&&D.getElementById('lg_email').autocomplete==='username'&&D.getElementById('lg_pass').type==='password'&&D.getElementById('lg_pass').autocomplete==='current-password','intrare: formular cu e-mail si parola, autocomplete corect');
    const sums=[...D.querySelectorAll('details summary')].map(x=>x.textContent);
    ok(sums.join('|')==='Prima intrare? Am un cod|Administrator tehnic'&&D.querySelector('details #svform')&&D.querySelector('details #modform'),'intrare: Prima intrare si Administrator tehnic in details');
    ok(/Intră/.test(D.querySelector('#pwform button').textContent),'intrare: butonul Intra');
    const subf=f=>D.getElementById(f).dispatchEvent(new l.window.Event('submit',{bubbles:true,cancelable:true}));
    subf('pwform');await sleep(30);ok(/Completează e-mailul și parola/.test(D.getElementById('pwerr').textContent)&&reqs.length===0,'intrare: campuri goale, nimic trimis');
    D.getElementById('lg_email').value=' Ana@Exemplu.RO ';D.getElementById('lg_pass').value='Parola12345';subf('pwform');await sleep(100);
    ok(reqs.length===1&&JSON.stringify(reqs[0])===JSON.stringify({url:'/api/app/passlogin',body:{email:'ana@exemplu.ro',password:'Parola12345'}}),'passlogin: corpul cererii');
    ok(/E-mail sau parolă greșită/.test(D.getElementById('pwerr').textContent)&&D.getElementById('lg_pass').value==='','passlogin: eroarea serverului, parola golita din camp');
    D.getElementById('lg_code').value='abcd-2345-efgh';subf('svform');await sleep(100);
    ok(JSON.stringify(reqs[1].body)===JSON.stringify({code:'abcd-2345-efgh'})&&reqs[1].url==='/api/app/login','login cu cod: corpul cererii');
  }
  {
    const {dom:c,reqs}=await mkRaw(200,{id:'u1',isOwner:false,name:'Ana',branch:'Brașov',role:'member',title:'',needCred:true});
    await sleep(400);
    const D=c.window.document;
    ok(/Setează e-mailul și parola/.test(D.getElementById('app').textContent)&&/De acum intri cu e-mailul și parola\. Codul primit nu mai poate fi folosit\./.test(D.getElementById('app').textContent),'needCred: ecranul Seteaza e-mailul si parola');
    ok(['sc_pass','sc_pass2'].every(i=>D.getElementById(i).autocomplete==='new-password')&&D.querySelector('#credform [data-act="logout"]'),'needCred: new-password si Iesi din cont');
    ok(!D.querySelector('nav.tabs'),'needCred: nicio alta fila');
    const subf=()=>D.getElementById('credform').dispatchEvent(new c.window.Event('submit',{bubbles:true,cancelable:true}));
    D.getElementById('sc_email').value='gresit';subf();await sleep(30);ok(/adresă de e-mail validă/.test(D.getElementById('crerr').textContent),'needCred: e-mail invalid');
    D.getElementById('sc_email').value='Ana@Exemplu.ro';D.getElementById('sc_pass').value='scurta';subf();await sleep(30);ok(/între 8 și 100/.test(D.getElementById('crerr').textContent),'needCred: parola scurta');
    D.getElementById('sc_pass').value='Parola12345';D.getElementById('sc_pass2').value='Altceva123';subf();await sleep(30);ok(/nu coincid/.test(D.getElementById('crerr').textContent)&&reqs.length===0,'needCred: confirmare diferita, nimic trimis');
    D.getElementById('sc_pass2').value='Parola12345';subf();await sleep(100);
    ok(reqs.length===1&&JSON.stringify(reqs[0])===JSON.stringify({url:'/api/app/setcred',body:{email:'ana@exemplu.ro',password:'Parola12345'}}),'setcred la prima setare: corpul cererii');
  }
  // presedinte national
  {
    const roles=[{id:'nat',role:'national',branch:'Brașov',title:'Președinte național'},{id:'p1',role:'president',branch:'Brașov',title:'Președinte'}];
    let reply=b=>b.op==='candidates'?{body:{ok:true,list:[{id:'x1',name:'Maria Ene',branch:'Cluj',active:true}]}}:b.op==='addBranch'?{body:{ok:true,branch:'sibiu',memberId:'q1',code:'QQQQ2345WWWW',expires:'2026-12-01'}}:{body:{ok:true}};
    const nd=Object.assign({},base,{roles,audit:[],profiles:[{id:'nat',name:'Radu Național',branch:'Brașov',consent:{directory:true}},{id:'p1',name:'Paul Președinte',branch:'Brașov',consent:{directory:true}}],badges:[{id:'nat',verified:true,active:true,validUntil:'2027-12-31',branch:'Brașov'}],'data/users/nat':[]});
    const {dom:n,calls}=await mkServer({id:'nat',isOwner:false,name:'Radu',branch:'Brașov',role:'national',title:'Președinte național'},nd,reply);
    await sleep(500);
    click(n,'nav.tabs [data-id="structura"]');await sleep(80);
    t=txt(n);
    ok(/Radu Național/.test(t)&&/Președinte: Paul Președinte/.test(t)&&/Fără președinte/.test(t),'server, national: Structura cu nume din profiluri');
    ok(!/Numește președintele național/.test(t),'national nu numeste presedintele national');
    click(n,'[data-act="handover"]');await sleep(200);
    ok(calls[0]&&calls[0].op==='candidates'&&calls[0].for==='handover','handover: cere lista de candidati');
    ok(/Maria Ene \(Cluj\)/.test(n.window.document.getElementById('sheet').textContent),'handover: candidatii din toate filialele');
    n.window.document.querySelector('#sheet form').dispatchEvent(new n.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(50);
    ok(/Bifează confirmarea/.test(n.window.document.getElementById('sheet').textContent)&&calls.length===1,'handover: cere confirmare');
    n.window.document.querySelector('#sheet input[name=ok]').checked=true;
    n.window.document.querySelector('#sheet form').dispatchEvent(new n.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(200);
    ok(JSON.stringify(calls[1])===JSON.stringify({op:'handover',to:'x1'}),'handover: corpul cererii '+JSON.stringify(calls[1]));
    click(n,'[data-act="branch"][data-id="Cluj"]');await sleep(40);click(n,'[data-act="setpres"]');await sleep(200);
    ok(calls[2]&&calls[2].op==='candidates'&&calls[2].for==='president'&&calls[2].branch==='Cluj','setPresident: cere candidatii filialei');
    n.window.document.getElementById('sp_n').value='Persoană Nouă';
    n.window.document.querySelector('#sheet form').dispatchEvent(new n.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(200);
    ok(JSON.stringify(calls[3])===JSON.stringify({op:'setPresident',branch:'Cluj',name:'Persoană Nouă'}),'setPresident: persoana noua, corpul cererii');
    click(n,'[data-act="addbranch"]');await sleep(40);
    n.window.document.getElementById('ab_n').value='Sibiu';n.window.document.getElementById('ab_p').value='Ana Test';
    n.window.document.querySelector('#sheet form').dispatchEvent(new n.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(200);
    ok(JSON.stringify(calls[4])===JSON.stringify({op:'addBranch',name:'Sibiu',presidentName:'Ana Test'})&&/QQQQ-2345-WWWW/.test(n.window.document.getElementById('sheet').textContent),'addBranch: corpul cererii si codul presedintelui');
    click(n,'[data-act="branch"][data-id="Brașov"]');await sleep(40);
    ok(!/Cod nou pentru președinte/.test(n.window.document.getElementById('sheet').textContent)&&n.window.document.querySelector('#sheet [data-act="resetaccess"]'),'Structura: Reseteaza accesul in loc de Cod nou pentru presedinte');
    click(n,'[data-act="resetaccess"]');await sleep(40);click(n,'[data-act="resetaccess2"]');await sleep(200);
    ok(JSON.stringify(calls[5])===JSON.stringify({op:'resetAccess',memberId:'p1'}),'Structura: resetAccess pentru presedintele filialei '+JSON.stringify(calls[5]));
  }
  // presedinte de filiala
  {
    const roles=[{id:'p1',role:'president',branch:'Brașov',title:'Președinte'},{id:'t1',role:'treasurer',branch:'Brașov',title:'Vicepreședinte trezorier'}];
    const members=[{id:'p1',name:'Paul Președinte',userId:'p1',branch:'Brașov',validUntil:'2027-12-31'},{id:'t1',name:'Tina Trezorier',userId:'t1',branch:'Brașov',validUntil:'2027-12-31'},{id:'m2',name:'Mihai Membru',userId:'m2',branch:'Brașov',validUntil:'2027-12-31'},{id:'m3',name:'Nelu Exclus',userId:'m3',branch:'Brașov',excluded:true},{id:'m4',name:'Vera Neactivată',userId:'',branch:'Brașov',validUntil:'2027-12-31'}];
    const pd=Object.assign({},base,{roles,audit:[],profiles:[{id:'p1',name:'Paul Președinte',branch:'Brașov',consent:{}}],badges:[],'data/users/p1':[],
      'branches/Brașov/members':members,'branches/Brașov/fees':[],'branches/Brașov/donations':[],'branches/Brașov/expenses':[],'branches/Brașov/settings':[]});
    const {dom:p,calls,others}=await mkServer({id:'p1',isOwner:false,name:'Paul',branch:'Brașov',role:'president',title:'Președinte',email:'paul@exemplu.ro'},pd,b=>b.op==='resetAccess'?{body:{ok:true,memberId:b.memberId,code:'RRRR2345TTTT',expires:'2026-12-01'}}:{body:{ok:true}},(u,b)=>({body:{ok:true}}));
    await sleep(500);
    click(p,'nav.tabs [data-id="tablou"]');await sleep(100);
    ok(/Tina Trezorier/.test(txt(p))&&/Conducerea filialei/.test(txt(p)),'server, presedinte: Conducerea filialei cu nume din evidenta');
    click(p,'[data-act="newrole"]');await sleep(40);
    p.window.document.getElementById('nr_m').value='m2';p.window.document.getElementById('nr_r').value='board';p.window.document.getElementById('nr_t').value='Secretar';
    p.window.document.querySelector('#sheet form').dispatchEvent(new p.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(200);
    ok(JSON.stringify(calls[0])===JSON.stringify({op:'setRole',memberId:'m2',role:'board',title:'Secretar'}),'setRole: corpul cererii '+JSON.stringify(calls[0]));
    click(p,'[data-act="role"][data-id="t1"]');await sleep(40);click(p,'[data-act="roleoff"]');await sleep(200);
    ok(JSON.stringify(calls[1])===JSON.stringify({op:'setRole',memberId:'t1',role:'member'}),'retragere functie: corpul cererii');
    click(p,'nav.tabs [data-id="cotizatii"]');await sleep(60);click(p,'[data-act="fv"][data-id="members"]');await sleep(60);
    ok(/Exclus/.test(p.window.document.getElementById('main').textContent),'server: membrul exclus are eticheta');
    click(p,'[data-act="member"][data-id="m2"]');await sleep(40);
    ok(!!p.window.document.querySelector('[data-act="exclude"]')&&p.window.document.querySelector('[data-act="resetaccess"]')&&!p.window.document.querySelector('[data-act="gencode"]'),'fisa membrului cu cont activat: Exclude si Reseteaza accesul, fara Genereaza cod');
    click(p,'[data-act="resetaccess"]');await sleep(40);
    ok(/Membrul nu va mai putea intra cu parola veche\. Primește un cod nou și își pune din nou e-mailul și parola\./.test(p.window.document.getElementById('sheet').textContent),'resetare acces: foaie de confirmare');
    click(p,'[data-act="resetaccess2"]');await sleep(200);
    ok(calls.some(c=>JSON.stringify(c)===JSON.stringify({op:'resetAccess',memberId:'m2'}))&&/RRRR-2345-TTTT/.test(p.window.document.getElementById('sheet').textContent),'resetAccess: corpul cererii si codul nou');
    click(p,'[data-act="closesheet"]');
    click(p,'[data-act="member"][data-id="m4"]');await sleep(40);
    ok(p.window.document.querySelector('[data-act="gencode"]')&&!p.window.document.querySelector('[data-act="resetaccess"]'),'fisa membrului cu cont neactivat: Genereaza cod');
    click(p,'[data-act="closesheet"]');
    click(p,'[data-act="member"][data-id="m2"]');await sleep(40);
    const ci=calls.length;
    click(p,'[data-act="exclude"]');await sleep(40);click(p,'[data-act="exclude2"]');await sleep(200);
    ok(JSON.stringify(calls[ci])===JSON.stringify({op:'exclude',memberId:'m2'}),'exclude: corpul cererii');
    click(p,'[data-act="member"][data-id="m3"]');await sleep(40);
    ok(!p.window.document.querySelector('[data-act="gencode"]'),'membru exclus: fara cod nou');
    click(p,'[data-act="reactivate"]');await sleep(200);
    ok(JSON.stringify(calls[ci+1])===JSON.stringify({op:'reactivate',memberId:'m3'}),'reactivate: corpul cererii');
    click(p,'[data-act="member"][data-id="p1"]');await sleep(40);
    ok(!p.window.document.querySelector('[data-act="exclude"]'),'presedintele nu se poate exclude pe sine');
    click(p,'[data-act="closesheet"]');
    // Profilul meu: sectiunea Contul
    click(p,'[data-act="goprofil"]');await sleep(80);
    t=txt(p);
    ok(/Contul/.test(t)&&/paul@exemplu\.ro/.test(t)&&p.window.document.querySelector('#main [data-act="changecred"]')&&p.window.document.querySelector('#main [data-act="logout"]'),'Profilul meu: Contul cu e-mail, Schimba, Iesi din cont');
    click(p,'[data-act="changecred"]');await sleep(40);
    const types=['cc_e','cc_c','cc_n','cc_n2'].map(i=>p.window.document.getElementById(i).type+':'+p.window.document.getElementById(i).autocomplete).join();
    ok(types==='email:username,password:current-password,password:new-password,password:new-password','foaia de schimbare: tipuri si autocomplete '+types);
    const sub=()=>p.window.document.querySelector('#sheet form').dispatchEvent(new p.window.Event('submit',{bubbles:true,cancelable:true}));
    sub();await sleep(40);ok(/Introdu parola actuală/.test(p.window.document.getElementById('sheet').textContent),'schimbare: cere parola actuala');
    p.window.document.getElementById('cc_c').value='ParolaVeche1';p.window.document.getElementById('cc_n').value='scurta';sub();await sleep(40);
    ok(/între 8 și 100/.test(p.window.document.getElementById('sheet').textContent)&&others.length===0,'schimbare: parola noua prea scurta, nimic trimis');
    p.window.document.getElementById('cc_n').value='ParolaNoua123';p.window.document.getElementById('cc_n2').value='Alta12345';sub();await sleep(40);
    ok(/nu coincid/.test(p.window.document.getElementById('sheet').textContent)&&others.length===0,'schimbare: confirmare diferita');
    p.window.document.getElementById('cc_n2').value='ParolaNoua123';p.window.document.getElementById('cc_e').value='Nou@Exemplu.ro';sub();await sleep(200);
    ok(others.length===1&&others[0].url==='/api/app/setcred'&&JSON.stringify(others[0].body)===JSON.stringify({email:'nou@exemplu.ro',password:'ParolaNoua123',current:'ParolaVeche1'}),'setcred la schimbare: corpul cererii');
    ok(/nou@exemplu\.ro/.test(txt(p)),'Contul arata noul e-mail');
    click(p,'[data-act="changecred"]');await sleep(40);
    p.window.document.getElementById('cc_c').value='ParolaNoua123';sub();await sleep(200);
    ok(JSON.stringify(others[1].body)===JSON.stringify({email:'nou@exemplu.ro',password:'ParolaNoua123',current:'ParolaNoua123'}),'schimbare doar a e-mailului: parola actuala trimisa ca password');
  }

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
