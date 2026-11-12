import { makeD1 } from "./d1shim.mjs";
import { handleApp } from "../../../worker/app.js";
import { createHash, pbkdf2Sync } from "node:crypto";
let fails=0,n=0;const ok=(c,m)=>{n++;if(!c){fails++;console.log("ESEC:",m)}else console.log("ok  :",m)};
const env={DB:makeD1()};
env.DB._db.exec("CREATE TABLE setari (cheie TEXT PRIMARY KEY, valoare TEXT)");
env.DB._db.exec("CREATE TABLE rate_log (id INTEGER PRIMARY KEY AUTOINCREMENT, bucket TEXT, ip TEXT, creat TEXT DEFAULT CURRENT_TIMESTAMP)");
const salt="s4lt",KEY="Cheia-Moderator-12345";
const hash=createHash("sha256").update(salt+":"+KEY).digest("hex");
env.DB._db.prepare("INSERT INTO setari VALUES ('app_mod_salt',?),('app_mod_hash',?)").run(salt,hash);
const ORI="https://jci-brasov.com";
let calls=0;const overLimit=async()=>false;const LOG=[];const CRED={};
async function api(path,{method="POST",body,cookie,origin=ORI}={}){
  const headers={"Content-Type":"application/json"};if(origin)headers.Origin=origin;if(cookie)headers.Cookie=cookie;
  const req=new Request(ORI+path,{method,headers,body:body?JSON.stringify(body):undefined});
  const r=await handleApp(req,env,new URL(req.url),overLimit);
  const sc=r.headers.get("Set-Cookie");const j=await r.json();LOG.push(JSON.stringify(j));
  return{status:r.status,j,cookie:sc?sc.split(";")[0]:null,sc};
}
const T=new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Bucharest"});
const addM=(d,n)=>{const x=new Date(d+"T12:00:00Z");x.setUTCMonth(x.getUTCMonth()+n);return x.toISOString().slice(0,10)};
const Y=T.slice(0,4);
// --- moderator
let r2;let r=await api("/api/app/modlogin",{body:{key:"gresit-gresit-1"}});ok(r.status===400,"cheie moderator gresita respinsa");
r=await api("/api/app/modlogin",{body:{key:KEY}});ok(r.status===200&&r.cookie,"moderator intra");
ok(/HttpOnly/.test(r.sc)&&/Secure/.test(r.sc)&&/SameSite=Strict/.test(r.sc)&&/Path=\/api\/app/.test(r.sc),"cookie HttpOnly Secure Strict pe /api/app");
const MOD=r.cookie;
r=await api("/api/app/me",{method:"GET",cookie:MOD});ok(r.j.isOwner===true&&r.j.role==="mod","me: moderator are role mod");
r=await api("/api/app/me",{method:"GET"});ok(r.status===401,"fara cookie: 401");
r=await api("/api/app/write",{body:{path:"profiles",id:"x",data:{name:"x"}},origin:null});ok(r.status===403,"POST fara Origin respins");
r=await api("/api/app/write",{body:{path:"profiles",id:"x",data:{name:"x"}},origin:"https://evil.example",cookie:MOD});ok(r.status===403,"Origin strain respins");
// --- pregatirea datelor pe modelul nou
const W=(cookie,path,id,data,del)=>api("/api/app/write",{cookie,body:{path,id,data,del}});
const A=(cookie,body)=>api("/api/app/admin",{cookie,body});
const PULL=async(cookie,paths)=>(await api("/api/app/pull",{cookie,body:{paths}})).j;
// intrarea cu cod urmata imediat de e-mail si parola (parolele de test incep cu "Pw!")
const cred=async(ck)=>{const id=(await api("/api/app/me",{method:"GET",cookie:ck})).j.id;const c={email:id+"@exemplu.ro",password:"Pw!"+id+"-x9z1"};const x=await api("/api/app/setcred",{cookie:ck,body:c});if(x.status===200)CRED[id]=c;return x};
const login=async(code)=>{const ck=(await api("/api/app/login",{body:{code}})).cookie;if(!ck)return null;await cred(ck);return ck};
// 1. mod numeste presedintele national (in Brasov, ca sa poata fi tinta unor refuzuri)
r=await A(MOD,{op:"setNational",branch:"Brașov",name:"Nina Națională"});
ok(r.status===200&&r.j.ok&&r.j.branch==="Brașov"&&/^[A-Z2-9]{12}$/.test(r.j.code)&&r.j.expires&&r.j.memberId,"mod: setNational merge si intoarce cod");
const nat=r.j.memberId;let NAT=await login(r.j.code);ok(!!NAT,"presedintele national intra cu codul primit");
r=await api("/api/app/me",{method:"GET",cookie:NAT});ok(r.j.role==="national"&&r.j.title==="Președinte național"&&r.j.id===nat,"me: role si title pentru national");
// 2. national numeste presedinti de filiala
r=await A(NAT,{op:"setPresident",branch:"Brașov",name:"Ana Pres"});ok(r.status===200&&r.j.code&&r.j.branch==="Brașov","national: setPresident cu nume nou (Brasov)");
const ana=r.j.memberId;const codeAna=r.j.code;
r=await A(NAT,{op:"setPresident",branch:"Cluj",name:"Petru Cluj"});ok(r.status===200&&r.j.code,"national: setPresident (Cluj)");
const pcluj=r.j.memberId;const PCLUJ=await login(r.j.code);
r=await A(MOD,{op:"setPresident",branch:"Nicaieri",name:"X Y"});ok(r.status===400,"filiala invalida respinsa");
// membri adaugati de presedinti
r=await api("/api/app/login",{body:{code:"AAAAAAAAAAAA"}});ok(r.status===400,"cod gresit respins");
r=await api("/api/app/login",{body:{code:codeAna.slice(0,4)+"-"+codeAna.slice(4,8).toLowerCase()+" "+codeAna.slice(8)}});ok(r.status===200&&r.cookie&&r.j.needCred===true,"cod cu separatori si litere mici accepta, raspunsul cere e-mail si parola");
const ANA=r.cookie;
// E1b 1 si 2: dupa intrarea cu cod nu se poate face nimic pana la setcred
r=await api("/api/app/me",{method:"GET",cookie:ANA});ok(r.status===200&&r.j.needCred===true&&r.j.email==="","E1b 1 /me dupa intrarea cu cod: needCred true, fara e-mail");
for(const [nm,path,body] of [["pull","/api/app/pull",{paths:["roles"]}],["write","/api/app/write",{path:"profiles",id:ana,data:{name:"x"}}],["admin","/api/app/admin",{op:"candidates",for:"handover"}],["code","/api/app/code",{branch:"Brașov",memberId:"x"}],["cale necunoscuta","/api/app/nimic",{}]]){
  r=await api(path,{cookie:ANA,body});ok(r.status===403&&r.j.needCred===true,"E1b 1 "+nm+": 403 cu needCred pana la setcred");
}
r=await api("/api/app/setcred",{body:{email:"ana@exemplu.ro",password:"Pw!ana-x9z1"}});ok(r.status===401,"E1b 2 setcred cere sesiune");
r=await api("/api/app/setcred",{cookie:ANA,body:{email:"ana@exemplu.ro",password:"scurta"}});ok(r.status===400,"E1b 2 parola scurta: 400");
r=await api("/api/app/setcred",{cookie:ANA,body:{email:"ana@exemplu.ro",password:"x".repeat(101)}});ok(r.status===400,"E1b 2 parola prea lunga: 400");
for(const bad of ["ana-exemplu.ro","ana@exemplu","@exemplu.ro","a na@exemplu.ro",""]){r=await api("/api/app/setcred",{cookie:ANA,body:{email:bad,password:"Pw!ana-x9z1"}});ok(r.status===400,"E1b 2 e-mail gresit respins: "+JSON.stringify(bad));}
r=await api("/api/app/setcred",{cookie:ANA,body:{email:CRED[nat].email,password:"Pw!ana-x9z1"}});ok(r.status===400,"E1b 2 e-mail deja folosit de alt cont: 400");
r=await api("/api/app/setcred",{cookie:ANA,body:{email:"  ANA@Exemplu.RO ",password:"Pw!ana-x9z1"}});ok(r.status===200&&r.j.ok,"E1b 2 setcred reuseste");
CRED[ana]={email:"ana@exemplu.ro",password:"Pw!ana-x9z1"};
r=await api("/api/app/me",{method:"GET",cookie:ANA});ok(r.j.needCred===false&&r.j.email==="ana@exemplu.ro","E1b 2 /me dupa setcred: needCred false si e-mailul normalizat");
r=await api("/api/app/login",{body:{code:codeAna}});ok(r.status===400,"cod folosit nu mai merge");
const dump=env.DB._db.prepare("SELECT hash FROM app_codes").all();ok(dump.every(x=>x.hash.length===64&&x.hash!==codeAna),"codurile sunt stocate doar ca amprenta");
r=await api("/api/app/me",{method:"GET",cookie:ANA});ok(r.j.id===ana&&r.j.state==="active"&&r.j.role==="president"&&r.j.title==="Președinte","presedinte autentificat, cu role si title");
for(const [id,name] of [["tim","Tim Trez"],["bob","Bob Membru"],["dan","Dan Membru"]]){
  r=await W(ANA,"branches/Brașov/members",id,{name,branch:"Brașov",userId:"HACK",validUntil:Y+"-12-31"});ok(r.status===200,"presedinte adauga membru "+id);
}
r=await W(PCLUJ,"branches/Cluj/members","cora",{name:"Cora Cluj",branch:"Cluj",userId:"HACK",validUntil:Y+"-12-31"});ok(r.status===200,"presedinte Cluj adauga membru cora");
let rows=await api("/api/app/pull",{cookie:ANA,body:{paths:["branches/Brașov/members"]}});
ok(rows.j.data["branches/Brașov/members"].filter(x=>["tim","bob","dan"].includes(x.id)).every(x=>x.userId===""),"userId nu poate fi setat de client");
r=await A(ANA,{op:"setRole",memberId:"tim",role:"treasurer"});ok(r.status===200,"presedinte numeste trezorier");
r=await W(MOD,"branches/Brașov/fees","f0",{memberId:"bob",year:2027,state:"platita"});ok(r.status===403,"moderatorul nu scrie cotizatii");
// --- coduri
r=await api("/api/app/code",{cookie:MOD,body:{branch:"Brașov",memberId:"tim"}});ok(r.status===403,"mod nu genereaza coduri de membru");
// --- presedinte
rows=await api("/api/app/pull",{cookie:ANA,body:{paths:["roles","badges","branches/Brașov/members","branches/Cluj/members","audit"]}});
ok(rows.j.errors["branches/Cluj/members"]===403,"presedinte Brasov nu citeste Cluj");
ok(Array.isArray(rows.j.data["branches/Brașov/members"])&&rows.j.data["branches/Brașov/members"].length===5,"presedinte citeste Brasov (ana, nat, tim, bob, dan)");
ok(rows.j.data["badges"].some(b=>b.id===ana&&b.verified&&b.active),"insigna calculata de server pentru presedinte");
ok(rows.j.data["audit"].some(a=>a.action==="activate"),"audit: activare");
ok(rows.j.data["roles"].some(x=>x.id==="tim"&&x.role==="treasurer"&&x.title==="Vicepreședinte trezorier"),"trezorierul are titlul implicit");
r=await W(ANA,"branches/Cluj/fees","fx",{memberId:"cora",year:2027,state:"platita"});ok(r.status===403,"presedinte nu scrie in Cluj");
r=await W(ANA,"roles","bob",{role:"president",branch:"Brașov"});ok(r.status===403,"presedinte nu scrie direct in roles");
r=await W(ANA,"branches/Brașov/fees","f1",{memberId:"bob",year:2027,due:30000,paid:0,state:"neplatita",createdAt:T});ok(r.status===200,"presedinte inregistreaza cotizatie");
r=await W(ANA,"branches/Brașov/fees","f1",null,true);ok(r.status===403,"cotizatiile nu se sterg");
r=await W(ANA,"branches/Brașov/settings","cfg",{feeDue:50000,opening:0});ok(r.status===200,"presedintele filialei schimba setarile");
r=await W(MOD,"branches/Brașov/settings","cfg",{feeDue:30000});ok(r.status===403,"moderatorul nu scrie setarile");
r=await W(NAT,"branches/Brașov/settings","cfg",{feeDue:30000});ok(r.status===403,"presedintele national nu scrie setarile");
r=await api("/api/app/code",{cookie:ANA,body:{branch:"Cluj",memberId:"cora"}});ok(r.status===403,"presedinte nu da coduri in Cluj");
r=await api("/api/app/code",{cookie:ANA,body:{branch:"Brașov",memberId:"bob"}});ok(r.status===200,"presedinte da cod in Brasov");
const codeBob=r.j.code;
r=await W(ANA,"audit","a1",{summary:"Test",path:"x",byName:"Ana",action:"update"});ok(r.status===200,"presedinte scrie in jurnal");
r=await W(ANA,"audit","a1",{summary:"Alt text"});ok(r.status===403,"jurnalul nu se rescrie");
rows=await api("/api/app/pull",{cookie:ANA,body:{paths:["audit"]}});ok(rows.j.data.audit.find(a=>a.id==="a1").by===ana,"jurnal: autorul e pus de server");
// --- membru
r=await api("/api/app/login",{body:{code:codeBob}});const BOB=r.cookie;ok(r.status===200,"membru intra cu cod");await cred(BOB);
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["branches/Brașov/fees","branches/Brașov/members","audit","roles","profiles","badges","data/users/bob","data/users/"+ana,"branchlist"]}});
ok(rows.j.errors["branches/Brașov/fees"]===403&&rows.j.errors["branches/Brașov/members"]===403&&rows.j.errors.audit===403,"membrul nu vede finante, evidenta, jurnal");
ok(rows.j.errors["data/users/"+ana]===403&&!rows.j.errors["data/users/bob"],"datele private doar ale lui");
ok(Array.isArray(rows.j.data.roles)&&Array.isArray(rows.j.data.badges)&&Array.isArray(rows.j.data.profiles),"membrul vede roluri, insigne, profiluri");
ok(Array.isArray(rows.j.data.branchlist)&&rows.j.data.branchlist.length>=3&&rows.j.data.branchlist.some(x=>x.name==="Brașov"&&x.id==="brasov"),"membrul citeste lista de filiale (3 initiale)");
r=await W(BOB,"profiles","bob",{name:"Bob",branch:"Cluj",firm:"X"});ok(r.status===200,"membrul isi scrie profilul");
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["profiles"]}});ok(rows.j.data.profiles.find(p=>p.id==="bob").branch==="Brașov","filiala profilului o pune serverul");
r=await W(BOB,"profiles",ana,{name:"Hack"});ok(r.status===403,"membrul nu scrie profilul altuia");
r=await W(BOB,"data/users/bob","contact",{phone:"1"});ok(r.status===200,"membrul scrie datele lui private");
r=await W(BOB,"data/users/"+ana,"contact",{phone:"1"});ok(r.status===403,"membrul nu scrie datele private ale altuia");
r=await W(BOB,"roles","bob",{role:"president",branch:"Brașov"});ok(r.status===403,"membrul nu isi da rol");
r=await W(BOB,"branches/Brașov/members","dan",{name:"x"});ok(r.status===403,"membrul nu scrie in evidenta");
r=await api("/api/app/code",{cookie:BOB,body:{branch:"Brașov",memberId:"dan"}});ok(r.status===403,"membrul nu genereaza coduri");
r=await A(BOB,{op:"setRole",memberId:"dan",role:"treasurer"});ok(r.status===403,"membrul nu are operatii de structura");
// revizii
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["badges","roles"]}});const rv=rows.j.rev;
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["badges","roles"],revs:rv}});ok(Object.keys(rows.j.data).length===0,"fara schimbari: nimic retrimis");
r=await W(ANA,"branches/Brașov/fees","f2",{memberId:"dan",year:Number(Y),state:"platita",paid:30000,due:30000});
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["badges"],revs:rv}});ok(rows.j.data.badges!==undefined,"dupa o plata, insigne retrimise");
// --- excludere automata (valabilitate expirata)
const old=addM(T,-4);
let m=(await api("/api/app/pull",{cookie:ANA,body:{paths:["branches/Brașov/members"]}})).j.data["branches/Brașov/members"].find(x=>x.id==="bob");
const {id:_i,...mo}=m;
r=await W(ANA,"branches/Brașov/members","bob",{...mo,validUntil:old});ok(r.status===200,"presedinte seteaza valabilitate veche");
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["badges"]}});ok(rows.status===403&&rows.j.excluded===true&&rows.j.reason==="expired","membru expirat de peste 3 luni: exclus de server, reason expired");
r=await api("/api/app/me",{method:"GET",cookie:BOB});ok(r.status===403&&r.j.excluded&&r.j.validUntil===old&&r.j.reason==="expired","me: exclus cu data expirarii");
rows=await api("/api/app/pull",{cookie:ANA,body:{paths:["profiles"]}});ok(!rows.j.data.profiles.some(p=>p.id==="bob"),"profilul excluditului dispare din director");
r=await api("/api/app/passlogin",{body:CRED.bob});ok(r.status===403&&r.j.excluded&&r.j.reason==="expired","exclusul (expirat) nu intra nici cu e-mail si parola");
r=await W(ANA,"branches/Brașov/fees","f1",{memberId:"bob",year:2027,due:30000,paid:30000,state:"platita",createdAt:T});
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["badges"]}});ok(rows.status===200,"dupa plata, accesul revine");
const grace=addM(T,-1);
r=await W(ANA,"branches/Brașov/fees","f1",{memberId:"bob",year:2027,due:30000,paid:0,state:"anulata",anulat:true,createdAt:T});
r=await W(ANA,"branches/Brașov/members","bob",{...mo,validUntil:grace});
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["badges"]}});ok(rows.status===200&&rows.j.data.badges.find(b=>b.id==="bob").active===false&&rows.j.data.badges.find(b=>b.id==="bob").excluded===false,"in grace: acces, insigna inactiva");
// donatii
await W(ANA,"branches/Brașov/donations","d1",{donor:"Firma X",anonymous:false,amount:1000,branch:"Brașov"});
await W(ANA,"branches/Brașov/donations","d2",{donor:"Ion",anonymous:true,amount:500,branch:"Brașov"});
let d=(await api("/api/app/pull",{cookie:ANA,body:{paths:["branches/Brașov/donations"]}})).j.data["branches/Brașov/donations"];
ok(d.find(x=>x.id==="d1").donor==="Firma X","presedintele filialei vede donatorii");
// confidentialitate intre membri si intre filiale
{
  r=await api("/api/app/code",{cookie:PCLUJ,body:{branch:"Cluj",memberId:"cora"}});
  const CORA=await login(r.j.code);ok(!!CORA,"membru din Cluj intra cu cod generat de presedintele Cluj");
  await W(CORA,"profiles","cora",{name:"Cora Cluj",firm:"Cora SRL",consent:{directory:false}});
  await W(BOB,"profiles","bob",{name:"Bob",firm:"X",consent:{directory:false}});
  let pr=(await api("/api/app/pull",{cookie:BOB,body:{paths:["profiles"]}})).j.data.profiles;
  ok(pr.some(x=>x.id==="bob")&&!pr.some(x=>x.id==="cora"),"fara acord de director, profilul nu ajunge la alti membri");
  pr=(await api("/api/app/pull",{cookie:ANA,body:{paths:["profiles"]}})).j.data.profiles;
  ok(pr.some(x=>x.id==="bob")&&!pr.some(x=>x.id==="cora"),"presedintele vede profilurile fara acord doar din filiala lui");
  pr=(await api("/api/app/pull",{cookie:MOD,body:{paths:["profiles"]}})).j.data.profiles;
  ok(!pr.some(x=>x.id==="bob")&&!pr.some(x=>x.id==="cora"),"moderatorul nu vede profilurile fara acord de director");
  await W(CORA,"profiles","cora",{name:"Cora Cluj",firm:"Cora SRL",consent:{directory:true}});
  pr=(await api("/api/app/pull",{cookie:BOB,body:{paths:["profiles"]}})).j.data.profiles;
  ok(pr.some(x=>x.id==="cora"),"cu acord de director, profilul apare la ceilalti membri");
  let bg=(await api("/api/app/pull",{cookie:BOB,body:{paths:["badges"]}})).j.data.badges;
  ok(typeof bg.find(x=>x.id==="bob").validUntil==="string"&&bg.filter(x=>x.id!=="bob").every(x=>!("validUntil" in x)),"membrul vede data de valabilitate doar la propria insigna");
  bg=(await api("/api/app/pull",{cookie:ANA,body:{paths:["badges"]}})).j.data.badges;
  ok("validUntil" in bg.find(x=>x.id==="bob")&&!("validUntil" in bg.find(x=>x.id==="cora")),"presedintele vede valabilitatea doar in filiala lui");
  bg=(await api("/api/app/pull",{cookie:MOD,body:{paths:["badges"]}})).j.data.badges;
  ok(bg.every(x=>!("validUntil" in x)),"moderatorul nu vede date de valabilitate");
  globalThis.CORA=CORA;
}
let CORA=globalThis.CORA;const cora="cora";
// presedintele revine dupa delogare, cu cod de la presedintele national
r=await api("/api/app/logout",{cookie:ANA});ok(r.status===200&&/Max-Age=0/.test(r.sc),"logout");
r=await api("/api/app/me",{method:"GET",cookie:ANA});ok(r.status===401,"sesiune inchisa");
r=await A(MOD,{op:"resetAccess",memberId:ana});ok(r.status===200&&r.j.ok&&r.j.code&&r.j.memberId===ana&&r.j.expires,"mod: resetAccess pentru presedinte");
r2=await api("/api/app/passlogin",{body:CRED[ana]});ok(r2.status===400,"resetAccess: vechea parola nu mai merge");
let ANA2=await login(r.j.code);ok(!!ANA2,"presedintele revine cu codul nou si isi pune din nou e-mail si parola");
r=await A(NAT,{op:"resetAccess",memberId:ana});ok(r.status===200&&r.j.code,"national: resetAccess pentru presedinte");
r2=await api("/api/app/me",{method:"GET",cookie:ANA2});ok(r2.status===401,"resetAccess inchide sesiunile contului");
ANA2=await login(r.j.code);ok(!!ANA2,"presedintele reintra cu al doilea cod");
// sesiuni
let cks=[];for(let i=0;i<7;i++){const c=(await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"tim"}})).j.code;const l=await api("/api/app/login",{body:{code:c}});cks.push(l.cookie)}
const alive=[];for(const c of cks){alive.push((await api("/api/app/me",{method:"GET",cookie:c})).status===200)}
ok(alive.filter(Boolean).length===5&&!alive[0]&&!alive[1],"maxim 5 sesiuni active, cele vechi se inchid");
ok(env.DB._db.prepare("SELECT COUNT(*) c FROM app_codes WHERE member_id='tim' AND used IS NULL").get().c===0,"coduri folosite marcate");
// cod expirat
const ce=(await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"dan"}})).j.code;
env.DB._db.prepare("UPDATE app_codes SET expires=?").run(addM(T,-1));
r=await api("/api/app/login",{body:{code:ce}});ok(r.status===400,"cod expirat respins");
// cai invalide
rows=await api("/api/app/pull",{cookie:MOD,body:{paths:["../../x","branches/Altceva/members","branches/Brașov/codes","claims"]}});
ok(rows.j.errors["../../x"]===400&&rows.j.errors["branches/Altceva/members"]===400&&Array.isArray(rows.j.data["branches/Brașov/codes"]),"cai invalide respinse, codurile nu se expun");
r=await W(ANA2,"branches/Brașov/members","big",{name:"A",x:"y".repeat(7000)});ok(r.status===400,"document prea mare respins");
r=await W(MOD,"badges","bob",{verified:true});ok(r.status===403,"insignele nu se scriu de client");

