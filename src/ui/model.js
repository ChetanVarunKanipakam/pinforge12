// ---------- parts: pin coordinates are multiples of 20 from the part origin
const D={led:{t:'wokwi-led',pins:{C:[0,60],A:[20,60]},box:[-14,-8,48,74]},res:{t:'wokwi-resistor',pins:{'1':[0,0],'2':[80,0]},box:[-6,-14,92,28]},
 btn:{t:'wokwi-pushbutton',pins:{'1.l':[0,0],'1.r':[60,0],'2.l':[0,40],'2.r':[60,40]},box:[-8,-12,76,64]},pot:{t:'wokwi-potentiometer',pins:{GND:[0,80],SIG:[20,80],VCC:[40,80]},box:[-18,-26,76,112]},
 la:{t:'wokwi-logic-analyzer',pins:{D0:[0,0],D1:[0,20],D2:[0,40],D3:[0,60],D4:[0,80],D5:[0,100],D6:[0,120],D7:[0,140],GND:[0,160]},box:[-8,-14,92,188]},
 lcd:{t:'wokwi-lcd1602',pins:Object.fromEntries(['VSS','VDD','V0','RS','RW','E','D0','D1','D2','D3','D4','D5','D6','D7','A','K'].map((n,i)=>[n,[i*20,0]])),box:[-24,-134,368,148]},
 seg7:{t:'wokwi-7segment',pins:{'COM.1':[0,0],G:[20,0],F:[40,0],A:[60,0],B:[80,0],E:[0,100],D:[20,100],'COM.2':[40,100],C:[60,100],DP:[80,100]},box:[-14,-12,108,124]},
 seg4:{t:'wokwi-7segment-4digit',pins:Object.fromEntries(['DIG1','DIG2','DIG3','DIG4','A','B','C','D','E','F','G','DP'].map((n,i)=>[n,[i*20,0]])),box:[-14,-116,248,128]},
 kp:{t:'wokwi-membrane-keypad',pins:{R1:[0,0],R2:[20,0],R3:[40,0],R4:[60,0],C1:[80,0],C2:[100,0],C3:[120,0],C4:[140,0]},box:[-14,-190,168,202]},
 buzz:{t:'wokwi-buzzer',pins:{'1':[0,0],'2':[20,0]},box:[-22,-72,64,80]},
 rgb:{t:'wokwi-rgb-led',pins:{R:[0,0],COM:[20,0],G:[40,0],B:[60,0]},box:[-12,-68,84,76]},
 sw:{t:'wokwi-slide-switch',pins:{'1':[0,0],'2':[20,0],'3':[40,0]},box:[-16,-44,72,52]},
 bar:{t:'wokwi-led-bar-graph',pins:Object.assign(Object.fromEntries([...Array(10).keys()].map(i=>['A'+(i+1),[i*20,0]])),Object.fromEntries([...Array(10).keys()].map(i=>['C'+(i+1),[i*20,60]]))),box:[-14,-12,208,84]},
 servo:{t:'wokwi-servo',pins:{GND:[0,0],'V+':[20,0],PWM:[40,0]},box:[-32,-110,150,122]},
  oled:{t:'board-ssd1306',i2c:1,lblb:1,pins:{GND:[0,0],VCC:[20,0],SCL:[40,0],SDA:[60,0]},box:[-40,-12,140,144]}};
const CAT=[['led','LED','Output'],['res','Resistor','Passive'],['btn','Pushbutton','Input'],['pot','Potentiometer','Input'],['la','Logic Analyzer','Instrument'],['lcd','LCD 16×2 (HD44780)','Display'],['seg7','7-segment digit','Display'],['seg4','4-digit 7-segment','Display'],['kp','Keypad 4×4','Input'],['sw','Slide switch','Input'],['buzz','Buzzer','Output'],['rgb','RGB LED','Output'],['bar','LED bar graph','Output'],['servo','Servo motor','Output'],['oled','OLED 128×64 (SSD1306, I²C)','Display']];
const COL={green:'#2ecc71',red:'#e84a5f',blue:'#3b9dff',yellow:'#f4d03f',orange:'#ff9f1c',purple:'#b57bff',black:'#6b7686',gray:'#9aa0a6',white:'#f2f2f2'};
const LC={red:'#ff3b3b',green:'#35e06b',blue:'#4aa3ff',yellow:'#ffd400',white:'#ffffff'};
let parts=[{id:'btn1',type:'btn',x:360,y:100,rot:0,attrs:{color:'green'},down:false},{id:'led1',type:'led',x:360,y:240,rot:0,attrs:{color:'red'}}],
wires=[['led1:A',BID+':PA5','green'],['led1:C',BID+':GND.3','black'],['btn1:1.l',BID+':PA0','blue'],['btn1:2.l',BID+':GND.2','black']],
S={},pend=null,dragFrom=null,cur=[0,0],sel=null,drag=null,dragH=null,run=false,building=false,CAN=false,ver=1,lvv=-1,rq=0,cnt=5,fileTab='c',view='split',barKey='',skipJson=false,M=null,FW=null,simT=0,tickC0=0,tickClk=8e6,fwTimer=0,spd=1,sbuf='',rx='',LA={},PWMON={},UARTON={},txEnd=[0,0,0],LAalias={},laHold=false,laFroz=0,laMouse=null;
const part=id=>parts.find(t=>t.id==id);
const locked=()=>run;
function rotv(v,r){r=((r||0)%4+4)%4;return[[v[0],v[1]],[-v[1],v[0]],[-v[0],-v[1]],[v[1],-v[0]]][r]}
function pinGeo(n){const i=n.indexOf(':'),id=n.slice(0,i),pin=n.slice(i+1);
 if(id==BID){const b=BN.find(q=>q.id==pin);return b?{p:[b.x,b.y],d:b.d}:null}
 const t=part(id);if(!t)return null;const d=D[t.type],q=d.pins[pin];if(!q)return null;const bx=d.box,c=[bx[0]+bx[2]/2,bx[1]+bx[3]/2],v=[q[0]-c[0],q[1]-c[1]],r=rotv(q,t.rot);
 const dir=Math.abs(v[0])/bx[2]>Math.abs(v[1])/bx[3]?[Math.sign(v[0]),0]:[0,Math.sign(v[1])];return{p:[t.x+r[0],t.y+r[1]],d:rotv(dir,t.rot)}}
