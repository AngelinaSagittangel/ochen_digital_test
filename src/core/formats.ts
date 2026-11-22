import type { Format, Size } from '../types';
import { getCanvasSize } from './library';

const BASE: Record<Format, { label: string; w: number; h: number }> = {
    square:    { label: 'Квадрат',     w: 1000, h: 1000 },
    landscape: { label: 'Горизонталь', w: 1200, h: 630 },
    portrait:  { label: 'Вертикаль',   w: 800,  h: 1200 },
};

export const FORMATS = BASE;

export function getFormatSize(bgId: string, size: Size, format: Format) {
    const k = getCanvasSize(bgId, size).w / 1000;
    return { w: Math.round(BASE[format].w * k), h: Math.round(BASE[format].h * k) };
}

export function getBackgroundTransform(bgId: string, size: Size, format: Format): string {
    const base = getCanvasSize(bgId, size);
    const c = getFormatSize(bgId, size, format);
    const scale = Math.max(c.w / base.w, c.h / base.h);
    const tx = (c.w - base.w * scale) / 2;
    const ty = (c.h - base.h * scale) / 2;
    const r = (n: number) => Math.round(n * 1000) / 1000;
    return `translate(${r(tx)} ${r(ty)}) scale(${r(scale)})`;
}

export function getBackgroundScale(bgId: string, size: Size, format: Format): number {
    const base = getCanvasSize(bgId, size);
    const c = getFormatSize(bgId, size, format);
    return Math.max(c.w / base.w, c.h / base.h);
}

export function keepStrokeWidth(markup: string, scale: number): string {
    if (Math.abs(scale - 1) < 0.001) return markup;
    return markup.replace(
        /stroke-width="([\d.]+)"/g,
        (_, v) => `stroke-width="${Math.round((Number(v) / scale) * 100) / 100}"`,
    );
}