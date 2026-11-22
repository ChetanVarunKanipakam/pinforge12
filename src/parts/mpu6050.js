// ===== MPU-6050 (GY-521) =====
function mpuReset(st){st.r=new Uint8Array(256);st.r[0x6B]=0x40;st.r[0x75]=0x68;st.wake=-1;st.latch=false;st.nextS=0}
function mpuSnap(p,st,t){const r=st.r;if(r[0x6B]&0x40)return;const fa=(r[0x1C]>>3)&3,fg=(r[0x1B]>>3)&3,la=[16384,8192,4096,2048][fa],lg=[131,65.5,32.8,16.4][fg],w=t-st.wake;
 const put=(a,v)=>{v=clamp(Math.round(v),-32768,32767);r[a]=(v>>8)&255;r[a+1]=v&255};
 const aok=w>=0.02,gok=w>=0.035;
 put(0x3B,aok?sv(p,'ax',0)*la:0);put(0x3D,aok?sv(p,'ay',0)*la:0);put(0x3F,aok?sv(p,'az',1)*la:0);
 put(0x41,(r[0x6B]&8)?0:(sv(p,'temp',25)-36.53)*340);
 put(0x43,gok?sv(p,'gx',0)*lg:0);put(0x45,gok?sv(p,'gy',0)*lg:0);put(0x47,gok?sv(p,'gz',0)*lg:0)}
const mpuTs=st=>{const r=st.r,rate=((r[0x1A]&7)>=1&&(r[0x1A]&7)<=6)?1000:8000;return(1+r[0x19])/rate};
I2CD.mpu6050=regDev({name:'MPU-6050',vmin:3.0,vmax:5.5,pull:4700,maxHz:400e3,attrs:{ax:'0',ay:'0',az:'1',gx:'0',gy:'0',gz:'0',temp:'25'},
 state:()=>{const st={};mpuReset(st);return st},
 match:(p,a)=>a==(lvl(p.id+':AD0')===1?0x69:0x68)?'x':null,
 rreg(p,st,a,t){mpuSnap(p,st,t);if(a==0x3A){const v=st.r[0x3A]|(st.latch?1:0);st.latch=false;st.nextS=t+mpuTs(st);st.r[0x3A]=0;return v}return st.r[a]},
 wreg(p,st,a,v,t){const r=st.r;if((a>=0x3B&&a<=0x48)||a==0x75||a==0x3A)return;
  if(a==0x6B){if(v&0x80){mpuReset(st);return}const was=r[0x6B]&0x40;r[a]=v;if(was&&!(v&0x40))st.wake=t;if(!was&&(v&0x40))st.wake=-1;return}
  if(a==0x68){return}r[a]=v},
 tick(p,st,t){const pw=devPower(p);const o=I2CD.mpu6050.drive(p,st,'INT',t);if(st.lo!==o){st.lo=o;drvDirty()}if(pw.on&&(st.r[0x38]&1)&&!(st.r[0x6B]&0x40)&&!st.latch&&t>=st.nextS)st.latch=true},
 drive(p,st,pin,t){if(pin!='INT'||!devPower(p).on)return null;const r=st.r;if(!(r[0x38]&1)||(r[0x6B]&0x40)||st.wake<0)return(r[0x37]&0x80)?1:0;
  const act=(r[0x37]&0x80)?0:1;let on;if(r[0x37]&0x20)on=st.latch;else{const Ts=mpuTs(st);on=((t-st.wake)%Ts)<200e-6}return on?act:1-act},
 ins:(p)=>numIn(p,'ax','accel X',-16,16,.01,0,'g')+numIn(p,'ay','accel Y',-16,16,.01,0,'g')+numIn(p,'az','accel Z',-16,16,.01,1,'g')+numIn(p,'gx','gyro X',-2000,2000,1,0,'°/s')+numIn(p,'gy','gyro Y',-2000,2000,1,0,'°/s')+numIn(p,'gz','gyro Z',-2000,2000,1,0,'°/s')+numIn(p,'temp','temperature',-40,85,.1,25,'°C')+`<span>AD0 to VCC = 0x69, else 0x68. The chip starts in sleep: write 0 to PWR_MGMT_1 (0x6B). Accel needs 20 ms and gyro 35 ms after wake-up.</span>`,
 svg:(p,pw)=>{const id=p.id;return svPcb(id,-20,-12,180,142,'#1c58c4','#123f95')+svHole(-8,116)+svChip(54,44,34,34,'MPU-','6050')+svSmd(8,38,10,5,'662K')+svSmd(8,50,6,4,'')+svSmd(26,34,7,4,'')+svSmd(26,50,7,4,'')+svSmd(100,40,10,5,'472')+svSmd(100,52,10,5,'472')+svSmd(100,66,7,4,'')+svLed(128,34,pw.on)+svHdr(['VCC','GND','SCL','SDA','XDA','XCL','AD0','INT'])+svStatus(70,108,pw.on?(devOf(p).r[0x6B]&0x40?'sleeping (PWR_MGMT_1 = 0x40)':''):(pw.burnt?'destroyed':'no power'))},
 box:[-20,-12,180,142],pins:{VCC:[0,0],GND:[20,0],SCL:[40,0],SDA:[60,0],XDA:[80,0],XCL:[100,0],AD0:[120,0],INT:[140,0]},cat:'MPU-6050 accel/gyro (I²C)',wk:'wokwi-mpu6050'});
