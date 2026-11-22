// ===== BMP280 / BME280 =====
const BMC={T1:27504,T2:26435,T3:-1000,P1:36477,P2:-10685,P3:3024,P4:2855,P5:140,P6:-7,P7:15500,P8:-14600,P9:6000,H1:75,H2:362,H3:0,H4:314,H5:50,H6:30};
function bmFwdT(c,adc){const v1=(adc/16384-c.T1/1024)*c.T2,v2=((adc/131072-c.T1/8192)*(adc/131072-c.T1/8192))*c.T3,tf=v1+v2;return{tf,T:tf/5120}}
function bmFwdP(c,adc,tf){let v1=tf/2-64000,v2=v1*v1*c.P6/32768;v2+=v1*c.P5*2;v2=v2/4+c.P4*65536;v1=(c.P3*v1*v1/524288+c.P2*v1)/524288;v1=(1+v1/32768)*c.P1;if(!v1)return 0;let p=1048576-adc;p=(p-v2/4096)*6250/v1;v1=c.P9*p*p/2147483648;v2=p*c.P8/32768;return p+(v1+v2+c.P7)/16}
function bmFwdH(c,adc,tf){let h=tf-76800;h=(adc-(c.H4*64+c.H5/16384*h))*(c.H2/65536*(1+c.H6/67108864*h*(1+c.H3/67108864*h)));h=h*(1-c.H1*h/524288);return clamp(h,0,100)}
const bisect=(f,lo,hi,target,inc)=>{for(let i=0;i<40;i++){const m=(lo+hi)/2,v=f(m);if((v<target)===inc)lo=m;else hi=m}return Math.round((lo+hi)/2)};
function bmCalib(st){const c=BMC,r=st.r,w=(a,v)=>{r[a]=v&255;r[a+1]=(v>>8)&255};w(0x88,c.T1);w(0x8A,c.T2);w(0x8C,c.T3);w(0x8E,c.P1);w(0x90,c.P2);w(0x92,c.P3);w(0x94,c.P4);w(0x96,c.P5);w(0x98,c.P6);w(0x9A,c.P7);w(0x9C,c.P8);w(0x9E,c.P9);
 if(st.bme){r[0xA1]=c.H1;w(0xE1,c.H2);r[0xE3]=c.H3;r[0xE4]=(c.H4>>4)&255;r[0xE5]=(c.H4&15)|((c.H5&15)<<4);r[0xE6]=(c.H5>>4)&255;r[0xE7]=c.H6}}
function bmReset(st){st.r=new Uint8Array(256);const r=st.r;r[0xD0]=st.bme?0x60:0x58;r[0xF7]=0x80;r[0xFA]=0x80;if(st.bme){r[0xFD]=0x80}bmCalib(st);st.meas=null;st.prev=null;st.nextAt=0}
const bmOs=v=>v?(v>=5?16:1<<(v-1)):0;
function bmTmeas(st){const r=st.r,ot=bmOs((r[0xF4]>>5)&7),op=bmOs((r[0xF4]>>2)&7),oh=st.bme?bmOs(r[0xF2]&7):0;return(1+(ot?2*ot:0)+(op?2*op+.5:0)+(oh?2*oh+.5:0))/1000}
function bmTsb(st){const i=(st.r[0xF5]>>5)&7;return(st.bme?[.5,62.5,125,250,500,1000,10,20]:[.5,62.5,125,250,500,1000,2000,4000])[i]/1000}
function bmSample(p,st){const r=st.r,c=BMC,Tt=sv(p,'temp',25),Pt=sv(p,'pres',1013.25)*100,Ht=sv(p,'hum',50),filt=(r[0xF5]>>2)&7,coef=[1,2,4,8,16,16,16,16][filt];
 const ot=(r[0xF4]>>5)&7,op=(r[0xF4]>>2)&7,oh=st.bme?r[0xF2]&7:0;let rt=0x80000,rp=0x80000,rh=0x8000;
 const aT=bisect(a=>bmFwdT(c,a).T,0,1048575,Tt,true),tf=bmFwdT(c,aT).tf;
 if(ot)rt=aT;if(op)rp=bisect(a=>bmFwdP(c,a,tf),0,1048575,Pt,false);if(st.bme&&oh)rh=bisect(a=>bmFwdH(c,a,tf),0,65535,Ht,true);
 if(st.prev&&filt){const f=(o,n)=>Math.round((o*(coef-1)+n)/coef);if(ot)rt=f(st.prev.t,rt);if(op)rp=f(st.prev.p,rp)}
 st.prev={t:rt,p:rp};
 const q=(v,os)=>{if(filt||!os)return v;const d=5-Math.min(os,5);return(v>>d)<<d};   // without the IIR filter the resolution is 15 + osrs bits
 const qt=ot?q(rt,ot):rt,qp=op?q(rp,op):rp;
 r[0xF7]=(qp>>12)&255;r[0xF8]=(qp>>4)&255;r[0xF9]=(qp&15)<<4;r[0xFA]=(qt>>12)&255;r[0xFB]=(qt>>4)&255;r[0xFC]=(qt&15)<<4;if(st.bme){r[0xFD]=(rh>>8)&255;r[0xFE]=rh&255}}