// ======= verificari noi (A7)
const TIM=cks[6];await cred(TIM);
const singles=(roles)=>{const per={};for(const x of roles)if(x.role==="president")per[x.branch]=(per[x.branch]||0)+1;return roles.filter(x=>x.role==="national").length===1&&Object.values(per).every(v=>v===1)};
const ROLES_NOW=async()=>(await PULL(MOD,["roles"])).data.roles;
const addM2=async(cookie,id,name,b,account)=>{const w=await W(cookie,`branches/${b}/members`,id,{name,branch:b,validUntil:Y+"-12-31"});if(!account||w.status!==200)return null;const c=await api("/api/app/code",{cookie,body:{branch:b,memberId:id}});return login(c.j.code)};
// 1. mod
r=await A(MOD,{op:"addBranch",name:"Timiș",presidentName:"Tudor Timiș"});ok(r.status===200&&r.j.branch==="Timiș"&&r.j.code&&r.j.memberId&&r.j.expires,"1 mod: addBranch merge");
rows=await PULL(MOD,["branches/Brașov/members","branches/Brașov/fees","branches/Brașov/expenses","branches/Brașov/donations","branches/Brașov/settings","branchlist"]);
ok(["members","fees","expenses","donations","settings"].every(c=>rows.errors["branches/Brașov/"+c]===403)&&Array.isArray(rows.data.branchlist),"1 mod: nu citeste nicio colectie de filiala (403), citeste branchlist");
r=await W(MOD,"branches/Brașov/members","zzz",{name:"Z Z"});ok(r.status===403,"1 mod: nu scrie membri");
r=await api("/api/app/code",{cookie:MOD,body:{branch:"Brașov",memberId:"tim"}});ok(r.status===403,"1 mod: nu genereaza coduri de membru");
r=await A(MOD,{op:"setRole",memberId:"tim",role:"board",title:"Secretar"});ok(r.status===403,"1 mod: nu poate setRole");
r=await A(MOD,{op:"exclude",memberId:"dan"});ok(r.status===403,"1 mod: nu poate exclude");
r=await A(MOD,{op:"handover",to:"dan"});ok(r.status===403,"1 mod: nu are ce preda");
r=await A(MOD,{op:"candidates",for:"handover"});ok(r.status===403,"1 mod: candidates handover 403");
r=await A(MOD,{op:"nimic"});ok(r.status===400,"op necunoscut: 400");
r=await A(MOD,{op:"resetAccess",memberId:nat});ok(r.status===200&&r.j.code,"1 mod: resetAccess pentru presedintele national");
NAT=await login(r.j.code);ok(!!NAT,"presedintele national reintra cu codul nou");
r=await A(MOD,{op:"resetAccess",memberId:"tim"});ok(r.status===403,"1 mod: resetAccess nu merge pentru un membru");
r=await A(MOD,{op:"resetAccess",memberId:"nimeni"});ok(r.status===404,"resetAccess pentru persoana inexistenta: 404");
r=await A(MOD,{op:"leaderCode",memberId:ana});ok(r.status===400,"leaderCode a disparut: operatie necunoscuta");
r=await A(MOD,{op:"candidates",for:"president",branch:"Brașov"});
ok(r.status===200&&r.j.ok&&Array.isArray(r.j.list)&&r.j.list.some(x=>x.id===ana&&x.active===true)&&r.j.list.some(x=>x.id==="dan"&&x.active===false)&&r.j.list.every(x=>Object.keys(x).sort().join()==="active,branch,id,name"),"1 mod: candidates president, doar id/name/branch/active");
// 2. national
r=await A(NAT,{op:"addBranch",name:"  Sibiu ",presidentName:"Sorin Sibiu"});ok(r.status===200&&r.j.branch==="Sibiu"&&r.j.code&&r.j.memberId,"2 national: addBranch merge");
const sib1=r.j.memberId;const SIB1=await login(r.j.code);ok(!!SIB1,"2 presedintele noii filiale intra cu codul primit");
r=await W(SIB1,"branches/Sibiu/members","sm1",{name:"Sima Membru",branch:"Sibiu",validUntil:Y+"-12-31"});ok(r.status===200,"2 presedintele noii filiale isi adauga membri (cale noua)");
rows=await PULL(SIB1,["branches/Sibiu/members","branches/Brașov/members"]);ok(Array.isArray(rows.data["branches/Sibiu/members"])&&rows.errors["branches/Brașov/members"]===403,"10 caile filialei noi functioneaza, restul raman inchise");
r=await A(NAT,{op:"setPresident",branch:"Sibiu",memberId:"sm1"});ok(r.status===200&&r.j.memberId==="sm1"&&r.j.code,"2 national: setPresident cu memberId (fara cont: cod)");
const SM1=await login(r.j.code);ok(!!SM1,"2 noul presedinte intra");
rows=await PULL(SIB1,["branches/Sibiu/members"]);ok(rows.errors["branches/Sibiu/members"]===403,"2 fostul presedinte nu mai citeste evidenta");
r=await api("/api/app/me",{method:"GET",cookie:SIB1});ok(r.j.role==="member","2 fostul presedinte e membru");
rows=await PULL(SM1,["branches/Sibiu/members"]);ok(Array.isArray(rows.data["branches/Sibiu/members"]),"2 noul presedinte citeste evidenta");
r=await A(NAT,{op:"setPresident",branch:"Brașov",memberId:nat});ok(r.status===400,"2 setPresident refuza persoana cu rol national");
r=await A(NAT,{op:"setPresident",branch:"Brașov",memberId:"nimeni"});ok(r.status===404,"2 setPresident: persoana inexistenta 404");
r=await A(NAT,{op:"setPresident",branch:"Brașov"});ok(r.status===400,"2 setPresident fara persoana: 400");
rows=await PULL(NAT,["branches/Brașov/members","branches/Sibiu/fees","branches/Brașov/donations","branches/Brașov/expenses","branches/Brașov/settings"]);
ok(Object.values(rows.errors).length===5&&Object.values(rows.errors).every(v=>v===403),"2 national nu citeste evidenta nicio filiala");
r=await W(NAT,"branches/Brașov/members","zzz",{name:"Z Z"});ok(r.status===403,"2 national nu scrie membri");
r=await W(NAT,"branches/Brașov/fees","fz",{memberId:"bob",year:2027});ok(r.status===403,"2 national nu scrie cotizatii");
r=await A(NAT,{op:"setRole",memberId:"tim",role:"board",title:"Secretar"});ok(r.status===403,"2 national nu poate setRole");
r=await A(NAT,{op:"exclude",memberId:"dan"});ok(r.status===403,"2 national nu poate exclude");
r=await api("/api/app/code",{cookie:NAT,body:{branch:"Brașov",memberId:"dan"}});ok(r.status===403,"2 national nu genereaza coduri de membru");
r=await A(NAT,{op:"candidates",for:"president",branch:"Sibiu"});ok(r.status===200&&r.j.list.some(x=>x.id==="sm1")&&r.j.list.some(x=>x.id===sib1),"2 national: candidates president");
r=await A(NAT,{op:"resetAccess",memberId:nat});ok(r.status===403,"2 national nu reseteaza accesul national");
r=await A(NAT,{op:"resetAccess",memberId:"tim"});ok(r.status===403,"2 national nu reseteaza accesul unui trezorier");
r=await A(ANA2,{op:"candidates",for:"president",branch:"Brașov"});ok(r.status===403,"candidates president: doar mod si national");
// 4. president: setRole
const BEA=await addM2(ANA2,"bea","Bea Board","Brașov",true);ok(!!BEA,"membru bea cu cont");
r=await A(ANA2,{op:"setRole",memberId:"bea",role:"board"});ok(r.status===400,"4 board fara titlu: 400");
r=await A(ANA2,{op:"setRole",memberId:"bea",role:"board",title:"S"});ok(r.status===400,"4 titlu prea scurt: 400");
r=await A(ANA2,{op:"setRole",memberId:"bea",role:"board",title:"x".repeat(61)});ok(r.status===400,"4 titlu prea lung: 400");
r=await A(ANA2,{op:"setRole",memberId:"bea",role:"president"});ok(r.status===400,"4 rol invalid: 400");
r=await A(ANA2,{op:"setRole",memberId:"bea",role:"board",title:"Secretar"});ok(r.status===200,"4 setRole board cu titlu");
r=await A(ANA2,{op:"setRole",memberId:"dan",role:"treasurer"});ok(r.status===200,"4 setRole treasurer");
r=await A(ANA2,{op:"setRole",memberId:"dan",role:"member"});ok(r.status===200,"4 retragere functie");
rows=await ROLES_NOW();ok(rows.some(x=>x.id==="bea"&&x.role==="board"&&x.title==="Secretar"&&x.branch==="Brașov")&&!rows.some(x=>x.id==="dan"),"4 roles: bea board Secretar, dan fara functie");
r=await api("/api/app/me",{method:"GET",cookie:BEA});ok(r.j.role==="board"&&r.j.title==="Secretar","4 me: board cu titlu");
r=await A(ANA2,{op:"setRole",memberId:"cora",role:"treasurer"});ok(r.status===404||r.status===403,"4 setRole in alta filiala refuzat");
r=await A(ANA2,{op:"setRole",memberId:ana,role:"member"});ok(r.status===403,"4 presedintele nu isi schimba functia");
r=await A(ANA2,{op:"setRole",memberId:nat,role:"treasurer"});ok(r.status===403,"4 setRole refuzat pentru national");
r=await A(TIM,{op:"setRole",memberId:"dan",role:"treasurer"});ok(r.status===403,"4 trezorierul nu poate setRole");
// 5. board
rows=await PULL(BEA,["branches/Brașov/donations","branches/Brașov/expenses","branches/Brașov/members","branches/Brașov/fees","branches/Brașov/settings","audit","branches/Cluj/donations"]);
ok(Array.isArray(rows.data["branches/Brașov/donations"])&&Array.isArray(rows.data["branches/Brașov/expenses"]),"5 board citeste donatii si cheltuieli");
ok(["members","fees","settings"].every(c=>rows.errors["branches/Brașov/"+c]===403)&&rows.errors.audit===403&&rows.errors["branches/Cluj/donations"]===403,"5 board nu citeste members, fees, settings, jurnal, alta filiala");
d=rows.data["branches/Brașov/donations"];ok(d.find(x=>x.id==="d1").donor===""&&d.find(x=>x.id==="d2").donor==="Anonim","5 board nu primeste numele donatorilor");
for(const [c,id] of [["expenses","ex"],["donations","dx"],["fees","fx"],["members","bea"],["settings","cfg"]]){
  r=await W(BEA,"branches/Brașov/"+c,id,{name:"Bea Board",amount:1,memberId:"dan"});ok(r.status===403,"5 board nu scrie "+c);
}
r=await W(BEA,"audit","ab",{summary:"x"});ok(r.status===403,"5 board nu scrie in jurnal");
r=await A(BEA,{op:"setRole",memberId:"dan",role:"treasurer"});ok(r.status===403,"5 board nu poate setRole");
// 6. treasurer
r=await W(TIM,"branches/Brașov/fees","f3",{memberId:"dan",year:Number(Y)+1,state:"platita",paid:30000,due:30000});ok(r.status===200,"6 trezorierul scrie cotizatii");
r=await W(TIM,"branches/Brașov/expenses","e1",{amount:100,desc:"x"});ok(r.status===200,"6 trezorierul scrie cheltuieli");
r=await W(TIM,"branches/Brașov/donations","d3",{donor:"Z",amount:5});ok(r.status===200,"6 trezorierul scrie donatii");
r=await W(TIM,"branches/Brașov/members","dan",{name:"Dan"});ok(r.status===403,"6 trezorierul nu scrie members");
r=await W(TIM,"branches/Brașov/settings","cfg",{feeDue:1});ok(r.status===403,"6 trezorierul nu scrie settings");
rows=await PULL(TIM,["branches/Brașov/members","branches/Brașov/fees","branches/Brașov/donations"]);
ok(Array.isArray(rows.data["branches/Brașov/members"])&&Array.isArray(rows.data["branches/Brașov/fees"])&&rows.data["branches/Brașov/donations"].find(x=>x.id==="d1").donor==="Firma X","6 trezorierul citeste evidenta si vede donatorii");
r=await api("/api/app/code",{cookie:TIM,body:{branch:"Brașov",memberId:"dan"}});ok(r.status===403,"6 trezorierul nu genereaza coduri");
// 7. handover
const HANA=await addM2(ANA2,"hana","Hana Membru","Brașov",true);
const HUGO=await addM2(ANA2,"hugo","Hugo Membru","Brașov",true);
await addM2(ANA2,"noacc","Fara Cont","Brașov",false);
r=await A(ANA2,{op:"handover",to:cora});ok(r.status===403,"7 handover spre alta filiala: refuz");
r=await A(ANA2,{op:"handover",to:"noacc"});ok(r.status===400,"7 handover spre cont neactivat: refuz");
r=await A(ANA2,{op:"handover",to:ana});ok(r.status===400,"7 handover spre sine: refuz");
r=await A(ANA2,{op:"handover",to:nat});ok(r.status===400,"7 handover spre national: refuz");
r=await A(ANA2,{op:"handover",to:"nimeni"});ok(r.status===404,"7 handover spre persoana inexistenta: 404");
r=await A(ANA2,{op:"handover"});ok(r.status===400,"7 handover fara tinta: 400");
r=await A(BOB,{op:"handover",to:"hana"});ok(r.status===403,"7 membrul fara functie nu preda");
r=await A(ANA2,{op:"candidates",for:"handover"});
ok(r.status===200&&r.j.list.some(x=>x.id==="hana")&&!r.j.list.some(x=>x.id==="noacc"||x.id===ana||x.id===nat||x.id===cora)&&r.j.list.every(x=>x.branch==="Brașov"&&x.active===true),"7 candidates handover: doar cu cont, aceeasi filiala, fara presedinti");
r=await A(ANA2,{op:"handover",to:"hana"});ok(r.status===200&&r.j.ok,"7 presedinte catre membru din aceeasi filiala");
r=await api("/api/app/me",{method:"GET",cookie:ANA2});ok(r.j.role==="member","7 dupa predare, cel vechi e membru");
rows=await PULL(ANA2,["branches/Brașov/members","branches/Brașov/fees"]);ok(rows.errors["branches/Brașov/members"]===403&&rows.errors["branches/Brașov/fees"]===403,"7 cel vechi nu mai citeste evidenta");
r=await W(ANA2,"branches/Brașov/members","dan",{name:"Dan"});ok(r.status===403,"7 cel vechi nu mai scrie");
r=await A(ANA2,{op:"setRole",memberId:"dan",role:"treasurer"});ok(r.status===403,"7 cel vechi nu mai are operatii de presedinte");
r=await api("/api/app/me",{method:"GET",cookie:HANA});ok(r.j.role==="president"&&r.j.title==="Președinte","7 noul presedinte");
ok(singles(await ROLES_NOW()),"3 un singur national si un singur presedinte pe filiala dupa predare");
r=await A(HANA,{op:"handover",to:ana});ok(r.status===200,"7 predare inapoi");
r=await api("/api/app/me",{method:"GET",cookie:ANA2});ok(r.j.role==="president","7 presedintele initial recuperat");
r=await A(BEA,{op:"handover",to:"hugo"});ok(r.status===200,"7 board catre membru");
r=await api("/api/app/me",{method:"GET",cookie:HUGO});ok(r.j.role==="board"&&r.j.title==="Secretar","7 tinta primeste titlul celui care preda");
r=await api("/api/app/me",{method:"GET",cookie:BEA});ok(r.j.role==="member","7 cel care a predat functia de board e membru");
r=await A(TIM,{op:"handover",to:"hugo"});ok(r.status===200,"7 trezorier catre un membru cu functie de board");
r=await api("/api/app/me",{method:"GET",cookie:HUGO});ok(r.j.role==="treasurer"&&r.j.title==="Vicepreședinte trezorier","7 rolul board al tintei e inlocuit de cel primit");
r=await A(HUGO,{op:"handover",to:"tim"});ok(r.status===200,"7 predare inapoi trezorier");
r=await api("/api/app/me",{method:"GET",cookie:TIM});ok(r.j.role==="treasurer","7 tim e din nou trezorier");
r=await A(NAT,{op:"handover",to:cora});ok(r.status===200,"7 national catre membru din alta filiala");
r=await api("/api/app/me",{method:"GET",cookie:NAT});ok(r.j.role==="member","7 vechiul national are doar drepturi de membru");
r=await A(NAT,{op:"setPresident",branch:"Cluj",memberId:"cora"});ok(r.status===403,"7 vechiul national nu mai poate structura");
r=await api("/api/app/me",{method:"GET",cookie:CORA});ok(r.j.role==="national"&&r.j.title==="Președinte național","7 noul national");
ok(singles(await ROLES_NOW()),"3 un singur national dupa predarea nationala");
r=await A(CORA,{op:"candidates",for:"handover"});ok(r.status===200&&r.j.list.some(x=>x.branch==="Brașov")&&r.j.list.some(x=>x.branch==="Sibiu"),"7 candidates handover pentru national: toate filialele");
r=await A(CORA,{op:"handover",to:nat});ok(r.status===200,"7 national: predare inapoi");
r=await api("/api/app/me",{method:"GET",cookie:NAT});ok(r.j.role==="national","7 nat e din nou national");
// 8. exclude
const EVE=await addM2(ANA2,"eve","Eve Exclusa","Brașov",true);ok(!!EVE,"membru eve cu cont");
await W(EVE,"profiles","eve",{name:"Eve",firm:"E SRL",consent:{directory:true}});
await A(ANA2,{op:"setRole",memberId:"eve",role:"board",title:"Casier"});
rows=await PULL(TIM,["profiles"]);ok(rows.data.profiles.some(p=>p.id==="eve"),"8 eve apare in director");
const codeEve="QRSTUVWXYZ23";env.DB._db.prepare("INSERT INTO app_codes (hash,member_id,branch,created_by,created,expires) VALUES (?,?,?,?,?,?)").run(createHash("sha256").update("jci-app-code:"+codeEve).digest("hex"),"eve","Brașov","test",T,addM(T,1));
r=await A(ANA2,{op:"exclude",memberId:ana});ok(r.status===403,"8 presedintele nu se exclude pe sine");
r=await A(ANA2,{op:"exclude",memberId:nat});ok(r.status===403,"8 nu se exclude national");
r=await A(ANA2,{op:"exclude",memberId:"nimeni"});ok(r.status===404,"8 exclude: persoana inexistenta 404");
r=await A(PCLUJ,{op:"exclude",memberId:"eve"});ok(r.status===404||r.status===403,"8 exclude in alta filiala refuzat");
r=await A(TIM,{op:"exclude",memberId:"eve"});ok(r.status===403,"8 trezorierul nu exclude");
r=await A(ANA2,{op:"reactivate",memberId:"eve"});ok(r.status===400,"8 reactivate pe un membru neexclus: 400");
r=await A(ANA2,{op:"exclude",memberId:"eve"});ok(r.status===200&&r.j.ok,"8 exclude merge");
// sesiunea celui exclus ramane, dar orice cerere primeste 403 cu reason manual (asa vede ecranul de suspendare)
r=await api("/api/app/me",{method:"GET",cookie:EVE});ok(r.status===403&&r.j.excluded===true&&r.j.reason==="manual"&&r.j.branch==="Brașov","8 sesiunea excluditului: 403 cu reason manual");
rows=await api("/api/app/pull",{cookie:EVE,body:{paths:["profiles"]}});ok(rows.status===403&&rows.j.reason==="manual","8 pull pentru exclus: 403");
r=await W(EVE,"profiles","eve",{name:"Eve"});ok(r.status===403,"8 excluditul nu scrie nimic");
r=await A(EVE,{op:"candidates",for:"handover"});ok(r.status===403,"8 excluditul nu are operatii de structura");
r=await api("/api/app/passlogin",{body:CRED.eve});ok(r.status===403&&r.j.excluded===true&&r.j.reason==="manual"&&r.j.branch==="Brașov","8 exclus: nici cu e-mail si parola nu intra");
r=await api("/api/app/login",{body:{code:codeEve}});ok(r.status===400,"8 codul nefolosit a fost sters la excludere");
r=await A(ANA2,{op:"resetAccess",memberId:"eve"});ok(r.status===400,"E1b 6 resetAccess pentru un exclus: 400");
{const cx="ABCDEFGHJKLM";const hh=createHash("sha256").update("jci-app-code:"+cx).digest("hex");
 env.DB._db.prepare("INSERT INTO app_codes (hash,member_id,branch,created_by,created,expires) VALUES (?,?,?,?,?,?)").run(hh,"eve","Brașov","test",T,addM(T,1));
 r=await api("/api/app/login",{body:{code:cx}});ok(r.status===403&&r.j.excluded&&r.j.reason==="manual","8 nici cu un cod nou nu intra");
 ok(env.DB._db.prepare("SELECT used FROM app_codes WHERE hash=?").get(hh).used===null,"8 codul nu se consuma la refuz");}
