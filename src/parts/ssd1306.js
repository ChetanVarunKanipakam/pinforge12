// ===================== SSD1306 OLED module =====================
/*SSD1306-BEGIN*/
// ---- SSD1306 OLED controller (128x64 / 128x32), I2C command + GDDRAM model. Pure logic: no DOM.
function oledNew(t){const a=(t&&t.attrs)||{},h=+a.height==32?32:64;
 return{h,ram:new Uint8Array(1024),col:0,page:0,cs:0,ce:127,ps:0,pe:7,mode:2,on:0,all:0,inv:0,con:0x7F,remap:0,rev:0,sl:0,off:0,mux:h-1,pump:0,
  exp:'ctl',co:0,dc:0,need:0,cmd:0,args:[],sc:null,sa:null,wr:0,cmds:0,seen:0,bytes:0}}
function oledAdv(L){
 if(L.mode==0){L.col++;if(L.col>L.ce){L.col=L.cs;L.page++;if(L.page>L.pe)L.page=L.ps}}
 else if(L.mode==1){L.page++;if(L.page>L.pe){L.page=L.ps;L.col++;if(L.col>L.ce)L.col=L.cs}}
 else L.col=(L.col+1)&127}
function oledData(L,b){L.ram[(L.page&7)*128+(L.col&127)]=b;L.wr++;oledAdv(L)}
const OLED_SCROLL_FRAMES=[5,64,128,256,3,4,25,2];
function oledExec(L,c,a,t){
 switch(c){
  case 0x20:L.mode=a[0]&3;if(L.mode==3)L.mode=2;break;
  case 0x21:L.cs=a[0]&127;L.ce=a[1]&127;L.col=L.cs;break;
  case 0x22:L.ps=a[0]&7;L.pe=a[1]&7;L.page=L.ps;break;
  case 0x26:case 0x27:case 0x29:case 0x2A:L.sa={left:c==0x27||c==0x2A,sp:a[1]&7,ep:a[3]&7,dt:OLED_SCROLL_FRAMES[a[2]&7]/100};break;
  case 0x81:L.con=a[0]&255;break;
  case 0x8D:L.pump=(a[0]&4)?1:0;break;
  case 0xA8:L.mux=(a[0]&63)||0;if(L.mux<15)L.mux=L.mux;break;
  case 0xD3:L.off=a[0]&63;break}}
const OLED_ARGS={0x20:1,0x21:2,0x22:2,0x26:6,0x27:6,0x29:5,0x2A:5,0x81:1,0x8D:1,0xA3:2,0xA8:1,0xD3:1,0xD5:1,0xD9:1,0xDA:1,0xDB:1};
function oledCmd(L,b,t){L.cmds++;
 if(L.need>0){L.args.push(b);if(--L.need==0)oledExec(L,L.cmd,L.args,t);return}
 if(b<0x10){L.col=(L.col&0xF0)|(b&15);return}
 if(b<0x20){L.col=(L.col&0x0F)|((b&15)<<4);return}
 if(b>=0x40&&b<0x80){L.sl=b&63;return}
 if(b>=0xB0&&b<0xB8){L.page=b&7;return}
 if(OLED_ARGS[b]){L.cmd=b;L.need=OLED_ARGS[b];L.args=[];return}
 switch(b){
  case 0xA0:L.remap=0;break;case 0xA1:L.remap=1;break;
  case 0xA4:L.all=0;break;case 0xA5:L.all=1;break;
  case 0xA6:L.inv=0;break;case 0xA7:L.inv=1;break;
  case 0xAE:L.on=0;break;case 0xAF:L.on=1;break;
  case 0xC0:L.rev=0;break;case 0xC8:L.rev=1;break;
  case 0x2E:L.sc=null;L.wr++;break;
  case 0x2F:if(L.sa)L.sc={on:1,left:L.sa.left,sp:L.sa.sp,ep:L.sa.ep,dt:L.sa.dt,t0:t||0};L.wr++;break}}
// one byte received on the I2C bus after the address phase (first byte of a transaction is a control byte)
function oledWrite(L,b,t){L.seen++;L.bytes++;
 if(L.exp=='ctl'){L.co=(b>>7)&1;L.dc=(b>>6)&1;L.exp='data';return true}
 if(L.dc)oledData(L,b);else oledCmd(L,b,t);
 if(L.co)L.exp='ctl';return true}
function oledStart(L){L.exp='ctl';L.need=0}
// framebuffer as seen on the glass: Uint8Array(128*h) of 0/1
function oledFrame(L,t){const H=L.h,N=Math.min(H,L.mux+1),out=new Uint8Array(128*H);
 if(!L.on||!L.pump)return out;
 const sc=L.sc,step=sc&&sc.on?Math.floor(Math.max(0,t-sc.t0)/sc.dt)%128:0;
 for(let y=0;y<N;y++){const com=L.rev?y:N-1-y,r=(com+L.sl+L.off)&63,pg=r>>3,bit=r&7,base=pg*128,sh=sc&&sc.on&&pg>=sc.sp&&pg<=sc.ep?(sc.left?step:-step):0;
  for(let x=0;x<128;x++){let sx=L.remap?x:127-x;sx=((sx+sh)%128+128)%128;let v=(L.ram[base+sx]>>bit)&1;if(L.all)v=1;if(L.inv)v^=1;out[y*128+x]=v}}
 return out}
