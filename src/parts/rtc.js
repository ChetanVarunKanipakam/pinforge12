// ===== real-time clock core shared by DS3231 and DS1307: fields are stored independently, like the counters in the chip =====
const dayNum=f=>Math.floor(Date.UTC(f.y,f.mo-1,f.dt)/864e5);
function rtcGet(st,t){if(st.halt||t-st.t0<1)return st.f;const e=Math.floor(t-st.t0),o=dayNum(st.f),f=rtcFields(rtcMs(st.f)+e*1000);st.dow=((st.dow-1+(dayNum(f)-o))%7+7)%7+1;st.f=f;st.t0+=e;return st.f}
function rtcInit(st,p,t,ms){st.f=rtcFields(ms);st.dow=new Date(ms).getUTCDay()+1;st.t0=t}
function rtcRd(st,t,a,cent){const f=rtcGet(st,t);switch(a){case 0:return bcd(f.s);case 1:return bcd(f.m);case 2:return st.h12?(0x40|(f.h>=12?0x20:0)|bcd(f.h%12||12)):bcd(f.h);case 3:return st.dow;case 4:return bcd(f.dt);case 5:return bcd(f.mo)|(cent&&f.y>=2100?0x80:0);case 6:return bcd(f.y%100)}return 0}
function rtcPut(st,t,a,v,cent){const f=rtcGet(st,t);switch(a){case 0:f.s=clamp(unbcd(v&0x7F),0,59);st.t0=t;break;case 1:f.m=clamp(unbcd(v&0x7F),0,59);break;
 case 2:st.h12=!!(v&0x40);f.h=st.h12?((unbcd(v&0x1F)%12)+((v&0x20)?12:0)):clamp(unbcd(v&0x3F),0,23);break;case 3:st.dow=(v&7)||1;break;case 4:f.dt=clamp(unbcd(v&0x3F),1,31);break;
 case 5:f.mo=clamp(unbcd(v&0x1F),1,12);break;case 6:f.y=(cent&&f.y>=2100?2100:2000)+unbcd(v)}}
const rtcStart=(p,t)=>{const s=((p.attrs||{}).start||'').trim(),d=s?Date.parse(s.replace(' ','T')+'Z'):NaN;return isNaN(d)?Math.floor(Date.now()/1000)*1000:d};
function dsAlarm(st,f,base,hasSec){const r=st.r,m=i=>(r[base+i]&0x80)!=0,o=hasSec?0:-1,chk=[];
 if(hasSec)chk.push([m(0),unbcd(r[base]&0x7F)==f.s]);chk.push([m(1+o),unbcd(r[base+1+o]&0x7F)==f.m]);
 const hr=r[base+2+o];chk.push([m(2+o),(hr&0x40?((unbcd(hr&0x1F)%12)+((hr&0x20)?12:0)):unbcd(hr&0x3F))==f.h]);
 const dr=r[base+3+o];chk.push([m(3+o),(dr&0x40)?st.dow==(dr&15):unbcd(dr&0x3F)==f.dt]);return chk.every(([mask,eq])=>mask||eq)}
function dsStep(st,t){const f=rtcGet(st,t),sig=f.s+':'+f.m+':'+f.h+':'+f.dt+':'+f.mo+':'+f.y;if(st.sig===sig)return;st.sig=sig;
 if(dsAlarm(st,f,0x07,true))st.r[0x0F]|=1;if(f.s==0&&dsAlarm(st,f,0x0B,false))st.r[0x0F]|=2}
