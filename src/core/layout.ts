import type {Format, SceneItem, Size, Variant} from '../types';
import {getObjectBox, objects} from './library';
import {getFormatSize} from './formats';

export const MAX_MAIN = 4;
export const MAX_BG = 3;

interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface ObjectData {
    id: string;
    w: number;
    h: number;
}

interface Point {
    x: number;
    y: number;
}

interface Params {
    mainIds: string[];
    bgCount: number;
    size: Size;
    format: Format;
    bgId: string;
    seed: number;
}

const area = (box: Box) => box.w * box.h;

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

function getObjects(
    ids: string[],
    size: Size,
    variant: Variant,
): ObjectData[] {
    return ids.flatMap((id) => {
        const box = getObjectBox(id, size, variant);

        return box
            ? [{id, w: box.w, h: box.h}]
            : [];
    });
}

/** Позиция объекта задаётся его центром */
function centeredBox(
    object: ObjectData,
    cx: number,
    cy: number,
): Box {
    return {
        x: cx - object.w / 2,
        y: cy - object.h / 2,
        w: object.w,
        h: object.h,
    };
}

/** Удерживает объект внутри холста */
function keepInside(box: Box, W: number, H: number): Box {
    return {
        ...box,
        x: Math.max(0, Math.min(box.x, Math.max(0, W - box.w))),
        y: Math.max(0, Math.min(box.y, Math.max(0, H - box.h))),
    };
}

/** Сдвигает группу к центру, не меняя размеры объектов */
function centerGroup(
    boxes: Box[],
    W: number,
    H: number,
): Box[] {
    if (!boxes.length) return boxes;

    const minX = Math.min(...boxes.map((box) => box.x));
    const minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.w));
    const maxY = Math.max(...boxes.map((box) => box.y + box.h));

    const groupW = maxX - minX;
    const groupH = maxY - minY;

    const marginX = W * 0.04;
    const marginY = H * 0.04;

    let dx = W / 2 - (minX + groupW / 2);
    let dy = H / 2 - (minY + groupH / 2);

    if (groupW <= W - marginX * 2) {
        dx = Math.max(
            marginX - minX,
            Math.min(dx, W - marginX - maxX),
        );
    }

    if (groupH <= H - marginY * 2) {
        dy = Math.max(
            marginY - minY,
            Math.min(dy, H - marginY - maxY),
        );
    }

    return boxes.map((box) => ({
        ...box,
        x: box.x + dx,
        y: box.y + dy,
    }));
}

/**
 * Варианты расположения главных объектов.
 * Координаты указаны относительно размеров холста.
 */
const MAIN_LAYOUTS: Record<number, Point[][]> = {
    1: [
        [{x: 0.44, y: 0.46}],
        [{x: 0.56, y: 0.46}],
        [{x: 0.50, y: 0.42}],
        [{x: 0.50, y: 0.56}],
    ],

    2: [
        [{x: 0.35, y: 0.40}, {x: 0.65, y: 0.60}],
        [{x: 0.35, y: 0.60}, {x: 0.65, y: 0.40}],
        [{x: 0.50, y: 0.34}, {x: 0.50, y: 0.66}],
        [{x: 0.34, y: 0.50}, {x: 0.66, y: 0.50}],
    ],

    3: [
        [{x: 0.50, y: 0.34}, {x: 0.34, y: 0.68}, {x: 0.66, y: 0.68}],
        [{x: 0.50, y: 0.66}, {x: 0.34, y: 0.32}, {x: 0.66, y: 0.32}],
        [{x: 0.30, y: 0.50}, {x: 0.50, y: 0.50}, {x: 0.70, y: 0.50}],
        [{x: 0.50, y: 0.28}, {x: 0.50, y: 0.50}, {x: 0.50, y: 0.72}],
    ],

    4: [
        [
            {x: 0.34, y: 0.34},
            {x: 0.66, y: 0.34},
            {x: 0.34, y: 0.66},
            {x: 0.66, y: 0.66},
        ],
        [
            {x: 0.50, y: 0.28},
            {x: 0.72, y: 0.50},
            {x: 0.50, y: 0.72},
            {x: 0.28, y: 0.50},
        ],
        [
            {x: 0.32, y: 0.38},
            {x: 0.68, y: 0.38},
            {x: 0.32, y: 0.62},
            {x: 0.68, y: 0.62},
        ],
        [
            {x: 0.28, y: 0.50},
            {x: 0.48, y: 0.34},
            {x: 0.72, y: 0.50},
            {x: 0.52, y: 0.66},
        ],
    ],
};