r=await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"eve"}});ok(r.status===400,"8 nu se genereaza cod pentru exclus");
rows=await PULL(TIM,["profiles","badges"]);ok(!rows.data.profiles.some(p=>p.id==="eve"),"8 excluditul dispare din profiles");
ok(rows.data.badges.find(x=>x.id==="eve").excluded===true&&rows.data.badges.find(x=>x.id==="eve").active===false,"8 insigna excluditului: inactiva");
rows=await ROLES_NOW();ok(!rows.some(x=>x.id==="eve"),"8 excluderea scoate functia de board");
r=await A(ANA2,{op:"setRole",memberId:"eve",role:"treasurer"});ok(r.status===400,"8 nu se numeste in functie un exclus");
r=await A(PCLUJ,{op:"reactivate",memberId:"eve"});ok(r.status===404||r.status===403,"8 reactivate in alta filiala refuzat");
r=await A(ANA2,{op:"reactivate",memberId:"eve"});ok(r.status===200,"8 reactivate merge");
rows=await PULL(TIM,["profiles","badges"]);ok(rows.data.profiles.some(p=>p.id==="eve")&&rows.data.badges.find(x=>x.id==="eve").active===true,"8 reactivate: eve revine in director si insigna e activa");
r=await api("/api/app/me",{method:"GET",cookie:EVE});ok(r.status===200&&r.j.role==="member","8 dupa reactivare, sesiunea veche merge din nou, fara functie");
r=await api("/api/app/passlogin",{body:CRED.eve});ok(r.status===200&&r.cookie,"8 dupa reactivare intra cu aceeasi parola (randul din app_auth a ramas)");
r=await W(ANA2,"branches/Brașov/members","eve",{name:"Eve Exclusa",excluded:true,userId:"x"});
rows=await PULL(ANA2,["branches/Brașov/members"]);ok(!rows.data["branches/Brașov/members"].find(x=>x.id==="eve").excluded&&rows.data["branches/Brașov/members"].find(x=>x.id==="eve").userId==="eve","8 clientul nu poate seta excluded/userId");
r=await A(ANA2,{op:"exclude",memberId:"eve"});r=await W(ANA2,"branches/Brașov/members","eve",{name:"Eve Exclusa"});
rows=await PULL(ANA2,["branches/Brașov/members"]);ok(rows.data["branches/Brașov/members"].find(x=>x.id==="eve").excluded===true,"8 rescrierea evidentei pastreaza excluderea");
await A(ANA2,{op:"reactivate",memberId:"eve"});
// 12. verificari adaugate la revizuire: un cont nu poate fi atins din alta filiala
r=await W(PCLUJ,"branches/Cluj/members","bob",{name:"Bob Furat",branch:"Cluj"});ok(r.status===403,"12 un presedinte nu poate crea un membru cu id-ul cuiva din alta filiala");
r=await W(PCLUJ,"branches/Cluj/members",ana,{name:"Ana Furata",branch:"Cluj"});ok(r.status===403,"12 nici cu id-ul presedintelui altei filiale");
r=await api("/api/app/me",{method:"GET",cookie:ANA2});ok(r.status===200&&r.j.role==="president"&&r.j.branch==="Brașov","12 presedintele Brasov ramane neatins");
r=await W(PCLUJ,"branches/Cluj/fees","fhack",{memberId:"bob",year:2027,state:"platita"});
r=await api("/api/app/me",{method:"GET",cookie:BOB});ok(r.status===200&&r.j.branch==="Brașov","12 o cotizatie scrisa in alta filiala nu atinge contul membrului");
r=await W(ANA2,"audit","fals1",{summary:"Fals",path:"roles",byName:"X",action:"setNational"});
{const au2=(await PULL(MOD,["audit"])).data.audit;ok(!au2.some(a=>a.id==="fals1"),"12 jurnalul scris de client nu poate imita intrari de structura");}
{const rr=(await PULL(BOB,["roles"])).data.roles;ok(rr.length>0&&rr.every(x=>typeof x.name==="string"&&x.name.length>0),"12 rolurile vin cu numele omului");}
{await addM2(ANA2,"relo","Relo Membru","Brașov",false);
 const c1=(await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"relo"}})).j.code;await api("/api/app/login",{body:{code:c1}});
 const c2=(await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"relo"}})).j.code;r=await api("/api/app/login",{body:{code:c2}});
 ok(r.status===200&&r.j.needCred===true,"E1b: un cont activat dar fara parola poate primi si folosi un cod nou");
 r2=await api("/api/app/logout",{cookie:r.cookie});ok(r2.status===200&&/Max-Age=0/.test(r2.sc),"E1b 1 logout merge si fara e-mail si parola");
 const au3=(await PULL(ANA2,["audit"])).data.audit;ok(au3.some(a=>a.action==="relogin"&&a.docId==="relo"),"12 intrarea cu un cod nou pe un cont activat, dar fara parola, ramane in jurnal");}
