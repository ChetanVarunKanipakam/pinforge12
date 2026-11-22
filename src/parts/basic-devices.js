// ---------- I/O devices (levels come from the wired nets; edge-accurate because they update on every GPIO event)
const FONT5='0000000000 00005F0000 0007000700 147F147F14 242A7F2A12 2313086462 3649562050 0008070300 001C224100 0041221C00 2A1C7F1C2A 08083E0808 0080703000 0808080808 0000606000 2010080402 3E5149453E 00427F4000 7249494946 2141494D33 1814127F10 2745454539 3C4A494931 4121110907 3649494936 464949291E 0000140000 0040340000 0008142241 1414141414 0041221408 0201590906 3E415D594E 7C1211127C 7F49494936 3E41414122 7F4141413E 7F49494941 7F09090901 3E41415173 7F0808087F 00417F4100 2040413F01 7F08142241 7F40404040 7F021C027F 7F0408107F 3E4141413E 7F09090906 3E4151215E 7F09192946 2649494932 03017F0103 3F4040403F 1F2040201F 3F4038403F 6314081463 0304780403 6159494D43 007F414141 0204081020 0041417F00 0402010204 4040404040 0003070800 2054547840 7F28444438 3844444428 384444287F 3854545418 00087E0902 18A4A49C78 7F08040478 00447D4000 2040403D00 7F10284400 00417F4000 7C04780478 7C08040478 3844444438 FC18242418 18242418FC 7C08040408 4854545424 04043F4424 3C4040207C 1C2040201C 3C4030403C 4428102844 4C9090907C 4464544C44 0008364100 0000770000 0041360800 0201020402'.split(' ').map(h=>[0,1,2,3,4].map(i=>parseInt(h.substr(i*2,2),16)));
let NC=null,NCv=-1;
function netCache(){if(NCv===ver&&NC)return NC;const f=netf(),m={};
 nodes().forEach(n=>{const r=f(n),o=m[r]||(m[r]={hi:0,lo:0,an:null});
  if(n.startsWith(BID+':')){const l=base(n.slice(BID.length+1));if(l=='GND')o.lo=1;else if(l=='3V3'||l=='5V')o.hi=1;else{const s=S[l];if(s&&s.m=='OUTPUT'&&!s.od){const v=(PWMON[l]&&s.pl!=null)?s.pl:s.pw!=null?(s.pw>0?1:0):s.o;v?o.hi=1:o.lo=1}}}
  else if(n.endsWith(':SIG')){const t=part(n.split(':')[0]);if(t&&t.type=='pot')o.an=t.val??2048}else{const dv=drvOf(n);dv===1?o.hi=1:dv===0?o.lo=1:0}});NC={f,m};NCv=ver;return NC}
function lvl(node){const c=netCache(),o=c.m[c.f(node)];if(!o)return null;if(o.hi&&!o.lo)return 1;if(o.lo&&!o.hi)return 0;if(o.an!=null)return o.an>2047?1:0;return null}
const DV={},TAU=0.005,DEVT={};
const devNow=()=>M?simNow():simT;
function newDev(t){switch(t.type){case'lcd':return lcdNew();case'buzz':return{r:[],lv:0,freq:0,last:-1};case'servo':return{angle:90,rise:null,hi:0,pw:0,pwr:false};case'oled':return oledNew(t);default:{const d=I2CD[t.type];return d&&d.state?d.state(t):{avg:{}}}}}
const devOf=t=>DV[t.id]||(DV[t.id]=newDev(t));
function devReset(){for(const k in DV)delete DV[k]}
function integ(st,k,v,t){const a=st.avg[k]||(st.avg[k]={v:0,t,a:0});const dt=t-a.t;if(dt>0){const d=Math.exp(-dt/TAU);a.a=a.a*d+a.v*(1-d);a.t=t}a.v=v}
function avg(st,k,t){const a=st.avg[k];if(!a)return 0;const d=Math.exp(-Math.max(0,t-a.t)/TAU);return a.a*d+a.v*(1-d)}
function devStep(t){for(const p of parts){const f=DEVT[p.type];if(f)f(p,devOf(p),t)}}
// ----- LCD (HD44780), 4-bit and 8-bit, write-only (RW low)
function lcdNew(){return{dd:new Uint8Array(128).fill(32),cg:new Uint8Array(64),ac:0,cgm:false,id:1,s:0,disp:0,cur:0,blink:0,shift:0,dl8:true,nib:null,e:0,n:1,pw:false,writes:0}}
function lcdMove(L,dir){L.ac+=dir;if(L.cgm){L.ac&=63;return}
 if(L.n){if(dir>0){if(L.ac>0x27&&L.ac<0x40)L.ac=0x40;else if(L.ac>0x67)L.ac=0}else{if(L.ac<0)L.ac=0x67;else if(L.ac>0x27&&L.ac<0x40)L.ac=0x27}}else{if(L.ac>0x4F)L.ac=0;if(L.ac<0)L.ac=0x4F}}
