import manifestJson from '../assets/library/manifest.json';
import backgroundsJson from '../assets/library/backgrounds.json';
import type { LibraryObject, Size, Variant } from '../types';

// Все SVG подтягиваются на этапе сборки как строки
const rawFiles = import.meta.glob('../assets/library/**/*.svg', {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>;

const svgByPath = new Map<string, string>();
for (const [key, svg] of Object.entries(rawFiles)) {
    svgByPath.set(key.replace('../assets/library/', ''), svg);
}

export const objects = manifestJson as unknown as LibraryObject[];

type BackgroundsIndex = Record<string, Partial<Record<Size, { file: string; w: number; h: number }>>>;
const backgrounds = backgroundsJson as unknown as BackgroundsIndex;

export function getObject(id: string): LibraryObject | undefined {
    return objects.find((o) => o.id === id);
}

/** Какие состояния есть у объекта в этом размере */
export function getVariants(id: string, size: Size): Variant[] {
    const files = getObject(id)?.files[size] ?? {};
    return (Object.keys(files) as Variant[]).filter((v) => files[v]);
}

/** Исходный SVG объекта (с data-role, без перекраски) */
export function getObjectSvg(id: string, size: Size, variant: Variant): string | undefined {
    const path = getObject(id)?.files[size]?.[variant];
    return path ? svgByPath.get(path) : undefined;
}

export function getObjectBox(id: string, size: Size, variant: Variant) {
    return getObject(id)?.viewBox[size]?.[variant];
}

function bgEntry(bgId: string, size: Size) {
    return backgrounds[bgId]?.[size] ?? backgrounds[Object.keys(backgrounds)[0]]?.[size];
}

/** Исходный SVG фона палитры для размера */
export function getBackgroundSvg(bgId: string, size: Size): string | undefined {
    const file = bgEntry(bgId, size)?.file;
    return file ? svgByPath.get(file) : undefined;
}

/** Размер холста берём из фона: L = 1000, S = 500 */
export function getCanvasSize(bgId: string, size: Size): { w: number; h: number } {
    const bg = bgEntry(bgId, size);
    if (bg) return { w: bg.w, h: bg.h };
    const fallback = size === 'L' ? 1000 : 500;
    return { w: fallback, h: fallback };
}
/** Делит SVG на viewBox и внутреннее содержимое (понадобится при сборке сцены и экспорте) */
export function parseSvg(svg: string): { w: number; h: number; inner: string } {
    const match = svg.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/);
    if (!match) throw new Error('Некорректный SVG: нет viewBox');
    const [, , w, h] = match[1].trim().split(/\s+/).map(Number);
    return { w, h, inner: match[2] };
}