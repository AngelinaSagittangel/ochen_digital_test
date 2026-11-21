import { objects } from './library';

export const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();

/** Совпадение по основе слова: «телефона» ≈ «телефон», «пазлы» ≈ «пазл» */
export function stemMatch(a: string, b: string): boolean {
    if (a === b) return true;
    const m = Math.min(a.length, b.length);
    if (m < 3) return false;
    let i = 0;
    while (i < m && a[i] === b[i]) i++;
    return i >= Math.max(3, m - 2);
}

function findObject(token: string): string | null {
    for (const o of objects) {
        const names = [o.id, o.title.ru, o.title.en].map(norm);
        if (names.some((n) => stemMatch(token, n))) return o.id;
        // теги: только точное совпадение, иначе слишком много случайных попаданий
        if (o.tags.map(norm).includes(token)) return o.id;
    }
    return null;
}

/** «телефон, пазл и книга» → { ids: ['phone','puzzles','book'], unknown: [] } */
export function parseComponents(text: string): { ids: string[]; unknown: string[] } {
    const stop = new Set(['и', 'с', 'and', 'the']);
    const tokens = norm(text).split(/[\s,;+/]+/).filter((t) => t && !stop.has(t));

    const ids: string[] = [];
    const unknown: string[] = [];
    for (const t of tokens) {
        const id = findObject(t);
        if (!id) unknown.push(t);
        else if (!ids.includes(id)) ids.push(id);
    }
    return { ids, unknown };
}