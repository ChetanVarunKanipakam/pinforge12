/* FROZEN reference: the pre-refactor single-function emulator (PinForge v1, STM32F103 only). Used by tests/t_equiv.js as an oracle. Do not edit. */
/* PinForge Cortex-M3 + STM32F103 emulator */
function CM3(host){
 const T=this;T.host=host||{};
 T.r=new Int32Array(16);T.N=T.Z=T.C=T.V=0;T.it=0;T.ipsr=0;T.primask=0;T.cy=0;T.halted=null;
 T.flash=new Uint8Array(65536);T.ram=new Uint8Array(20480);
 T.pend=[];T.nvEn=[0,0,0];T.nvPend=[0,0,0];T.ipr=new Uint8Array(96);T.shp=new Uint8Array(12);T.act=[];
 T.st={ctrl:0,load:0,val:0,flag:0,acc:0};
 T.rcc={cr:0x83,cfgr:0,apb2:0,apb1:0,ahb:0x14};
 T.gp=[0,1,2].map(()=>({crl:0x44444444,crh:0x44444444,odr:0}));
 T.afio={exticr:[0,0,0,0],mapr:0};
 T.exti={imr:0,emr:0,rtsr:0,ftsr:0,pr:0};T.lastIn=new Array(16).fill(-1);
 T.us=[0,1,2].map(()=>({sr:0xC0,dr:0,brr:0,cr1:0,cr2:0,cr3:0,rx:[]}));
 T.adc={sr:0,cr1:0,cr2:0,sqr3:0,dr:0,smpr1:0,smpr2:0,sqr1:0,sqr2:0};
 T.tim=[0,1,2].map(()=>({cr1:0,psr:0,arr:0xFFFF,cnt:0,sr:0,dier:0,acc:0,ccr:[0,0,0,0],ccmr1:0,ccmr2:0,ccer:0,lv:[null,null,null,null]}));
 T.gate=[0x4,0x8,0x10];
 T.evq=[];T.sched=function(at,f){const q=T.evq;let i=q.length;while(i>0&&q[i-1].at>at)i--;q.splice(i,0,{at,f})};
 T.runEv=function(){const q=T.evq;while(q.length&&q[0].at<=T.cy){const e=q.shift();e.f()}};
 T.i2c=[0,1].map(k=>makeI2C(T,k));
 T.reset=function(){T.r.fill(0);T.N=T.Z=T.C=T.V=0;T.it=0;T.ipsr=0;T.halted=null;T.cy=0;T.pend=[];T.act=[];T.ipr.fill(0);T.shp.fill(0);
  T.r[13]=T.rd32(0x08000000)|0;T.r[15]=T.rd32(0x08000004)&~1;T.r[14]=-1;
  T.st={ctrl:0,load:0,val:0,flag:0,acc:0};T.rcc={cr:0x83,cfgr:0,apb2:0,apb1:0,ahb:0x14};T.ram.fill(0);
  T.gp.forEach(g=>{g.crl=g.crh=0x44444444;g.odr=0});T.shadow.forEach(x=>x.fill(-1));T.exti={imr:0,emr:0,rtsr:0,ftsr:0,pr:0};T.nvEn=[0,0,0];T.nvPend=[0,0,0];
  T.us.forEach(u=>{u.sr=0xC0;u.cr1=0;u.rx=[]});T.tim.forEach(t=>{t.cr1=0;t.cnt=0;t.sr=0;t.dier=0;t.acc=0;t.ccr=[0,0,0,0];t.ccmr1=t.ccmr2=t.ccer=0;t.arr=0xFFFF;t.psr=0;t.lv=[null,null,null,null]});
  T.adc={sr:0,cr1:0,cr2:0,sqr3:0,dr:0,smpr1:0,smpr2:0,sqr1:0,sqr2:0};T.lastIn.fill(-1);T.evq=[];T.i2c.forEach(x=>x.init());
  for(let p=0;p<3;p++)T.gpioSync(p)};
 T.load=function(bytes,addr){T.flash.fill(0xFF);for(let i=0;i<bytes.length;i++){const a=(addr||0x08000000)+i-0x08000000;if(a>=0&&a<65536)T.flash[a]=bytes[i]}};
 // ---- memory
 T.rd=function(a,n){a>>>=0;
  if(a>=0x20000000&&a<0x20005000){const o=a-0x20000000;return n==4?(T.ram[o]|T.ram[o+1]<<8|T.ram[o+2]<<16|T.ram[o+3]<<24)>>>0:n==2?T.ram[o]|T.ram[o+1]<<8:T.ram[o]}
  if((a>=0x08000000&&a<0x08010000)||a<0x10000){const o=a&0xFFFF;return n==4?(T.flash[o]|T.flash[o+1]<<8|T.flash[o+2]<<16|T.flash[o+3]<<24)>>>0:n==2?T.flash[o]|T.flash[o+1]<<8:T.flash[o]}
  if(a>=0x40000000||a>=0xE0000000)return T.prd(a,n);
  T.fault('Bus fault: read from 0x'+a.toString(16));return 0};
 T.wr=function(a,n,v){a>>>=0;
  if(a>=0x20000000&&a<0x20005000){const o=a-0x20000000;T.ram[o]=v;if(n>1){T.ram[o+1]=v>>8;if(n>2){T.ram[o+2]=v>>16;T.ram[o+3]=v>>24}}return}
  if(a>=0x40000000||a>=0xE0000000){T.pwr(a,n,v>>>0);return}
  if((a>=0x08000000&&a<0x08010000)||a<0x10000)return;
  T.fault('Bus fault: write to 0x'+a.toString(16))};
 T.rd32=a=>T.rd(a,4);T.fault=m=>{if(!T.halted)T.halted=m};
 // ---- pending / NVIC
 T.prio=function(e){if(e==1)return-3;if(e==2)return-2;if(e==3)return-1;return e<16?T.shp[e-4]&0xF0:T.ipr[e-16]&0xF0};
 T.level=function(){const e=T.exti,m=e.pr&e.imr;if(m)for(let l=0;l<16;l++)if((m>>l)&1)T.irq(l<5?6+l:l<10?23:40);
  for(let i=0;i<3;i++){const t=T.tim[i];if(t.sr&t.dier&0x1F)T.irq(28+i);const u=T.us[i];if((u.cr1&0x2000)&&(((u.cr1&0x20)&&u.rx.length)||(u.cr1&0x80)||((u.cr1&0x40)&&(u.sr&0x40))))T.irq(37+i)}
  if((T.adc.sr&2)&&(T.adc.cr1&0x20))T.irq(18);T.i2cLevel()};
 T.i2cLevel=function(){for(let k=0;k<2;k++){const I=T.i2c[k];if((I.cr2&0x200)&&((I.sr1&0x1F)||((I.cr2&0x400)&&(I.sr1&0xC0))))T.irq(31+2*k);if((I.cr2&0x100)&&(I.sr1&0xF00))T.irq(32+2*k)}};
 T.i2cOn=k=>(T.rcc.apb1&(1<<(21+k)))!=0;
 T.raise=function(exc){if(!T.pend.includes(exc))T.pend.push(exc)};
 T.irq=function(n){const w=n>>5,b=1<<(n&31);T.nvPend[w]|=b;};
 T.checkIrq=function(){for(let w=0;w<3;w++){const m=(T.nvPend[w]&T.nvEn[w])>>>0;if(m){const b=31-Math.clz32(m&-m);T.nvPend[w]&=~(1<<b);T.raise(16+w*32+b)}}};
 // ---- GPIO
 T.shadow=[0,1,2].map(()=>new Int32Array(16).fill(-1));
 T.gpioSync=function(p){if(!T.host.gpio)return;const g=T.gp[p],en=(T.rcc.apb2&T.gate[p])!=0,sh=T.shadow[p];
  for(let i=0;i<16;i++){const cfg=(i<8?g.crl>>>(i*4):g.crh>>>((i-8)*4))&15,odr=(g.odr>>i)&1,key=en?(cfg|(odr<<4)|32):0;
   if(sh[i]!==key){sh[i]=key;T.host.gpio(p,i,en?{mode:cfg&3,cnf:cfg>>2,odr}:{mode:0,cnf:1,odr:0})}}};
 T.pinIn=function(p,i){const g=T.gp[p],cfg=(i<8?g.crl>>>(i*4):g.crh>>>((i-8)*4))&15;if(cfg&3)return(g.odr>>i)&1;return T.host.readPin?T.host.readPin(p,i,cfg>>2,(g.odr>>i)&1):0};
 T.prd=function(a,n){
  if(a>=0x40005400&&a<0x40005C00){const k=a>=0x40005800?1:0;return T.i2cOn(k)?T.i2c[k].rd(a&0x3FF)>>>0:0}
  if(a>=0xE000E010&&a<=0xE000E01C){const s=T.st;if(a==0xE000E010){const v=s.ctrl|(s.flag<<16);s.flag=0;return v}if(a==0xE000E014)return s.load;if(a==0xE000E018)return s.val;return 0}
  if(a>=0xE000E400&&a<0xE000E460){let v=0;for(let i=0;i<n;i++)v|=T.ipr[a-0xE000E400+i]<<(8*i);return v>>>0}
  if(a>=0xE000ED18&&a<0xE000ED24){let v=0;for(let i=0;i<n;i++)v|=T.shp[a-0xE000ED18+i]<<(8*i);return v>>>0}
  if(a>=0xE000E100&&a<0xE000E10C)return T.nvEn[(a-0xE000E100)>>2];
  if(a>=0xE000E200&&a<0xE000E20C)return T.nvPend[(a-0xE000E200)>>2];
  if(a==0xE000ED00)return 0x411FC231;
  if(a>=0x40021000&&a<0x40021400){const o=a-0x40021000;return o==0?T.rcc.cr|((T.rcc.cr&1)<<1)|(((T.rcc.cr>>16)&1)<<17)|(((T.rcc.cr>>24)&1)<<25):o==4?(T.rcc.cfgr&~0xC)|((T.rcc.cfgr&3)<<2):o==0x14?T.rcc.ahb:o==0x18?T.rcc.apb2:o==0x1C?T.rcc.apb1:o==0x24?0x0C000000:0}
  if(a>=0x40010800&&a<0x40011400){const p=(a-0x40010800)>>10,o=(a-0x40010800)&0x3FF,g=T.gp[p];if(!(T.rcc.apb2&T.gate[p]))return 0;
   if(o==0)return g.crl>>>0;if(o==4)return g.crh>>>0;if(o==8){let v=0;for(let i=0;i<16;i++)v|=T.pinIn(p,i)<<i;return v}if(o==12)return g.odr;return 0}
  if(a>=0x40010000&&a<0x40010400){const o=a&0xFF;return o==4?T.afio.mapr:o>=8&&o<=0x14?T.afio.exticr[(o-8)>>2]:0}
  if(a>=0x40010400&&a<0x40010800){const o=a&0xFF,e=T.exti;return o==0?e.imr:o==4?e.emr:o==8?e.rtsr:o==0xC?e.ftsr:o==0x14?e.pr:0}
  const ui=a==0x40013800?0:a==0x40004400?1:a==0x40004800?2:-1,ua=a&~0x3FF;
  if(ui>=0||ua==0x40013800||ua==0x40004400||ua==0x40004800){const k=ua==0x40013800?0:ua==0x40004400?1:2,u=T.us[k],o=a&0x3FF;
   if(o==0)return(u.sr&~0x20)|(u.rx.length?0x20:0);if(o==4){return u.rx.length?u.rx.shift():0}if(o==8)return u.brr;if(o==0xC)return u.cr1;if(o==0x10)return u.cr2;if(o==0x14)return u.cr3;return 0}
  if(a>=0x40012400&&a<0x40012800){const o=a&0x3FF,d=T.adc;return o==0?d.sr:o==4?d.cr1:o==8?d.cr2:o==0x34?d.sqr3:o==0x4C?(d.sr&=~2,d.dr):o==0x10?d.smpr2:0}
  const tb=a&~0x3FF,ti=tb==0x40000000?0:tb==0x40000400?1:tb==0x40000800?2:-1;
  if(ti>=0){const o=a&0x3FF,t=T.tim[ti];return o==0?t.cr1:o==0xC?t.dier:o==0x10?t.sr:o==0x24?t.cnt:o==0x28?t.psr:o==0x2C?t.arr:o==0x34?t.ccr[0]:o==0x38?t.ccr[1]:o==0x3C?t.ccr[2]:o==0x40?t.ccr[3]:o==0x18?t.ccmr1:o==0x1C?t.ccmr2:o==0x20?t.ccer:0}
  return 0};
 T.pwr=function(a,n,v){
  if(a>=0x40005400&&a<0x40005C00){const k=a>=0x40005800?1:0;if(T.i2cOn(k))T.i2c[k].wr(a&0x3FF,v);return}
  if(a>=0xE000E010&&a<=0xE000E01C){const s=T.st;if(a==0xE000E010)s.ctrl=v&7;else if(a==0xE000E014)s.load=v&0xFFFFFF;else if(a==0xE000E018){s.val=0;s.flag=0}return}
  if(a>=0xE000E400&&a<0xE000E460){for(let i=0;i<n;i++)T.ipr[a-0xE000E400+i]=(v>>>(8*i))&255;return}
  if(a>=0xE000ED18&&a<0xE000ED24){for(let i=0;i<n;i++)T.shp[a-0xE000ED18+i]=(v>>>(8*i))&255;return}
  if(a>=0xE000E100&&a<0xE000E10C){T.nvEn[(a-0xE000E100)>>2]|=v;return}
  if(a>=0xE000E180&&a<0xE000E18C){T.nvEn[(a-0xE000E180)>>2]&=~v;return}
  if(a>=0xE000E200&&a<0xE000E20C){T.nvPend[(a-0xE000E200)>>2]|=v;return}
  if(a>=0xE000E280&&a<0xE000E28C){T.nvPend[(a-0xE000E280)>>2]&=~v;return}
  if(a==0xE000ED04){if(v&(1<<28))T.raise(14);return}
  if(a>=0x40021000&&a<0x40021400){const o=a-0x40021000,c=T.rcc;if(o==0)c.cr=v;else if(o==4)c.cfgr=v;else if(o==0x14)c.ahb=v;else if(o==0x10){for(let q=0;q<2;q++)if((v>>(21+q))&1)T.i2c[q].init()}else if(o==0x18){c.apb2=v;for(let p=0;p<3;p++)T.gpioSync(p)}else if(o==0x1C)c.apb1=v;return}
  if(a>=0x40010800&&a<0x40011400){const p=(a-0x40010800)>>10,o=(a-0x40010800)&0x3FF,g=T.gp[p];if(!(T.rcc.apb2&T.gate[p]))return;
   if(o==0)g.crl=v;else if(o==4)g.crh=v;else if(o==12)g.odr=v&0xFFFF;else if(o==0x10)g.odr=((g.odr|(v&0xFFFF))&~(v>>>16))&0xFFFF;else if(o==0x14)g.odr&=~(v&0xFFFF);else return;T.gpioSync(p);return}
  if(a>=0x40010000&&a<0x40010400){const o=a&0xFF;if(o==4)T.afio.mapr=v;else if(o>=8&&o<=0x14)T.afio.exticr[(o-8)>>2]=v;return}
  if(a>=0x40010400&&a<0x40010800){const o=a&0xFF,e=T.exti;if(o==0){e.imr=v;T.level()}else if(o==4)e.emr=v;else if(o==8)e.rtsr=v;else if(o==0xC)e.ftsr=v;else if(o==0x10){e.pr|=v&e.imr;T.level()}else if(o==0x14)e.pr&=~v;return}
  const ua=a&~0x3FF;
  if(ua==0x40013800||ua==0x40004400||ua==0x40004800){const k=ua==0x40013800?0:ua==0x40004400?1:2,u=T.us[k],o=a&0x3FF;
   if(o==4){if(u.cr1&8&&u.cr1&0x2000){if(T.host.serial)T.host.serial(k,v&0xFF);if(T.host.uartTx)T.host.uartTx(k,v&0xFF,u.brr)}}else if(o==8)u.brr=v;else if(o==0xC){u.cr1=v;T.level()}else if(o==0x10)u.cr2=v;else if(o==0x14)u.cr3=v;else if(o==0)u.sr=(u.sr&~0x20)|(v&0x20)|0xC0;return}
  if(a>=0x40012400&&a<0x40012800){const o=a&0x3FF,d=T.adc;
   if(o==4){d.cr1=v;T.level()}else if(o==8){d.cr2=v&~(1<<2)&~(1<<3);if((v&1)&&(v&(1<<22))){const ch=d.sqr3&31;d.dr=T.host.analog?T.host.analog(ch)&0xFFF:0;d.sr|=2;d.cr2&=~(1<<22);T.level()}}else if(o==0)d.sr=v;else if(o==0x34)d.sqr3=v;else if(o==0x10)d.smpr2=v;return}
  const tb=a&~0x3FF,ti=tb==0x40000000?0:tb==0x40000400?1:tb==0x40000800?2:-1;
  if(ti>=0){const o=a&0x3FF,t=T.tim[ti];if(o==0)t.cr1=v;else if(o==0xC){t.dier=v;T.level()}else if(o==0x10)t.sr&=v;else if(o==0x14){if(v&1){t.cnt=0;t.sr|=1}}else if(o==0x24)t.cnt=v&0xFFFF;else if(o==0x28)t.psr=v&0xFFFF;else if(o==0x2C)t.arr=v&0xFFFF;
   else if(o==0x34)t.ccr[0]=v&0xFFFF;else if(o==0x38)t.ccr[1]=v&0xFFFF;else if(o==0x3C)t.ccr[2]=v&0xFFFF;else if(o==0x40)t.ccr[3]=v&0xFFFF;else if(o==0x18)t.ccmr1=v;else if(o==0x1C)t.ccmr2=v;else if(o==0x20)t.ccer=v;
   T.pwmSync(ti)}};
 const TP=[[[0,0],[0,1],[0,2],[0,3]],[[0,6],[0,7],[1,0],[1,1]],[[1,6],[1,7],[1,8],[1,9]]];
 T.pwmSync=function(ti){if(!T.host.pwm)return;const t=T.tim[ti];for(let c=0;c<4;c++){const m=c<2?t.ccmr1>>(c*8+4)&7:t.ccmr2>>((c-2)*8+4)&7,en=(t.ccer>>(c*4))&1;
  T.host.pwm(TP[ti][c][0],TP[ti][c][1],(en&&(m==6||m==7)&&(t.cr1&1))?Math.min(1,t.ccr[c]/(t.arr+1)):null)}};
 T.extiIrq=function(){const e=T.exti;for(let l=0;l<16;l++)if((e.pr>>l)&1){T.irq(l<5?6+l:l<10?23:40)}};
 T.setPin=function(){
  for(let i=0;i<16;i++){const sel=(T.afio.exticr[i>>2]>>((i&3)*4))&15;if(sel>2)continue;const g=T.gp[sel],cfg=(i<8?g.crl>>>(i*4):g.crh>>>((i-8)*4))&15;
   if(cfg&3){T.lastIn[i]=-1;continue}const v=T.host.readPin?T.host.readPin(sel,i,cfg>>2,(g.odr>>i)&1):0;
   if(T.lastIn[i]>=0&&T.lastIn[i]!=v){const e=T.exti;if(((e.rtsr>>i)&1&&v)||((e.ftsr>>i)&1&&!v)){if((e.imr>>i)&1){e.pr|=1<<i;T.irq(i<5?6+i:i<10?23:40)}}}T.lastIn[i]=v}};
 T.rxByte=function(k,c){T.us[k].rx.push(c&0xFF);T.level()};
 // ---- time
 T.adv=function(c){T.cy+=c;if(T.evq.length&&T.evq[0].at<=T.cy)T.runEv();const s=T.st;
  if(s.ctrl&1){s.acc+=c;const div=(s.ctrl&4)?1:8;while(s.acc>=div){s.acc-=div;if(s.val==0)s.val=s.load;else{s.val--;if(s.val==0){s.flag=1;if(s.ctrl&2)T.raise(15)}}}}
  for(let i=0;i<3;i++){const t=T.tim[i];if(t.cr1&1){t.acc+=c;const d=t.psr+1;while(t.acc>=d){t.acc-=d;if(t.cnt>=t.arr){t.cnt=0;t.sr|=1;if(t.dier&1)T.irq(28+i)}else t.cnt++;for(let k=0;k<4;k++)if(t.cnt==t.ccr[k]){t.sr|=2<<k;if(t.dier&(2<<k))T.irq(28+i)}
    if(t.ccer&0x1111&&T.host.pwmEdge)for(let k=0;k<4;k++){const m=k<2?(t.ccmr1>>(k*8+4))&7:(t.ccmr2>>((k-2)*8+4))&7;if(((t.ccer>>(k*4))&1)&&(m==6||m==7)){const hi=m==6?t.cnt<t.ccr[k]:t.cnt>=t.ccr[k];if(t.lv[k]!==hi){t.lv[k]=hi;T.host.pwmEdge(TP[i][k][0],TP[i][k][1],hi?1:0)}}else t.lv[k]=null}}}}};
 // ---- exceptions
 T.xpsr=()=>((T.N<<31)|(T.Z<<30)|(T.C<<29)|(T.V<<28)|(1<<24)|((T.it&3)<<25)|((T.it>>2)<<10)|T.ipsr)>>>0;
 T.setx=function(x){T.N=x>>>31;T.Z=(x>>>30)&1;T.C=(x>>>29)&1;T.V=(x>>>28)&1;T.it=((x>>>25)&3)|(((x>>>10)&0x3F)<<2);T.ipsr=x&0x1FF};
 T.enter=function(exc){let sp=T.r[13];sp-=32;const f=[T.r[0],T.r[1],T.r[2],T.r[3],T.r[12],T.r[14],T.r[15],T.xpsr()];for(let i=0;i<8;i++)T.wr(sp+i*4,4,f[i]);
  T.r[13]=sp;T.r[14]=-7;T.act.push(exc);T.ipsr=exc;T.it=0;T.r[15]=T.rd32(exc*4)&~1;T.adv(12)};
 T.exret=function(){let sp=T.r[13];const f=[];for(let i=0;i<8;i++)f.push(T.rd32(sp+i*4)|0);T.r[13]=sp+32;T.r[0]=f[0];T.r[1]=f[1];T.r[2]=f[2];T.r[3]=f[3];T.r[12]=f[4];T.r[14]=f[5];T.r[15]=f[6]&~1;T.setx(f[7]>>>0);T.act.pop();T.adv(12);T.level()};
 T.bx=function(a){if((a>>>0)>=0xFFFFFFF0)T.exret();else T.r[15]=a&~1};
 T.sysclk=function(){const c=T.rcc.cfgr,sw=c&3;let f=8e6;if(sw==2){const mul=Math.min(16,((c>>18)&15)+2);f=((c>>16)&1)?(((c>>17)&1)?4e6:8e6)*mul:4e6*mul}const h=(c>>4)&15;return f/(h<8?1:[2,4,8,16,64,128,256,512][h-8])};
 // ---- ALU helpers
 const cond=c=>{switch(c){case 0:return T.Z;case 1:return!T.Z;case 2:return T.C;case 3:return!T.C;case 4:return T.N;case 5:return!T.N;case 6:return T.V;case 7:return!T.V;case 8:return T.C&&!T.Z;case 9:return!T.C||T.Z;case 10:return T.N==T.V;case 11:return T.N!=T.V;case 12:return!T.Z&&T.N==T.V;case 13:return T.Z||T.N!=T.V;default:return 1}};
 const nz=v=>{T.N=v>>>31;T.Z=v==0?1:0;return v};
 const awc=(a,b,c,s)=>{const u=(a>>>0)+(b>>>0)+c,r=u|0;if(s){T.N=r>>>31;T.Z=r==0?1:0;T.C=u>0xFFFFFFFF?1:0;T.V=((~(a^b)&(a^r))>>>31)}return r};
 let sc=0;
 const shift=(v,ty,n,ci)=>{sc=ci;v|=0;if(n==0)return v;switch(ty){case 0:if(n>32){sc=0;return 0}sc=n==32?v&1:(v>>>(32-n))&1;return n==32?0:v<<n;case 1:if(n>32){sc=0;return 0}sc=(v>>>(n-1))&1;return n==32?0:v>>>n;case 2:if(n>=32){sc=v>>>31;return v>>31}sc=(v>>(n-1))&1;return v>>n;default:n&=31;if(n==0){sc=v>>>31;return v}sc=(v>>>(n-1))&1;return(v>>>n)|(v<<(32-n))}};
 const rrx=(v,ci)=>{sc=v&1;return(v>>>1)|(ci<<31)};
 const sx=(v,b)=>(v<<(32-b))>>(32-b);
 const expand=(i,i3,i8)=>{const x=(i<<11)|(i3<<8)|i8;if((x>>10)==0){switch((x>>8)&3){case 0:return i8;case 1:return(i8<<16)|i8;case 2:return(i8<<24)|(i8<<8);default:return i8*0x01010101|0}}const u=0x80|(x&0x7F),r=x>>7;sc=(((u>>>r)|(u<<(32-r)))>>>31)&1;return((u>>>r)|(u<<(32-r)))|0};
 T.un=function(h,h2,a){T.fault('Unimplemented instruction 0x'+h.toString(16)+(h2>=0?' 0x'+h2.toString(16):'')+' at 0x'+a.toString(16))};
 // ---- step
 T.step=function(){
  if(T.halted)return 0;
  if(T.nvPend[0]|T.nvPend[1]|T.nvPend[2])T.checkIrq();
  if(T.pend.length){let bi=0,bp=1e9;for(let i=0;i<T.pend.length;i++){const e=T.pend[i],p=T.prio(e);if(p<bp||(p==bp&&e<T.pend[bi])){bp=p;bi=i}}
   const cur=T.act.length?T.prio(T.act[T.act.length-1]):256;
   if(bp<cur&&(!T.primask||bp<0)){const e=T.pend.splice(bi,1)[0];T.enter(e);return 12}}
  const r=T.r,pc=r[15]>>>0,h=T.rd(pc,2);let c=1;
  const big=(h>>11)>=0x1D;let h2=-1;if(big)h2=T.rd(pc+2,2);
  const size=big?4:2,pc4=pc+4;
  if(T.it&0xF){const cc=T.it>>4;let ok=cond(cc);
   const adv=()=>{T.it=(T.it&7)==0?0:((T.it&0xE0)|((T.it<<1)&0x1F))};
   if(!ok){r[15]=pc+size;adv();T.adv(1);return 1}
   const inIT=true;try{c=T.exec(h,h2,pc,pc4,size,inIT)}finally{}if((h&0xFF00)!=0xBF00||(h&0xF)==0)adv();T.adv(c);return c}
  c=T.exec(h,h2,pc,pc4,size,false);T.adv(c);return c};
 T.exec=function(h,h2,pc,pc4,size,inIT){const r=T.r,S=!inIT;let c=1;r[15]=pc+size;
  const rg=n=>n==15?(pc4|0):r[n];
  const ldst=(L,n,sg,a,rt)=>{if(L){let v=T.rd(a,n);if(sg)v=n==1?sx(v,8):sx(v,16);if(rt==15){T.bx(v|0)}else r[rt]=v|0;c=2}else{T.wr(a,n,r[rt]);c=2}};
  if(!(size==4)){
   const t=h>>11;
   if(t<3){const rd=h&7,rm=(h>>3)&7,im=(h>>6)&31;let v;if(t==0){v=im?shift(r[rm],0,im,T.C):r[rm];if(im)T.C=sc}else if(t==1){v=shift(r[rm],1,im||32,T.C);T.C=sc}else{v=shift(r[rm],2,im||32,T.C);T.C=sc}
    if(S)nz(v|0);else{}r[rd]=v;return 1}
   if(t==3){const rd=h&7,rn=(h>>3)&7,o=(h>>6)&7,op=(h>>9)&3;let v;if(op==0)v=awc(r[rn],r[o],0,S);else if(op==1)v=awc(r[rn],~r[o],1,S);else if(op==2)v=awc(r[rn],(h>>6)&7,0,S);else v=awc(r[rn],~((h>>6)&7),1,S);r[rd]=v;return 1}
   if(t<8){const rd=(h>>8)&7,i=h&255;if(t==4){r[rd]=i;if(S)nz(i)}else if(t==5)awc(r[rd],~i,1,true);else if(t==6)r[rd]=awc(r[rd],i,0,S);else r[rd]=awc(r[rd],~i,1,S);return 1}
   if((h>>10)==0x10){const op=(h>>6)&15,rd=h&7,rm=(h>>3)&7,a=r[rd],b=r[rm];let v;
    switch(op){case 0:v=a&b;if(S)nz(v);r[rd]=v;break;case 1:v=a^b;if(S)nz(v);r[rd]=v;break;case 2:v=shift(a,0,b&255,T.C);if(S){T.C=sc;nz(v)}r[rd]=v;break;case 3:v=shift(a,1,b&255,T.C);if(S){T.C=sc;nz(v)}r[rd]=v;break;case 4:v=shift(a,2,b&255,T.C);if(S){T.C=sc;nz(v)}r[rd]=v;break;
     case 5:r[rd]=awc(a,b,T.C,S);break;case 6:r[rd]=awc(a,~b,T.C,S);break;case 7:v=shift(a,3,b&255,T.C);if(S){T.C=sc;nz(v)}r[rd]=v;break;case 8:nz(a&b);break;case 9:r[rd]=awc(0,~b,1,S);break;case 10:awc(a,~b,1,true);break;case 11:awc(a,b,0,true);break;
     case 12:v=a|b;if(S)nz(v);r[rd]=v;break;case 13:v=Math.imul(a,b);if(S)nz(v);r[rd]=v;break;case 14:v=a&~b;if(S)nz(v);r[rd]=v;break;default:v=~b;if(S)nz(v);r[rd]=v}return 1}
   if((h>>10)==0x11){const op=(h>>8)&3,rm=(h>>3)&15;if(op==3){const t2=r[rm];if(h&0x80)r[14]=(pc+2)|1;T.bx(t2);return 3}const rd=(h&7)|((h>>4)&8);
    if(op==0){const v=rg(rd)+rg(rm)|0;if(rd==15)T.bx(v);else r[rd]=v;return rd==15?3:1}if(op==1){awc(rg(rd),~rg(rm),1,true);return 1}const v=rg(rm);if(rd==15)T.bx(v);else r[rd]=v;return rd==15?3:1}
   if(t==9){r[(h>>8)&7]=T.rd32(((pc4&~3)+((h&255)<<2))>>>0)|0;return 2}
   if((h>>12)==5){const o=(h>>9)&7,rm=(h>>6)&7,rn=(h>>3)&7,rt=h&7,a=(r[rn]+r[rm])>>>0;switch(o){case 0:ldst(0,4,0,a,rt);break;case 1:ldst(0,2,0,a,rt);break;case 2:ldst(0,1,0,a,rt);break;case 3:ldst(1,1,1,a,rt);break;case 4:ldst(1,4,0,a,rt);break;case 5:ldst(1,2,0,a,rt);break;case 6:ldst(1,1,0,a,rt);break;default:ldst(1,2,1,a,rt)}return 2}
   if((h>>13)==3){const B=(h>>12)&1,L=(h>>11)&1,im=(h>>6)&31,rn=(h>>3)&7,rt=h&7;ldst(L,B?1:4,0,(r[rn]+(B?im:im<<2))>>>0,rt);return 2}
   if((h>>12)==8){const L=(h>>11)&1,im=(h>>6)&31,rn=(h>>3)&7,rt=h&7;ldst(L,2,0,(r[rn]+(im<<1))>>>0,rt);return 2}
   if((h>>12)==9){const L=(h>>11)&1,rt=(h>>8)&7;ldst(L,4,0,(r[13]+((h&255)<<2))>>>0,rt);return 2}
   if((h>>12)==10){const rd=(h>>8)&7,i=(h&255)<<2;r[rd]=(h&0x800)?r[13]+i:((pc4&~3)+i)|0;return 1}
   if((h>>12)==11){
    if((h&0xFF00)==0xB000){const i=(h&127)<<2;r[13]=(h&0x80)?r[13]-i:r[13]+i;return 1}
    if((h&0xF500)==0xB100){const rn=h&7,off=(((h>>9)&1)<<6)|(((h>>3)&31)<<1),nzf=(h>>11)&1;if((r[rn]==0)!=!!nzf){r[15]=(pc4+off)|0;return 3}return 1}
    if((h&0xFF00)==0xB200){const rm=(h>>3)&7,rd=h&7,op=(h>>6)&3,v=r[rm];r[rd]=op==0?sx(v,16):op==1?sx(v,8):op==2?v&0xFFFF:v&0xFF;return 1}
    if((h&0xFE00)==0xB400){let sp=r[13];const n=bc(h&255)+((h>>8)&1);sp-=n*4;let a=sp>>>0;for(let i=0;i<8;i++)if((h>>i)&1){T.wr(a,4,r[i]);a+=4}if(h&0x100)T.wr(a,4,r[14]);r[13]=sp;return 1+n}
    if((h&0xFE00)==0xBC00){let a=r[13]>>>0;for(let i=0;i<8;i++)if((h>>i)&1){r[i]=T.rd32(a)|0;a+=4}let pcset=null;if(h&0x100){pcset=T.rd32(a)|0;a+=4}r[13]=a|0;if(pcset!==null){T.bx(pcset);return 4+bc(h&255)}return 1+bc(h&255)}
    if((h&0xFF00)==0xBA00){const rm=(h>>3)&7,rd=h&7,v=r[rm],op=(h>>6)&3;r[rd]=op==0?((v&255)<<24|(v&0xFF00)<<8|(v>>>8)&0xFF00|v>>>24)|0:op==1?(((v&0xFF00FF00)>>>8)|((v&0x00FF00FF)<<8))|0:sx(((v&255)<<8)|((v>>>8)&255),16);return 1}
    if((h&0xFF00)==0xBE00){T.fault('BKPT');return 1}
    if((h&0xFF00)==0xBF00){const m=h&15;if(m){T.it=(((h>>4)&15)<<4)|m;return 1}return 1}
    if((h&0xFFE8)==0xB660){T.primask=(h&0x10)?1:0;return 1}
    T.un(h,-1,pc);return 1}
   if((h>>12)==12){const L=(h>>11)&1,rn=(h>>8)&7;let a=r[rn]>>>0;for(let i=0;i<8;i++)if((h>>i)&1){if(L)r[i]=T.rd32(a)|0;else T.wr(a,4,r[i]);a+=4}if(!L||!((h>>rn)&1))r[rn]=a|0;return 1+bc(h&255)}
   if((h>>12)==13){const cc=(h>>8)&15;if(cc==15){T.raise(11);return 1}if(cc==14){T.un(h,-1,pc);return 1}if(cond(cc)){r[15]=(pc4+(sx(h&255,8)<<1))|0;return 3}return 1}
   if((h>>11)==0x1C){r[15]=(pc4+(sx(h&0x7FF,11)<<1))|0;return 3}
   T.un(h,-1,pc);return 1}
  // ---- 32-bit
  const rn=h&15,rd=(h2>>8)&15,rm=h2&15,hi=h>>11;
  if(hi==0x1D){
   if((h>>9)==0x74&&!(h&0x40)&&(((h>>7)&3)==1||((h>>7)&3)==2)){const L=(h>>4)&1,W=(h>>5)&1,db=((h>>7)&3)==2,list=h2&0xFFFF,n=bc16(list);let a=r[rn]>>>0;if(db)a=(a-n*4)>>>0;const start=a;
    for(let i=0;i<16;i++)if((list>>i)&1){if(L){const v=T.rd32(a)|0;if(i==15)T.bx(v);else r[i]=v}else T.wr(a,4,rg(i));a+=4}
    if(W){r[rn]=db?start|0:a|0}return 2+n}
   if((h>>9)==0x74&&(h&0x40)&&(((h>>8)&1)||((h>>5)&1))){const P=(h>>8)&1,U=(h>>7)&1,W=(h>>5)&1,L=(h>>4)&1,t1=(h2>>12)&15,t2=(h2>>8)&15,im=(h2&255)<<2,b=rn==15?(pc4&~3):r[rn],off=(U?b+im:b-im)|0,ad=(P?off:b)>>>0;
    if(L){r[t1]=T.rd32(ad)|0;r[t2]=T.rd32(ad+4)|0}else{T.wr(ad,4,r[t1]);T.wr(ad+4,4,r[t2])}if(W)r[rn]=off;return 3}
   if(h==0xE8D0&&(h2&0xFFE0)==0xF000){const tb=h2&0x10?2:1,base=rn==15?pc4:r[rn]>>>0,idx=r[rm]>>>0,off=T.rd(base+idx*tb,tb);r[15]=(pc4+off*2)|0;return 4}
   if((h&0xFE00)==0xEA00){const op=(h>>5)&15,s=(h>>4)&1,imm=((h2>>12)&7)<<2|((h2>>6)&3),ty=(h2>>4)&3;let v;
    let b=r[rm];sc=T.C;if(ty==3&&imm==0&&true){}
    const sh=ty==3&&imm==0?rrx(b,T.C):shift(b,ty,imm==0&&ty!=0?32:imm,T.C);const C2=(imm==0&&ty==0)?T.C:sc,a=rg(rn),SS=s&&S?1:s;const setf=s&&!inIT||(s&&inIT&&false);
    const lg=(x)=>{if(s){nz(x);T.C=C2}return x};
    switch(op){case 0:v=a&sh;if(rd==15&&s){nz(v);T.C=C2;return 1}r[rd]=lg(v);break;case 1:r[rd]=lg(a&~sh);break;
     case 2:v=rn==15?sh:(a|sh);r[rd]=lg(v);break;case 3:v=rn==15?~sh:(a|~sh);r[rd]=lg(v);break;case 4:v=a^sh;if(rd==15&&s){nz(v);T.C=C2;return 1}r[rd]=lg(v);break;
     case 8:v=awc(a,sh,0,s);if(rd==15&&s)return 1;r[rd]=v;break;case 10:r[rd]=awc(a,sh,T.C,s);break;case 11:r[rd]=awc(a,~sh,T.C,s);break;
     case 13:v=awc(a,~sh,1,s);if(rd==15&&s)return 1;r[rd]=v;break;case 14:r[rd]=awc(sh,~a,1,s);break;default:T.un(h,h2,pc)}return 1}
   if((h&0xFE50)==0xE850&&false){}
   T.un(h,h2,pc);return 1}
  if(hi==0x1E){
   if(!(h2&0x8000)){
    if(!(h&0x0200)){const op=(h>>5)&15,s=(h>>4)&1,i=(h>>10)&1;sc=T.C;const imm=expand(i,(h2>>12)&7,h2&255),a=rg(rn),C2=((((i<<11)|((h2>>12)&7)<<8|(h2&255))>>10)==0)?T.C:sc;let v;
     const lg=x=>{if(s){nz(x);T.C=C2}return x};
     switch(op){case 0:v=a&imm;if(rd==15&&s){nz(v);T.C=C2;return 1}r[rd]=lg(v);break;case 1:r[rd]=lg(a&~imm);break;case 2:r[rd]=lg(rn==15?imm:(a|imm));break;case 3:r[rd]=lg(rn==15?~imm:(a|~imm));break;
      case 4:v=a^imm;if(rd==15&&s){nz(v);T.C=C2;return 1}r[rd]=lg(v);break;case 8:v=awc(a,imm,0,s);if(rd==15&&s)return 1;r[rd]=v;break;case 10:r[rd]=awc(a,imm,T.C,s);break;case 11:r[rd]=awc(a,~imm,T.C,s);break;
      case 13:v=awc(a,~imm,1,s);if(rd==15&&s)return 1;r[rd]=v;break;case 14:r[rd]=awc(imm,~a,1,s);break;default:T.un(h,h2,pc)}return 1}
    const op=(h>>4)&31,imm12=(((h>>10)&1)<<11)|(((h2>>12)&7)<<8)|(h2&255),a=rg(rn);
    switch(op){case 0:r[rd]=a+imm12|0;break;case 10:r[rd]=a-imm12|0;break;case 4:r[rd]=((h&15)<<12)|(((h>>10)&1)<<11)|(((h2>>12)&7)<<8)|(h2&255);break;case 12:r[rd]=(r[rd]&0xFFFF)|((((h&15)<<12)|(((h>>10)&1)<<11)|(((h2>>12)&7)<<8)|(h2&255))<<16);break;
     case 20:{const lsb=((h2>>12)&7)<<2|((h2>>6)&3),w=(h2&31)+1;r[rd]=sx((r[rn]>>>lsb)&(w>=32?-1:((1<<w)-1)),w);break}
     case 28:{const lsb=((h2>>12)&7)<<2|((h2>>6)&3),w=(h2&31)+1;r[rd]=(r[rn]>>>lsb)&(w>=32?-1:((1<<w)-1));break}
     case 22:{const lsb=((h2>>12)&7)<<2|((h2>>6)&3),msb=h2&31,w=msb-lsb+1,mk=(w>=32?-1:((1<<w)-1))<<lsb,v=rn==15?0:r[rn];r[rd]=(r[rd]&~mk)|((v<<lsb)&mk);break}
     default:T.un(h,h2,pc)}return 1}
   // branches & misc
   if((h2&0xD000)==0x8000){if((h&0x3C0)==0x3C0){// misc control
      if(h==0xF3EF){const sy=h2&255;r[rd]=sy==0x10?T.primask:sy==8||sy==9?r[13]:sy==0?T.xpsr()&0xF8000000:sy==5?T.ipsr:sy==0x14?0:0;return 2}
      if((h&0xFFF0)==0xF380){const sy=h2&255;if(sy==0x10)T.primask=r[rn]&1;else if(sy==8)r[13]=r[rn];return 2}
      if(h==0xF3BF)return 1;T.un(h,h2,pc);return 1}
    const cc=(h>>6)&15;if(cond(cc)){const s=(h>>10)&1,j1=(h2>>13)&1,j2=(h2>>11)&1,im=(s<<20)|(j2<<19)|(j1<<18)|((h&0x3F)<<12)|((h2&0x7FF)<<1);r[15]=(pc4+sx(im,21))|0;return 3}return 1}
   if((h2&0xD000)==0x9000||(h2&0xD000)==0xD000){const s=(h>>10)&1,j1=(h2>>13)&1,j2=(h2>>11)&1,i1=(j1^s)?0:1,i2=(j2^s)?0:1,im=(s<<24)|(i1<<23)|(i2<<22)|((h&0x3FF)<<12)|((h2&0x7FF)<<1);
    if(h2&0x4000)r[14]=(pc+4)|1;r[15]=(pc4+sx(im,25))|0;return 4}
   T.un(h,h2,pc);return 1}
  // 0x1F: load/store, data proc register, multiply, divide
  {
   if((h&0xFE00)==0xF800||(h&0xFE00)==0xF900){
    const sz=(h>>5)&3,L=(h>>4)&1,sg=(h>>8)&1;let rt=(h2>>12)&15,a;
    if(sz==3){T.un(h,h2,pc);return 1}
    if(L&&rn==15){const i=(h2&0xFFF),u=(h>>7)&1;a=((pc4&~3)+(u?i:-i))>>>0}
    else if((h>>7)&1){a=(r[rn]+(h2&0xFFF))>>>0}
    else if(h2&0x800){const P=(h2>>10)&1,U=(h2>>9)&1,W=(h2>>8)&1,i=h2&255,b=r[rn],off=U?i:-i;a=(P?b+off:b)>>>0;if(W||!P)r[rn]=b+off|0;}
    else{const sh=(h2>>4)&3;a=(r[rn]+(r[rm]<<sh))>>>0}
    const n=sz==0?1:sz==1?2:4;
    if(L){let v=T.rd(a,n);if(sg)v=sx(v,n*8);if(rt==15)T.bx(v|0);else r[rt]=v|0;return 2}
    T.wr(a,n,r[rt]);return 2}
   if((h&0xFF80)==0xFB00&&(h2&0xF0)==0){const ra=(h2>>12)&15;if(ra==15)r[rd]=Math.imul(r[rn],r[rm]);else r[rd]=(r[ra]+Math.imul(r[rn],r[rm]))|0;return 1}
   if((h&0xFF80)==0xFB00&&(h2&0xF0)==0x10){const ra=(h2>>12)&15;r[rd]=(r[ra]-Math.imul(r[rn],r[rm]))|0;return 1}
   if((h&0xFFF0)==0xFB90&&(h2&0xF0F0)==0xF0F0){const b=r[rm];r[rd]=b==0?0:(r[rn]==-2147483648&&b==-1?-2147483648:(r[rn]/b)|0);return 8}
   if((h&0xFFF0)==0xFBB0&&(h2&0xF0F0)==0xF0F0){const b=r[rm]>>>0;r[rd]=b==0?0:((r[rn]>>>0)/b)>>>0|0;return 8}
   if((h&0xFFF0)==0xFBA0||(h&0xFFF0)==0xFB80){const sg=(h&0xFFF0)==0xFB80,lo=(h2>>12)&15,hi2=rd;let p=sg?BigInt(r[rn])*BigInt(r[rm]):BigInt(r[rn]>>>0)*BigInt(r[rm]>>>0);r[lo]=Number(BigInt.asIntN(32,p));r[hi2]=Number(BigInt.asIntN(32,p>>32n));return 3}
   if((h&0xFF80)==0xFA00&&(h2&0xF0F0)==0xF000){const ty=(h>>5)&3,s=(h>>4)&1,v=shift(r[rn],ty,r[rm]&255,T.C);if(s){T.C=sc;nz(v|0)}r[rd]=v;return 1}
   if((h&0xFF80)==0xFA00&&(h2&0xF0C0)==0xF080){const op=(h>>4)&7,v=r[rm],ro=((h2>>4)&3)*8,x=ro?((v>>>ro)|(v<<(32-ro))):v,a=(h&0xF)==15?0:r[rn];
    const e=op==0?sx(x&0xFFFF,16):op==1?x&0xFFFF:op==4?sx(x&255,8):op==5?x&255:null;if(e!==null){r[rd]=(a+e)|0;return 1}T.un(h,h2,pc);return 1}
   if(h==0xFA0F||h==0xFA1F||h==0xFA4F||h==0xFA5F){const v=r[rm],ro=((h2>>4)&3)*8,x=ro?((v>>>ro)|(v<<(32-ro))):v;r[rd]=h==0xFA0F?sx(x&0xFFFF,16):h==0xFA1F?x&0xFFFF:h==0xFA4F?sx(x&255,8):x&255;return 1}
   if((h&0xFFF0)==0xFAB0&&(h2&0xF0F0)==0xF080){r[rd]=Math.clz32(r[rm]);return 1}
   if((h&0xFFF0)==0xFA90&&(h2&0xF0F0)==0xF0A0){let v=r[rm],o=0;for(let i=0;i<32;i++)o=(o<<1)|((v>>>i)&1);r[rd]=o;return 1}
   if((h&0xFFF0)==0xFA90&&(h2&0xF0F0)==0xF080){const v=r[rm];r[rd]=((v&255)<<24|(v&0xFF00)<<8|(v>>>8)&0xFF00|v>>>24)|0;return 1}
   if((h&0xFFF0)==0xFA90&&(h2&0xF0F0)==0xF090){const v=r[rm];r[rd]=(((v&0xFF00FF00)>>>8)|((v&0x00FF00FF)<<8))|0;return 1}
   if((h&0xFFF0)==0xFA90&&(h2&0xF0F0)==0xF0B0){const v=r[rm];r[rd]=sx(((v&255)<<8)|((v>>>8)&255),16);return 1}
   T.un(h,h2,pc);return 1}
 };
 const bc=x=>{let n=0;while(x){n+=x&1;x>>=1}return n},bc16=bc;
}
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

module.exports=CM3;
