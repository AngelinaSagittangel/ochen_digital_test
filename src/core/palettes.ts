import type { Palette, Role } from '../types';

const ROLES: Role[] = ['ink', 'paper', 'bg-1', 'bg-2', 'bg-3', 'obj-1', 'obj-2', 'obj-3'];
const HEX = /^#[0-9a-fA-F]{6}$/;

const files = import.meta.glob('../data/palettes/*.json', {
    eager: true,
    import: 'default',
}) as Record<string, Palette>;

export const palettes: Palette[] = Object.values(files);

export function getPalette(id: string): Palette | undefined {
    return palettes.find((p) => p.id === id);
}

/** Проверка палитры (готовой или загруженной). Возвращает список ошибок */
export function validatePalette(raw: unknown): string[] {
    const errors: string[] = [];
    const p = raw as Partial<Palette>;

    if (!p || typeof p !== 'object') return ['Файл не является JSON-объектом'];
    if (!p.id || !/^[a-z0-9-]+$/.test(p.id)) errors.push('Нужен id (латиница, цифры, дефис)');
    if (!p.name) errors.push('Нужно имя палитры');

    for (const role of ROLES) {
        const value = p.colors?.[role];
        if (!value) errors.push(`Не хватает цвета: ${role}`);
        else if (!HEX.test(value)) errors.push(`Цвет ${role} должен быть в формате #RRGGBB`);
    }

    if (p.background !== undefined && typeof p.background !== 'string') {
        errors.push('Поле background должно быть строкой (id готовой схемы)');
    }
    return errors;
}

/** Разбор загруженного JSON-файла палитры */
export function parsePaletteJson(text: string): Palette {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('Файл не является корректным JSON');
    }
    const errors = validatePalette(data);
    if (errors.length) throw new Error(errors.join('\n'));
    return data as Palette;
}

export const bgIdOf = (p: Palette) => p.background ?? p.id;