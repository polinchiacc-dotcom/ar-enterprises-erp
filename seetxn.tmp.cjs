const https=require('https');
global.n={jsx:(t,p)=>({t,p}),jsxs:(t,p)=>({t,p})};
global.E={useState:v=>[v,fn=>[v,typeof fn==='function'?x=>x:undefined]][0],useEffect:()=>{},useMemo:f=>f()};
global.E={useState:v=>[v,()=>{}],useEffect:()=>{},useMemo:f=>f()};
global.xe=()=>({t:x=>x,lang:'ta'});global.Ue=()=>(()=>{});
global.gvizFetch=(id,tab,cb,tq)=>{
 const gid=/^gid:/.test(tab)?tab.slice(4):'';
 const u='https://docs.google.com/spreadsheets/d/'+id+'/gviz/tq?tqx=out:json'+(gid?'&gid='+gid:'&sheet='+encodeURIComponent(tab))+(tq?'&tq='+encodeURIComponent(tq):'')+'&headers=0';
 https.get(u,{headers:{'User-Agent':'Mozilla/5.0'}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{const j=d.indexOf('('),k=d.lastIndexOf(')');cb(null,JSON.parse(d.slice(j+1,k)))}catch(e){cb('parse')}})}).on('error',()=>cb('net'))};
global.EyRawRows=d=>(d.table.rows||[]).map(r=>(r.c||[]).map(c=>!c?'':(c.v==null?'':String(c.v))));
eval(require('fs').readFileSync('vb-pages.js','utf8'));
EyTxFetch(t=>{
 const bySrc={};
 t.rows.forEach(x=>{(bySrc[x.src]=bySrc[x.src]||[]).push(x)});
 for(const s in bySrc){
  console.log('=== '+s+' : '+bySrc[s].length+' rows, Σ₹'+bySrc[s].reduce((a,x)=>a+x.amt,0).toLocaleString('en-IN'));
  bySrc[s].slice(0,4).forEach(x=>console.log('   ',JSON.stringify({d:x.d,de:x.de.slice(0,60),cat:x.cat,amt:x.amt})));
 }
 process.exit(0);
});
