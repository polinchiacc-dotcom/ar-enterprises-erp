var EyVbId="1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw";
function EyVbInr(x){x=+x||0;try{return Math.round(x).toLocaleString("en-IN")}catch(e){return String(Math.round(x))}}
function EyVbN(x){var s=String(x==null?"":x).replace(/[₹,\s]/g,"");var v=parseFloat(s);return isFinite(v)?v:0}
function EyVbD(v){var s=String(v==null?"":v),m;
 if(m=s.match(/^Date\((\d+),(\d+),(\d+)\)/))return m[1]+"-"+("0"+(+m[2]+1)).slice(-2)+"-"+("0"+(+m[3])).slice(-2);
 if(m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))return m[1]+"-"+("0"+(+m[2])).slice(-2)+"-"+("0"+(+m[3])).slice(-2);
 if(m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))return m[3]+"-"+("0"+(+m[2])).slice(-2)+"-"+("0"+(+m[1])).slice(-2);
 if(/^\d{5}(\.\d+)?$/.test(s)){var d=new Date(Date.UTC(1899,11,30)+Math.round(parseFloat(s))*864e5);return d.getUTCFullYear()+"-"+("0"+(d.getUTCMonth()+1)).slice(-2)+"-"+("0"+d.getUTCDate()).slice(-2)}
 return ""}