function lcdByte(L,rs,d){L.writes++;
 if(rs){if(L.cgm){L.cg[L.ac&63]=d;lcdMove(L,L.id?1:-1)}else{L.dd[L.ac&127]=d;if(L.s)L.shift=(L.shift+(L.id?1:-1)+40)%40;lcdMove(L,L.id?1:-1)}return}
 if(d&0x80){L.cgm=false;L.ac=d&0x7F}else if(d&0x40){L.cgm=true;L.ac=d&0x3F}
 else if(d&0x20){L.dl8=!!(d&0x10);L.n=(d>>3)&1;if(!L.dl8)L.nib=null}
 else if(d&0x10){const sc=(d>>3)&1,rl=(d>>2)&1;if(sc)L.shift=(L.shift+(rl?-1:1)+40)%40;else lcdMove(L,rl?1:-1)}
 else if(d&0x08){L.disp=(d>>2)&1;L.cur=(d>>1)&1;L.blink=d&1}
 else if(d&0x04){L.id=(d>>1)&1;L.s=d&1}
 else if(d&0x02){L.ac=0;L.shift=0;L.cgm=false}
 else if(d&0x01){L.dd.fill(32);L.ac=0;L.id=1;L.shift=0;L.cgm=false}}
function lcdBus(L,rs,d){if(L.dl8)lcdByte(L,rs,d);else if(L.nib===null)L.nib=d&0xF0;else{lcdByte(L,rs,L.nib|((d>>4)&15));L.nib=null}}
DEVT.lcd=(p,L,t)=>{L.pw=lvl(p.id+':VDD')===1&&lvl(p.id+':VSS')===0;const e=lvl(p.id+':E')||0;
 if(L.pw&&L.e===1&&e===0&&!(lvl(p.id+':RW')||0)){let d=0;for(let i=0;i<8;i++)d|=(lvl(p.id+':D'+i)||0)<<i;lcdBus(L,lvl(p.id+':RS')||0,d)}L.e=e};
function lcdLines(L){const o=['',''];for(let r=0;r<2;r++)for(let c=0;c<16;c++)o[r]+=String.fromCharCode(L.dd[(r?0x40:0)+((c+L.shift)%40)]);return o}
function glyphRows(L,code){const r=[0,0,0,0,0,0,0,0];
 if(code<16){for(let i=0;i<8;i++)r[i]=L.cg[(code&7)*8+i]&31;return r}
 let cols=null;if(code>=32&&code<=126)cols=FONT5[code-32];
 if(code==0x7E)cols=[0x08,0x08,0x2A,0x1C,0x08];if(code==0x7F)cols=[0x08,0x1C,0x2A,0x08,0x08];if(code==0xDF)cols=[0x06,0x09,0x09,0x06,0x00];if(code==0xFF)cols=[255,255,255,255,255];
 if(!cols)return r;for(let c=0;c<5;c++)for(let i=0;i<8;i++)if((cols[c]>>i)&1)r[i]|=1<<(4-c);return r}
