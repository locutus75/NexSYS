const fs = require('fs');
const path = 'node_modules/syscoinjs-lib/utils.js';
let txt = fs.readFileSync(path, 'utf8');
txt = txt.replace("const bjs = require('bitcoinjs-lib')", "const bjs = Object.assign({}, require('bitcoinjs-lib'))");
fs.writeFileSync(path, txt);
console.log("Patched!");
