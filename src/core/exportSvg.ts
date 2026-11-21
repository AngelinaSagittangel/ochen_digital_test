import type {Palette, SceneItem, Size, Format} from '../types';
import {
    getBackgroundSvg, getObject, getObjectBox, getObjectSvg, parseSvg,
} from './library';
import {recolorSvg} from './recolor';
import {bgIdOf} from './palettes';
import {getBackgroundScale, getBackgroundTransform, getFormatSize, keepStrokeWidth} from './formats';

const round = (n: number) => Math.round(n * 100) / 100;

/** Добавляет префикс ко всем id и ссылкам на них (url(#...), href="#..."), чтобы id не пересекались */
function prefixIds(markup: string, prefix: string): string {
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    let out = markup;
    for (const id of ids) {
        const next = `${prefix}-${id}`;
        out = out
            .replaceAll(`id="${id}"`, `id="${next}"`)
            .replaceAll(`url(#${id})`, `url(#${next})`)
            .replaceAll(`href="#${id}"`, `href="#${next}"`);
    }
    return out;
}

interface ExportParams {
    items: SceneItem[];
    size: Size;
    format: Format;
    palette: Palette;
}

/** Собирает итоговый SVG композиции. Объекты берутся из библиотеки как есть: меняется только transform */
export function buildSceneSvg({items, size, format, palette}: ExportParams): string {
    const bgId = bgIdOf(palette);
    const canvas = getFormatSize(bgId, size, format);
    const bgTransform = getBackgroundTransform(bgId, size, format);
    const parts: string[] = [];

    // Фон
    const bgSvg = getBackgroundSvg(bgId, size);
    if (bgSvg) {
        const {inner} = parseSvg(recolorSvg(bgSvg, palette, 'background'));
        const bgInner = keepStrokeWidth(inner, getBackgroundScale(bgId, size, format));
        parts.push(`<g id="background" transform="${bgTransform}">${prefixIds(bgInner, 'bg')}</g>`);
    }

    // Объекты в порядке слоёв (последний сверху)
    items.forEach((item, index) => {
        const svg = getObjectSvg(item.objectId, size, item.variant);
        const box = getObjectBox(item.objectId, size, item.variant);
        if (!svg || !box) return;

        const {inner} = parseSvg(recolorSvg(svg, palette, item.variant));
        const name = `item-${index + 1}-${item.objectId}-${item.variant}`;
        const transform =
            `translate(${round(item.x)} ${round(item.y)})` +
            (item.rotation ? ` rotate(${round(item.rotation)} ${round(box.w / 2)} ${round(box.h / 2)})` : '');

        parts.push(
            `<g id="${name}" data-object="${item.objectId}" data-variant="${item.variant}" transform="${transform}">` +
            prefixIds(inner, `i${index + 1}`) +
            `</g>`,
        );
    });

    const title = getObject(items[0]?.objectId ?? '')?.title.ru ?? 'Композиция';

    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.w}" height="${canvas.h}" viewBox="0 0 ${canvas.w} ${canvas.h}" fill="none">`,
        `<title>${title}</title>`,
        `<defs><clipPath id="scene-clip"><rect width="${canvas.w}" height="${canvas.h}"/></clipPath></defs>`,
        `<g id="composition" clip-path="url(#scene-clip)">`,
        ...parts,
        `</g>`,
        `</svg>`,
    ].join('\n');
}

export function downloadSvg(svg: string, filename: string) {
    const blob = new Blob([svg], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

