const p=require('puppeteer');
(async()=>{
const b=await p.launch({args:['--no-sandbox']});const pg=await b.newPage();
await pg.setViewport({width:1536,height:800});
await pg.goto('https://ar-enterprises-erp.vercel.app/',{waitUntil:'networkidle2',timeout:60000});
await new Promise(r=>setTimeout(r,2500));
// login if needed
if(await pg.$('input[type=password]')){
 const ins=await pg.$$('input');await ins[0].type('admin');await ins[1].type('Polinchi@2026');
 await pg.keyboard.press('Enter');await new Promise(r=>setTimeout(r,3500));
}
const W=()=>pg.evaluate(()=>{const s=document.querySelector('.app-sidebar');return s?getComputedStyle(s).width:'NO-SIDEBAR'});
console.log('initial width:',await W());
await pg.screenshot({path:'/tmp/rail_initial.png',clip:{x:0,y:0,width:320,height:400}});
// hover sidebar
await pg.mouse.move(35,300);await new Promise(r=>setTimeout(r,500));
console.log('hover width:',await W());
await pg.screenshot({path:'/tmp/rail_hover.png',clip:{x:0,y:0,width:320,height:400}});
// move away
await pg.mouse.move(900,400);await new Promise(r=>setTimeout(r,600));
console.log('away width:',await W());
await pg.screenshot({path:'/tmp/rail_away.png',clip:{x:0,y:0,width:320,height:400}});
// click a nav item then move away (focus-within check)
await pg.mouse.move(35,300);await new Promise(r=>setTimeout(r,500));
const btn=await pg.$$('.app-nav-item'); if(btn[1]){await btn[1].click();await new Promise(r=>setTimeout(r,1200));}
await pg.mouse.move(900,400);await new Promise(r=>setTimeout(r,700));
console.log('after-click-moveaway width:',await W());
await pg.screenshot({path:'/tmp/rail_afterclick.png',clip:{x:0,y:0,width:320,height:400}});
await b.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
