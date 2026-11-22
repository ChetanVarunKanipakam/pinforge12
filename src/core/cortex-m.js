/* ============================================================================================
   PinForge core: ARM Cortex-M CPU (Thumb / Thumb-2), exceptions, NVIC, SysTick, SCB subset,
   event scheduler and the bus router. Knows nothing about any particular chip.

   A chip (src/chip/*.js) builds a CortexM with a memory configuration and then attaches
   peripherals (src/peripheral/*.js). A peripheral module is a plain object:

     { name,
       regions: [[lo, hi], ...]        // address ranges (hi exclusive) it answers on the bus
       rd(a, n) -> value               // register read  (n = 1, 2 or 4 bytes)
       wr(a, n, v)                     // register write
       reset()                         // power-on / reset state
       post()                          // optional: runs after every module has been reset
       tick(cycles)                    // optional: advance time
       level()                         // optional: raise level-sensitive IRQs with T.irq(n)
     }

   Chip configuration (cfg):
     flashBase, flashSize           code memory (vector table is read from flashBase)
     flashAlias                     optional: address that also maps the start of flash (boot alias)
     ramBase, ramSize               main RAM
     ramBanks                       optional extra RAM banks [{base,size}] (e.g. LPC1768 AHB SRAM)
     periphRanges                   optional extra peripheral windows below 0x40000000 [[lo,hi]] (e.g. LPC1768 GPIO at 0x2009C000)
     prioBits                       implemented NVIC priority bits (default 4; LPC1768 has 5)
     cpuid                          value of the CPUID register
   ============================================================================================ */
