/* LPC17xx Timer0-3 (32-bit timer/counter with prescaler, 4 match registers). Timer mode only.
   cfg: {base:[..], irq:[..], on:k=>bool (PCONP gate, reports use of an unpowered block), div:k=>PCLK divider}
   Not modelled yet: capture inputs (CAP pins, CCR/CR0/CR1), external match outputs (EMR / MAT pins), counter mode (CTCR). */
function TimerLpc17(T,c){
 const fresh=()=>({ir:0,tcr:0,tc:0,pr:0,pc:0,mcr:0,mr:[0,0,0,0],ccr:0,cr:[0,0],emr:0,ctcr:0,acc:0,rst:false});
 T.tmr=c.base.map(fresh);
 const kOf=a=>c.base.findIndex(b=>a>=b&&a<b+0x1000);
 const match=(k,t)=>{const prev=t.ir;for(let i=0;i<4;i++)if(t.tc===(t.mr[i]>>>0)){const m=(t.mcr>>(3*i))&7;if(m&1)t.ir|=1<<i;if(m&2)t.rst=true;if(m&4)t.tcr&=~1}
  if(t.ir&~prev)T.irq(c.irq[k])};   // edge only: a still-set flag re-pends on exception return (T.level), not while the handler runs
 // TC only changes when the prescaler wraps; a pending reset (MCR.MRnR) is applied on that same boundary, so the period is (MR+1) x (PR+1) PCLK cycles.
 // (To be confirmed on silicon: tests/hw-validation, question H1.)
 const step=(k,t)=>{if(t.pc>=t.pr){t.pc=0;if(t.rst){t.rst=false;t.tc=0}else t.tc=(t.tc+1)>>>0;match(k,t)}else t.pc++};
 return{name:'timer',regions:c.base.map(b=>[b,b+0x1000]),
  rd(a){const k=kOf(a);if(!c.on(k))return 0;const t=T.tmr[k],o=a-c.base[k];
   return o==0?t.ir:o==4?t.tcr:o==8?t.tc:o==0xC?t.pr:o==0x10?t.pc:o==0x14?t.mcr:o>=0x18&&o<=0x24?t.mr[(o-0x18)>>2]>>>0:o==0x28?t.ccr:o==0x2C?t.cr[0]:o==0x30?t.cr[1]:o==0x3C?t.emr:o==0x70?t.ctcr:0},
  wr(a,n,v){const k=kOf(a);if(!c.on(k))return;const t=T.tmr[k],o=a-c.base[k];
   if(o==0){t.ir&=~v}else if(o==4){const was=t.tcr&1;t.tcr=v&3;if(v&2){t.tc=0;t.pc=0;t.acc=0;t.rst=false}else if((v&1)&&!was)match(k,t)}/* the comparator also sees TC == MRn at the moment counting starts */else if(o==8)t.tc=v>>>0;else if(o==0xC)t.pr=v>>>0;else if(o==0x10)t.pc=v>>>0;
   else if(o==0x14)t.mcr=v&0xFFF;else if(o>=0x18&&o<=0x24)t.mr[(o-0x18)>>2]=v>>>0;else if(o==0x28)t.ccr=v&0x3F;else if(o==0x3C)t.emr=v;
   else if(o==0x70){t.ctcr=v&0xF;if(t.ctcr&3)T.diag('tmrctr'+k,'Timer'+k+' counter mode (CTCR) is not modelled yet: the timer will not count')}
   T.level()},
  reset(){T.tmr.forEach((t,k)=>Object.assign(t,fresh()))},
  tick(cy){for(let k=0;k<T.tmr.length;k++){const t=T.tmr[k];if((t.tcr&3)!==1||(t.ctcr&3))continue;if(!((T.pconp()>>c.pbit[k])&1))continue;
    t.acc+=cy;const d=c.div(k);while(t.acc>=d){t.acc-=d;step(k,t)}}},
  level(){for(let k=0;k<T.tmr.length;k++)if(T.tmr[k].ir)T.irq(c.irq[k])}}}