/*SSD1306-END*/
const OLEDC={white:'#dcebff',blue:'#52acff',yellow:'#ffd23a',dual:'#52acff'},OLED_S=111.5/128;
function oledRuns(F,y0,y1){let d='';for(let y=y0;y<y1;y++){let x=0;while(x<128){if(F[y*128+x]){let e=x;while(e<128&&F[y*128+e])e++;d+='M'+x+' '+y+'h'+(e-x)+'v1h'+(x-e)+'z';x=e}else x++}}return d}
function oledSvg(t){const L=devOf(t),a=t.attrs||{},pw=devPower(t).on,H=L.h,tm=devNow(),id=t.id,vis=pw&&L.on&&L.pump;L.dw=L.wr;
 const sc=L.sc&&L.sc.on?Math.floor(Math.max(0,tm-L.sc.t0)/L.sc.dt)%128:0,key=L.wr+'|'+L.cmds+'|'+sc+'|'+vis+'|'+(a.color||'white');
 if(L.pk!==key){L.pk=key;if(vis){const F=oledFrame(L,tm);L.paths=(a.color=='dual')?[[oledRuns(F,0,Math.min(16,H)),OLEDC.yellow],[oledRuns(F,Math.min(16,H),H),OLEDC.blue]]:[[oledRuns(F,0,H),OLEDC[a.color]||OLEDC.white]]}else L.paths=[]}
 const ox=-25.75,oy=H==32?68.2:54.25,op=(.55+.45*L.con/255).toFixed(2);
 let msg=null;if(!pw)msg=['no power','wire VCC to 3V3 and GND'];else if(!L.seen)msg=['waiting for I2C data','address 0x'+hex2(oledAddr(t))];else if(!L.pump)msg=['charge pump off','send 0x8D 0x14'];else if(!L.on)msg=['display off','send 0xAF'];
 // module is drawn with its 4-pin header on the top edge, like most 0.96" boards (pins at y = 0)
 let h=`<defs><linearGradient id="op${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b4aa3"/><stop offset="1" stop-color="#1767cf"/></linearGradient>
<linearGradient id="og${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1d23"/><stop offset=".5" stop-color="#0c0d10"/><stop offset="1" stop-color="#16181d"/></linearGradient>
<linearGradient id="of${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9c6a1c"/><stop offset=".5" stop-color="#e0aa4a"/><stop offset="1" stop-color="#c58a2c"/></linearGradient></defs>
<rect x="-40" y="-12" width="140" height="144" rx="5" fill="url(#op${id})" stroke="#07306b" stroke-width="1.5"/>
<rect x="-38" y="-10" width="136" height="140" rx="4" fill="none" stroke="#4b8ae6" stroke-opacity=".35"/>`;
 for(const [hx,hy] of [[-30,122],[90,122],[-30,-2],[90,-2]])h+=`<circle cx="${hx}" cy="${hy}" r="5.4" fill="#d7b15a"/><circle cx="${hx}" cy="${hy}" r="3.1" fill="#0e1319"/>`;
 h+=`<rect x="-37" y="30" width="134" height="97" rx="2" fill="url(#og${id})" stroke="#3a3f49"/><rect x="-33.5" y="33.5" width="127" height="90" rx="1" fill="none" stroke="#000" stroke-opacity=".55"/>
<rect x="${ox}" y="${oy}" width="111.5" height="${(H*OLED_S).toFixed(2)}" fill="#000"/>`;
 if(vis)h+=`<g transform="translate(${ox} ${oy}) scale(${OLED_S.toFixed(4)})" opacity="${op}" shape-rendering="crispEdges">${L.paths.map(([d,c])=>`<path d="${d}" fill="${c}"/>`).join('')}</g>`;
 else if(msg)h+=`<text x="${ox+55.75}" y="${oy+H*OLED_S/2-1}" fill="#3d5a78" font-size="7" text-anchor="middle" font-family="monospace">${msg[0]}</text><text x="${ox+55.75}" y="${oy+H*OLED_S/2+9}" fill="#2c4259" font-size="5.6" text-anchor="middle" font-family="monospace">${msg[1]}</text>`;
 h+=`<path d="M-37 127H97L45 30H-37z" fill="#fff" opacity=".022"/>
<rect x="-30" y="24" width="120" height="6" fill="url(#of${id})"/><rect x="-30" y="23.3" width="120" height="1.2" fill="#6b4710" opacity=".6"/>
<rect x="-24" y="16.5" width="9" height="5" rx="1" fill="#1a1a1a"/><rect x="-24" y="16.5" width="2" height="5" fill="#bbb"/><rect x="-13" y="16.5" width="9" height="5" rx="1" fill="#1a1a1a"/><rect x="-13" y="16.5" width="2" height="5" fill="#bbb"/>
<text x="-19.5" y="20.3" fill="#9a9a9a" font-size="3.4" text-anchor="middle" font-family="monospace">472</text><text x="-8.5" y="20.3" fill="#9a9a9a" font-size="3.4" text-anchor="middle" font-family="monospace">472</text>
<rect x="68" y="16.5" width="8" height="5" rx="1" fill="#c9a36b"/><rect x="80" y="16.5" width="8" height="5" rx="1" fill="#c9a36b"/><rect x="12" y="16" width="26" height="6" rx="1" fill="#111"/><circle cx="16" cy="19" r="1" fill="#555"/>
<rect x="-12" y="-6" width="84" height="12" rx="1.5" fill="#15161a"/><path d="M0 -6V-14M20 -6V-14M40 -6V-14M60 -6V-14" stroke="#9aa0a8" stroke-width="2.4"/>`;
 h+=['GND','VCC','SCL','SDA'].map((n,i)=>`<text x="${i*20}" y="14.5" fill="#eaf2ff" font-size="7.6" font-weight="700" text-anchor="middle" font-family="monospace">${n}</text>`).join('');
 return h}// ===================== sensor models (register maps follow the datasheets) =====================
