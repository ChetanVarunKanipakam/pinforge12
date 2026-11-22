// ===================== I2C bus: electrical model, device framework, monitor =====================
let I2CON={},LANAME={},I2CSEL=[null,null,null],I2CC={},I2CDG={};const I2CLOG=[],I2CLS=[{},{},{}];
const i2cPins=k=>BRD.i2cPins(k);
const I2CD={};                                   // part type -> device model (see the sensor section)
const hex2=v=>(v&255).toString(16).toUpperCase().padStart(2,'0');
const bcd=v=>((v/10|0)<<4)|(v%10),unbcd=v=>(v>>4)*10+(v&15),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sv=(p,k,d)=>{const v=parseFloat((p.attrs||{})[k]);return isNaN(v)?d:v};
const I2CDGL=[];
function i2cDiag(key,msg,t){if(I2CDG[key])return;I2CDG[key]=1;I2CDGL.push({t:t==null?devNow():t,msg});if(I2CDGL.length>40)I2CDGL.shift()}
// supply voltage seen at a node: 5 V, 3.3 V or 0
function netHasGnd(f,node){const r=f(node);for(const m of nodes())if(f(m)===r&&m.startsWith(BID+':')&&base(m.slice(BID.length+1))=='GND')return true;return false}
function railV(f,node){const r=f(node);let v=0;for(const m of nodes()){if(f(m)!==r)continue;if(m==BID+':5V')v=Math.max(v,5);else if(m.startsWith(BID+':3V3'))v=Math.max(v,3.3)}return v}
function i2cDevsOn(k){const pins=i2cPins(k),key='d'+k+pins.join();if(I2CC[key])return I2CC[key];const f=netf();
 return I2CC[key]=parts.filter(p=>D[p.type].i2c&&f(p.id+':SCL')==f(BID+':'+pins[0])&&f(p.id+':SDA')==f(BID+':'+pins[1]))}
// is a module powered? over-voltage destroys it for the rest of the run, like the real part
function devPower(p){const c=I2CC['pw'+p.id];if(c)return c;const d=I2CD[p.type],f=netf(),v=railV(f,p.id+':VCC'),gnd=netHasGnd(f,p.id+':GND'),st=devOf(p),vmax=(d.vmaxOf?d.vmaxOf(p):d.vmax);
 if(v>vmax+0.25&&gnd&&!st.burnt){st.burnt=true;i2cDiag('burn'+p.id,p.id+' ('+d.name+'): '+v+' V on a part rated '+d.vmin+'-'+vmax+' V. It is destroyed for this run (a real part would be damaged)')}
 return I2CC['pw'+p.id]={v,gnd,on:gnd&&!st.burnt&&v>=d.vmin&&v<=vmax+0.25}}
// pull-ups, rise time and drive strength of the bus (external resistors to a rail + modules' on-board resistors)
function busInfo(k){const pins=i2cPins(k),key='b'+k+pins.join();if(I2CC[key])return I2CC[key];
 const g=netf(true),devs=i2cDevsOn(k),rails=x=>railV(g,x);
 const lines=[0,1].map(i=>{const gr=g(BID+':'+pins[i]),R=[];
  parts.forEach(t=>{if(t.type!='res')return;const a=g(t.id+':1'),b=g(t.id+':2'),val=Math.max(1,+(t.attrs||{}).value||220);
   if(a==gr){const v=rails(t.id+':2');if(v)R.push([val,v])}else if(b==gr){const v=rails(t.id+':1');if(v)R.push([val,v])}});
  parts.forEach(p=>{const d=I2CD[p.type];if(d&&d.pull&&D[p.type].i2c&&(p.attrs||{}).pullups!='off'&&g(p.id+':'+(i==0?'SCL':'SDA'))==gr){const pw=devPower(p);if(pw.v&&pw.gnd)R.push([d.pull,pw.v])}});
  return R}),comb=R=>{if(!R.length)return null;let a=0,b=0;R.forEach(([r,v])=>{a+=1/r;b+=v/r});return{r:1/a,v:b/a}};
 const L=lines.map(comb),o={devs,scl:L[0],sda:L[1],cb:(15+10*devs.length)*1e-12};
 if(L[0]&&L[1]){o.tr=.8473*Math.max(L[0].r,L[1].r)*o.cb;o.v=Math.min(L[0].v,L[1].v);o.strong=Math.min(L[0].r,L[1].r)<(o.v-.4)/.003*.9}
 return I2CC[key]=o}
