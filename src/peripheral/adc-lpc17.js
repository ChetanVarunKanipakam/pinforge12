/* LPC17xx 12-bit ADC, 8 channels AD0.0-AD0.7 (UM10360 chapter 29).
   AD0CR: SEL[7:0], CLKDIV[15:8], BURST[16], PDN[21], START[26:24].  One conversion takes 65 ADC clocks, ADC clock = PCLK / (CLKDIV + 1) (13 MHz maximum).
   Modelled: software start (START = 001 written while PDN = 1), burst mode over the selected channels (lowest to highest, repeated), AD0DRn / AD0GDR with DONE and OVERRUN,
   AD0STAT, AD0INTEN (reset 0x100 = global DONE), the ADC interrupt, power gating by PCONP and PCLKSEL0, and the PINSEL check (a pin that is not switched to its AD0.n function reads 0).
   Not modelled: hardware start sources (START = 010 to 111: EINT0, CAP0.1, MAT0.1 ...), AD0TRM effects.  The voltage comes from host.analog(channel) as a 12-bit count of 0-3.3 V.
   cfg: {base, irq, on:quiet=>bool, pbit, div:()=>PCLK divider, pins:[[port,pin,function] per channel]} */
function AdcLpc17(T,c){
 const a=T.adc={cr:0,inten:0x100,res:new Uint16Array(8),done:new Uint8Array(8),over:new Uint8Array(8),gres:0,gchn:0,gdone:0,gover:0,trm:0,busy:false,gen:0};
 const sel=()=>a.cr&255,clkdiv=()=>(a.cr>>8)&255,burst=()=>(a.cr>>16)&1,pdn=()=>(a.cr>>21)&1,start=()=>(a.cr>>24)&7;
 const cycles=()=>65*(clkdiv()+1)*c.div();
 const lowest=m=>{for(let i=0;i<8;i++)if((m>>i)&1)return i;return -1};
 const nextSel=ch=>{for(let k=1;k<=8;k++){const i=(ch+k)&7;if((sel()>>i)&1)return i}return -1};
 const adint=()=>(a.inten&0x100)?a.gdone:((a.inten&0xFF)&doneBits())!=0?1:0;
 const doneBits=()=>{let v=0;for(let i=0;i<8;i++)v|=a.done[i]<<i;return v};
 const sample=ch=>{const[p,i,f]=c.pins[ch];
  if(T.pinFn(p,i)!==f){T.diag('adcpin'+ch,'AD0.'+ch+' was converted but P'+p+'.'+i+' is not switched to its ADC function in PINSEL (function '+f+'): the input is disconnected and reads 0');return 0}
  if(T.pinMode(p,i)!==2)T.diag('adcpull'+ch,'P'+p+'.'+i+' is an ADC input with its pull resistor enabled: set its PINMODE bits to 10 (neither pull-up nor pull-down) or the reading is wrong');
  return T.host.analog?(T.host.analog(ch)&0xFFF):0};
 const finish=ch=>{a.busy=false;
  if(a.done[ch])a.over[ch]=1;a.res[ch]=sample(ch);a.done[ch]=1;
  if(a.gdone)a.gover=1;a.gres=a.res[ch];a.gchn=ch;a.gdone=1;
  T.level();
  if(burst()&&pdn()){const n=nextSel(ch);if(n>=0)begin(n)}};
 const begin=ch=>{a.busy=true;const g=++a.gen;T.sched(T.cy+cycles(),()=>{if(a.gen===g)finish(ch)})};
 const control=()=>{
  if(!pdn()){a.gen++;a.busy=false;return}
  const pclk=T.cclk()/c.div(),aclk=pclk/(clkdiv()+1);
  if(aclk>13e6)T.diag('adcclk','ADC clock is '+(aclk/1e6).toFixed(1)+' MHz: it must not exceed 13 MHz, raise CLKDIV in AD0CR');
  if(burst()){
   if(start()!==0)T.diag('adcburst','BURST = 1 needs START = 000');
   else if(!a.busy&&sel()){begin(lowest(sel()))}}
  else if(start()===1){
   if(!sel()){T.diag('adcsel','AD0CR.SEL is 0: no channel selected, nothing is converted');return}
   if(sel()&(sel()-1))T.diag('adcmulti','Several channels are selected without BURST: in software-controlled mode only one SEL bit may be set, the lowest one is converted');
   a.gen++;begin(lowest(sel()))}
  else if(start()>1)T.diag('adcstart','AD0CR.START = '+start()+': hardware start sources (EINT0, CAP0.1, MAT0.x) are not modelled, use 001 (start now) or BURST')};
 return{name:'adc',regions:[[c.base,c.base+0x1000]],
  rd(x){if(!c.on())return 0;const o=x-c.base;
   if(o==0)return a.cr;
   if(o==4){const v=((a.gres<<4)|(a.gchn<<24)|(a.gover<<30)|(a.gdone<<31))>>>0;a.gdone=0;a.gover=0;T.level();return v}
   if(o==0xC)return a.inten;
   if(o>=0x10&&o<=0x2C){const n=(o-0x10)>>2,v=((a.res[n]<<4)|(a.over[n]<<30)|(a.done[n]<<31))>>>0;a.done[n]=0;a.over[n]=0;T.level();return v}
   if(o==0x30){let ov=0;for(let i=0;i<8;i++)ov|=a.over[i]<<i;return(doneBits()|(ov<<8)|(adint()<<16))>>>0}
   if(o==0x34)return a.trm;return 0},
  wr(x,n,v){if(!c.on())return;const o=x-c.base;
   if(o==0){a.cr=v&0x0F3FFFFF;a.gdone=0;a.gover=0;control();T.level()}
   else if(o==0xC){a.inten=v&0x1FF;T.level()}else if(o==0x34)a.trm=v},
  reset(){a.cr=0;a.inten=0x100;a.res.fill(0);a.done.fill(0);a.over.fill(0);a.gres=a.gchn=a.gdone=a.gover=0;a.trm=0;a.busy=false;a.gen++},
  level(){if(c.on(true)&&adint())T.irq(c.irq)}}}
