/* LPC17xx pin connect block (PINSEL / PINMODE / PINMODE_OD), fast GPIO (FIODIR/FIOMASK/FIOPIN/FIOSET/FIOCLR), GPIO interrupts (ports 0 and 2)
   and the external interrupts EINT0-3 (P2.10-P2.13, function 1).
   Host interface is the same as for the F1 GPIO: host.gpio(port, pin, {mode, cnf, odr}) with mode 0 = input, 3 = output, cnf 0 push-pull / 1 open-drain (or floating input) / 2 pull or alternate function.
   cfg: {fio, pincon, gpioint, irq (shared GPIO irq), eintIrq:[..]} */
function GpioLpc17(T,c){
 const NP=5,z=n=>new Uint32Array(n);
 const st=T.gp={sel:z(11),mode:z(10),od:z(5),dir:z(5),mask:z(5),out:z(5)};
 const gi={enR:[0,0],enF:[0,0],stR:[0,0],stF:[0,0]};   // GPIOINT state for port 0 and port 2
 const ei={flags:0,mode:0,pol:0,last:[-1,-1,-1,-1]};
 const lastIn=[...Array(NP)].map(()=>new Int8Array(32).fill(-1));
 const shadow=[...Array(NP)].map(()=>new Int32Array(32).fill(-1));
 T.afOut=new Map();                          // "port.pin.function" -> cnf of pins a peripheral drives (2 = push-pull UART TXD, 3 = open-drain I2C), registered by the chip
 const fn=T.pinFn=(p,i)=>(st.sel[p*2+(i>>4)]>>>((i&15)*2))&3;
 const pm=T.pinMode=(p,i)=>(st.mode[p*2+(i>>4)]>>>((i&15)*2))&3;
 const inQ=(p,i)=>{const m=pm(p,i);return m==0?{mode:0,cnf:2,odr:1}:m==3?{mode:0,cnf:2,odr:0}:{mode:0,cnf:1,odr:0}};
 T.gpioSync=function(p){if(!T.host.gpio)return;const sh=shadow[p];
  for(let i=0;i<32;i++){const f=fn(p,i);let q;
   if(f==0&&((st.dir[p]>>>i)&1))q={mode:3,cnf:(st.od[p]>>>i)&1?1:0,odr:(st.out[p]>>>i)&1};
   else if(f!=0&&T.afOut.has(p+'.'+i+'.'+f))q={mode:3,cnf:T.afOut.get(p+'.'+i+'.'+f),odr:0};
   else q=inQ(p,i);
   const key=1<<20|q.mode<<8|q.cnf<<4|q.odr;
   if(sh[i]!==key){sh[i]=key;T.host.gpio(p,i,q)}}};
 T.pinIn=function(p,i){const q=inQ(p,i),f=fn(p,i);
  if(f==0&&((st.dir[p]>>>i)&1)){const l=(st.out[p]>>>i)&1;if(!((st.od[p]>>>i)&1)||!l)return l}
  return T.host.readPin?T.host.readPin(p,i,q.cnf,q.odr):0};
 const fioRd=(p,o)=>{if(o==0)return st.dir[p];if(o==0x10)return st.mask[p];
  if(o==0x14){let v=0;for(let i=0;i<32;i++)if(!((st.mask[p]>>>i)&1))v|=T.pinIn(p,i)<<i;return v>>>0}
  if(o==0x18)return st.out[p];return 0};
 const fioWr=(p,o,v)=>{const m=st.mask[p];
  if(o==0)st.dir[p]=v;else if(o==0x10){st.mask[p]=v;return}
  else if(o==0x14)st.out[p]=((st.out[p]&m)|(v&~m))>>>0;else if(o==0x18)st.out[p]=(st.out[p]|(v&~m))>>>0;else if(o==0x1C)st.out[p]=(st.out[p]&~(v&~m))>>>0;else return;
  T.gpioSync(p)};
 // ---- edge / level detection, called by the host whenever a pin level may have changed
 const evalEint=()=>{for(let e=0;e<4;e++){const pin=10+e;if(fn(2,pin)!=1){ei.last[e]=-1;continue}
   const v=T.host.readPin?T.host.readPin(2,pin,2,1):0,bit=1<<e,pol=(ei.pol>>e)&1;
   if((ei.mode>>e)&1){if(ei.last[e]>=0&&ei.last[e]!=v&&(pol?v:!v))ei.flags|=bit}
   else{if(v==pol)ei.flags|=bit;else ei.flags&=~bit}
   ei.last[e]=v}};
 T.setPin=function(){
  for(const[p,k]of[[0,0],[2,1]])for(let i=0;i<32;i++){
   if(fn(p,i)!=0||((st.dir[p]>>>i)&1)){lastIn[p][i]=-1;continue}
   const v=T.host.readPin?T.host.readPin(p,i,inQ(p,i).cnf,inQ(p,i).odr):0,l=lastIn[p][i];
   if(l>=0&&l!=v){if(v&&((gi.enR[k]>>>i)&1))gi.stR[k]|=1<<i;if(!v&&((gi.enF[k]>>>i)&1))gi.stF[k]|=1<<i}
   lastIn[p][i]=v}
  evalEint();T.level()};
 T.eintRd=o=>o==0x140?ei.flags:o==0x148?ei.mode:o==0x14C?ei.pol:0;
 T.eintWr=(o,v)=>{if(o==0x140){ei.flags&=~(v&0xF);evalEint()}else if(o==0x148){ei.mode=v&0xF;evalEint()}else if(o==0x14C){ei.pol=v&0xF;evalEint()}T.level()};
 const pcon=()=>(T.pconpOn?T.pconpOn(15,'GPIO / pin connect block / GPIO interrupts'):true);
 return{name:'gpio',regions:[[c.fio,c.fio+0x20*NP],[c.pincon,c.pincon+0x80],[c.gpioint,c.gpioint+0x40]],
  rd(a){
   if(a>=c.fio&&a<c.fio+0x20*NP)return !pcon()?0:fioRd((a-c.fio)>>5,(a-c.fio)&0x1F)>>>0;
   if(a>=c.pincon){if(!pcon())return 0;const o=a-c.pincon;if(o<0x2C)return st.sel[o>>2];if(o>=0x40&&o<0x68)return st.mode[(o-0x40)>>2];if(o>=0x68&&o<0x7C)return st.od[(o-0x68)>>2];return 0}
   if(!pcon())return 0;const o=a-c.gpioint;
   if(o==0)return((gi.stR[0]|gi.stF[0])?1:0)|((gi.stR[1]|gi.stF[1])?4:0);
   if(o==4)return gi.stR[0];if(o==8)return gi.stF[0];if(o==0x10)return gi.enR[0];if(o==0x14)return gi.enF[0];
   if(o==0x24)return gi.stR[1];if(o==0x28)return gi.stF[1];if(o==0x30)return gi.enR[1];if(o==0x34)return gi.enF[1];return 0},
  wr(a,n,v){
   if(a>=c.fio&&a<c.fio+0x20*NP){if(pcon())fioWr((a-c.fio)>>5,(a-c.fio)&0x1F,v);return}
   if(a>=c.pincon){if(!pcon())return;const o=a-c.pincon;
    if(o<0x2C){st.sel[o>>2]=v;T.gpioSync((o>>2)>>1)}else if(o>=0x40&&o<0x68){st.mode[(o-0x40)>>2]=v;T.gpioSync(((o-0x40)>>2)>>1)}else if(o>=0x68&&o<0x7C){st.od[(o-0x68)>>2]=v;T.gpioSync((o-0x68)>>2)}
    if(o<0x2C)T.pinSelChanged&&T.pinSelChanged();return}
   if(!pcon())return;const o=a-c.gpioint;
   if(o==0x0C){gi.stR[0]&=~v;gi.stF[0]&=~v}else if(o==0x2C){gi.stR[1]&=~v;gi.stF[1]&=~v}   // IOnIntClr: write 1 to clear
   else if(o==0x10)gi.enR[0]=v;else if(o==0x14)gi.enF[0]=v;else if(o==0x30)gi.enR[1]=v;else if(o==0x34)gi.enF[1]=v;
   T.level()},
  reset(){for(const k of['sel','mode','od','dir','mask','out'])st[k].fill(0);gi.enR=[0,0];gi.enF=[0,0];gi.stR=[0,0];gi.stF=[0,0];ei.flags=ei.mode=ei.pol=0;ei.last=[-1,-1,-1,-1];lastIn.forEach(a=>a.fill(-1));shadow.forEach(a=>a.fill(-1))},
  post(){for(let p=0;p<NP;p++)T.gpioSync(p)},
  level(){if(!pcon())return;if(gi.stR[0]|gi.stF[0]|gi.stR[1]|gi.stF[1])T.irq(c.irq);for(let e=0;e<4;e++)if((ei.flags>>e)&1)T.irq(c.eintIrq[e])}}}
