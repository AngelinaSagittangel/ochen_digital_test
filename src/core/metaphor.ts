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
    'которая', 'который', 'которые', 'которое',
    'меня', 'себя', 'свой', 'своя',
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

function matchesWord(token: string, word: string): boolean {
    const normalized = normalizeText(word);

    if (!normalized || normalized.includes(' ')) return false;

    return token === normalized || stemMatch(token, normalized);
}

function phraseMatches(phrase: string, tokens: string[]): boolean {
    const words = tokenize(phrase);

    return words.length > 0 &&
        words.every((word) => tokens.some((token) => matchesWord(token, word)));
}

function getEntryScore(entry: Entry, tokens: string[]) {
    const matched = (entry.phrases ?? []).filter((phrase) =>
        phraseMatches(phrase, tokens),
    );

    const keywordHits = tokens.filter((token) =>
        entry.keywords.some((keyword) => matchesWord(token, keyword)),
    ).length;

    const phraseScore = matched.reduce(
        (score, phrase) => score + 1000 + tokenize(phrase).length * 50,
        0,
    );

    return {
        score: phraseScore + keywordHits * 10,
        phraseMatches: matched.length,
        keywordHits,
    };
}

function matchesTitle(token: string, title: string): boolean {
    return normalizeText(title)
        .split(' ')
        .some((word) => matchesWord(token, word));
}

export async function interpretMetaphor(
    query: string,
): Promise<MetaphorResult> {

    const tokens = tokenize(query);

    if (!tokens.length) {
        return {
            ids: [],
            source: 'tags',
            reason: 'Введите описание идеи или задачи.',
        };
    }

    const minHits = tokens.length <= 2 ? 1 : 2;

    let best: {
        entry: Entry;
        score: number;
        phraseMatches: number;
        keywordHits: number;
    } | null = null;

    for (const entry of entries) {
        const availableIds = entry.ids.filter((id) => valid.has(id));
        if (!availableIds.length) continue;

        const result = getEntryScore(entry, tokens);

        if (!result.phraseMatches && result.keywordHits < minHits) continue;

        if (
            result.score > 0 &&
            (
                !best ||
                result.score > best.score ||
                (result.score === best.score && result.phraseMatches > best.phraseMatches)
            )
        ) {
            best = {entry, ...result};
        }
    }
    if (best) {
        return {
            ids: best.entry.ids
                .filter((id) => valid.has(id))
                .slice(0, MAX_MAIN),
            source: 'dictionary',
            reason: best.entry.reason,
        };
    }

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

        const tags = object.tags.flatMap((tag) =>
            normalizeText(tag).split(' '),
        );

        const hits = tokens.filter((token) =>
            tags.some((tag) => matchesWord(token, tag)),
        ).length;

        if (hits >= minHits) {
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
            : 'Не удалось подобрать подходящие объекты. Попробуйте описать идею другими словами или используйте режим «Компоненты».',
    };
}
