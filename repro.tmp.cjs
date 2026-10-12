const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs');
const bundle=fs.readFileSync('v4/public/assets/index-CHTAzd11.js','utf8');
const regTxt=fs.readFileSync('/tmp/reg.json','utf8'),bankTxt=fs.readFileSync('/tmp/bankq.json','utf8');
const vc=new VirtualConsole();vc.on('error',(...a)=>console.log('CONSOLE-ERR:',String(a[0]).slice(0,300)));
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://ar-enterprises-erp.vercel.app/',runScripts:'outside-only',pretendToBeVisual:!0,virtualConsole:vc});
const w=dom.window;
w.sessionStorage.setItem('ar4.token','tok');
w.sessionStorage.setItem('ar4.user',JSON.stringify({username:'admin',name:'Admin',role:'super_admin'}));
const USER={username:'admin',name:'Admin',role:'super_admin'};
let printHtml='';
w.open=()=>({document:{write(h){printHtml=h},close(){}}});
w.fetch=(u)=>{u=String(u);
  if(u.includes('docs.google.com'))return Promise.resolve({ok:!0,text:()=>Promise.resolve(u.includes('2024650928')?bankTxt:regTxt)});
  if(u.includes('/api/gsheet'))return Promise.resolve({ok:!1,status:405,text:()=>Promise.resolve('{"ok":false}')});
  if(u.includes('/api/')){const call=u.split('/api/')[1].split('?')[0];
    let body={ok:!0,data:{}};
    if(call==='auth.me')body.data={user:USER};
    else if(call==='gst.filings.list')body.data={rows:[]};
    return Promise.resolve({ok:!0,status:200,text:()=>Promise.resolve(JSON.stringify(body))})}
  return Promise.resolve({ok:!0,status:200,text:()=>Promise.resolve('{}')})};
const errs=[];
w.addEventListener('error',e=>errs.push('ERR: '+e.message));
w.eval(bundle);
setTimeout(()=>{w.location.hash='#/gst';w.dispatchEvent(new w.Event('hashchange'))},2200);
setTimeout(()=>{const el=[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='சமர்ப்பிப்புகள்');if(el)el.click()},3200);
setTimeout(()=>{
  const T=w.document.body.textContent.replace(/\s+/g,' ');
  const A=(s)=>T.includes(s);
  console.log('errors:',errs.length,errs.slice(0,2));
  console.log('chip:',w.document.getElementById('arBuildChip').textContent);
  console.log('AllFY option:',A('எல்லா FY'));
  console.log('chips 46/28/29:',A('46 filings'),A('28 filings'),A('29 filings'));
  console.log('match total ₹1,46,53,000:',T.includes('1,46,53,000'));
  console.log('FY subtotals:',A('FY 2025-26 மொத்தம்'),A('FY 2026-27 மொத்தம்'));
  console.log('red flag:',A('payment இல்லை'),'| gt row:',A('மொத்தம் — matched payments'));
  // click print
  const pb=[...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('A4 Print'));
  if(pb)pb.click();
  setTimeout(()=>{
    console.log('print html bytes:',printHtml.length);
    console.log('print has banner:',printHtml.includes('AR ENTERPRISES ERP'));
    console.log('print totals:',printHtml.includes('1,46,53,000'));
    console.log('print subtotals:',printHtml.includes('FY 2025-26 மொத்தம்'),printHtml.includes('FY 2026-27 மொத்தம்'));
    console.log('print follow-up:',printHtml.includes('தொடர் நடவடிக்கை'),'| sig:',printHtml.includes('தயாரித்தவர்'));
    // FY filter still works: select 2026-27
    const sel=w.document.querySelector('select');
    const opt26=[...sel.options].find(o=>o.value==='2026-27');
    sel.value='2026-27';sel.dispatchEvent(new w.Event('change',{bubbles:!0}));
    setTimeout(()=>{
      const T2=w.document.body.textContent.replace(/\s+/g,' ');
      console.log('FY26-27 filtered chips 5 filings:',T2.includes('5 filings'),'| Arivoly 0:',T2.split('Arivoly')[1]?.includes('0 filings'));
      console.log('FY26-27 total 12,20,000:',T2.includes('12,20,000'));
      process.exit(0);
    },1200);
  },700);
},5000);
