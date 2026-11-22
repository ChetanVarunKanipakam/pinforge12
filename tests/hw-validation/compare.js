// Compares the text printed by the board with the simulator's expected output.
// usage: node tests/hw-validation/compare.js board_output.txt [expected_sim.txt]
// Lines look like "T1 Timer0 ... = 3999". Cycle measurements (T*, P2) may differ a little because loop timing differs between silicon and the model;
// everything else must match exactly. Mismatches are what to report back so the model can be fixed.
const fs=require('fs'),path=require('path');
const parse=f=>{const m={};for(const l of fs.readFileSync(f,'utf8').replace(/\r/g,'').split('\n')){const r=l.match(/^([A-Z]\d+) (.+?) = (0x[0-9A-F]+|\d+)$/);if(r)m[r[1]]={name:r[2],v:r[3].startsWith('0x')?parseInt(r[3],16)>>>0:+r[3],raw:r[3]}}return m};
const board=parse(process.argv[2]),sim=parse(process.argv[3]||path.join(__dirname,'expected_sim.txt'));
const timing=id=>/^T[1-5]$|^P2$/.test(id);
// R1-R12 describe the state the boot ROM leaves behind and P2 is a measured PLL lock time: they are reported, not judged.
let bad=0,note=0;
for(const id of Object.keys(sim).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){
 const s=sim[id],b=board[id];
 if(!b){console.log('MISSING  '+id+' '+s.name+' (sim '+s.raw+')');bad++;continue}
 let verdict,tol=timing(id)?24:0;   // 8 periods: poll-loop jitter is below ~15 cycles in total, the alternatives under test differ by ~100
 if(Math.abs(b.v-s.v)<=tol)verdict='ok      ';else if(/^R\d+$/.test(id)||id=='P2'){verdict='NOTE    ';note++}else{verdict='MISMATCH';bad++}
 console.log(verdict+' '+id+' '+s.name+': board '+b.raw+'  sim '+s.raw+(tol&&verdict=='ok      '&&b.v!==s.v?'  (within '+tol+')':''));
}
console.log(bad?'\n'+bad+' line(s) differ: send this output back so the simulator can be corrected.':'\nboard and simulator agree'+(note?' ('+note+' boot-state note(s) above)':''));
process.exit(bad?1:0);
