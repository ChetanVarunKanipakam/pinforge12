/* USART, SR/DR/BRR/CR1-3 layout (STM32F1 and F4). cfg: {base:[...], irq:[...]} */
function UsartV1(T,c){
 T.us=c.base.map(()=>({sr:0xC0,dr:0,brr:0,cr1:0,cr2:0,cr3:0,rx:[]}));
 const kOf=a=>c.base.indexOf(a&~0x3FF);
 T.rxByte=function(k,ch){T.us[k].rx.push(ch&0xFF);T.level()};
 return{name:'usart',regions:c.base.map(b=>[b,b+0x400]),
  rd(a){const u=T.us[kOf(a)],o=a&0x3FF;
   if(o==0)return(u.sr&~0x20)|(u.rx.length?0x20:0);if(o==4){return u.rx.length?u.rx.shift():0}if(o==8)return u.brr;if(o==0xC)return u.cr1;if(o==0x10)return u.cr2;if(o==0x14)return u.cr3;return 0},
  wr(a,n,v){const k=kOf(a),u=T.us[k],o=a&0x3FF;
   if(o==4){if(u.cr1&8&&u.cr1&0x2000){if(T.host.serial)T.host.serial(k,v&0xFF);if(T.host.uartTx)T.host.uartTx(k,v&0xFF,u.brr)}}else if(o==8)u.brr=v;else if(o==0xC){u.cr1=v;T.level()}else if(o==0x10)u.cr2=v;else if(o==0x14)u.cr3=v;else if(o==0)u.sr=(u.sr&~0x20)|(v&0x20)|0xC0},
  reset(){T.us.forEach(u=>{u.sr=0xC0;u.cr1=0;u.rx=[]})},
  level(){for(let i=0;i<T.us.length;i++){const u=T.us[i];if((u.cr1&0x2000)&&(((u.cr1&0x20)&&u.rx.length)||(u.cr1&0x80)||((u.cr1&0x40)&&(u.sr&0x40))))T.irq(c.irq[i])}}}}
