import { makeD1 } from "./d1shim.mjs";
import { handleApp } from "../../../worker/app.js";
import { createHash } from "node:crypto";
let fails=0,n=0;const ok=(c,m)=>{n++;if(!c){fails++;console.log("ESEC:",m)}else console.log("ok  :",m)};
const env={DB:makeD1()};
env.DB._db.exec("CREATE TABLE setari (cheie TEXT PRIMARY KEY, valoare TEXT)");
env.DB._db.exec("CREATE TABLE rate_log (id INTEGER PRIMARY KEY AUTOINCREMENT, bucket TEXT, ip TEXT, creat TEXT DEFAULT CURRENT_TIMESTAMP)");
const salt="s4lt",KEY="Cheia-Moderator-12345";
const hash=createHash("sha256").update(salt+":"+KEY).digest("hex");
env.DB._db.prepare("INSERT INTO setari VALUES ('app_mod_salt',?),('app_mod_hash',?)").run(salt,hash);
const ORI="https://jci-brasov.com";
let calls=0;const overLimit=async()=>false;
async function api(path,{method="POST",body,cookie,origin=ORI}={}){
  const headers={"Content-Type":"application/json"};if(origin)headers.Origin=origin;if(cookie)headers.Cookie=cookie;
  const req=new Request(ORI+path,{method,headers,body:body?JSON.stringify(body):undefined});
  const r=await handleApp(req,env,new URL(req.url),overLimit);
  const sc=r.headers.get("Set-Cookie");const j=await r.json();
  return{status:r.status,j,cookie:sc?sc.split(";")[0]:null,sc};
}
const T=new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Bucharest"});
const addM=(d,n)=>{const x=new Date(d+"T12:00:00Z");x.setUTCMonth(x.getUTCMonth()+n);return x.toISOString().slice(0,10)};
const Y=T.slice(0,4);
// --- moderator
let r=await api("/api/app/modlogin",{body:{key:"gresit-gresit-1"}});ok(r.status===400,"cheie moderator gresita respinsa");
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
const login=async(code)=>(await api("/api/app/login",{body:{code}})).cookie;
// 1. mod numeste presedintele national (in Brasov, ca sa poata fi tinta unor refuzuri)
r=await A(MOD,{op:"setNational",branch:"Brașov",name:"Nina Națională"});
ok(r.status===200&&r.j.ok&&r.j.branch==="Brașov"&&/^[A-Z2-9]{12}$/.test(r.j.code)&&r.j.expires&&r.j.memberId,"mod: setNational merge si intoarce cod");
const nat=r.j.memberId;const NAT=await login(r.j.code);ok(!!NAT,"presedintele national intra cu codul primit");
r=await api("/api/app/me",{method:"GET",cookie:NAT});ok(r.j.role==="national"&&r.j.title==="Președinte național"&&r.j.id===nat,"me: role si title pentru national");
// 2. national numeste presedinti de filiala
r=await A(NAT,{op:"setPresident",branch:"Brașov",name:"Ana Pres"});ok(r.status===200&&r.j.code&&r.j.branch==="Brașov","national: setPresident cu nume nou (Brasov)");
const ana=r.j.memberId;const codeAna=r.j.code;
r=await A(NAT,{op:"setPresident",branch:"Cluj",name:"Petru Cluj"});ok(r.status===200&&r.j.code,"national: setPresident (Cluj)");
const pcluj=r.j.memberId;const PCLUJ=await login(r.j.code);
r=await A(MOD,{op:"setPresident",branch:"Nicaieri",name:"X Y"});ok(r.status===400,"filiala invalida respinsa");
// membri adaugati de presedinti
r=await api("/api/app/login",{body:{code:"AAAAAAAAAAAA"}});ok(r.status===400,"cod gresit respins");
r=await api("/api/app/login",{body:{code:codeAna.slice(0,4)+"-"+codeAna.slice(4,8).toLowerCase()+" "+codeAna.slice(8)}});ok(r.status===200&&r.cookie,"cod cu separatori si litere mici accepta");
const ANA=r.cookie;
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
r=await api("/api/app/login",{body:{code:codeBob}});const BOB=r.cookie;ok(r.status===200,"membru intra cu cod");
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
r=await api("/api/app/code",{cookie:ANA,body:{branch:"Brașov",memberId:"bob"}});const codeBob2=r.j.code;
r=await api("/api/app/login",{body:{code:codeBob2}});ok(r.status===403&&r.j.excluded&&r.j.reason==="expired","exclusul nu intra nici cu cod nou");
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
const CORA=globalThis.CORA;const cora="cora";
// presedintele revine dupa delogare, cu cod de la presedintele national
r=await api("/api/app/logout",{cookie:ANA});ok(r.status===200&&/Max-Age=0/.test(r.sc),"logout");
r=await api("/api/app/me",{method:"GET",cookie:ANA});ok(r.status===401,"sesiune inchisa");
r=await A(MOD,{op:"leaderCode",memberId:ana});ok(r.status===200&&r.j.code&&r.j.memberId===ana,"mod: leaderCode pentru presedinte");
const ANA2=await login(r.j.code);ok(!!ANA2,"presedintele revine cu codul nou");
r=await A(NAT,{op:"leaderCode",memberId:ana});ok(r.status===200&&r.j.code,"national: leaderCode pentru presedinte");
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
const TIM=cks[6];
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
r=await A(MOD,{op:"leaderCode",memberId:nat});ok(r.status===200&&r.j.code,"1 mod: leaderCode pentru presedintele national");
r=await A(MOD,{op:"leaderCode",memberId:"tim"});ok(r.status===403,"1 mod: leaderCode nu merge pentru trezorier");
r=await A(MOD,{op:"leaderCode",memberId:"nimeni"});ok(r.status===404,"leaderCode pentru persoana inexistenta: 404");
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
r=await A(NAT,{op:"leaderCode",memberId:nat});ok(r.status===403,"2 national nu da cod pentru national");
r=await A(NAT,{op:"leaderCode",memberId:"tim"});ok(r.status===403,"2 national nu da cod pentru trezorier");
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
r=await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"eve"}});const codeEve=r.j.code;
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
r=await api("/api/app/login",{body:{code:codeEve}});ok(r.status===400,"8 codul nefolosit a fost sters la excludere");
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
r=await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"eve"}});const EVE2=await login(r.j.code);ok(!!EVE2,"8 dupa reactivare intra cu cod nou");
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
{const cR=(await api("/api/app/code",{cookie:ANA2,body:{branch:"Brașov",memberId:"bob"}})).j.code;await login(cR);
 const au3=(await PULL(ANA2,["audit"])).data.audit;ok(au3.some(a=>a.action==="relogin"&&a.docId==="bob"),"12 intrarea cu un cod nou pe un cont activ ramane in jurnal");}
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