// 9. scrieri directe
for(const [nm,ck] of [["mod",MOD],["national",NAT],["president",ANA2],["membru",BOB]]){
  r=await W(ck,"roles","zz",{role:"president",branch:"Brașov"});const a=r.status;
  r=await W(ck,"branchlist","zz",{name:"Zz"});const b2=r.status;
  r=await W(ck,"roles","tim",null,true);const c2=r.status;
  r=await W(ck,"branchlist","brasov",null,true);const e2=r.status;
  ok(a===403&&b2===403&&c2===403&&e2===403,"9 scriere directa in roles si branchlist: 403 pentru "+nm);
}
rows=await PULL(MOD,["roles","branchlist"]);ok(!rows.data.roles.some(x=>x.id==="zz")&&rows.data.roles.some(x=>x.id==="tim")&&rows.data.branchlist.some(x=>x.name==="Brașov"),"9 nimic nu s-a schimbat");
// 10. filiale
rows=await PULL(MOD,["branches/Nimic/members"]);ok(rows.errors["branches/Nimic/members"]===400,"10 pull pe filiala inexistenta: 400");
r=await W(ANA2,"branches/Nimic/members","q",{name:"Q Q"});ok(r.status===400,"10 write pe filiala inexistenta: 400");
for(const [nm,nmv] of [["sibiu","Sibiu"],["Sibiu cu diacritice/majuscule","SÎBIU"],["Brasov","Brasov"],["Brașov cu spatii","  Brașov  "],["Bucuresti","bucuresti"]]){
  r=await A(NAT,{op:"addBranch",name:nmv,presidentName:"X Y"});ok(r.status===400,"10 nume duplicat respins: "+nm);
}
r=await A(NAT,{op:"addBranch",name:"A/B",presidentName:"X Y"});ok(r.status===400,"10 caractere nepermise: 400");
r=await A(NAT,{op:"addBranch",name:"A",presidentName:"X Y"});ok(r.status===400,"10 nume prea scurt: 400");
r=await A(NAT,{op:"addBranch",name:"Alba Iulia",presidentName:"X"});ok(r.status===400,"10 numele presedintelui prea scurt: 400");
r=await A(NAT,{op:"addBranch",presidentName:"X Y"});ok(r.status===400,"10 addBranch fara nume: 400");
r=await A(ANA2,{op:"addBranch",name:"Alba Iulia",presidentName:"Ion Alba"});ok(r.status===403,"10 presedintele de filiala nu adauga filiale");
r=await A(NAT,{op:"addBranch",name:"Alba-Iulia 2",presidentName:"Ion Alba"});ok(r.status===200,"10 nume cu cratima, cifre si spatiu accepta");
rows=await PULL(BOB,["branchlist"]);const bl=rows.data.branchlist;ok(bl.some(x=>x.name==="Sibiu"&&x.id==="sibiu"&&x.createdBy===nat&&x.createdAt)&&bl.length===6,"10 branchlist: 3 initiale plus Timiș, Sibiu, Alba-Iulia 2");
// 11. jurnal
let au=(await PULL(MOD,["audit"])).data.audit;
ok(au.length>0&&au.every(a=>a.path==="roles"||a.path==="branchlist")&&au.some(a=>a.action==="setNational")&&au.some(a=>a.action==="addBranch"&&a.branch==="Sibiu"),"11 mod: doar intrari de structura, cu branch");
au=(await PULL(NAT,["audit"])).data.audit;
ok(au.length>0&&au.every(a=>a.path==="roles"||a.path==="branchlist")&&!au.some(a=>a.action==="activate"||a.action==="exclude"),"11 national: doar intrari de structura");
au=(await PULL(ANA2,["audit"])).data.audit;
ok(au.length>0&&au.every(a=>a.by===ana||String(a.path).startsWith("branches/Brașov/")||(a.path==="roles"&&a.branch==="Brașov"))&&!au.some(a=>a.branch==="Sibiu"||a.branch==="Cluj")&&au.some(a=>a.action==="exclude")&&au.some(a=>a.action==="setRole"),"11 presedinte: doar filiala lui");
au=(await PULL(PCLUJ,["audit"])).data.audit;
ok(au.length>0&&au.every(a=>a.by===pcluj||String(a.path).startsWith("branches/Cluj/")||(a.path==="roles"&&a.branch==="Cluj"))&&!au.some(a=>a.action==="exclude"),"11 presedintele Cluj: doar filiala lui");
au=(await PULL(TIM,["audit"])).data.audit;ok(au.length>0&&au.every(a=>a.by==="tim"||String(a.path).startsWith("branches/Brașov/")||(a.path==="roles"&&a.branch==="Brașov")),"11 trezorierul: doar filiala lui");
rows=await PULL(BEA,["audit"]);ok(rows.errors.audit===403,"11 board nu citeste jurnalul");
// 1/3. mod inlocuieste presedintele national
r=await A(MOD,{op:"setNational",branch:"Cluj",memberId:"cora"});ok(r.status===200&&r.j.ok&&r.j.memberId==="cora"&&!r.j.code,"1 mod: setNational pe un membru cu cont (fara cod)");
ok(singles(await ROLES_NOW()),"3 un singur national dupa setNational");
r=await api("/api/app/me",{method:"GET",cookie:NAT});ok(r.j.role==="member","3 fostul national e membru");
r=await api("/api/app/me",{method:"GET",cookie:CORA});ok(r.j.role==="national","3 noul national");
r=await A(MOD,{op:"setNational",branch:"Cluj",memberId:"nimeni"});ok(r.status===404,"setNational: persoana inexistenta 404");
r=await A(MOD,{op:"setNational",branch:"Cluj"});ok(r.status===400,"setNational fara persoana: 400");
r=await A(NAT,{op:"setNational",branch:"Cluj",name:"Alt Nume"});ok(r.status===403,"setNational: doar mod");
// ======= E1b: e-mail si parola, codul doar la prima intrare
const PWD=(id)=>CRED[id].password;
// 8 administratorul tehnic
r=await api("/api/app/me",{method:"GET",cookie:MOD});ok(r.j.needCred===false&&r.j.role==="mod","E1b 8 mod: needCred false");
r=await api("/api/app/setcred",{cookie:MOD,body:{email:"mod@exemplu.ro",password:"Pw!modmodmod1"}});ok(r.status===403,"E1b 8 mod nu isi pune e-mail si parola");
r=await api("/api/app/passlogin",{body:{email:"mod@exemplu.ro",password:"Pw!modmodmod1"}});ok(r.status===400,"E1b 8 mod nu intra cu e-mail si parola");
r=await api("/api/app/modlogin",{body:{key:KEY}});ok(r.status===200&&r.cookie,"E1b 8 mod intra in continuare cu cheia");
rows=await PULL(r.cookie,["roles","branchlist"]);ok(Array.isArray(rows.data.roles)&&Array.isArray(rows.data.branchlist),"E1b 8 mod nu e afectat de needCred");
// 4 cod generat inainte de setcred, 5 schimbarea parolei
await addM2(ANA2,"late","Late Membru","Brașov",false);
const cA=(await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"late"}})).j.code;
r=await api("/api/app/login",{body:{code:cA}});const LATE=r.cookie;ok(r.status===200&&r.j.needCred===true,"E1b 1 login cu cod: needCred in raspuns");
r=await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"late"}});const cB=r.j.code;ok(r.status===200&&!!cB,"E1b 4 pana la setcred se poate genera un cod nou");
r=await api("/api/app/setcred",{cookie:LATE,body:{email:"late@exemplu.ro",password:"Pw!late-one-1"}});ok(r.status===200,"E1b 2 setcred pentru late");
CRED.late={email:"late@exemplu.ro",password:"Pw!late-one-1"};
r=await api("/api/app/login",{body:{code:cB}});ok(r.status===400,"E1b 4 codul generat inainte de setarea parolei nu mai merge");
r=await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"late"}});ok(r.status===400&&/e-mail și parolă/.test(r.j.error),"E1b 4 /code refuza un cont cu e-mail si parola");
{const cx2="ZYXWVUTSRQ23";const hh=createHash("sha256").update("jci-app-code:"+cx2).digest("hex");
 env.DB._db.prepare("INSERT INTO app_codes (hash,member_id,branch,created_by,created,expires) VALUES (?,?,?,?,?,?)").run(hh,"late","Brașov","test",T,addM(T,1));
 r=await api("/api/app/login",{body:{code:cx2}});ok(r.status===400&&r.j.error==="Contul are deja e-mail și parolă. Intră cu ele."&&!r.cookie,"E1b 4 un cod pentru un cont cu parola nu mai poate fi folosit");
 ok(env.DB._db.prepare("SELECT used FROM app_codes WHERE hash=?").get(hh).used===null,"E1b 4 codul ramane nefolosit");}
