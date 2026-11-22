import type {Format, SceneItem, Size, Variant} from '../types';
import {getObjectBox, objects} from './library';
import {getFormatSize} from './formats';

export const MAX_MAIN = 4;
export const MAX_BG = 3;

const ATTEMPTS = 120;
const GRID = 24;

type Kind = 'surface' | 'standing' | 'small';

const KIND: Record<string, Kind> = {
    book: 'surface',
    folder: 'surface',
    lamp: 'standing',
    vase: 'standing',
    headphones: 'standing',
};

const kindOf = (id: string): Kind => KIND[id] ?? 'small';

const KIND_ORDER: Record<Kind, number> = {
    surface: 0,
    standing: 1,
    small: 2,
};

interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface Obj {
    id: string;
    w: number;
    h: number;
    kind: Kind;
}

interface Placed {
    o: Obj;
    box: Box;
}

interface Params {
    mainIds: string[];
    bgCount: number;
    size: Size;
    format: Format;
    bgId: string;
    seed: number;
}

function mulberry32(seed: number) {
    let a = seed >>> 0;

    return () => {
        let t = a + 0x6d2b79f5;
        a = t >>> 0;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const area = (b: { w: number; h: number }) => b.w * b.h;

const inBox = (b: Box, x: number, y: number) =>
    x >= b.x &&
    x <= b.x + b.w &&
    y >= b.y &&
    y <= b.y + b.h;

function overlapArea(a: Box, b: Box) {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

    return w > 0 && h > 0 ? w * h : 0;
}

function gapBetween(a: Box, b: Box) {
    const dx = Math.max(
        0,
        Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w),
    );

    const dy = Math.max(
        0,
        Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h),
    );

    return Math.hypot(dx, dy);
}

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

function isOn(small: Box, surface: Box) {
    const cx = small.x + small.w / 2;
    const cy = small.y + small.h / 2;

    return (
        cx > surface.x + surface.w * 0.15 &&
        cx < surface.x + surface.w * 0.85 &&
        cy > surface.y + surface.h * 0.2 &&
        cy < surface.y + surface.h * 0.8
    );
}

function toObjects(ids: string[], size: Size, variant: Variant): Obj[] {
    const result: Obj[] = [];

    for (const id of ids) {
        const box = getObjectBox(id, size, variant);

        if (box) {
            result.push({
                id,
                w: box.w,
                h: box.h,
                kind: kindOf(id),
            });
        }
    }

    return result;
}

interface Mode {
    ax: number;
    ay: number;
    angle: number | null;
}

const MODES: Mode[] = [
    {ax: 0.50, ay: 0.50, angle: null},
    {ax: 0.36, ay: 0.46, angle: 0},
    {ax: 0.64, ay: 0.46, angle: Math.PI},
    {ax: 0.50, ay: 0.34, angle: Math.PI / 2},
    {ax: 0.50, ay: 0.66, angle: -Math.PI / 2},
    {ax: 0.38, ay: 0.38, angle: Math.PI / 4},
    {ax: 0.62, ay: 0.62, angle: -Math.PI * 3 / 4},
    {ax: 0.62, ay: 0.38, angle: Math.PI * 3 / 4},
    {ax: 0.38, ay: 0.62, angle: -Math.PI / 4},
];