function EyVbEsc(x){return String(x==null?"":x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function EyVbIsG(g){return /^[0-9A-Z]{15}$/.test(String(g||"").trim())}
var EyVbSup=null;
function EyVbFetch(k){
 if(EyVbSup&&EyVbSup.done)return k(EyVbSup);
 var got={},fin=false;
 function part(key){return function(e,d){if(fin||got[key+"$"])return;got[key+"$"]=1;got[key]=e?null:EyRawRows(d);
  if(got.b2$&&got.ims$){fin=true;
   if(!got.b2&&!got.ims){EyVbSup={done:true,err:true};return k(EyVbSup)}
   var bills=[],sup={},g,i,b;
   function eat(rows,src,gi){var start=-1,j,r;
    for(j=0;j<rows.length;j++){if(String(rows[j][gi]).indexOf("GSTIN of supplier")>=0){start=j+1;break}}
    if(start<0)start=0;
    for(j=start;j<rows.length;j++){r=rows[j];g=String(r[gi]||"").trim();
     if(!EyVbIsG(g))continue;
     b={src:src,g:g,nm:String(r[gi+1]||"").trim(),inv:String(r[gi+2]||"").trim(),dt:EyVbD(r[gi+3]),vl:EyVbN(r[gi+4]),tx:EyVbN(r[gi+5]),mo:""};
     b.mo=b.dt?b.dt.slice(0,7):"";
     bills.push(b);
     var s2=sup[g]||(sup[g]={g:g,nm:"",n:0,vl:0,tx:0,last:"",b2:0,ims:0});
     if(b.nm&&(!s2.nm||(src==="2B"&&b.nm.length>s2.nm.length)))s2.nm=b.nm;
     s2.n++;s2.vl+=b.vl;s2.tx+=b.tx;if(b.dt>s2.last)s2.last=b.dt;s2[src==="2B"? "b2":"ims"]++}}
   if(got.b2)eat(got.b2,"2B",1);
   if(got.ims)eat(got.ims,"IMS",0);
   EyVbSup={done:true,err:false,bills:bills,sup:sup};k(EyVbSup)}}}
 gvizFetch(EyVbId,"GSTR2B",part("b2"),"select D,E,F,G,I,J,N");
 gvizFetch(EyVbId,"IMS",part("ims"),"select A,B,C,D,E,F");
}
function EyVbPrint(title,sub,head,rows,foots,land){
 var w=window.open("","_blank");if(!w)return;
 function esc(x){return EyVbEsc(x)}
 var rh="";head.forEach(function(h){rh+="<th>"+esc(h)+"</th>"});
 var rb="";rows.forEach(function(r){rb+='<tr>'+r.map(function(c,i){return '<td'+(i>0&&/^[-−+±₹0-9,.\s]+$/.test(String(c))?' class="mono"':'')+'>'+esc(c)+"</td>"}).join("")+"</tr>"});
 var fb="";foots.forEach(function(f){fb+='<tr class="ft"><td colspan="'+(head.length-1)+'">'+esc(f[0])+"</td><td>"+esc(f[1])+"</td></tr>"});
 var h="<html><head><meta charset='utf-8'><title>"+esc(title)+"</title><style>"+
  "@page{size:A4 "+(land?"landscape":"portrait")+";margin:8mm 6mm}"+
  "body{font-family:Calibri,'Segoe UI',Arial,sans-serif;color:#111;margin:0;font-size:11px}"+
  ".ban{background:#0d1b2a;color:#fff;padding:10px 12px}.ban .t1{font-size:16px;font-weight:800;letter-spacing:.5px}.ban .t2{font-size:11px;opacity:.85;margin-top:2px}"+
  "table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#1f3864;color:#fff;padding:5px 6px;text-align:left;font-size:10px;border:1px solid #16294a}td{padding:4px 6px;border:1px solid #d5dce8;font-size:10.5px}tr:nth-child(even) td{background:#f4f7fc}.mono{font-family:Consolas,Menlo,monospace}"+
  "tr.ft td{background:#e8edf5;font-weight:800;border-top:2px solid #1f3864}"+
  ".sig{display:flex;justify-content:space-between;margin-top:38px;padding:0 8px}.sig div{border-top:1px solid #333;padding-top:4px;font-size:10px;min-width:150px;text-align:center}"+
  ".noprint{margin-top:12px}.noprint button{padding:8px 14px;background:#1f3864;color:#fff;border:0;border-radius:6px;font-size:13px;cursor:pointer}"+
  "</style></head><body>"+
  "<div class='ban'><div class='t1'>AR ENTERPRISES</div><div class='t1' style='font-size:13px'>"+esc(title)+"</div><div class='t2'>"+esc(sub)+" · தயாரிக்கப்பட்ட தேதி: "+new Date().toISOString().slice(0,10)+"</div></div>"+
  "<table><thead><tr>"+rh+"</tr></thead><tbody>"+rb+fb+"</tbody></table>"+
  "<div class='sig'><div>தயாரித்தவர்</div><div>சரிபார்த்தவர்</div><div>அங்கீகாரம்</div></div>"+
  "<div class='noprint'><button onclick='window.print()'>🖨️ Print / Save PDF</button></div>"+
  "<script>window.onload=function(){setTimeout(function(){window.print()},300)}</scr"+"ipt></body></html>";
 w.document.write(h);w.document.close()}
function EyVbCsv(name,head,rows,foots){
 function q(x){x=String(x==null?"":x);return /[",\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x}
 var L=[head.map(q).join(",")].concat(rows.map(function(r){return r.map(q).join(",")}));
 (foots||[]).forEach(function(f){L.push(f.map(q).join(","))});
 var b=new Blob(["﻿"+L.join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
 a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();
 setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(a.href)},800)}
function EyVbHead(t,sub,en,ta){return n.jsxs("div",{style:{margin:"2px 0 14px"},children:[
 n.jsx("h2",{style:{margin:0,fontSize:22},children:t}),
 n.jsx("div",{style:{color:"var(--tx-3)",fontSize:13,marginTop:2},children:en})]})}
function EyVbLoad(f,en,ta){return n.jsx("div",{className:"ui-empty",style:{padding:34,textAlign:"center"},children:f==="l"?(en||"தரவு ஏற்றப்படுகிறது…"):"⚠ "+(ta||"தரவு ஏற்ற முடியவில்லை — மீண்டும் முயற்சிக்கவும்")})}
function EyVbChips(items){return n.jsx("div",{className:"ui-stats",children:items.map(function(c,i){
 return n.jsxs("div",{className:"ui-card",style:{padding:"10px 14px"},children:[
  n.jsx("div",{style:{fontSize:11,color:"var(--tx-3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"},children:c[0]}),
  n.jsx("div",{style:{fontSize:20,fontWeight:800,marginTop:3,color:c[2]||"var(--tx-1)"},children:c[1]})]},i)})})}
function EyVendPage({user:c}){
 const{t:u,lang:f}=xe(),r=Ue();
 var[rd,Srd]=E.useState(0),[q,Sq]=E.useState(""),[srt,Ssrt]=E.useState("vl");
 var L=function(a,b){return f==="ta"?b:a};
 E.useEffect(function(){EyVbFetch(function(){Srd(function(x){return x+1})})},[]);
 if(!EyVbSup||!EyVbSup.done)return EyVbLoad("l",L("Vendor data loading…","வணிகர் தரவு ஏற்றப்படுகிறது…"));
 if(EyVbSup.err)return n.jsx(EyVbLoad,{f:"e"});
 var all=Object.keys(EyVbSup.sup).map(function(g){return EyVbSup.sup[g]});
 var qq=q.trim().toLowerCase();
 var list=all.filter(function(s){return !qq||s.nm.toLowerCase().indexOf(qq)>=0||s.g.toLowerCase().indexOf(qq)>=0});
 list.sort(function(a,b){return srt==="n"?b.n-a.n:srt==="nm"?a.nm.localeCompare(b.nm):b.vl-a.vl});
 var tN=all.reduce(function(a,s){return a+s.n},0),tV=all.reduce(function(a,s){return a+s.vl},0);
 var fN=list.reduce(function(a,s){return a+s.n},0),fV=list.reduce(function(a,s){return a+s.vl},0);
 function pr(){EyVbPrint(L("Vendors — Purchase Summary","வணிகர்கள் — கொள்முதல் சுருக்கம்"),L("From GSTR-2B + IMS","GSTR-2B + IMS இலிருந்து"),
  ["#","Name","GSTIN","Bills","Total ₹","Taxable ₹","Last bill"],
  list.map(function(s,i){return [i+1,s.nm||"—",s.g,s.n,"₹"+EyVbInr(s.vl),"₹"+EyVbInr(s.tx),s.last||"—"]}),
  [[L("Filtered total","வடிகட்டிய மொத்தம்")+" ("+list.length+" "+L("vendors","வணிகர்கள்")+")","₹"+EyVbInr(fV)+" · "+fN+" "+L("bills","பில்கள்")],
   [L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")+" ("+all.length+")","₹"+EyVbInr(tV)+" · "+tN+" "+L("bills","பில்கள்")]],false)}
 function csv(){EyVbCsv("vendors.csv",["#","Name","GSTIN","Bills","Total","Taxable","Last bill"],
  list.map(function(s,i){return [i+1,s.nm,s.g,s.n,s.vl,s.tx,s.last]}),
  [["Filtered total",list.length,"","",fV,fN],["Grand total",all.length,"","",tV,tN]])}
 return n.jsxs("div",{children:[
  EyVbHead(L("Vendors","வணிகர்கள்"),null,L("Suppliers from GSTR-2B + IMS — click a vendor for their bills","GSTR-2B + IMS சப்ளையர்கள் — பில்களுக்கு வணிகரை click பண்ணுங்க")),
  EyVbChips([[L("Vendors","வணிகர்கள்"),String(all.length)],["பில்கள்",String(tN)],["₹ "+L("Total purchases","மொத்த கொள்முதல்"),"₹"+EyVbInr(tV)]]),
  n.jsxs("div",{className:"ui-card",style:{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"},children:[
   n.jsx("input",{className:"ui-input",style:{maxWidth:280},placeholder:L("Search name / GSTIN…","பெயர் / GSTIN தேடு…"),value:q,onChange:function(e){Sq(e.target.value)}}),
   n.jsxs("select",{className:"ui-input",style:{maxWidth:200},value:srt,onChange:function(e){Ssrt(e.target.value)},children:[
    n.jsx("option",{value:"vl",children:L("Sort: Value ↓","வரிசை: தொகை ↓")}),
    n.jsx("option",{value:"n",children:L("Sort: Bills ↓","வரிசை: பில்கள் ↓")}),
    n.jsx("option",{value:"nm",children:L("Sort: Name","வரிசை: பெயர்")})]}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:csv,children:"📊 CSV"}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:pr,children:"🖨️ "+L("Print A4","A4 அச்சு")})]}),
  n.jsx(EyTblX,{head:["#",L("Name","பெயர்"),"GSTIN",L("Bills","பில்கள்"),L("Total ₹","மொத்தம் ₹"),L("Taxable ₹","வரி மதிப்பு ₹"),L("Last bill","கடைசி பில்"),"ⓘ"],children:
   list.map(function(s,i){return n.jsxs("tr",{style:{cursor:"pointer"},onClick:function(){r("/vendors/"+encodeURIComponent(s.g))},children:[
    n.jsx("td",{children:i+1}),
    n.jsx("td",{style:{fontWeight:700},children:s.nm||"—"}),
    n.jsx("td",{className:"mono",children:s.g}),
    n.jsx("td",{className:"mono",children:s.n}),
    n.jsx("td",{className:"mono",style:{fontWeight:700},children:"₹"+EyVbInr(s.vl)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(s.tx)}),
    n.jsx("td",{className:"mono",children:s.last||"—"}),
    n.jsx("td",{children:(s.b2?"2B":"")+(s.b2&&s.ims?" + ":"")+(s.ims?"IMS":"")})]},s.g)})}),
  n.jsxs("table",{className:"gtbl",style:{marginTop:8},children:[n.jsx("tbody",{children:[n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Filtered total","வடிகட்டிய மொத்தம்")}),n.jsx("td",{children:list.length+" "+L("vendors","வணிகர்கள்")}),n.jsx("td",{children:fN+" "+L("bills","பில்கள்")}),n.jsx("td",{style:{fontWeight:800},children:"₹"+EyVbInr(fV)})]},"ft1"),n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")}),n.jsx("td",{children:all.length+" "+L("vendors","வணிகர்கள்")}),n.jsx("td",{children:tN+" "+L("bills","பில்கள்")}),n.jsx("td",{style:{fontWeight:800},children:"₹"+EyVbInr(tV)})]},"ft2")]})]}),
 n.jsx(EyV3SetupCard,{}),
 n.jsx(EyV3VenCard,{})]})
}
function EyVendDetail({user:c,gin:g0}){
 const{t:u,lang:f}=xe(),r=Ue();
 var[rd,Srd]=E.useState(0);
 var L=function(a,b){return f==="ta"?b:a};
 E.useEffect(function(){EyVbFetch(function(){Srd(function(x){return x+1})})},[]);
 if(!EyVbSup||!EyVbSup.done)return EyVbLoad("l");
 if(EyVbSup.err)return n.jsx(EyVbLoad,{f:"e"});
 var s=EyVbSup.sup[g0];
 var bills=EyVbSup.bills.filter(function(b){return b.g===g0}).sort(function(a,b){return (b.dt||"").localeCompare(a.dt||"")});
 var fV=bills.reduce(function(a,b){return a+b.vl},0),fT=bills.reduce(function(a,b){return a+b.tx},0);
 if(!s)return n.jsxs("div",{children:[n.jsx("div",{className:"ui-empty",children:L("Vendor not found","வணிகர் கிடைக்கவில்லை")}),n.jsx("button",{className:"ui-btn ui-btn-sm",style:{marginTop:10},onClick:function(){r("/vendors")},children:"← "+L("Back","பின்செல்")})]});
 function pr(){EyVbPrint((s.nm||s.g)+" — "+L("bills","பில்கள்"),"GSTIN "+s.g,
  ["Source","Month","Invoice","Date","Value ₹","Taxable ₹"],
  bills.map(function(b){return [b.src,b.mo||"—",b.inv||"—",b.dt||"—","₹"+EyVbInr(b.vl),"₹"+EyVbInr(b.tx)]}),
  [[L("Total","மொத்தம்")+" ("+bills.length+" "+L("bills","பில்கள்")+")","₹"+EyVbInr(fV)]],true)}
 return n.jsxs("div",{children:[
  n.jsxs("div",{style:{display:"flex",gap:10,alignItems:"center",marginBottom:12},children:[
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:function(){r("/vendors")},children:"← "+L("Vendors","வணிகர்கள்")}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:pr,children:"🖨️ "+L("Print A4","A4 அச்சு")})]}),
  EyVbChips([[L("Vendor","வணிகர்"),s.nm||"—"],["GSTIN",s.g],["பில்கள்",String(s.n)],["₹ "+L("Total","மொத்தம்"),"₹"+EyVbInr(s.vl)]]),
  n.jsx(EyTblX,{head:["ⓘ",L("Month","மாதம்"),L("Invoice","Invoice"),L("Date","தேதி"),L("Value ₹","மதிப்பு ₹"),L("Taxable ₹","வரி மதிப்பு ₹")],children:
   bills.map(function(b,i){return n.jsxs("tr",{children:[
    n.jsx("td",{children:b.src}),
    n.jsx("td",{className:"mono",children:b.mo||"—"}),
    n.jsx("td",{className:"mono",children:b.inv||"—"}),
    n.jsx("td",{className:"mono",children:b.dt||"—"}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.vl)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.tx)})]},i)})}),
  n.jsx("table",{className:"gtbl",style:{marginTop:8},children:n.jsx("tbody",{children:n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Total","மொத்தம்")}),n.jsx("td",{children:bills.length+" "+L("bills","பில்கள்")}),n.jsx("td",{children:"₹"+EyVbInr(fV)}),n.jsx("td",{children:"₹"+EyVbInr(fT)})]})})})]})
}
function EyBillsPage({user:c,gin:g0}){
 const{t:u,lang:f}=xe(),r=Ue();
 var[rd,Srd]=E.useState(0),[gs,Sgs]=E.useState(g0||""),[mo,Smo]=E.useState(""),[q,Sq]=E.useState(""),[pg,Spg]=E.useState(0);
 var L=function(a,b){return f==="ta"?b:a};
 E.useEffect(function(){EyVbFetch(function(){Srd(function(x){return x+1})})},[]);
 E.useEffect(function(){Sgs(g0||"")},[g0]);
 if(!EyVbSup||!EyVbSup.done)return EyVbLoad("l",L("Bill data loading…","பில் தரவு ஏற்றப்படுகிறது…"));
 if(EyVbSup.err)return n.jsx(EyVbLoad,{f:"e"});
 var all=EyVbSup.bills;
 var months={};all.forEach(function(b){if(b.mo)months[b.mo]=1});
 var moL=Object.keys(months).sort().reverse();
 var sups=Object.keys(EyVbSup.sup).map(function(g){return EyVbSup.sup[g]}).sort(function(a,b){return (a.nm||"").localeCompare(b.nm||"")});
 var qq=q.trim().toLowerCase();
 var list=all.filter(function(b){return (!gs||b.g===gs)&&(!mo||b.mo===mo)&&(!qq||b.nm.toLowerCase().indexOf(qq)>=0||String(b.inv).toLowerCase().indexOf(qq)>=0)});
 list.sort(function(a,b){return (b.dt||"").localeCompare(a.dt||"")});
 var PS=150,pgs=Math.max(1,Math.ceil(list.length/PS));if(pg>=pgs)Spg(0);
 var view=list.slice(pg*PS,(pg+1)*PS);
 var fV=list.reduce(function(a,b){return a+b.vl},0),fT=list.reduce(function(a,b){return a+b.tx},0);
 var tV=all.reduce(function(a,b){return a+b.vl},0),tT=all.reduce(function(a,b){return a+b.tx},0);
 function pr(){EyVbPrint(L("Purchase Bill Register","கொள்முதல் பில் பதிவேடு"),gs?(EyVbSup.sup[gs]?(EyVbSup.sup[gs].nm||"")+" · ":"")+gs:(mo?"Month "+mo:L("All months","எல்லா மாதம்")),
  ["Source","Supplier","GSTIN","Invoice","Date","Value ₹","Taxable ₹"],
  list.map(function(b){return [b.src,b.nm||"—",b.g,b.inv||"—",b.dt||"—","₹"+EyVbInr(b.vl),"₹"+EyVbInr(b.tx)]}),
  [[L("Filtered total","வடிகட்டிய மொத்தம்")+" ("+list.length+" "+L("bills","பில்கள்")+")","₹"+EyVbInr(fV)],
   [L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")+" ("+all.length+")","₹"+EyVbInr(tV)]],true)}
 function csv(){EyVbCsv("bills.csv",["Source","Supplier","GSTIN","Invoice","Date","Value","Taxable"],
  list.map(function(b){return [b.src,b.nm,b.g,b.inv,b.dt,b.vl,b.tx]}),
  [["Filtered total",list.length,"","","",fV,fT],["Grand total",all.length,"","","",tV,tT]])}
 return n.jsxs("div",{children:[
  EyVbHead(L("Bills","பில்கள்"),null,L("Purchase bills — GSTR-2B + IMS","கொள்முதல் பில்கள் — GSTR-2B + IMS")),
  EyVbChips([["பில்கள்",String(all.length)],["₹ "+L("Billed (all)","பில் மொத்தம் (எல்லாம்)"),"₹"+EyVbInr(tV)],["₹ "+L("Filtered","வடிகட்டிய"),"₹"+EyVbInr(fV)]]),
  n.jsxs("div",{className:"ui-card",style:{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"},children:[
   n.jsxs("select",{className:"ui-input",style:{maxWidth:260},value:gs,onChange:function(e){Sgs(e.target.value);Spg(0)},children:[
    n.jsx("option",{value:"",children:L("All suppliers","எல்லா சப்ளையர்")}),
    sups.map(function(s){return n.jsx("option",{value:s.g,children:(s.nm||s.g)},s.g)})]}),
   n.jsxs("select",{className:"ui-input",style:{maxWidth:150},value:mo,onChange:function(e){Smo(e.target.value);Spg(0)},children:[
    n.jsx("option",{value:"",children:L("All months","எல்லா மாதம்")}),
    moL.map(function(m){return n.jsx("option",{value:m,children:m},m)})]}),
   n.jsx("input",{className:"ui-input",style:{maxWidth:200},placeholder:L("Search…","தேடு…"),value:q,onChange:function(e){Sq(e.target.value);Spg(0)}}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:csv,children:"📊 CSV"}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:pr,children:"🖨️ "+L("Print A4","A4 அச்சு")})]}),
  n.jsx(EyTblX,{head:["ⓘ",L("Supplier","சப்ளையர்"),"GSTIN",L("Invoice","Invoice"),L("Date","தேதி"),L("Value ₹","மதிப்பு ₹"),L("Taxable ₹","வரி மதிப்பு ₹")],children:
   view.map(function(b,i){return n.jsxs("tr",{style:{cursor:"pointer"},onClick:function(){r("/vendors/"+encodeURIComponent(b.g))},children:[
    n.jsx("td",{children:b.src}),
    n.jsx("td",{style:{fontWeight:600},children:b.nm||"—"}),
    n.jsx("td",{className:"mono",children:b.g}),
    n.jsx("td",{className:"mono",children:b.inv||"—"}),
    n.jsx("td",{className:"mono",children:b.dt||"—"}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.vl)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.tx)})]},pg+"-"+i)})}),
  n.jsxs("div",{style:{display:"flex",gap:10,alignItems:"center",marginTop:10},children:[
   n.jsx("button",{className:"ui-btn ui-btn-sm",disabled:pg===0,onClick:function(){Spg(pg-1)},children:"←"}),
   n.jsx("span",{style:{fontSize:13,color:"var(--tx-3)"},children:(pg*PS+1)+"–"+Math.min((pg+1)*PS,list.length)+" / "+list.length}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",disabled:pg+1>=pgs,onClick:function(){Spg(pg+1)},children:"→"})]}),
  n.jsxs("table",{className:"gtbl",style:{marginTop:8},children:[n.jsx("tbody",{children:[n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Filtered total","வடிகட்டிய மொத்தம்")}),n.jsx("td",{children:list.length+" "+L("bills","பில்கள்")}),n.jsx("td",{style:{fontWeight:800},children:"₹"+EyVbInr(fV)}),n.jsx("td",{children:"₹"+EyVbInr(fT)})]},"f1"),n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")}),n.jsx("td",{children:all.length+" "+L("bills","பில்கள்")}),n.jsx("td",{style:{fontWeight:800},children:"₹"+EyVbInr(tV)}),n.jsx("td",{children:"₹"+EyVbInr(tT)})]},"f2")]})]}),
 n.jsx(EyV3BillsCard,{})]})
}
var EyV3WB="1zzbV4F_Iju2szqT0SGLgKAipXChAp8L-iHc63I4jLeQ";
var EyV3Mo={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function EyV3M3(s){return String(s||"").trim().toLowerCase().slice(0,3)}
function num(x){return EyVbN(x)}
function EyV3YM(fy,mo){var m=EyV3Mo[EyV3M3(mo)]||0,y=+String(fy).slice(0,4);if(!m||!y)return"";return (m>=4?y:y+1)+"-"+("0"+m).slice(-2)}
var EyV3=null;
function EyV3Fetch(k){
 if(EyV3&&EyV3.done)return k(EyV3);
 var got={},fin=false;
 function part(key){return function(e,d){if(fin||got[key+"$"])return;got[key+"$"]=1;got[key]=e?null:EyRawRows(d);
  if(got.ven$&&got.txn$&&got.bil$&&got.g2$){fin=true;
   var o={done:true,err:!got.ven&&!got.txn,ven:{},txn:[],bil:[],g2:{}},i,r;
   (got.ven||[]).forEach(function(r){var c=String(r[0]||"").trim();if(!c||c==="vendorCode")return;
    o.ven[c]={code:c,nm:String(r[1]||"").trim(),dist:String(r[2]||"").trim(),mob:String(r[3]||"").trim(),ty:String(r[4]||"").trim(),gstin:String(r[5]||"").trim(),addr:String(r[6]||"").trim(),reg:String(r[7]||"").trim()}});
   (got.txn||[]).forEach(function(r){var id=String(r[0]||"").trim();if(!id||id==="txnId")return;
    o.txn.push({id:id,dist:String(r[1]||"").trim(),vc:String(r[2]||"").trim(),nm:String(r[3]||"").trim(),fy:String(r[4]||"").trim(),mo:String(r[5]||"").trim(),exp:EyVbN(r[6]),adv:EyVbN(r[7]),gp:EyVbN(r[8]),ga:EyVbN(r[9]),act:EyVbN(r[10]),rem:EyVbN(r[11]),bal:EyVbN(r[12]),st:String(r[13]||"").trim()})});
   (got.bil||[]).forEach(function(r){var id=String(r[1]||"").trim();if(!id||id==="txnId")return;
    o.bil.push({id:String(r[0]||"").trim(),txn:id,vc:String(r[2]||"").trim(),nm:String(r[3]||"").trim(),no:String(r[4]||"").trim(),dt:EyVbD(r[5]),amt:EyVbN(r[6]),gp:EyVbN(r[7]),ga:EyVbN(r[8]),tot:EyVbN(r[9])})});
   (got.g2||[]).forEach(function(r){if(String(r[0]||"").trim()==="FY")return;
    var fy=String(r[0]||"").trim(),m3=EyV3M3(r[1]),g=String(r[2]||"").trim();
    if(!fy||!m3||!EyVbIsG(g))return;
    o.g2[fy+"|"+m3+"|"+g]={tax:EyVbN(r[3]),tot:EyVbN(r[4]),n:EyVbN(r[5])}});
   EyV3=o;k(EyV3)}}}
 gvizFetch(EyV3WB,"Vendors",part("ven"));
 gvizFetch(EyV3WB,"Transactions",part("txn"));
 gvizFetch(EyV3WB,"Bills",part("bil"));
 gvizFetch(EyV3WB,"GSTR2B_Summary",part("g2"),"select A,B,D,E,H,I");
}
function EyV3Groups(){
 var grp={},i,b;for(i=0;i<EyV3.bil.length;i++){b=EyV3.bil[i];var g=grp[b.txn]||(grp[b.txn]={id:b.txn,n:0,amt:0,tot:0,vc:b.vc,nm:b.nm});g.n++;g.amt+=b.amt;g.tot+=b.tot;if(b.nm&&!/^\s*$/.test(b.nm))g.nm=b.nm}
 return grp}
function EyTxnPage(o){
 var txnId=o&&o.txnId;
 const{t:u,lang:f}=xe(),r=Ue();
 var[rd,Srd]=E.useState(0),[fy,Sfy]=E.useState(""),[q,Sq]=E.useState(""),[tf,Stf]=E.useState(false);
 var L=function(a,b){return f==="ta"?b:a};
 E.useEffect(function(){EyV3Fetch(function(){Srd(function(x){return x+1})})},[]);
 if(!EyV3||!EyV3.done)return EyVbLoad("l",L("Transactions loading…","பரிவர்த்தனைகள் ஏற்றப்படுகிறது…"));
 if(EyV3.err)return n.jsx(EyVbLoad,{f:"e"});
 if(txnId)return EyTxnDetail({txnId:txnId,L:L,nav:r,refresh:function(){EyV3=null;Srd(function(x){return x+1})}});
 var grp=EyV3Groups(),i,x,g;
 var MoN={1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun",7:"Jul",8:"Aug",9:"Sep",10:"Oct",11:"Nov",12:"Dec"};
 var items=EyV3.txn.map(function(x){return{h:x,g:grp[x.id]||{n:0,amt:0,tot:0}}});
 var orph=Object.keys(grp).filter(function(id){return !items.some(function(it){return it.h.id===id})}).map(function(id){return{h:null,g:grp[id]}});
 orph.sort(function(a,b){return a.g.id.localeCompare(b.g.id)});
 function gstinOf(it){var v=it.h?(EyV3.ven[it.h.vc]||null):null;return v?v.gstin:""}
 function g2Of(it){if(!it.h)return null;var v=EyV3.ven[it.h.vc];if(!v||!v.gstin)return null;
  return EyV3.g2[it.h.fy+"|"+EyV3M3(it.h.mo)+"|"+v.gstin]||null}
 var all=items.concat(orph);
 var fys={};items.forEach(function(it){fys[it.h.fy]=1});
 var fyL=Object.keys(fys).sort();
 var qq=q.trim().toLowerCase();
 var list=all.filter(function(it){
  if(it.h&&fy&&it.h.fy!==fy)return false;
  if(!qq)return true;
  var nm=(it.h?it.h.nm:it.g.nm)||"";
  return nm.toLowerCase().indexOf(qq)>=0||it.g.id.toLowerCase().indexOf(qq)>=0||(it.h&&it.h.mo.toLowerCase().indexOf(qq)>=0)});
 var fExp=0,fAct=0,fAdv=0,fBil=0,fG2=0;
 list.forEach(function(it){if(it.h){fExp+=it.h.exp;fAct+=it.h.act;fAdv+=it.h.adv}fBil+=it.g.tot;var q2=g2Of(it);if(q2)fG2+=q2.tot});
 var gExp=0,gAct=0,gAdv=0,gBil=0,gG2=0;
 all.forEach(function(it){if(it.h){gExp+=it.h.exp;gAct+=it.h.act;gAdv+=it.h.adv}gBil+=it.g.tot;var q2=g2Of(it);if(q2)gG2+=q2.tot});
 function pr(){
  var rows=[];
  list.forEach(function(it){var h=it.h,gst=gstinOf(it),q2=g2Of(it);
   rows.push([it.h?it.h.fy:"—",it.h?it.h.mo:"—",it.g.id,(it.h?it.h.nm:it.g.nm)||"—",gst||"—",
    h?("₹"+EyVbInr(h.exp)):"—",h?("₹"+EyVbInr(h.adv)):"—",h?(h.gp+"%"):"—",h?("₹"+EyVbInr(h.act)):"—",
    "₹"+EyVbInr(it.g.tot)+" ("+it.g.n+")",q2?("₹"+EyVbInr(q2.tot)+" ("+q2.n+")"):"—",h?h.st:"—"])});
  EyVbPrint(L("Vendor Monthly Transactions","வணிகர் மாத பரிவர்த்தனைகள்"),fy||L("All FY","எல்லா FY"),
   ["FY","Month","Txn ID","Vendor","GSTIN","Expected ₹","Advance ₹","GST%","Actual ₹","Bills Σ","2B Σ","Status"],
   rows,
   [[L("Filtered total","வடிகட்டிய மொத்தம்")+" ("+list.length+")","Expected ₹"+EyVbInr(fExp),"Advance ₹"+EyVbInr(fAdv),"Actual ₹"+EyVbInr(fAct),"Bills ₹"+EyVbInr(fBil),"2B ₹"+EyVbInr(fG2)],
    [L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")+" ("+all.length+")","Expected ₹"+EyVbInr(gExp),"Advance ₹"+EyVbInr(gAdv),"Actual ₹"+EyVbInr(gAct),"Bills ₹"+EyVbInr(gBil),"2B ₹"+EyVbInr(gG2)]],true)}
 function csv(){
  var rows=list.map(function(it){var h=it.h,gst=gstinOf(it),q2=g2Of(it);
   return [it.h?it.h.fy:"",it.h?it.h.mo:"",it.g.id,(it.h?it.h.nm:it.g.nm)||"",gst||"",
    h?h.exp:"",h?h.adv:"",h?h.gp:"",h?h.act:"",it.g.n,it.g.amt.toFixed(2),it.g.tot.toFixed(2),q2?q2.n:0,q2?q2.tot.toFixed(2):"",h?h.st:""]});
  EyVbCsv("transactions.csv",["FY","Month","TxnID","Vendor","GSTIN","Expected","Advance","GST%","Actual","Bills","BillsAmt","BillsTotal","2BCount","2BTotal","Status"],rows,
   [["Filtered",list.length,"","","",fExp,fAdv,"",fAct,"","","","","",fG2],["Grand",all.length,"","","",gExp,gAdv,"",gAct,"","","","","",gG2]])}
 return n.jsxs("div",{children:[
  EyVbHead(L("Transactions — Vendor Monthly","பரிவர்த்தனைகள் — வணிகர் மாத"),null,L("Vendor → month expected → bills → 2B compare (V3 model)","வணிகர் → மாத எதிர்பார்ப்பு → பில்கள் → 2B ஒப்பீடு (V3 மாதிரி)")),
  EyVbChips([[L("Transactions","பரிவர்த்தனைகள்"),String(all.length)],[L("Expected (all)","எதிர்பார்ப்பு (எல்லாம்)"),"₹"+EyVbInr(gExp)],[L("Bills Σ (all)","பில் மொத்தம் (எல்லாம்)"),"₹"+EyVbInr(gBil)],[L("Actual goods (all)","உண்மை பொருள் (எல்லாம்)"),"₹"+EyVbInr(gAct)]]),
  tf?n.jsx(EyTxnForm,{v:EyV3,onDone:function(){EyV3=null;Stf(false);Srd(function(x){return x+1})}}):null,
  n.jsxs("div",{className:"ui-card",style:{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"},children:[
   n.jsxs("select",{className:"ui-input",style:{maxWidth:170},value:fy,onChange:function(e){Sfy(e.target.value)},children:[
    n.jsx("option",{value:"",children:L("All FY","எல்லா FY")}),
    fyL.map(function(x){return n.jsx("option",{value:x,children:x},x)})]}),
   n.jsx("input",{className:"ui-input",style:{maxWidth:240},placeholder:L("Vendor / Txn ID…","வணிகர் / Txn ID…"),value:q,onChange:function(e){Sq(e.target.value)}}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-primary ui-btn-sm",onClick:function(){Stf(!tf)},children:(tf?"✕ ":"+ ")+L("Transaction","பரிவர்த்தனை")}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:csv,children:"📊 CSV"}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:pr,children:"🖨️ "+L("Print A4","A4 அச்சு")})]}),
  n.jsx(EyTblX,{head:["FY",L("Month","மாதம்"),"Txn ID",L("Vendor","வணிகர்"),"GSTIN",L("Expected ₹","எதிர்பார்ப்பு ₹"),L("Advance ₹","முன்பணம் ₹"),"GST%",L("Actual ₹","உண்மை ₹"),L("Bills Σ","பில்கள் Σ"),"2B Σ","⚖",L("Status","நிலை")],children:
   list.map(function(it){var h=it.h,gst=gstinOf(it),q2=g2Of(it),d2=h?it.g.tot-h.exp:0;
    return n.jsxs("tr",{style:{cursor:"pointer"},onClick:function(){r("/transactions/"+encodeURIComponent(it.g.id))},children:[
     n.jsx("td",{className:"mono",children:h?h.fy:"—"}),
     n.jsx("td",{children:h?h.mo:"—"}),
     n.jsx("td",{className:"mono",style:{fontSize:10},children:it.g.id}),
     n.jsx("td",{style:{fontWeight:600},children:(h?h.nm:it.g.nm)||"—"}),
     n.jsx("td",{className:"mono",style:{fontSize:10},children:gst||"—"}),
     n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.exp):"—"}),
     n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.adv):"—"}),
     n.jsx("td",{className:"mono",children:h?h.gp+"%":"—"}),
     n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.act):"—"}),
     n.jsx("td",{className:"mono",children:"₹"+EyVbInr(it.g.tot)+" ("+it.g.n+")"}),
     n.jsx("td",{className:"mono",style:{color:q2?"#0a7d43":undefined},children:q2?"₹"+EyVbInr(q2.tot)+" ("+q2.n+")":"—"}),
     n.jsx("td",{children:h?(Math.abs(d2)<=1?n.jsx("span",{style:{color:"#0a7d43",fontWeight:800},children:"✓"}):n.jsx("span",{style:{color:"#b3261e",fontWeight:800},title:String(d2),children:"⚠"})):""}),
     n.jsx("td",{children:h?n.jsx("span",{style:{fontWeight:700},children:h.st}):n.jsx("span",{style:{color:"#8a6d00",fontSize:11},children:L("bills only","பில் மட்டும்")})})]},it.g.id)})}),
  n.jsx("div",{style:{fontSize:12,color:"var(--tx-3)",margin:"8px 2px"},children:L("⚠ = bills Σ differs from expected · — = vendor-month not in 2B summary","⚠ = பில் Σ ≠ எதிர்பார்ப்பு · — = அந்த வணிகர்-மாதம் 2B சுருக்கத்தில் இல்லை")}),
  n.jsx("table",{className:"gtbl",style:{marginTop:8},children:n.jsx("tbody",{children:[
   n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Filtered total","வடிகட்டிய மொத்தம்")}),n.jsx("td",{className:"mono",children:list.length+" "+L("txns","பரிவர்த்தனை")}),n.jsx("td",{className:"mono",children:"எதிர்பார்ப்பு ₹"+EyVbInr(fExp)}),n.jsx("td",{className:"mono",children:"முன்பணம் ₹"+EyVbInr(fAdv)}),n.jsx("td",{className:"mono",children:"உண்மை ₹"+EyVbInr(fAct)}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"பில்கள் ₹"+EyVbInr(fBil)}),n.jsx("td",{className:"mono",children:"2B ₹"+EyVbInr(fG2)})]},"f1"),
   n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")}),n.jsx("td",{className:"mono",children:all.length+" "+L("txns","பரிவர்த்தனை")}),n.jsx("td",{className:"mono",children:"எதிர்பார்ப்பு ₹"+EyVbInr(gExp)}),n.jsx("td",{className:"mono",children:"முன்பணம் ₹"+EyVbInr(gAdv)}),n.jsx("td",{className:"mono",children:"உண்மை ₹"+EyVbInr(gAct)}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"பில்கள் ₹"+EyVbInr(gBil)}),n.jsx("td",{className:"mono",children:"2B ₹"+EyVbInr(gG2)})]},"f2")]})})]})}
function EyTxnDetail(p){
 var id=p.txnId,L=p.L,nav=p.nav,refresh=p.refresh||function(){};
 var h=null,i;for(i=0;i<EyV3.txn.length;i++)if(EyV3.txn[i].id===id)h=EyV3.txn[i];
 var bills=EyV3.bil.filter(function(b){return b.txn===id}).sort(function(a,b){return (a.dt||"").localeCompare(b.dt||"")});
 var v=h?(EyV3.ven[h.vc]||null):null;
 var sAmt=0,sGa=0,sTot=0;bills.forEach(function(b){sAmt+=b.amt;sGa+=b.ga;sTot+=b.tot});
 var q2=null;
 if(h){var vv=EyV3.ven[h.vc];if(vv&&vv.gstin)q2=EyV3.g2[h.fy+"|"+EyV3M3(h.mo)+"|"+vv.gstin]||null}
 if(!h&&!bills.length)return n.jsxs("div",{children:[n.jsx("div",{className:"ui-empty",children:L("Transaction not found","பரிவர்த்தனை கிடைக்கவில்லை")}),n.jsx("button",{className:"ui-btn ui-btn-sm",style:{marginTop:10},onClick:function(){nav("/transactions")},children:"← "+L("Back","பின்செல்")})]});
 var nm=(h?h.nm:(bills[0]?bills[0].nm:""))||"—";
 var vc=h?h.vc:(bills[0]?bills[0].vc:"");
 function pr(){
  var rows=bills.map(function(b,i2){return [i2+1,b.no||"—",b.dt||"—","₹"+EyVbInr(b.amt),b.gp+"%","₹"+EyVbInr(b.ga),"₹"+EyVbInr(b.tot)]});
  EyVbPrint(nm+" — "+id,h?("FY "+h.fy+" · "+h.mo+(v?" · "+v.gstin:"")):"",
   ["#","Bill No","Date","Amount ₹","GST%","GST ₹","Total ₹"],rows,
   [[L("Bills total","பில்கள் மொத்தம்")+" ("+bills.length+")","₹"+EyVbInr(sAmt),"₹"+EyVbInr(sGa),"₹"+EyVbInr(sTot)],
    [L("Expected (unfiltered)","எதிர்பார்ப்பு (வடிகட்டாத)"),h?"₹"+EyVbInr(h.exp):"—",h?h.gp+"%":"—",h?"₹"+EyVbInr(h.ga):"—"]],true)}
 return n.jsxs("div",{children:[
  n.jsxs("div",{style:{display:"flex",gap:10,alignItems:"center",marginBottom:12},children:[
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:function(){nav("/transactions")},children:"← "+L("Transactions","பரிவர்த்தனைகள்")}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:pr,children:"🖨️ "+L("Print A4","A4 அச்சு")})]}),
  EyVbChips([[L("Vendor","வணிகர்"),nm],["GSTIN",(v&&v.gstin)||"—"],[h?("FY "+h.fy+" · "+h.mo):"Txn",id],[L("Expected","எதிர்பார்ப்பு"),h?"₹"+EyVbInr(h.exp):"—"],[L("Status","நிலை"),h?h.st:L("bills only","பில் மட்டும்")]]),
  n.jsx(EyTxnOps,{h:h,L:L,refresh:refresh}),
  n.jsxs("div",{className:"ui-card",children:[
   n.jsx("div",{style:{fontWeight:800,marginBottom:6},children:L("Month declaration (vendor pre-committed)","மாத அறிவிப்பு (வணிகர் முன்கூட்டிய தொகை)")}),
   n.jsxs("table",{className:"gtbl",children:[n.jsx("tbody",{children:[
    n.jsxs("tr",{children:[n.jsx("td",{children:L("Expected amount","எதிர்பார்த்த தொகை")}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.exp):"—"})]},"r1"),
    n.jsxs("tr",{children:[n.jsx("td",{children:L("Advance paid","முன்பணம்")}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.adv):"—"})]},"r2"),
    n.jsxs("tr",{children:[n.jsx("td",{children:L("GST % → GST amount","GST % → GST தொகை")}),n.jsx("td",{className:"mono",children:h?(h.gp+"% → ₹"+EyVbInr(h.ga)):"—"})]},"r3"),
    n.jsxs("tr",{children:[n.jsx("td",{children:L("Actual goods value (Σ bills)","உண்மை பொருள் மதிப்பு (Σ பில்)")}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.act):"₹"+EyVbInr(sAmt)})]},"r4"),
    n.jsxs("tr",{children:[n.jsx("td",{children:L("Remaining","மீதி")}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.rem):"—"})]},"r5"),
    n.jsxs("tr",{children:[n.jsx("td",{children:L("GST balance (after advance)","GST மீதி (முன்பணத்திற்குப் பின்)")}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.bal):"—"})]},"r6")]})]})]}),
  n.jsxs("div",{className:"ui-card",children:[
   n.jsx("div",{style:{fontWeight:800,marginBottom:6},children:L("2B comparison (vendor + month)","2B ஒப்பீடு (வணிகர் + மாதம்)")}),
   q2?n.jsxs("table",{className:"gtbl",children:[n.jsx("tbody",{children:[
    n.jsxs("tr",{children:[n.jsx("td",{children:"2B "+(h?h.fy+" · "+h.mo:"")}),n.jsx("td",{className:"mono",children:q2.n+" "+L("bills","பில்கள்")}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(q2.tot)})]},"b1"),
    n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:700},children:L("V3 bills Σ vs 2B Σ","V3 பில் Σ vs 2B Σ")}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(sTot)+" vs ₹"+EyVbInr(q2.tot)}),n.jsx("td",{className:"mono",style:{color:Math.abs(sTot-q2.tot)<=1?"#0a7d43":"#b3261e",fontWeight:800},children:(sTot-q2.tot>=0?"+":"")+"₹"+EyVbInr(sTot-q2.tot)})]},"b2")]})]}):
   n.jsx("div",{style:{color:"var(--tx-3)",fontSize:13},children:L("This vendor-month is not in the GSTR2B_Summary (2B) yet","இந்த வணிகர்-மாதம் GSTR2B_Summary (2B)-இல் இன்னும் இல்லை")})]}),
  n.jsx(EyTblX,{head:["#",L("Bill No","பில் எண்"),L("Date","தேதி"),L("Amount ₹","தொகை ₹"),"GST%",L("GST ₹","GST ₹"),L("Total ₹","மொத்த ₹")],children:
   bills.map(function(b,i){return n.jsxs("tr",{children:[
    n.jsx("td",{children:i+1}),
    n.jsx("td",{className:"mono",children:b.no||"—"}),
    n.jsx("td",{className:"mono",children:b.dt||"—"}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.amt)}),
    n.jsx("td",{className:"mono",children:b.gp+"%"}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.ga)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(b.tot)})]},i)})}),
  n.jsx("table",{className:"gtbl",style:{marginTop:8},children:n.jsx("tbody",{children:[
   n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Bills total (filtered)","பில் மொத்தம் (வடிகட்டிய)")}),n.jsx("td",{className:"mono",children:bills.length+" "+L("bills","பில்கள்")}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(sAmt)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(sGa)}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(sTot)})]},"f1"),
   n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Expected (unfiltered)","எதிர்பார்ப்பு (வடிகட்டாத)")}),n.jsx("td",{className:"mono",children:h?h.fy+" · "+h.mo:"—"}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.exp):"—"}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.ga):"—"}),n.jsx("td",{className:"mono",children:h?"₹"+EyVbInr(h.act):"—"})]},"f2")]})})]})}
var EyV3Key="ARV3-2026-KX9Q42";
function EyV3Url(){try{return localStorage.getItem("ar4.v3url")||""}catch(e){return ""}}
function EyV3Call(act,pr,cb){
 var done=false;
 function cb2(e,d){if(done)return;done=true;cb(e,d)}
 try{ if(typeof window!=="undefined"&&window.EyV3Api&&window.EyV3Api.stub)return window.EyV3Api.call(act,pr,cb2); }catch(e){}
 var u=EyV3Url();
 if(!u)return cb2("V3 API URL இன்னும் அமைக்கவில்லை — ⚙ V3 API-இல் Web App URL paste பண்ணுங்க");
 var fn="__arV3"+Date.now()+((Math.random()*1e6)|0),q=[],k;
 for(k in pr)if(pr[k]!==undefined&&pr[k]!==null)q.push(encodeURIComponent(k)+"="+encodeURIComponent(pr[k]));
 var s=document.createElement("script"),done=false;
 function cleanup(){done=true;try{delete window[fn]}catch(e){window[fn]=undefined}if(s&&s.parentNode)s.parentNode.removeChild(s)}
 var to=setTimeout(function(){if(!done){cleanup();cb2("நேரம் முடிந்தது — V3 API பதில் இல்லை")}},15000);
 window[fn]=function(d){if(done)return;cleanup();cb2(null,d)};
 s.onerror=function(){if(done)return;cleanup();cb2("V3 API அணுக முடியவில்லை — URL/deployment சரிபார்க்கவும்")};
 s.src=u+"?callback="+encodeURIComponent(fn)+"&k="+encodeURIComponent(EyV3Key)+"&action="+encodeURIComponent(act)+(q.length?"&"+q.join("&"):"");
 document.head.appendChild(s)}
if(!(window.EyV3Api&&window.EyV3Api.stub))window.EyV3Api={call:EyV3Call,url:EyV3Url};
function EyV3SetupCard(on){
 const{lang:f}=xe();
 var L=function(a,b){return f==="ta"?b:a};
 var[u,Su]=E.useState(EyV3Url()),[st,Sst]=E.useState("");
 if(!on)return null;
 return n.jsxs("div",{className:"ui-card",style:{border:"1px dashed #94a3b8",marginBottom:12},children:[
  n.jsx("div",{style:{fontWeight:800,marginBottom:6},children:"⚙ V3 API (ஒரு முறை அமைப்பு)"}),
  n.jsx("div",{style:{fontSize:12,color:"var(--tx-3)",marginBottom:8},children:L("Apps Script-இல் ArV3Api.gs paste → Deploy → Web app → Anyone → URL இங்கே paste:","ArV3Api.gs-ஐ Apps Script-இல் paste பண்ணி Deploy → Web app → Anyone → வரும் URL இங்கே:")}),
  n.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap"},children:[
   n.jsx("input",{className:"ui-input",style:{flex:1,minWidth:260,fontFamily:"monospace",fontSize:12},placeholder:"https://script.google.com/macros/s/.../exec",value:u,onChange:function(e){Su(e.target.value)}}),
   n.jsx("button",{className:"ui-btn ui-btn-primary ui-btn-sm",onClick:function(){
     if(!/script\.google\.com\/macros\/s\//.test(u.trim()))return Sst(L("URL முழுவதும் paste பண்ணுங்க","சரியான /exec URL வேணும்"));
     try{localStorage.setItem("ar4.v3url",u.trim())}catch(e){}
     Sst("✓ "+L("Saved","சேமிக்கப்பட்டது"));setTimeout(function(){Sst("")},1500)},
    children:L("Save","சேமி")}),
   EyV3Url()?n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:function(){
     EyV3Call("ping",{},function(e2,d2){Sst(e2?("✗ "+e2):("✓ V3 API OK"+(d2&&d2.time?" · "+d2.time.slice(0,19):"")))})},
    children:L("Test","சோதி")}):null]}),
  st?n.jsx("div",{style:{fontSize:12,marginTop:6,color:st.indexOf("✓")>=0?"#0a7d43":"#b3261e"},children:st}):null]})}
function EyV3VenCard(){
 const{lang:f}=xe();
 var L=function(a,b){return f==="ta"?b:a};
 var perm=EyV3Role();
 var[list,Slist]=E.useState(null),[af,Saf]=E.useState(false),[st,Sst]=E.useState("");
 var[Fm,SFm]=E.useState({name:"",district:"Pudukkottai",mobile:"",type:"Hardware",gst:"",addr:"",reg:String(new Date().getFullYear())});
 var refresh=function(){Slist(null);EyV3Call("list",{tab:"vendors"},function(e2,d2){Slist(e2?[]:((d2&&d2.rows)||[]))})};
 E.useEffect(function(){refresh()},[]);
 var set=function(k){return function(e2){var x={};x[k]=e2.target.value;SFm(function(m){return Object.assign({},m,x)})}};
 var submit=function(){
  if(!Fm.name.trim())return Sst(L("Name வேணும்","பெயர் வேணும்"));
  Sst("…");
  EyV3Call("vendorAdd",{name:Fm.name,district:Fm.district,mobile:Fm.mobile,type:Fm.type,gst:Fm.gst,addr:Fm.addr,reg:Fm.reg,role:perm.role,user:"admin"},function(e2,d2){
   if(e2)return Sst("✗ "+e2);
   if(!d2||!d2.ok)return Sst("✗ "+((d2&&d2.error)||"தவறு"));
   Sst("✓ "+(d2.vendorCode||"")+" — "+Fm.name);
   SFm({name:"",district:Fm.district,mobile:"",type:Fm.type,gst:"",addr:"",reg:Fm.reg});Saf(false);refresh()})};
 var rm=function(v2){
  if(!window.confirm(L("Remove vendor "+v2.vendorCode+" — "+v2.vendorName+"?","வணிகர் "+v2.vendorCode+" — "+v2.vendorName+" ஐ நீக்கவா?")))return;
  Sst("…");
  EyV3Call("vendorRemove",{vendorCode:v2.vendorCode,role:perm.role,user:"admin"},function(e2,d2){
   if(e2)return Sst("✗ "+e2);
   if(!d2||!d2.ok)return Sst("✗ "+((d2&&d2.error)||"தவறு"));
   Sst("✓ "+v2.vendorCode+" "+L("removed","நீக்கப்பட்டது"));refresh()})};
 return n.jsxs("div",{className:"ui-card",children:[
  n.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:8},children:[
   n.jsx("div",{style:{fontWeight:800},children:L("V3 Vendor Master (AR_ERP_Pudukkottai)","V3 வணிகர் பதிவேடு (AR_ERP_Pudukkottai)")}),
   n.jsx("div",{style:{flex:1}}),
   perm.canAddVen?n.jsx("button",{className:"ui-btn ui-btn-primary ui-btn-sm",onClick:function(){Saf(!af)},children:(af?"✕ ":"+ ")+L("Vendor","வணிகர்")}):n.jsx("span",{style:{fontSize:12,color:"var(--tx-3)"},children:L("Add: agent / manager / admin only","சேர்க்க: ஏஜெண்ட் / மேனேஜர் / அட்மின் மட்டும்")})]}),
  n.jsx(EyV3SetupCard,{on:!EyV3Url()}),
  af?n.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:10},children:[
   n.jsx("input",{className:"ui-input",placeholder:L("Vendor name *","வணிகர் பெயர் *"),value:Fm.name,onChange:set("name")}),
   n.jsx("input",{className:"ui-input",placeholder:L("Mobile","கைபேசி"),value:Fm.mobile,onChange:set("mobile")}),
   n.jsxs("select",{className:"ui-input",value:Fm.type,onChange:set("type"),children:[
    ["Hardware","Paint","Civil","Plumbing","Electrical","Tiles","Steel","Other"].map(function(t){return n.jsx("option",{children:t},t)})]}),
   n.jsx("input",{className:"ui-input",placeholder:"GSTIN",value:Fm.gst,onChange:set("gst")}),
   n.jsx("input",{className:"ui-input",placeholder:L("District","மாவட்டம்"),value:Fm.district,onChange:set("district")}),
   n.jsx("input",{className:"ui-input",placeholder:L("Address","முகவரி"),value:Fm.addr,onChange:set("addr")}),
   n.jsx("button",{className:"ui-btn ui-btn-primary ui-btn-sm",onClick:submit,children:L("Add Vendor","சேர்")})]}):null,
  st?n.jsx("div",{style:{fontSize:13,marginBottom:8,color:st.indexOf("✓")>=0?"#0a7d43":(st.indexOf("✗")>=0?"#b3261e":"var(--tx-3)")},children:st}):null,
  n.jsx(EyTblX,{head:["Code",L("Name","பெயர்"),L("Type","வகை"),"GSTIN",L("Mobile","கைபேசி"),L("District","மாவட்டம்"),perm.canDelVen?L("Actions","செயல்"):""],children:
   !list?[n.jsx("tr",{children:n.jsx("td",{colSpan:7,className:"ui-empty",children:L("Loading…","ஏற்றுகிறது…")})},"l")]:
   list.length?list.map(function(v2){return n.jsxs("tr",{children:[
    n.jsx("td",{className:"mono",children:v2.vendorCode}),
    n.jsx("td",{style:{fontWeight:600},children:v2.vendorName}),
    n.jsx("td",{children:v2.businessType}),
    n.jsx("td",{className:"mono",children:v2.gstNumber||"—"}),
    n.jsx("td",{className:"mono",children:v2.mobile||"—"}),
    n.jsx("td",{children:v2.districtName}),
    n.jsx("td",{children:perm.canDelVen?n.jsx("button",{className:"ui-btn ui-btn-sm",title:"🗑",onClick:function(){rm(v2)},children:"🗑"}):"—"})]},v2.vendorCode)}):
   [n.jsx("tr",{children:n.jsx("td",{colSpan:7,className:"ui-empty",children:L("No vendors yet","இன்னும் வணிகர் இல்லை")})},"e")]})]})}
