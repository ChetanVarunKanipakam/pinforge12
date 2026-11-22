// ---------- drawing
function bandsOf(v){const c=['#000','#7a4a1a','#e03030','#ff8c1a','#f4d03f','#2ecc71','#3b9dff','#b57bff','#888','#fff'];const s=String(Math.round(v)),d=s.length<2?s+'0':s;return[c[+d[0]],c[+d[1]],c[Math.max(0,s.length-2)]]}
const boardSvg=()=>BRD.svg();
function partSvg(t,f){const a=t.attrs||{};let h='';
 if(t.type=='led'){const b=ledB(f,t),c=LC[a.color]||LC.red;h=`<line x1="0" y1="30" x2="0" y2="60" stroke="#aab" stroke-width="2"/><line x1="20" y1="30" x2="20" y2="60" stroke="#aab" stroke-width="2"/>${b?`<circle cx="10" cy="14" r="32" fill="${c}" opacity="${.35*b}"/>`:''}<path d="M-8 30V10a18 18 0 0 1 36 0V30z" fill="${c}" fill-opacity="${b?.55+.45*b:.4}" stroke="#0006"/><rect x="-12" y="28" width="44" height="5" rx="1" fill="${c}" fill-opacity="${b?1:.5}"/>`}
 if(t.type=='res'){const bands=bandsOf(+a.value||220);h=`<line x1="0" y1="0" x2="80" y2="0" stroke="#aab" stroke-width="2"/><rect x="16" y="-9" width="48" height="18" rx="8" fill="#d8b98a"/>`+bands.map((c,i)=>`<rect x="${24+i*8}" y="-9" width="4" height="18" fill="${c}"/>`).join('')+`<rect x="56" y="-9" width="3" height="18" fill="#c9a000"/>`}
 if(t.type=='btn'){const c=({green:'#2ecc71',red:'#e84a5f',blue:'#3b9dff',yellow:'#f4d03f',white:'#eee',black:'#333'})[a.color]||'#2ecc71';h=`<path d="M0 0H8M52 0H60M0 40H8M52 40H60" stroke="#aab" stroke-width="2"/><rect x="6" y="-8" width="48" height="56" rx="4" fill="#d9dce1" stroke="#8a8f98"/><circle class="cap" data-b="${t.id}" cx="30" cy="20" r="${t.down?13:15}" fill="${t.down?'#1f9e52':c}" stroke="#0007" stroke-width="2" style="cursor:pointer"/>`}
 if(t.type=='pot'){const v=t.val??2048,an=Math.PI*(.75+1.5*v/4095);h=`<path d="M0 60V80M20 60V80M40 60V80" stroke="#aab" stroke-width="2"/><rect x="-14" y="-22" width="68" height="82" rx="6" fill="#2f5fb3"/><circle cx="20" cy="20" r="24" fill="#d0d4da" stroke="#777"/><line x1="20" y1="20" x2="${20+20*Math.cos(an)}" y2="${20+20*Math.sin(an)}" stroke="#222" stroke-width="3"/>`}
 if(t.type=='la'){h=`<rect x="-6" y="-12" width="84" height="184" rx="6" fill="#2a2f3a" stroke="#4a5568"/><text x="46" y="80" fill="#7fb0ff" font-size="9" text-anchor="middle" font-family="monospace" transform="rotate(90 46 80)">LOGIC ANALYZER</text>`+Object.keys(D.la.pins).map((k,i)=>`<text x="8" y="${i*20+3}" fill="#cfd8e6" font-size="8" font-family="monospace">${k}</text>`).join('')}
 if(DEVDRAW[t.type])h=DEVDRAW[t.type](t);
 return h}
