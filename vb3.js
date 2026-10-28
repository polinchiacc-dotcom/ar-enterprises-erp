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
function EyV3SetupCard(p){
 var on=p&&p.on;
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
function V3VenTitle(L,list){
 return "V3 வணிகர் பதிவேடு (AR_ERP_Pudukkottai)"+(list&&list.length?" — "+list.length+" "+L("vendors","வணிகர்கள்"):"");
}
function EyV3VenCard(){
 const{lang:f}=xe();
 var L=function(a,b){return f==="ta"?b:a};
 var perm=EyV3Role();
 var[list,Slist]=E.useState(null),[af,Saf]=E.useState(false),[st,Sst]=E.useState(""),[so,Sso]=E.useState(false),[em,Sem]=E.useState("");
 var[Fm,SFm]=E.useState({name:"",district:"Pudukkottai",mobile:"",type:"Hardware",gst:"",addr:"",reg:String(new Date().getFullYear())});
 var refresh=function(){Slist(null);
  var R={api:null,gviz:null,shown:false};
  var settle=function(){
   if(R.shown)return;
   if(R.gviz&&R.gviz.rows&&R.gviz.rows.length){R.shown=true;Slist(R.gviz.rows);Sst(R.api&&R.api.err?("⚠ "+R.api.err+" — "+L("read-only list (gviz), ↻ retry / ⚙ check URL","படிக்க மட்டும் பட்டியல் (gviz), ↻ மீண்டும் முயற்சி / ⚙ URL சரிபார்க்க")):"");return}
   if(R.api&&R.api.ok){R.shown=true;Slist(R.api.rows||[]);Sst("");return}
   if(R.gviz&&R.gviz.err&&R.api&&R.api.err){R.shown=true;Slist([]);Sst("✗ "+R.api.err+" · "+R.gviz.err)}};
  gvizFetch(EyV3WB,"Vendors",function(e3,d3){
   if(e3){R.gviz={err:e3};settle();return}
   var arr=EyRawRows(d3),rows3=[],i,r;
   for(i=0;i<arr.length;i++){r=arr[i];var c=String(r[0]||"").trim();if(!c||c==="vendorCode")continue;
    rows3.push({vendorCode:c,vendorName:String(r[1]||"").trim(),districtName:String(r[2]||"").trim(),mobile:String(r[3]||"").trim(),businessType:String(r[4]||"").trim(),gstNumber:String(r[5]||"").trim(),address:String(r[6]||"").trim(),regYear:String(r[7]||"").trim()})}
   R.gviz={rows:rows3};settle()});
  EyV3Call("list",{tab:"vendors"},function(e2,d2){
   if(!e2&&d2&&d2.ok)R.api={ok:true,rows:d2.rows||[]};
   else R.api={err:e2||((d2&&d2.error)||"தவறு")};
   settle()})};
 E.useEffect(function(){refresh()},[]);
 var set=function(k){return function(e2){var x={};x[k]=e2.target.value;SFm(function(m){return Object.assign({},m,x)})}};
 var submit=function(){
  if(!Fm.name.trim())return Sst(L("Name வேணும்","பெயர் வேணும்"));
  Sst("…");
  if(em){
   EyV3Call("vendorEdit",{vendorCode:em,name:Fm.name,district:Fm.district,mobile:Fm.mobile,type:Fm.type,gst:Fm.gst,addr:Fm.addr,reg:Fm.reg,role:perm.role,user:"admin"},function(e2,d2){
    if(e2)return Sst("✗ "+e2);
    if(!d2||!d2.ok)return Sst("✗ "+((d2&&d2.error)||"தவறு"));
    Sst("✓ "+em+" — "+Fm.name);Sem("");Saf(false);refresh()});
   return}
  EyV3Call("vendorAdd",{name:Fm.name,district:Fm.district,mobile:Fm.mobile,type:Fm.type,gst:Fm.gst,addr:Fm.addr,reg:Fm.reg,role:perm.role,user:"admin"},function(e2,d2){
   if(e2)return Sst("✗ "+e2);
   if(!d2||!d2.ok)return Sst("✗ "+((d2&&d2.error)||"தவறு"));
   Sst("✓ "+(d2.vendorCode||"")+" — "+Fm.name);
   SFm({name:"",district:Fm.district,mobile:"",type:Fm.type,gst:"",addr:"",reg:Fm.reg});Saf(false);refresh()})};
 var edit=function(v2){
  Sem(v2.vendorCode);Saf(true);
  SFm({name:v2.vendorName||v2.nm||"",district:v2.districtName||v2.dist||"Pudukkottai",mobile:v2.mobile||v2.mob||"",type:v2.businessType||v2.ty||"Hardware",gst:v2.gstNumber||v2.gstin||"",addr:v2.address||v2.addr||"",reg:v2.regYear||v2.reg||String(new Date().getFullYear())})};
 var rm=function(v2){
  if(!window.confirm(L("Remove vendor "+v2.vendorCode+" — "+v2.vendorName+"?","வணிகர் "+v2.vendorCode+" — "+v2.vendorName+" ஐ நீக்கவா?")))return;
  Sst("…");
  EyV3Call("vendorRemove",{vendorCode:v2.vendorCode,role:perm.role,user:"admin"},function(e2,d2){
   if(e2)return Sst("✗ "+e2);
   if(!d2||!d2.ok)return Sst("✗ "+((d2&&d2.error)||"தவறு"));
   Sst("✓ "+v2.vendorCode+" "+L("removed","நீக்கப்பட்டது"));refresh()})};
 return n.jsxs("div",{className:"ui-card",children:[
  n.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:8},children:[
   n.jsx("div",{style:{fontWeight:800},children:V3VenTitle(L,list)}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",title:L("Refresh","புதுப்பி"),onClick:function(){refresh()},children:"↻"}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",title:"V3 API",onClick:function(){Sso(!so)},children:"⚙"}),
   perm.canAddVen?n.jsx("button",{className:"ui-btn ui-btn-primary ui-btn-sm",onClick:function(){Saf(!af);Sem("")},children:(af?"✕ ":"+ ")+L("Vendor","வணிகர்")}):n.jsx("span",{style:{fontSize:12,color:"var(--tx-3)"},children:L("Add: agent / manager / admin only","சேர்க்க: ஏஜெண்ட் / மேனேஜர் / அட்மின் மட்டும்")})]}),
  so?n.jsx(EyV3SetupCard,{on:!0}):null,
  af&&em?n.jsx("div",{style:{fontSize:13,marginBottom:6,color:"var(--accent)"},children:"✏ "+L("Editing ","திருத்துகிறது ")+em}):null,
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
    n.jsx("td",{children:[perm.canAddVen?n.jsx("button",{className:"ui-btn ui-btn-sm",title:L("Edit","திருத்து"),onClick:function(){edit(v2)},children:"✏"}):null," ",perm.canDelVen?n.jsx("button",{className:"ui-btn ui-btn-sm",title:"🗑",onClick:function(){rm(v2)},children:"🗑"}):null]})]},v2.vendorCode)}):
   [n.jsx("tr",{children:n.jsx("td",{colSpan:7,className:"ui-empty",children:L("No vendors yet","இன்னும் வணிகர் இல்லை")})},"e")]})]})}