function EyTxnForm(p){
 var v=p.v,onDone=p.onDone;
 const{lang:f}=xe();
 var L=function(a,b){return f==="ta"?b:a};
 var vens=Object.keys(v.ven||{}).map(function(g){return v.ven[g]});
 var ags=(v.ag||[]).filter(function(r){return /^AGT/.test(String(r[0]||""))});
 var[Fm,SFm]=E.useState({vc:vens[0]?vens[0].code:"",fy:"2025-26",mo:"January",exp:"",adv:"",gp:"4",ag:""});
 var[st,Sst]=E.useState("");
 var set=function(k){return function(e2){var x={};x[k]=e2.target.value;SFm(function(m){return Object.assign({},m,x)})}};
 var months=["January","February","March","April","May","June","July","August","September","October","November","December"];
 var submit=function(){
  if(!Fm.vc)return Sst(L("Select vendor","வணிகரை தேர்ந்து"));
  if(!num(Fm.exp))return Sst(L("Expected amount வேணும்","எதிர்பார்ப்பு தொகை வேணும்"));
  Sst("…");
  EyV3Call("txnAdd",{vendorCode:Fm.vc,fy:Fm.fy,month:Fm.mo,expected:Fm.exp,advance:num(Fm.adv),gp:num(Fm.gp)||4,agentId:Fm.ag,user:"admin"},function(e2,d2){
   if(e2)return Sst("✗ "+e2);
   if(!d2||!d2.ok)return Sst("✗ "+((d2&&d2.error)||"தவறு"));
   Sst("✓ "+(d2.txnId||""));setTimeout(function(){onDone&&onDone()},900)})};
 return n.jsxs("div",{className:"ui-card",style:{border:"1px solid var(--accent)"},children:[
  n.jsx("div",{style:{fontWeight:800,marginBottom:8},children:"+ "+L("New Transaction (vendor-month)","புது பரிவர்த்தனை (வணிகர்-மாதம்)")}),
  n.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8},children:[
   n.jsxs("select",{className:"ui-input",value:Fm.vc,onChange:set("vc"),children:[
    vens.map(function(v2){return n.jsx("option",{value:v2.code,children:(v2.vendorName||v2.code)+" · "+v2.code},v2.code)})]}),
   n.jsxs("select",{className:"ui-input",value:Fm.fy,onChange:set("fy"),children:[
    ["2024-25","2025-26","2026-27","2027-28"].map(function(x){return n.jsx("option",{children:x},x)})]}),
   n.jsxs("select",{className:"ui-input",value:Fm.mo,onChange:set("mo"),children:[
    months.map(function(x){return n.jsx("option",{children:x},x)})]}),
   n.jsx("input",{className:"ui-input",type:"number",placeholder:L("Expected ₹ *","எதிர்பார்ப்பு ₹ *"),value:Fm.exp,onChange:set("exp")}),
   n.jsx("input",{className:"ui-input",type:"number",placeholder:L("Advance ₹","முன்பணம் ₹"),value:Fm.adv,onChange:set("adv")}),
   n.jsx("input",{className:"ui-input",type:"number",placeholder:"GST %",value:Fm.gp,onChange:set("gp")}),
   n.jsxs("select",{className:"ui-input",value:Fm.ag,onChange:set("ag"),children:[
    n.jsx("option",{value:"",children:L("Agent: —","ஏஜென்ட்: —")}),
    ags.map(function(a2){return n.jsx("option",{value:String(a2[0]),children:String(a2[1])+" ("+String(a2[2])+")"},String(a2[0]))})]}),
   n.jsx("button",{className:"ui-btn ui-btn-primary ui-btn-sm",onClick:submit,children:L("Create Transaction","உருவாக்கு")})]}),
  (Fm.vc&&(v.txn||[]).length)?(function(){
   var sTx=v.txn.filter(function(t){return String(t.vc)===Fm.vc});
   var sIds={};sTx.forEach(function(t){sIds[t.id]=1});
   var sBl=(v.bil||[]).filter(function(b){return sIds[String(b.txn)]});
   var sExp=sTx.reduce(function(a,t){return a+(+t.exp||0)},0),sBt=sBl.reduce(function(a,b){return a+(+b.tot||0)},0);
   return n.jsx("div",{style:{fontSize:12.5,color:"var(--tx-3)",marginTop:6},children:L("This vendor so far","இந்த வணிகர் இதுவரை")+": "+sTx.length+" txns · "+L("Expected","எதிர்பார்ப்பு")+" ₹"+EyVbInr(sExp)+" · "+L("Bills","பில்கள்")+" ₹"+EyVbInr(sBt)+(sTx.length?" · "+sTx.map(function(t){return (EyV3M3(t.mo)||"?")+"/"+String(t.st||"?")}).join(", "):"")})})():null,
  Fm.exp?n.jsx("div",{style:{fontSize:12,color:"var(--tx-3)",marginTop:6},children:L("GST amount","GST தொகை")+" = ₹"+EyVbInr(num(Fm.exp)*num(Fm.gp)/100)+" · "+L("GST balance after advance","முன்பணத்திற்குப் பின் GST மீதி")+" = ₹"+EyVbInr(num(Fm.exp)*num(Fm.gp)/100-num(Fm.adv))}):null,
  st?n.jsx("div",{style:{fontSize:13,marginTop:6,color:st.indexOf("✓")>=0?"#0a7d43":(st.indexOf("✗")>=0?"#b3261e":"var(--tx-3)")},children:st}):null]})}