const LCDP=['VSS','VDD','V0','RS','RW','E','D0','D1','D2','D3','D4','D5','D6','D7','A','K'];
function lcdSvg(t){const L=devOf(t),aw=wires.some(w=>w[0]==t.id+':A'||w[1]==t.id+':A'||w[0]==t.id+':K'||w[1]==t.id+':K'),bl=aw?(lvl(t.id+':A')===1&&lvl(t.id+':K')===0):true;return lcdDraw(t,L,bl,LCDP,'LCD1602 · not powered (VSS to GND, VDD to 5V)')}
function lcdDraw(t,L,bl,pins,name){const tm=devNow();
 const on=L.pw&&L.disp,bg=!L.pw?'#2b3b22':bl?'#a9d62b':'#6f8f2a',ink=bl?'#0e1c05':'#0b1404';
 let h=`<rect x="-24" y="-134" width="368" height="148" rx="6" fill="#1e6b3a" stroke="#0f3d20"/><rect x="-6" y="-120" width="332" height="88" rx="3" fill="#10160a"/><rect x="0" y="-114" width="320" height="76" fill="${bg}"/>`;
 h+=pins.map((n,i)=>`<text x="${i*20}" y="-8" fill="#d9f0dc" font-size="6.5" text-anchor="start" font-family="monospace" transform="rotate(-90 ${i*20+2} -8)">${n}</text>`).join('');
 if(on){let d='';for(let r=0;r<2;r++)for(let c=0;c<16;c++){const code=L.dd[(r?0x40:0)+((c+L.shift)%40)],rows=glyphRows(L,code),x0=c*20+2,y0=-114+r*38+3;for(let y=0;y<8;y++)for(let x=0;x<5;x++)if((rows[y]>>(4-x))&1)d+=`M${(x0+x*3.2).toFixed(1)} ${y0+y*4}h2.6v3.4h-2.6z`}
  h+=`<path d="${d}" fill="${ink}"/>`;
  if(L.cur||L.blink){const a=L.ac,vis=a>=0x40?[1,a-0x40]:[0,a],col=((vis[1]-L.shift)%40+40)%40;if(col<16){const x0=col*20+2,y0=-114+vis[0]*38+3;if(L.cur)h+=`<rect x="${x0}" y="${y0+28}" width="16" height="3.4" fill="${ink}"/>`;if(L.blink&&Math.floor(tm*2)%2==0)h+=`<rect x="${x0-1}" y="${y0-1}" width="17.6" height="33" fill="${ink}" opacity=".85"/>`}}}
 else if(L.pw)h+=`<rect x="0" y="-114" width="320" height="76" fill="#000" opacity=".06"/>`;
 return h+`<text x="160" y="-124" fill="#b8e6c1" font-size="7" text-anchor="middle" font-family="monospace">${L.pw?(bl?'':'backlight off · ')+'LCD1602 powered':name}</text>`}
// ----- seven segment
const SEGC={red:'#ff3b30',green:'#35e06b',blue:'#4aa3ff',yellow:'#ffd400',white:'#f4f4f4'};
const SEGP={A:['h',7,0,36],B:['v',43,7,32],C:['v',43,41,32],D:['h',7,73,36],E:['v',0,41,32],F:['v',0,7,32],G:['h',7,36,36]};
function digitSvg(st,key,x0,y0,col,tm,sc){const tx=(0.105*(y0+40*sc)).toFixed(2);let h=`<g transform="translate(${tx} 0) skewX(-6)">`;const pts=(o,x,y,l)=>{const t=7,p=o=='h'?[[x+3,y],[x+l-3,y],[x+l,y+t/2],[x+l-3,y+t],[x+3,y+t],[x,y+t/2]]:[[x+t/2,y],[x+t,y+3],[x+t,y+l-3],[x+t/2,y+l],[x,y+l-3],[x,y+3]];return p.map(q=>(x0+q[0]*sc).toFixed(1)+','+(y0+q[1]*sc).toFixed(1)).join(' ')};
 for(const s in SEGP){const a=Math.min(1,avg(st,key+s,tm)*2.5),on=a>.04,[o,x,y,l]=SEGP[s];h+=`<polygon points="${pts(o,x,y,l)}" fill="${on?col:'#d4d4d0'}" opacity="${on?(.35+.65*a).toFixed(2):.55}"${on?` stroke="${col}" stroke-width="1.2" stroke-opacity=".5"`:''}/>`}
 const a=Math.min(1,avg(st,key+'DP',tm)*2.5),on=a>.04;return h+`<circle cx="${x0+53*sc}" cy="${y0+76*sc}" r="${3.6*sc}" fill="${on?col:'#d4d4d0'}" opacity="${on?(.35+.65*a).toFixed(2):.55}"/></g>`}
