import {useState} from 'react';
import {useSceneStore} from '../../store/sceneStore';
import {parseComponents} from '../../core/parseComponents';
import {interpretMetaphor} from '../../core/metaphor';
import {MAX_BG, MAX_MAIN} from '../../core/layout';
import {getObject, objects} from '../../core/library';

type Mode = 'metaphor' | 'components';

const EXAMPLES = ['рост карьеры', 'идея для стартапа', 'семейный бюджет', 'учёба онлайн'];

const names = (ids: string[]) =>
    ids.map((id) => getObject(id)?.title.ru).join(', ');

export default function AutoBuild() {
    const {autoBuild, shuffle, auto} = useSceneStore();

    const [mode, setMode] = useState<Mode>('metaphor');

    const [metaphorText, setMetaphorText] = useState('');
    const [componentsText, setComponentsText] = useState('');

    const [metaphorNote, setMetaphorNote] = useState<string | null>(null);
    const [componentsNote, setComponentsNote] = useState<string | null>(null);

    const [bgCount, setBgCount] = useState(1);
    const [loading, setLoading] = useState(false);

    const available = objects.map((o) => o.title.ru.toLowerCase()).join(', ');

    const text = mode === 'metaphor' ? metaphorText : componentsText;
    const note = mode === 'metaphor' ? metaphorNote : componentsNote;

    const setText = mode === 'metaphor' ? setMetaphorText : setComponentsText;

    const buildFromComponents = (query: string) => {
        const {ids, unknown} = parseComponents(query);

        if (!ids.length) {
            setComponentsNote(`Не нашла ни одного компонента. Доступны: ${available}.`);
            return;
        }

        const notes: string[] = [];

        if (ids.length > MAX_MAIN) {
            notes.push(`Взяла первые ${MAX_MAIN} объекта.`);
        }

        if (unknown.length) {
            notes.push(`Не распознала: ${unknown.join(', ')}.`);
        }

        setComponentsNote(notes.join(' ') || null);
        autoBuild(ids, bgCount);
    };

    const buildFromMetaphor = async (query: string) => {
        setLoading(true);
        setMetaphorNote(null);

        try {
            const result = await interpretMetaphor(query);

            if (!result.ids.length) {
                setMetaphorNote(
                    'Не нашла подходящих объектов. Попробуйте другими словами или режим «Компоненты».',
                );
                return;
            }

            setMetaphorNote(`${names(result.ids)}. ${result.reason}`.trim());
            autoBuild(result.ids, bgCount);
        } finally {
            setLoading(false);
        }
    };

    const run = (query = text) => {
        if (!query.trim() || (mode === 'metaphor' && loading)) return;

        if (mode === 'metaphor') {
            void buildFromMetaphor(query);
        } else {
            buildFromComponents(query);
        }
    };

    return (
        <div className="auto">
            <h3>Автосборка</h3>

            <div className="row">
                <button
                    className={mode === 'metaphor' ? 'active' : ''}
                    onClick={() => setMode('metaphor')}
                >
                    Метафора
                </button>

                <button
                    className={mode === 'components' ? 'active' : ''}
                    onClick={() => setMode('components')}
                >
                    Компоненты
                </button>
            </div>

            <input
                value={text}
                placeholder={
                    mode === 'metaphor'
                        ? 'Метафора или заголовок'
                        : 'телефон, пазл, книга'
                }
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && run()}
            />

            {mode === 'metaphor' && (
                <div className="row">
                    {EXAMPLES.map((ex) => (
                        <button
                            key={ex}
                            className="chip"
                            onClick={() => {
                                setMetaphorText(ex);
                                run(ex);
                            }}
                        >
                            {ex}
                        </button>
                    ))}
                </div>
            )}

            <div className="row">
                <label>
                    Фоновых:&nbsp;
                    <select
                        value={bgCount}
                        onChange={(e) => setBgCount(Number(e.target.value))}
                    >
                        {Array.from({length: MAX_BG + 1}, (_, n) => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="row">
                <button
                    className="active"
                    onClick={() => run()}
                    disabled={!text.trim() || (mode === 'metaphor' && loading)}
                >
                    {loading && mode === 'metaphor'
                        ? 'Подбираю…'
                        : mode === 'metaphor'
                            ? 'Подобрать'
                            : 'Собрать'}
                </button>

                <button onClick={shuffle} disabled={!auto}>
                    Другой вариант
                </button>
            </div>

            {note && <p className="note">{note}</p>}
        </div>
    );
}