function EyTxnOps(p){
 var h=p.h,L=p.L,refresh=p.refresh;
 var v=EyV3||{ag:[],wal:[]};
 var[bf,Sbf]=E.useState(false),[imp,Simp]=E.useState(false);
 var[Fm,SFm]=E.useState({no:"",date:new Date().toISOString().slice(0,10),amt:"",gp:h?(h.gp||4):4});
 var[tabs,Stabs]=E.useState(null),[tab2,Stab2]=E.useState(""),[rows2,Srows2]=E.useState(null),[sel,Ssel]=E.useState({}),[q2,Sq2]=E.useState("");
 var[st,Sst]=E.useState(""),[busy,Sbusy]=E.useState(false);
 var wallet=(v.wal||[]).filter(function(r){return /^AW/.test(String(r[0]||""))&&String(r[4]||"").trim()===h.id});
 var submitBill=function(){
  if(!num(Fm.amt))return Sst(L("Amount வேணும்","தொகை வேணும்"));
  Sst("…");
  EyV3Call("billAdd",{txnId:h.id,no:Fm.no,date:Fm.date,amt:num(Fm.amt),gp:num(Fm.gp)||h.gp||4,user:"admin"},function(e2,d2){
   if(e2)return Sst("✗ "+e2);
   if(!d2||!d2.ok)return Sst("✗ "+((d2&&d2.error)||"தவறு"));
   Sst("✓ "+(d2.billId||""));Sbf(false);SFm({no:"",date:Fm.date,amt:"",gp:h.gp||4});setTimeout(refresh,900)})};
 var openImp=function(){
  if(imp){Simp(false);return}
  Simp(true);Stabs(null);Srows2(null);
  EyV3Call("list",{tab:"2btabs"},function(e2,d2){
   if(e2)return Sst("✗ "+e2);
   var tl=(d2&&d2.rows)||[];Stabs(tl);
   if(tl.length){Stab2(tl[0]);EyV3Call("bills2B",{sheet:tl[0]},function(e3,d3){
    if(e3||!d3||!d3.ok)return Sst("✗ "+((e3)||(d3&&d3.error)||""));
    Srows2(d3.rows||[])})}})};
 var loadTab=function(name){Stab2(name);Srows2(null);
  EyV3Call("bills2B",{sheet:name},function(e3,d3){
   if(e3||!d3||!d3.ok)return Sst("✗ "+((e3)||(d3&&d3.error)||""));
   Srows2(d3.rows||[])})};
 var doImport=function(){
  var picked=Object.keys(sel).filter(function(k){return sel[k]});
  if(!picked.length)return Sst(L("Select bills","பில்களை தேர்ந்து"));
  Sbusy(true);Sst("0/"+picked.length+" …");
  var i2=0;
  function next(){
   if(i2>=picked.length){Sbusy(false);Sst("✓ "+picked.length+" "+L("bills imported","பில்கள் இறக்கப்பட்டன"));Ssel({});setTimeout(refresh,1000);return}
   var r=rows2[+picked[i2]];
   EyV3Call("billAdd",{txnId:h.id,no:r.inv,date:r.dt,amt:r.taxable,gp:h.gp||4,user:"admin"},function(e3){
    i2++;Sst(i2+"/"+picked.length+" …");
    if(e3){Sbusy(false);Sst("✗ "+e3+" ("+(r.inv||"")+")");return}
    next()})}
  next()};
 var doConfirm=function(){
  if(!confirm(L("Confirm & Close this transaction? 2B summary will be updated.","இந்த பரிவர்த்தனையை உறுதி செய்து Close பண்ணவா? 2B summary புதுப்பிக்கப்படும்")))return;
  Sst("…");
  EyV3Call("txnConfirm",{txnId:h.id,user:"admin"},function(e2,d2){
   if(e2)return Sst("✗ "+e2);
   if(!d2||!d2.ok)return Sst("✗ "+((d2&&d2.error)||"தவறு"));
   Sst("✓ Closed · "+L("bills","பில்கள்")+" ₹"+EyVbInr(d2.billsTotal));setTimeout(refresh,900)})};
 var qq=q2.trim().toLowerCase();
 var shown=(rows2||[]).filter(function(r){return !qq||(r.inv||"").toLowerCase().indexOf(qq)>=0}).slice(0,300);
 return n.jsxs("div",{children:[
  n.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap",margin:"10px 0"},children:[
   n.jsx("button",{className:"ui-btn ui-btn-sm "+(bf?"ui-btn-primary":""),onClick:function(){Sbf(!bf)},children:(bf?"✕ ":"+ ")+L("Bill","பில்")}),
   n.jsx("button",{className:"ui-btn ui-btn-sm "+(imp?"ui-btn-primary":""),onClick:openImp,children:"⬇ 2B "+L("Import","இறக்குமதி")}),
   (h&&h.st!=="Closed")?n.jsx("button",{className:"ui-btn ui-btn-sm",style:{background:"#0a7d43",color:"#fff",border:0},onClick:doConfirm,children:"✓ "+L("Confirm (2B + Close)","உறுதி (2B + Close)")}):null,
   wallet.length?n.jsx("span",{style:{fontSize:12,color:"var(--tx-3)",alignSelf:"center"},children:L("Commission","கமிஷன்")+" = ₹"+EyVbInr(wallet[0][9])+" ("+wallet[0][8]+"%)"}):null]}),
  bf?n.jsxs("div",{className:"ui-card",style:{marginBottom:10},children:[
   n.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8},children:[
    n.jsx("input",{className:"ui-input",placeholder:L("Bill No","பில் எண்"),value:Fm.no,onChange:function(e2){SFm(Object.assign({},Fm,{no:e2.target.value}))}}),
    n.jsx("input",{className:"ui-input",type:"date",value:Fm.date,onChange:function(e2){SFm(Object.assign({},Fm,{date:e2.target.value}))}}),
    n.jsx("input",{className:"ui-input",type:"number",placeholder:L("Amount ₹ *","தொகை ₹ *"),value:Fm.amt,onChange:function(e2){SFm(Object.assign({},Fm,{amt:e2.target.value}))}}),
    n.jsx("input",{className:"ui-input",type:"number",placeholder:"GST %",value:Fm.gp,onChange:function(e2){SFm(Object.assign({},Fm,{gp:e2.target.value}))}}),
    n.jsx("button",{className:"ui-btn ui-btn-primary ui-btn-sm",onClick:submitBill,children:L("Add Bill","சேர்")})]}),
   n.jsx("div",{style:{fontSize:12,color:"var(--tx-3)",marginTop:5},children:L("Total = amount × 1.18 (V3 rule)","மொத்தம் = தொகை × 1.18 (V3 விதி)")})]}):null,
  imp?n.jsxs("div",{className:"ui-card",style:{marginBottom:10},children:[
   n.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8},children:[
    tabs?n.jsxs("select",{className:"ui-input",style:{maxWidth:240},value:tab2,onChange:function(e2){loadTab(e2.target.value)},children:[
     tabs.map(function(t2){return n.jsx("option",{value:t2,children:t2},t2)})]}):n.jsx("span",{children:"…"}),
    n.jsx("input",{className:"ui-input",style:{maxWidth:200},placeholder:L("Filter invoice…","Invoice வடிகட்டு…"),value:q2,onChange:function(e2){Sq2(e2.target.value)}}),
    n.jsx("div",{style:{flex:1}}),
    rows2?n.jsx("button",{className:"ui-btn ui-btn-primary ui-btn-sm",disabled:busy,onClick:doImport,children:L("Import selected","தேர்ந்தவற்றை இறக்கு")+" ("+Object.keys(sel).filter(function(k){return sel[k]}).length+")"}):null]}),
   rows2?(shown.length?n.jsx("div",{style:{maxHeight:260,overflowY:"auto"},children:n.jsx(EyTblX,{head:["",L("Invoice","Invoice"),L("Date","தேதி"),L("Taxable ₹","வரி மதிப்பு ₹"),L("Total ₹","மொத்த ₹")],children:
    shown.map(function(r,i2){var key=String((rows2.indexOf(r)));return n.jsxs("tr",{children:[
     n.jsx("td",{children:n.jsx("input",{type:"checkbox",checked:!!sel[key],onChange:function(e2){var x=Object.assign({},sel);x[key]=e2.target.checked;Ssel(x)}})}),
     n.jsx("td",{className:"mono",children:r.inv}),
     n.jsx("td",{className:"mono",children:r.dt}),
     n.jsx("td",{className:"mono",children:"₹"+EyVbInr(r.taxable)}),
     n.jsx("td",{className:"mono",children:"₹"+EyVbInr(r.total)})]},key)})})}):n.jsx("div",{className:"ui-empty",children:L("No rows","வரிசை இல்லை")})):n.jsx("div",{className:"ui-empty",children:L("Loading…","ஏற்றுகிறது…")})]}):null,
  st?n.jsx("div",{style:{fontSize:13,marginBottom:8,color:st.indexOf("✓")>=0?"#0a7d43":(st.indexOf("✗")>=0?"#b3261e":"var(--tx-3)")},children:st}):null]})}

