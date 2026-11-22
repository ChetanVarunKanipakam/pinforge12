/* AFIO (EXTI line selection, remap) + EXTI. cfg: {afio, exti, irqOf:line=>irq number, ports} */
function ExtiF1(T,c){
 T.afio={exticr:[0,0,0,0],mapr:0};T.exti={imr:0,emr:0,rtsr:0,ftsr:0,pr:0};T.lastIn=new Array(16).fill(-1);
 T.setPin=function(){
  for(let i=0;i<16;i++){const sel=(T.afio.exticr[i>>2]>>((i&3)*4))&15;if(sel>=c.ports)continue;const g=T.gp[sel],cfg=(i<8?g.crl>>>(i*4):g.crh>>>((i-8)*4))&15;
   if(cfg&3){T.lastIn[i]=-1;continue}const v=T.host.readPin?T.host.readPin(sel,i,cfg>>2,(g.odr>>i)&1):0;
   if(T.lastIn[i]>=0&&T.lastIn[i]!=v){const e=T.exti;if(((e.rtsr>>i)&1&&v)||((e.ftsr>>i)&1&&!v)){if((e.imr>>i)&1){e.pr|=1<<i;T.irq(c.irqOf(i))}}}T.lastIn[i]=v}};
 T.extiIrq=function(){const e=T.exti;for(let l=0;l<16;l++)if((e.pr>>l)&1)T.irq(c.irqOf(l))};
 return{name:'exti',regions:[[c.afio,c.afio+0x400],[c.exti,c.exti+0x400]],
  rd(a){if(a<c.exti){const o=a&0xFF;return o==4?T.afio.mapr:o>=8&&o<=0x14?T.afio.exticr[(o-8)>>2]:0}
   const o=a&0xFF,e=T.exti;return o==0?e.imr:o==4?e.emr:o==8?e.rtsr:o==0xC?e.ftsr:o==0x14?e.pr:0},
  wr(a,n,v){if(a<c.exti){const o=a&0xFF;if(o==4)T.afio.mapr=v;else if(o>=8&&o<=0x14)T.afio.exticr[(o-8)>>2]=v;return}
   const o=a&0xFF,e=T.exti;if(o==0){e.imr=v;T.level()}else if(o==4)e.emr=v;else if(o==8)e.rtsr=v;else if(o==0xC)e.ftsr=v;else if(o==0x10){e.pr|=v&e.imr;T.level()}else if(o==0x14)e.pr&=~v},
  reset(){T.afio.exticr=[0,0,0,0];T.afio.mapr=0;T.exti={imr:0,emr:0,rtsr:0,ftsr:0,pr:0};T.lastIn.fill(-1)},
  level(){const e=T.exti,m=e.pr&e.imr;if(m)for(let l=0;l<16;l++)if((m>>l)&1)T.irq(c.irqOf(l))}}}
