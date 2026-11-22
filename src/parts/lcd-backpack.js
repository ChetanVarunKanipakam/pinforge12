// ===== LCD 1602 + PCF8574 backpack (typical "I2C LCD") =====
const LCDI2P=['GND','VCC','SDA','SCL'];
I2CD.lcdi2c={name:'LCD1602 I2C backpack (PCF8574)',vmin:2.5,vmax:6,pull:4700,maxHz:100e3,attrs:{'i2c-address':'0x27',pullups:'on'},
 state:()=>{const L=lcdNew();L.port=0xFF;L.ein=0;L.bl=1;return L},
 match:(p,a)=>a==(parseInt((p.attrs||{})['i2c-address']||'0x27')&0x7F)?'x':null,
 start:()=>true,
 write(p,L,b){L.pw=devPower(p).v>=4.5;L.port=b;const E=(b>>2)&1;if(L.ein&&!E&&!((b>>1)&1))lcdBus(L,b&1,b&0xF0);L.ein=E;L.bl=(b>>3)&1;return true},
 read:(p,L)=>L.port,stop(){},
 ins:(p,a,dis,sel)=>`<span>I²C address</span>${sel('i2c-address',['0x27','0x3F','0x20','0x38'])}<span>The PCF8574 is limited to 100 kHz. P0=RS P1=RW P2=E P3=backlight P4-P7=D4-D7. The LCD needs 5 V to show anything (the expander itself works from 2.5 V).</span>`,
 svg:(p,pw)=>{const L=devOf(p);L.pw=pw.v>=4.5&&pw.on;let h=lcdDraw(p,L,L.bl!=0,[],pw.on?'LCD1602 I2C · needs 5 V on VCC':'LCD1602 I2C · not powered (VCC 5V, GND)');
  h+=`<rect x="-12" y="-6" width="84" height="12" rx="1.5" fill="#15161a"/>`+LCDI2P.map((n,i)=>`<path d="M${i*20} -6V-14" stroke="#9aa0a8" stroke-width="2.4"/><text x="${i*20}" y="-17" fill="#eaf6ee" font-size="7.4" font-weight="700" text-anchor="middle" font-family="monospace">${n}</text>`).join('');return h},
 box:[-24,-134,368,148],pins:{GND:[0,0],VCC:[20,0],SDA:[40,0],SCL:[60,0]},cat:'LCD 16×2 with I²C backpack (PCF8574)',wk:'wokwi-lcd1602',noLbl:true};