function EyV3Role(){
 try{
  var u=JSON.parse(sessionStorage.getItem("ar4.user")||"null");
  if(!u)return{role:"none",canAddVen:false,canDelVen:false};
  var r;
  if(u.v3){var m={super_admin:"admin",district_admin:"district",agent:"agent",auditor:"auditor",vendor:"vendor"};r=m[u.role]||"other"}
  else r=(u.role==="super_admin"?"admin":"other");
  return {role:r,canAddVen:r==="admin"||r==="district"||r==="agent",canDelVen:r==="admin"||r==="district"};
 }catch(e){return {role:"none",canAddVen:false,canDelVen:false}}
}
function EyV3Session(d){
  var role=String(d.role||"").toLowerCase();
  var map={admin:"super_admin",district:"district_admin",auditor:"auditor",vendor:"vendor",agent:"agent"};
  return {username:d.username,name:d.username,role:map[role]||"district_admin",v3:true,v3userId:d.userId,v3district:d.districtName||"",agentId:d.agentId||""};
}
function EyV3LoginBox(p){
  const{lang:f}=xe();var L=function(a,b){return f==="ta"?b:a};
  var[un,Sun]=E.useState(""),[pw,Spw]=E.useState(""),[st,Sst]=E.useState(""),[bsy,Sbsy]=E.useState(false);
  function go(){
    if(bsy)return;Sbsy(true);Sst("");
    EyV3Call("login",{u:un,p:pw},function(e,d){
      Sbsy(false);
      if(e||!d||!d.ok){Sst("✗ "+L("Login failed","உள்நுழைவு தவறு")+" — "+String((d&&d.error)||e||""));return}
      var u2=EyV3Session(d);
      try{sessionStorage.setItem("ar4.token","v3:"+d.userId);sessionStorage.setItem("ar4.user",JSON.stringify(u2))}catch(e2){}
      Sst("✓ "+L("Welcome ","வரவேற்பு ")+d.username);
      if(p.onDone)setTimeout(function(){p.onDone(u2)},150);
    });
  }
  return n.jsx("form",{onSubmit:function(ev){ev.preventDefault();go()},children:n.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:14},children:[
    n.jsx("div",{style:{fontSize:12,color:"var(--tx-3)"},children:L("V3 workbook users (User_Config) — admin / district manager / auditor / vendor","V3 workbook பயனர்கள் (User_Config) — நிர்வாகம் / மாவட்ட மேலாளர் / தணிக்கை / வணிகர்")}),
    n.jsx("input",{className:"ui-input",placeholder:L("Username","பயனர்பெயர்"),value:un,onChange:function(e){Sun(e.target.value)},autoComplete:"username"}),
    n.jsx("input",{className:"ui-input",type:"password",placeholder:L("Password","கடவுச்சொல்"),value:pw,onChange:function(e){Spw(e.target.value)},autoComplete:"current-password"}),
    n.jsx("button",{className:"ui-btn ui-btn-primary",type:"submit",disabled:bsy,children:bsy?"…":L("V3 Login","V3 உள்நுழைவு")}),
    st?n.jsx("div",{style:{fontSize:12,color:st.indexOf("✓")>=0?"#0a7d43":"#b3261e"},children:st}):null
  ]})})}