function getMainPositions(
    objects: ObjectData[],
    W: number,
    H: number,
    seed: number,
): Box[] {
    const count = objects.length;
    const layouts = MAIN_LAYOUTS[count];

    if (!layouts) return [];

    // Следующий seed выбирает следующий вариант композиции.
    const layoutIndex = Math.abs(seed) % layouts.length;
    const layout = layouts[layoutIndex];

    const rand = mulberry32(seed * 7919 + 31);

    const boxes = objects.map((object, index) => {
        const point = layout[index];

        // Небольшое изменение координат добавляет разнообразия,
        // не разрушая общую структуру композиции.
        const jitterX = (rand() - 0.5) * 0.025;
        const jitterY = (rand() - 0.5) * 0.025;

        return centeredBox(
            object,
            W * (point.x + jitterX),
            H * (point.y + jitterY),
        );
    });

    // Для одного объекта сохраняем небольшое смещение от центра.
    if (count === 1) {
        return boxes.map((box) => keepInside(box, W, H));
    }

    return centerGroup(boxes, W, H);
}

/** Фоновые элементы располагаются вокруг основной группы */
function getBackgroundPositions(
    objects: ObjectData[],
    W: number,
    H: number,
    seed: number,
): Box[] {
    const layouts: Point[][] = [
        [
            {x: 0.14, y: 0.50},
            {x: 0.86, y: 0.50},
            {x: 0.50, y: 0.13},
        ],
        [
            {x: 0.16, y: 0.20},
            {x: 0.84, y: 0.80},
            {x: 0.50, y: 0.13},
        ],
        [
            {x: 0.16, y: 0.80},
            {x: 0.84, y: 0.20},
            {x: 0.50, y: 0.87},
        ],
        [
            {x: 0.50, y: 0.13},
            {x: 0.16, y: 0.50},
            {x: 0.84, y: 0.50},
        ],
    ];

    const layout = layouts[Math.abs(seed) % layouts.length];

    return objects.map((object, index) => {
        const point = layout[index];

        return keepInside(
            centeredBox(object, W * point.x, H * point.y),
            W,
            H,
        );
    });
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

    const mains = getObjects(
        mainIds.slice(0, MAX_MAIN),
        size,
        'main',
    );

    if (!mains.length) return [];

    const rand = mulberry32(seed * 7919 + 13);

    const mainIdSet = new Set(mains.map((object) => object.id));

    const pool = objects
        .map((object) => object.id)
        .filter(
            (id) =>
                !mainIdSet.has(id) &&
                Boolean(getObjectBox(id, size, 'bg')),
        );

    // Перемешиваем доступные фоновые объекты.
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const bgs = getObjects(
        pool.slice(0, Math.min(bgCount, MAX_BG)),
        size,
        'bg',
    );

    const mainBoxes = getMainPositions(mains, W, H, seed);
    const bgBoxes = getBackgroundPositions(bgs, W, H, seed);

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

    const items: SceneItem[] = [];

    // Фоновые объекты рисуются первыми.
    bgs.forEach((object, index) => {
        items.push(toItem(object.id, 'bg', bgBoxes[index]));
    });

    // Крупные главные объекты рисуются раньше мелких.
    mains
        .map((object, index) => ({
            object,
            box: mainBoxes[index],
        }))
        .sort((a, b) => area(b.box) - area(a.box))
        .forEach(({object, box}) => {
            items.push(toItem(object.id, 'main', box));
        });

    return items;
}
