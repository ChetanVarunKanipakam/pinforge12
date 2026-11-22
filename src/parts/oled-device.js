// ===== OLED (SSD1306) as an I2C device =====
const oledAddr=p=>(parseInt((p.attrs||{})['i2c-address']||'0x3C')||0x3C)&0x7F;
Object.assign(I2CD.oled={},{name:'SSD1306 OLED',vmin:3.0,vmax:5.5,pull:4700,maxHz:400e3,attrs:{color:'white','i2c-address':'0x3C',height:'64',pullups:'on'},
 match:(p,a)=>a==oledAddr(p)?'x':null,start:(p,L)=>{oledStart(L)},write:(p,L,b,t)=>oledWrite(L,b,t),read:()=>0xFF,stop(){},
 ins:(p,a,dis,sel)=>`<span>colour</span>${sel('color',['white','blue','yellow','dual'])}<span>size</span>${sel('height',['64','32'])}<span>I²C address</span>${sel('i2c-address',['0x3C','0x3D'])}<span>wire GND, VCC, SCL and SDA: I2C1 = PB6/PB7 (PB8/PB9 remapped), I2C2 = PB10/PB11</span>`});
// ---- register every sensor in the circuit editor
for(const [ty,sp] of Object.entries(I2CD)){if(!sp.pins)continue;D[ty]={t:sp.wk,i2c:1,lblb:1,pins:sp.pins,box:sp.box};CAT.push([ty,sp.cat,'I²C devices']);DEVDRAW[ty]=t=>sp.svg(t,devPower(t));if(sp.tick)DEVT[ty]=(p,st,t)=>sp.tick(p,st,t);DEVPOS[ty]=[340,200]}
for(const ty of Object.keys(I2CD))if(I2CD[ty].tick&&!DEVT[ty])DEVT[ty]=(p,st,t)=>I2CD[ty].tick(p,st,t);

setInterval(()=>{if(!run)return;for(const p of parts)if(p.type=='oled'){const L=DV[p.id];if(L&&(L.wr!==L.dw||(L.sc&&L.sc.on))){rdraw();return}}},40);