function EyV3UsersCard(){
  const{lang:f}=xe();var L=function(a,b){return f==="ta"?b:a};
  var[rows,Srows]=E.useState(null),[st,Sst]=E.useState(""),[ed,Sed]=E.useState(null),[bsy,Sbsy]=E.useState(false);
  var[un,Sun]=E.useState(""),[pw,Spw]=E.useState(""),[rl,Srl]=E.useState("district"),[dn,Sdn]=E.useState("Pudukkottai");
  function load(){Srows(null);EyV3Call("list",{tab:"users"},function(e,d){if(e){Srows([]);Sst("✗ "+String(e).slice(0,120));return}Srows((d&&d.rows)||[])})}
  E.useEffect(function(){load()},[]);
  function add(){
    if(!un.trim()||!pw){Sst("✗ "+L("Username & password required","பயனர்பெயர் & கடவுச்சொல் வேணும்"));return}
    Sbsy(true);EyV3Call("userAdd",{username:un,password:pw,role:rl,district:dn,user:"admin"},function(e,d){Sbsy(false);
      if(e||(d&&!d.ok)){Sst("✗ "+String((d&&d.error)||e).slice(0,140));return}
      Sst("✓ "+L("User added ","பயனர் சேர்க்கப்பட்டார் ")+(d&&d.userId?("("+d.userId+")"):""));Sun("");Spw("");load();});}
  function saveEd(){
    Sbsy(true);EyV3Call("userEdit",{userId:ed.id,username:ed.un,password:ed.pw,role:ed.rl,district:ed.dn,user:"admin"},function(e,d){Sbsy(false);
      if(e||(d&&!d.ok)){Sst("✗ "+String((d&&d.error)||e).slice(0,140));return}
      Sst("✓ "+L("Updated ","மேம்படுத்தப்பட்டது ")+ed.un);Sed(null);load();});}
  function rm(r2){
    if(!window.confirm(L("Remove user "+r2.username+"?","பயனர் "+r2.username+" ஐ நீக்கவா?")))return;
    Sbsy(true);EyV3Call("userRemove",{userId:r2.userId,user:"admin"},function(e,d){Sbsy(false);
      if(e||(d&&!d.ok)){Sst("✗ "+String((d&&d.error)||e).slice(0,140));return}
      Sst("✓ "+L("Removed","நீக்கப்பட்டது"));load();});}
  var tbl=null;
  if(rows===null)tbl=n.jsx("div",{className:"ui-empty",children:L("Loading…","ஏற்றுகிறது…")});
  else if(!rows.length)tbl=n.jsx("div",{className:"ui-empty",children:L("No V3 users","V3 பயனர்கள் இல்லை")});
  else tbl=n.jsx("table",{className:"gtbl",children:n.jsx("tbody",{children:rows.map(function(r,i){
    return n.jsxs("tr",{children:[
      n.jsx("td",{className:"mono",children:r.userId}),
      n.jsx("td",{children:r.username}),
      n.jsx("td",{children:"••••••"}),
      n.jsx("td",{children:r.role||"—"}),
      n.jsx("td",{children:r.districtName||"—"}),
      n.jsxs("td",{children:[
        n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:function(){Sed({id:r.userId,un:r.username,pw:"",rl:r.role||"district",dn:r.districtName||""})},children:"✏"}),
        " ",
        n.jsx("button",{className:"ui-btn ui-btn-sm",disabled:bsy,onClick:function(){rm(r)},children:"🗑"})]},"a")]},r.userId)})})});
  return n.jsxs("div",{className:"ui-card",style:{marginBottom:12},children:[
    n.jsxs("div",{style:{display:"flex",gap:8,alignItems:"center",marginBottom:8},children:[
      n.jsx("div",{style:{fontWeight:800},children:"👥 "+L("V3 Users & Roles (User_Config)","V3 பயனர்கள் & பங்குகள் (User_Config)")}),
      n.jsx("div",{style:{flex:1}}),
      n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:load,children:"↻"})]}),
    n.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10},children:[
      n.jsx("input",{className:"ui-input",style:{width:150},placeholder:L("Username","பயனர்பெயர்"),value:un,onChange:function(e){Sun(e.target.value)}}),
      n.jsx("input",{className:"ui-input",style:{width:150},placeholder:L("Password","கடவுச்சொல்"),value:pw,onChange:function(e){Spw(e.target.value)}}),
      n.jsxs("select",{className:"ui-input",style:{width:130},value:rl,onChange:function(e){Srl(e.target.value)},children:[
        n.jsx("option",{value:"admin",children:"admin"}),n.jsx("option",{value:"district",children:"district"}),
        n.jsx("option",{value:"auditor",children:"auditor"}),n.jsx("option",{value:"vendor",children:"vendor"})]}),
      n.jsx("input",{className:"ui-input",style:{width:150},placeholder:L("District","மாவட்டம்"),value:dn,onChange:function(e){Sdn(e.target.value)}}),
      n.jsx("button",{className:"ui-btn ui-btn-primary ui-btn-sm",disabled:bsy,onClick:add,children:"+ "+L("Add user","பயனர் சேர்")})]}),
    tbl,
    ed?n.jsxs("div",{style:{marginTop:10,padding:10,border:"1px solid var(--line)",borderRadius:8},children:[
      n.jsx("div",{style:{fontWeight:700,marginBottom:6},children:"✏ "+L("Edit user ","பயனரை திருத்து ")+ed.id}),
      n.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap"},children:[
        n.jsx("input",{className:"ui-input",style:{width:150},value:ed.un,onChange:function(e){Sed(Object.assign({},ed,{un:e.target.value}))},placeholder:L("Username","பயனர்பெயர்")}),
        n.jsx("input",{className:"ui-input",style:{width:150},value:ed.pw,onChange:function(e){Sed(Object.assign({},ed,{pw:e.target.value}))},placeholder:L("New password (blank = same)","புது கடவுச்சொல் (காலியானால் அதே)")}),
        n.jsxs("select",{className:"ui-input",style:{width:130},value:ed.rl,onChange:function(e){Sed(Object.assign({},ed,{rl:e.target.value}))},children:[
          n.jsx("option",{value:"admin",children:"admin"}),n.jsx("option",{value:"district",children:"district"}),
          n.jsx("option",{value:"auditor",children:"auditor"}),n.jsx("option",{value:"vendor",children:"vendor"})]}),
        n.jsx("input",{className:"ui-input",style:{width:150},value:ed.dn,onChange:function(e){Sed(Object.assign({},ed,{dn:e.target.value}))},placeholder:L("District","மாவட்டம்")}),
        n.jsx("button",{className:"ui-btn ui-btn-primary ui-btn-sm",disabled:bsy,onClick:saveEd,children:L("Save","சேமி")}),
        n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:function(){Sed(null)},children:L("Cancel","ரத்து")})]})]}):null,
    st?n.jsx("div",{style:{fontSize:13,marginTop:8,color:st.indexOf("✓")>=0?"#0a7d43":"#b3261e"},children:st}):null]})}
