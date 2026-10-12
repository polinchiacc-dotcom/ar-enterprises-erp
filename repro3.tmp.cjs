const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs');
const bundle=fs.readFileSync('v4/public/assets/index-CHTAzd11.js','utf8');
const vc=new VirtualConsole();
vc.on('error',(...a)=>{const e=a.find(x=>x&&x.stack)||a[0];console.log('CONSOLE-ERR:',String(e.stack||e).slice(0,700))});
const dom=new JSDOM('<body><div id=root></div></body>',{url:'https://x.test/',runScripts:'outside-only',pretendToBeVisual:!0,virtualConsole:vc});
const w=dom.window;
w.sessionStorage.setItem('ar4.token','t');w.sessionStorage.setItem('ar4.user',JSON.stringify({username:'a',role:'super_admin'}));
const USER={username:'a',role:'super_admin'};
w.fetch=(u,o)=>{u=String(u);const c=u.split('/api/')[1];let b={ok:!0,data:{}};
 if(c==='auth.me')b.data={user:USER};
 else if(c==='reports.run'){let rid='';try{rid=(JSON.parse(o.body).reportId)||''}catch(e){}
   if(rid==='R10')b.data={reportId:'R10',rows:[{summary:{matched:3,unmatched:2,ignored:1,discrepancy:0},unmatchedCount:2}]};
   else b.data={reportId:rid,rows:[],columns:[]};}
 return Promise.resolve({ok:!0,status:200,text:()=>Promise.resolve(JSON.stringify(b))})};
w.localStorage.setItem("ar4.v3url","https://script.google.com/macros/s/TEST/exec");
w.EyV3Api={call:function(a,p,cb){cb("offline-stub")}};
w.eval(bundle);
setTimeout(()=>{w.location.hash='#/reports';w.dispatchEvent(new w.Event('hashchange'))},1600);
setTimeout(()=>{const b=[...w.document.querySelectorAll('button,li')].find(x=>/^R10\b/.test(x.textContent.trim()));b&&b.click()},2600);
setTimeout(()=>{
  const T=w.document.body.textContent.replace(/\s+/g,' ');
  const k=T.search(/R10\s*—|வங்கி சரிபார்ப்பு/);
  console.log('REGION:',T.slice(k,k+500));
  process.exit(0)},4600);