// ===== DS3231 (ZS-042 module: RTC at 0x68 + AT24C32 EEPROM at 0x57) =====
I2CD.ds3231=(()=>{const spec=EEV['24C32'],mem=p=>{if(!p.mem||p.mem.length!=spec.size)p.mem=new Array(spec.size).fill(0xFF);return p.mem},eeAddr=p=>parseInt((p.attrs||{}).eeaddr||'0x57')||0x57;
 const rtc=regDev({rreg(p,st,a,t){dsStep(st,t);if(a<7)return rtcRd(st,t,a,true);
   if(a==0x11||a==0x12){const T=sv(p,'temp',25),q=Math.floor(T*4)/4,i=Math.floor(q);return a==0x11?(i&255):(Math.round((q-i)*4)<<6)}
   return st.r[a]},
  wreg(p,st,a,v,t){dsStep(st,t);if(a<7){rtcPut(st,t,a,v,true);st.sig=null;return}if(a==0x0F){st.r[0x0F]=(st.r[0x0F]&~0x8B)|(v&0x08)|(st.r[0x0F]&v&0x83);return}if(a==0x11||a==0x12)return;st.r[a]=v;st.sig=null},
  next:a=>(a+1)&0x1F});
 return{name:'DS3231 module',vmin:2.3,vmax:5.5,pull:4700,maxHz:400e3,attrs:{temp:'25',start:'',eeprom:'yes',eeaddr:'0x57'},
  state:()=>{const t=devNow(),st={r:new Uint8Array(32),ee:eeNew(),h12:false,halt:false};rtcInit(st,null,t,Date.UTC(2000,0,1));st.r[0x0E]=0x1C;st.r[0x0F]=0x88;return st},
  match:(p,a)=>a==0x68?'rtc':((p.attrs||{}).eeprom!='no'&&a==eeAddr(p))?'ee':null,
  start(p,st,rw,t,sub){if(!st.init){st.init=1;rtcInit(st,p,t,rtcStart(p,t))}if(sub=='ee')return eeStart(st.ee,mem(p),spec,rw,t);return rtc.start(p,st,rw,t)},
  write:(p,st,b,t,sub)=>sub=='ee'?eeWrite(st.ee,mem(p),spec,b):rtc.write(p,st,b,t),read:(p,st,a,t,sub)=>sub=='ee'?eeRead(st.ee,mem(p),spec):rtc.read(p,st,a,t),
  stop:(p,st,t,sub)=>{if(sub=='ee')eeStop(st.ee,mem(p),spec,t)},
  drive(p,st,pin,t){if(pin!='SQW'||!devPower(p).on)return null;const c=st.r[0x0E];if(!st.init)return 1;
   if(c&4){const a1=(st.r[0x0F]&1)&&(c&1),a2=(st.r[0x0F]&2)&&(c&2);return(a1||a2)?0:1}
   const hz=[1,1024,4096,8192][(c>>3)&3];return(t*hz)%1<.5?1:0},
  tick(p,st,t){if(st.init){dsStep(st,t);drvDirty()}},
  ins:p=>`<span>start time</span><input data-a="start" value="${(p.attrs||{}).start||''}" placeholder="YYYY-MM-DD HH:MM:SS (blank = computer clock)" style="width:100%">`+numIn(p,'temp','temperature',-40,85,.25,25,'°C')+`<span>the time runs from the moment the program starts. The on-board AT24C32 answers at 0x57. SQW/INT is open-drain with the module's pull-up.</span>`,
  svg:(p,pw)=>{const id=p.id;return svPcb(id,-20,-12,220,150,'#1d5cc2','#14449a')+svHole(-8,126)+svHole(188,126)+`<circle cx="148" cy="74" r="50" fill="#9ea4ad" stroke="#5e646d" stroke-width="2"/><circle cx="148" cy="74" r="42" fill="#c8ccd3" stroke="#7b818a"/><circle cx="148" cy="74" r="26" fill="#aeb3bb"/><text x="148" y="70" fill="#4d525a" font-size="9" text-anchor="middle" font-family="monospace" font-weight="700">CR2032</text><text x="148" y="82" fill="#4d525a" font-size="7" text-anchor="middle" font-family="monospace">3V</text>`+svChip(14,30,66,38,'DS3231SN','',true)+svChip(14,82,40,26,'24C32','')+svSmd(66,86,10,5,'472')+svSmd(66,98,10,5,'472')+svLed(84,110,pw.on)+svHdr(['32K','SQW','SCL','SDA','VCC','GND'])+svStatus(60,124,pw.on?'':(pw.burnt?'destroyed':'no power'))},
  box:[-20,-12,220,150],pins:{'32K':[0,0],SQW:[20,0],SCL:[40,0],SDA:[60,0],VCC:[80,0],GND:[100,0]},cat:'DS3231 RTC + EEPROM module (I²C)',wk:'board-ds3231'}})();