HOST.i2cRise=k=>{const b=busInfo(k);return b.tr||0};
HOST.i2cLow=k=>{const c=netCache();return i2cPins(k).some(n=>{const o=c.m[c.f(BID+':'+n)];return o&&o.lo})};
HOST.i2cPhy=function(k,o){const pins=i2cPins(k),b=busInfo(k);
 if(!pins.every(n=>S[n]&&S[n].af)){if(!b.scl||!b.sda)return{f:'hang'};let z=0;for(let i=7;i>=0;i--)if(!((o.bits>>i)&1)){z=7-i;break}return{f:'arlo',bit:z}}   // pins still plain GPIO: the peripheral cannot drive the lines
 if(!b.scl)return{f:'hang'};
 if(!b.sda)return o.dir=='tx'&&o.bits!=0?{f:'arlo'}:{};
 if(b.strong){i2cDiag('strong'+k,'pull-up resistors are too strong ('+(Math.min(b.scl.r,b.sda.r)|0)+' ohm): the devices cannot pull the lines low (3 mA limit), so transfers are garbled');return{f:'garble'}}
 const lim=o.hz>100e3?300e-9:1000e-9;if(b.tr>lim*1.5){i2cDiag('slow'+k,'rise time '+(b.tr*1e9|0)+' ns is far beyond the '+(lim*1e9)+' ns allowed at '+(o.hz>100e3?'400':'100')+' kHz: pull-up resistors too weak for this bus capacitance, transfers are garbled');return{f:'garble'}}
 if(b.tr>lim)i2cDiag('slowm'+k,'rise time '+(b.tr*1e9|0)+' ns exceeds the '+(lim*1e9)+' ns limit: marginal, a real bus may work or may not');
 return{}};
// slave side
HOST.i2c=function(k,op,x,hz){
 const stopAll=()=>{const l=I2CSEL[k];I2CSEL[k]=null;if(l)l.forEach(s=>{const d=I2CD[s.p.type];if(d.stop)d.stop(s.p,devOf(s.p),simNow(),s.sub)})};
 if(op=='stop'){stopAll();return}
 if(op=='addr'){stopAll();if(!i2cPins(k).every(n=>S[n]&&S[n].af))return false;const b=busInfo(k),t=simNow(),hit=[];
  for(const p of b.devs){const d=I2CD[p.type],pw=devPower(p),st=devOf(p),vmax=d.vmaxOf?d.vmaxOf(p):d.vmax;
   if(b.v>vmax+0.3&&pw.v>0&&!st.burnt){st.burnt=true;I2CC['pw'+p.id]=null;i2cDiag('burnio'+p.id,p.id+' ('+d.name+'): the bus lines are pulled up to '+b.v.toFixed(1)+' V but this part tolerates at most '+vmax+' V on its pins. It is destroyed for this run')}
   if(!pw.on)continue;const sub=d.match(p,x>>1);if(!sub)continue;
   if(d.vih!==false&&b.v&&b.v<.7*pw.v){i2cDiag('vih'+p.id,p.id+' ('+d.name+') runs at '+pw.v+' V but the bus is pulled up to only '+b.v.toFixed(1)+' V: that is below its 0.7xVDD input-high level, so it cannot see a 1');continue}
   if(hz>d.maxHz*1.02){i2cDiag('hz'+p.id,p.id+' ('+d.name+') supports at most '+d.maxHz/1e3+' kHz but SCL runs at '+(hz/1e3|0)+' kHz: it does not answer (real parts glitch or ignore the bus)');continue}
   if(d.start(p,st,x&1,t,sub)===false)continue;hit.push({p,sub})}
  if(hit.length>1)i2cDiag('dup'+(x>>1)+k,hit.map(h=>h.p.id).join(' and ')+' both answer at address 0x'+hex2(x>>1)+' on the same bus: on real hardware they answer together, writes reach both and reads are corrupted (wired-AND)');
  I2CSEL[k]=hit;return hit.length>0}
 const sel=I2CSEL[k];if(!sel||!sel.length)return op=='write'?false:0xFF;const t=simNow();
 if(op=='write'){let ack=false;sel.forEach(s=>{if(I2CD[s.p.type].write(s.p,devOf(s.p),x,t,s.sub)!==false)ack=true});return ack}
 let v=0xFF;sel.forEach(s=>{v&=I2CD[s.p.type].read(s.p,devOf(s.p),x,t,s.sub)});return v};