function EyV3AgentsCard(){
  const{lang:f}=xe();var L=function(a,b){return f==="ta"?b:a};
  var[rows,Srows]=E.useState(null),[st,Sst]=E.useState(""),[bsy,Sbsy]=E.useState(false);
  var[fn2,Sfn]=E.useState(""),[un,Sun]=E.useState(""),[pw,Spw]=E.useState(""),[mb,Smb]=E.useState(""),[md,Smd]=E.useState("Pudukkottai"),[cp,Scp]=E.useState("0.5");
  function load(){Srows(null);EyV3Call("list",{tab:"agents"},function(e,d){if(e){Srows([]);Sst("✗ "+String(e).slice(0,120));return}Srows((d&&d.rows)||[])})}
  E.useEffect(function(){load()},[]);
  function add(){
    if(!fn2.trim()){Sst("✗ "+L("Full name required","பெயர் வேணும்"));return}
    Sbsy(true);EyV3Call("agentAdd",{fullName:fn2,username:un,password:pw,mobile:mb,managerDistrict:md,cpercent:cp,user:"admin"},function(e,d){Sbsy(false);
      if(e||(d&&!d.ok)){Sst("✗ "+String((d&&d.error)||e).slice(0,140));return}
      Sst("✓ "+L("Agent added ","ஏஜெண்ட் சேர்க்கப்பட்டார் ")+(d&&d.agentId||""));Sfn("");Sun("");Spw("");Smb("");load();});}
  function setPct(r2){
    var v2=window.prompt(L("Commission % for "+r2.fullName,"கமிஷன் % — "+r2.fullName),String(r2.cpercent||"0.5"));
    if(v2===null)return;
    Sbsy(true);EyV3Call("agentEdit",{agentId:r2.agentId,cpercent:v2,user:"admin"},function(e,d){Sbsy(false);
      if(e||(d&&!d.ok)){Sst("✗ "+String((d&&d.error)||e).slice(0,140));return}
      Sst("✓ "+r2.agentId+" → "+v2+"%");load();});}
  function tog(r2){
    var ns=String(r2.status||"")==="Inactive"?"approved":"Inactive";
    Sbsy(true);EyV3Call(ns==="Inactive"?"agentRemove":"agentEdit",ns==="Inactive"?{agentId:r2.agentId,user:"admin"}:{agentId:r2.agentId,status:ns,user:"admin"},function(e,d){Sbsy(false);
      if(e||(d&&!d.ok)){Sst("✗ "+String((d&&d.error)||e).slice(0,140));return}
      Sst("✓ "+r2.agentId+" → "+ns);load();});}
  var tbl=null;
  if(rows===null)tbl=n.jsx("div",{className:"ui-empty",children:L("Loading…","ஏற்றுகிறது…")});
  else if(!rows.length)tbl=n.jsx("div",{className:"ui-empty",children:L("No agents yet","ஏஜெண்ட்கள் இல்லை")});
  else tbl=n.jsx("table",{className:"gtbl",children:n.jsx("tbody",{children:rows.map(function(r){return n.jsxs("tr",{children:[
    n.jsx("td",{className:"mono",children:r.agentId}),
    n.jsx("td",{children:r.fullName}),
    n.jsx("td",{children:r.username||"—"}),
    n.jsx("td",{children:r.mobile||"—"}),
    n.jsx("td",{children:r.managerDistrict||"—"}),
    n.jsx("td",{className:"mono",children:(r.cpercent||"0.5")+"%"}),
    n.jsx("td",{children:String(r.status||"")==="Inactive"?n.jsx("span",{style:{color:"#b3261e"},children:"Inactive"}):n.jsx("span",{style:{color:"#0a7d43"},children:"Active"})}),
    n.jsxs("td",{children:[
      n.jsx("button",{className:"ui-btn ui-btn-sm",disabled:bsy,onClick:function(){setPct(r)},children:"%"}),
      " ",
      n.jsx("button",{className:"ui-btn ui-btn-sm",disabled:bsy,onClick:function(){tog(r)},children:String(r.status||"")==="Inactive"?"✓":"⊘"})]},"a")]},r.agentId)})})});
  return n.jsxs("div",{className:"ui-card",style:{marginBottom:12},children:[
    n.jsxs("div",{style:{display:"flex",gap:8,alignItems:"center",marginBottom:8},children:[
      n.jsx("div",{style:{fontWeight:800},children:"🤝 "+L("V3 Agents (1 district · 1 agent basis, unlimited)","V3 ஏஜெண்ட்கள் (ஒரு மாவட்டம் · ஒரு ஏஜெண்ட், எத்தனை வேணுமானாலும்)")}),
      n.jsx("div",{style:{flex:1}}),
      n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:load,children:"↻"})]}),
    n.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10},children:[
      n.jsx("input",{className:"ui-input",style:{width:160},placeholder:L("Full name","முழு பெயர்"),value:fn2,onChange:function(e){Sfn(e.target.value)}}),
      n.jsx("input",{className:"ui-input",style:{width:130},placeholder:L("Username","பயனர்பெயர்"),value:un,onChange:function(e){Sun(e.target.value)}}),
      n.jsx("input",{className:"ui-input",style:{width:130},placeholder:L("Password","கடவுச்சொல்"),value:pw,onChange:function(e){Spw(e.target.value)}}),
      n.jsx("input",{className:"ui-input",style:{width:130},placeholder:L("Mobile","கைபேசி"),value:mb,onChange:function(e){Smb(e.target.value)}}),
      n.jsx("input",{className:"ui-input",style:{width:140},placeholder:L("Manager district","மாவட்டம்"),value:md,onChange:function(e){Smd(e.target.value)}}),
      n.jsx("input",{className:"ui-input",style:{width:80},value:cp,onChange:function(e){Scp(e.target.value)},title:"%"}),
      n.jsx("button",{className:"ui-btn ui-btn-primary ui-btn-sm",disabled:bsy,onClick:add,children:"+ "+L("Add agent","ஏஜெண்ட் சேர்")})]}),
    tbl,
    st?n.jsx("div",{style:{fontSize:13,marginTop:8,color:st.indexOf("✓")>=0?"#0a7d43":"#b3261e"},children:st}):null]})}