const segOn=(cc,seg,com)=>com&&(cc?seg===1:seg===0);
DEVT.seg7=(p,st,t)=>{const cc=(p.attrs.common||'cathode')=='cathode',c1=lvl(p.id+':COM.1'),c2=lvl(p.id+':COM.2'),com=cc?(c1===0||c2===0):(c1===1||c2===1);for(const s of ['A','B','C','D','E','F','G','DP'])integ(st,s,segOn(cc,lvl(p.id+':'+s),com)?1:0,t)};
DEVT.seg4=(p,st,t)=>{const cc=(p.attrs.common||'cathode')=='cathode';for(let d=1;d<=4;d++){const dg=lvl(p.id+':DIG'+d),en=cc?dg===0:dg===1;for(const s of ['A','B','C','D','E','F','G','DP'])integ(st,d+s,segOn(cc,lvl(p.id+':'+s),en)?1:0,t)}};
function seg7Svg(t){const st=devOf(t),tm=devNow(),col=SEGC[t.attrs.color]||SEGC.red;return `<rect x="-16" y="-14" width="112" height="130" rx="5" fill="#4a4a48"/><rect x="-12" y="-10" width="104" height="122" rx="3" fill="#080808"/><rect x="-12" y="104" width="104" height="8" rx="2" fill="#6b6b68" opacity=".6"/>${digitSvg(st,'',10,14,col,tm,1)}`+Object.keys(D.seg7.pins).map(n=>{const q=D.seg7.pins[n];return `<text x="${q[0]}" y="${q[1]?q[1]+9:-3}" fill="#8a8a86" font-size="5.5" text-anchor="middle" font-family="monospace">${n}</text>`}).join('')}
function seg4Svg(t){const st=devOf(t),tm=devNow(),col=SEGC[t.attrs.color]||SEGC.red;let h=`<rect x="-16" y="-118" width="252" height="132" rx="5" fill="#4a4a48"/><rect x="-12" y="-114" width="244" height="124" rx="3" fill="#080808"/>`;for(let d=1;d<=4;d++)h+=digitSvg(st,d,-2+(d-1)*58,-100,col,tm,0.9);return h+Object.keys(D.seg4.pins).map(n=>`<text x="${D.seg4.pins[n][0]}" y="-3" fill="#8a8a86" font-size="5.5" text-anchor="middle" font-family="monospace">${n}</text>`).join('')}
// ----- keypad 4x4
const KPL=['1','2','3','A','4','5','6','B','7','8','9','C','*','0','#','D'];
function kpSvg(t){const dn=t.kdown||[];let h=`<rect x="-14" y="-190" width="168" height="134" rx="8" fill="#0d0d0d"/><rect x="-9" y="-185" width="158" height="124" rx="5" fill="none" stroke="#f2f2f2" stroke-width="1.6"/><rect x="42" y="-56" width="56" height="38" fill="#ecdca8"/>`+[0,1,2,3,4,5,6,7].map(i=>`<rect x="${44+i*6.6}" y="-56" width="3.2" height="38" fill="#c7ab5a"/>`).join('')+`<rect x="-8" y="-22" width="156" height="28" rx="2" fill="#101010"/>`+[0,1,2,3,4,5,6,7].map(i=>`<rect x="${i*20-2}" y="-18" width="4" height="8" fill="#ededed"/><circle cx="${i*20}" cy="2" r="0" fill="#c0392b"/>`).join('');
 KPL.forEach((k,i)=>{const x=2.5+(i&3)*35,y=-181+(i>>2)*30,d=dn.includes(i),red='ABCD*#'.includes(k),fill=red?(d?'#a3242a':'#d9343b'):(d?'#1f55b8':'#2f74e0');h+=`<rect class="key" data-k="${t.id}:${i}" x="${x}" y="${y+(d?1.5:0)}" width="30" height="26" rx="5" fill="${fill}" stroke="#f4f4f4" stroke-width="1.2" style="cursor:pointer"/><text x="${x+15}" y="${y+19+(d?1.5:0)}" fill="#fff" font-size="16" font-weight="500" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" pointer-events="none">${k}</text>`});
 return h+['R1','R2','R3','R4','C1','C2','C3','C4'].map((n,i)=>`<text x="${i*20}" y="19" fill="#d0d6e4" font-size="7.5" text-anchor="middle" font-family="monospace">${n}</text>`).join('')}
