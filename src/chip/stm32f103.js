/* STM32F103 (Blue Pill, medium density): Cortex-M3 core + memory map + RCC + the F1 peripheral set.
   Memory: 64 KB flash at 0x08000000 (aliased at 0), 20 KB SRAM at 0x20000000. */
function CM3(host){
 const T=new CortexM(host,{flashBase:0x08000000,flashSize:0x10000,flashAlias:0,ramBase:0x20000000,ramSize:0x5000,cpuid:0x411FC231});
 T.gate=[0x4,0x8,0x10];                    // RCC_APB2ENR bits for GPIOA..C
 T.rcc={cr:0x83,cfgr:0,apb2:0,apb1:0,ahb:0x14};
 T.pclk1Div=()=>{const p=(T.rcc.cfgr>>8)&7;return p<4?1:[2,4,8,16][p-4]};
 T.sysclk=function(){const c=T.rcc.cfgr,sw=c&3;let f=8e6;if(sw==2){const mul=Math.min(16,((c>>18)&15)+2);f=((c>>16)&1)?(((c>>17)&1)?4e6:8e6)*mul:4e6*mul}const h=(c>>4)&15;return f/(h<8?1:[2,4,8,16,64,128,256,512][h-8])};
 T.pclk1=()=>T.sysclk()/T.pclk1Div();
 // ---- RCC (clock tree, peripheral clock gates, APB1 reset)
 T.attach({name:'rcc',regions:[[0x40021000,0x40021400]],
  rd(a){const o=a-0x40021000;return o==0?T.rcc.cr|((T.rcc.cr&1)<<1)|(((T.rcc.cr>>16)&1)<<17)|(((T.rcc.cr>>24)&1)<<25):o==4?(T.rcc.cfgr&~0xC)|((T.rcc.cfgr&3)<<2):o==0x14?T.rcc.ahb:o==0x18?T.rcc.apb2:o==0x1C?T.rcc.apb1:o==0x24?0x0C000000:0},
  wr(a,n,v){const o=a-0x40021000,c=T.rcc;if(o==0)c.cr=v;else if(o==4)c.cfgr=v;else if(o==0x14)c.ahb=v;else if(o==0x10){for(let q=0;q<2;q++)if((v>>(21+q))&1)T.i2c[q].init()}else if(o==0x18){c.apb2=v;for(let p=0;p<3;p++)T.gpioSync(p)}else if(o==0x1C)c.apb1=v},
  reset(){T.rcc={cr:0x83,cfgr:0,apb2:0,apb1:0,ahb:0x14}}});
 T.attach(GpioF1(T,{base:0x40010800,ports:3,enabled:p=>(T.rcc.apb2&T.gate[p])!=0}));
 T.attach(ExtiF1(T,{afio:0x40010000,exti:0x40010400,ports:3,irqOf:l=>l<5?6+l:l<10?23:40}));
 T.attach(UsartV1(T,{base:[0x40013800,0x40004400,0x40004800],irq:[37,38,39]}));
 T.attach(AdcF1(T,{base:0x40012400,irq:18}));
 T.attach(TimerGp16(T,{base:[0x40000000,0x40000400,0x40000800],irq:[28,29,30],pins:[[[0,0],[0,1],[0,2],[0,3]],[[0,6],[0,7],[1,0],[1,1]],[[1,6],[1,7],[1,8],[1,9]]]}));
 T.attach(I2CModule(T,{base:[0x40005400,0x40005800],size:0x400,evIrq:[31,33],erIrq:[32,34],enabled:k=>(T.rcc.apb1&(1<<(21+k)))!=0}));
 return T}
