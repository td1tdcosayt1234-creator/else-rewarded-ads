const fs = require('fs');
const path = require('path');
const words = ['koro', 'kore', 'hole', 'hobe', 'asbe', 'pabe', 'dao', 'daw', 'ekhon', 'ekhane', 'theke', 'jonno', 'moto', 'sudhu', 'chara', 'beshi', 'dorkar', 'tomar', 'amar', 'dekhabe', 'dekhbe', 'baniye', 'banao', 'milao', ' ache', 'lagbe', 'likhun', 'cholche', 'korlei', 'korle', 'thakbe', 'thakle', 'sathe', 'diye', 'bodle', 'holo', 'hoyeche', 'korbe', 'korbo', 'parbe', 'jabe', 'jao', 'khao', 'nao', 'neo'];
function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { walk(p); continue; }
    if (!/\.(tsx|ts|html)$/.test(f.name)) continue;
    if (p.includes('node_modules')) continue;
    fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      const low = l.toLowerCase();
      const hit = words.filter(w => low.includes(w));
      if (hit.length && /[\u0980-\u09FF]/.test(l) === false) {
        // skip code identifiers: only flag lines with spaces (UI text likely)
        if (/\s/.test(l.trim())) console.log(p + ':' + (i + 1) + ' [' + hit.join(',') + '] ' + l.trim().slice(0, 110));
      }
    });
  }
}
walk('web/src');
walk('public');
