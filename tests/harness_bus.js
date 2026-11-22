// standalone copy of the mock I2C bus (256-byte EEPROM-like slave at 0x50) so t_equiv does not need compiled test ELFs
function mockBus(){const B={log:[],ev:[],mem:new Uint8Array(256),ptr:0,sel:false,first:false,wrote:[]};for(let i=0;i<256;i++)B.mem[i]=i^0x5A;
 B.host={i2c(k,op,x){if(op=='addr'){const ok=(x>>1)==0x50;B.sel=ok;B.first=ok&&!(x&1);return ok}
   if(op=='write'){if(!B.sel)return false;if(B.first){B.ptr=x;B.first=false}else{B.mem[B.ptr++&255]=x;B.wrote.push(x)}return true}
   if(op=='read'){return B.mem[B.ptr++&255]}if(op=='stop'){B.sel=false}}};return B}
module.exports={mockBus};