function attempt(
    mains: Obj[],
    bgs: Obj[],
    W: number,
    H: number,
    rand: () => number,
    mode: Mode,
) {
    const jitter = (v: number) => (rand() - 0.5) * 2 * v;

    const at = (o: Obj, cx: number, cy: number): Box => ({
        x: cx - o.w / 2,
        y: cy - o.h / 2,
        w: o.w,
        h: o.h,
    });

    const dir = mode.angle ?? rand() * Math.PI * 2;

    const mb: Box[] = new Array(mains.length);
    const bb: Box[] = new Array(bgs.length);

    const anchorX = W * (mode.ax + jitter(0.04));
    const anchorY = H * (mode.ay + jitter(0.04));

    let anchor: Box;
    let surface: Box | null = null;
    let anchorMain = -1;

    const bgSurface = bgs.findIndex((o) => o.kind === 'surface');

    if (bgSurface >= 0) {
        anchor = at(bgs[bgSurface], anchorX, anchorY);
        bb[bgSurface] = anchor;
        surface = anchor;
    } else {
        const byArea = mains
            .map((_, i) => i)
            .sort((a, b) => area(mains[b]) - area(mains[a]));

        anchorMain =
            byArea.find((i) => mains[i].kind === 'surface') ??
            byArea.find((i) => mains[i].kind === 'standing') ??
            byArea[0];

        const o = mains[anchorMain];

        anchor = at(o, anchorX, anchorY);
        mb[anchorMain] = anchor;

        if (o.kind === 'surface') surface = anchor;
    }

    const standingMain = mains
        .map((o, i) => ({o, i}))
        .filter(({o}) => o.kind === 'standing')
        .sort((a, b) => area(b.o) - area(a.o))[0];

    const standingBox = standingMain
        ? (standingMain.i === anchorMain
            ? anchor
            : at(standingMain.o, anchorX, anchorY))
        : null;

    const smallTarget = surface ?? standingBox ?? anchor;

    const refs: Box[] = [anchor];

    mains
        .map((_, i) => i)
        .filter((i) => i !== anchorMain)
        .sort((a, b) => area(mains[b]) - area(mains[a]))
        .forEach((i) => {
            const o = mains[i];
            let box: Box;

            if (o.kind === 'small') {
                if (surface) {

                    const a = dir + jitter(1.1);
                    const r = 0.08 + rand() * 0.22;

                    box = at(
                        o,
                        smallTarget.x + smallTarget.w / 2 +
                        Math.cos(a) * smallTarget.w * r,
                        smallTarget.y + smallTarget.h / 2 +
                        Math.sin(a) * smallTarget.h * r,
                    );
                } else if (standingBox) {

                    const a = Math.PI / 2 + jitter(0.75);
                    const r = 0.78 + rand() * 0.2;

                    box = at(
                        o,
                        smallTarget.x + smallTarget.w / 2 +
                        Math.cos(a) *
                        ((smallTarget.w + o.w) / 2) * r,
                        smallTarget.y + smallTarget.h / 2 +
                        Math.sin(a) *
                        ((smallTarget.h + o.h) / 2) * r,
                    );
                } else {
                    const a = dir + jitter(1.1);
                    const r = 0.2 + rand() * 0.15;

                    box = at(
                        o,
                        anchor.x + anchor.w / 2 +
                        Math.cos(a) * anchor.w * r,
                        anchor.y + anchor.h / 2 +
                        Math.sin(a) * anchor.h * r,
                    );
                }
            } else {

                const ref = refs[Math.floor(rand() * refs.length)];
                const a = dir + jitter(1.1);
                const f = 0.7 + rand() * 0.3;

                box = at(
                    o,
                    ref.x + ref.w / 2 +
                    Math.cos(a) * ((ref.w + o.w) / 2) * f,
                    ref.y + ref.h / 2 +
                    Math.sin(a) * ((ref.h + o.h) / 2) * f,
                );
            }

            mb[i] = box;
            refs.push(box);
        });

    bgs.forEach((o, i) => {
        if (bb[i]) return;

        const side = rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        const a = dir + side + jitter(0.8);
        const k = 0.32 + rand() * 0.2;

        bb[i] = at(
            o,
            W * (0.5 + Math.cos(a) * k),
            H * (0.5 + Math.sin(a) * k),
        );
    });

    return {mb, bb};
}

function score(
    mains: Obj[],
    mb: Box[],
    bgs: Obj[],
    bb: Box[],
    W: number,
    H: number,
) {
    const canvas: Box = {x: 0, y: 0, w: W, h: H};
    const diag = Math.max(W, H);

    let s = 0;

    mains.forEach((o, i) => {
        const v = overlapArea(mb[i], canvas) / area(mb[i]);

        const min =
            o.kind === 'small' ? 0.9 :
                o.kind === 'standing' ? 0.8 :
                    0.65;

        if (v < min) {
            const penalty = o.kind === 'small' ? 22 : 12;
            s -= (min - v) * penalty;
        }

        s += v * 0.5;
    });

    const covered = [
        ...mb,
        ...bb.filter((_, i) => bgs[i].kind === 'surface'),
    ];

    const cov = coverage(covered, W, H);

    if (cov < 0.55) s -= (0.55 - cov) * 5;
    if (cov > 0.9) s -= (cov - 0.9) * 3;

    for (let i = 0; i < mains.length; i++) {
        for (let j = i + 1; j < mains.length; j++) {
            const a = mains[i];
            const b = mains[j];

            const ov =
                overlapArea(mb[i], mb[j]) /
                Math.min(area(mb[i]), area(mb[j]));

            const gap = gapBetween(mb[i], mb[j]);
            const smallPair = a.kind === 'small' || b.kind === 'small';
            const standingPair =
                a.kind === 'standing' && b.kind === 'standing';

            if (standingPair) {
                if (ov > 0.08) s -= (ov - 0.08) * 14;
            } else if (smallPair) {
                const smallKind = a.kind === 'small' ? b.kind : a.kind;

                if (smallKind === 'standing') {
                    if (ov > 0.55) s -= (ov - 0.55) * 9;
                    s += Math.max(0, 1 - gap / (diag * 0.16)) * 1.8;
                } else if (smallKind === 'surface') {
                    if (ov > 0.65) s -= (ov - 0.65) * 8;

                    const [smallBox, surfaceBox] =
                        a.kind === 'small'
                            ? [mb[i], mb[j]]
                            : [mb[j], mb[i]];

                    if (isOn(smallBox, surfaceBox)) s += 1.2;

                    s += Math.max(0, 1 - gap / (diag * 0.18)) * 1.2;
                } else {
                    if (ov > 0.35) s -= (ov - 0.35) * 8;
                }
            } else if (a.kind === 'surface' && b.kind === 'surface') {
                if (ov > 0.1) s -= (ov - 0.1) * 10;
            }

            s -= (gap / diag) * 6;
        }
    }

    const total = mb.reduce((sum, b) => sum + area(b), 0);

    if (total > 0) {
        const cx = mb.reduce(
            (sum, b) => sum + (b.x + b.w / 2) * area(b),
            0,
        ) / total;

        const cy = mb.reduce(
            (sum, b) => sum + (b.y + b.h / 2) * area(b),
            0,
        ) / total;

        s -= (Math.hypot(cx - W / 2, cy - H / 2) / diag) * 2;
    }

    bgs.forEach((o, i) => {
        const v = overlapArea(bb[i], canvas) / area(bb[i]);

        const min =
            o.kind === 'small' ? 0.85 :
                o.kind === 'standing' ? 0.65 :
                    0.45;

        if (v < min) {
            s -= (min - v) * (o.kind === 'small' ? 12 : 4);
        }

        if (o.kind === 'surface') {
            mains.forEach((m, j) => {
                if (m.kind === 'small' && isOn(mb[j], bb[i])) {
                    s += 0.8;
                }
            });
        } else {
            const open = openShare(bb[i], mb, W, H);

            if (open < 0.35) {
                s -= (0.35 - open) * 4;
            }
        }

        for (let j = i + 1; j < bgs.length; j++) {
            const ov =
                overlapArea(bb[i], bb[j]) /
                Math.min(area(bb[i]), area(bb[j]));

            if (ov > 0.3) s -= (ov - 0.3) * 6;
        }
    });

    return s;
}

