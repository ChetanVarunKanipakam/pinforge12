// ===== BH1750 (GY-302) =====
function bhStep(p,st,t){if(st.meas&&t>=st.meas.end){const lux=sv(p,'lux',100),k=st.meas.h2?2.4:1.2,raw=clamp(Math.round(lux*k*(st.mt/69)),0,65535);st.raw=raw;if(st.meas.once){st.meas=null;st.on=false}else st.meas={end:t+bhTm(st,st.meas.low),h2:st.meas.h2,low:st.meas.low,once:false}}}
const bhTm=(st,low)=>(low?0.016:0.12)*(st.mt/69);
I2CD.bh1750={name:'BH1750',vmin:3.0,vmax:5.5,pull:10000,maxHz:400e3,attrs:{lux:'100'},
 state:()=>({on:false,mt:69,raw:0,meas:null,rd:0}),
 match:(p,a)=>a==(lvl(p.id+':ADDR')===1?0x5C:0x23)?'x':null,
 start:(p,st,rw,t)=>{bhStep(p,st,t);st.rd=0;return true},
 write(p,st,b,t){bhStep(p,st,t);
  if(b==0x00){st.on=false;st.meas=null;return true}if(b==0x01){st.on=true;return true}if(b==0x07){if(st.on)st.raw=0;return true}
  if((b&0xF8)==0x40){st.mt=clamp((st.mt&0x1F)|((b&7)<<5),31,254);return true}if((b&0xE0)==0x60){st.mt=clamp((st.mt&0xE0)|(b&0x1F),31,254);return true}
  const once=(b&0xF0)==0x20,cont=(b&0xF0)==0x10,m=b&0x0F;if((once||cont)&&(m==0||m==1||m==3)){st.on=true;const low=m==3;st.meas={end:t+bhTm(st,low),h2:m==1,low,once};return true}
  return false},
 read(p,st,ack,t){bhStep(p,st,t);const v=st.rd==0?(st.raw>>8)&255:st.raw&255;st.rd++;return v},stop(){},
 ins:p=>numIn(p,'lux','light',0,100000,1,100,'lux')+`<span>ADDR pin high = 0x5C, else 0x23. Commands: 0x10 continuous high-res, 0x11 high-res2, 0x13 low-res, 0x20/0x21/0x23 one-time. A high-res measurement takes 120 ms.</span>`,
 svg:(p,pw)=>{const id=p.id;return svPcb(id,-20,-12,120,140,'#7a3aa0','#55267a')+svHole(-8,116)+svHole(88,116)+`<rect x="22" y="36" width="38" height="30" rx="3" fill="#15161a" stroke="#34363d"/><rect x="28" y="42" width="26" height="18" rx="2" fill="#e8eef5" opacity=".9"/><rect x="31" y="45" width="20" height="12" rx="1.5" fill="#8fb3d1" opacity=".7"/><text x="41" y="78" fill="#d8c8e8" font-size="5.5" text-anchor="middle" font-family="monospace">BH1750</text>`+svSmd(70,38,9,5,'472')+svSmd(70,50,9,5,'472')+svSmd(70,62,8,4,'')+svLed(76,92,pw.on)+svHdr(['VCC','GND','SCL','SDA','ADDR'])+svStatus(40,106,pw.on?'':(pw.burnt?'destroyed':'no power'))},
 box:[-20,-12,120,140],pins:{VCC:[0,0],GND:[20,0],SCL:[40,0],SDA:[60,0],ADDR:[80,0]},cat:'BH1750 light sensor (I²C)',wk:'board-bh1750'};
