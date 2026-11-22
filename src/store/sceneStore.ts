import { create } from 'zustand';
import type { Format, Palette, SceneItem, Size, Variant } from '../types';
import { getCanvasSize, getObjectBox, getVariants } from '../core/library';
import { palettes as builtIn, bgIdOf } from '../core/palettes';
import { getFormatSize } from '../core/formats';
import { buildComposition } from '../core/layout';

type Reorder = 'front' | 'back' | 'up' | 'down';

interface AutoSpec {
    mainIds: string[];
    bgCount: number;
    seed: number;
}

interface SceneState {
    size: Size;
    format: Format;
    paletteId: string;
    palettes: Palette[];
    items: SceneItem[];
    selectedId: string | null;
    auto: AutoSpec | null;

    setSize: (size: Size) => void;
    setFormat: (format: Format) => void;
    setPalette: (id: string) => void;
    addPalette: (palette: Palette) => void;
    autoBuild: (mainIds: string[], bgCount: number) => void;
    shuffle: () => void;
    addItem: (objectId: string, variant?: Variant) => void;
    select: (uid: string | null) => void;
    move: (uid: string, x: number, y: number) => void;
    rotate: (uid: string, delta: number) => void;
    duplicate: (uid: string) => void;
    remove: (uid: string) => void;
    toggleVariant: (uid: string) => void;
    reorder: (uid: string, to: Reorder) => void;
    clear: () => void;
}

export const selectPalette = (s: SceneState): Palette =>
    s.palettes.find((p) => p.id === s.paletteId) ?? s.palettes[0];

const canvasOf = (s: SceneState, size: Size = s.size, format: Format = s.format) =>
    getFormatSize(bgIdOf(selectPalette(s)), size, format);

const compose = (s: SceneState, auto: AutoSpec, size: Size = s.size, format: Format = s.format) =>
    buildComposition({
        mainIds: auto.mainIds,
        bgCount: auto.bgCount,
        size,
        format,
        bgId: bgIdOf(selectPalette(s)),
        seed: auto.seed,
    });

export const useSceneStore = create<SceneState>((set) => ({
    size: 'L',
    format: 'square',
    paletteId: builtIn[0].id,
    palettes: builtIn,
    items: [],
    selectedId: null,
    auto: null,

    setSize: (size) =>
        set((s) => {
            if (size === s.size) return s;
            if (s.auto) return { size, items: compose(s, s.auto, size), selectedId: null };
            const bg = bgIdOf(selectPalette(s));
            const k = getCanvasSize(bg, size).w / getCanvasSize(bg, s.size).w;
            return { size, items: s.items.map((i) => ({ ...i, x: i.x * k, y: i.y * k })) };
        }),

    setFormat: (format) =>
        set((s) => {
            if (format === s.format) return s;
            if (s.auto) return { format, items: compose(s, s.auto, s.size, format), selectedId: null };
            const o = canvasOf(s);
            const n = canvasOf(s, s.size, format);
            const dx = (n.w - o.w) / 2;
            const dy = (n.h - o.h) / 2;
            return { format, items: s.items.map((i) => ({ ...i, x: i.x + dx, y: i.y + dy })) };
        }),

    setPalette: (paletteId) => set({ paletteId }),

    addPalette: (palette) =>
        set((s) => ({
            palettes: [...s.palettes.filter((p) => p.id !== palette.id), palette],
            paletteId: palette.id,
        })),

    autoBuild: (mainIds, bgCount) =>
        set((s) => {
            const auto: AutoSpec = { mainIds, bgCount, seed: 0 };
            return { auto, items: compose(s, auto), selectedId: null };
        }),

    shuffle: () =>
        set((s) => {
            if (!s.auto) return s;
            const auto = { ...s.auto, seed: s.auto.seed + 1 };
            return { auto, items: compose(s, auto), selectedId: null };
        }),

    addItem: (objectId, variant = 'main') =>
        set((s) => {
            const box = getObjectBox(objectId, s.size, variant);
            if (!box) return s;
            const canvas = canvasOf(s);
            const item: SceneItem = {
                uid: crypto.randomUUID(),
                objectId,
                variant,
                x: (canvas.w - box.w) / 2,
                y: (canvas.h - box.h) / 2,
                rotation: 0,
            };
            return { items: [...s.items, item], selectedId: item.uid, auto: null };
        }),

    select: (selectedId) => set({ selectedId }),

    move: (uid, x, y) =>
        set((s) => ({ items: s.items.map((i) => (i.uid === uid ? { ...i, x, y } : i)), auto: null })),

    rotate: (uid, delta) =>
        set((s) => ({
            items: s.items.map((i) => (i.uid === uid ? { ...i, rotation: (i.rotation + delta) % 360 } : i)),
            auto: null,
        })),

    duplicate: (uid) =>
        set((s) => {
            const src = s.items.find((i) => i.uid === uid);
            if (!src) return s;
            const shift = s.size === 'L' ? 40 : 20;
            const copy: SceneItem = { ...src, uid: crypto.randomUUID(), x: src.x + shift, y: src.y + shift };
            return { items: [...s.items, copy], selectedId: copy.uid, auto: null };
        }),

    remove: (uid) =>
        set((s) => ({
            items: s.items.filter((i) => i.uid !== uid),
            selectedId: s.selectedId === uid ? null : s.selectedId,
            auto: null,
        })),

    toggleVariant: (uid) =>
        set((s) => ({
            items: s.items.map((i) => {
                if (i.uid !== uid) return i;
                const next: Variant = i.variant === 'main' ? 'bg' : 'main';
                return getVariants(i.objectId, s.size).includes(next) ? { ...i, variant: next } : i;
            }),
            auto: null,
        })),

    reorder: (uid, to) =>
        set((s) => {
            const i = s.items.findIndex((it) => it.uid === uid);
            if (i < 0) return s;
            const arr = [...s.items];
            const [item] = arr.splice(i, 1);
            const j =
                to === 'front' ? arr.length :
                    to === 'back' ? 0 :
                        to === 'up' ? Math.min(i + 1, arr.length) :
                            Math.max(i - 1, 0);
            arr.splice(j, 0, item);
            return { items: arr, auto: null };
        }),

    clear: () => set({ items: [], selectedId: null, auto: null }),
}));