'use strict';
/* Assembles public/index.html from src/ (see src/manifest.json).  Usage: node tools/build.js
   The result is one self-contained page: <script> #1 = emulator (core + peripherals + chip), <script> #2 = UI + parts. */
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'src');
const man = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
const cat = list => list.map(f => { const t = fs.readFileSync(path.join(src, f), 'utf8'); return t.endsWith('\n') ? t : t + '\n'; }).join('');
const out = fs.readFileSync(path.join(src, 'index.template.html'), 'utf8')
  + '<script>\n' + cat(man.emulator) + '</script>\n<script>\n' + cat(man.ui) + '</script></body></html>\n';
const dst = path.join(__dirname, '..', 'public', 'index.html');
fs.writeFileSync(process.env.PF_OUT || dst, out);
console.log('built', process.env.PF_OUT || dst, out.length, 'bytes');
