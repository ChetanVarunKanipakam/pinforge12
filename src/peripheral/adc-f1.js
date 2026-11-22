/* ADC1, STM32F1 (software-triggered single conversion). cfg: {base, irq} */
function AdcF1(T,c){
 const fresh=()=>({sr:0,cr1:0,cr2:0,sqr3:0,dr:0,smpr1:0,smpr2:0,sqr1:0,sqr2:0});T.adc=fresh();
 return{name:'adc',regions:[[c.base,c.base+0x400]],
  rd(a){const o=a&0x3FF,d=T.adc;return o==0?d.sr:o==4?d.cr1:o==8?d.cr2:o==0x34?d.sqr3:o==0x4C?(d.sr&=~2,d.dr):o==0x10?d.smpr2:0},
  wr(a,n,v){const o=a&0x3FF,d=T.adc;
   if(o==4){d.cr1=v;T.level()}else if(o==8){d.cr2=v&~(1<<2)&~(1<<3);if((v&1)&&(v&(1<<22))){const ch=d.sqr3&31;d.dr=T.host.analog?T.host.analog(ch)&0xFFF:0;d.sr|=2;d.cr2&=~(1<<22);T.level()}}else if(o==0)d.sr=v;else if(o==0x34)d.sqr3=v;else if(o==0x10)d.smpr2=v},
  reset(){T.adc=fresh()},
  level(){if((T.adc.sr&2)&&(T.adc.cr1&0x20))T.irq(c.irq)}}}