function EyV3BillsCard(){
 const{lang:f}=xe();var L=function(a,b){return f==="ta"?b:a};
 var[list,Slist]=E.useState(null),[tabs,Stabs]=E.useState(null),[tab2,Stab2]=E.useState("");
 var[vc,Svc]=E.useState(""),[rows2,Srows2]=E.useState(null),[sup,Ssup]=E.useState(""),[q2,Sq2]=E.useState("");
 var[sel,Ssel]=E.useState({}),[busy,Sbusy]=E.useState(false),[st,Sst]=E.useState(""),[prg,Sprg]=E.useState("");
 var loadV=function(){Slist(null);EyV3Call("list",{tab:"vendors"},function(e2,d2){Slist(e2?[]:((d2&&d2.rows)||[]))})};
 E.useEffect(function(){loadV();EyV3Call("list",{tab:"2btabs"},function(e2,d2){var tl=e2?[]:((d2&&d2.rows)||[]);Stabs(tl);if(tl.length)Stab2(tl[0])})},[]);
 var norm=function(x){return String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"")};
 var loadTab=function(name){if(!name)return;Srows2(null);Ssel({});Ssup("");
  EyV3Call("bills2B",{sheet:name},function(e2,d2){Srows2(e2?[]:((d2&&d2.rows)||[]))})};
 E.useEffect(function(){loadTab(tab2)},[tab2]);
 var rows=rows2||[];
 var supNames=[];(function(){var seen={};rows.forEach(function(r){var k=r.nm||"—";if(!seen[k]){seen[k]=1;supNames.push(k)}});supNames.sort()})();
 var selVen=(list||[]).filter(function(x){return x.vendorCode===vc})[0]||null;
 var autoSup=null;
 if(selVen&&rows2){var vn=norm(selVen.vendorName);supNames.forEach(function(sn){if(!autoSup){var sn2=norm(sn);if(sn2&&(sn2===vn||(sn2.indexOf(vn)>=0)||(vn.indexOf(sn2)>=0)))autoSup=sn}})}
 var effSup=sup||autoSup||"";
 var mRows=rows.filter(function(r){return !effSup||effSup==="—"||r.nm===effSup});
 var qq=q2.trim().toLowerCase();
 var shown=mRows.filter(function(r){return !qq||String(r.inv).toLowerCase().indexOf(qq)>=0});
 var selKeys=Object.keys(sel).filter(function(k){return sel[k]});
 var sTax=0,sTot=0;selKeys.forEach(function(k){var r=rows[+k];if(r){sTax+=(+r.taxable||0);sTot+=(+r.total||0)}});
 var doImport=function(){
  if(!vc)return Sst("✗ "+L("Select vendor","வணிகரை தேர்ந்து"));
  var ks=Object.keys(sel).filter(function(k){return sel[k]});
  if(!ks.length)return Sst("✗ "+L("Select bills first","முதலில் பில்களை தேர்ந்து"));
  Sbusy(true);Sst("…");Sprg("0/"+ks.length);
  EyV3Call("list",{tab:"txns"},function(e2,d2){
   var tx=(e2?[]:((d2&&d2.rows)||[])).filter(function(t){return String(t.vendorCode)===vc});
   var m3=EyV3M3(String(tab2).split("_").pop());
   var tn=tx.filter(function(t){return EyV3M3(t.month)===m3})[0];
   if(!tn){Sbusy(false);Sprg("");return Sst("✗ "+L("No transaction for this vendor-month — create it in Transactions first","இந்த வணிகர்-மாதத்துக்கு transaction இல்லை — முதலில் Transactions பக்கத்தில் உருவாக்குங்க"))}
   var i=0,fails=0;
   var next=function(){
    if(i>=ks.length){Sbusy(false);Sprg("");Ssel({});Sst("✓ "+(i-fails)+" "+L("bills imported to ","பில்கள் சேர்க்கப்பட்டன ")+tn.txnId+(fails?" · ✗ "+fails:""));return}
    var r=rows[+ks[i]];
    EyV3Call("billAdd",{txnId:tn.txnId,no:r.inv,date:r.dt,amt:r.taxable,gp:num(tn.gp)||4,user:"admin"},function(e3){
     if(e3)fails++;i++;Sprg(i+"/"+ks.length);next()})};
   next()})};
 return n.jsxs("div",{className:"ui-card",style:{marginTop:12},children:[
  n.jsx(EyV3SetupCard,{on:!EyV3Url()}),
  n.jsxs("div",{style:{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"},children:[
   n.jsx("div",{style:{fontWeight:800},children:"🧾 "+L("Bills from GSTR-2B (V3)","GSTR-2B இலிருந்து பில்கள் (V3)")}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:function(){loadV();loadTab(tab2)},children:"↻"})]}),
  n.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10},children:[
   n.jsxs("select",{className:"ui-input",style:{maxWidth:260},value:vc,onChange:function(e2){Svc(e2.target.value);Ssup("");Ssel({})},children:[
    n.jsx("option",{value:"",children:L("— Select vendor —","— வணிகரை தேர்ந்து —")}),
    (list||[]).map(function(v2){return n.jsx("option",{value:v2.vendorCode,children:(v2.vendorName||v2.vendorCode)+" · "+v2.vendorCode},v2.vendorCode)})]}),
   n.jsxs("select",{className:"ui-input",style:{maxWidth:220},value:tab2,onChange:function(e2){Stab2(e2.target.value)},children:[
    (tabs||[]).map(function(t2){return n.jsx("option",{value:t2,children:t2},t2)})]}),
   n.jsxs("select",{className:"ui-input",style:{maxWidth:220},value:effSup,onChange:function(e2){Ssup(e2.target.value);Ssel({})},children:[
    n.jsx("option",{value:"",children:L("— Supplier —","— சப்ளையர் —")}),
    supNames.map(function(sn){return n.jsx("option",{value:sn,children:sn+" ("+sups_count(rows,sn)+")"},sn)})]}),
   n.jsx("input",{className:"ui-input",style:{maxWidth:190},placeholder:L("Filter invoice…","Invoice வடிகட்டு…"),value:q2,onChange:function(e2){Sq2(e2.target.value)}}),
   busy?n.jsx("span",{style:{fontSize:12,color:"var(--tx-3)",alignSelf:"center"},children:prg}):null]}),
  rows2?(shown.length?n.jsx("div",{style:{maxHeight:300,overflowY:"auto"},children:n.jsx(EyTblX,{head:["",L("Supplier","சப்ளையர்"),L("Invoice","Invoice"),L("Date","தேதி"),L("Taxable ₹","வரி மதிப்பு ₹"),L("Total ₹","மொத்த ₹")],children:
   shown.map(function(r){var key=String(rows.indexOf(r));return n.jsxs("tr",{children:[
    n.jsx("td",{children:n.jsx("input",{type:"checkbox",checked:!!sel[key],onChange:function(e2){var x=Object.assign({},sel);x[key]=e2.target.checked;Ssel(x)}})}),
    n.jsx("td",{children:r.nm||"—"}),
    n.jsx("td",{className:"mono",children:r.inv}),
    n.jsx("td",{className:"mono",children:r.dt}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(r.taxable)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(r.total)})]},key)})})}):n.jsx("div",{className:"ui-empty",children:rows.length?L("No rows for this supplier/filter","இந்த சப்ளையர்/வடிகட்டிற்கு வரிசை இல்லை"):L("No 2B rows","2B வரிசை இல்லை")})):n.jsx("div",{className:"ui-empty",children:L("Loading…","ஏற்றுகிறது…")}),
  n.jsxs("div",{style:{display:"flex",gap:10,alignItems:"center",marginTop:10,flexWrap:"wrap"},children:[
   selKeys.length?n.jsx("span",{style:{fontSize:13,color:"var(--tx-3)"},children:selKeys.length+" "+L("selected","தேர்வு")+" · "+L("Taxable","வரி மதிப்பு")+" ₹"+EyVbInr(sTax)+" · "+L("Total","மொத்தம்")+" ₹"+EyVbInr(sTot)}):n.jsx("span",{}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-primary ui-btn-sm",disabled:busy||!selKeys.length,onClick:doImport,children:L("Add as bills","பில்களாக சேர்")+(selKeys.length?" ("+selKeys.length+")":"")})]}),
  st?n.jsx("div",{style:{fontSize:13,marginTop:8,color:st.indexOf("✓")>=0?"#0a7d43":"#b3261e"},children:st}):null]})}
function sups_count(rows,nm){var c2=0;for(var i2=0;i2<rows.length;i2++)if((rows[i2].nm||"—")===nm)c2++;return c2}
