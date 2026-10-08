const fs = require('fs');
const path = require('path');
function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { walk(p); continue; }
    if (!/\.tsx?$/.test(f.name)) continue;
    const t = fs.readFileSync(p, 'utf8').split('\n');
    t.forEach((l, i) => {
      if (/[\u0980-\u09FF]/.test(l)) console.log(p + ':' + (i + 1) + ': ' + l.trim().slice(0, 110));
    });
  }
}
walk('web/src');
const pubs = ['public/index.html', 'public/admin.html'];
for (const p of pubs) {
  try {
    fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      if (/[\u0980-\u09FF]/.test(l)) console.log(p + ':' + (i + 1) + ': ' + l.trim().slice(0, 110));
    });
  } catch (e) { console.log('skip ' + p); }
}