// ===== DS1307 =====
I2CD.ds1307=regDev({name:'DS1307',vmin:4.5,vmax:5.5,pull:4700,maxHz:100e3,attrs:{start:'',battery:'yes'},
 state:()=>{const st={r:new Uint8Array(64),halt:true,h12:false};rtcInit(st,null,devNow(),Date.UTC(2000,0,1));return st},
 match:(p,a)=>a==0x68?'x':null,
 begin(p,st,rw,t){if(!st.init){st.init=1;if((p.attrs||{}).battery=='no'){rtcInit(st,p,t,Date.UTC(2000,0,1));st.halt=true}else{rtcInit(st,p,t,rtcStart(p,t));st.halt=false}}return true},
 rreg(p,st,a,t){a&=63;if(a<7){const v=rtcRd(st,t,a,false);return a==0&&st.halt?v|0x80:v}return st.r[a]},
 wreg(p,st,a,v,t){a&=63;if(a<7){rtcPut(st,t,a,v,false);if(a==0)st.halt=!!(v&0x80);return}st.r[a]=v},
 next:a=>(a+1)&63,
 drive(p,st,pin,t){if(pin!='SQW'||!devPower(p).on)return null;const c=st.r[7];if(c&0x10){const hz=[1,4096,8192,32768][c&3];return(t*hz)%1<.5?1:0}return(c&0x80)?1:0},
 ins:p=>`<span>start time</span><input data-a="start" value="${(p.attrs||{}).start||''}" placeholder="YYYY-MM-DD HH:MM:SS (blank = computer clock)" style="width:100%"><span>backup battery</span><select data-a="battery"><option value="yes"${(p.attrs||{}).battery=='no'?'':' selected'}>fitted: clock is running</option><option value="no"${(p.attrs||{}).battery=='no'?' selected':''}>none: clock halted (CH=1)</option></select><span>needs 5 V on VCC (below 4.5 V it runs from its battery and ignores I2C) and a bus of 100 kHz at most</span>`,
 svg:(p,pw)=>{const id=p.id;return svPcb(id,-20,-12,180,128,'#1b5bbf','#133f92')+svHole(-8,104)+svHole(148,104)+`<circle cx="104" cy="66" r="38" fill="#9ea4ad" stroke="#5e646d" stroke-width="2"/><circle cx="104" cy="66" r="31" fill="#c8ccd3" stroke="#7b818a"/><text x="104" y="68" fill="#4d525a" font-size="8" text-anchor="middle" font-family="monospace" font-weight="700">CR2032</text>`+svChip(0,34,44,28,'DS1307','',true)+`<rect x="2" y="70" width="28" height="9" rx="4.5" fill="#cfd3da" stroke="#7b818a"/><text x="16" y="77" fill="#555" font-size="4.5" text-anchor="middle" font-family="monospace">32.768k</text>`+svLed(30,96,pw.on)+svHdr(['GND','VCC','SDA','SCL','SQW'])+svStatus(60,110,pw.on?'':(pw.burnt?'destroyed':(pw.v>0?'VCC '+pw.v+' V: needs 4.5 V or more':'no power')))},
 box:[-20,-12,180,128],pins:{GND:[0,0],VCC:[20,0],SDA:[40,0],SCL:[60,0],SQW:[80,0]},cat:'DS1307 RTC (I²C)',wk:'wokwi-ds1307'});
