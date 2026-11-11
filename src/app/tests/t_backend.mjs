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
r=await api("/api/app/me",{method:"GET",cookie:MOD});ok(r.j.isOwner===true,"me: moderator");
r=await api("/api/app/me",{method:"GET"});ok(r.status===401,"fara cookie: 401");
r=await api("/api/app/write",{body:{path:"profiles",id:"x",data:{name:"x"}},origin:null});ok(r.status===403,"POST fara Origin respins");
r=await api("/api/app/write",{body:{path:"profiles",id:"x",data:{name:"x"}},origin:"https://evil.example",cookie:MOD});ok(r.status===403,"Origin strain respins");
// --- mod creeaza membri
const W=(cookie,path,id,data,del)=>api("/api/app/write",{cookie,body:{path,id,data,del}});
for(const [b,id,name] of [["Brașov","ana","Ana Pres"],["Brașov","tim","Tim Trez"],["Brașov","bob","Bob Membru"],["Brașov","dan","Dan Membru"],["Cluj","cora","Cora Cluj"]]){
  r=await W(MOD,`branches/${b}/members`,id,{name,branch:b,userId:"HACK",validUntil:Y+"-12-31"});ok(r.status===200,"mod adauga membru "+id);
}
let rows=await api("/api/app/pull",{cookie:MOD,body:{paths:["branches/Brașov/members"]}});
ok(rows.j.data["branches/Brașov/members"].every(x=>x.userId===""),"userId nu poate fi setat de client");
r=await W(MOD,"roles","ana",{role:"president",branch:"Brașov",since:T,until:Y+"-12-31"});ok(r.status===200,"mod atribuie presedinte");
r=await W(MOD,"roles","tim",{role:"treasurer",branch:"Brașov"});ok(r.status===200,"mod atribuie trezorier");
r=await W(MOD,"branches/Brașov/fees","f0",{memberId:"bob",year:2027,state:"platita"});ok(r.status===403,"moderatorul nu scrie cotizatii");
r=await W(MOD,"roles","dan",{role:"president",branch:"Nicaieri"});ok(r.status===400,"filiala invalida respinsa");
// --- coduri
r=await api("/api/app/code",{cookie:MOD,body:{branch:"Brașov",memberId:"ana"}});ok(r.status===200&&/^[A-Z2-9]{12}$/.test(r.j.code),"mod genereaza cod pentru presedinte");
const codeAna=r.j.code;
r=await api("/api/app/login",{body:{code:"AAAAAAAAAAAA"}});ok(r.status===400,"cod gresit respins");
r=await api("/api/app/login",{body:{code:codeAna.slice(0,4)+"-"+codeAna.slice(4,8).toLowerCase()+" "+codeAna.slice(8)}});ok(r.status===200&&r.cookie,"cod cu separatori si litere mici accepta");
const ANA=r.cookie;
r=await api("/api/app/login",{body:{code:codeAna}});ok(r.status===400,"cod folosit nu mai merge");
const dump=env.DB._db.prepare("SELECT hash FROM app_codes").all();ok(dump.every(x=>x.hash.length===64&&x.hash!==codeAna),"codurile sunt stocate doar ca amprenta");
r=await api("/api/app/me",{method:"GET",cookie:ANA});ok(r.j.id==="ana"&&r.j.state==="active","presedinte autentificat");
// --- presedinte
rows=await api("/api/app/pull",{cookie:ANA,body:{paths:["roles","badges","branches/Brașov/members","branches/Cluj/members","audit"]}});
ok(rows.j.errors["branches/Cluj/members"]===403,"presedinte Brasov nu citeste Cluj");
ok(Array.isArray(rows.j.data["branches/Brașov/members"])&&rows.j.data["branches/Brașov/members"].length===4,"presedinte citeste Brasov");
ok(rows.j.data["badges"].some(b=>b.id==="ana"&&b.verified&&b.active),"insigna calculata de server pentru presedinte");
ok(rows.j.data["audit"].some(a=>a.action==="activate"),"audit: activare");
r=await W(ANA,"branches/Cluj/fees","fx",{memberId:"cora",year:2027,state:"platita"});ok(r.status===403,"presedinte nu scrie in Cluj");
r=await W(ANA,"roles","bob",{role:"president",branch:"Brașov"});ok(r.status===403,"presedinte nu atribuie roluri");
r=await W(ANA,"branches/Brașov/fees","f1",{memberId:"bob",year:2027,due:30000,paid:0,state:"neplatita",createdAt:T});ok(r.status===200,"presedinte inregistreaza cotizatie");
r=await W(ANA,"branches/Brașov/fees","f1",null,true);ok(r.status===403,"cotizatiile nu se sterg");
r=await W(ANA,"branches/Brașov/settings","cfg",{feeDue:50000});ok(r.status===403,"presedinte nu schimba setarile");
r=await W(MOD,"branches/Brașov/settings","cfg",{feeDue:30000,opening:0});ok(r.status===200,"moderator schimba setarile");
r=await api("/api/app/code",{cookie:ANA,body:{branch:"Cluj",memberId:"cora"}});ok(r.status===403,"presedinte nu da coduri in Cluj");
r=await api("/api/app/code",{cookie:ANA,body:{branch:"Brașov",memberId:"bob"}});ok(r.status===200,"presedinte da cod in Brasov");
const codeBob=r.j.code;
r=await W(ANA,"audit","a1",{summary:"Test",path:"x",byName:"Ana",action:"update"});ok(r.status===200,"presedinte scrie in jurnal");
r=await W(ANA,"audit","a1",{summary:"Alt text"});ok(r.status===403,"jurnalul nu se rescrie");
rows=await api("/api/app/pull",{cookie:ANA,body:{paths:["audit"]}});ok(rows.j.data.audit.find(a=>a.id==="a1").by==="ana","jurnal: autorul e pus de server");
// --- membru
r=await api("/api/app/login",{body:{code:codeBob}});const BOB=r.cookie;ok(r.status===200,"membru intra cu cod");
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["branches/Brașov/fees","branches/Brașov/members","audit","roles","profiles","badges","data/users/bob","data/users/ana"]}});
ok(rows.j.errors["branches/Brașov/fees"]===403&&rows.j.errors["branches/Brașov/members"]===403&&rows.j.errors.audit===403,"membrul nu vede finante, evidenta, jurnal");
ok(rows.j.errors["data/users/ana"]===403&&!rows.j.errors["data/users/bob"],"datele private doar ale lui");
ok(Array.isArray(rows.j.data.roles)&&Array.isArray(rows.j.data.badges)&&Array.isArray(rows.j.data.profiles),"membrul vede roluri, insigne, profiluri");
r=await W(BOB,"profiles","bob",{name:"Bob",branch:"Cluj",firm:"X"});ok(r.status===200,"membrul isi scrie profilul");
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["profiles"]}});ok(rows.j.data.profiles.find(p=>p.id==="bob").branch==="Brașov","filiala profilului o pune serverul");
r=await W(BOB,"profiles","ana",{name:"Hack"});ok(r.status===403,"membrul nu scrie profilul altuia");
r=await W(BOB,"data/users/bob","contact",{phone:"1"});ok(r.status===200,"membrul scrie datele lui private");
r=await W(BOB,"data/users/ana","contact",{phone:"1"});ok(r.status===403,"membrul nu scrie datele private ale altuia");
r=await W(BOB,"roles","bob",{role:"president",branch:"Brașov"});ok(r.status===403,"membrul nu isi da rol");
r=await W(BOB,"branches/Brașov/members","dan",{name:"x"});ok(r.status===403,"membrul nu scrie in evidenta");
r=await api("/api/app/code",{cookie:BOB,body:{branch:"Brașov",memberId:"dan"}});ok(r.status===403,"membrul nu genereaza coduri");
// revizii
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["badges","roles"]}});const rv=rows.j.rev;
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["badges","roles"],revs:rv}});ok(Object.keys(rows.j.data).length===0,"fara schimbari: nimic retrimis");
r=await W(ANA,"branches/Brașov/fees","f2",{memberId:"dan",year:Number(Y),state:"platita",paid:30000,due:30000});
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["badges"],revs:rv}});ok(rows.j.data.badges!==undefined,"dupa o plata, insigne retrimise");
// --- excludere
const old=addM(T,-4);
let m=(await api("/api/app/pull",{cookie:ANA,body:{paths:["branches/Brașov/members"]}})).j.data["branches/Brașov/members"].find(x=>x.id==="bob");
const {id:_i,...mo}=m;
r=await W(ANA,"branches/Brașov/members","bob",{...mo,validUntil:old});ok(r.status===200,"presedinte seteaza valabilitate veche");
// plata anulata nu conteaza; cotizatia f1 e neplatita
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["badges"]}});ok(rows.status===403&&rows.j.excluded===true,"membru expirat de peste 3 luni: exclus de server");
r=await api("/api/app/me",{method:"GET",cookie:BOB});ok(r.status===403&&r.j.excluded&&r.j.validUntil===old,"me: exclus cu data expirarii");
rows=await api("/api/app/pull",{cookie:ANA,body:{paths:["profiles"]}});ok(!rows.j.data.profiles.some(p=>p.id==="bob"),"profilul excluditului dispare din director");
r=await api("/api/app/code",{cookie:ANA,body:{branch:"Brașov",memberId:"bob"}});const codeBob2=r.j.code;
r=await api("/api/app/login",{body:{code:codeBob2}});ok(r.status===403&&r.j.excluded,"exclusul nu intra nici cu cod nou");
// reactivare prin plata
r=await W(ANA,"branches/Brașov/fees","f1",{memberId:"bob",year:2027,due:30000,paid:30000,state:"platita",createdAt:T});
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["badges"]}});ok(rows.status===200,"dupa plata, accesul revine");
// grace
const grace=addM(T,-1);
r=await W(ANA,"branches/Brașov/fees","f1",{memberId:"bob",year:2027,due:30000,paid:0,state:"anulata",anulat:true,createdAt:T});
r=await W(ANA,"branches/Brașov/members","bob",{...mo,validUntil:grace});
rows=await api("/api/app/pull",{cookie:BOB,body:{paths:["badges"]}});ok(rows.status===200&&rows.j.data.badges.find(b=>b.id==="bob").active===false&&rows.j.data.badges.find(b=>b.id==="bob").excluded===false,"in grace: acces, insigna inactiva");
// donatii: donator ascuns pentru non-scriitori
await W(ANA,"branches/Brașov/donations","d1",{donor:"Firma X",anonymous:false,amount:1000,branch:"Brașov"});
await W(ANA,"branches/Brașov/donations","d2",{donor:"Ion",anonymous:true,amount:500,branch:"Brașov"});
let d=(await api("/api/app/pull",{cookie:MOD,body:{paths:["branches/Brașov/donations"]}})).j.data["branches/Brașov/donations"];
ok(d.find(x=>x.id==="d1").donor===""&&d.find(x=>x.id==="d2").donor==="Anonim","moderatorul nu primeste numele donatorilor");
d=(await api("/api/app/pull",{cookie:ANA,body:{paths:["branches/Brașov/donations"]}})).j.data["branches/Brașov/donations"];
ok(d.find(x=>x.id==="d1").donor==="Firma X","presedintele filialei vede donatorii");
// confidentialitate intre membri si intre filiale
{
  const cc=(await api("/api/app/code",{cookie:MOD,body:{branch:"Cluj",memberId:"cora"}})).j.code;
  const CORA=(await api("/api/app/login",{body:{code:cc}})).cookie;ok(!!CORA,"membru din Cluj intra cu cod generat de moderator");
  await W(CORA,"profiles","cora",{name:"Cora Cluj",firm:"Cora SRL",consent:{directory:false}});
  await W(BOB,"profiles","bob",{name:"Bob",firm:"X",consent:{directory:false}});
  let pr=(await api("/api/app/pull",{cookie:BOB,body:{paths:["profiles"]}})).j.data.profiles;
  ok(pr.some(x=>x.id==="bob")&&!pr.some(x=>x.id==="cora"),"fara acord de director, profilul nu ajunge la alti membri");
  pr=(await api("/api/app/pull",{cookie:ANA,body:{paths:["profiles"]}})).j.data.profiles;
  ok(pr.some(x=>x.id==="bob")&&!pr.some(x=>x.id==="cora"),"presedintele vede profilurile fara acord doar din filiala lui");
  pr=(await api("/api/app/pull",{cookie:MOD,body:{paths:["profiles"]}})).j.data.profiles;
  ok(pr.some(x=>x.id==="bob")&&pr.some(x=>x.id==="cora"),"moderatorul vede toate profilurile");
  await W(CORA,"profiles","cora",{name:"Cora Cluj",firm:"Cora SRL",consent:{directory:true}});
  pr=(await api("/api/app/pull",{cookie:BOB,body:{paths:["profiles"]}})).j.data.profiles;
  ok(pr.some(x=>x.id==="cora"),"cu acord de director, profilul apare la ceilalti membri");
  let bg=(await api("/api/app/pull",{cookie:BOB,body:{paths:["badges"]}})).j.data.badges;
  ok(typeof bg.find(x=>x.id==="bob").validUntil==="string"&&bg.filter(x=>x.id!=="bob").every(x=>!("validUntil" in x)),"membrul vede data de valabilitate doar la propria insigna");
  bg=(await api("/api/app/pull",{cookie:ANA,body:{paths:["badges"]}})).j.data.badges;
  ok("validUntil" in bg.find(x=>x.id==="bob")&&!("validUntil" in bg.find(x=>x.id==="cora")),"presedintele vede valabilitatea doar in filiala lui");
  let au=(await api("/api/app/pull",{cookie:ANA,body:{paths:["audit"]}})).j.data.audit;
  ok(au.length>0&&au.every(a=>a.by==="ana"||String(a.path).startsWith("branches/Brașov/")),"jurnalul presedintelui: doar filiala lui si actiunile proprii");
  au=(await api("/api/app/pull",{cookie:MOD,body:{paths:["audit"]}})).j.data.audit;
  ok(au.some(a=>String(a.path).startsWith("branches/Cluj/")),"jurnalul moderatorului: toate filialele");
}
// sesiuni
r=await api("/api/app/logout",{cookie:ANA});console.log("LOGOUT",r.status,JSON.stringify(r.j),r.sc);ok(r.status===200&&/Max-Age=0/.test(r.sc),"logout");
r=await api("/api/app/me",{method:"GET",cookie:ANA});ok(r.status===401,"sesiune inchisa");
let cks=[];for(let i=0;i<7;i++){const c=(await api("/api/app/code",{cookie:MOD,body:{branch:"Brașov",memberId:"tim"}})).j.code;const l=await api("/api/app/login",{body:{code:c}});cks.push(l.cookie)}
const alive=[];for(const c of cks){alive.push((await api("/api/app/me",{method:"GET",cookie:c})).status===200)}
ok(alive.filter(Boolean).length===5&&!alive[0]&&!alive[1],"maxim 5 sesiuni active, cele vechi se inchid");
ok(env.DB._db.prepare("SELECT COUNT(*) c FROM app_codes WHERE member_id='tim' AND used IS NULL").get().c===0,"coduri folosite marcate");
// cod expirat
const ce=(await api("/api/app/code",{cookie:MOD,body:{branch:"Brașov",memberId:"dan"}})).j.code;
env.DB._db.prepare("UPDATE app_codes SET expires=?").run(addM(T,-1));
r=await api("/api/app/login",{body:{code:ce}});ok(r.status===400,"cod expirat respins");
// cai invalide
rows=await api("/api/app/pull",{cookie:MOD,body:{paths:["../../x","branches/Altceva/members","branches/Brașov/codes","claims"]}});
ok(rows.j.errors["../../x"]===400&&rows.j.errors["branches/Altceva/members"]===400&&Array.isArray(rows.j.data["branches/Brașov/codes"]),"cai invalide respinse, codurile nu se expun");
r=await W(MOD,"branches/Brașov/members","big",{name:"A",x:"y".repeat(7000)});ok(r.status===400,"document prea mare respins");
r=await W(MOD,"badges","bob",{verified:true});ok(r.status===403,"insignele nu se scriu de client");
// limitarea incercarilor gresite: doar esecurile se numara
env.DB._db.exec("DELETE FROM rate_log");
const cg=(await api("/api/app/code",{cookie:MOD,body:{branch:"Brașov",memberId:"dan"}})).j.code;
for(let i=0;i<9;i++)await api("/api/app/login",{body:{code:"AAAA-BBBB-CC"+String(10+i)}});
r=await api("/api/app/login",{body:{code:cg}});ok(r.status===200,"dupa 9 esecuri, un cod bun inca intra");
ok(env.DB._db.prepare("SELECT COUNT(*) c FROM rate_log WHERE bucket='applogin'").get().c===9,"intrarea reusita nu se numara la limita");
await api("/api/app/login",{body:{code:"AAAA-BBBB-CC99"}});
r=await api("/api/app/login",{body:{code:"AAAA-BBBB-CC98"}});ok(r.status===429,"dupa 10 esecuri intr-o ora: 429");
for(let i=0;i<5;i++)await api("/api/app/modlogin",{body:{key:"gresit-gresit-"+i}});
r=await api("/api/app/modlogin",{body:{key:KEY}});ok(r.status===429,"cheia moderatorului: blocare dupa 5 esecuri");
console.log(`\n${n-fails}/${n} ok, ${fails} esecuri`);
