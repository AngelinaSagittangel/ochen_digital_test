import { readFile } from 'node:fs/promises';
const m = JSON.parse(await readFile('src/assets/library/manifest.json', 'utf8'));
for (const o of m) for (const v of ['main', 'bg']) {
    const L = o.viewBox.L[v], S = o.viewBox.S[v];
    console.log(o.id.padEnd(11), v.padEnd(5), `${L.w}×${L.h}`.padEnd(12), `${S.w}×${S.h}`.padEnd(12), 'L/S =', (L.w / S.w).toFixed(2));
}