import {objects} from './library';
import {norm, stemMatch} from './parseComponents';
import {MAX_MAIN} from './layout';
import dictionary from '../data/metaphors.json';

interface Entry {
    keywords: string[];
    ids: string[];
    reason: string;
}

export interface MetaphorResult {
    ids: string[];
    source: 'dictionary' | 'tags';
    reason: string;
}

const entries = dictionary as Entry[];
const valid = new Set(objects.map((o) => o.id));

const STOP = new Set([
    'как', 'для', 'что', 'это', 'или', 'при', 'про', 'над', 'под', 'без', 'его', 'она', 'они', 'the', 'and', 'for',
]);

const tokenize = (query: string) =>
    norm(query)
        .split(/[^a-zа-я0-9]+/)
        .filter((t) => t.length >= 3 && !STOP.has(t));

/**
 * Смысловой подбор: словарь метафор (вес выше) + теги объектов.
 * Словарь подготовлен с помощью ИИ при разработке, в рантайме внешних запросов нет.
 */
export async function interpretMetaphor(query: string): Promise<MetaphorResult> {
    const tokens = tokenize(query);
    const scores = new Map<string, number>();
    const add = (id: string, value: number) => scores.set(id, (scores.get(id) ?? 0) + value);

    let best: { entry: Entry; hits: number } | null = null;

    for (const entry of entries) {
        const hits = tokens.filter((t) => entry.keywords.some((k) => stemMatch(t, norm(k)))).length;
        if (!hits) continue;
        entry.ids.filter((id) => valid.has(id)).forEach((id, i) => add(id, hits * 3 - i * 0.1));
        if (!best || hits > best.hits) best = {entry, hits};
    }

    for (const o of objects) {
        const tags = o.tags.map(norm);
        const hits = tokens.filter((t) => tags.some((tag) => stemMatch(t, tag))).length;
        if (hits) add(o.id, hits);
    }

    const ids = [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_MAIN)
        .map(([id]) => id);

    return {
        ids,
        source: best ? 'dictionary' : 'tags',
        reason: best?.entry.reason ?? (ids.length ? 'Подобрано по ключевым словам.' : ''),
    };
}