function EyTxnForm(p){
 var v=p.v,onDone=p.onDone;
 const{lang:f}=xe();
 var L=function(a,b){return f==="ta"?b:a};
 var vens=Object.keys(v.ven||{}).map(function(g){return v.ven[g]});
 var ags=(v.ag||[]).filter(function(r){return /^AGT/.test(String(r[0]||""))});
 var[Fm,SFm]=E.useState({vc:"",fy:"2025-26",mo:"January",exp:"",adv:"",gp:"4",ag:""});
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
    n.jsx("option",{value:"",children:L("— Select vendor name —","— வணிகர் பெயரை தேர்ந்து —")}),
    vens.map(function(v2){return n.jsx("option",{value:v2.code,children:(v2.nm||v2.code)+" · "+v2.code},v2.code)})]}),
   n.jsxs("select",{className:"ui-input",value:Fm.fy,onChange:set("fy"),children:[
    ["2024-25","2025-26","2026-27","2027-28"].map(function(x){return n.jsx("option",{children:x},x)})]}),
   n.jsxs("select",{className:"ui-input",value:Fm.mo,onChange:set("mo"),children:[
    months.map(function(x){return n.jsx("option",{children:x},x)})]}),
   n.jsx("input",{className:"ui-input",type:"number",placeholder:L("Expected ₹ *","எதிர்பார்ப்பு ₹ *"),value:Fm.exp,onChange:set("exp")}),
   n.jsx("input",{className:"ui-input",type:"number",placeholder:L("Advance ₹","முன்பணம் ₹"),value:Fm.adv,onChange:set("adv")}),
   n.jsx("input",{className:"ui-input",type:"number",placeholder:"GST %",value:Fm.gp,onChange:set("gp")}),
   n.jsx("select",{className:"ui-input",value:"",disabled:!0,children:n.jsx("option",{value:"",children:L("Agent — (added later)","ஏஜெண்ட் — (பின்னர் சேர்க்கப்படும்)")})}),
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
  var[rows,Srows]=E.useState(null),[st,Sst]=E.useState(""),[bsy,Sbsy]=E.useState(false),[wal,Swal]=E.useState([]);
  var[fn2,Sfn]=E.useState(""),[un,Sun]=E.useState(""),[pw,Spw]=E.useState(""),[mb,Smb]=E.useState(""),[md,Smd]=E.useState("Pudukkottai"),[cp,Scp]=E.useState("0.5");
  function load(){Srows(null);EyV3Call("list",{tab:"agents"},function(e,d){if(e){Srows([]);Sst("✗ "+String(e).slice(0,120));return}
    EyV3Call("list",{tab:"wallet"},function(e2,d2){Swal(e2?[]:((d2&&d2.rows)||[]));Srows((d&&d.rows)||[])})})}
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
  var awSum=function(id){var t=0;wal.forEach(function(r2){if(String(r2.agentId||"")===String(id))t+=(+r2.commission||0)});return t};
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
    n.jsx("td",{className:"mono",style:{color:"#0a7d43",fontWeight:700},children:"₹"+EyVbInr(awSum(r.agentId))}),
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
 var[sel,Ssel]=E.useState({}),[busy,Sbusy]=E.useState(false),[st,Sst]=E.useState(""),[prg,Sprg]=E.useState(""),[txv,Stxv]=E.useState(null);
 var loadV=function(){Slist(null);EyV3Call("list",{tab:"vendors"},function(e2,d2){Slist(e2?[]:((d2&&d2.rows)||[]))})};
 E.useEffect(function(){loadV();EyV3Call("list",{tab:"2btabs"},function(e2,d2){var tl=e2?[]:((d2&&d2.rows)||[]);Stabs(tl);if(tl.length)Stab2(tl[0])})},[]);
 var norm=function(x){return String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"")};
 var loadTab=function(name){if(!name)return;Srows2(null);Ssel({});Ssup("");
  EyV3Call("bills2B",{sheet:name},function(e2,d2){Srows2(e2?[]:((d2&&d2.rows)||[]))})};
 E.useEffect(function(){loadTab(tab2)},[tab2]);
 var rows=rows2||[];
 E.useEffect(function(){ if(!vc){Stxv(null);return} EyV3Call("list",{tab:"txns"},function(e3,d3){Stxv(e3?[]:((d3&&d3.rows)||[]).filter(function(t){return String(t.vendorCode)===vc}))})},[vc]);
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
  txv?n.jsx("div",{style:{fontSize:12.5,color:"var(--tx-3)",marginBottom:8},children: txv.length? L("Transactions for this vendor","இந்த வணிகருக்கு transactions")+": "+txv.map(function(t){return (EyV3M3(t.month)+" "+String(t.fy||"")).trim()+" · "+t.txnId+(t.status?" ("+t.status+")":"")}).join(" | ") : L("No transaction yet for this vendor — create one in Transactions for the month you want bills for","இந்த வணிகருக்கு இன்னும் transaction இல்லை — பில் வேண்டிய மாதத்துக்கு Transactions பக்கத்தில் உருவாக்குங்க")}):null,
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

