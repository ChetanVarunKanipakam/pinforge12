// Starts the real compile server and checks both targets end to end: HTTP compile -> firmware -> simulator.
const fs=require('fs'),cp=require('child_process'),path=require('path'),http=require('http');
const root=path.join(__dirname,'..'),PORT=3300+Math.floor(Math.random()*500);
const src=fs.readFileSync(path.join(root,'public/index.html'),'utf8').match(/<script>\n([\s\S]*?)<\/script>/)[1];
const {CM3,LPC1768}=new Function(src+';return {CM3,LPC1768}')();const {valid}=require('../toolchain/lpc-checksum.js');
let P=0,F=0;const ok=(n,c,d)=>{if(c){P++;console.log('PASS '+n)}else{F++;console.log('FAIL '+n+(d!==undefined?' -> '+d:''))}};
const post=(body)=>new Promise((res,rej)=>{const b=JSON.stringify(body),r=http.request({port:PORT,path:'/api/compile',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res(JSON.parse(d)))});r.on('error',rej);r.end(b)});
const LPC='#include "lpc17xx.h"\nint main(void){LPC_GPIO1->FIODIR=1u<<18;for(;;){LPC_GPIO1->FIOSET=1u<<18;for(volatile int i=0;i<2000;i++);LPC_GPIO1->FIOCLR=1u<<18;for(volatile int i=0;i<2000;i++);}}\n';
const F1='#include "stm32f1.h"\nint main(void){RCC->APB2ENR|=RCC_APB2ENR_IOPCEN;GPIOC->CRH=(GPIOC->CRH&~0xF00000)|0x200000;for(;;){GPIOC->ODR^=1<<13;for(volatile int i=0;i<2000;i++);}}\n';
(async()=>{
 const srv=cp.spawn('node',['server.js'],{cwd:root,env:{...process.env,PORT:String(PORT)},stdio:'ignore'});
 try{for(let i=0;i<50;i++){try{await new Promise((r,j)=>http.get({port:PORT,path:'/api/health'},x=>{x.resume();x.on('end',r)}).on('error',j));break}catch(e){await new Promise(r=>setTimeout(r,100))}}
  let r=await post({code:LPC,opt:'Os',target:'lpc1768'});
  ok('server: LPC1768 program compiles',r.ok,r.log);
  if(r.ok){const bin=Buffer.from(r.bin,'base64');ok('server: LPC1768 image has a valid boot checksum',valid(bin));ok('server: LPC1768 image vectors start at 0 with SP in local SRAM',bin.readUInt32LE(0)===0x10007FE0&&bin.readUInt32LE(4)>0&&bin.readUInt32LE(4)<0x1000);
   const ev=[];let M;const m=new LPC1768({gpio:(p,i,q)=>{if(p==1&&i==18&&q.mode==3)ev.push(q.odr)},readPin:()=>0});M=m;m.load(bin);m.reset();while(m.cy<200000&&!m.halted)m.step();
   ok('server: compiled LPC1768 firmware blinks P1.18 in the simulator',!m.halted&&ev.length>=6&&ev.slice(0,6).join()==='0,1,0,1,0,1',ev.slice(0,8)+' halted='+m.halted)}
  r=await post({code:F1,opt:'Os'});ok('server: default target is still STM32F103',r.ok&&Buffer.from(r.bin,'base64').readUInt32LE(0)===0x20005000,r.log);
  r=await post({code:'#include <stdio.h>\nint main(void){return 0;}\n',opt:'Os',target:'lpc1768'});ok('server: a header outside the toolchain is rejected for LPC1768 too',!r.ok,r.log)
 }finally{srv.kill()}
 console.log(F?'FAIL server: '+F+' failed':'PASS all '+P+' server checks');process.exit(F?1:0)})().catch(e=>{console.log('FAIL server test crashed: '+e.message);process.exit(1)});