function draw(){ver++;const f=netf();let h=boardSvg(),cnts={};
 wires.forEach(w=>{cnts[w[0]]=(cnts[w[0]]||0)+1;cnts[w[1]]=(cnts[w[1]]||0)+1});
 wires.forEach((w,i)=>{const r=wireRoute(w,i);if(!r)return;const d=pathOf(r.pts),s=sel&&sel.k=='w'&&sel.i==i;if(s)h+=`<path d="${d}" stroke="#fff" stroke-width="8" fill="none" opacity=".3" stroke-linejoin="round"/>`;
  h+=`<path data-w="${i}" d="${d}" stroke="${COL[w[2]]||w[2]||'#2ecc71'}" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round" style="cursor:pointer"/>`;
  if(s&&r.mid&&!locked())h+=`<rect data-h="${i}" x="${r.mid.hp[0]-6}" y="${r.mid.hp[1]-6}" width="12" height="12" rx="2" fill="#fff" stroke="#2f6fed" stroke-width="2" style="cursor:${r.mid.axis=='x'?'ew':'ns'}-resize"/>`});
 parts.forEach(t=>{const d=D[t.type],s=sel&&sel.k=='p'&&sel.id==t.id,bx=d.box;
  h+=`<g data-p="${t.id}" transform="translate(${t.x},${t.y}) rotate(${(t.rot||0)*90})" style="cursor:${locked()?'default':'move'}"><rect x="${bx[0]}" y="${bx[1]}" width="${bx[2]}" height="${bx[3]}" fill="transparent"${s?' stroke="#3ddc97" stroke-dasharray="4 3" rx="4"':''}/>${partSvg(t,f)}</g>`;
  const c=rotv([bx[0]+bx[2]/2,bx[1]+bx[3]/2],t.rot),ex=(t.rot%2?bx[3]:bx[2])/2,ey=(t.rot%2?bx[2]:bx[3])/2;
  h+=`<text x="${t.x+c[0]}" y="${d.lblb?t.y+c[1]+ey+13:t.y+c[1]-ey-5}" fill="#8fa0b5" font-size="9" text-anchor="middle" font-family="monospace">${t.id}${t.type=='res'?' '+(t.attrs.value||220)+'Ω':''}</text>`});
 const all=BN.map(b=>[BID+':'+b.id,b.x,b.y,b.tip||b.l]);parts.forEach(t=>Object.keys(D[t.type].pins).forEach(k=>{const p=pinGeo(t.id+':'+k).p;all.push([t.id+':'+k,p[0],p[1],k])}));
 if(pend){const g=pinGeo(pend);if(g){const r=route2(g.p,g.d,null,null);h+=`<path d="${pathOf(r.pts)}" stroke="#7fb0ff" stroke-width="2.5" stroke-dasharray="6 5" fill="none" pointer-events="none"/>`}}
 all.forEach(([n,x,y,l])=>{const c=cnts[n]||0;h+=`<rect class="pin" data-n="${n}" x="${x-4.5}" y="${y-4.5}" width="9" height="9" rx="1.5" fill="${pend==n?'#fff':c?'#ffd166':'#d9b56a'}" stroke="#222"><title>${l}</title></rect>`+(c>1?`<circle cx="${x}" cy="${y}" r="3.2" fill="#111" pointer-events="none"/>`:'')});
 $('cvd').innerHTML=h;bar();if(fileTab=='json'&&!skipJson)setCode(JSON.stringify(toDiagram(),null,2));skipJson=false;laSample()}
function rdraw(){if(!rq)rq=requestAnimationFrame(()=>{rq=0;draw()})}
function applyCircuit(c){parts=c.parts.map(p=>({rot:0,val:2048,pos:0,kdown:[],down:false,attrs:{},...p}));wires=c.wires.map(w=>w.slice());sel=null;pend=null;devReset();draw()}
function toDiagram(){return{version:1,author:'PinForge',editor:'wokwi',parts:[{type:BRD.diagType,id:BID,top:0,left:0,attrs:{}}].concat(parts.map(t=>({type:D[t.type].t,id:t.id,top:t.y,left:t.x,...(t.rot?{rotate:t.rot*90}:{}),attrs:{...(t.attrs||{})}}))),connections:wires.map(w=>[w[0],w[1],w[2]||'green',[]]),serialMonitor:{display:'terminal'}}}
function applyDiagram(d){const T=Object.fromEntries(Object.entries(D).map(([k,v])=>[v.t,k]));const np=[];
 (d.parts||[]).forEach(q=>{const k=T[q.type];if(k&&partOk(k))np.push({id:q.id,type:k,x:snap(q.left||0),y:snap(q.top||0),rot:(((q.rotate||0)/90|0)%4+4)%4,attrs:q.attrs||{},val:2048,down:false})});
 const ok=n=>n.startsWith(BID+':')||np.some(t=>n.startsWith(t.id+':'));parts=np;wires=(d.connections||[]).filter(c=>ok(c[0])&&ok(c[1])).map(c=>[c[0],c[1],c[2]||'green']);sel=null;draw()}
