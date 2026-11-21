import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const RAW = 'src/assets/library-raw';
const OUT = 'src/assets/library';
const SIZES = ['L', 'S'];
const VARIANTS = ['main', 'bg'];
const EXPECTED_BG = { L: 1000, S: 500 };

const colorMap = JSON.parse(await readFile('scripts/color-map.json', 'utf8'));
const tags = JSON.parse(await readFile('scripts/tags.json', 'utf8'));

const problems = [];
const manifest = {};
const backgrounds = {};

const normHex = (v) => {
    v = v.trim().toLowerCase();
    if (v === 'white') return '#FFFFFF';
    if (v === 'black') return '#000000';
    if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + [...v.slice(1)].map((c) => c + c).join('');
    return v.toUpperCase();
};

const listSvg = async (dir) => {
    try { return (await readdir(dir)).filter((f) => f.endsWith('.svg')); } catch { return []; }
};

/** Проверка + разметка ролей. kind: 'main' | 'bg' | 'background' */
function processSvg(svg, kind, where) {
    const forbidden = ['<image', 'Gradient', '<mask', '<filter'];
    if (kind !== 'background') forbidden.push('clip-path');
    for (const bad of forbidden) {
        if (svg.includes(bad)) problems.push(`${where}: найдено "${bad}"`);
    }

    // <defs> прячем, чтобы не размечать цвета внутри clipPath
    const defs = [];
    let work = svg.replace(/<defs>[\s\S]*?<\/defs>/g, (m) => {
        defs.push(m);
        return `<!--DEFS${defs.length - 1}-->`;
    });

    const unknown = new Set();
    work = work.replace(/\b(fill|stroke)="([^"]+)"/g, (match, attr, value) => {
        if (value === 'none') return match;
        const role = colorMap[normHex(value)];
        if (!role) { unknown.add(value); return match; }
        if (kind !== 'main' && role.startsWith('obj-')) {
            problems.push(`${where}: цвет объекта (${role}) в "${kind}"`);
        }
        return `${attr}="${value}" data-${attr}="${role}"`;
    });
    for (const u of unknown) problems.push(`${where}: неизвестный цвет ${u}`);

    work = work.replace(/<!--DEFS(\d+)-->/g, (_, i) => defs[Number(i)]);

    const vb = svg.match(/viewBox="([\d.\s-]+)"/);
    if (!vb) { problems.push(`${where}: нет viewBox`); return null; }
    const [, , w, h] = vb[1].trim().split(/\s+/).map(Number);
    return { svg: work, w, h };
}

// --- Объекты ---
for (const size of SIZES) {
    for (const variant of VARIANTS) {
        const dir = path.join(RAW, size, variant);
        for (const file of await listSvg(dir)) {
            const id = path.basename(file, '.svg');
            const result = processSvg(await readFile(path.join(dir, file), 'utf8'), variant, `${size}/${variant}/${file}`);
            if (!result) continue;

            const outDir = path.join(OUT, size, variant);
            await mkdir(outDir, { recursive: true });
            await writeFile(path.join(outDir, file), result.svg);

            manifest[id] ??= {
                id,
                title: { ru: tags[id]?.ru ?? id, en: tags[id]?.en ?? id },
                tags: tags[id]?.tags ?? [],
                files: { L: {}, S: {} },
                viewBox: { L: {}, S: {} },
            };
            manifest[id].files[size][variant] = `${size}/${variant}/${file}`;
            manifest[id].viewBox[size][variant] = { w: result.w, h: result.h };
        }
    }
}

// --- Фоны ---
for (const size of SIZES) {
    const dir = path.join(RAW, 'backgrounds', size);
    for (const file of await listSvg(dir)) {
        const id = path.basename(file, '.svg');
        const where = `backgrounds/${size}/${file}`;
        const result = processSvg(await readFile(path.join(dir, file), 'utf8'), 'background', where);
        if (!result) continue;

        if (result.w !== EXPECTED_BG[size] || result.h !== EXPECTED_BG[size]) {
            problems.push(`${where}: размер ${result.w}×${result.h}, ожидалось ${EXPECTED_BG[size]}`);
        }
        const outDir = path.join(OUT, 'backgrounds', size);
        await mkdir(outDir, { recursive: true });
        await writeFile(path.join(outDir, file), result.svg);

        backgrounds[id] ??= {};
        backgrounds[id][size] = { file: `backgrounds/${size}/${file}`, w: result.w, h: result.h };
    }
}

console.log('Готово без ошибок');