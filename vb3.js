var EyV3WB="1zzbV4F_Iju2szqT0SGLgKAipXChAp8L-iHc63I4jLeQ";
var EyV3Mo={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function EyV3M3(s){return String(s||"").trim().toLowerCase().slice(0,3)}
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
 var[rd,Srd]=E.useState(0),[fy,Sfy]=E.useState(""),[q,Sq]=E.useState("");
 var L=function(a,b){return f==="ta"?b:a};
 E.useEffect(function(){EyV3Fetch(function(){Srd(function(x){return x+1})})},[]);
 if(!EyV3||!EyV3.done)return EyVbLoad("l",L("Transactions loading…","பரிவர்த்தனைகள் ஏற்றப்படுகிறது…"));
 if(EyV3.err)return n.jsx(EyVbLoad,{f:"e"});
 if(txnId)return EyTxnDetail({txnId:txnId,L:L,nav:r});
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
  n.jsxs("div",{className:"ui-card",style:{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"},children:[
   n.jsxs("select",{className:"ui-input",style:{maxWidth:170},value:fy,onChange:function(e){Sfy(e.target.value)},children:[
    n.jsx("option",{value:"",children:L("All FY","எல்லா FY")}),
    fyL.map(function(x){return n.jsx("option",{value:x,children:x},x)})]}),
   n.jsx("input",{className:"ui-input",style:{maxWidth:240},placeholder:L("Vendor / Txn ID…","வணிகர் / Txn ID…"),value:q,onChange:function(e){Sq(e.target.value)}}),
   n.jsx("div",{style:{flex:1}}),
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
 var id=p.txnId,L=p.L,nav=p.nav;
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