function EyV3AdminPage(){
 const{lang:f}=xe();var L=function(a,b){return f==="ta"?b:a};
 var perm=EyV3Role();
 var[D,SD]=E.useState(null),[fy,Sfy]=E.useState(""),[dist,Sdist]=E.useState(""),[st,Sst]=E.useState(""),[bsy,Sbsy]=E.useState(false);
 var[wm,Swm]=E.useState({date:"",desc:"",type:"Invest",debit:"",credit:""});
 var load=function(){SD(null);
  EyV3Call("list",{tab:"vendors"},function(e1,d1){ if(e1){SD({err:String(e1)});return}
  EyV3Call("list",{tab:"txns"},function(e2,d2){ if(e2){SD({err:String(e2)});return}
  EyV3Call("list",{tab:"bills"},function(e3,d3){ if(e3){SD({err:String(e3)});return}
  EyV3Call("list",{tab:"wallet"},function(e4,d4){
  EyV3Call("list",{tab:"adminwallet"},function(e5,d5){
   SD({ven:e1?[]:((d1&&d1.rows)||[]),txn:e2?[]:((d2&&d2.rows)||[]),bil:e3?[]:((d3&&d3.rows)||[]),wal:e4?[]:((d4&&d4.rows)||[]),awl:e5?[]:((d5&&d5.rows)||[])})})})})})})};
 E.useEffect(function(){load()},[]);
 if(!D)return EyVbLoad("l",L("Loading V3 admin data…","V3 நிர்வாக தரவு ஏற்றுகிறது…"));
 if(D.err)return n.jsxs("div",{children:[n.jsx(EyV3SetupCard,{on:!0}),EyVbLoad("e",String(D.err))]});
 var txns=D.txn.map(function(t){return {id:String(t.txnId||""),dist:String(t.districtName||"—"),fy:String(t.fy||""),mo:String(t.month||""),exp:+t.expected||0,gst:+t.gst||0,st:String(t.status||"").toLowerCase()}}).filter(function(t){return t.id});
 var bills=D.bil.map(function(b){return {txn:String(b.txnId||""),amt:+b.amt||0,tot:+b.total||0}}).filter(function(b){return b.txn});
 var awl=D.awl;
 var bal=awl.length?(+awl[awl.length-1].balance||0):0;
 var dBal=awl.reduce(function(a,r){return a+(+r.debit||0)},0),cBal=awl.reduce(function(a,r){return a+(+r.credit||0)},0);
 var v3dist="";try{var _u=JSON.parse(sessionStorage.getItem("ar4.user")||"null");if(_u&&_u.v3)v3dist=_u.v3district||""}catch(e){}
 var dists={};txns.forEach(function(t){dists[t.dist]=1});var distL=Object.keys(dists).sort();
 var effDist=dist||(v3dist||"");
 var F=txns.filter(function(t){return (!fy||t.fy===fy)&&(!effDist||t.dist===effDist)});
 var bMap={},tMap={};bills.forEach(function(b){bMap[b.txn]=(bMap[b.txn]||0)+b.amt;tMap[b.txn]=(bMap[b.txn]||0)+b.tot});
 var wMap={};D.wal.forEach(function(r){var k=String(r.txnId||"");if(k)wMap[k]=(wMap[k]||0)+(+r.commission||0)});
 var allExp=txns.reduce(function(a,t){return a+t.exp},0),allGst=txns.reduce(function(a,t){return a+t.gst},0),allB=bills.reduce(function(a,b){return a+b.amt},0),allP=allExp*0.08;
 var exp=F.reduce(function(a,t){return a+t.exp},0),gst=F.reduce(function(a,t){return a+t.gst},0),bA=F.reduce(function(a,t){return a+(bMap[t.id]||0)},0),prof=exp*0.08,comm=F.reduce(function(a,t){return a+(wMap[t.id]||0)},0);
 var dMap={};F.forEach(function(t){var k=t.dist;var o=dMap[k]=dMap[k]||{d:k,n:0,exp:0,gst:0,b:0,c:0};o.n++;o.exp+=t.exp;o.gst+=t.gst;if(t.st==="closed")o.c++;o.b+=bMap[t.id]||0});
 var dList=Object.keys(dMap).map(function(k){return dMap[k]});
 var gMap={};F.forEach(function(t){var k=t.fy+"|"+EyV3M3(t.mo);var o=gMap[k]=gMap[k]||{k:k,fy:t.fy,mo:t.mo,n:0,exp:0,gst:0,comm:0,bA:0,bT:0};o.n++;o.exp+=t.exp;o.gst+=t.gst;o.comm+=wMap[t.id]||0;o.bA+=bMap[t.id]||0;o.bT+=tMap[t.id]||0});
 var gList=Object.keys(gMap).map(function(k){return gMap[k]}).sort(function(a,b){return a.k.localeCompare(b.k)});
 var dTot=dList.reduce(function(a,o){return a+o.b},0);
 var gBT=gList.reduce(function(a,o){return a+o.bT},0);
 var allComm=D.wal.reduce(function(a,r){return a+(+r.commission||0)},0),allBT=bills.reduce(function(a,b){return a+b.tot},0);
 var addWal=function(){
  Sbsy(true);EyV3Call("walletAdd",{date:wm.date,desc:wm.desc,type:wm.type,debit:num(wm.debit),credit:num(wm.credit),role:"admin",user:"admin"},function(e,d){Sbsy(false);
   if(e||(d&&!d.ok))return Sst("✗ "+String((d&&d.error)||e).slice(0,140));
   Sst("✓ "+L("Wallet updated · balance","வாலட் சேமிக்கப்பட்டது · நிலுவை")+" ₹"+EyVbInr((d&&d.balance)||0));Swm({date:"",desc:"",type:"Invest",debit:"",credit:""});load()})};
 function pr(){EyVbPrint(L("V3 Admin — District Report","V3 நிர்வாகம் — மாவட்ட அறிக்கை"),(fy?("FY "+fy+" · "):"")+(effDist||L("All districts","எல்லா மாவட்டம்")),
  [L("District","மாவட்டம்"),"Txns",L("Expected ₹","எதிர்பார்ப்பு ₹"),"GST ₹",L("Bills ₹","பில்கள் ₹"),"8% "+L("Profit","லாபம்"),L("Closed","மூடிய")],
  dList.map(function(o){return [o.d,o.n,"₹"+EyVbInr(o.exp),"₹"+EyVbInr(o.gst),"₹"+EyVbInr(o.b),"₹"+EyVbInr(o.exp*0.08),o.c+"/"+o.n]}),
  [[L("Filtered total","வடிகட்டிய மொத்தம்"),F.length,"₹"+EyVbInr(exp),"₹"+EyVbInr(gst),"₹"+EyVbInr(bA),"₹"+EyVbInr(prof),""],
   [L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)"),txns.length,"₹"+EyVbInr(allExp),"₹"+EyVbInr(allGst),"₹"+EyVbInr(allB),"₹"+EyVbInr(allP),""]],false)}
 function csv(){EyVbCsv("v3-admin.csv",[L("Month","மாதம்"),"FY","Txns",L("Expected ₹","எதிர்பார்ப்பு ₹"),"GST ₹",L("Bills Amt ₹","பில் தொகை ₹"),L("Bills Total ₹","பில் மொத்த ₹"),L("Commission ₹","கமிஷன் ₹"),"8% "+L("Profit","லாபம்")],
  gList.map(function(o){return [o.mo,o.fy,o.n,o.exp,o.gst,o.bA,o.bT,o.comm,o.exp*0.08]}),
  [[L("Filtered total","வடிகட்டிய மொத்தம்"),"",F.length,exp,gst,bA,gBT,comm,prof],
   [L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)"),"",txns.length,allExp,allGst,allB,allBT,allComm,allP]])}
 return n.jsxs("div",{children:[
  EyVbHead(L("V3 Admin — Wallet & Reports","V3 நிர்வாகம் — வாலட் & அறிக்கைகள்"),null,L("V3 model: 8% profit on expected · admin wallet ledger · commissions","V3 மாதிரி: எதிர்பார்ப்பில் 8% லாபம் · நிர்வாக வாலட் · கமிஷன்கள்")),
  EyVbChips([[L("Total Expected","மொத்த எதிர்பார்ப்பு"),"₹"+EyVbInr(exp)],[L("Bills Received","பில்கள் வரவு"),"₹"+EyVbInr(bA)],[L("Total GST","மொத்த GST"),"₹"+EyVbInr(gst)],[L("8% Profit","8% லாபம்"),"₹"+EyVbInr(prof)],[L("Commission","கமிஷன்"),"₹"+EyVbInr(comm)],[L("Wallet Balance","வாலட் நிலுவை"),"₹"+EyVbInr(bal)],[L("Vendors","வணிகர்கள்"),String(D.ven.length)],[L("Transactions","பரிவர்த்தனைகள்")+"",String(txns.length)]]),
  n.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10},children:[
   n.jsxs("select",{className:"ui-input",style:{maxWidth:150},value:fy,onChange:function(e){Sfy(e.target.value)},children:[
    n.jsx("option",{value:"",children:L("All FY","எல்லா FY")}),
    ["2024-25","2025-26","2026-27","2027-28"].map(function(x){return n.jsx("option",{value:x,children:x},x)})]}),
   n.jsxs("select",{className:"ui-input",style:{maxWidth:170},value:effDist,onChange:function(e){Sdist(e.target.value)},children:[
    n.jsx("option",{value:"",children:L("All districts","எல்லா மாவட்டம்")}),
    distL.map(function(x){return n.jsx("option",{value:x,children:x},x)})]}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:csv,children:"📊 CSV"}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:pr,children:"🖨️ "+L("Print A4","A4 அச்சு")}),
   n.jsx("button",{className:"ui-btn ui-btn-sm",onClick:load,children:"↻"})]}),
  n.jsx(EyTblX,{head:[L("District","மாவட்டம்"),"Txns",L("Expected ₹","எதிர்பார்ப்பு ₹"),"GST ₹",L("Bills ₹","பில்கள் ₹"),"8% "+L("Profit","லாபம்"),L("Closed","மூடிய")],children:
   dList.length?dList.map(function(o){return n.jsxs("tr",{children:[
    n.jsx("td",{style:{fontWeight:700},children:o.d}),
    n.jsx("td",{children:o.n}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(o.exp)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(o.gst)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(o.b)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(o.exp*0.08)}),
    n.jsx("td",{children:o.c+"/"+o.n})]},o.d)}):
   [n.jsx("tr",{children:n.jsx("td",{colSpan:7,className:"ui-empty",children:L("No transactions in filter","வடிகட்டில் பரிவர்த்தனை இல்லை")})},"e")]}) ,
  n.jsxs("table",{className:"gtbl",style:{marginTop:8},children:[n.jsx("tbody",{children:[n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Filtered total","வடிகட்டிய மொத்தம்")}),n.jsx("td",{children:F.length+" txns"}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(exp)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(gst)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(bA)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(prof)}),n.jsx("td",{},"c1")]},"f1"),n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")}),n.jsx("td",{children:txns.length+" txns"}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(allExp)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(allGst)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(allB)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(allP)}),n.jsx("td",{},"c2")]},"f2")]})]}),
  n.jsx("div",{style:{fontWeight:800,margin:"16px 0 8px"},children:"🧮 "+L("Month-wise settlement (bills + commission)","மாத வாரியான கணக்கு (பில்கள் + கமிஷன்)")}),
  n.jsx(EyTblX,{head:[L("Month","மாதம்"),"FY","Txns",L("Expected ₹","எதிர்பார்ப்பு ₹"),L("Bills Amt ₹","பில் தொகை ₹"),L("Bills Total ₹","பில் மொத்த ₹"),L("Commission ₹","கமிஷன் ₹"),"8% "+L("Profit","லாபம்")],children:
   gList.length?gList.map(function(o){return n.jsxs("tr",{children:[
    n.jsx("td",{style:{fontWeight:700},children:o.mo}),
    n.jsx("td",{children:o.fy}),
    n.jsx("td",{children:o.n}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(o.exp)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(o.bA)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(o.bT)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(o.comm)}),
    n.jsx("td",{className:"mono",children:"₹"+EyVbInr(o.exp*0.08)})]},o.k)}):
   [n.jsx("tr",{children:n.jsx("td",{colSpan:8,className:"ui-empty",children:L("No transactions in filter","வடிகட்டில் பரிவர்த்தனை இல்லை")})},"e")]}) ,
  n.jsxs("table",{className:"gtbl",style:{marginTop:8},children:[n.jsx("tbody",{children:[n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Filtered total","வடிகட்டிய மொத்தம்")}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(exp)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(bA)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(gBT)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(comm)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(prof)})]},"f1"),n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Grand total (unfiltered)","மொத்த கூட்டுத்தொகை (வடிகட்டாத)")}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(allExp)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(allB)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(allBT)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(allComm)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(allP)})]},"f2")]})]}),
  n.jsx("div",{style:{fontWeight:800,margin:"16px 0 8px"},children:"💰 "+L("Admin Wallet (Admin_Wallet ledger)","நிர்வாக வாலட் (Admin_Wallet)")}),
  perm.role==="admin"?n.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10},children:[
   n.jsx("input",{className:"ui-input",type:"date",style:{width:160},value:wm.date,onChange:function(e){Swm(Object.assign({},wm,{date:e.target.value}))}}),
   n.jsx("input",{className:"ui-input",style:{width:220},placeholder:L("Description","விளக்கம்"),value:wm.desc,onChange:function(e){Swm(Object.assign({},wm,{desc:e.target.value}))}}),
   n.jsxs("select",{className:"ui-input",style:{width:140},value:wm.type,onChange:function(e){Swm(Object.assign({},wm,{type:e.target.value}))},children:[
    ["Invest","Advance","GST","Commission","Withdrawal","Other"].map(function(x){return n.jsx("option",{value:x,children:x},x)})]}),
   n.jsx("input",{className:"ui-input",type:"number",style:{width:130},placeholder:L("Debit ₹","பற்ற ₹"),value:wm.debit,onChange:function(e){Swm(Object.assign({},wm,{debit:e.target.value}))}}),
   n.jsx("input",{className:"ui-input",type:"number",style:{width:130},placeholder:L("Credit ₹","வரவு ₹"),value:wm.credit,onChange:function(e){Swm(Object.assign({},wm,{credit:e.target.value}))}}),
   n.jsx("button",{className:"ui-btn ui-btn-primary ui-btn-sm",disabled:bsy,onClick:addWal,children:"+ "+L("Add entry","பதிவு சேர்")})]}):null,
  n.jsx(EyTblX,{head:[L("Date","தேதி"),L("Description","விளக்கம்"),L("Type","வகை"),L("Debit ₹","பற்ற ₹"),L("Credit ₹","வரவு ₹"),L("Balance ₹","நிலுவை ₹")],children:
   awl.length?awl.map(function(r,i){return n.jsxs("tr",{children:[
    n.jsx("td",{className:"mono",children:String(r.date||"").slice(0,10)}),
    n.jsx("td",{children:r.desc||"—"}),
    n.jsx("td",{children:r.type||"—"}),
    n.jsx("td",{className:"mono",children:(+r.debit||0)?"₹"+EyVbInr(r.debit):"—"}),
    n.jsx("td",{className:"mono",style:{color:"#0a7d43"},children:(+r.credit||0)?"₹"+EyVbInr(r.credit):"—"}),
    n.jsx("td",{className:"mono",style:{fontWeight:700},children:"₹"+EyVbInr(r.balance)})]},"w"+i)}):
   [n.jsx("tr",{children:n.jsx("td",{colSpan:6,className:"ui-empty",children:L("Wallet ledger is empty — add the first entry above","வாலட் காலியாக உள்ளது — முதல் பதிவை சேருங்கள்")})},"e")]}) ,
  n.jsxs("table",{className:"gtbl",style:{marginTop:8},children:[n.jsx("tbody",{children:[n.jsxs("tr",{children:[n.jsx("td",{style:{fontWeight:800},children:L("Totals","மொத்தம்")}),n.jsx("td",{}),n.jsx("td",{}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(dBal)}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(cBal)}),n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(bal)})]},"ft")]})]}),
  st?n.jsx("div",{style:{fontSize:13,marginTop:8,color:st.indexOf("✓")>=0?"#0a7d43":"#b3261e"},children:st}):null]})}
