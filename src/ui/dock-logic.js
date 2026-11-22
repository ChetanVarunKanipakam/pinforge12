// ---------- logic analyzer
let UTX=['PA9','PA2','PB10'];
const laRec=(k,t,v)=>{const a=LA[k]||(LA[k]=[]);if(a.length&&a[a.length-1][1]===v)return;a.push([t,v]);if(a.length>90000)a.splice(0,30000)};
function laLevel(n){const s=S[n];if(!s)return null;if(s.m=='OUTPUT'){if(s.af)return(UTX.includes(n)||s.od)?1:3;return s.pw!=null?(s.pw>0?1:0):s.o}
 if(lvv!==ver)refreshLV();const pi=BRD.parse(n);if(!pi)return null;const v=LV[pi[0]][pi[1]];return v==2?(s.m=='INPUT_PULLUP'?1:s.pd?0:3):v}
const probes=()=>{const o=[];parts.filter(p=>p.type=='la').forEach(p=>{for(let k=0;k<8;k++){const node=p.id+':D'+k;if(wires.some(w=>w[0]==node||w[1]==node))o.push({key:node,k})}});return o};
function laSample(){if(!run&&!M)return;const t=simNow(),pr=probes();
 if(!pr.length){const wired=new Set();wires.forEach(w=>[w[0],w[1]].forEach(x=>{if(x.startsWith(BID+':'))wired.add(base(x.slice(BID.length+1)))}));
  for(const n in S){const s=S[n];if(PWMON[n]||UARTON[n]||I2CON[n])continue;if(!(s.m=='OUTPUT'||s.m=='INPUT_PULLUP'||wired.has(n)||LA[n]))continue;const v=laLevel(n);if(v!==null)laRec(n,t,v)}return}
 const f=netf(),nd=nodes();pr.forEach(({key})=>{const r=f(key);let alias=null;for(const m of nd){if(f(m)!=r||!m.startsWith(BID+':'))continue;const l=base(m.slice(BID.length+1));if(PWMON[l]||UARTON[l]||I2CON[l]){alias=l;break}}
  LAalias[key]=alias;if(alias)return;const o=sense(f,key);let v=o.an!=null?100+o.an:(o.hi&&!o.lo)?1:(o.lo&&!o.hi)?0:3;
  if(v==3&&!o.hi&&!o.lo)for(const m of nd){if(f(m)!=r||!m.startsWith(BID+':'))continue;const q=S[base(m.slice(BID.length+1))];if(q&&q.m=='INPUT_PULLUP'){v=1;break}if(q&&q.pd){v=0;break}}
  laRec(key,t,v)})}