// waveform on SCL/SDA for the logic analyzer + transaction log for the monitor
HOST.i2cEv=function(o){if(o.ev=='diag'){i2cDiag(o.key,'I2C'+(o.k+BRD.i2c0)+': '+o.msg);return}
 const k=o.k,[scl,sda]=i2cPins(k),cT=c=>simT+(c-tickC0)/tickClk,t0=cT(o.c0),tb=o.tb/tickClk,h=tb/2,hd=tb*.08,ls=I2CLS[k];
 I2CON[scl]=I2CON[sda]=1;LANAME[scl]=scl+' · I2C'+(k+BRD.i2c0)+' SCL';LANAME[sda]=sda+' · I2C'+(k+BRD.i2c0)+' SDA';
 const set=(n,t,v)=>{t=Math.max(t,ls[n]||0);ls[n]=t;laRec(n,t,v)};
 if(!ls.init){ls.init=1;set(scl,Math.max(0,t0-1e-6),1);set(sda,Math.max(0,t0-1e-6),1)}
 let cur=ls.cur;
 if(o.ev=='S'||o.ev=='Sr'){if(o.ev=='Sr'){set(sda,t0+hd,1);set(scl,t0+h,1);set(sda,t0+tb,0);set(scl,t0+1.5*tb,0)}else{set(sda,t0,0);set(scl,t0+h,0)}
  cur=ls.cur={t:t0,k,rep:o.ev=='Sr',addr:null,rw:0,ack:null,bytes:[],done:false};I2CLOG.push(cur);if(I2CLOG.length>400)I2CLOG.shift()}
 else if(o.ev=='P'){set(sda,t0+hd,0);set(scl,t0+h,1);set(sda,t0+tb,1);if(cur)cur.done=true}
 else if(o.ev=='hang'){set(scl,t0,0)}
 else{const d=o.ev=='addr'||o.ev=='arlo'?o.a:o.b,bits=[];for(let i=7;i>=0;i--)bits.push((d>>i)&1);bits.push(o.ack?0:1);
  const n=o.ev=='arlo'?o.bit+1:9;if(o.ev=='arlo')bits[o.bit]=0;
  for(let i=0;i<n;i++){set(sda,t0+i*tb+hd,bits[i]);set(scl,t0+(i+.5)*tb,1);set(scl,t0+(i+1)*tb,0)}
  if(cur){if(o.ev=='addr'||o.ev=='arlo'){cur.addr=o.a>>1;cur.rw=o.a&1;cur.ack=o.ev=='arlo'?false:o.ack;if(o.ev=='arlo')cur.arlo=true}else cur.bytes.push([o.b,o.ack])}}};
function i2cMonText(){const dg=I2CDGL.map(e=>e.t.toFixed(6).padStart(10)+' s  ⚠ '+e.msg),head=dg.length?dg.join('\n')+'\n'+'─'.repeat(64)+'\n':'';
 if(!I2CLOG.length)return head+(run?'No I2C traffic yet.':'Run a program that uses I2C1/I2C2 (PB6/PB7, PB8/PB9 remapped, or PB10/PB11).');
 return head+I2CLOG.slice(-120).map(e=>{const hx=e.bytes.map(b=>hex2(b[0])+(b[1]?'':'!'));const body=hx.length>16?hx.slice(0,14).join(' ')+' … ('+hx.length+' bytes)':hx.join(' ');
  return e.t.toFixed(6).padStart(10)+' s  I2C'+(e.k+BRD.i2c0)+'  '+(e.rep?'Sr ':'S  ')+(e.addr===null?'      ':'0x'+hex2(e.addr)+(e.rw?' R ':' W '))+(e.addr===null?'':(e.arlo?'ARLO':e.ack?'ACK ':'NACK'))+'  '+body+(e.done?'  P':'')}).join('\n')}
