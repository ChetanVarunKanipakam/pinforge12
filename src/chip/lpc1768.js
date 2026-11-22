/* NXP LPC1768: Cortex-M3 core + memory map + System Control (clocking, PLL0, power control, flash timing) + the LPC17xx peripheral set.
   Memory: 512 KB flash at 0, 32 KB local SRAM at 0x10000000, two 16 KB AHB SRAM banks at 0x2007C000 / 0x20080000.
   Like the real chip it only starts user code whose vector table checksum is valid (boot ROM), runs from the 4 MHz IRC after reset and
   gates every peripheral by PCONP. Things that real silicon does silently wrong (flash timing too short for CCLK, unpowered peripherals,
   UART pins not selected ...) are reported through host.diag(msg). opt: {xtal: main oscillator Hz (default 12 MHz)}. */
function LPC1768(host,opt){
 const XT=(opt&&opt.xtal)||12e6;
 const T=new CortexM(host,{flashBase:0,flashSize:0x80000,ramBase:0x10000000,ramSize:0x8000,ramBanks:[{base:0x2007C000,size:0x4000},{base:0x20080000,size:0x4000}],
  periphRanges:[[0x2009C000,0x2009C0A0]],prioBits:5,cpuid:0x412FC230});
 T.xtal=XT;
 const dg={};T.diag=(key,msg)=>{if(dg[key])return;dg[key]=1;if(T.host.diag)T.host.diag(msg)};
 const sc={};const scInit=()=>{for(const k in dg)delete dg[k];Object.assign(sc,{flashcfg:0x303A,conW:0,cfgW:0,con:0,cfg:0,lock:false,gen:0,feed:0,pcon:0,pconp:0x042887DE,cclkcfg:0,usbclk:0,clksrc:0,scs:0,osc:false,pcsel0:0,pcsel1:0,rsid:1})};
 scInit();T.sc=sc;
 // ---- clocks
 const src=()=>{const s=sc.clksrc&3;return s==0?4e6:s==1?(sc.scs&0x20?XT:0):32768};
 const fcco=()=>{const M=(sc.cfg&0x7FFF)+1,N=((sc.cfg>>16)&0xFF)+1;return 2*M*src()/N};
 const fccoOk=()=>{const f=fcco(),fin=src();return fin>=32e3&&fin<=50e6&&f>=275e6&&f<=550e6};
 const connected=()=>(sc.con&3)==3&&sc.lock;
 T.cclk=()=>{let f=connected()?fcco():src();if(!f)f=4e6;return f/((sc.cclkcfg&255)+1)};
 T.sysclk=T.cclk;
 T.pconp=()=>sc.pconp;
 T.pconpOn=(bit,name)=>{if((sc.pconp>>bit)&1)return true;T.diag('pcon'+bit,name+' was accessed while its power bit PCONP['+bit+'] is 0: the block ignores reads and writes. Set the bit in LPC_SC->PCONP first.');return false};
 const pdiv=(reg,sh)=>[4,1,2,8][((reg>>sh)&3)];
 const checkSpeed=()=>{const f=T.cclk(),tim=(sc.flashcfg>>12)&15,max=[20,40,60,80,100,120][Math.min(tim,5)]*1e6;
  if(f>100e6)T.diag('cclkmax','CCLK is '+(f/1e6)+' MHz: the LPC1768 is specified up to 100 MHz');
  else if(f>max)T.diag('flashtim','CCLK is '+(f/1e6)+' MHz but FLASHCFG.FLASHTIM='+tim+' allows only '+(max/1e6)+' MHz: set FLASHTIM before raising the clock (4 for up to 100 MHz). Real silicon crashes or misbehaves here.')};
 const apply=()=>{const wasOn=sc.con&1,oldCfg=sc.cfg,oldSrc=sc.clksrc;sc.con=sc.conW;sc.cfg=sc.cfgW;
  // lock is only lost when PLL0 is switched off or reconfigured; changing just the connect bit keeps it
  if(!(sc.con&1)){sc.lock=false;sc.gen++}else if(!wasOn||oldCfg!==sc.cfg){sc.lock=false;sc.gen++;sc.pend=true}else sc.pend=false;
  const g=sc.gen;
  if((sc.con&1)&&sc.pend){if(!fccoOk()){T.diag('pllrange','PLL0 is configured for Fcco = '+(fcco()/1e6)+' MHz from '+(src()/1e6)+' MHz: it must be 275-550 MHz (and the input 32 kHz-50 MHz), so PLL0 never locks');}
   else T.sched(T.cy+Math.round(T.cclk()*50e-6),()=>{if(sc.gen===g&&(sc.con&1)){sc.lock=true;checkSpeed()}})}
  if((sc.con&2)&&!(sc.con&1))T.diag('pllconn','PLL0 connect was set without enabling PLL0 (PLL0CON bit 0)');
  checkSpeed()};
 T.attach({name:'sc',regions:[[0x400FC000,0x400FD000]],
  rd(a){const o=a-0x400FC000;
   switch(o){case 0x000:return sc.flashcfg;case 0x080:return sc.con;case 0x084:return sc.cfg;
    case 0x088:return(sc.cfg&0x7FFF)|((sc.cfg&0xFF0000))|((sc.con&1)<<24)|(connected()?1<<25:0)|(sc.lock?1<<26:0);
    case 0x0C0:return sc.pcon;case 0x0C4:return sc.pconp;case 0x104:return sc.cclkcfg;case 0x108:return sc.usbclk;case 0x10C:return sc.clksrc;
    case 0x140:case 0x148:case 0x14C:return T.eintRd(o);case 0x180:return sc.rsid;case 0x1A0:return(sc.scs&0x3F)|(sc.osc?0x40:0);
    case 0x1A8:return sc.pcsel0;case 0x1AC:return sc.pcsel1}return 0},
  wr(a,n,v){const o=a-0x400FC000;
   if(o==0x08C){v&=255;if(v==0xAA)sc.feed=1;else{if(v==0x55&&sc.feed)apply();sc.feed=0}return}
   sc.feed=0;
   switch(o){case 0x000:sc.flashcfg=v;checkSpeed();break;case 0x080:sc.conW=v&3;break;case 0x084:sc.cfgW=v&0xFF7FFF;break;
    case 0x0C0:sc.pcon=v;break;case 0x0C4:sc.pconp=v>>>0;T.level();break;
    case 0x104:sc.cclkcfg=v&255;checkSpeed();break;case 0x108:sc.usbclk=v;break;
    case 0x10C:if((sc.con&1)||(sc.con&2))T.diag('clksrc','CLKSRCSEL changed while PLL0 is enabled: disable and disconnect PLL0 first');sc.clksrc=v&3;break;
    case 0x140:case 0x148:case 0x14C:T.eintWr(o,v);break;case 0x180:sc.rsid&=~v;break;
    case 0x1A0:{const was=sc.scs&0x20;sc.scs=v&0x3F;if((v&0x20)&&!was){sc.osc=false;T.sched(T.cy+Math.round(T.cclk()*340e-6),()=>{if(sc.scs&0x20)sc.osc=true})}else if(!(v&0x20))sc.osc=false;break}
    case 0x1A8:sc.pcsel0=v>>>0;break;case 0x1AC:sc.pcsel1=v>>>0;break}},
  reset(){scInit()},
  post(){}});
 // ---- boot ROM: user code runs only if the sum of the first eight vectors is zero
 T.attach({name:'boot',regions:[],reset(){},post(){let s=0;for(let i=0;i<8;i++)s=(s+T.rd32(4*i))>>>0;
  if(s!==0)T.halted='Boot ROM: the vector table checksum is invalid (the sum of vectors 0-7 must be 0), so the real chip would stay in its ISP bootloader and never start this program. Rebuild with PinForge, or run toolchain/lpc-checksum.js on the .bin.'}});
 // ---- peripherals
 const on=(bit,name)=>(k,quiet)=>quiet?((sc.pconp>>bit[k])&1)!=0:T.pconpOn(bit[k],name+k);
 T.attach(GpioLpc17(T,{fio:0x2009C000,pincon:0x4002C000,gpioint:0x40028080,irq:21,eintIrq:[18,19,20,21]}));
 const UTX=[[[0,2,1]],[[0,15,1],[2,0,2]],[[0,10,1],[2,8,2]],[[0,0,2],[0,25,3],[4,28,3]]],URX=[[[0,3,1]],[[0,16,1],[2,1,2]],[[0,11,1],[2,9,2]],[[0,1,2],[0,26,3],[4,29,3]]];
 UTX.forEach((l,k)=>l.forEach(([p,i,f])=>T.afOut.set(p+'.'+i+'.'+f,2)));
 [[0,27,1],[0,28,1],[0,0,3],[0,1,3],[0,19,3],[0,20,3],[0,10,2],[0,11,2]].forEach(([p,i,f])=>T.afOut.set(p+'.'+i+'.'+f,3));   // SDA0 SCL0 SDA1 SCL1 (two pairs) SDA2 SCL2: open drain
 const ub=[3,4,24,25];
 T.attach(UartLpc17(T,{base:[0x4000C000,0x40010000,0x40098000,0x4009C000],irq:[5,6,7,8],pbit:ub,tx:UTX,rx:URX,
  on:on(ub,'UART'),div:k=>k==0?pdiv(sc.pcsel0,6):k==1?pdiv(sc.pcsel0,8):k==2?pdiv(sc.pcsel1,16):pdiv(sc.pcsel1,18)}));
 T.attach(AdcLpc17(T,{base:0x40034000,irq:22,on:q=>q?((sc.pconp>>12)&1)!=0:T.pconpOn(12,'ADC'),div:()=>pdiv(sc.pcsel0,24),pins:[[0,23,1],[0,24,1],[0,25,1],[0,26,1],[1,30,3],[1,31,3],[0,3,2],[0,2,2]]}));
 const ib=[7,19,26];
 T.attach(I2cLpc17(T,{base:[0x4001C000,0x4005C000,0x400A0000],irq:[10,11,12],pbit:ib,on:on(ib,'I2C'),div:k=>k==0?pdiv(sc.pcsel0,14):k==1?pdiv(sc.pcsel1,6):pdiv(sc.pcsel1,20)}));
 const tb=[1,2,22,23];
 T.attach(TimerLpc17(T,{base:[0x40004000,0x40008000,0x40090000,0x40094000],irq:[1,2,3,4],pbit:tb,on:on(tb,'Timer'),
  div:k=>k==0?pdiv(sc.pcsel0,2):k==1?pdiv(sc.pcsel0,4):k==2?pdiv(sc.pcsel1,12):pdiv(sc.pcsel1,14)}));
 return T}