function shuffle<T>(arr: T[], rand: () => number) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

export function buildComposition({
                                     mainIds,
                                     bgCount,
                                     size,
                                     format,
                                     bgId,
                                     seed,
                                 }: Params): SceneItem[] {
    const {w: W, h: H} = getFormatSize(bgId, size, format);
    const rand = mulberry32(seed * 7919 + 13);

    const mains = toObjects(mainIds.slice(0, MAX_MAIN), size, 'main');

    if (!mains.length) return [];

    const hasSurface = mains.some((o) => o.kind === 'surface');
    const hasSmall = mains.some((o) => o.kind === 'small');

    const prefer: Kind[] =
        !hasSurface && hasSmall && rand() < 0.65
            ? ['surface', 'standing', 'small']
            : ['standing', 'small', 'surface'];

    const mainSet = new Set(mains.map((o) => o.id));

    const pool = objects
        .map((o) => o.id)
        .filter(
            (id) =>
                !mainSet.has(id) &&
                getObjectBox(id, size, 'bg'),
        );

    shuffle(pool, rand);

    pool.sort(
        (a, b) =>
            prefer.indexOf(kindOf(a)) - prefer.indexOf(kindOf(b)),
    );

    const bgIds: string[] = [];

    for (const id of pool) {
        if (bgIds.length >= Math.min(bgCount, MAX_BG)) break;

        if (
            kindOf(id) === 'surface' &&
            bgIds.some((x) => kindOf(x) === 'surface')
        ) {
            continue;
        }

        bgIds.push(id);
    }

    const bgs = toObjects(bgIds, size, 'bg');

    const mode =
        MODES[((seed % MODES.length) + MODES.length) % MODES.length];

    const scored: { s: number; mb: Box[]; bb: Box[] }[] = [];

    for (let k = 0; k < ATTEMPTS; k++) {
        const {mb, bb} = attempt(mains, bgs, W, H, rand, mode);

        scored.push({
            s: score(mains, mb, bgs, bb, W, H),
            mb,
            bb,
        });
    }

    scored.sort((a, b) => b.s - a.s);

    const chosen =
        scored[Math.floor(rand() * Math.min(3, scored.length))];

    if (!chosen) return [];

    const toItem = (
        id: string,
        variant: Variant,
        box: Box,
    ): SceneItem => ({
        uid: crypto.randomUUID(),
        objectId: id,
        variant,
        x: Math.round(box.x),
        y: Math.round(box.y),
        rotation: 0,
    });

    const byLayer = (a: Placed, b: Placed) =>
        KIND_ORDER[a.o.kind] - KIND_ORDER[b.o.kind] ||
        area(b.box) - area(a.box);

    const items: SceneItem[] = [];

    bgs
        .map((o, i): Placed => ({o, box: chosen.bb[i]}))
        .sort(byLayer)
        .forEach(({o, box}) => {
            items.push(toItem(o.id, 'bg', box));
        });

    mains
        .map((o, i): Placed => ({o, box: chosen.mb[i]}))
        .sort(byLayer)
        .forEach(({o, box}) => {
            items.push(toItem(o.id, 'main', box));
        });

    return items;
}
