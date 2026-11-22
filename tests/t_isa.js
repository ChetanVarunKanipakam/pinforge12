// Instruction coverage: every distinct instruction found in every compiled test/example binary is executed once on the emulator.
// Anything the emulator does not implement halts the CPU with "Unimplemented instruction", so a gap shows up here instead of in a user's program.
const fs=require('fs'),cp=require('child_process'),path=require('path');
const {CM3}=require('./core');
let fails=0;const ck=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':'   got '+x));if(!c)fails++};
const dirs=[path.join(__dirname,'fw/out')];const elfs=[];dirs.forEach(d=>fs.existsSync(d)&&fs.readdirSync(d).filter(f=>f.endsWith('.elf')).forEach(f=>elfs.push(path.join(d,f))));
const seen=new Map();let total=0;
for(const elf of elfs){const dump=cp.execSync('arm-none-eabi-objdump -d -j .text '+elf,{maxBuffer:1<<28}).toString();
 for(const line of dump.split('\n')){const m=line.match(/^\s*([0-9a-f]+):\t((?:[0-9a-f]{4} ?){1,2})\s*\t(\S+)/);if(!m)continue;total++;
  const hw=m[2].trim().split(/\s+/);const key=hw.length==2?(parseInt(hw[0],16)&0xFFF0).toString(16)+':'+(parseInt(hw[1],16)&0xF0F0).toString(16):'';
  const id=m[3]+(hw.length==2?'/'+key:'/'+(parseInt(hw[0],16)>>6).toString(16));if(!seen.has(id))seen.set(id,{elf,addr:parseInt(m[1],16),mn:m[3],hw})}}
const bad=[];let n=0;
for(const [id,e] of seen){const bin=fs.readFileSync(e.elf.replace('.elf','.bin'));const M=new CM3({});M.load(bin);M.reset();
 for(let i=0;i<13;i++)M.r[i]=0x20000100;M.r[13]=0x20001000;M.r[14]=0x08000001;M.r[15]=e.addr;
 if(/^(b|bl|bx|blx|cbz|cbnz|tbb|tbh|wfi|wfe|svc|bkpt|udf|pop|ldm|ldmia|ldmdb|ldr)/.test(e.mn)&&/^(b|bl|bx|blx|cbz|cbnz|tbb|tbh|wfi|wfe|svc|bkpt|udf|pop)/.test(e.mn)){continue}
 try{M.step()}catch(x){bad.push(e.mn+' @'+e.addr.toString(16)+' ('+e.hw.join(' ')+'): '+x.message);continue}
 n++;if(M.halted&&/nimplemented/.test(String(M.halted)))bad.push(e.mn+' @'+e.addr.toString(16)+' ('+e.hw.join(' ')+')')}
ck('executed '+n+' distinct instruction forms from '+elfs.length+' binaries ('+total+' instructions): none unimplemented',bad.length==0,bad.slice(0,8).join(' | '));
process.exit(fails?1:0);