function laChannels(){const pr=probes();if(pr.length){const f=netf(),nd=nodes();return pr.map(({key,k})=>{const r=f(key);let lab=null,other=null;for(const m of nd){if(m==key||f(m)!=r)continue;if(m.startsWith(BID+':')){const l=base(m.slice(BID.length+1));if(!['GND','3V3','5V'].includes(l)){lab=l;break}other=other||l}else other=other||m.replace(':','.')}
  return{key,name:'D'+k+' '+(lab||other||'—'),ser:()=>LAalias[key]?LA[LAalias[key]]||[]:LA[key]||[]}})}
 return Object.keys(LA).filter(n=>!n.includes(':')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(n=>({key:n,name:LANAME[n]||n,ser:()=>LA[n]||[]}))}
const fmtF=f=>f>=1e6?(f/1e6).toFixed(2)+' MHz':f>=1e3?(f/1e3).toFixed(2)+' kHz':f.toFixed(2)+' Hz';
const fmtT=(t,step)=>step<0.001?(t*1e6).toFixed(0)+' µs':step<1?(t*1e3).toFixed(step<0.01?1:0)+' ms':t.toFixed(step<1?1:0)+' s';
function measure(a,t0,t1){const rise=[],fall=[];let prev=null;for(const[t,v]of a){const hi=v==1?1:v==0?0:null;if(hi===null){prev=null;continue}if(prev!==null&&hi!==prev&&t>=t0&&t<=t1)(hi?rise:fall).push(t);prev=hi}
 if(rise.length<3)return'';const per=[];for(let i=1;i<rise.length;i++)per.push(rise[i]-rise[i-1]);if(Math.max(...per)/Math.min(...per)>1.05)return'';const P=(rise[rise.length-1]-rise[0])/(rise.length-1),hs=[];
 for(const r of rise){const f=fall.find(x=>x>r);if(f!==undefined&&f-r<P*1.5)hs.push(f-r)}return fmtF(1/P)+(hs.length?' · '+Math.round(hs.reduce((x,y)=>x+y,0)/hs.length/P*100)+'%':'')}
const LCOL=['#3bf0c0','#7dff9a','#7dd3fc','#f9c74f','#f78fb3','#b8a4ff','#ffa94d','#9ae6b4'];
function laDraw(){if(dockT!='logic'||$('dock').classList.contains('min'))return;const c=$('la'),W=c.clientWidth,H=c.clientHeight;if(!W||!H)return;const dpr=devicePixelRatio||1;if(c.width!=W*dpr||c.height!=H*dpr){c.width=W*dpr;c.height=H*dpr}const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
 const ch=laChannels(),win=+$('laWin').value,live=run?simNow():simT;if(!laHold)laFroz=live;const t1=laHold?laFroz:live,t0=Math.max(0,t1-win),lw=Math.min(150,Math.max(96,W*.22)),pw=W-lw-8,px=t=>lw+(t-t0)/win*pw;
 const hasP=probes().length>0;let info=ch.length?ch.length+' channel'+(ch.length>1?'s':'')+(hasP?' (probes)':' (auto)')+' · '+(laHold?'held at ':'t = ')+t1.toFixed(4)+' s':'';
 if(laMouse!==null&&laMouse>=lw){const tc=t0+(laMouse-lw)/pw*win;info+=' · cursor '+tc.toFixed(5)+' s'}$('laInfo').textContent=info||'No signals yet';
 if(!ch.length){x.fillStyle='#5b6a7c';x.font='12px system-ui';x.fillText('Waveforms appear for output pins, pulled-up inputs and wired pins — or add a Logic Analyzer part with +, and wire its channels to any pin.',12,28);return}
 const rh=Math.min(44,(H-18)/ch.length),raw=win/6,pow=Math.pow(10,Math.floor(Math.log10(raw))),step=[1,2,5,10].map(m=>m*pow).find(v=>v>=raw);
 x.font='10px ui-monospace,monospace';x.lineWidth=1;x.strokeStyle='#1f2b3b';x.fillStyle='#5b6a7c';for(let g=Math.ceil(t0/step)*step;g<=t1+1e-12;g+=step){const gx=px(g);x.beginPath();x.moveTo(gx,0);x.lineTo(gx,H-14);x.stroke();x.fillText(fmtT(g,step),gx+2,H-3)}
 ch.forEach((cx,k)=>{const y0=4+k*rh,hi=y0+5,lo=y0+rh-12,col=LCOL[k%8],a=cx.ser();x.font='11px ui-monospace,monospace';x.fillStyle='#cfe0f5';x.fillText(cx.name,6,y0+13);x.font='10px ui-monospace,monospace';x.fillStyle='#7b8da8';const la=a.length?a[a.length-1][1]:0;x.fillText(la>=100?(la-100)+' · '+((la-100)/4095*3.3).toFixed(2)+' V':measure(a,t0,t1),6,y0+26);
  const yv=v=>v>=100?lo-(lo-hi)*((v-100)/4095):v==1?hi:v==0?lo:(hi+lo)/2;let cv0=a.length?a[0][1]:3;for(const e of a){if(e[0]<=t0)cv0=e[1];else break}
  const seg=[];let sx=lw,lvl=cv0;for(const e of a){if(e[0]<=t0)continue;if(e[0]>t1)break;const ex=px(e[0]);seg.push([sx,ex,lvl]);seg.push([ex,ex,lvl,e[1]]);sx=ex;lvl=e[1]}seg.push([sx,lw+pw,lvl]);
  x.lineWidth=2;seg.forEach(g=>{x.strokeStyle=g[2]==3?'#6b7a8f':col;x.setLineDash(g[2]==3?[4,4]:[]);x.beginPath();if(g.length==4){x.moveTo(g[0],yv(g[2]));x.lineTo(g[0],yv(g[3]))}else{x.moveTo(g[0],yv(g[2]));x.lineTo(g[1],yv(g[2]))}x.stroke()});x.setLineDash([]);
  x.strokeStyle='#18232f';x.lineWidth=1;x.beginPath();x.moveTo(0,y0+rh-3);x.lineTo(W,y0+rh-3);x.stroke()});
 if(laMouse!==null&&laMouse>=lw){x.strokeStyle='#ffffff55';x.setLineDash([3,3]);x.beginPath();x.moveTo(laMouse,0);x.lineTo(laMouse,H-14);x.stroke();x.setLineDash([])}}
$('la').addEventListener('mousemove',e=>{laMouse=e.offsetX;laDraw()});$('la').addEventListener('mouseleave',()=>{laMouse=null;laDraw()});
$('laHold').onchange=e=>{laHold=e.target.checked;laDraw()};
$('laWin').onchange=laDraw;
setInterval(()=>{if(run){const s=simT;$('tm').textContent=String(s/60|0).padStart(2,'0')+':'+(s%60).toFixed(3).padStart(6,'0');$('stRun').textContent='Running · '+Math.round(spd*100)+'% · '+Math.round(M.sysclk()/1e6)+' MHz';regsDraw();laDraw();i2cMonDraw();audioUpdate();if(parts.some(p=>DEVDRAW[p.type]))rdraw()}else{audioUpdate()}},120);
