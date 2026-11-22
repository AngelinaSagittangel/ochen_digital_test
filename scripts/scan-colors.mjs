import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const RAW = 'src/assets/library-raw';
const counts = new Map();

async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { await walk(full); continue; }
        if (!entry.name.endsWith('.svg')) continue;

        const svg = await readFile(full, 'utf8');
        for (const m of svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
            const v = m[1];
            if (v === 'none') continue;
            const item = counts.get(v.toUpperCase()) ?? { n: 0, files: new Set() };
            item.n++;
            item.files.add(path.relative(RAW, full));
            counts.set(v.toUpperCase(), item);
        }
    }
}

await walk(RAW);

const rows = [...counts.entries()].sort((a, b) => b[1].n - a[1].n);
for (const [hex, { n, files }] of rows) {
    console.log(`${hex.padEnd(10)} ×${String(n).padEnd(5)} в ${files.size} файлах, напр. ${[...files][0]}`);
}