function EyDashHome({user:c}){
 const{lang:f}=xe(),rnav=Ue();
 var L=function(a,b){return f==="ta"?b:a};
 var[rd,Srd]=E.useState(0);
 var[awS,SawS]=E.useState(null);
 var[bank,Sbank]=E.useState(null);
 var refresh=function(){EyV3=null;Srd(function(x){return x+1});
  SawS(null);Sbank(null)};
 E.useEffect(function(){EyV3Fetch(function(){Srd(function(x){return x+1})})},[]);
 E.useEffect(function(){
  var fin=2,got={};
  var done=function(k,e,d){got[k]=e?null:d;fin--;if(!fin){
   var comm=0,i,rows,wMap={};
   rows=(got.aw&&EyRawRows(got.aw))||[];
   for(i=0;i<rows.length;i++){if(i===0&&String(rows[i][0]||"").trim()==="id")continue;
    var cm=EyVbN(rows[i][9]);comm+=cm;var tid=String(rows[i][4]||"").trim();if(tid)wMap[tid]=(wMap[tid]||0)+cm}
   var arows=(got.ad&&EyRawRows(got.ad))||[],bal=0,deb=0,cred=0;
   for(i=0;i<arows.length;i++){if(i===0&&String(arows[i][0]||"").trim()==="date")continue;
    deb+=EyVbN(arows[i][3]);cred+=EyVbN(arows[i][4]);var b5=EyVbN(arows[i][5]);if(b5)bal=b5}
   SawS({comm:comm,bal:bal,deb:deb,cred:cred,wMap:wMap})}};
  gvizFetch(EyV3WB,"AgentWallet",function(e,d){done("aw",e,d)});
  gvizFetch(EyV3WB,"Admin_Wallet",function(e,d){done("ad",e,d)})},[rd]);
 E.useEffect(function(){
  var tok=null;try{tok=sessionStorage.getItem("ar4.token")||""}catch(e){}
  if(!tok||tok.indexOf("v3:")===0){Sbank({err:L("login required","உள்நுழைவு தேவை")});return}
  fetch("/api/bank.liveRecon",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+tok},body:"{}"})
   .then(function(r2){return r2.text()}).then(function(t){
    var j;try{j=JSON.parse(t)}catch(e){Sbank({err:"format"});return}
    if(!j||!j.ok){Sbank({err:(j&&j.error&&j.error.message)||L("failed","தோல்வி")});return}
    Sbank(j.data||{})}).catch(function(){Sbank({err:L("network","நெட்வொர்க்")})})},[rd]);
 if(!EyV3||!EyV3.done)return EyVbLoad("l",L("Loading dashboard…","டாஷ்போர்டு ஏற்றப்படுகிறது…"));
 if(EyV3.err)return EyVbLoad("e");
 var i,ven=Object.keys(EyV3.ven).length,txn=EyV3.txn,open=0,closed=0,exp=0;
 for(i=0;i<txn.length;i++){exp+=txn[i].exp;if(txn[i].st==="Closed")closed++;else open++}
 var bil=EyV3.bil,bAmt=0,bTot=0;
 for(i=0;i<bil.length;i++){bAmt+=bil[i].amt;bTot+=bil[i].tot}
 var profit=exp*0.08;
 var g2=EyV3.g2,gkeys=Object.keys(g2),gTax=0,gTot=0,gfy={};
 for(i=0;i<gkeys.length;i++){gTax+=g2[gkeys[i]].tax;gTot+=g2[gkeys[i]].tot;
  var pp=gkeys[i].split("|");var fy2=pp[0];gfy[fy2]=gfy[fy2]||{n:0,tax:0,tot:0};gfy[fy2].n++;gfy[fy2].tax+=g2[gkeys[i]].tax;gfy[fy2].tot+=g2[gkeys[i]].tot}
 var comm=awS?awS.comm:0,wMap=(awS&&awS.wMap)||{};
 // month table
 var mset={},mkeys=[],byV={};
 for(i=0;i<txn.length;i++){var t=txn[i],k=t.fy+"|"+t.mo;if(!mset[k]){mset[k]=1;mkeys.push(k)}}
 mkeys.sort(function(a,b){var ya=EyV3YM(a.split("|")[0],a.split("|")[1]),yb=EyV3YM(b.split("|")[0],b.split("|")[1]);return ya<yb?1:ya>yb?-1:0});
 var mrows=[],tExp=0,tAmt=0,tTot=0,tCom=0,tPf=0,mExp={},mAmt={},mTot={},mCom={};
 for(i=0;i<mkeys.length;i++){var kk=mkeys[i],p2=kk.split("|"),fy3=p2[0],mo3=p2[1],e2=0,a2=0,t2=0,c2=0,j;
  for(j=0;j<txn.length;j++)if(txn[j].fy===fy3&&txn[j].mo===mo3){e2+=txn[j].exp;c2+=(wMap[txn[j].id]||0)}
  for(j=0;j<bil.length;j++)if(bil[j].nm!==void 0){var bt=null;for(var q=0;q<txn.length;q++)if(txn[q].id===bil[j].txn){bt=txn[q];break}
   if(bt&&bt.fy===fy3&&bt.mo===mo3){a2+=bil[j].amt;t2+=bil[j].tot}}
  mrows.push({fy:fy3,mo:mo3,exp:e2,amt:a2,tot:t2,com:c2});tExp+=e2;tAmt+=a2;tTot+=t2;tCom+=c2}
 tPf=tExp*0.08;
 for(i=0;i<bil.length;i++){var vc=bil[i].vc||"?";byV[vc]=byV[vc]||{n:0,amt:0,nm:bil[i].nm||""};byV[vc].n++;byV[vc].amt+=bil[i].amt;if(bil[i].nm)byV[vc].nm=bil[i].nm}
 var top=Object.keys(byV).map(function(v){return{vc:v,n:byV[v].n,amt:byV[v].amt,nm:byV[v].nm||(EyV3.ven[v]&&EyV3.ven[v].nm)||v}});
 top.sort(function(a,b){return b.amt-a.amt});top=top.slice(0,5);
 var Card=function(title,right,child){return n.jsxs("div",{className:"ui-card",style:{padding:"12px 14px"},children:[
  n.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8},children:[
   n.jsx("div",{style:{fontWeight:800},children:title}),n.jsx("div",{style:{flex:1}}),right||null]}),child]})};
 var today=new Date().toISOString().slice(0,10);
 var printA4=function(){
  var rows=[],i2;
  rows.push([L("Vendors","வணிகர்கள்"),String(ven)]);
  rows.push([L("Transactions","பரிவர்த்தனைகள்"),open+" "+L("open","திறந்த")+" · "+closed+" "+L("closed","மூடிய")]);
  rows.push([L("Total expected","எதிர்பார்ப்பு மொத்தம்"),"₹"+EyVbInr(exp)]);
  rows.push([L("Bills received","பில் வரவுகள்"),bil.length+" — ₹"+EyVbInr(bAmt)]);
  rows.push(["8% "+L("profit","லாபம்"),"₹"+EyVbInr(profit)]);
  rows.push([L("Agent commission","ஏஜெண்ட் கமிஷன்"),"₹"+EyVbInr(comm)]);
  rows.push([L("Admin wallet balance","நிர்வாக வாலட் இருப்பு"),awS?("₹"+EyVbInr(awS.bal)):"—"]);
  rows.push(["GSTR-2B",gkeys.length+" "+L("months","மாதம்")+" — ₹"+EyVbInr(gTax)]);
  if(bank&&bank.stats){var s2=bank.stats;
   rows.push([L("Bank entries","வங்கி பதிவுகள்"),s2.bankCount+" ("+s2.bankCreditCount+" "+L("credits","வரவு")+")"]);
   rows.push([L("Contract receipts","ஒப்பந்த வரவுகள்"),s2.contractCount+" — ₹"+EyVbInr(s2.totalContract)]);
   rows.push([L("Matched","பொருந்தியவை"),s2.matched+" + "+s2.partial+" "+L("partial","பகுதி")+" + "+s2.near+" "+L("near","நெருங்கிய")]);
   rows.push([L("Unmatched","பொருந்தாதவை"),String(s2.unmatched)])}
  for(i2=0;i2<mrows.length;i2++){var m3=mrows[i2];
   rows.push([EyV3M3(m3.mo)+" "+m3.fy,"₹"+EyVbInr(m3.exp)+" → ₹"+EyVbInr(m3.amt)+" · 8% ₹"+EyVbInr(m3.exp*0.08)])}
  EyVbPrint(L("Dashboard","முகப்பு பலகை"),today,[L("Metric","சுட்டி"),L("Value","மதிப்பு")],rows,[[L("AR Enterprises ERP","AR எண்டர்பிரைசஸ் ERP"),"Build 202610082x"]],!1)};
 var links=[["🏪",L("Vendors","வணிகர்கள்"),"/vendors",ven+" "+L("vendors","வணிகர்கள்")],
  ["⇄",L("Transactions","பரிவர்த்தனைகள்"),"/transactions",txn.length+" ("+open+" "+L("open","திறந்த")+")"],
  ["🧾",L("Bills","பில்கள்"),"/bills",bil.length+" — ₹"+EyVbInr(bAmt)],
  ["👛",L("Agent Wallet","ஏஜெண்ட் வாலட்"),"/wallet","₹"+EyVbInr(comm)],
  ["💼",L("V3 Admin","V3 நிர்வாகம்"),"/v3admin",""],
  ["🛡️",L("Auditor GSTR-2B","ஆடிட்டர் GSTR-2B"),"/auditor",gkeys.length+" "+L("months","மாதம்")],
  ["🏦",L("Bank Reconciliation","வங்கி ஒப்பீடு"),"/bank",bank&&bank.stats?bank.stats.unmatched+" "+L("unmatched","பொருந்தாத"):""],
  ["٪",L("GST Centre","GST மையம்"),"/gst",""],
  ["₹",L("Payments","பணம் பெறல்"),"/payments",""],
  ["📊",L("Reports","அறிக்கைகள்"),"/reports",""]];
 return n.jsxs("div",{children:[
  EyVbHead(L("Dashboard","முகப்பு பலகை"),null,L("Live overview — V3 operations, bank reconciliation, GSTR-2B","நேரடி கண்ணோட்டம் — V3 செயல்பாடு, வங்கி ஒப்பீடு, GSTR-2B")),
  n.jsxs("div",{style:{display:"flex",gap:8,marginBottom:10},children:[
   n.jsx("button",{className:"ui-btn ui-btn-soft ui-btn-sm",onClick:refresh,children:"↻ "+L("Refresh","புதுப்பி")}),
   n.jsx("button",{className:"ui-btn ui-btn-soft ui-btn-sm",onClick:printA4,children:"🖨️ "+L("A4 Print","A4 அச்சு")}),
   n.jsx("div",{style:{flex:1}}),
   n.jsx("div",{style:{fontSize:12,color:"var(--tx-3)",alignSelf:"center"},children:(bank&&bank.lastSync)?L("Bank sync: ","வங்கி ஒத்திசைவு: ")+String(bank.lastSync).slice(0,16).replace("T"," "):""})]}),
  n.jsx(EyVbChips,[[L("Vendors","வணிகர்கள்"),String(ven)],
   [L("Transactions","பரிவர்த்தனைகள்"),txn.length+" · "+open+" "+L("open","திறந்த")+" / "+closed+" "+L("closed","மூடிய")],
   [L("Total expected","எதிர்பார்ப்பு மொத்தம்"),"₹"+EyVbInr(exp)],
   [L("Bills received","பில் வரவுகள்"),bil.length+" — ₹"+EyVbInr(bAmt),"#0a7d43"],
   ["8% "+L("profit","லாபம்"),"₹"+EyVbInr(profit),"#1d4ed8"],
   [L("Agent commission","ஏஜெண்ட் கமிஷன்"),awS?("₹"+EyVbInr(comm)):"…"],
   [L("Admin wallet","நிர்வாக வாலட்"),awS?("₹"+EyVbInr(awS.bal)):"…"],
   ["GSTR-2B",gkeys.length+" "+L("months","மாதம்")+" · ₹"+EyVbInr(gTax)]]),
  n.jsxs("div",{className:"settings-grid",style:{gridTemplateColumns:"1.25fr 1fr",marginTop:12},children:[
   Card(L("Month progress","மாத முன்னேற்றம்"),null,
    n.jsx("table",{className:"gtbl",children:n.jsx("tbody",{children:[
     n.jsx("tr",{children:["Month","FY","Expected","Bills amt","Bills total","Commission","8%"].map(function(h,i2){return n.jsx("th",{style:{textAlign:i2>1?"right":"left"},children:L(h,h)},i2)})},"h"),
     mrows.map(function(m3,i2){return n.jsxs("tr",{children:[
      n.jsx("td",{children:EyV3M3(m3.mo)}),n.jsx("td",{className:"mono",children:m3.fy}),
      n.jsx("td",{className:"mono",children:"₹"+EyVbInr(m3.exp)}),
      n.jsx("td",{className:"mono",children:"₹"+EyVbInr(m3.amt)}),
      n.jsx("td",{className:"mono",children:"₹"+EyVbInr(m3.tot)}),
      n.jsx("td",{className:"mono",style:{color:"#0a7d43"},children:m3.com?"₹"+EyVbInr(m3.com):"—"}),
      n.jsx("td",{className:"mono",style:{fontWeight:700,color:"#1d4ed8"},children:"₹"+EyVbInr(m3.exp*0.08)})]},"m"+i2)}),
     n.jsxs("tr",{style:{borderTop:"2px solid var(--border)"},children:[
      n.jsx("td",{style:{fontWeight:800},children:L("Totals","மொத்தம்")}),n.jsx("td",{}),
      n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(tExp)}),
      n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(tAmt)}),
      n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(tTot)}),
      n.jsx("td",{className:"mono",style:{fontWeight:800,color:"#0a7d43"},children:"₹"+EyVbInr(tCom)}),
      n.jsx("td",{className:"mono",style:{fontWeight:800,color:"#1d4ed8"},children:"₹"+EyVbInr(tPf)})]},"ft")]})})),
   Card(L("Top vendors by bills","பில் அடிப்படையில் சிறந்த வணிகர்கள்"),null,
    top.length?n.jsx("table",{className:"gtbl",children:n.jsx("tbody",{children:top.map(function(v,i2){return n.jsxs("tr",{style:{cursor:"pointer"},onClick:function(){rnav("/vendors")},children:[
     n.jsx("td",{style:{fontWeight:600},children:v.nm}),
     n.jsx("td",{className:"mono",children:v.vc}),
     n.jsx("td",{className:"mono",children:v.n+" "+L("bills","பில்")}),
     n.jsx("td",{className:"mono",style:{fontWeight:700},children:"₹"+EyVbInr(v.amt)})]},"v"+i2)})})}):n.jsx("div",{className:"ui-empty",children:L("No bills yet","இன்னும் பில் இல்லை")}))
  ]}),
  n.jsxs("div",{className:"settings-grid",style:{gridTemplateColumns:"1fr 1fr",marginTop:12},children:[
   Card(L("Bank reconciliation (live)","வங்கி ஒப்பீடு (நேரடி)"),
    n.jsx("button",{className:"ui-btn ui-btn-soft ui-btn-sm",onClick:function(){rnav("/bank")},children:L("Open →","திற →")}),
    !bank?n.jsx("div",{className:"ui-empty",children:L("Loading…","ஏற்றுகிறது…")}):
     (bank.err||!bank.stats)?n.jsx("div",{className:"ui-empty",children:"⚠ "+(bank.err||L("No bank data","வங்கி தரவு இல்லை"))}):
    n.jsx("table",{className:"gtbl",children:n.jsx("tbody",{children:[
     n.jsxs("tr",{children:[n.jsx("td",{children:L("Bank entries","வங்கி பதிவுகள்")}),n.jsx("td",{className:"mono",children:bank.stats.bankCount+" ("+bank.stats.bankCreditCount+" "+L("credits","வரவு")+")"}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(bank.stats.totalBank)})]},"b1"),
     n.jsxs("tr",{children:[n.jsx("td",{children:L("Contract receipts","ஒப்பந்த வரவுகள்")}),n.jsx("td",{className:"mono",children:String(bank.stats.contractCount)}),n.jsx("td",{className:"mono",children:"₹"+EyVbInr(bank.stats.totalContract)})]},"b2"),
     n.jsxs("tr",{children:[n.jsx("td",{children:L("Matched","பொருந்தியவை")}),n.jsx("td",{className:"mono",style:{color:"#0a7d43",fontWeight:700},children:bank.stats.matched+" ✓"}),n.jsx("td",{className:"mono",children:"+"+bank.stats.partial+" "+L("partial","பகுதி")+" · +"+bank.stats.near+" "+L("near","நெருங்கிய")})]},"b3"),
     n.jsxs("tr",{children:[n.jsx("td",{children:L("Unmatched","பொருந்தாதவை")}),n.jsx("td",{className:"mono",style:{color:bank.stats.unmatched?"#b3261e":"#0a7d43",fontWeight:800},children:String(bank.stats.unmatched)}),n.jsx("td",{})]},"b4")]})})),
   Card("GSTR-2B ("+L("ITC summary","ITC சுருக்கம்")+")",
    n.jsx("button",{className:"ui-btn ui-btn-soft ui-btn-sm",onClick:function(){rnav("/auditor")},children:L("Open →","திற →")}),
    gkeys.length?n.jsx("table",{className:"gtbl",children:n.jsx("tbody",{children:[
     n.jsx("tr",{children:["FY","Months","Taxable ₹","Total ₹"].map(function(h,i2){return n.jsx("th",{style:{textAlign:i2?"right":"left"},children:L(h,h)},i2)})},"h2"),
     Object.keys(gfy).sort().reverse().map(function(fy4,i2){return n.jsxs("tr",{children:[
      n.jsx("td",{className:"mono",children:fy4}),
      n.jsx("td",{className:"mono",children:String(gfy[fy4].n)}),
      n.jsx("td",{className:"mono",children:"₹"+EyVbInr(gfy[fy4].tax)}),
      n.jsx("td",{className:"mono",style:{fontWeight:700},children:"₹"+EyVbInr(gfy[fy4].tot)})]},"g"+i2)}),
     n.jsxs("tr",{style:{borderTop:"2px solid var(--border)"},children:[
      n.jsx("td",{style:{fontWeight:800},children:L("Totals","மொத்தம்")}),
      n.jsx("td",{className:"mono",style:{fontWeight:800},children:String(gkeys.length)}),
      n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(gTax)}),
      n.jsx("td",{className:"mono",style:{fontWeight:800},children:"₹"+EyVbInr(gTot)})]},"gft")]})}):
     n.jsx("div",{className:"ui-empty",children:L("No 2B summary yet","இன்னும் 2B சுருக்கம் இல்லை")}))
  ]}),
  n.jsx("div",{className:"ui-card",style:{padding:"12px 14px",marginTop:12},children:
   n.jsx("div",{className:"chip-row",children:links.map(function(lk,i2){return n.jsxs("button",{className:"ui-btn ui-btn-soft ui-btn-sm",onClick:function(){rnav(lk[2])},children:[lk[0]+" "+lk[1],lk[3]?n.jsx("span",{style:{color:"var(--tx-3)",fontWeight:600,marginLeft:6},children:lk[3]}):null]},"l"+i2)})})})
 ]})}