// 3 passlogin
r=await api("/api/app/passlogin",{body:{email:" LATE@Exemplu.ro ",password:PWD("late")}});const S2=r.cookie;ok(r.status===200&&S2,"E1b 3 passlogin cu parola buna (e-mail cu majuscule si spatii)");
r=await api("/api/app/me",{method:"GET",cookie:S2});ok(r.status===200&&r.j.id==="late"&&r.j.needCred===false,"E1b 3 sesiunea de la passlogin merge, fara needCred");
const b1=await api("/api/app/passlogin",{body:{email:"late@exemplu.ro",password:"parola-gresita"}});
const b2=await api("/api/app/passlogin",{body:{email:"nimeni@exemplu.ro",password:"parola-gresita"}});
ok(b1.status===400&&b2.status===400&&b1.j.error==="E-mail sau parolă greșită."&&JSON.stringify(b1.j)===JSON.stringify(b2.j)&&!b1.cookie,"E1b 3 parola gresita si e-mail necunoscut: acelasi 400");
r=await api("/api/app/passlogin",{body:{}});ok(r.status===400,"E1b 3 fara date: 400");
// 5 schimbarea
r=await api("/api/app/setcred",{cookie:LATE,body:{email:"late2@exemplu.ro",password:"Pw!late-two-2"}});ok(r.status===403,"E1b 5 schimbare fara current: 403");
r=await api("/api/app/setcred",{cookie:LATE,body:{email:"late2@exemplu.ro",password:"Pw!late-two-2",current:"gresita-gresita"}});ok(r.status===403,"E1b 5 current gresit: 403");
r=await api("/api/app/setcred",{cookie:LATE,body:{email:CRED[nat].email,password:"Pw!late-two-2",current:PWD("late")}});ok(r.status===400,"E1b 5 e-mail folosit de alt cont: 400");
r=await api("/api/app/setcred",{cookie:LATE,body:{email:"late@exemplu.ro",password:"scurta",current:PWD("late")}});ok(r.status===400,"E1b 5 parola noua prea scurta: 400");
r=await api("/api/app/setcred",{cookie:LATE,body:{email:"late@exemplu.ro",password:"Pw!late-two-2",current:PWD("late")}});ok(r.status===200,"E1b 5 schimbarea parolei cu current bun");
const oldLate=CRED.late.password;CRED.late.password="Pw!late-two-2";
r=await api("/api/app/passlogin",{body:{email:"late@exemplu.ro",password:oldLate}});ok(r.status===400,"E1b 5 vechea parola nu mai merge");
r=await api("/api/app/passlogin",{body:CRED.late});ok(r.status===200,"E1b 5 noua parola merge");
r=await api("/api/app/me",{method:"GET",cookie:S2});ok(r.status===401,"E1b 5 celelalte sesiuni se inchid la schimbare");
r=await api("/api/app/me",{method:"GET",cookie:LATE});ok(r.status===200,"E1b 5 sesiunea curenta ramane");
r=await api("/api/app/setcred",{cookie:LATE,body:{email:"late3@exemplu.ro",password:PWD("late"),current:PWD("late")}});ok(r.status===200,"E1b 5 schimbare doar a e-mailului");
r=await api("/api/app/passlogin",{body:{email:"late3@exemplu.ro",password:PWD("late")}});ok(r.status===200,"E1b 5 intra cu noul e-mail");
r=await api("/api/app/passlogin",{body:{email:"late@exemplu.ro",password:PWD("late")}});ok(r.status===400,"E1b 5 vechiul e-mail nu mai merge");
CRED.late.email="late3@exemplu.ro";
// 3 limitarea
env.DB._db.exec("DELETE FROM rate_log");
{const codes=[];for(let i=0;i<8;i++)codes.push((await api("/api/app/passlogin",{body:{email:CRED.hugo.email,password:"gresita-"+i}})).status);
 ok(codes.every(c=>c===400),"E1b 3 primele 8 esecuri pe cont: 400");}
