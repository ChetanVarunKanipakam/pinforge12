// ---------- inspector
function bar(){const key=JSON.stringify(sel)+parts.length+wires.length+(sel&&sel.k=='w'&&wires[sel.i]?wires[sel.i][2]:'')+locked();if(key==barKey)return;barKey=key;let h='';const dis=locked()?' disabled':'';
 if(sel&&sel.k=='p'&&part(sel.id)){const t=part(sel.id),a=t.attrs||(t.attrs={});h=`<b>${t.id}</b><span>${D[t.type].t}</span>`;
  if(t.type=='led')h+=`<select data-a="color"${dis}>${Object.keys(LC).map(c=>`<option${a.color==c?' selected':''}>${c}</option>`).join('')}</select>`;
  if(t.type=='res')h+=`<input type="number" min="1" data-a="value" value="${a.value||220}" style="width:80px"${dis}> Ω`;
  if(t.type=='btn')h+=`<select data-a="color"${dis}>${['green','red','blue','yellow','white','black'].map(c=>`<option${a.color==c?' selected':''}>${c}</option>`).join('')}</select>`;
  const selOpt=(k,arr)=>`<select data-a="${k}"${dis}>${arr.map(c=>`<option${a[k]==c?' selected':''}>${c}</option>`).join('')}</select>`;
  if(t.type=='seg7'||t.type=='seg4')h+=`<span>common</span>${selOpt('common',['cathode','anode'])}<span>colour</span>${selOpt('color',Object.keys(SEGC))}`;
  if(t.type=='rgb')h+=`<span>common</span>${selOpt('common',['cathode','anode'])}`;
  if(t.type=='bar')h+=`<span>colour</span>${selOpt('color',Object.keys(SEGC))}`;
  if(t.type=='buzz')h+=`<span>sound</span>${selOpt('sound',['on','off'])}`;
  if(t.type=='servo')h+=`<span>pulse µs</span><input type="number" data-a="min" value="${a.min||1000}" style="width:70px"${dis}> to <input type="number" data-a="max" value="${a.max||2000}" style="width:70px"${dis}><span>0° to 180°; needs V+ and GND wired</span>`;
  if(t.type=='lcd')h+=`<span>wire VSS→GND, VDD→5V, RW→GND, then RS, E and D4–D7 (or D0–D7)</span>`;
  if(I2CD[t.type]&&I2CD[t.type].ins){const sp=I2CD[t.type];h+=sp.ins(t,a,dis,selOpt);if(sp.pull)h+=`<span>on-board pull-ups</span>${selOpt('pullups',['on','off'])}`}
  if(t.type=='kp')h+=`<span>click keys, or type 0-9 * # A-D while running</span>`;
  if(t.type=='sw')h+=`<span>click the switch (works while running)</span>`;
  if(t.type=='la')h+=`<span>Wire D0–D7 to any pin or net; they appear in the Logic Analyzer tab. Without this part, active pins are shown automatically.</span>`;
  if(t.type=='pot')h+=`<input type="range" min="0" max="4095" value="${t.val??2048}" data-v="1" title="Turn the knob (works while running)">`;
  h+=`<button data-act="rot"${dis}>Rotate (R)</button><button data-act="del"${dis}>Delete</button>`}
 else if(sel&&sel.k=='w'&&wires[sel.i]){h=`<b>wire</b>`+Object.keys(COL).map(c=>`<button class="sw" data-wc="${c}" title="${c}" style="background:${COL[c]}"${dis}></button>`).join('')+`<button data-act="del"${dis}>Delete</button><span>drag the square handle to move the bend</span>`}
 else h=locked()?'The circuit is locked while the simulation runs. You can still press buttons and turn potentiometers.':'Select a part or wire to edit it · + adds parts · Delete removes · R rotates';$('insp').innerHTML=h}
