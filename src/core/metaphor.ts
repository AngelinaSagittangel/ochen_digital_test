import {objects} from './library';
import {norm, stemMatch} from './parseComponents';
import {MAX_MAIN} from './layout';
import dictionary from '../data/metaphors.json';

interface Entry {
    keywords: string[];
    phrases?: string[];
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
    'как', 'для', 'что', 'это', 'или', 'при', 'про',
    'над', 'под', 'без', 'его', 'она', 'они',
    'хочу', 'нужно', 'можно', 'мой', 'моя', 'мои',
    'the', 'and', 'for', 'with',
]);

function normalizeText(value: string): string {
    return norm(value)
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function tokenize(query: string): string[] {
    return [...new Set(
        normalizeText(query)
            .split(' ')
            .filter((token) => token.length >= 3 && !STOP.has(token)),
    )];
}

function matchesKeyword(token: string, keyword: string): boolean {
    const normalized = normalizeText(keyword);
    return token === normalized || stemMatch(token, normalized);
}

function matchesTitle(token: string, title: string): boolean {
    const normalized = normalizeText(title);
    return token === normalized || stemMatch(token, normalized);
}

function getEntryScore(entry: Entry, query: string, tokens: string[]) {
    const phrases = (entry.phrases ?? [])
        .map(normalizeText)
        .filter(Boolean);

    const phraseMatches = phrases.filter((phrase) =>
        query.includes(phrase),
    );

    const keywordHits = tokens.filter((token) =>
        entry.keywords.some((keyword) => matchesKeyword(token, keyword)),
    ).length;

    // Целая фраза важнее отдельных совпавших слов.
    const phraseScore = phraseMatches.reduce(
        (score, phrase) => score + 100 + phrase.split(' ').length * 10,
        0,
    );

    return {
        score: phraseScore + keywordHits * 10,
        phraseMatches: phraseMatches.length,
        keywordHits,
    };
}

export async function interpretMetaphor(
    query: string,
): Promise<MetaphorResult> {
    const normalizedQuery = normalizeText(query);
    const tokens = tokenize(query);

    if (!tokens.length) {
        return {
            ids: [],
            source: 'tags',
            reason: 'Введите описание идеи или задачи.',
        };
    }

    // 1. Ищем наиболее подходящую метафору в словаре.
    let best: {
        entry: Entry;
        score: number;
        phraseMatches: number;
        keywordHits: number;
    } | null = null;

    for (const entry of entries) {
        const result = getEntryScore(entry, normalizedQuery, tokens);

        if (
            result.score > 0 &&
            (
                !best ||
                result.score > best.score ||
                (
                    result.score === best.score &&
                    result.phraseMatches > best.phraseMatches
                )
            )
        ) {
            best = {
                entry,
                ...result,
            };
        }
    }

    // 2. Если нашли запись словаря, не смешиваем её с тегами.
    if (best) {
        return {
            ids: best.entry.ids
                .filter((id) => valid.has(id))
                .slice(0, MAX_MAIN),
            source: 'dictionary',
            reason: best.entry.reason,
        };
    }

    // 3. Резервный поиск по названиям и тегам.
    const matches: { id: string; score: number }[] = [];

    for (const object of objects) {
        const titleMatches = tokens.some((token) =>
            matchesTitle(token, object.title.ru) ||
            matchesTitle(token, object.title.en) ||
            token === normalizeText(object.id),
        );

        if (titleMatches) {
            matches.push({id: object.id, score: 100});
            continue;
        }

        const tags = object.tags.map(normalizeText);

        const hits = tokens.filter((token) =>
            tags.some((tag) => matchesKeyword(token, tag)),
        ).length;

        // Одного общего совпадения по тегу недостаточно.
        if (hits >= 2) {
            matches.push({id: object.id, score: hits});
        }
    }

    const ids = matches
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_MAIN)
        .map(({id}) => id);

    return {
        ids,
        source: 'tags',
        reason: ids.length
            ? 'Подобрано по совпадениям с названиями и тегами объектов.'
            : 'Не удалось подобрать объекты. Попробуйте описать идею другими словами.',
    };
}