r=await api("/api/app/passlogin",{body:{email:CRED.hugo.email,password:"gresita-9"}});ok(r.status===429,"E1b 3 dupa 8 esecuri pe cont: 429");
r=await api("/api/app/passlogin",{body:CRED.hugo});ok(r.status===429,"E1b 3 contul blocat nu intra nici cu parola buna");
{const ips=env.DB._db.prepare("SELECT ip FROM rate_log WHERE bucket='appacct'").all();ok(ips.length===8&&ips.every(x=>/^[a-f0-9]{64}$/.test(x.ip)),"E1b 3 pe cont se tine amprenta e-mailului, nu e-mailul");}
env.DB._db.exec("DELETE FROM rate_log");
{const st=[];for(let i=0;i<10;i++)st.push((await api("/api/app/passlogin",{body:{email:"n"+i+"@exemplu.ro",password:"gresita-gresita"}})).status);
 ok(st.every(c=>c===400),"E1b 3 10 esecuri de la aceeasi adresa, pe conturi diferite: 400");}
r=await api("/api/app/passlogin",{body:{email:"n99@exemplu.ro",password:"gresita-gresita"}});ok(r.status===429,"E1b 3 al 11-lea esec de la aceeasi adresa: 429");
env.DB._db.exec("DELETE FROM rate_log");
// 6 resetAccess
{const bobOld=CRED.bob;
 r=await A(ANA2,{op:"resetAccess",memberId:"bob"});ok(r.status===200&&r.j.ok&&r.j.memberId==="bob"&&r.j.code&&r.j.expires,"E1b 6 presedintele reseteaza accesul unui membru al lui");
 const codeR=r.j.code;
 r=await api("/api/app/passlogin",{body:bobOld});ok(r.status===400,"E1b 6 vechea parola nu mai merge");
 r=await api("/api/app/me",{method:"GET",cookie:BOB});ok(r.status===401,"E1b 6 vechea sesiune nu mai merge");
 r=await api("/api/app/login",{body:{code:codeR}});const BOB2=r.cookie;ok(r.status===200&&r.j.needCred===true,"E1b 6 codul nou merge si cere din nou setcred");
 r=await api("/api/app/pull",{cookie:BOB2,body:{paths:["badges"]}});ok(r.status===403&&r.j.needCred===true,"E1b 6 pana la setcred: 403 needCred");
 r=await api("/api/app/login",{body:{code:codeR}});ok(r.status===400,"E1b 6 codul nu se refoloseste");
 r=await api("/api/app/setcred",{cookie:BOB2,body:{email:bobOld.email,password:"Pw!bob-nou-1"}});ok(r.status===200,"E1b 6 membrul isi pune din nou e-mail si parola (acelasi e-mail e liber dupa resetare)");
 r=await api("/api/app/passlogin",{body:{email:bobOld.email,password:"Pw!bob-nou-1"}});ok(r.status===200,"E1b 6 intra cu noua parola");
 r=await api("/api/app/passlogin",{body:bobOld});ok(r.status===400,"E1b 6 vechea parola ramane inutilizabila");
 r=await A(BOB2,{op:"resetAccess",memberId:"dan"});ok(r.status===403,"E1b 6 membrul simplu nu reseteaza nimic");}
r=await A(ANA2,{op:"resetAccess",memberId:"cora"});ok(r.status===404,"E1b 6 resetAccess pentru un membru din alta filiala: 404");
r=await A(ANA2,{op:"resetAccess",memberId:ana});ok(r.status===403,"E1b 6 presedintele nu isi reseteaza singur accesul");
r=await A(ANA2,{op:"resetAccess"});ok(r.status===400,"E1b 6 resetAccess fara tinta: 400");
r=await A(TIM,{op:"resetAccess",memberId:"hugo"});ok(r.status===403,"E1b 6 trezorierul nu reseteaza accesul");
r=await A(CORA,{op:"resetAccess",memberId:"bob"});ok(r.status===403,"E1b 6 national nu reseteaza accesul unui membru simplu");
r=await A(CORA,{op:"resetAccess",memberId:"cora"});ok(r.status===403,"E1b 6 national nu isi reseteaza propriul acces");
r=await A(ANA2,{op:"resetAccess",memberId:"hugo"});ok(r.status===200&&r.j.code,"E1b 6 presedintele reseteaza accesul unui trezorier/membru");
r=await A(CORA,{op:"resetAccess",memberId:ana});ok(r.status===200&&r.j.code,"E1b 6 national reseteaza accesul unui presedinte");
r2=await api("/api/app/me",{method:"GET",cookie:ANA2});ok(r2.status===401,"E1b 6 sesiunea presedintelui s-a inchis");
ANA2=await login(r.j.code);ok(!!ANA2,"E1b 6 presedintele reintra cu codul nou");
r=await A(MOD,{op:"resetAccess",memberId:"cora"});ok(r.status===200&&r.j.code,"E1b 6 mod reseteaza accesul presedintelui national");
r2=await api("/api/app/me",{method:"GET",cookie:CORA});ok(r2.status===401,"E1b 6 sesiunea nationalului s-a inchis");
CORA=await login(r.j.code);ok(!!CORA,"E1b 6 nationalul reintra cu codul nou");
{const au=(await PULL(ANA2,["audit"])).data.audit;ok(au.some(a=>a.action==="resetAccess"&&a.docId==="bob"&&a.path==="branches/Brașov/members"&&a.summary==="Acces resetat: Bob Membru"&&a.branch==="Brașov"),"E1b 6 resetarea unui membru ramane in jurnalul filialei");
 const am=(await PULL(MOD,["audit"])).data.audit;ok(am.some(a=>a.action==="resetAccess"&&a.docId==="cora"&&a.path==="roles")&&am.some(a=>a.action==="resetAccess"&&a.docId===ana&&a.path==="roles")&&!am.some(a=>a.action==="resetAccess"&&a.docId==="bob"),"E1b 6 resetarea unui presedinte sau national e in jurnalul de structura, a unui membru nu");}
// 7 parolele nu apar nicaieri
ok(LOG.length>200&&LOG.every(x=>!x.includes("Pw!")),"E1b 7 nicio parola in raspunsurile serverului");
{const docs=env.DB._db.prepare("SELECT data FROM app_docs").all().map(x=>x.data).join("\n");ok(!docs.includes("Pw!"),"E1b 7 nicio parola in documente si in jurnal");
 const auth=env.DB._db.prepare("SELECT * FROM app_auth").all();
 ok(auth.length>5&&auth.every(x=>x.iter===20000&&/^[a-f0-9]{32}$/.test(x.salt)&&/^[a-f0-9]{64}$/.test(x.hash)&&!JSON.stringify(x).includes("Pw!")),"E1b 7 app_auth: doar sare, amprenta PBKDF2 si numarul de iteratii");
 ok(new Set(auth.map(x=>x.salt)).size===auth.length,"E1b 7 sare diferita pe cont");
 const hr=auth.find(x=>x.member_id==="late");ok(hr&&pbkdf2Sync(PWD("late"),Buffer.from(hr.salt,"hex"),20000,32,"sha256").toString("hex")===hr.hash,"E1b 7 amprenta este PBKDF2-SHA256 cu 20000 de iteratii");
 ok(!JSON.stringify(env.DB._db.prepare("SELECT * FROM app_sessions").all()).includes("Pw!"),"E1b 7 nici in sesiuni");}