let i2cMonLast='';function i2cMonDraw(){if(dockT!='i2c')return;const el=$('i2cmon'),t=i2cMonText();if(t!==i2cMonLast){i2cMonLast=t;el.textContent=t;const p=$('p-i2c');p.scrollTop=p.scrollHeight}}
// pin driven by a part (interrupt outputs): used by sense() / netCache()
let drvBusy=false;
function drvOf(m){if(drvBusy)return null;const i=m.indexOf(':'),id=m.slice(0,i);if(id==BID)return null;const t=part(id),d=t&&I2CD[t.type];if(!d||!d.drive)return null;drvBusy=true;try{return d.drive(t,devOf(t),m.slice(i+1),devNow())}finally{drvBusy=false}}
const drvDirty=()=>{ver++;NCv=-1};
// generic register-file slave: first byte after the address = register pointer, pointer auto-increments
function regDev(o){return Object.assign({
 start(p,st,rw,t,sub){st.fresh=rw?0:1;if(o.begin)return o.begin(p,st,rw,t,sub)},
 write(p,st,b,t,sub){if(st.fresh){st.fresh=0;st.ptr=b;return true}const r=o.wreg(p,st,st.ptr,b,t,sub);st.ptr=o.next?o.next(st.ptr,st):(st.ptr+1)&255;return r!==false},
 read(p,st,ack,t,sub){const v=o.rreg(p,st,st.ptr,t,sub);st.ptr=o.next?o.next(st.ptr,st):(st.ptr+1)&255;return v&255},
 stop(){}},o)}
// small SVG helpers for breakout boards
const svPcb=(id,x,y,w,h,c1,c2)=>`<defs><linearGradient id="pg${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="url(#pg${id})" stroke="#0006" stroke-width="1.5"/><rect x="${x+2.5}" y="${y+2.5}" width="${w-5}" height="${h-5}" rx="3.5" fill="none" stroke="#fff" stroke-opacity=".16"/>`;
const svHdr=names=>`<rect x="-10" y="-6" width="${(names.length-1)*20+20}" height="12" rx="1.5" fill="#15161a"/>`+names.map((n,i)=>`<path d="M${i*20} -6V-14" stroke="#9aa0a8" stroke-width="2.4"/><text x="${i*20}" y="15.5" fill="#f2f6ff" font-size="${names.length>6?6.6:7.4}" font-weight="700" text-anchor="middle" font-family="monospace">${n}</text>`).join('');
const svHole=(x,y)=>`<circle cx="${x}" cy="${y}" r="5.2" fill="#d7b15a"/><circle cx="${x}" cy="${y}" r="3" fill="#0e1319"/>`;
const svSmd=(x,y,w,h,txt,fill)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${fill||'#1a1a1a'}"/><rect x="${x}" y="${y}" width="${Math.min(2.4,w/4)}" height="${h}" fill="#c9c9c9"/><rect x="${x+w-Math.min(2.4,w/4)}" y="${y}" width="${Math.min(2.4,w/4)}" height="${h}" fill="#c9c9c9"/>${txt?`<text x="${x+w/2}" y="${y+h/2+1.3}" fill="#bbb" font-size="3.6" text-anchor="middle" font-family="monospace">${txt}</text>`:''}`;
const svChip=(x,y,w,h,l1,l2,dot)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#17181b" stroke="#2b2d33"/>${dot!==false?`<circle cx="${x+5}" cy="${y+5}" r="1.6" fill="#555"/>`:''}${l1?`<text x="${x+w/2}" y="${y+h/2+(l2?-1:2)}" fill="#c4c8d0" font-size="${Math.min(7,w/6.5)}" text-anchor="middle" font-family="monospace" font-weight="700">${l1}</text>`:''}${l2?`<text x="${x+w/2}" y="${y+h/2+8}" fill="#8e939c" font-size="${Math.min(5.5,w/8)}" text-anchor="middle" font-family="monospace">${l2}</text>`:''}`;
const svLed=(x,y,on,col)=>`${on?`<circle cx="${x}" cy="${y}" r="9" fill="${col||'#35e06b'}" opacity=".35"/>`:''}<rect x="${x-3.5}" y="${y-2.5}" width="7" height="5" rx="1" fill="${on?(col||'#35e06b'):'#2a4a33'}" stroke="#0007" stroke-width=".6"/>`;
const svStatus=(x,y,msg)=>msg?`<text x="${x}" y="${y}" fill="#ffb4a8" font-size="6" text-anchor="middle" font-family="monospace">${msg}</text>`:'';
const numIn=(p,key,lab,min,max,step,dflt,unit)=>`<span>${lab}</span><input type="number" min="${min}" max="${max}" step="${step}" data-sv="${key}" value="${sv(p,key,dflt)}" style="width:74px">${unit?'<span>'+unit+'</span>':''}`;

let DRVP=false,drvC=0;
