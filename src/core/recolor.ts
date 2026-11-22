import type { Palette, Role, Variant } from '../types';

const ROLE_ATTR = /\b(fill|stroke)="[^"]*"\s+data-\1="([^"]+)"/g;

export type SvgKind = Variant | 'background';

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

export function getRoles(svg: string): Role[] {
    const roles = new Set<Role>();
    for (const m of svg.matchAll(ROLE_ATTR)) roles.add(m[2] as Role);
    return [...roles];
}