// ======= E3: evenimente si participare
const EVP="branches/Brașov/events",ATP="branches/Brașov/attend",BPP="branches/Brașov/polls";
const past=addM(T,-1),fut=addM(T,2);
const MIA=await addM2(ANA2,"mia","Mia Membru","Brașov",true),NIC=await addM2(ANA2,"nic","Nic Membru","Brașov",true),OLI=await addM2(ANA2,"oli","Oli Membru","Brașov",true);
const CLU1=await addM2(PCLUJ,"clu1","Clu Membru","Cluj",true);
r=await A(ANA2,{op:"setRole",memberId:"bea",role:"board",title:"Vicepreședinte proiecte"});ok(r.status===200,"E3 pregatire: bea board");
const evBody=(o)=>Object.assign({title:"Intalnire lunara",date:past,place:"Brasov",note:"Sala mare"},o||{});
r=await W(ANA2,EVP,"ev1",evBody({createdBy:"hack",createdAt:"2000-01-01"}));ok(r.status===200,"E3 1 presedintele creeaza eveniment");
r=await W(BEA,EVP,"ev2",evBody({title:"Atelier de vara",date:fut}));ok(r.status===200,"E3 1 board creeaza eveniment");
r=await W(BEA,EVP,"ev1",evBody({note:"Sala mica"}));ok(r.status===200,"E3 1 board modifica evenimentul");
rows=await PULL(MIA,[EVP]);{const e1=rows.data[EVP].find(x=>x.id==="ev1");ok(rows.data[EVP].length===2&&e1.createdBy===ana&&e1.createdAt!=="2000-01-01"&&e1.note==="Sala mica","E3 1 createdBy si createdAt pune serverul si le pastreaza la modificare");}
r=await W(TIM,EVP,"ev9",evBody());ok(r.status===403,"E3 1 trezorierul nu scrie evenimente");
r=await W(MIA,EVP,"ev9",evBody());ok(r.status===403,"E3 1 membrul simplu nu scrie evenimente");
r=await W(PCLUJ,EVP,"ev9",evBody());ok(r.status===403,"E3 1 presedintele altei filiale nu scrie evenimente");
r=await W(CORA,EVP,"ev9",evBody());ok(r.status===403,"E3 1 nationalul (alta filiala) nu scrie evenimente");
r=await W(MOD,EVP,"ev9",evBody());ok(r.status===403,"E3 1 mod nu scrie evenimente");
r=await W(ANA2,EVP,"ev1",null,true);ok(r.status===403,"E3 1 evenimentele nu se sterg");
for(const [nm,o] of [["titlu scurt",{title:"A"}],["titlu lung",{title:"x".repeat(121)}],["data gresita",{date:"2026-13-45"}],["data in alt format",{date:"12.11.2026"}],["loc prea lung",{place:"x".repeat(121)}],["descriere prea lunga",{note:"x".repeat(501)}],["cancelled nebooleana",{cancelled:"da"}]]){
  r=await W(ANA2,EVP,"ev9",evBody(o));ok(r.status===400,"E3 1 eveniment invalid respins: "+nm);
}
r=await W(ANA2,EVP,"ev3",evBody({title:"Eveniment anulat",cancelled:true}));ok(r.status===200,"E3 1 eveniment anulat prin cancelled");
rows=await PULL(MOD,[EVP]);ok(rows.errors[EVP]===403,"E3 1 mod nu citeste evenimentele");
rows=await PULL(CLU1,[EVP]);ok(rows.errors[EVP]===403,"E3 1 membrul altei filiale nu citeste evenimentele");
rows=await PULL(CORA,[EVP,"branches/Cluj/events"]);ok(rows.errors[EVP]===403&&Array.isArray(rows.data["branches/Cluj/events"]),"E3 1 nationalul citeste doar evenimentele filialei lui");
for(const [nm,ck] of [["membru",MIA],["trezorier",TIM],["board",BEA],["presedinte",ANA2]]){rows=await PULL(ck,[EVP]);ok(Array.isArray(rows.data[EVP])&&rows.data[EVP].length===3,"E3 1 "+nm+" citeste evenimentele filialei");}
// participare
const att=(e,m,o)=>Object.assign({eventId:e,memberId:m,going:true},o||{});
const rv0=(await PULL(MIA,[EVP])).rev;
r=await W(MIA,ATP,"ev1_mia",att("ev1","mia",{did:"Am ajutat la sonorizare",amount:5000,by:"hack",at:"2000-01-01"}));ok(r.status===200,"E3 2 membrul scrie pentru el");
rows=await PULL(ANA2,[ATP]);{const x=rows.data[ATP].find(y=>y.id==="ev1_mia");ok(x.by==="mia"&&x.at!=="2000-01-01"&&x.amount===5000&&x.did==="Am ajutat la sonorizare","E3 2 at si by le pune serverul");}
r=await W(MIA,ATP,"ev1_nic",att("ev1","nic"));ok(r.status===403,"E3 2 membrul nu scrie pentru altul");
r=await W(MIA,ATP,"ev1_oli",att("ev1","mia"));ok(r.status===400,"E3 2 id-ul trebuie sa fie eveniment_membru");
r=await W(MIA,ATP,"ev1_mia",att("ev1","mia",{going:"da"}));ok(r.status===400,"E3 2 going nebooleana: 400");
r=await W(MIA,ATP,"ev1_mia",att("ev1","mia",{did:"x".repeat(301)}));ok(r.status===400,"E3 2 did prea lung: 400");
for(const a of [-1,1.5,"5",1e20]){r=await W(MIA,ATP,"ev1_mia",att("ev1","mia",{amount:a}));ok(r.status===400,"E3 2 suma invalida respinsa: "+String(a));}
r=await W(MIA,ATP,"nimic_mia",att("nimic","mia"));ok(r.status===400,"E3 2 eveniment inexistent: 400");
r=await W(MIA,ATP,"ev3_mia",att("ev3","mia"));ok(r.status===400,"E3 2 eveniment anulat: 400");
r=await W(BEA,ATP,"ev1_nic",att("ev1","nic",{did:"Prezent"}));ok(r.status===200,"E3 2 board consemneaza prezenta unui membru din evidenta");
r=await W(BEA,ATP,"ev1_nimeni",att("ev1","nimeni"));ok(r.status===400,"E3 2 membru care nu e in evidenta: 400");
r=await W(ANA2,ATP,"ev1_oli",att("ev1","oli",{did:"Moderator"}));ok(r.status===200,"E3 2 presedintele consemneaza prezenta");
r=await W(TIM,ATP,"ev1_nic",att("ev1","nic"));ok(r.status===403,"E3 2 trezorierul nu consemneaza pentru altul");
r=await W(TIM,ATP,"ev1_tim",att("ev1","tim"));ok(r.status===200,"E3 2 trezorierul scrie pentru el insusi");
r=await W(MIA,ATP,"ev2_mia",att("ev2","mia"));ok(r.status===200,"E3 2 participare la un eveniment viitor");
r=await W(MIA,ATP,"ev1_mia",null,true);ok(r.status===403,"E3 2 participarea nu se sterge");
r=await W(PCLUJ,ATP,"ev1_mia",att("ev1","mia"));ok(r.status===403,"E3 2 alta filiala nu scrie participare");
r=await W(MOD,ATP,"ev1_mia",att("ev1","mia"));ok(r.status===403,"E3 2 mod nu scrie participare");
r=await W(CORA,ATP,"ev1_cora",att("ev1","cora"));ok(r.status===403,"E3 2 nationalul din alta filiala nu scrie in Brasov");
{await A(ANA2,{op:"exclude",memberId:"eve"});r=await W(ANA2,ATP,"ev1_eve",att("ev1","eve"));ok(r.status===400,"E3 2 nu se consemneaza prezenta unui membru exclus");await A(ANA2,{op:"reactivate",memberId:"eve"});}
rows=await PULL(MIA,[ATP]);ok(rows.data[ATP].length===2&&rows.data[ATP].every(x=>x.memberId==="mia"&&!("name" in x)),"E3 2 membrul simplu primeste doar randurile lui");
rows=await PULL(NIC,[ATP]);ok(rows.data[ATP].length===1&&rows.data[ATP][0].memberId==="nic","E3 2 alt membru: doar randul lui");
for(const [nm,ck] of [["board",BEA],["trezorier",TIM],["presedinte",ANA2]]){rows=await PULL(ck,[ATP]);
  ok(rows.data[ATP].length===5&&rows.data[ATP].every(x=>typeof x.name==="string"&&x.name.length>0)&&rows.data[ATP].find(x=>x.id==="ev1_mia").name==="Mia Membru","E3 2 "+nm+" primeste toate randurile, cu name");}
rows=await PULL(MOD,[ATP]);ok(rows.errors[ATP]===403,"E3 2 mod nu citeste participarea");
rows=await PULL(CLU1,[ATP]);ok(rows.errors[ATP]===403,"E3 2 alta filiala nu citeste participarea");
{const ev=(await api("/api/app/pull",{cookie:MIA,body:{paths:[EVP],revs:rv0}})).j.data[EVP];ok(Array.isArray(ev),"E3 2 un rand de participare ridica revizia evenimentelor");
 const c=Object.fromEntries(ev.map(x=>[x.id,x.count]));ok(c.ev1===4&&c.ev2===1&&c.ev3===0,"E3 2 count corect pe eveniment");}
r=await W(OLI,ATP,"ev1_oli",att("ev1","oli",{going:false}));ok(r.status===200,"E3 2 retragerea se face cu going false");
rows=await PULL(MIA,[EVP]);ok(rows.data[EVP].find(x=>x.id==="ev1").count===3,"E3 2 count scade dupa retragere");
// ======= E4: voturi
const V=(ck,path,pollId,optionId)=>api("/api/app/vote",{cookie:ck,body:{path,pollId,optionId}});
const NP="polls";
const oN=[{id:"a",label:"Optiunea Alfa"},{id:"b",label:"Optiunea Beta"}];
const oB=[{id:"x",label:"Hotel Alfa"},{id:"y",label:"Hotel Beta"},{id:"z",label:"Hotel Gama"}];
const noVotes=(row)=>row.options.every(o=>!("votes" in o));
r=await W(CORA,NP,"np1",{title:"Buget national 2027",options:oN,closes:fut});ok(r.status===200,"E4 3 nationalul creeaza un vot national");
for(const [nm,ck] of [["presedinte",ANA2],["trezorier",TIM],["mod",MOD],["membru",MIA]]){r=await W(ck,NP,"npx",{title:"Vot fals",options:oN,closes:fut});ok(r.status===403,"E4 3 "+nm+" nu creeaza vot national");}
r=await W(CORA,NP,"np1",null,true);ok(r.status===403,"E4 3 voturile nu se sterg");
for(const [nm,o] of [["titlu scurt",{title:"Da?"}],["o optiune",{options:[oN[0]]}],["9 optiuni",{options:Array.from({length:9},(_,i)=>({id:"o"+i,label:"O"+i}))}],["optiuni duplicate",{options:[oN[0],oN[0]]}],["eticheta goala",{options:[oN[0],{id:"b",label:" "}]}],["eticheta lunga",{options:[oN[0],{id:"b",label:"x".repeat(81)}]}],["data gresita",{closes:"azi"}]]){
  r=await W(CORA,NP,"npx",Object.assign({title:"Intrebare valida",options:oN,closes:fut},o));ok(r.status===400,"E4 3 vot invalid respins: "+nm);}
for(const [nm,ck] of [["presedinte",ANA2],["alt presedinte",PCLUJ],["national",CORA]]){rows=await PULL(ck,[NP]);ok(Array.isArray(rows.data[NP])&&rows.data[NP].length===1,"E4 3 "+nm+" citeste voturile nationale");}
for(const [nm,ck] of [["mod",MOD],["trezorier",TIM],["board",BEA],["membru",MIA]]){rows=await PULL(ck,[NP]);ok(rows.errors[NP]===403,"E4 3 "+nm+" nu citeste voturile nationale");}
r=await V(ANA2,NP,"np1","a");ok(r.status===200&&JSON.stringify(r.j)==='{"ok":true}',"E4 3 presedintele voteaza (raspuns doar ok)");
r=await V(PCLUJ,NP,"np1","b");ok(r.status===200,"E4 3 alt presedinte voteaza");
for(const [nm,ck] of [["national",CORA],["mod",MOD],["trezorier",TIM],["membru",MIA],["board",BEA]]){r=await V(ck,NP,"np1","a");ok(r.status===403,"E4 3 "+nm+" nu voteaza la votul national");}
r=await V(ANA2,NP,"np1","b");ok(r.status===400,"E4 5 al doilea vot: 400");
r=await V(SM1,NP,"np1","zzz");ok(r.status===400,"E4 5 optiune inexistenta: 400");
r=await V(SM1,NP,"nimeni","a");ok(r.status===404,"E4 5 vot inexistent: 404");
r=await V(SM1,"branches/Nimic/polls","np1","a");ok(r.status===400,"E4 5 cale invalida: 400");
r=await V(SM1,"branches/Brașov/members","np1","a");ok(r.status===400,"E4 5 cale care nu e de voturi: 400");
r=await api("/api/app/vote",{body:{path:NP,pollId:"np1",optionId:"a"}});ok(r.status===401,"E4 vot fara sesiune: 401");
{const cn=(await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"nocr"}}));
 await addM2(ANA2,"nocr","Fara Parola","Brașov",false);const c2=(await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"nocr"}})).j.code;
 const NOCR=(await api("/api/app/login",{body:{code:c2}})).cookie;
 r=await V(NOCR,NP,"np1","a");ok(r.status===403&&r.j.needCred===true,"E4 fara e-mail si parola nu se voteaza: 403 cu needCred");
 r=await V(NOCR,BPP,"np1","a");ok(r.status===403&&r.j.needCred===true,"E4 needCred acopera si votul de filiala");}
{const rA=await PULL(ANA2,[NP]),rS=await PULL(SM1,[NP]),rC=await PULL(CORA,[NP]);
 const a=rA.data[NP][0],sm=rS.data[NP][0],c=rC.data[NP][0];
 ok(a.state==="open"&&a.mine==="a"&&a.canVote===false&&a.total===2&&a.voters===3&&noVotes(a)&&!("votedNames" in a),"E4 3 vot deschis: state, mine, canVote, total, voters, fara totaluri pe optiuni si fara votedNames");
 ok(sm.mine===""&&sm.canVote===true&&sm.total===2&&noVotes(sm),"E4 3 presedintele care n-a votat: mine gol, canVote true");
 ok(c.canVote===false&&JSON.stringify(c.votedNames)===JSON.stringify(["Ana Pres","Petru Cluj"]),"E4 6 votedNames apare doar la creator, in ordine alfabetica");
 ok(![rA,rS,rC].some(x=>JSON.stringify(x).includes('"votes"')),"E4 6 nicio raspuns nu are totaluri pe optiuni cat votul e deschis");
 ok(!JSON.stringify(rA).includes("votedNames")&&!JSON.stringify(rS).includes("votedNames"),"E4 6 votedNames nu ajunge la altcineva");}
