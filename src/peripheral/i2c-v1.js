/* ---- I2C1 / I2C2 master (RM0008) with cycle-based timing and a physical-layer hook ----
   Slave devices:  T.host.i2c(k, op, x, hz)   op = addr | write | read | stop
   Physical layer: T.host.i2cPhy(k,{hz,bits,dir}) -> {f:'hang'|'arlo'|'garble'}   T.host.i2cRise(k) -> seconds   T.host.i2cLow(k) -> bool
   T.host.i2cStretch(k) -> extra CPU cycles a slave holds SCL low after a byte;  T.host.i2cEv(o) -> waveform / monitor / diagnostics */
function makeI2C(T,k){
 const SB=1,ADDR=2,BTF=4,RXNE=64,TXE=128,ARLO=0x200,AF=0x400,I={k,ep:0};
 const div=()=>{const p=(T.rcc.cfgr>>8)&7;return p<4?1:[2,4,8,16][p-4]};
 I.pclk=()=>T.sysclk()/div();
 // why the peripheral cannot generate a clock at all ('' = fine)
 I.check=()=>{const f=I.cr2&63;if(f<2||f>50)return 'CR2.FREQ is '+f+' MHz: it must be set to the PCLK1 frequency in MHz (2 to 50)';
  const p=I.pclk(),fm=I.ccr&0x8000,du=I.ccr&0x4000,need=fm?(du?10e6:4e6):2e6;
  if(p<need)return 'PCLK1 is '+(p/1e6)+' MHz, but '+(fm?(du?'fast mode with DUTY=1':'fast mode'):'standard mode')+' needs at least '+need/1e6+' MHz';return ''};
 const base=()=>{const c=Math.max(1,I.ccr&0xFFF),f=(I.ccr&0x8000)?((I.ccr&0x4000)?25:3):2;return f*c*div()};
 const tbc=()=>base()+Math.round(((T.host.i2cRise?T.host.i2cRise(k):0)+25e-9)*T.sysclk());   // SCL period in CPU cycles, including rise + fall time
 const ev=o=>{o.k=k;if(T.host.i2cEv)T.host.i2cEv(o)};
 const diag=(key,msg)=>ev({ev:'diag',key,msg});
 const at=(dt,f)=>{const e=I.ep;T.sched(T.cy+Math.max(1,Math.round(dt)),()=>{if(e===I.ep)f()})};
 const host=(op,x)=>T.host.i2c?T.host.i2c(k,op,x,T.sysclk()/tbc()):(op=='read'?0xFF:false);
 const phy=(bits,dir)=>(T.host.i2cPhy?T.host.i2cPhy(k,{hz:T.sysclk()/tbc(),bits,dir}):null)||{};
 const stretch=f=>{const x=T.host.i2cStretch?T.host.i2cStretch(k):0;if(x>0)at(x,f);else f()};
 const firstOne=b=>{for(let i=7;i>=0;i--)if((b>>i)&1)return 7-i;return -1};
 I.hw=()=>{I.ep++;I.sr1=0;I.sr2=0;I.dr=0;I.sh=0;I.shFull=false;I.busy=false;I.mode='';I.addrRead=false;I.stopReq=false;I.startReq=false;I.rxIdx=0;I.cr1&=~0x300};
 I.init=()=>{I.cr1=I.cr2=I.oar1=I.oar2=I.ccr=0;I.trise=2;I.hw()};
 I.low=()=>!!(T.host.i2cLow&&T.host.i2cLow(k));
 I.after=()=>{I.tryStop();I.tryStart();T.level()};
 // a byte that cannot complete: SCL never rises (no pull-up) or arbitration is lost (SDA cannot be released high)
 I.fail=(p,bits,c0,tb,a)=>{I.busy=true;
  if(p.f=='hang'){ev({ev:'hang',c0,tb});diag('hang'+k,'SCL cannot rise: no pull-up resistor on SCL, so the peripheral waits forever (the firmware hangs, like real hardware)');return true}
  if(p.f=='arlo'){const bi=Math.max(0,p.bit!=null?p.bit:firstOne(bits));at((bi+1)*tb,()=>{I.busy=false;I.sr1|=ARLO;I.sr2&=~5;I.mode='arlo';ev({ev:'arlo',c0,tb,a:bits,bit:bi});
    diag('arlo'+k,'arbitration lost (ARLO): SDA cannot go high, so the bus has no working pull-up on SDA (or the rise time is far too slow). The peripheral dropped out of master mode');I.after()});return true}
  I.busy=false;return false};
 I.tryStart=()=>{if(!I.startReq||I.busy||!(I.cr1&1))return;
  const why=I.check();if(why){diag('chk'+k,'START ignored: '+why);return}
  if((I.sr2&2||I.low())&&!(I.sr2&1)){diag('busy'+k,'START waits: the bus is busy because SCL or SDA is held low (shorted to GND, or driven low by another pin)');return}
  I.startReq=false;const rep=!!(I.sr2&1),tb=tbc();I.busy=true;I.sr1&=~BTF;
  ev({ev:rep?'Sr':'S',c0:T.cy,tb});
  at(rep?tb*1.5:tb/2,()=>{I.busy=false;I.sr1|=SB;I.sr2|=3;I.cr1&=~0x100;I.mode='';I.rxIdx=0;T.level()})};
 I.tryStop=()=>{if(!I.stopReq||I.busy||!(I.cr1&1))return;if(!(I.sr2&1)){I.stopReq=false;I.cr1&=~0x200;return}
  if(I.mode=='tx'&&!(I.sr1&TXE))return;
  I.stopReq=false;const tb=tbc();I.busy=true;ev({ev:'P',c0:T.cy,tb});
  at(tb,()=>{I.busy=false;I.sr1&=~(BTF|SB);I.sr2&=~7;I.cr1&=~0x200;I.mode='';I.rxIdx=0;host('stop');I.after()})};
 I.sendAddr=a=>{const tb=tbc(),c0=T.cy,p=phy(a,'tx');if(I.fail(p,a,c0,tb,a))return;I.busy=true;
  at(9*tb,()=>{const ack=p.f!='garble'&&host('addr',a)!==false,rw=a&1;
   stretch(()=>{I.busy=false;ev({ev:'addr',c0,tb,a,ack});
    if(ack){I.sr1|=ADDR;I.mode=rw?'rx':'tx';I.sr2=(I.sr2&~4)|(rw?0:4);if(!rw)I.sr1|=TXE;I.rxIdx=0}else{I.sr1|=AF;I.mode='nak'}
    I.after()})})};
 I.pump=()=>{if(I.busy||I.mode!='tx'||(I.sr1&TXE)||(I.sr1&ADDR))return;const b=I.dr&255,tb=tbc(),c0=T.cy,p=phy(b,'tx');I.sr1|=TXE;
  if(I.fail(p,b,c0,tb,b)){T.level();return}I.busy=true;
  at(9*tb,()=>{const ack=p.f!='garble'&&host('write',b)!==false;
   stretch(()=>{I.busy=false;ev({ev:'wr',c0,tb,b,ack});
    if(!ack){I.sr1|=AF;I.mode='nak'}else if(!(I.sr1&TXE))I.pump();else I.sr1|=BTF;
    I.after()})});T.level()};
 I.startRx=()=>{if(I.busy||I.mode!='rx')return;const tb=tbc(),c0=T.cy,p=phy(0xFF,'rx');if(p.f=='hang'&&I.fail(p,0xFF,c0,tb,0xFF))return;I.busy=true;
  at(9*tb,()=>{const ackBit=((I.cr1&0x800)&&I.rxIdx==0)||(I.cr1&0x400)?1:0,b=p.f=='garble'?0xFF:host('read',ackBit)&255;
   stretch(()=>{I.busy=false;ev({ev:'rd',c0,tb,b,ack:ackBit});I.rxIdx++;
    if(!(I.sr1&RXNE)){I.dr=b;I.sr1|=RXNE}else{I.sh=b;I.shFull=true;I.sr1|=BTF}
    if(!ackBit)I.mode='rxdone';
    I.tryStop();if(I.mode=='rx'&&!I.shFull&&!I.stopReq)I.startRx();T.level()})})};
 I.clearAddr=()=>{I.sr1&=~ADDR;I.addrRead=false;if(I.mode=='tx')I.pump();else if(I.mode=='rx')I.startRx();T.level()};
 I.rd=o=>{switch(o){
  case 0:return I.cr1;case 4:return I.cr2;case 8:return I.oar1;case 0xC:return I.oar2;
  case 0x10:{const v=I.dr&255;if(I.mode=='rx'||I.mode=='rxdone'){if(I.shFull){I.dr=I.sh;I.shFull=false;I.sr1&=~BTF;I.startRx()}else I.sr1&=~RXNE}else I.sr1&=~RXNE;T.level();return v}
  case 0x14:if(I.sr1&ADDR)I.addrRead=true;return I.sr1;
  case 0x18:{const v=I.sr2|((!(I.sr2&1)&&I.low())?2:0);if(I.addrRead&&(I.sr1&ADDR))I.clearAddr();return v}
  case 0x1C:return I.ccr;case 0x20:return I.trise}return 0};
 I.wr=(o,v)=>{switch(o){
  case 0:{if(v&0x8000){I.cr1=0x8000;I.hw();T.level();return}
   const pe0=I.cr1&1;I.cr1=(v&~0x8000&~0x300)|(I.cr1&0x300);if(!(v&1)){if(pe0){I.hw();I.cr1&=~0x300}}
   if((v&1)){if(v&0x100){I.startReq=true;I.cr1|=0x100;I.tryStart()}if(v&0x200){I.stopReq=true;I.cr1|=0x200;I.tryStop()}}T.level();return}
  case 4:I.cr2=v&0x1FFF;T.level();return;
  case 8:I.oar1=v&0xFFFF;return;case 0xC:I.oar2=v&0xFF;return;
  case 0x10:if(!(I.cr1&1))return;I.dr=v&255;
   if(I.sr1&SB){I.sr1&=~SB;I.sendAddr(v&255)}else if(I.mode=='tx'){I.sr1&=~(TXE|BTF);I.pump()}T.level();return;
  case 0x14:{const m=0xDF00;I.sr1=(I.sr1&~m)|(I.sr1&v&m);T.level();return}
  case 0x1C:I.ccr=v&0xCFFF;return;case 0x20:I.trise=v&0x3F;return}};
 I.init();return I}

/* I2C master module (RM0008 / STM32F1 + F4 "v1" IP). cfg: {base:[...], size, evIrq:[..], erIrq:[..], enabled:k=>bool} */
function I2CModule(T,c){
 T.i2c=c.base.map((_,k)=>makeI2C(T,k));
 T.i2cOn=c.enabled;
 const kOf=a=>{for(let k=0;k<c.base.length;k++)if(a>=c.base[k]&&a<c.base[k]+c.size)return k;return -1};
 return{name:'i2c',regions:c.base.map(b=>[b,b+c.size]),
  rd(a){const k=kOf(a);return T.i2cOn(k)?T.i2c[k].rd(a&0x3FF)>>>0:0},
  wr(a,n,v){const k=kOf(a);if(T.i2cOn(k))T.i2c[k].wr(a&0x3FF,v)},
  reset(){T.i2c.forEach(x=>x.init())},
  level(){for(let k=0;k<T.i2c.length;k++){const I=T.i2c[k];if((I.cr2&0x200)&&((I.sr1&0x1F)||((I.cr2&0x400)&&(I.sr1&0xC0))))T.irq(c.evIrq[k]);if((I.cr2&0x100)&&(I.sr1&0xF00))T.irq(c.erIrq[k])}}}}
