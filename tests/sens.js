const {load}=require('./harness');const fs=require('fs'),path=require('path');
let fails=0;const ck=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':'   got '+x));if(!c)fails++};
const wires=(id,vcc,extra=[])=>[[id+':GND','bluepill:GND.3','black'],[id+':VCC',vcc,'red'],[id+':SCL','bluepill:PB10','green'],[id+':SDA','bluepill:PB11','blue'],...extra];
// run a test firmware against a circuit until it prints DONE (or the simulated time limit)
async function sim(bin,parts,wr,opt={}){const T=await load();const {ev}=T;
 const b64=fs.readFileSync(path.join(__dirname,'fw/out/'+bin+'.bin')).toString('base64');
 ev(`applyCircuit(${JSON.stringify({parts,wires:wr})});setFw({name:'t.bin',bytes:b64('${b64}'),src:null,dirty:false,used:1})`);
 if(opt.mutate)opt.mutate(ev);
 ev('doRun()');ev('clearInterval(fwTimer)');const lim=opt.secs||3;
 for(let i=0;i<200000&&ev('simT')<lim&&!ev('M.halted');i++){ev('fwTick()');if(i%20==0&&/DONE/.test(ev('$("con").textContent')))break}
 ev('draw()');T.out=ev('$("con").textContent');T.mon=ev('i2cMonText()');return T}
const part=(type,attrs={},id='dev1')=>({id,type,x:340,y:200,attrs});
module.exports={sim,wires,part,ck,get fails(){return fails}};
if(require.main===module)(async()=>{
 const name=process.argv[2]||'t_mpu';const types={t_mpu:'mpu6050',t_mpu_int:'mpu6050',t_bmp:'bmp280',t_rtc:'ds3231',t_ds1307:'ds1307',t_bh:'bh1750',t_eep:'at24',t_lcd:'lcdi2c',t_bus:'oled'};
 const T=await sim(name,[part(types[name],JSON.parse(process.argv[3]||'{}'))],wires('dev1',process.argv[4]||'bluepill:3V3.2',process.argv[5]?JSON.parse(process.argv[5]):[]),{secs:+process.argv[6]||3});
 console.log(T.out);console.log('--- monitor tail');console.log(T.mon.split('\n').slice(-6).join('\n'));process.exit(0)})();
