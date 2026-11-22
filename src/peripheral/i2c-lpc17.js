/* LPC17xx I2C0-2, master mode (UM10360 chapter 19): the classic status-code state machine.
   Software drives it through I2CONSET / I2CONCLR (AA, SI, STO, STA, I2EN) and I2DAT; every step ends with SI = 1 and a status code in I2STAT:
     0x08 START sent, 0x10 repeated START
     master transmit: 0x18 SLA+W acked, 0x20 SLA+W nacked, 0x28 data acked, 0x30 data nacked, 0x38 arbitration lost
     master receive:  0x40 SLA+R acked, 0x48 SLA+R nacked, 0x50 data received + ACK returned (AA = 1), 0x58 data received + NACK returned (AA = 0)
   Clearing SI starts the next step: STO = stop (then STA = start again), STA = (repeated) start, otherwise the byte in I2DAT is sent / the next byte is received.
   Bit period = (I2SCLH + I2SCLL) x PCLK divider CPU cycles (plus rise time); START takes half a period, repeated START 1.5, a byte + ACK 9, STOP 1.
   Same host interface and physical-layer behaviour as the STM32F1 I2C (see i2c-v1.js): slaves through host.i2c(k, addr | write | read | stop, x, hz), pull-ups / arbitration /
   hang through host.i2cPhy, clock stretching, host.i2cLow (bus held low), host.i2cEv for the waveform and monitor.
   Not modelled: slave mode (I2ADRn, general call), monitor mode, the data buffer register.
   cfg: {base:[..], irq:[..], pbit:[..], div:k=>PCLK divider, on:(k,quiet)=>bool} */