function CortexM(host,cfg){
 const T=this;T.host=host||{};T.cfg=cfg;
 T.r=new Int32Array(16);T.N=T.Z=T.C=T.V=0;T.it=0;T.ipsr=0;T.primask=0;T.cy=0;T.halted=null;
 const FB=cfg.flashBase>>>0,FS=cfg.flashSize,AL=cfg.flashAlias==null?-1:cfg.flashAlias>>>0,RB=cfg.ramBase>>>0,RS=cfg.ramSize;
 T.flash=new Uint8Array(FS);T.ram=new Uint8Array(RS);
 T.banks=(cfg.ramBanks||[]).map(b=>({base:b.base>>>0,size:b.size,data:new Uint8Array(b.size)}));
 T.pmask=(0xFF<<(8-(cfg.prioBits||4)))&0xFF;T.hiP=(cfg.periphRanges||[]).map(([lo,hi])=>[lo>>>0,hi>>>0]);
 T.pend=[];T.nvEn=[0,0,0];T.nvPend=[0,0,0];T.ipr=new Uint8Array(96);T.shp=new Uint8Array(12);T.act=[];
 T.st={ctrl:0,load:0,val:0,flag:0,acc:0};
 T.evq=[];T.sched=function(at,f){const q=T.evq;let i=q.length;while(i>0&&q[i-1].at>at)i--;q.splice(i,0,{at,f})};
 T.runEv=function(){const q=T.evq;while(q.length&&q[0].at<=T.cy){const e=q.shift();e.f()}};
 // ---- peripherals
 T.periph=[];T.regions=[];T.postHooks=[];T.tickers=[];T.levelers=[];
 T.attach=function(m){T.periph.push(m);for(const[lo,hi]of m.regions||[])T.regions.push({lo:lo>>>0,hi:hi>>>0,m});
  if(m.post)T.postHooks.push(m.post);if(m.tick)T.tickers.push(m.tick);if(m.level)T.levelers.push(m.level);return m};
 T.reset=function(){T.r.fill(0);T.N=T.Z=T.C=T.V=0;T.it=0;T.ipsr=0;T.halted=null;T.cy=0;T.pend=[];T.act=[];T.ipr.fill(0);T.shp.fill(0);
  T.r[13]=T.rd32(FB)|0;T.r[15]=T.rd32(FB+4)&~1;T.r[14]=-1;
  T.st={ctrl:0,load:0,val:0,flag:0,acc:0};T.ram.fill(0);T.banks.forEach(b=>b.data.fill(0));
  T.nvEn=[0,0,0];T.nvPend=[0,0,0];T.evq=[];
  for(const m of T.periph)if(m.reset)m.reset();
  for(const f of T.postHooks)f()};
 T.load=function(bytes,addr){T.flash.fill(0xFF);for(let i=0;i<bytes.length;i++){const a=(addr==null?FB:addr)+i-FB;if(a>=0&&a<FS)T.flash[a]=bytes[i]}};
 // ---- memory bus
 const rdMem=(m,o,n)=>n==4?(m[o]|m[o+1]<<8|m[o+2]<<16|m[o+3]<<24)>>>0:n==2?m[o]|m[o+1]<<8:m[o];
 const wrMem=(m,o,n,v)=>{m[o]=v;if(n>1){m[o+1]=v>>8;if(n>2){m[o+2]=v>>16;m[o+3]=v>>24}}};
const inHi=a=>{for(const r of T.hiP)if((a-r[0])>>>0<r[1]-r[0])return true;return false};
 T.rd=function(a,n){a>>>=0;
  if((a-RB)>>>0<RS)return rdMem(T.ram,a-RB,n);
  if((a-FB)>>>0<FS)return rdMem(T.flash,a-FB,n);
  if(AL>=0&&(a-AL)>>>0<FS)return rdMem(T.flash,a-AL,n);
  for(const b of T.banks)if((a-b.base)>>>0<b.size)return rdMem(b.data,a-b.base,n);
  if(a>=0x40000000||inHi(a))return T.prd(a,n);
  T.fault('Bus fault: read from 0x'+a.toString(16));return 0};
 T.wr=function(a,n,v){a>>>=0;
  if((a-RB)>>>0<RS){wrMem(T.ram,a-RB,n,v);return}
  for(const b of T.banks)if((a-b.base)>>>0<b.size){wrMem(b.data,a-b.base,n,v);return}
  if(a>=0x40000000||inHi(a)){T.pwr(a,n,n==1?v&255:n==2?v&0xFFFF:v>>>0);return}
  if((a-FB)>>>0<FS||(AL>=0&&(a-AL)>>>0<FS))return;
  T.fault('Bus fault: write to 0x'+a.toString(16))};
 T.rd32=a=>T.rd(a,4);T.fault=m=>{if(!T.halted)T.halted=m};
 // peripheral window (0x4000_0000 and up): the System Control Space is the core's own, everything else is routed to attached modules
 T.prd=function(a,n){
  if(a>=0xE000E000&&a<0xE000F000)return scsRd(a,n);
  for(const g of T.regions)if(a>=g.lo&&a<g.hi)return g.m.rd(a,n);
  return 0};
 T.pwr=function(a,n,v){
  if(a>=0xE000E000&&a<0xE000F000){scsWr(a,n,v);return}
  for(const g of T.regions)if(a>=g.lo&&a<g.hi){g.m.wr(a,n,v);return}};
 // ---- System Control Space: SysTick, NVIC, SCB subset
 const scsRd=(a,n)=>{
  if(a>=0xE000E010&&a<=0xE000E01C){const s=T.st;if(a==0xE000E010){const v=s.ctrl|(s.flag<<16);s.flag=0;return v}if(a==0xE000E014)return s.load;if(a==0xE000E018)return s.val;return 0}
  if(a>=0xE000E400&&a<0xE000E460){let v=0;for(let i=0;i<n;i++)v|=T.ipr[a-0xE000E400+i]<<(8*i);return v>>>0}
  if(a>=0xE000ED18&&a<0xE000ED24){let v=0;for(let i=0;i<n;i++)v|=T.shp[a-0xE000ED18+i]<<(8*i);return v>>>0}
  if(a>=0xE000E100&&a<0xE000E10C)return T.nvEn[(a-0xE000E100)>>2];
  if(a>=0xE000E200&&a<0xE000E20C)return T.nvPend[(a-0xE000E200)>>2];
  if(a==0xE000ED00)return T.cfg.cpuid||0x411FC231;
  return 0};
 const scsWr=(a,n,v)=>{
  if(a>=0xE000E010&&a<=0xE000E01C){const s=T.st;if(a==0xE000E010)s.ctrl=v&7;else if(a==0xE000E014)s.load=v&0xFFFFFF;else if(a==0xE000E018){s.val=0;s.flag=0}return}
  if(a>=0xE000E400&&a<0xE000E460){for(let i=0;i<n;i++)T.ipr[a-0xE000E400+i]=(v>>>(8*i))&T.pmask;return}
  if(a>=0xE000ED18&&a<0xE000ED24){for(let i=0;i<n;i++)T.shp[a-0xE000ED18+i]=(v>>>(8*i))&T.pmask;return}
  if(a>=0xE000E100&&a<0xE000E10C){T.nvEn[(a-0xE000E100)>>2]|=v;return}
  if(a>=0xE000E180&&a<0xE000E18C){T.nvEn[(a-0xE000E180)>>2]&=~v;return}
  if(a>=0xE000E200&&a<0xE000E20C){T.nvPend[(a-0xE000E200)>>2]|=v;return}
  if(a>=0xE000E280&&a<0xE000E28C){T.nvPend[(a-0xE000E280)>>2]&=~v;return}
  if(a==0xE000ED04){if(v&(1<<28))T.raise(14);return}};
 // ---- pending / NVIC
 T.prio=function(e){if(e==1)return-3;if(e==2)return-2;if(e==3)return-1;return e<16?T.shp[e-4]&T.pmask:T.ipr[e-16]&T.pmask};
 T.level=function(){for(const f of T.levelers)f()};
 T.raise=function(exc){if(!T.pend.includes(exc))T.pend.push(exc)};
 T.irq=function(n){if(T.act.indexOf(16+n)>=0)return;   // a handler is running: a still-asserted level line re-pends on exception return (exret calls T.level), not meanwhile
  const w=n>>5,b=1<<(n&31);T.nvPend[w]|=b;};
 T.checkIrq=function(){for(let w=0;w<3;w++){const m=(T.nvPend[w]&T.nvEn[w])>>>0;if(m){const b=31-Math.clz32(m&-m);T.nvPend[w]&=~(1<<b);T.raise(16+w*32+b)}}};
 // ---- time
 T.adv=function(c){T.cy+=c;if(T.evq.length&&T.evq[0].at<=T.cy)T.runEv();const s=T.st;
  if(s.ctrl&1){s.acc+=c;const div=(s.ctrl&4)?1:8;while(s.acc>=div){s.acc-=div;if(s.val==0)s.val=s.load;else{s.val--;if(s.val==0){s.flag=1;if(s.ctrl&2)T.raise(15)}}}}
  for(const f of T.tickers)f(c)};
 // ---- exceptions
T.xpsr=()=>((T.N<<31)|(T.Z<<30)|(T.C<<29)|(T.V<<28)|(1<<24)|((T.it&3)<<25)|((T.it>>2)<<10)|T.ipsr)>>>0;
T.setx=function(x){T.N=x>>>31;T.Z=(x>>>30)&1;T.C=(x>>>29)&1;T.V=(x>>>28)&1;T.it=((x>>>25)&3)|(((x>>>10)&0x3F)<<2);T.ipsr=x&0x1FF};
T.enter=function(exc){let sp=T.r[13];sp-=32;const f=[T.r[0],T.r[1],T.r[2],T.r[3],T.r[12],T.r[14],T.r[15],T.xpsr()];for(let i=0;i<8;i++)T.wr(sp+i*4,4,f[i]);
 T.r[13]=sp;T.r[14]=-7;T.act.push(exc);T.ipsr=exc;T.it=0;T.r[15]=T.rd32(exc*4)&~1;T.adv(12)};
T.exret=function(){let sp=T.r[13];const f=[];for(let i=0;i<8;i++)f.push(T.rd32(sp+i*4)|0);T.r[13]=sp+32;T.r[0]=f[0];T.r[1]=f[1];T.r[2]=f[2];T.r[3]=f[3];T.r[12]=f[4];T.r[14]=f[5];T.r[15]=f[6]&~1;T.setx(f[7]>>>0);T.act.pop();T.adv(12);T.level()};
T.bx=function(a){if((a>>>0)>=0xFFFFFFF0)T.exret();else T.r[15]=a&~1};
// ---- ALU helpers
const cond=c=>{switch(c){case 0:return T.Z;case 1:return!T.Z;case 2:return T.C;case 3:return!T.C;case 4:return T.N;case 5:return!T.N;case 6:return T.V;case 7:return!T.V;case 8:return T.C&&!T.Z;case 9:return!T.C||T.Z;case 10:return T.N==T.V;case 11:return T.N!=T.V;case 12:return!T.Z&&T.N==T.V;case 13:return T.Z||T.N!=T.V;default:return 1}};
const nz=v=>{T.N=v>>>31;T.Z=v==0?1:0;return v};
const awc=(a,b,c,s)=>{const u=(a>>>0)+(b>>>0)+c,r=u|0;if(s){T.N=r>>>31;T.Z=r==0?1:0;T.C=u>0xFFFFFFFF?1:0;T.V=((~(a^b)&(a^r))>>>31)}return r};
let sc=0;
const shift=(v,ty,n,ci)=>{sc=ci;v|=0;if(n==0)return v;switch(ty){case 0:if(n>32){sc=0;return 0}sc=n==32?v&1:(v>>>(32-n))&1;return n==32?0:v<<n;case 1:if(n>32){sc=0;return 0}sc=(v>>>(n-1))&1;return n==32?0:v>>>n;case 2:if(n>=32){sc=v>>>31;return v>>31}sc=(v>>(n-1))&1;return v>>n;default:n&=31;if(n==0){sc=v>>>31;return v}sc=(v>>>(n-1))&1;return(v>>>n)|(v<<(32-n))}};
const rrx=(v,ci)=>{sc=v&1;return(v>>>1)|(ci<<31)};
const sx=(v,b)=>(v<<(32-b))>>(32-b);
const expand=(i,i3,i8)=>{const x=(i<<11)|(i3<<8)|i8;if((x>>10)==0){switch((x>>8)&3){case 0:return i8;case 1:return(i8<<16)|i8;case 2:return(i8<<24)|(i8<<8);default:return i8*0x01010101|0}}const u=0x80|(x&0x7F),r=x>>7;sc=(((u>>>r)|(u<<(32-r)))>>>31)&1;return((u>>>r)|(u<<(32-r)))|0};
T.un=function(h,h2,a){T.fault('Unimplemented instruction 0x'+h.toString(16)+(h2>=0?' 0x'+h2.toString(16):'')+' at 0x'+a.toString(16))};
// ---- step
T.step=function(){
 if(T.halted)return 0;
 if(T.nvPend[0]|T.nvPend[1]|T.nvPend[2])T.checkIrq();
 if(T.pend.length){let bi=0,bp=1e9;for(let i=0;i<T.pend.length;i++){const e=T.pend[i],p=T.prio(e);if(p<bp||(p==bp&&e<T.pend[bi])){bp=p;bi=i}}
  const cur=T.act.length?T.prio(T.act[T.act.length-1]):256;
  if(bp<cur&&(!T.primask||bp<0)){const e=T.pend.splice(bi,1)[0];T.enter(e);return 12}}
 const r=T.r,pc=r[15]>>>0,h=T.rd(pc,2);let c=1;
 const big=(h>>11)>=0x1D;let h2=-1;if(big)h2=T.rd(pc+2,2);
 const size=big?4:2,pc4=pc+4;
 if(T.it&0xF){const cc=T.it>>4;let ok=cond(cc);
  const adv=()=>{T.it=(T.it&7)==0?0:((T.it&0xE0)|((T.it<<1)&0x1F))};
  if(!ok){r[15]=pc+size;adv();T.adv(1);return 1}
  const inIT=true;try{c=T.exec(h,h2,pc,pc4,size,inIT)}finally{}if((h&0xFF00)!=0xBF00||(h&0xF)==0)adv();T.adv(c);return c}
 c=T.exec(h,h2,pc,pc4,size,false);T.adv(c);return c};
T.exec=function(h,h2,pc,pc4,size,inIT){const r=T.r,S=!inIT;let c=1;r[15]=pc+size;
 const rg=n=>n==15?(pc4|0):r[n];
 const ldst=(L,n,sg,a,rt)=>{if(L){let v=T.rd(a,n);if(sg)v=n==1?sx(v,8):sx(v,16);if(rt==15){T.bx(v|0)}else r[rt]=v|0;c=2}else{T.wr(a,n,r[rt]);c=2}};
 if(!(size==4)){
  const t=h>>11;
  if(t<3){const rd=h&7,rm=(h>>3)&7,im=(h>>6)&31;let v;if(t==0){v=im?shift(r[rm],0,im,T.C):r[rm];if(im)T.C=sc}else if(t==1){v=shift(r[rm],1,im||32,T.C);T.C=sc}else{v=shift(r[rm],2,im||32,T.C);T.C=sc}
   if(S)nz(v|0);else{}r[rd]=v;return 1}
  if(t==3){const rd=h&7,rn=(h>>3)&7,o=(h>>6)&7,op=(h>>9)&3;let v;if(op==0)v=awc(r[rn],r[o],0,S);else if(op==1)v=awc(r[rn],~r[o],1,S);else if(op==2)v=awc(r[rn],(h>>6)&7,0,S);else v=awc(r[rn],~((h>>6)&7),1,S);r[rd]=v;return 1}
  if(t<8){const rd=(h>>8)&7,i=h&255;if(t==4){r[rd]=i;if(S)nz(i)}else if(t==5)awc(r[rd],~i,1,true);else if(t==6)r[rd]=awc(r[rd],i,0,S);else r[rd]=awc(r[rd],~i,1,S);return 1}
  if((h>>10)==0x10){const op=(h>>6)&15,rd=h&7,rm=(h>>3)&7,a=r[rd],b=r[rm];let v;
   switch(op){case 0:v=a&b;if(S)nz(v);r[rd]=v;break;case 1:v=a^b;if(S)nz(v);r[rd]=v;break;case 2:v=shift(a,0,b&255,T.C);if(S){T.C=sc;nz(v)}r[rd]=v;break;case 3:v=shift(a,1,b&255,T.C);if(S){T.C=sc;nz(v)}r[rd]=v;break;case 4:v=shift(a,2,b&255,T.C);if(S){T.C=sc;nz(v)}r[rd]=v;break;
    case 5:r[rd]=awc(a,b,T.C,S);break;case 6:r[rd]=awc(a,~b,T.C,S);break;case 7:v=shift(a,3,b&255,T.C);if(S){T.C=sc;nz(v)}r[rd]=v;break;case 8:nz(a&b);break;case 9:r[rd]=awc(0,~b,1,S);break;case 10:awc(a,~b,1,true);break;case 11:awc(a,b,0,true);break;
    case 12:v=a|b;if(S)nz(v);r[rd]=v;break;case 13:v=Math.imul(a,b);if(S)nz(v);r[rd]=v;break;case 14:v=a&~b;if(S)nz(v);r[rd]=v;break;default:v=~b;if(S)nz(v);r[rd]=v}return 1}
  if((h>>10)==0x11){const op=(h>>8)&3,rm=(h>>3)&15;if(op==3){const t2=r[rm];if(h&0x80)r[14]=(pc+2)|1;T.bx(t2);return 3}const rd=(h&7)|((h>>4)&8);
   if(op==0){const v=rg(rd)+rg(rm)|0;if(rd==15)T.bx(v);else r[rd]=v;return rd==15?3:1}if(op==1){awc(rg(rd),~rg(rm),1,true);return 1}const v=rg(rm);if(rd==15)T.bx(v);else r[rd]=v;return rd==15?3:1}
  if(t==9){r[(h>>8)&7]=T.rd32(((pc4&~3)+((h&255)<<2))>>>0)|0;return 2}
  if((h>>12)==5){const o=(h>>9)&7,rm=(h>>6)&7,rn=(h>>3)&7,rt=h&7,a=(r[rn]+r[rm])>>>0;switch(o){case 0:ldst(0,4,0,a,rt);break;case 1:ldst(0,2,0,a,rt);break;case 2:ldst(0,1,0,a,rt);break;case 3:ldst(1,1,1,a,rt);break;case 4:ldst(1,4,0,a,rt);break;case 5:ldst(1,2,0,a,rt);break;case 6:ldst(1,1,0,a,rt);break;default:ldst(1,2,1,a,rt)}return 2}
  if((h>>13)==3){const B=(h>>12)&1,L=(h>>11)&1,im=(h>>6)&31,rn=(h>>3)&7,rt=h&7;ldst(L,B?1:4,0,(r[rn]+(B?im:im<<2))>>>0,rt);return 2}
  if((h>>12)==8){const L=(h>>11)&1,im=(h>>6)&31,rn=(h>>3)&7,rt=h&7;ldst(L,2,0,(r[rn]+(im<<1))>>>0,rt);return 2}
  if((h>>12)==9){const L=(h>>11)&1,rt=(h>>8)&7;ldst(L,4,0,(r[13]+((h&255)<<2))>>>0,rt);return 2}
  if((h>>12)==10){const rd=(h>>8)&7,i=(h&255)<<2;r[rd]=(h&0x800)?r[13]+i:((pc4&~3)+i)|0;return 1}
  if((h>>12)==11){
   if((h&0xFF00)==0xB000){const i=(h&127)<<2;r[13]=(h&0x80)?r[13]-i:r[13]+i;return 1}
   if((h&0xF500)==0xB100){const rn=h&7,off=(((h>>9)&1)<<6)|(((h>>3)&31)<<1),nzf=(h>>11)&1;if((r[rn]==0)!=!!nzf){r[15]=(pc4+off)|0;return 3}return 1}
   if((h&0xFF00)==0xB200){const rm=(h>>3)&7,rd=h&7,op=(h>>6)&3,v=r[rm];r[rd]=op==0?sx(v,16):op==1?sx(v,8):op==2?v&0xFFFF:v&0xFF;return 1}
   if((h&0xFE00)==0xB400){let sp=r[13];const n=bc(h&255)+((h>>8)&1);sp-=n*4;let a=sp>>>0;for(let i=0;i<8;i++)if((h>>i)&1){T.wr(a,4,r[i]);a+=4}if(h&0x100)T.wr(a,4,r[14]);r[13]=sp;return 1+n}
   if((h&0xFE00)==0xBC00){let a=r[13]>>>0;for(let i=0;i<8;i++)if((h>>i)&1){r[i]=T.rd32(a)|0;a+=4}let pcset=null;if(h&0x100){pcset=T.rd32(a)|0;a+=4}r[13]=a|0;if(pcset!==null){T.bx(pcset);return 4+bc(h&255)}return 1+bc(h&255)}
   if((h&0xFF00)==0xBA00){const rm=(h>>3)&7,rd=h&7,v=r[rm],op=(h>>6)&3;r[rd]=op==0?((v&255)<<24|(v&0xFF00)<<8|(v>>>8)&0xFF00|v>>>24)|0:op==1?(((v&0xFF00FF00)>>>8)|((v&0x00FF00FF)<<8))|0:sx(((v&255)<<8)|((v>>>8)&255),16);return 1}
   if((h&0xFF00)==0xBE00){T.fault('BKPT');return 1}
   if((h&0xFF00)==0xBF00){const m=h&15;if(m){T.it=(((h>>4)&15)<<4)|m;return 1}return 1}
   if((h&0xFFE8)==0xB660){T.primask=(h&0x10)?1:0;return 1}
   T.un(h,-1,pc);return 1}
  if((h>>12)==12){const L=(h>>11)&1,rn=(h>>8)&7;let a=r[rn]>>>0;for(let i=0;i<8;i++)if((h>>i)&1){if(L)r[i]=T.rd32(a)|0;else T.wr(a,4,r[i]);a+=4}if(!L||!((h>>rn)&1))r[rn]=a|0;return 1+bc(h&255)}
  if((h>>12)==13){const cc=(h>>8)&15;if(cc==15){T.raise(11);return 1}if(cc==14){T.un(h,-1,pc);return 1}if(cond(cc)){r[15]=(pc4+(sx(h&255,8)<<1))|0;return 3}return 1}
  if((h>>11)==0x1C){r[15]=(pc4+(sx(h&0x7FF,11)<<1))|0;return 3}
  T.un(h,-1,pc);return 1}
 // ---- 32-bit
 const rn=h&15,rd=(h2>>8)&15,rm=h2&15,hi=h>>11;
 if(hi==0x1D){
  if((h>>9)==0x74&&!(h&0x40)&&(((h>>7)&3)==1||((h>>7)&3)==2)){const L=(h>>4)&1,W=(h>>5)&1,db=((h>>7)&3)==2,list=h2&0xFFFF,n=bc16(list);let a=r[rn]>>>0;if(db)a=(a-n*4)>>>0;const start=a;
   for(let i=0;i<16;i++)if((list>>i)&1){if(L){const v=T.rd32(a)|0;if(i==15)T.bx(v);else r[i]=v}else T.wr(a,4,rg(i));a+=4}
   if(W){r[rn]=db?start|0:a|0}return 2+n}
  if((h>>9)==0x74&&(h&0x40)&&(((h>>8)&1)||((h>>5)&1))){const P=(h>>8)&1,U=(h>>7)&1,W=(h>>5)&1,L=(h>>4)&1,t1=(h2>>12)&15,t2=(h2>>8)&15,im=(h2&255)<<2,b=rn==15?(pc4&~3):r[rn],off=(U?b+im:b-im)|0,ad=(P?off:b)>>>0;
   if(L){r[t1]=T.rd32(ad)|0;r[t2]=T.rd32(ad+4)|0}else{T.wr(ad,4,r[t1]);T.wr(ad+4,4,r[t2])}if(W)r[rn]=off;return 3}
  if(h==0xE8D0&&(h2&0xFFE0)==0xF000){const tb=h2&0x10?2:1,base=rn==15?pc4:r[rn]>>>0,idx=r[rm]>>>0,off=T.rd(base+idx*tb,tb);r[15]=(pc4+off*2)|0;return 4}
  if((h&0xFE00)==0xEA00){const op=(h>>5)&15,s=(h>>4)&1,imm=((h2>>12)&7)<<2|((h2>>6)&3),ty=(h2>>4)&3;let v;
   let b=r[rm];sc=T.C;if(ty==3&&imm==0&&true){}
   const sh=ty==3&&imm==0?rrx(b,T.C):shift(b,ty,imm==0&&ty!=0?32:imm,T.C);const C2=(imm==0&&ty==0)?T.C:sc,a=rg(rn),SS=s&&S?1:s;const setf=s&&!inIT||(s&&inIT&&false);
   const lg=(x)=>{if(s){nz(x);T.C=C2}return x};
   switch(op){case 0:v=a&sh;if(rd==15&&s){nz(v);T.C=C2;return 1}r[rd]=lg(v);break;case 1:r[rd]=lg(a&~sh);break;
    case 2:v=rn==15?sh:(a|sh);r[rd]=lg(v);break;case 3:v=rn==15?~sh:(a|~sh);r[rd]=lg(v);break;case 4:v=a^sh;if(rd==15&&s){nz(v);T.C=C2;return 1}r[rd]=lg(v);break;
    case 8:v=awc(a,sh,0,s);if(rd==15&&s)return 1;r[rd]=v;break;case 10:r[rd]=awc(a,sh,T.C,s);break;case 11:r[rd]=awc(a,~sh,T.C,s);break;
    case 13:v=awc(a,~sh,1,s);if(rd==15&&s)return 1;r[rd]=v;break;case 14:r[rd]=awc(sh,~a,1,s);break;default:T.un(h,h2,pc)}return 1}
  if((h&0xFE50)==0xE850&&false){}
  T.un(h,h2,pc);return 1}
 if(hi==0x1E){
  if(!(h2&0x8000)){
   if(!(h&0x0200)){const op=(h>>5)&15,s=(h>>4)&1,i=(h>>10)&1;sc=T.C;const imm=expand(i,(h2>>12)&7,h2&255),a=rg(rn),C2=((((i<<11)|((h2>>12)&7)<<8|(h2&255))>>10)==0)?T.C:sc;let v;
    const lg=x=>{if(s){nz(x);T.C=C2}return x};
    switch(op){case 0:v=a&imm;if(rd==15&&s){nz(v);T.C=C2;return 1}r[rd]=lg(v);break;case 1:r[rd]=lg(a&~imm);break;case 2:r[rd]=lg(rn==15?imm:(a|imm));break;case 3:r[rd]=lg(rn==15?~imm:(a|~imm));break;
     case 4:v=a^imm;if(rd==15&&s){nz(v);T.C=C2;return 1}r[rd]=lg(v);break;case 8:v=awc(a,imm,0,s);if(rd==15&&s)return 1;r[rd]=v;break;case 10:r[rd]=awc(a,imm,T.C,s);break;case 11:r[rd]=awc(a,~imm,T.C,s);break;
     case 13:v=awc(a,~imm,1,s);if(rd==15&&s)return 1;r[rd]=v;break;case 14:r[rd]=awc(imm,~a,1,s);break;default:T.un(h,h2,pc)}return 1}
   const op=(h>>4)&31,imm12=(((h>>10)&1)<<11)|(((h2>>12)&7)<<8)|(h2&255),a=rg(rn);
   switch(op){case 0:r[rd]=a+imm12|0;break;case 10:r[rd]=a-imm12|0;break;case 4:r[rd]=((h&15)<<12)|(((h>>10)&1)<<11)|(((h2>>12)&7)<<8)|(h2&255);break;case 12:r[rd]=(r[rd]&0xFFFF)|((((h&15)<<12)|(((h>>10)&1)<<11)|(((h2>>12)&7)<<8)|(h2&255))<<16);break;
    case 20:{const lsb=((h2>>12)&7)<<2|((h2>>6)&3),w=(h2&31)+1;r[rd]=sx((r[rn]>>>lsb)&(w>=32?-1:((1<<w)-1)),w);break}
    case 28:{const lsb=((h2>>12)&7)<<2|((h2>>6)&3),w=(h2&31)+1;r[rd]=(r[rn]>>>lsb)&(w>=32?-1:((1<<w)-1));break}
    case 22:{const lsb=((h2>>12)&7)<<2|((h2>>6)&3),msb=h2&31,w=msb-lsb+1,mk=(w>=32?-1:((1<<w)-1))<<lsb,v=rn==15?0:r[rn];r[rd]=(r[rd]&~mk)|((v<<lsb)&mk);break}
    default:T.un(h,h2,pc)}return 1}
  // branches & misc
  if((h2&0xD000)==0x8000){if((h&0x3C0)==0x3C0){// misc control
     if(h==0xF3EF){const sy=h2&255;r[rd]=sy==0x10?T.primask:sy==8||sy==9?r[13]:sy==0?T.xpsr()&0xF8000000:sy==5?T.ipsr:sy==0x14?0:0;return 2}
     if((h&0xFFF0)==0xF380){const sy=h2&255;if(sy==0x10)T.primask=r[rn]&1;else if(sy==8)r[13]=r[rn];return 2}
     if(h==0xF3BF)return 1;T.un(h,h2,pc);return 1}
   const cc=(h>>6)&15;if(cond(cc)){const s=(h>>10)&1,j1=(h2>>13)&1,j2=(h2>>11)&1,im=(s<<20)|(j2<<19)|(j1<<18)|((h&0x3F)<<12)|((h2&0x7FF)<<1);r[15]=(pc4+sx(im,21))|0;return 3}return 1}
  if((h2&0xD000)==0x9000||(h2&0xD000)==0xD000){const s=(h>>10)&1,j1=(h2>>13)&1,j2=(h2>>11)&1,i1=(j1^s)?0:1,i2=(j2^s)?0:1,im=(s<<24)|(i1<<23)|(i2<<22)|((h&0x3FF)<<12)|((h2&0x7FF)<<1);
   if(h2&0x4000)r[14]=(pc+4)|1;r[15]=(pc4+sx(im,25))|0;return 4}
  T.un(h,h2,pc);return 1}
 // 0x1F: load/store, data proc register, multiply, divide
 {
  if((h&0xFE00)==0xF800||(h&0xFE00)==0xF900){
   const sz=(h>>5)&3,L=(h>>4)&1,sg=(h>>8)&1;let rt=(h2>>12)&15,a;
   if(sz==3){T.un(h,h2,pc);return 1}
   if(L&&rn==15){const i=(h2&0xFFF),u=(h>>7)&1;a=((pc4&~3)+(u?i:-i))>>>0}
   else if((h>>7)&1){a=(r[rn]+(h2&0xFFF))>>>0}
   else if(h2&0x800){const P=(h2>>10)&1,U=(h2>>9)&1,W=(h2>>8)&1,i=h2&255,b=r[rn],off=U?i:-i;a=(P?b+off:b)>>>0;if(W||!P)r[rn]=b+off|0;}
   else{const sh=(h2>>4)&3;a=(r[rn]+(r[rm]<<sh))>>>0}
   const n=sz==0?1:sz==1?2:4;
   if(L){let v=T.rd(a,n);if(sg)v=sx(v,n*8);if(rt==15)T.bx(v|0);else r[rt]=v|0;return 2}
   T.wr(a,n,r[rt]);return 2}
  if((h&0xFF80)==0xFB00&&(h2&0xF0)==0){const ra=(h2>>12)&15;if(ra==15)r[rd]=Math.imul(r[rn],r[rm]);else r[rd]=(r[ra]+Math.imul(r[rn],r[rm]))|0;return 1}
  if((h&0xFF80)==0xFB00&&(h2&0xF0)==0x10){const ra=(h2>>12)&15;r[rd]=(r[ra]-Math.imul(r[rn],r[rm]))|0;return 1}
  if((h&0xFFF0)==0xFB90&&(h2&0xF0F0)==0xF0F0){const b=r[rm];r[rd]=b==0?0:(r[rn]==-2147483648&&b==-1?-2147483648:(r[rn]/b)|0);return 8}
  if((h&0xFFF0)==0xFBB0&&(h2&0xF0F0)==0xF0F0){const b=r[rm]>>>0;r[rd]=b==0?0:((r[rn]>>>0)/b)>>>0|0;return 8}
  if((h&0xFFF0)==0xFBA0||(h&0xFFF0)==0xFB80){const sg=(h&0xFFF0)==0xFB80,lo=(h2>>12)&15,hi2=rd;let p=sg?BigInt(r[rn])*BigInt(r[rm]):BigInt(r[rn]>>>0)*BigInt(r[rm]>>>0);r[lo]=Number(BigInt.asIntN(32,p));r[hi2]=Number(BigInt.asIntN(32,p>>32n));return 3}
  if((h&0xFF80)==0xFA00&&(h2&0xF0F0)==0xF000){const ty=(h>>5)&3,s=(h>>4)&1,v=shift(r[rn],ty,r[rm]&255,T.C);if(s){T.C=sc;nz(v|0)}r[rd]=v;return 1}
  if((h&0xFF80)==0xFA00&&(h2&0xF0C0)==0xF080){const op=(h>>4)&7,v=r[rm],ro=((h2>>4)&3)*8,x=ro?((v>>>ro)|(v<<(32-ro))):v,a=(h&0xF)==15?0:r[rn];
   const e=op==0?sx(x&0xFFFF,16):op==1?x&0xFFFF:op==4?sx(x&255,8):op==5?x&255:null;if(e!==null){r[rd]=(a+e)|0;return 1}T.un(h,h2,pc);return 1}
  if(h==0xFA0F||h==0xFA1F||h==0xFA4F||h==0xFA5F){const v=r[rm],ro=((h2>>4)&3)*8,x=ro?((v>>>ro)|(v<<(32-ro))):v;r[rd]=h==0xFA0F?sx(x&0xFFFF,16):h==0xFA1F?x&0xFFFF:h==0xFA4F?sx(x&255,8):x&255;return 1}
  if((h&0xFFF0)==0xFAB0&&(h2&0xF0F0)==0xF080){r[rd]=Math.clz32(r[rm]);return 1}
  if((h&0xFFF0)==0xFA90&&(h2&0xF0F0)==0xF0A0){let v=r[rm],o=0;for(let i=0;i<32;i++)o=(o<<1)|((v>>>i)&1);r[rd]=o;return 1}
  if((h&0xFFF0)==0xFA90&&(h2&0xF0F0)==0xF080){const v=r[rm];r[rd]=((v&255)<<24|(v&0xFF00)<<8|(v>>>8)&0xFF00|v>>>24)|0;return 1}
  if((h&0xFFF0)==0xFA90&&(h2&0xF0F0)==0xF090){const v=r[rm];r[rd]=(((v&0xFF00FF00)>>>8)|((v&0x00FF00FF)<<8))|0;return 1}
  if((h&0xFFF0)==0xFA90&&(h2&0xF0F0)==0xF0B0){const v=r[rm];r[rd]=sx(((v&255)<<8)|((v>>>8)&255),16);return 1}
  T.un(h,h2,pc);return 1}
};
const bc=x=>{let n=0;while(x){n+=x&1;x>>=1}return n},bc16=bc;
}
