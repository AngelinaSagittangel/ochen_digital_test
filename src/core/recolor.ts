import type { Palette, Role, Variant } from '../types';

// Формат, который создаёт prepare-library.mjs: fill="#HEX" data-fill="role" (то же для stroke)
const ROLE_ATTR = /\b(fill|stroke)="[^"]*"\s+data-\1="([^"]+)"/g;

export type SvgKind = Variant | 'background';

/**
 * Перекрашивает SVG под палитру. Геометрия не трогается, меняются только fill и stroke.
 * Правило: у фоновых объектов и фонов нельзя использовать цвета объектов (obj-*).
 */
export function recolorSvg(svg: string, palette: Palette, kind: SvgKind = 'main'): string {
    return svg.replace(ROLE_ATTR, (match, attr: string, role: string) => {
        if (kind !== 'main' && role.startsWith('obj-')) {
            throw new Error(`Нарушена цветовая схема: роль ${role} в элементе типа "${kind}"`);
        }
        const color = palette.colors[role as Role];
        if (!color) {
            console.warn(`В палитре "${palette.id}" нет цвета для роли "${role}"`);
            return match;
        }
        return `${attr}="${color}" data-${attr}="${role}"`;
    });
}

/** Роли, которые встречаются в SVG */
export function getRoles(svg: string): Role[] {
    const roles = new Set<Role>();
    for (const m of svg.matchAll(ROLE_ATTR)) roles.add(m[2] as Role);
    return [...roles];
}