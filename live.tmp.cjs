const https=require('https');
global.n={jsx:()=>{},jsxs:()=>{}};global.E={useState:v=>[v,()=>{}],useEffect:()=>{},useMemo:f=>f()};
global.xe=()=>({t:x=>x,lang:'ta'});global.Ue=()=>(()=>{});
global.gvizFetch=(id,tab,cb,tq)=>{
 const gid=/^gid:/.test(tab)?tab.slice(4):'';
 const u='https://docs.google.com/spreadsheets/d/'+id+'/gviz/tq?tqx=out:json'+(gid?'&gid='+gid:'&sheet='+encodeURIComponent(tab))+(tq?'&tq='+encodeURIComponent(tq):'')+'&headers=0';
 https.get(u,{headers:{'User-Agent':'Mozilla/5.0'}},r=>{
  let d='';r.on('data',c=>d+=c);r.on('end',()=>{
   try{const j=d.indexOf('('),k=d.lastIndexOf(')');cb(null,JSON.parse(d.slice(j+1,k)))}catch(e){cb('parse: '+e.message)}})
 }).on('error',e=>cb(e.message))};
global.EyRawRows=d=>(d.table.rows||[]).map(r=>(r.c||[]).map(c=>!c?'':(c.v==null?'':String(c.v))));
global.window={};
eval(require('fs').readFileSync('vb-pages.js','utf8'));
let fails=0;const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);if(!c)fails++};
EyV3Fetch(v=>{
 ok(v&&!v.err,'V3Fetch ok');
 ok(Object.keys(v.ven).length===12,'V3 vendors 12 → '+Object.keys(v.ven).length);
 ok(v.txn.length===4,'V3 txns 4 → '+v.txn.length);
 ok(v.bil.length===74,'V3 bills 74 → '+v.bil.length);
 const t1=v.txn.find(t=>t.id==='TXN-Y9WAQEQ');
 ok(t1&&t1.exp===300950&&t1.adv===5000&&t1.bal===7038&&t1.st==='Closed','TXN-Y9WAQEQ exp/adv/bal/status');
 const grp=EyV3Groups();
 ok(Object.keys(grp).length===13,'bill groups 13 → '+Object.keys(grp).length);
 ok(Math.abs(grp['TXN-Y9WAQEQ'].tot-300950.74)<0.01,'txn1 bills Σtot 300950.74 (≈expected) → '+grp['TXN-Y9WAQEQ'].tot);
 const gBil=Object.values(grp).reduce((a,g)=>a+g.tot,0);
 ok(Math.abs(gBil-5197451.22)<0.02,'Σ all bills ₹51,97,451.22 → '+gBil.toFixed(2));
 ok(Object.keys(v.g2).length>=15,'2B summary entries ≥15 → '+Object.keys(v.g2).length);
 ok(EyV3YM(t1.fy,t1.mo)==='2024-12','txn1 month key 2024-12');
 // Polinchi (Vendors page) unchanged
 EyVbFetch(s=>{
  ok(s&&!s.err&&Object.keys(s.sup).length===93,'Polinchi vendors 93 unchanged');
  ok(s.bills.length===2787,'Polinchi bills 2787 unchanged');
  console.log(fails?'FAILS '+fails:'V3 LIVE ALL PASS');
  process.exit(fails?1:0);
 });
});
