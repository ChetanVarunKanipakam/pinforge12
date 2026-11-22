/* General-purpose 16-bit timers (TIM2-4 style): update + compare interrupts, PWM modes 1/2. cfg: {base:[...], irq:[...], pins:[[[port,pin]x4] per timer]} */
function TimerGp16(T,c){
 T.tim=c.base.map(()=>({cr1:0,psr:0,arr:0xFFFF,cnt:0,sr:0,dier:0,acc:0,ccr:[0,0,0,0],ccmr1:0,ccmr2:0,ccer:0,lv:[null,null,null,null]}));
 const TP=c.pins,tiOf=a=>c.base.indexOf(a&~0x3FF);
 T.pwmSync=function(ti){if(!T.host.pwm)return;const t=T.tim[ti];for(let k=0;k<4;k++){const m=k<2?t.ccmr1>>(k*8+4)&7:t.ccmr2>>((k-2)*8+4)&7,en=(t.ccer>>(k*4))&1;
  T.host.pwm(TP[ti][k][0],TP[ti][k][1],(en&&(m==6||m==7)&&(t.cr1&1))?Math.min(1,t.ccr[k]/(t.arr+1)):null)}};
 return{name:'timer',regions:[[Math.min(...c.base),Math.max(...c.base)+0x400]],
  rd(a){const ti=tiOf(a);if(ti<0)return 0;const o=a&0x3FF,t=T.tim[ti];return o==0?t.cr1:o==0xC?t.dier:o==0x10?t.sr:o==0x24?t.cnt:o==0x28?t.psr:o==0x2C?t.arr:o==0x34?t.ccr[0]:o==0x38?t.ccr[1]:o==0x3C?t.ccr[2]:o==0x40?t.ccr[3]:o==0x18?t.ccmr1:o==0x1C?t.ccmr2:o==0x20?t.ccer:0},
  wr(a,n,v){const ti=tiOf(a);if(ti<0)return;const o=a&0x3FF,t=T.tim[ti];if(o==0)t.cr1=v;else if(o==0xC){t.dier=v;T.level()}else if(o==0x10)t.sr&=v;else if(o==0x14){if(v&1){t.cnt=0;t.sr|=1}}else if(o==0x24)t.cnt=v&0xFFFF;else if(o==0x28)t.psr=v&0xFFFF;else if(o==0x2C)t.arr=v&0xFFFF;
   else if(o==0x34)t.ccr[0]=v&0xFFFF;else if(o==0x38)t.ccr[1]=v&0xFFFF;else if(o==0x3C)t.ccr[2]=v&0xFFFF;else if(o==0x40)t.ccr[3]=v&0xFFFF;else if(o==0x18)t.ccmr1=v;else if(o==0x1C)t.ccmr2=v;else if(o==0x20)t.ccer=v;
   T.pwmSync(ti)},
  reset(){T.tim.forEach(t=>{t.cr1=0;t.cnt=0;t.sr=0;t.dier=0;t.acc=0;t.ccr=[0,0,0,0];t.ccmr1=t.ccmr2=t.ccer=0;t.arr=0xFFFF;t.psr=0;t.lv=[null,null,null,null]})},
  tick(cy){for(let i=0;i<T.tim.length;i++){const t=T.tim[i];if(t.cr1&1){t.acc+=cy;const d=t.psr+1;while(t.acc>=d){t.acc-=d;if(t.cnt>=t.arr){t.cnt=0;t.sr|=1;if(t.dier&1)T.irq(c.irq[i])}else t.cnt++;for(let k=0;k<4;k++)if(t.cnt==t.ccr[k]){t.sr|=2<<k;if(t.dier&(2<<k))T.irq(c.irq[i])}
    if(t.ccer&0x1111&&T.host.pwmEdge)for(let k=0;k<4;k++){const m=k<2?(t.ccmr1>>(k*8+4))&7:(t.ccmr2>>((k-2)*8+4))&7;if(((t.ccer>>(k*4))&1)&&(m==6||m==7)){const hi=m==6?t.cnt<t.ccr[k]:t.cnt>=t.ccr[k];if(t.lv[k]!==hi){t.lv[k]=hi;T.host.pwmEdge(TP[i][k][0],TP[i][k][1],hi?1:0)}}else t.lv[k]=null}}}}},
  level(){for(let i=0;i<T.tim.length;i++){const t=T.tim[i];if(t.sr&t.dier&0x1F)T.irq(c.irq[i])}}}}
