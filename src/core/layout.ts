import type { Format, SceneItem, Size } from '../types';
import { getObjectBox, objects } from './library';
import { getFormatSize } from './formats';

type Slot = [number, number]; // центр объекта: доли ширины и высоты холста

// Слоты для главных объектов. Порядок: от самого крупного объекта к самому мелкому
const MAIN: Record<Format, Record<number, Slot[][]>> = {
    square: {
        1: [[[0.5, 0.5]]],
        2: [
            [[0.5, 0.36], [0.46, 0.68]],
            [[0.56, 0.62], [0.38, 0.32]],
        ],
        3: [
            [[0.5, 0.3], [0.4, 0.6], [0.72, 0.74]],
            [[0.45, 0.45], [0.72, 0.26], [0.3, 0.76]],
        ],
        4: [
            [[0.5, 0.28], [0.35, 0.55], [0.72, 0.52], [0.55, 0.8]],
            [[0.3, 0.3], [0.7, 0.32], [0.35, 0.72], [0.72, 0.74]],
        ],
    },
    landscape: {
        1: [[[0.5, 0.5]]],
        2: [
            [[0.34, 0.5], [0.68, 0.52]],
            [[0.6, 0.44], [0.3, 0.64]],
        ],
        3: [
            [[0.5, 0.42], [0.22, 0.62], [0.8, 0.62]],
            [[0.28, 0.5], [0.58, 0.42], [0.84, 0.64]],
        ],
        4: [
            [[0.5, 0.4], [0.2, 0.62], [0.8, 0.6], [0.64, 0.8]],
            [[0.25, 0.4], [0.55, 0.5], [0.82, 0.35], [0.75, 0.8]],
        ],
    },
    portrait: {
        1: [[[0.5, 0.5]]],
        2: [
            [[0.5, 0.3], [0.5, 0.7]],
            [[0.45, 0.62], [0.55, 0.3]],
        ],
        3: [
            [[0.5, 0.5], [0.45, 0.18], [0.6, 0.82]],
            [[0.5, 0.25], [0.45, 0.55], [0.58, 0.82]],
        ],
        4: [
            [[0.5, 0.5], [0.4, 0.15], [0.62, 0.3], [0.5, 0.85]],
            [[0.5, 0.22], [0.4, 0.45], [0.62, 0.65], [0.5, 0.86]],
        ],
    },
};

// Слоты для фоновых объектов: ближе к краям, часть объекта уходит за рамку
const BG: Record<Format, Slot[]> = {
    square:    [[0.12, 0.15], [0.88, 0.86], [0.9, 0.12]],
    landscape: [[0.08, 0.22], [0.92, 0.8], [0.5, 0.95]],
    portrait:  [[0.15, 0.1], [0.85, 0.9], [0.1, 0.7]],
};

export const MAX_MAIN = 4;
export const MAX_BG = 3;

/** Детерминированный генератор: один seed → одна и та же композиция */
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

interface Params {
    mainIds: string[];
    bgCount: number;
    size: Size;
    format: Format;
    bgId: string;
    seed: number;
}

/** Раскладка: фоновые объекты сзади, главные сверху (крупные ниже, мелкие выше) */
export function buildComposition({ mainIds, bgCount, size, format, bgId, seed }: Params): SceneItem[] {
    const ids = mainIds.slice(0, MAX_MAIN);
    if (!ids.length) return [];

    const canvas = getFormatSize(bgId, size, format);
    const area = (id: string) => {
        const b = getObjectBox(id, size, 'main');
        return b ? b.w * b.h : 0;
    };
    const sorted = [...ids].sort((a, b) => area(b) - area(a));

    const variants = MAIN[format][sorted.length];
    const slots = variants[seed % variants.length];

    const place = (id: string, variant: 'main' | 'bg', [cx, cy]: Slot): SceneItem | null => {
        const box = getObjectBox(id, size, variant);
        if (!box) return null;
        return {
            uid: crypto.randomUUID(),
            objectId: id,
            variant,
            x: Math.round(cx * canvas.w - box.w / 2),
            y: Math.round(cy * canvas.h - box.h / 2),
            rotation: 0,
        };
    };

    // Фоновые: случайные из оставшихся объектов (с учётом seed)
    const rand = mulberry32(seed + 1);
    const rest = objects.map((o) => o.id).filter((id) => !ids.includes(id));
    for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const bgSlots = [...BG[format]];
    const shift = seed % bgSlots.length;
    const rotated = [...bgSlots.slice(shift), ...bgSlots.slice(0, shift)];
    const bgIds = rest.slice(0, Math.min(bgCount, MAX_BG));

    const items: SceneItem[] = [];
    bgIds.forEach((id, i) => {
        const item = place(id, 'bg', rotated[i]);
        if (item) items.push(item);
    });
    sorted.forEach((id, i) => {
        const item = place(id, 'main', slots[i]);
        if (item) items.push(item);
    });
    return items;
}