function bmStep(p,st,t){const r=st.r;
 if(st.meas&&t>=st.meas.end){bmSample(p,st);if(st.meas.forced)r[0xF4]&=~3;else st.nextAt=st.meas.end+bmTsb(st);st.meas=null}
 if(!st.meas){const mode=r[0xF4]&3;
  if(st.force&&(mode==1||mode==2)){st.force=false;st.meas={end:t+bmTmeas(st),forced:true}}
  else if(mode==3&&t>=st.nextAt)st.meas={end:t+bmTmeas(st),forced:false}}
 r[0xF3]=(st.meas?8:0)|(t<0.002?1:0)}
const bmDev=bme=>regDev({name:bme?'BME280':'BMP280',vmin:1.71,vmax:3.6,vmaxOf:p=>(p.attrs||{}).regulator=='yes'?5.5:3.6,pull:10000,maxHz:3.4e6,attrs:{temp:'25',pres:'1013.25',hum:'50',regulator:'no',pullups:'on'},
 state:()=>{const st={bme};bmReset(st);return st},
 match:(p,a)=>{if(lvl(p.id+':CSB')===0)return null;return a==(lvl(p.id+':SDO')===1?0x77:0x76)?'x':null},
 rreg(p,st,a,t){bmStep(p,st,t);return st.r[a]},
 wreg(p,st,a,v,t){bmStep(p,st,t);const r=st.r;
  if(a==0xE0){if(v==0xB6)bmReset(st);return}
  if(a==0xF4){const was=r[a]&3;r[a]=v;if((v&3)==1||(v&3)==2)st.force=true;bmStep(p,st,t);return}
  if(a==0xF2&&st.bme){r[a]=v&7;return}
  if(a==0xF5){r[a]=v&0xFC;return}},
 ins:p=>numIn(p,'temp','temperature',-40,85,.01,25,'°C')+numIn(p,'pres','pressure',300,1100,.01,1013.25,'hPa')+(bme?numIn(p,'hum','humidity',0,100,.1,50,'%RH'):'')+`<span>supply</span><select data-a="regulator"><option value="no"${(p.attrs||{}).regulator=='yes'?'':' selected'}>3.3 V only (GY module)</option><option value="yes"${(p.attrs||{}).regulator=='yes'?' selected':''}>has 5 V regulator</option></select><span>SDO high = 0x77, low or open = 0x76. CSB low would select SPI. Starts in sleep: write ctrl_meas (0xF4).</span>`,
 svg:(p,pw)=>{const id=p.id,c1=bme?'#2c62b8':'#6d2f93',c2=bme?'#1d4690':'#4b1f69';
  return svPcb(id,-20,-12,140,170,c1,c2)+svHole(-8,146)+svHole(108,146)+`<rect x="34" y="40" width="30" height="34" rx="2.5" fill="url(#bg${id})" stroke="#707780"/><defs><linearGradient id="bg${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5e8ec"/><stop offset=".5" stop-color="#b7bcc4"/><stop offset="1" stop-color="#8f959e"/></linearGradient></defs><circle cx="42" cy="48" r="2.4" fill="#4b4f56"/><text x="49" y="66" fill="#555a62" font-size="5.5" text-anchor="middle" font-family="monospace">${bme?'BME280':'BMP280'}</text>`+svSmd(76,38,8,4,'103')+svSmd(76,50,8,4,'103')+svSmd(8,38,8,4,'')+svSmd(8,50,8,4,'')+svLed(88,100,pw.on)+svHdr(['VCC','GND','SCL','SDA','CSB','SDO'])+svStatus(50,132,pw.on?'':(pw.burnt?'destroyed (5 V on a 3.3 V part)':'no power'))},
 box:[-20,-12,140,170],pins:{VCC:[0,0],GND:[20,0],SCL:[40,0],SDA:[60,0],CSB:[80,0],SDO:[100,0]},cat:bme?'BME280 temp/humidity/pressure (I²C)':'BMP280 temp/pressure (I²C)',wk:bme?'board-bme280':'board-bmp280'});
I2CD.bmp280=bmDev(false);I2CD.bme280=bmDev(true);

