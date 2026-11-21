import type { Format, Size } from '../types';
import { getCanvasSize } from './library';

// Размеры формата для L; для S всё умножается на k = 0.5
const BASE: Record<Format, { label: string; w: number; h: number }> = {
    square:    { label: 'Квадрат',     w: 1000, h: 1000 },
    landscape: { label: 'Горизонталь', w: 1200, h: 630 },
    portrait:  { label: 'Вертикаль',   w: 800,  h: 1200 },
};

export const FORMATS = BASE;

/** Размер холста: L = как в ТЗ, S = в два раза меньше (определяется по фону) */
export function getFormatSize(bgId: string, size: Size, format: Format) {
    const k = getCanvasSize(bgId, size).w / 1000;
    return { w: Math.round(BASE[format].w * k), h: Math.round(BASE[format].h * k) };
}

/** transform для фона: масштаб «cover» + центрирование. Для квадрата это единичное преобразование */
export function getBackgroundTransform(bgId: string, size: Size, format: Format): string {
    const base = getCanvasSize(bgId, size);
    const c = getFormatSize(bgId, size, format);
    const scale = Math.max(c.w / base.w, c.h / base.h);
    const tx = (c.w - base.w * scale) / 2;
    const ty = (c.h - base.h * scale) / 2;
    const r = (n: number) => Math.round(n * 1000) / 1000;
    return `translate(${r(tx)} ${r(ty)}) scale(${r(scale)})`;
}