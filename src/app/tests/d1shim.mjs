import { DatabaseSync } from "node:sqlite";
export function makeD1(){
  const db=new DatabaseSync(":memory:");
  const mk=(sql,params=[])=>({
    bind:(...p)=>mk(sql,p),
    first:async()=>{const r=db.prepare(sql).get(...params);return r?{...r}:null},
    all:async()=>({results:db.prepare(sql).all(...params).map(r=>({...r}))}),
    run:async()=>{const r=db.prepare(sql).run(...params);return{meta:{changes:Number(r.changes)}}},
    _sql:sql,_params:params
  });
  return{prepare:(s)=>mk(s),batch:async(list)=>{for(const x of list)db.prepare(x._sql).run(...x._params);return[]},_db:db};
}
