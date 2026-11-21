import type { Format, SceneItem, Size, Variant } from '../types';
import { getObjectBox, objects } from './library';
import { getFormatSize } from './formats';

export const MAX_MAIN = 4;
export const MAX_BG = 3;

const CANDIDATES = 150; // сколько раскладок пробуем на один вариант
const GRID = 24;

interface Box { x: number; y: number; w: number; h: number }

function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const area = (b: Box) => b.w * b.h;
const inBox = (b: Box, x: number, y: number) =>
    x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

function overlapArea(a: Box, b: Box) {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
}

function gapBetween(a: Box, b: Box) {
    const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
    const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
    return Math.hypot(dx, dy);
}

/** Доля холста, закрытая рамками объектов */
function coverage(boxes: Box[], W: number, H: number) {
    let hit = 0;
    for (let i = 0; i < GRID; i++) {
        for (let j = 0; j < GRID; j++) {
            const x = ((i + 0.5) / GRID) * W;
            const y = ((j + 0.5) / GRID) * H;
            if (boxes.some((b) => inBox(b, x, y))) hit++;
        }
    }
    return hit / (GRID * GRID);
}

/** Какая часть фонового объекта внутри холста не закрыта главными */
function openShare(bg: Box, mains: Box[], W: number, H: number) {
    let inside = 0;
    let open = 0;
    for (let i = 0; i < GRID; i++) {
        for (let j = 0; j < GRID; j++) {
            const x = ((i + 0.5) / GRID) * W;
            const y = ((j + 0.5) / GRID) * H;
            if (!inBox(bg, x, y)) continue;
            inside++;
            if (!mains.some((b) => inBox(b, x, y))) open++;
        }
    }
    return inside ? open / inside : 0;
}

/** Чем выше балл, тем больше раскладка похожа на примеры */
function score(mains: Box[], bgs: Box[], W: number, H: number) {
    const canvas: Box = { x: 0, y: 0, w: W, h: H };
    const diag = Math.max(W, H);
    let s = 0;

    // главные объекты не должны слишком сильно уходить за край
    for (const b of mains) {
        const v = overlapArea(b, canvas) / area(b);
        if (v < 0.6) s -= (0.6 - v) * 6;
        s += Math.min(v, 0.9) * 0.5;
    }

    // композиция занимает большую часть холста
    const cov = coverage(mains, W, H);
    if (cov < 0.55) s -= (0.55 - cov) * 5;
    if (cov > 0.9) s -= (cov - 0.9) * 3;

    // объекты рядом и слегка перекрываются
    for (let i = 0; i < mains.length; i++) {
        for (let j = i + 1; j < mains.length; j++) {
            const ov = overlapArea(mains[i], mains[j]) / Math.min(area(mains[i]), area(mains[j]));
            if (ov > 0.45) s -= (ov - 0.45) * 6;
            s -= (gapBetween(mains[i], mains[j]) / diag) * 6;
        }
    }

    // центр масс не уезжает от центра холста
    const total = mains.reduce((sum, b) => sum + area(b), 0);
    const cx = mains.reduce((sum, b) => sum + (b.x + b.w / 2) * area(b), 0) / total;
    const cy = mains.reduce((sum, b) => sum + (b.y + b.h / 2) * area(b), 0) / total;
    s -= (Math.hypot(cx - W / 2, cy - H / 2) / diag) * 2;

    // фоновые: частично видны и не закрыты целиком
    for (const b of bgs) {
        const v = overlapArea(b, canvas) / area(b);
        if (v < 0.35) s -= (0.35 - v) * 4;
        const open = openShare(b, mains, W, H);
        if (open < 0.3) s -= (0.3 - open) * 4;
    }
    return s;
}

interface Params {
    mainIds: string[];
    bgCount: number;
    size: Size;
    format: Format;
    bgId: string;
    seed: number;
}

/** Один seed = одна раскладка. Фоновые рисуются сзади, крупные главные ниже, мелкие выше */
export function buildComposition({ mainIds, bgCount, size, format, bgId, seed }: Params): SceneItem[] {
    const { w: W, h: H } = getFormatSize(bgId, size, format);
    const rand = mulberry32(seed * 7919 + 13);

    const mains: { id: string; w: number; h: number }[] = [];
    for (const id of mainIds.slice(0, MAX_MAIN)) {
        const box = getObjectBox(id, size, 'main');
        if (box) mains.push({ id, w: box.w, h: box.h });
    }
    if (!mains.length) return [];

    // фоновые объекты выбираем из остальных, порядок зависит от seed
    const pool = objects
        .map((o) => o.id)
        .filter((id) => !mainIds.includes(id) && getObjectBox(id, size, 'bg'));
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const bgs: { id: string; w: number; h: number }[] = [];
    for (const id of pool.slice(0, Math.min(bgCount, MAX_BG))) {
        const box = getObjectBox(id, size, 'bg');
        if (box) bgs.push({ id, w: box.w, h: box.h });
    }

    const place = (o: { w: number; h: number }, spread: number): Box => {
        const cx = W * (0.5 + (rand() - 0.5) * 2 * spread);
        const cy = H * (0.5 + (rand() - 0.5) * 2 * spread);
        return { x: cx - o.w / 2, y: cy - o.h / 2, w: o.w, h: o.h };
    };

    let best: { s: number; m: Box[]; b: Box[] } | null = null;
    for (let k = 0; k < CANDIDATES; k++) {
        const m = mains.map((o, i) => place(o, i === 0 ? 0.2 : 0.4));
        const b = bgs.map((o) => place(o, 0.6));
        const s = score(m, b, W, H);
        if (!best || s > best.s) best = { s, m, b };
    }
    if (!best) return [];
    const chosen = best;

    const toItem = (id: string, variant: Variant, box: Box): SceneItem => ({
        uid: crypto.randomUUID(),
        objectId: id,
        variant,
        x: Math.round(box.x),
        y: Math.round(box.y),
        rotation: 0,
    });

    const items: SceneItem[] = [];
    bgs.forEach((o, i) => items.push(toItem(o.id, 'bg', chosen.b[i])));
    mains
        .map((o, i) => ({ o, box: chosen.m[i] }))
        .sort((a, c) => area(c.box) - area(a.box))
        .forEach(({ o, box }) => items.push(toItem(o.id, 'main', box)));
    return items;
}