r=await V(SM1,NP,"np1","b");ok(r.status===200,"E4 3 al treilea presedinte voteaza");
r=await W(CORA,NP,"np1",{title:"Alt titlu pentru buget",options:oN,closes:fut});ok(r.status===400,"E4 7 dupa primul vot titlul nu se schimba");
r=await W(CORA,NP,"np1",{title:"Buget national 2027",options:[oN[0],{id:"b",label:"Optiunea Gama"}],closes:fut});ok(r.status===400,"E4 7 dupa primul vot optiunile nu se schimba");
r=await W(CORA,NP,"np1",{title:"Buget national 2027",options:[oN[1],oN[0]],closes:fut});ok(r.status===400,"E4 7 nici ordinea optiunilor");
r=await W(CORA,NP,"np1",{title:"Buget national 2027",options:oN,closes:addM(T,3)});ok(r.status===200,"E4 7 closes se poate schimba dupa primul vot");
r=await W(CORA,NP,"np1",{title:"Buget national 2027",options:oN,closes:addM(T,3),closed:true});ok(r.status===200,"E4 3 creatorul inchide votul acum");
{const rA=await PULL(ANA2,[NP]),rC=await PULL(CORA,[NP]);const a=rA.data[NP][0],c=rC.data[NP][0];
 ok(a.state==="closed"&&a.canVote===false&&a.total===3&&a.mine==="a"&&a.options.find(o=>o.id==="a").votes===1&&a.options.find(o=>o.id==="b").votes===2,"E4 6 dupa inchidere apar totalurile pe optiuni");
 ok(c.votedNames.length===3&&JSON.stringify(Object.keys(c).sort())===JSON.stringify(["canVote","cancelled","closed","closes","createdAt","createdBy","id","mine","options","state","title","total","voted"+"Names","voters"].sort()),"E4 6 raspunsul creatorului: doar campurile din proiect");}
r=await W(CORA,NP,"np1",{title:"Buget national 2027",options:oN,closes:addM(T,3),closed:false});ok(r.status===400,"E4 5 un vot inchis nu se redeschide");
r=await W(CORA,NP,"np2",{title:"Vot expirat",options:oN,closes:past});ok(r.status===200,"E4 5 vot cu data de inchidere trecuta (creare)");
r=await V(SM1,NP,"np2","a");ok(r.status===400,"E4 5 vot dupa closes: 400");
rows=await PULL(SM1,[NP]);{const x=rows.data[NP].find(y=>y.id==="np2");ok(x.state==="closed"&&x.canVote===false&&x.options.every(o=>o.votes===0),"E4 5 votul expirat apare inchis, cu totaluri");}
r=await W(CORA,NP,"np3",{title:"Vot anulat din start",options:oN,closes:fut,cancelled:true});ok(r.status===200,"E4 5 vot anulat");
r=await V(SM1,NP,"np3","a");ok(r.status===400,"E4 5 vot anulat: 400");
r=await W(CORA,NP,"np4",{title:"Vot anulat dupa vot",options:oN,closes:fut});r=await V(ANA2,NP,"np4","a");ok(r.status===200,"E4 pregatire: vot in np4");
r=await W(CORA,NP,"np4",{title:"Vot anulat dupa vot",options:oN,closes:fut,cancelled:true});ok(r.status===200,"E4 5 creatorul anuleaza un vot cu voturi");
r=await V(PCLUJ,NP,"np4","a");ok(r.status===400,"E4 5 dupa anulare nu se mai voteaza");
rows=await PULL(CORA,[NP]);{const x=rows.data[NP].find(y=>y.id==="np4");ok(x.state==="closed"&&noVotes(x),"E4 6 un vot anulat nu arata totalurile pe optiuni");}
// vot de filiala
r=await W(ANA2,BPP,"bp1",{title:"Locatie adunare generala",options:oB,closes:fut});ok(r.status===200,"E4 4 presedintele filialei creeaza vot");
for(const [nm,ck] of [["alt presedinte",PCLUJ],["board",BEA],["trezorier",TIM],["membru",MIA],["national din alta filiala",CORA],["mod",MOD]]){r=await W(ck,BPP,"bpx",{title:"Vot fals aici",options:oB,closes:fut});ok(r.status===403,"E4 4 "+nm+" nu creeaza vot de filiala");}
r=await W(PCLUJ,"branches/Cluj/polls","cp1",{title:"Vot de filiala Cluj",options:oB,closes:fut});ok(r.status===200,"E4 4 presedintele Cluj creeaza vot in Cluj");
r=await W(CORA,"branches/Cluj/polls","cpx",{title:"Vot fals national",options:oB,closes:fut});ok(r.status===403,"E4 4 nationalul nu creeaza vot de filiala nici in filiala lui");
r=await W(ANA2,BPP,"bp1",null,true);ok(r.status===403,"E4 4 votul de filiala nu se sterge");
for(const [nm,ck] of [["membru",MIA],["board",BEA],["trezorier",TIM],["presedinte",ANA2]]){rows=await PULL(ck,[BPP]);ok(Array.isArray(rows.data[BPP])&&rows.data[BPP].length===1,"E4 4 "+nm+" citeste votul filialei");}
for(const [nm,ck] of [["mod",MOD],["presedinte din alta filiala",PCLUJ],["membru din alta filiala",CLU1],["national din alta filiala",CORA]]){rows=await PULL(ck,[BPP]);ok(rows.errors[BPP]===403,"E4 4 "+nm+" nu citeste votul de Brasov");}
rows=await PULL(CORA,["branches/Cluj/polls"]);ok(rows.errors["branches/Cluj/polls"]===403,"E4 4 nationalul din Cluj nu citeste votul filialei lui");
r=await V(CORA,"branches/Cluj/polls","cp1","x");ok(r.status===403,"E4 4 nationalul din filiala nu voteaza");
r=await V(ANA2,"branches/Cluj/polls","cp1","x");ok(r.status===403,"E4 4 alta filiala nu voteaza");
r=await V(CLU1,"branches/Cluj/polls","cp1","y");ok(r.status===200,"E4 4 membrul filialei voteaza (Cluj)");
r=await V(PCLUJ,"branches/Cluj/polls","cp1","x");ok(r.status===200,"E4 4 presedintele filialei voteaza si el");
rows=await PULL(CLU1,["branches/Cluj/polls"]);ok(rows.data["branches/Cluj/polls"][0].voters===2&&rows.data["branches/Cluj/polls"][0].total===2,"E4 4 voters exclude presedintele national (Cluj: pcluj si clu1)");
r=await V(MOD,BPP,"bp1","x");ok(r.status===403,"E4 4 mod nu voteaza");
for(const [ck,o] of [[MIA,"x"],[NIC,"x"],[BEA,"y"],[TIM,"z"],[ANA2,"x"]]){r=await V(ck,BPP,"bp1",o);ok(r.status===200,"E4 4 voteaza la adunarea generala: "+o);}
r=await V(MIA,BPP,"bp1","y");ok(r.status===400,"E4 5 al doilea vot de filiala: 400");
{const exp=env.DB._db.prepare("SELECT valid_until FROM app_state WHERE branch='Brașov' AND active=1 AND excluded=0").all().filter(x=>!x.valid_until||addM(x.valid_until,3)>=T).length;
 const rM=await PULL(MIA,[BPP]),rN=await PULL(NIC,[BPP]),rA=await PULL(ANA2,[BPP]);const m=rM.data[BPP][0],a=rA.data[BPP][0];
 ok(m.total===5&&m.voters===exp&&exp>5&&m.mine==="x"&&m.canVote===false&&noVotes(m),"E4 4 total, voters si mine pentru un membru, fara totaluri pe optiuni");
 ok(a.votedNames.length===5&&JSON.stringify(a.votedNames)===JSON.stringify([...a.votedNames].sort((p,q)=>p.localeCompare(q,"ro"))),"E4 6 creatorul vede cine a votat, fara optiune");
 ok(!JSON.stringify(rM).includes("votedNames")&&!JSON.stringify(rN).includes("votedNames"),"E4 6 membrii nu primesc votedNames");}
r=await W(ANA2,BPP,"bp1",{title:"Alta locatie pentru adunare",options:oB,closes:fut});ok(r.status===400,"E4 7 vot de filiala: titlul nu se schimba dupa primul vot");
r=await W(ANA2,BPP,"bp1",{title:"Locatie adunare generala",options:oB.slice(0,2),closes:fut});ok(r.status===400,"E4 7 vot de filiala: optiunile nu se schimba dupa primul vot");
r=await W(ANA2,BPP,"bp1",{title:"Locatie adunare generala",options:oB,closes:fut,closed:true});ok(r.status===200,"E4 4 presedintele inchide votul filialei");
r=await V(OLI,BPP,"bp1","y");ok(r.status===400,"E4 5 vot pe vot inchis: 400");
rows=await PULL(OLI,[BPP]);{const x=rows.data[BPP][0];ok(x.state==="closed"&&x.canVote===false&&x.mine===""&&x.options.find(o=>o.id==="x").votes===3&&x.options.find(o=>o.id==="y").votes===1&&x.options.find(o=>o.id==="z").votes===1,"E4 6 dupa inchidere un membru vede totalurile (3, 1, 1)");}
// votul secret: nicaieri nu se leaga un om de optiune
ok(!env.DB._db.prepare("SELECT path, data FROM app_docs").all().some(x=>!/(^polls$|\/polls$)/.test(x.path)&&/Optiunea (Alfa|Beta)|Hotel (Alfa|Beta|Gama)/.test(x.data)),"E4 6 nicio optiune aleasa in jurnal sau in alte documente");
ok(!env.DB._db.prepare("SELECT data FROM app_docs WHERE path='audit'").all().some(x=>/vot/i.test(x.data)),"E4 6 votul nu se scrie in jurnal");
ok(env.DB._db.prepare("SELECT COUNT(*) c FROM app_votes").get().c===11,"E4 6 voturile sunt in app_votes (3 + 1 + 2 + 5)");
{const polls=LOG.filter(x=>x.includes('"state":"open"')||x.includes('"state":"closed"')).map(x=>JSON.parse(x));
 const rowsAll=polls.flatMap(x=>Object.values(x.data||{})).flat().filter(x=>x&&x.state);
 ok(rowsAll.length>20&&rowsAll.every(x=>!("voter" in x)&&!("voterId" in x)&&!("votes_by" in x)&&(!x.votedNames||x.createdBy)),"E4 6 niciun raspuns de pull nu are camp care sa lege un om de o optiune");}
// limitarea incercarilor gresite: doar esecurile se numara
env.DB._db.exec("DELETE FROM rate_log");
const cg=(await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"dan"}})).j.code;
for(let i=0;i<9;i++)await api("/api/app/login",{body:{code:"AAAA-BBBB-CC"+String(10+i)}});
r=await api("/api/app/login",{body:{code:cg}});ok(r.status===200,"dupa 9 esecuri, un cod bun inca intra");
ok(env.DB._db.prepare("SELECT COUNT(*) c FROM rate_log WHERE bucket='applogin'").get().c===9,"intrarea reusita nu se numara la limita");
await api("/api/app/login",{body:{code:"AAAA-BBBB-CC99"}});
r=await api("/api/app/login",{body:{code:"AAAA-BBBB-CC98"}});ok(r.status===429,"dupa 10 esecuri intr-o ora: 429");
for(let i=0;i<5;i++)await api("/api/app/modlogin",{body:{key:"gresit-gresit-"+i}});
r=await api("/api/app/modlogin",{body:{key:KEY}});ok(r.status===429,"cheia moderatorului: blocare dupa 5 esecuri");
console.log(`\n${n-fails}/${n} ok, ${fails} esecuri`);
