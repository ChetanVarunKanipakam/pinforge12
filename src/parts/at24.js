// ---- AT24Cxx serial EEPROM engine (also inside the DS3231 module): page buffer, write cycle (ACK polling), wrap-around
const EEV={'24C02':{size:256,aw:1,page:8},'24C32':{size:4096,aw:2,page:32},'24C256':{size:32768,aw:2,page:64}};
function eeNew(){return{ptr:0,awLeft:0,buf:[],mode:'',busy:0,pg:0,off:0,wp:false}}
function eeStart(ee,mem,spec,rw,t){if(t<ee.busy)return false;ee.mode=rw?'r':'w';ee.awLeft=rw?0:spec.aw;ee.buf=[];if(!rw)ee.addr=0;return true}
function eeWrite(ee,mem,spec,b){if(ee.awLeft>0){ee.addr=(ee.addr<<8)|b;if(--ee.awLeft==0){ee.ptr=ee.addr%spec.size;ee.pg=ee.ptr-ee.ptr%spec.page;ee.off=ee.ptr%spec.page}return true}ee.buf.push(b);return true}
function eeRead(ee,mem,spec){const v=mem[ee.ptr];ee.ptr=(ee.ptr+1)%spec.size;return v}
function eeStop(ee,mem,spec,t){if(ee.mode=='w'&&ee.awLeft==0&&ee.buf.length){if(!ee.wp)ee.buf.forEach((b,i)=>{mem[ee.pg+((ee.off+i)%spec.page)]=b});ee.ptr=ee.pg+((ee.off+ee.buf.length)%spec.page);ee.busy=t+0.005}ee.mode='';ee.buf=[]}
// ---- calendar helpers shared by the RTCs (UTC arithmetic, so the browser's time zone never matters)
const rtcFields=ms=>{const d=new Date(ms);return{s:d.getUTCSeconds(),m:d.getUTCMinutes(),h:d.getUTCHours(),dt:d.getUTCDate(),mo:d.getUTCMonth()+1,y:d.getUTCFullYear()}};
const rtcMs=f=>Date.UTC(f.y,f.mo-1,f.dt,f.h,f.m,f.s);
// ===== AT24Cxx module =====
I2CD.at24=(()=>{const spec=p=>EEV[(p.attrs||{}).size]||EEV['24C32'];
 const mem=p=>{const s=spec(p);if(!p.mem||p.mem.length!=s.size)p.mem=new Array(s.size).fill(0xFF);return p.mem};
 return{name:'AT24Cxx EEPROM',vmin:1.8,vmax:5.5,pull:0,maxHz:400e3,attrs:{size:'24C32',wp:'0'},
 state:()=>({ee:eeNew()}),
 match:(p,a)=>{const lv=n=>lvl(p.id+':'+n)===1?1:0;return a==(0x50|lv('A2')<<2|lv('A1')<<1|lv('A0'))?'x':null},
 start:(p,st,rw,t)=>{st.ee.wp=lvl(p.id+':WP')===1;return eeStart(st.ee,mem(p),spec(p),rw,t)},
 write:(p,st,b)=>eeWrite(st.ee,mem(p),spec(p),b),read:(p,st)=>eeRead(st.ee,mem(p),spec(p)),stop:(p,st,t)=>eeStop(st.ee,mem(p),spec(p),t),
 ins:(p,a,dis,sel)=>`<span>chip</span>${sel('size',['24C02','24C32','24C256'])}<span>contents are non-volatile: they survive Stop and Run</span><button data-act="eeclear">erase to 0xFF</button><span>A0-A2 and WP: wire to GND or VCC (unwired = low)</span>`,
 svg:(p,pw)=>{const id=p.id,spc=spec(p),chip=spc.size==256?'24C02':spc.size==4096?'24C32':'24C256';
  return svPcb(id,-20,-12,180,100,'#1f6fd6','#1450a3')+svHole(-10,76)+svHole(150,76)+svChip(30,28,50,36,'AT'+chip,'EEPROM')+svSmd(100,26,10,6,'103')+svSmd(100,40,10,6,'103')+svSmd(116,26,10,6,'472')+svLed(138,32,pw.on)+svHdr(['A0','A1','A2','GND','SDA','SCL','WP','VCC'])+svStatus(70,80,pw.on?'':(pw.burnt?'destroyed':'no power'))},
 box:[-20,-12,180,100],pins:{A0:[0,0],A1:[20,0],A2:[40,0],GND:[60,0],SDA:[80,0],SCL:[100,0],WP:[120,0],VCC:[140,0]},cat:'AT24Cxx EEPROM (I²C)',wk:'board-at24c'}})();
