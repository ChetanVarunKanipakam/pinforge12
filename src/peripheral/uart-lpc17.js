/* LPC17xx UART0-3 (16550-compatible, fractional baud-rate generator, 16-byte FIFOs).
   Baud = PCLK / (16 x (256 x DLM + DLL) x (1 + DIVADDVAL / MULVAL)).  A frame takes bitCycles x bits CPU cycles; THR -> shift register is immediate when idle.
   Modelled: DLAB, FIFO enable/reset/trigger level, THRE / RDA / character-timeout / RX-line (overrun) interrupts, LSR, TER, word length / parity / stop bits for timing.
   Not modelled: parity / framing / break errors, auto-baud, RS-485, UART1 modem lines, IrDA.
   A byte only leaves the chip if the TXD pin is selected in PINSEL and only arrives if the RXD pin is selected, like on the real part.
   cfg: {base:[..], irq:[..], pbit:[..], div:k=>PCLK divider, on:k=>bool, tx:[[[port,pin,func]..]..], rx:[..]} */
function UartLpc17(T,c){
 const mk=()=>({dll:1,dlm:0,ier:0,fcr:0,lcr:0,scr:0,acr:0,icr:0,fdr:0x10,ter:0x80,mcr:0,rx:[],q:[],busy:false,oe:false,thrClr:false,cti:false,gen:0});
 T.uart=c.base.map(mk);
 const kOf=a=>c.base.findIndex(b=>a>=b&&a<b+0x1000);
 const fifo=u=>(u.fcr&1)!=0, trig=u=>fifo(u)?[1,4,8,14][(u.fcr>>6)&3]:1, cap=u=>fifo(u)?16:1;
 const bitCycles=(k,u)=>{const dl=(u.dlm<<8)|u.dll;if(!dl)return 0;const mul=(u.fdr>>4)&15||1,add=u.fdr&15;return Math.max(1,Math.round(c.div(k)*16*dl*(1+add/mul)))};
 const frameBits=u=>1+5+(u.lcr&3)+((u.lcr&8)?1:0)+((u.lcr&4)?2:1);
 const pinOk=(list,k)=>list[k].some(([p,i,f])=>T.pinFn(p,i)===f);
 const pump=(k,u)=>{if(u.busy||!u.q.length||!(u.ter&0x80))return;const bc=bitCycles(k,u);if(!bc){T.diag('uartdl'+k,'UART'+k+' divisor latch is 0 (DLL/DLM): the baud-rate generator is stopped and nothing is sent');return}
  const b=u.q.shift(),nb=5+(u.lcr&3),ch=b&((1<<nb)-1);u.thrClr=false;
  if(pinOk(c.tx,k)){if(T.host.serial)T.host.serial(k,ch);if(T.host.uartTx)T.host.uartTx(k,ch,bc)}
  else T.diag('uarttx'+k,'UART'+k+' is transmitting but no TXD'+k+' pin is selected in PINSEL (e.g. '+c.tx[k].map(([p,i,f])=>'P'+p+'.'+i+' function '+f).join(' or ')+'): nothing appears on a pin');
  u.busy=true;T.sched(T.cy+frameBits(u)*bc,()=>{u.busy=false;pump(k,u);T.level()})};
 T.rxByte=function(k,ch){const u=T.uart[k];if(!c.on(k,true))return;
  if(!pinOk(c.rx,k)){T.diag('uartrx'+k,'UART'+k+' received a byte but no RXD'+k+' pin is selected in PINSEL (e.g. '+c.rx[k].map(([p,i,f])=>'P'+p+'.'+i+' function '+f).join(' or ')+'): the byte is lost');return}
  if(u.rx.length>=cap(u)){u.oe=true}else u.rx.push(ch&0xFF);
  const g=++u.gen,bc=bitCycles(k,u)||1;T.sched(T.cy+4*frameBits(u)*bc,()=>{if(u.gen===g&&u.rx.length&&u.rx.length<trig(u)){u.cti=true;T.level()}});T.level()};
 const pending=u=>((u.ier&4)&&u.oe)||((u.ier&1)&&(u.rx.length>=trig(u)||u.cti))||((u.ier&2)&&!u.q.length&&!u.thrClr);
 const iir=u=>{let id=1;if((u.ier&4)&&u.oe)id=6;else if((u.ier&1)&&u.rx.length>=trig(u))id=4;else if((u.ier&1)&&u.cti)id=0xC;else if((u.ier&2)&&!u.q.length&&!u.thrClr)id=2;return id|(fifo(u)?0xC0:0)};
 return{name:'uart',regions:c.base.map(b=>[b,b+0x1000]),
  rd(a){const k=kOf(a);if(!c.on(k))return 0;const u=T.uart[k],o=a-c.base[k],dlab=u.lcr&0x80;
   if(o==0){if(dlab)return u.dll;const v=u.rx.length?u.rx.shift():0;if(!u.rx.length)u.cti=false;T.level();return v}
   if(o==4)return dlab?u.dlm:u.ier;
   if(o==8){const v=iir(u);if((v&0xF)==2){u.thrClr=true;T.level()}return v}
   if(o==0xC)return u.lcr;if(o==0x10)return u.mcr;
   if(o==0x14){const v=(u.rx.length?1:0)|(u.oe?2:0)|(!u.q.length?0x20:0)|(!u.q.length&&!u.busy?0x40:0);if(u.oe){u.oe=false;T.level()}return v}
   if(o==0x1C)return u.scr;if(o==0x20)return u.acr;if(o==0x28)return u.fdr;if(o==0x30)return u.ter;return 0},
  wr(a,n,v){const k=kOf(a);if(!c.on(k))return;const u=T.uart[k],o=a-c.base[k],dlab=u.lcr&0x80;
   if(o==0){if(dlab)u.dll=v&255;else{if(u.q.length<cap(u))u.q.push(v&255);u.thrClr=false;pump(k,u)}}
   else if(o==4){if(dlab)u.dlm=v&255;else{if((v&2)&&!(u.ier&2))u.thrClr=false;u.ier=v&0x307}}
   else if(o==8){u.fcr=v&0xC1;if(v&2){u.rx.length=0;u.cti=false}if(v&4)u.q.length=0}
   else if(o==0xC)u.lcr=v&255;else if(o==0x10)u.mcr=v&255;else if(o==0x1C)u.scr=v&255;else if(o==0x20)u.acr=v;else if(o==0x24)u.icr=v&255;else if(o==0x28)u.fdr=v&255;
   else if(o==0x30){u.ter=v&0x80;pump(k,u)}
   T.level()},
  reset(){T.uart.forEach((u,k)=>Object.assign(u,mk()))},
  level(){for(let k=0;k<T.uart.length;k++){const u=T.uart[k];if(((T.pconp()>>c.pbit[k])&1)&&pending(u))T.irq(c.irq[k])}}}}