function I2cLpc17(T,c){
 const AA=4,SI=8,STO=16,STA=32,EN=64;
 const mk=k=>{const I={k,ep:0};
  const tbc=()=>Math.max(1,I.sclh+I.scll)*c.div(k)+Math.round(((T.host.i2cRise?T.host.i2cRise(k):0)+25e-9)*T.sysclk());
  const ev=o=>{o.k=k;if(T.host.i2cEv)T.host.i2cEv(o)};
  const diag=(key,msg)=>ev({ev:'diag',key,msg});
  const at=(dt,f)=>{const e=I.ep;T.sched(T.cy+Math.max(1,Math.round(dt)),()=>{if(e===I.ep)f()})};
  const host=(op,x)=>T.host.i2c?T.host.i2c(k,op,x,T.sysclk()/tbc()):(op=='read'?0xFF:false);
  const phy=(bits,dir)=>(T.host.i2cPhy?T.host.i2cPhy(k,{hz:T.sysclk()/tbc(),bits,dir}):null)||{};
  const stretch=f=>{const x=T.host.i2cStretch?T.host.i2cStretch(k):0;if(x>0)at(x,f);else f()};
  const firstOne=b=>{for(let i=7;i>=0;i--)if((b>>i)&1)return 7-i;return -1};
  const done=st=>{I.busy=false;I.stat=st;I.con|=SI;T.level()};
  const check=()=>{if(!I.sclh||!I.scll){diag('scl'+k,'I2SCLH / I2SCLL are 0: no SCL clock can be generated');return false}
   const hz=T.cclk()/c.div(k)/(I.sclh+I.scll);if(hz>400e3)diag('rate'+k,'bit rate '+(hz/1e3|0)+' kHz is above the 400 kHz I2C maximum: raise I2SCLH + I2SCLL (bit rate = PCLK / (I2SCLH + I2SCLL))');return true};
  // a byte that cannot complete: SCL never rises (no pull-up) or arbitration is lost (SDA cannot be released high)
  const fail=(p,bits,c0,tb)=>{I.busy=true;
   if(p.f=='hang'){ev({ev:'hang',c0,tb});diag('hang'+k,'SCL cannot rise: no pull-up resistor on SCL, so the peripheral waits forever (the firmware hangs, like real hardware)');return true}
   if(p.f=='arlo'){const bi=Math.max(0,p.bit!=null?p.bit:firstOne(bits));at((bi+1)*tb,()=>{I.own=false;ev({ev:'arlo',c0,tb,a:bits,bit:bi});
     diag('arlo'+k,'arbitration lost (status 0x38): SDA cannot go high, so the bus has no working pull-up on SDA (or the rise time is far too slow)');done(0x38)});return true}
   I.busy=false;return false};
  const stop=()=>{
   if(!I.own){I.con&=~STO;I.go();return}
   const tb=tbc();I.busy=true;ev({ev:'P',c0:T.cy,tb});
   at(tb,()=>{I.busy=false;I.own=false;I.con&=~STO;I.stat=0xF8;host('stop');T.level();I.go()})};
  const start=()=>{if(!check())return;
   if(!I.own&&T.host.i2cLow&&T.host.i2cLow(k)){diag('busy'+k,'START waits: the bus is busy because SCL or SDA is held low (shorted to GND, or driven low by another pin)');return}
   const rep=I.own,tb=tbc();I.busy=true;ev({ev:rep?'Sr':'S',c0:T.cy,tb});
   at(rep?tb*1.5:tb/2,()=>{I.own=true;done(rep?0x10:0x08)})};
  const sendByte=(b,addr)=>{const tb=tbc(),c0=T.cy,p=phy(b,'tx');if(fail(p,b,c0,tb))return;I.busy=true;
   at(9*tb,()=>{const ack=p.f!='garble'&&host(addr?'addr':'write',b)!==false;
    stretch(()=>{ev({ev:addr?'addr':'wr',c0,tb,a:b,b,ack});done(addr?((b&1)?(ack?0x40:0x48):(ack?0x18:0x20)):(ack?0x28:0x30))})})};
  const recv=()=>{const tb=tbc(),c0=T.cy,p=phy(0xFF,'rx'),ackBit=(I.con&AA)?1:0;if(p.f=='hang'&&fail(p,0xFF,c0,tb))return;I.busy=true;
   at(9*tb,()=>{const b=p.f=='garble'?0xFF:host('read',ackBit)&255;
    stretch(()=>{ev({ev:'rd',c0,tb,b,ack:ackBit});I.dat=b;done(ackBit?0x50:0x58)})})};
  // run the next step when SI is clear and nothing is in progress
  I.go=()=>{if(I.busy||!(I.con&EN)||(I.con&SI))return;
   if(I.con&STO){stop();return}
   if(I.con&STA){start();return}
   const s=I.stat;
   if(s==0x08||s==0x10)sendByte(I.dat&255,true);else if(s==0x18||s==0x28)sendByte(I.dat&255,false);else if(s==0x40||s==0x50)recv()};
  I.hw=()=>{I.ep++;I.busy=false;I.own=false;I.stat=0xF8};
  I.init=()=>{I.con=0;I.dat=0;I.adr=[0,0,0,0];I.sclh=4;I.scll=4;I.mask=[0,0,0,0];I.mm=0;I.hw()};
  I.init();return I};
 T.i2c=c.base.map((_,k)=>mk(k));
 const kOf=a=>c.base.findIndex(b=>a>=b&&a<b+0x1000);
 return{name:'i2c',regions:c.base.map(b=>[b,b+0x1000]),
  rd(a){const k=kOf(a);if(!c.on(k))return 0;const I=T.i2c[k],o=a-c.base[k];
   if(o==0)return I.con;if(o==4)return I.stat;if(o==8)return I.dat;if(o==0xC)return I.adr[0];if(o==0x10)return I.sclh;if(o==0x14)return I.scll;if(o==0x1C)return I.mm;
   if(o>=0x20&&o<=0x28)return I.adr[1+((o-0x20)>>2)];if(o>=0x30&&o<=0x3C)return I.mask[(o-0x30)>>2];return 0},
  wr(a,n,v){const k=kOf(a);if(!c.on(k))return;const I=T.i2c[k],o=a-c.base[k];
   if(o==0){const was=I.con&EN;I.con|=v&0x74;if((I.con&EN)&&!was)I.hw();I.go()}
   else if(o==0x18){I.con&=~(v&0x6C);if(!(I.con&EN))I.hw();I.go()}
   else if(o==8)I.dat=v&255;else if(o==0xC)I.adr[0]=v&255;else if(o==0x10)I.sclh=v&0xFFFF;else if(o==0x14)I.scll=v&0xFFFF;else if(o==0x1C)I.mm=v&15;
   else if(o>=0x20&&o<=0x28)I.adr[1+((o-0x20)>>2)]=v&255;else if(o>=0x30&&o<=0x3C)I.mask[(o-0x30)>>2]=v&0xFE;
   T.level()},
  reset(){T.i2c.forEach(I=>I.init())},
  level(){for(let k=0;k<T.i2c.length;k++){const I=T.i2c[k];if((I.con&SI)&&(I.con&EN)&&c.on(k,true))T.irq(c.irq[k])}}}}