// ----- buzzer (frequency measured from the edges)
DEVT.buzz=(p,st,t)=>{const v1=lvl(p.id+':1'),v2=lvl(p.id+':2'),lv=(v1===1&&v2===0)?1:(v1===0&&v2===1)?-1:0;if(lv!==st.lv){if(lv===1){st.r.push(t);if(st.r.length>16)st.r.shift()}st.lv=lv;st.last=t}
 const n=st.r.length;st.freq=(n>=3&&t-st.r[n-1]<0.05)?(n-1)/(st.r[n-1]-st.r[0]):0};
function buzzSvg(t){const st=devOf(t),f=(devNow()-st.last<0.05)?st.freq:0;return `<circle cx="10" cy="-36" r="26" fill="#1a1a1a" stroke="#444" stroke-width="2"/><circle cx="10" cy="-36" r="5" fill="#000"/>${f?`<path d="M44 -52q10 16 0 32M52 -60q16 24 0 48" fill="none" stroke="#7fb0ff" stroke-width="2"/>`:''}<text x="10" y="-4" fill="#9aa3b5" font-size="8" text-anchor="middle" font-family="monospace">${f?f.toFixed(0)+' Hz':'silent'}</text>`}
// ----- RGB LED (common cathode or anode, PWM averaged over time)
DEVT.rgb=(p,st,t)=>{const cc=(p.attrs.common||'cathode')=='cathode',c=lvl(p.id+':COM');for(const k of ['R','G','B']){const v=lvl(p.id+':'+k),on=cc?(v===1&&c===0):(v===0&&c===1);integ(st,k,on?1:0,t)}};
const rgbOf=(st,tm)=>['R','G','B'].map(k=>Math.min(1,avg(st,k,tm)));
function rgbSvg(t){const st=devOf(t),c=rgbOf(st,devNow()),m=Math.max(...c),col=`rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)})`;return `${m>.03?`<circle cx="30" cy="-34" r="40" fill="${col}" opacity=".35"/>`:''}<path d="M8 -20V-34a22 22 0 0 1 44 0V-20z" fill="${m>.03?col:'#d8d8d8'}" fill-opacity="${m>.03?.95:.35}" stroke="#555"/><rect x="4" y="-22" width="52" height="6" rx="1" fill="#cfcfcf"/><path d="M0 -16V0M20 -16V0M40 -16V0M60 -16V0" stroke="#aab" stroke-width="2"/>`}
// ----- slide switch
function swSvg(t){const x=t.pos?24:0;return `<rect x="-6" y="-38" width="52" height="30" rx="4" fill="#d0d4da" stroke="#777"/><rect class="sw" data-sw="${t.id}" x="${x-4}" y="-34" width="26" height="22" rx="3" fill="#2f6fd0" stroke="#123" style="cursor:pointer"/><path d="M0 -8V0M20 -8V0M40 -8V0" stroke="#aab" stroke-width="2"/>`}
// ----- LED bar graph
DEVT.bar=(p,st,t)=>{for(let i=1;i<=10;i++)integ(st,i,(lvl(p.id+':A'+i)===1&&lvl(p.id+':C'+i)===0)?1:0,t)};
function barSvg(t){const st=devOf(t),tm=devNow(),col=SEGC[t.attrs.color]||SEGC.green;let h=`<rect x="-14" y="-12" width="208" height="84" rx="4" fill="#25272e" stroke="#444"/>`;for(let i=1;i<=10;i++){const a=Math.min(1,avg(st,i,tm)*1.2);h+=`<rect x="${(i-1)*20-7}" y="14" width="16" height="32" rx="2" fill="${a>.04?col:'#33262a'}" opacity="${a>.04?(.35+.65*a).toFixed(2):.8}"/><text x="${(i-1)*20}" y="-2" fill="#9aa3b5" font-size="6" text-anchor="middle" font-family="monospace">A${i}</text><text x="${(i-1)*20}" y="68" fill="#9aa3b5" font-size="6" text-anchor="middle" font-family="monospace">C${i}</text>`}return h}
// ----- servo (angle from the measured pulse width)
DEVT.servo=(p,st,t)=>{const v=lvl(p.id+':PWM'),pwr=lvl(p.id+':V+')===1&&lvl(p.id+':GND')===0;st.pwr=pwr;const hi=v===1?1:0;if(hi&&!st.hi)st.rise=t;if(!hi&&st.hi&&st.rise!==null){const pw=t-st.rise;st.pw=pw;if(pwr){const mn=(+p.attrs.min||1000)/1e6,mx=(+p.attrs.max||2000)/1e6;st.angle=Math.max(0,Math.min(180,(pw-mn)/(mx-mn)*180))}}st.hi=hi};
function servoSvg(t){const st=devOf(t),a=st.angle*Math.PI/180,cx=44,cy=-86,ux=-Math.cos(a),uy=-Math.sin(a),px=-uy,py=ux;
 const arm=(len,w)=>`<line x1="${cx}" y1="${cy}" x2="${(cx+ux*len).toFixed(1)}" y2="${(cy+uy*len).toFixed(1)}" stroke="#f4f4f2" stroke-width="${w}" stroke-linecap="round"/>`;
 return `<rect x="-36" y="-82" width="108" height="12" rx="3" fill="#1f4fc4" stroke="#12328a"/><circle cx="-28" cy="-76" r="2.4" fill="#0b1f55"/><circle cx="64" cy="-76" r="2.4" fill="#0b1f55"/><rect x="-24" y="-96" width="86" height="58" rx="4" fill="#2f6fe8" stroke="#16409c" opacity=".92"/><rect x="-22" y="-94" width="82" height="14" rx="3" fill="#7fa8ff" opacity=".35"/><rect x="-14" y="-72" width="52" height="30" rx="2" fill="#e6c25a" stroke="#1a1a1a" stroke-width="1.4"/><text x="12" y="-61" fill="#1a1a1a" font-size="6.5" font-style="italic" font-family="Georgia,serif" text-anchor="middle">Micro Servo</text><text x="12" y="-52" fill="#1a1a1a" font-size="6" font-style="italic" font-family="Georgia,serif" text-anchor="middle">9g</text><text x="12" y="-45" fill="#1a1a1a" font-size="6" font-weight="700" font-family="Georgia,serif" text-anchor="middle">SG90</text><circle cx="${cx}" cy="${cy}" r="12" fill="#6fa0ff" stroke="#16409c" opacity=".9"/>`
 +arm(50,9)+arm(-16,9)+`<line x1="${(cx+px*-14).toFixed(1)}" y1="${(cy+py*-14).toFixed(1)}" x2="${(cx+px*14).toFixed(1)}" y2="${(cy+py*14).toFixed(1)}" stroke="#f4f4f2" stroke-width="7" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="4" fill="#cfcfcf" stroke="#777"/>`
 +`<path d="M0 -38C0 -24 0 -22 0 -14M20 -38C20 -28 20 -22 20 -14M40 -38C40 -30 40 -22 40 -14" fill="none" stroke-width="3.4"/><path d="M0 -38V-14" stroke="#7b4a24" stroke-width="3.4"/><path d="M20 -38V-14" stroke="#d92f2f" stroke-width="3.4"/><path d="M40 -38V-14" stroke="#ff9a1f" stroke-width="3.4"/><rect x="-8" y="-16" width="56" height="18" rx="2" fill="#141414"/>`
 +`<text x="58" y="-8" fill="${st.pwr?'#cfe8ff':'#ffb98a'}" font-size="8" font-family="monospace">${st.angle.toFixed(0)}° ${st.pwr?(st.pw*1e3).toFixed(2)+' ms':'no power'}</text>`+['GND','V+','PWM'].map((n,i)=>`<text x="${i*20}" y="19" fill="#cfd6e4" font-size="7" text-anchor="middle" font-family="monospace">${n}</text>`).join('')}