function delSel(){if(locked()||!sel)return;if(sel.k=='w')wires.splice(sel.i,1);else{const id=sel.id;parts=parts.filter(t=>t.id!=id);wires=wires.filter(w=>!w[0].startsWith(id+':')&&!w[1].startsWith(id+':'))}sel=null;draw()}
function rotSel(){if(locked()||!sel||sel.k!='p')return;const t=part(sel.id);t.rot=((t.rot||0)+1)%4;draw()}
$('insp').addEventListener('click',e=>{const g=e.target;if(g.dataset.act=='del')delSel();if(g.dataset.act=='rot')rotSel();if(g.dataset.act=='eeclear'&&!locked()){const q=sel&&sel.k=='p'&&part(sel.id);if(q){q.mem=null;draw()}}if(g.dataset.wc&&sel&&!locked()){wires[sel.i][2]=g.dataset.wc;draw()}});
$('insp').addEventListener('input',e=>{const g=e.target,t=sel&&sel.k=='p'&&part(sel.id);if(!t)return;if(g.dataset.v){t.val=+g.value;draw();return}if(g.dataset.sv){(t.attrs=t.attrs||{})[g.dataset.sv]=g.value;draw();return}if(locked())return;if(g.dataset.a){(t.attrs=t.attrs||{})[g.dataset.a]=g.value;delete DV[t.id];draw()}});
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key=='Enter'){e.preventDefault();doRun();return}if((e.ctrlKey||e.metaKey)&&(e.key=='b'||e.key=='B')){e.preventDefault();doBuild();return}
 if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||!sel)return;if(e.key=='Delete'||e.key=='Backspace'){e.preventDefault();delSel()}if((e.key=='r'||e.key=='R'))rotSel();if(e.key=='Escape'){sel=null;pend=null;draw()}});
// ---------- canvas interaction (editing is blocked while running)
const pt=e=>{const m=cv.getScreenCTM();if(!m)return[0,0];const q=cv.createSVGPoint();q.x=e.clientX;q.y=e.clientY;const r=q.matrixTransform(m.inverse());return[r.x,r.y]};
function addWire(a,b){if(a==b||wires.some(w=>(w[0]==a&&w[1]==b)||(w[0]==b&&w[1]==a)))return;wires.push([a,b,'green'])}
cv.addEventListener('pointerdown',e=>{const g=e.target,n=g.dataset.n;cur=pt(e);
 if(g.dataset.k){const[id,k]=g.dataset.k.split(':'),t=part(id),i=+k;t.kdown=(t.kdown||[]).filter(x=>x!==i);t.kdown.push(i);t.kptr=true;t.dt=performance.now();sel={k:'p',id};draw();return}
 if(g.dataset.sw){const t=part(g.dataset.sw);t.pos=t.pos?0:1;sel={k:'p',id:t.id};draw();devStep(devNow());return}
 if(g.dataset.b){const t=part(g.dataset.b);t.down=true;t.dt=performance.now();sel={k:'p',id:t.id};draw();return}
 if(n){if(locked())return;if(pend&&pend!=n){addWire(pend,n);pend=null}else{pend=n;dragFrom=n}draw();return}
 if(g.dataset.h!==undefined){if(!locked())dragH=+g.dataset.h;return}
 if(g.dataset.w!==undefined){if(!locked()){sel={k:'w',i:+g.dataset.w};pend=null;draw()}return}
 const pg=g.closest('[data-p]');if(pg){const t=part(pg.dataset.p);sel={k:'p',id:t.id};pend=null;if(!locked())drag={t,dx:cur[0]-t.x,dy:cur[1]-t.y};draw();return}
 sel=null;pend=null;draw()});
cv.addEventListener('pointermove',e=>{cur=pt(e);if(dragH!==null){const w=wires[dragH],r=wireRoute(w,dragH);if(r&&r.mid){w.m=snap(r.mid.axis=='x'?cur[0]:cur[1]);draw()}}else if(drag){drag.t.x=snap(cur[0]-drag.dx);drag.t.y=snap(cur[1]-drag.dy);draw()}else if(pend)draw()});
addEventListener('pointerup',e=>{if(dragFrom){const el=document.elementFromPoint(e.clientX,e.clientY),n=el&&el.dataset&&el.dataset.n;if(n&&n!=dragFrom&&!locked()){addWire(dragFrom,n);pend=null}dragFrom=null;draw()}drag=null;dragH=null;parts.forEach(t=>{const w=Math.max(0,45-(performance.now()-(t.dt||0)));if(t.down){setTimeout(()=>{t.down=false;draw()},w)}if(t.kptr){t.kptr=false;setTimeout(()=>{t.kdown=[];draw()},w)}})});
