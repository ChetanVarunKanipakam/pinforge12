/* GPIO, STM32F1 layout (CRL/CRH/IDR/ODR/BSRR/BRR). cfg: {base, ports, enabled:p=>bool} */
function GpioF1(T,c){
 T.gp=[...Array(c.ports).keys()].map(()=>({crl:0x44444444,crh:0x44444444,odr:0}));
 T.shadow=[...Array(c.ports).keys()].map(()=>new Int32Array(16).fill(-1));
 const cfgOf=(g,i)=>(i<8?g.crl>>>(i*4):g.crh>>>((i-8)*4))&15;
 T.gpioSync=function(p){if(!T.host.gpio)return;const g=T.gp[p],en=c.enabled(p),sh=T.shadow[p];
  for(let i=0;i<16;i++){const cfg=cfgOf(g,i),odr=(g.odr>>i)&1,key=en?(cfg|(odr<<4)|32):0;
   if(sh[i]!==key){sh[i]=key;T.host.gpio(p,i,en?{mode:cfg&3,cnf:cfg>>2,odr}:{mode:0,cnf:1,odr:0})}}};
 T.pinIn=function(p,i){const g=T.gp[p],cfg=cfgOf(g,i);if(cfg&3)return(g.odr>>i)&1;return T.host.readPin?T.host.readPin(p,i,cfg>>2,(g.odr>>i)&1):0};
 return{name:'gpio',regions:[[c.base,c.base+0x400*c.ports]],
  rd(a){const p=(a-c.base)>>10,o=(a-c.base)&0x3FF,g=T.gp[p];if(!c.enabled(p))return 0;
   if(o==0)return g.crl>>>0;if(o==4)return g.crh>>>0;if(o==8){let v=0;for(let i=0;i<16;i++)v|=T.pinIn(p,i)<<i;return v}if(o==12)return g.odr;return 0},
  wr(a,n,v){const p=(a-c.base)>>10,o=(a-c.base)&0x3FF,g=T.gp[p];if(!c.enabled(p))return;
   if(o==0)g.crl=v;else if(o==4)g.crh=v;else if(o==12)g.odr=v&0xFFFF;else if(o==0x10)g.odr=((g.odr|(v&0xFFFF))&~(v>>>16))&0xFFFF;else if(o==0x14)g.odr&=~(v&0xFFFF);else return;T.gpioSync(p)},
  reset(){T.gp.forEach(g=>{g.crl=g.crh=0x44444444;g.odr=0});T.shadow.forEach(x=>x.fill(-1))},
  post(){for(let p=0;p<c.ports;p++)T.gpioSync(p)}}}