/* Drive file index — Sri Polinchi & Co contract folders (auto-matched by amount / name) */
var EyDrvFiles=[["1e0_D00i43Bt2Id7H9epLWCM2kS7-wqxv","3252304.pdf","A"],["1zcJJ5A9-CSpleeW8nDXyIhYfNFjkScYr","700705.pdf","A"],["1u_hnBj1J2KuHCyb4fvVe-TfrQGzmZylT","124580.pdf","A"],["1eOH9TfgoAzj8lD2QvSMoy5q7AfeF-gZ6","3638724.pdf","A"],["1s4AO9E7z76xrS1mF4lR2gN8N_TxkkOWs","37022.pdf","A"],["1wyDP5zHNIOLGMMQhIDkD8uBOPGW1bBcC","1819354.pdf","A"],["1wtXeCvi30zgjbVICO6Wz4HZw-NOndlMz","1837530.pdf","A"],["1q1IY4vPQ_Dee-eu8tZr4ODEyfhnWm5Zr","2043697.pdf","A"],["1QQOsi0iIbDLwKOIiJZYOkWr-RqzVdB6C","3638628.pdf","A"],["1v0UxsdBALvQ4e8gF400edbPU8WpCyPoD","1110128.pdf","A"],["10Q7-VFDYxg7KHm4X65HEsWQ5h1IGIxtS","1597101.pdf","A"],["1eTRbex2yCQXG4okvA000ePA-KaBcDWq1","1242568.jpg","A"],["1HCICxy9CR19rqWf5mob0viBZsagn-uhy","233322.pdf","A"],["1pj2cnDYes4TkKnmk9HzgWIYsHqqTqCgs","90389.pdf","A"],["1beeJtU5ZainoKqtD_QGd9tjHnLnvgitc","387101.pdf","A"],["1Im686W2liS4Mz1wUwRQUsAPgnEbSLdpW","1805419.xls","A"],["1nUehAGcDE8oX41UiKtxXBpoZcPawPikH","1826449.xls","A"],["1sfce6tYBXcB_n0MjWcIAf2dqurI-u8j7","2531094.xls","A"],["1KPLq-YcGZBSe6bm2gWNf5yWlwv2cpscK","3059425.xls","A"],["1jJyz8oaBL8idHZBYfUJ7L6ys6hG2Y2ex","2976385.xlsx","A"],["1p9gN-C2aonnjQV2rngxGTPkLD0SSEJ97","542026.pdf","A"],["1OOzVyxSE5enVB3YqBplBXxGkZ4-2XxJ9","639027.jpg","A"],["1wSKit6NUzJjTfNAyImfyL1e4gK4GMGhx","521508.jpg","A"],["1sri9G3zwaiPMhHQusvUPic3LBpISHMlT","146986.pdf","A"],["1JuY8ar-_oCPmBMCHKsqX0jUnPBLhmXki","183567.pdf","A"],["15mP-yW3KExOONV79e5OsqiPh1UCq5jyu","276131.pdf","A"],["1jduj0iCEVZsYcYXkSroF9L7ca0ELqbhM","381915.pdf","A"],["1CWk3Lru_oeFrFBoeuGqn4ZpIq5ZiDF-6","1040415.jpg","A"],["1Te7hpmdKiOKaYH0UGCSCBA0kpqH19p--","1597277.jpg","A"],["1KRdIMorIeYKW-ed_YhBgRveRlMV_npfi","456031.pdf","A"],["1_FJaSZUxh830XSK2es6Wi_HKBP7Wuair","683357.jpg","A"],["1NXidZKIfFMXwP18uqcbzTEzTCOskxHAq","1335438.jpg","A"],["1P-akRsN1QPd8ZesbOx3dEvJevq9AIkDd","693633.jpg","A"],["1SYa_pDtFb0W1S8hE0QkZVBxU4FPMaeHW","455892.jpg","A"],["1uqt7SmrXQPUt9gUjNrOC9nxWZeuIuvQX","1021023.jpg","A"],["1Og5eEoDTJc3dOvk6chxAAaR8gJaPHIG2","134584.pdf","A"],["1H9EdyNKQhKoLHf7Fafkqg_-szJFODsm-","2836372.pdf","A"],["1GUdvIgrQiyGf5VFXmc7Rcu8eK9G_Epbv","2596578.pdf","A"],["1ee21Yfb8LoPicB76YPUGZrjXjW1PZGm1","153626.pdf","A"],["1_6Gpyy9m7oAf0NYRA78fg-FBZt2uGEK0","670358.pdf","A"],["1U6CgnSqhgLdjki0mFldyVfJAH9doUtkC","774637.pdf","A"],["1v7PTLDZc5Qw8Ww2CchXS0XkcLelFMdi8","269557.pdf","A"],["1087N6Tne0guLTTiNSOkZdyQ3qIKZ6FwB","112513.pdf","A"],["1QA1s8Y_AI8BnObUF1ePozIz8hQpUfCtg","313450.pdf","A"],["1teKgezY7rcky3ukIsrlAySn4drK1LhrE","214718.pdf","A"],["1xc97YSu56Pzl46GPa4mSNJhoGpvjbzWp","2694997.pdf","A"],["1ElyYQOmoZctbl2rGwTMGAUDxF9VsM8AH","644001.jpg","A"],["1IbownbIfpg--8A4hBe5IcZiB9gASIv6m","644802.jpg","A"],["184AxXjk9daF4kq-fmfgrtic4wcMAT2kC","12267246.pdf","A"],["13fFSmA7w3KCfepasiHpoXhzH0jVa70Hf","223631.pdf","A"],["1MT_diLlC8Mk-aTbiNx9OhI_l6X8cuUV4","123797.pdf","A"],["1ndtH5ARplZpOGJIETKYW1O-FVKhSsBI9","181829.pdf","A"],["1v7jYzUNUbyWysGFm77e_XWU8TOG0U1CK","453100.pdf","A"],["1Rz7ah6ppDYAELOrfLNMwonNqUjkvUTuv","352104.pdf","A"],["1kwvd0Pr8TzZK_FqF1DOQhBf-w0fYj-9K","200845.pdf","A"],["1sHo6LxnHo85irnY5QysAzG01dXzGCESG","276934.pdf","A"],["1Y64jH4Gt5n0Lm464SR2hSyqbsK5KUzqM","1519824.jpg","A"],["1sCD7E2AGeELfniC8223GubGwNbKdQUiO","1655477.pdf","A"],["1HsYxq5_dNMbAQoC9SOaRxnhINgDkPgwp","905108.jpg","A"],["1b-iU2jNihWVeQZlLVNYEGkHIICJRATuI","4019480.pdf","A"],["1XH3EFYLUPSuNyHCS3WItRSmtCILfbG36","13761384.pdf","A"],["1efFZ5fyEjTBSwbm-WdzD0mBM5QYggvwI","1014678.pdf","A"],["1ltAYCcmbVKqFT9gOETc9Qdan3CHX7I9O","Bill Sanction Letter Rs. 911617.jpg","B"],["1P5FGC1EVfyFpDY7zfkI8vJYgOihhFd_e","Bill Sanction Letter Rs. 913090.jpg","B"],["1wu0RL7ZzS5LVGgTDYYV0D4FtSuWZsspa","Bill sanction Letter Rs. 910629.jpg","B"],["1Bvz-PLqBO0hzhg8EXQpD2AiYwY4Bb8bl","66-2024 Rs. 105417.jpg","B"],["1khiTqHEO-KrTQPUHiFBBPrUH1bMNB80F","4117-2022 Rs. 1161748.jpg","B"],["1flHf9oKW7lMyyHqZ-qkXUGV5fPpvYBm5","4117-2022 Rs. 1106510.jpg","B"],["1viu2_FbAiUdtOHGaDBhTty6sjgKBZmXk","4117-2022 Rs. 1822408.jpg","B"],["1Tu9uV_9HV6YUeo4JMFS96bNNC7jibsZl","Bill Sanction Letter Rs. 346889.jpg","B"],["1a3URn6maMAvs_BfMqk4Bqa6-GEBYTb7y","Bill Sanction Letter Rs.17269563.pdf","B"],["1JKCBgttS3FZvEgKyPJVDCLExY0BGxG36","2857-2023 Rs.1076838.pdf","B"],["1vILcu7tZGY9zFcGKlfM4AOj0waCLT-hN","Bill Sanction Letter Rs.167390.pdf","B"],["1sL1n-q9C_69gpSmhlXfZp1dBz_PGGEig","2857-2023 Rs.273437.pdf","B"],["1SfOZa_IEA-tklCr6BLPsps0C4JFdf5th","Bill Sanction Letter Rs. 1099441.pdf","B"],["1wBsVzl4ZXq-3Ts0N0uPQJvIMC9kiw5AL","0060-2044 Rs.910021.jpg","B"],["1HMXxKLyFi4VKENFi0oEI33__rCJt3kRx","0060-2023 Rs.785693.jpg","B"],["1Gq77Z98HPBfJPFyhiWeBl8k4BC1JAafb","1048-2023 Rs.1186877.pdf","B"],["1GQPFkbjaW7kyIPaqzvvzAAT73gEFxIMd","Bill Sanction Letter Rs.1362500.jpg","B"],["1HpU00NpDN7sRfZqAAJ55sBkgy23ICi54","Bill Sanction Letter Rs.14995672.pdf","B"],["1Ffu-dO8fYU0JKGnu4p3yeGai85bi2n2a","7978-2024 Rs.1313175.pdf","B"],["1u_Yp8Gm4DgQKSvUUhV9jLYRQW5wczRTM","8266-2024 Rs.1067754.pdf","B"],["1Z9gCZR4fqt0zyL4__9aekZMdRkEWX5s0","9099-2024 Rs.2011622.pdf","B"],["1I4PMQvRRlr45vpHOBa1IJxfurkTGXOu9","8265-2024 Rs.2299799.pdf","B"],["1n-nQdQP-EOnMkZBj97eTIauH9wswqsJx","146-2023 Rs.882867.pdf","B"],["1zOLA-seHOV3uTZHT_fN8xno2JJESuOHo","1559-2023 Rs.64432.pdf","B"],["1eIFaDcsLYs-27STianxAFuLrBzIAA3Gx","Bill Sanction Letter Rs.1112381.pdf","B"],["149dYeOgOyv9B-i74s8BtSwgPkQqgHbNR","9621-2024 1576218.pdf","B"],["1QrQ39bVbjn8R2W-Pb8U3C7crsLB8EU32","9742-2024 Rs.936860.pdf","B"],["18rlsyve9OWyyirUO2Y6KLkwwV-DIQCN0","9653-2024 Rs.2319848.pdf","B"],["1M_cszfAE6-K5Sz4J-TepBX_1Exf0mllu","Bill Sanction Letter Rs.2431263.pdf","B"],["18QL4j63DzK3G8xW3lNTej7VkqNEnFIOg","2639-2023 Rs.1217655.pdf","B"],["1EDxrGlcDT2CFDj8YxsRltZ80BG1b49EA","Bill Sanction Letter Rs.987290.pdf","B"],["1Hyge2idIg3mPfGLQlSLfMnBGAq1eSqV_","Bill Sanction Letter Rs.1365000.pdf","B"],["1fkqpB76nVOuMg-dU-NPD7n2gpS1TpNfa","Bill Sanction Letter Rs.1998125.pdf","B"],["1oOOZiQZI3-SoO0-0I06l5fEIDwf6T0oL","Bill Sanction Letter Rs.2354769.pdf","B"],["1AKMuNqokqK3nBlpTfTxYtKJAQGwRvur9","Bill Sanction Letter Rs.116671.pdf","B"],["1BHGcpLV6mJZobQ1DYJBjhOUNmMy16IRe","Bill Sanction Letter Rs.161061.pdf","B"],["1Y9twPv40bquwqYQApkDwLkGF3EJuy2Sw","Bill Sanction Letter Rs.228536.pdf","B"],["17tMTDl3dx5Y0Yp0EJK_1zyy7YiUDvPWp","Bill Sanction Letter Rs.124466.pdf","B"],["1DsGVcvHlAwQ47h7o79FuV1DoyeXBbnii","Bill Sanction Letter Rs.75410.pdf","B"],["1iLm-DlfN8xQT1EhS-S-YOEPiGmfb88es","4789-2024 Rs.913888.pdf","B"],["1_tNCtJawFDz7YaPlMko2gnGkDCNbAECi","Bill Sanction Letter Rs.1941934.pdf","B"],["12hXqE-AAT2fSuTXyShI_zDfaIEbzLcGS","Bill Sanction Letter Rs.108728.pdf","B"],["189jnaRd8_eY4FgsMPpLzS1ic7ahz_8v4","1813-2024 Rs.13332.pdf","B"],["1ocdMPCsqyMIN0bRzuIla51sPrftI6HoV","Bill Sanction Letter Rs.99800.pdf","B"],["1vhLC8w_xrRvlldUXh1kM6nuOOer3KThN","Bill Sanction Letter Rs.122182.pdf","B"],["13fQd7bVw9DnuOHkaPfV2BCq7H-Zq5YkS","3925-2024 Rs.2011014.pdf","B"],["1DY5gSi3sKm39_HvLu17sCcj2r630KWtz","1559-2022 Rs.2011014.jpg","B"],["1HKb8lw9c2C4NG7E2Pi9JtJZKOPhgs5RE","1559-2022 Rs.456343.jpg","B"],["1S5OD5E1kapghMxbdMg6-AIZEk5UtMkOI","1559-2022 Rs.319512.jpg","B"],["1Gk5zSjNwL9P_jqdEk-EzjA3xQ1dfwdwv","2046-2024 Rs.12709.pdf","B"],["1QAaswEekRK8QXnDpVbCycZt824WUNeQW","2043-2024 Rs.86247.pdf","B"],["1GAH5BKc_a1Wj8p_CR_lCe1nBm--q8jeR","2044-2024 Rs.43847.pdf","B"],["1cEHeUAwFBgbQYo3Y0Th41PggOEhqrKqb","2045-2024 Rs.10127.pdf","B"],["1xIp5R4FxvJZjtlIwE0kCcZyKBjQQQvji","2250-2023 Rs.685150.jpg","B"],["1Xl8cXkreTsS6k1PgNIzYgjvzw1dAY4bI","1029-2024 Rs.259998.pdf","B"],["175aW1VQQaze2Hg5DxXReVEAgXaTvDa3r","1028-2024 Rs.334640.pdf","B"],["1LIa8IrAZOERBvxdZHVE7ooHIZzd_33Lc","2394-2024 Rs.455958.jpg","B"],["1nUQeUzbZPkMx_ORd3AP-XbavvW6UpKog","2046-2024 Rs.332540.xls","B"],["1v-ih0yWyjDGJ_QKF4fxBKvBwV4X6Fm05","2045-2024 Rs.436810.xls","B"],["1Wn8ry1hjVMkOLZ8lLcjDzcY2RzctY7YJ","2042-2024 Rs.1950972.xls","B"],["123RzY_dmkjA-hwHmxbcTOIp4Ce3B1uvh","2044-2024 Rs.511133.xls","B"],["1pnGvjWKK88rlwSIuTIK8oT_fVXSpe4lw","2041-2024 Rs.1065170.xls","B"],["12og-1lJjGKW2kRxTPUPshR59S6zh_uLL","2043-2024 Rs.1301996.xls","B"],["1IX_ACx7Nx1gW3xADb4l3WP4OiWUoMyyR","1901-2024 Rs.2098281.pdf","B"],["1PjClLM_qvFrquQYhhmdsEpzJCmOzYc6C","1559-2022-Rs-684751.jpg","B"],["1UZqjoB0Xv1CpAFTP46VdvOs-rpyVjWKn","Bill Sanction Rs 200871.pdf","C"],["1ogpJGxUCixt2q18yUrPPGbeLKPRmhfHL","Bill Sanction Rs 3237711.pdf","C"],["1dvyf7FKB1Qa4FK2RihYt4b1D2pnlGDwL","Bill Sanction Rs. 3817601.jpg","C"],["1l7Ww2RtrVVI1FD3XfDlKGpOhcvkYXu3Q","Bill Sanction Rs 21198956.pdf","C"],["1_VHVGm6wFgDWkm-HLBT1U8uiRLsfq4FI","Bill Sanction Rs 520063.pdf","C"],["1knxPi7u_ZzMafETxqPioK1EQbFAuqah4","Bill Sanction Rs 5670490.pdf","C"],["1v2cjG1SlmgVkRHJslayOrCWzuoNStecH","Bill Sanction Rs 294040.pdf","C"],["1v9qAMXIlkt6al7NPT9gsdaWPx6c8dIAN","Bill Sanction Rs 81363.pdf","C"],["1k-vXGheU4EAivEWA5SY0lRNJOmpgGgbq","Bill Sanction Rs 164440.pdf","C"],["1x-eaXx5tCkBnpk0b3RBwBSNFosAiVC9C","Bill Sanction Rs 97575.pdf","C"],["13P2-2Y0DOUwte8ypdvzlbOYpPbrAJpMM","Bill Sanction Rs 161631.pdf","C"],["1g2uQpCtSZJnMUqBzOUHU-yP38b6ezzqb","Bill Sanction Rs 2892546.pdf","C"],["10jvVjtW6T2zWOY-Yu_gveiT39FJeYfde","Bill Sanction Rs 4008806.pdf","C"],["1oeHXhE7diyg_KAGRA9qb64BX73VV2AdH","Bill Sanction Rs 1633294.pdf","C"],["1uPl7iki92HKYTkPWNmUiJiB5VpPvpWRQ","Bill Sanction Rs 2603839.pdf","C"],["1wUNqP5rsCk8E7XZLr5I1tYzLEsaiNy3o","Bill Sanction Rs 870411.pdf","C"],["1EsKKqwI_27XTaQGYGw17xWMvAQBM6D7B","Bill Sanction Rs 1169249.pdf","C"],["138NR2AOOsL7ZXBzt_s8dBeNe_WwINn4N","Bill Sanction Rs 939686.pdf","C"],["1vWVrfOfA4v-uWEtxEEO687DFoPrpESK5","Bill Sanction Rs 2183975.pdf","C"],["1Uc2cYvlJyMpS8O6vid-3ZiB0UL6KVq3w","Bill Sanction Rs 2769200.pdf","C"],["1L4cnL-AEZ1aa8CUjPksx4UQHjhhsbA49","Bill Sanction Rs. 424772.jpg","C"],["1McovIe0ACP0LpmcWyDWWXk_uUHnkpOfh","Bill Sanction Rs. 1639742.jpg","C"],["14PCOlK-nkgBjYmRLT1beSqhhsEcJJ1Qi","Bill Sanction Rs. 5431817.jpg","C"],["1nZm9z6GD990lW4am1TC5LBfmVcuLeiJK","Bill Sanction Rs 655544.pdf","C"],["169QtiiKb8FUrvCq-R57glYs5wu4G9Esk","Bill Sanction Rs. 399304.jpg","C"],["1mAdlgkReZDo08pYf7ubL5UNOqeFtNYrD","Bill Sanction Rs. 490818.jpg","C"],["1cjj0MGk7YV-rXOGr2lMex846_wStrchr","Bill Sanction Rs 3634520.pdf","C"],["1VDrApF1FUPQ5cH1ed4YxzYyRdHXftl__","Bill Sanction Rs 4353482.pdf","C"],["1jYiW1W80ZfgrFyyGY1BKnPUef-Z3WNbd","Bill Sanction Rs. 317377.jpg","C"],["1vAf-5tjYb9UtWahlPDbchR0wwOSktrz4","Bill Sanction Rs 14023865.pdf","C"],["1gWpceHCJh_o4CqNr7fQuEX6oNMzC5Q5X","Bill Sanction Rs 3156174.pdf","C"],["1XW3p4D3pYKvvY_JGJH8GzYm_tE6oYiK5","Bill Sanction Rs 1949924.pdf","C"],["1xgbOeNmeXkWTd1L_fbPC0KiIlJ0osCu5","Bill Sanction Rs 1303704.pdf","C"],["1Mp5XNBSqrXpnqQbF1R8mwKreRi3roLHA","Bill Sanction Rs 1280312.pdf","C"],["1JXoxyqQVXmlhjNsLd9szKcgvqOAq8DTy","Bill Sanction Rs 1701449.pdf","C"],["1Kqxc1zxo2A8f-fgfpai5wxI5PBTGgtEL","Bill Sanction Rs 1929780.pdf","C"],["1nIaZvsRJL78rO0Rf3CI0tfoU0_hxAWV8","Bill Sanction Rs 2569295.pdf","C"],["13bb8_aRdmtC3d9P5DMKKE1QlsdO-YbPU","Bill Sanction Rs 281926.pdf","C"],["1x9BMYzwPJfx93y9_9cBXU7X0UBLL8e_P","Bill Sanction Rs 538910.jpg","C"],["1POWokYzRPYZgyiMWhoMTZvJIp61ioxWC","Bill Sanction Rs 173266.pdf","C"],["1AEMwSPygYuFwQ1jH7SIy3jXcE-8EYEFz","Bill Sanction Rs 351039.pdf","C"],["1-d2IGCXsUlX3zeKOZoXb5ZQpbdT7B6xB","Bill Sanction Rs 728454.jpg","C"],["1B2f1skMz08xmuiLq56nQe5aNeSVnMN4g","Bill Sanction Rs 8910621.pdf","C"],["13r0umof6l8N1FY5XZnSsKhpZsoNdSSpp","Bill Sanction Rs.233492.jpg","C"],["14UmLPgnO6QhuTHwNggBTEWGOfEeSq7sH","Bill Sanction Rs. 579809.jpg","C"],["1EDVkBicUqq5zQUT6f1MLS1JkwL3w-ht-","Bill Sanction Rs.5140598.pdf","C"],["1Qgs1hjvuTIOp28PH_XWaFh5Cup9bZ2za","Bill Sanction Rs.6724829.pdf","C"],["1TSKV5MwfeAy-92ATBR9O8olhcS-o6sxT","Bill Sanction Rs. 8727618.pdf","C"],["11eCLACqGVt3QLvUDvgkx25-0e-bVwksT","Bill Sanction Rs.1187819.pdf","C"],["1K-KxZTCEObDSUDvKVvN0uNU_EVl0UnrN","Bill Sanction Rs. 639182.jpg","C"],["1mC_h0URhURrkbfthz5s2zmwt-IhSs0wt","Bill Sanction Rs. 839383.jpg","C"],["1Tc3S-qcpfn4JnxZlp9QlYNEOgVft42hz","Bill Sanction Rs.9832542.pdf","C"],["1RsqSqL1KQkTZFtXKBfAKNl8i_n-qKvHW","Bill Sanction Rs.328525.pdf","C"],["1sa-_xMlSANi_3s6iSygaV5QV6TWy3MIb","Bill Sanction Rs.729632.pdf","C"],["1ZmPNZAM0BSt04vGO5CQxGb4pYZl2H0Z9","Bill Sanction Rs.372796.pdf","C"],["1ObRG5F8WtfjL-ENUxsJiNxK_JdbG-9uZ","Bill Sanction Rs.532330.pdf","C"],["1lAPkhKVmMy5HgSlEA2b-z5nfXkfk8xH2","Bill Sanction Rs. 1032345.jpg","C"],["1zX_9y87fDgustl0U3-bpG81Z7PB8LDrn","Bill Sanction Rs.17302447.pdf","C"],["18Jf8or17UgDIHXGV_ZIcuDk01zr1mfiJ","Bill Sanction Rs. 400803.pdf","C"],["1I06PYhUkfBqmJafBBV1-KXRWyXjKOD2Q","Bill Sanction Rs. 1404889.pdf","C"],];
function EyDrvExt(nm){return String(nm||"").replace(/\.(pdf|jpg|jpeg|png|webp|gif|xls|xlsx|doc|docx)$/i,"")}
function EyDrvAmt(nm){var b=EyDrvExt(nm),m=b.match(/(\d[\d,]*)[^\d,]*$/);return m?(+m[1].replace(/,/g,"")):0}
function EyDrvNrm(nm){return EyDrvExt(nm).toLowerCase().replace(/[^a-z0-9]/g,"")}
var EyDrvFY={A:"FY 22-23|FY 23-24",B:"Contract work FY 24-25",C:"Contract work FY 25-26"};
var EyDrvCache=null;
function EyDrvIdx(){if(EyDrvCache)return EyDrvCache;EyDrvCache={amt:{},nm:{}};
 for(var i=0;i<EyDrvFiles.length;i++){var f=EyDrvFiles[i],a=EyDrvAmt(f[1]),k=EyDrvNrm(f[1]);
  if(a)(EyDrvCache.amt[a]=EyDrvCache.amt[a]||[]).push(f);
  (EyDrvCache.nm[k]=EyDrvCache.nm[k]||[]).push(f)}return EyDrvCache}
