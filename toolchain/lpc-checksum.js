'use strict';
/* LPC17xx boot ROM: user code is only started if the sum of the first eight 32-bit vectors is 0 (word 7 holds the negated sum of words 0-6).
   Usage as a module: patch(buf) -> Buffer ; as a tool: node lpc-checksum.js in.bin [out.bin] */
function patch(buf) {
  const b = Buffer.from(buf); if (b.length < 32) throw new Error('image shorter than the 32-byte vector table');
  let s = 0; for (let i = 0; i < 7; i++) s = (s + b.readUInt32LE(i * 4)) >>> 0;
  b.writeUInt32LE((0x100000000 - s) >>> 0, 28); return b;
}
function valid(buf) { if (buf.length < 32) return false; let s = 0; for (let i = 0; i < 8; i++) s = (s + buf.readUInt32LE(i * 4)) >>> 0; return s === 0; }
module.exports = { patch, valid };
if (require.main === module) { const fs = require('fs'), [i, o] = process.argv.slice(2); fs.writeFileSync(o || i, patch(fs.readFileSync(i))); console.log('checksum written to', o || i); }