const DEVDRAW={lcd:lcdSvg,seg7:seg7Svg,seg4:seg4Svg,kp:kpSvg,buzz:buzzSvg,rgb:rgbSvg,sw:swSvg,bar:barSvg,servo:servoSvg,oled:oledSvg};
const defAttrs0=ty=>ty=='led'?{color:'red'}:ty=='res'?{value:'220'}:ty=='btn'?{color:'green'}:ty=='seg7'||ty=='seg4'?{common:'cathode',color:'red'}:ty=='rgb'?{common:'cathode'}:ty=='bar'?{color:'green'}:ty=='servo'?{min:'1000',max:'2000'}:ty=='oled'?{color:'white','i2c-address':'0x3C',height:'64'}:{};
const defAttrs=ty=>I2CD[ty]&&I2CD[ty].attrs?{...I2CD[ty].attrs}:defAttrs0(ty);
const DEVPOS={lcd:[260,260],seg7:[300,120],seg4:[300,260],kp:[300,300],buzz:[320,200],rgb:[320,200],sw:[320,200],bar:[300,200],servo:[320,200],oled:[340,200]};
const KPK={};KPL.forEach((k,i)=>{KPK[k]=i;KPK[k.toLowerCase()]=i});
function kpKey(e,down){if(!run||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const i=KPK[e.key];if(i===undefined)return;parts.filter(p=>p.type=='kp').forEach(p=>{p.kt=p.kt||{};if(down){p.kdown=(p.kdown||[]).filter(x=>x!==i);p.kdown.push(i);p.kt[i]=performance.now()}else{const w=Math.max(0,45-(performance.now()-(p.kt[i]||0)));setTimeout(()=>{p.kdown=(p.kdown||[]).filter(x=>x!==i);draw()},w)}});draw()}
addEventListener('keydown',e=>{if(!e.repeat)kpKey(e,true)});addEventListener('keyup',e=>kpKey(e,false));
let AC=null,OSC=null,GN=null;
function audioEnsure(){try{if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();if(AC.state=='suspended')AC.resume()}catch(e){}}
function audioUpdate(){try{if(!AC)return;const b=parts.find(p=>p.type=='buzz'&&p.attrs.sound!='off'),st=b&&DV[b.id],f=st&&run&&devNow()-st.last<0.06?st.freq:0;
 if(f>20&&f<20000){if(!OSC){OSC=AC.createOscillator();GN=AC.createGain();GN.gain.value=0.04;OSC.type='square';OSC.connect(GN);GN.connect(AC.destination);OSC.start()}OSC.frequency.setTargetAtTime(f,AC.currentTime,0.01)}else if(OSC){OSC.stop();OSC.disconnect();OSC=null}}catch(e){}}