function EyDrvFind(cf){if(!cf)return null;var I=EyDrvIdx(),k=EyDrvNrm(cf.fileName||""),lst,pref;
 if(k&&I.nm[k])return I.nm[k][0];
 var c=[Math.round(+cf.receiptAmount||0),Math.round(+cf.receivableAmount||0)];
 for(var i=0;i<c.length;i++){if(!c[i])continue;lst=I.amt[c[i]];if(!lst)continue;
  pref=lst.filter(function(f){return String(EyDrvFY[f[2]]||"").indexOf(cf.fy)>=0});
  return (pref.length?pref:lst)[0]}
 return null}
function EyDrvName(cf){var f=EyDrvFind(cf);return f?f[1]:((cf&&cf.fileName)||"")}
function EyDrvCell(cf){var f=EyDrvFind(cf),nm=f?f[1]:((cf&&cf.fileName)||"");
 if(!nm)return n.jsx("span",{style:{color:"var(--tx-3)"},children:"—"});
 var url=f?("https://drive.google.com/file/d/"+f[0]+"/view"):("https://drive.google.com/drive/search?q="+encodeURIComponent(nm));
 return n.jsx("span",{title:"Open in Drive / Drive-இல் திற",style:{color:"#1d4ed8",textDecoration:"underline",cursor:"pointer",fontWeight:600},onClick:function(){window.open(url,"_blank")},children:nm})}
