import {useState} from 'react';
import {useSceneStore} from '../../store/sceneStore';
import {parseComponents} from '../../core/parseComponents';
import {interpretMetaphor} from '../../core/metaphor';
import {MAX_BG, MAX_MAIN} from '../../core/layout';
import {getObject, objects} from '../../core/library';

type Mode = 'metaphor' | 'components';

const EXAMPLES = ['рост карьеры', 'идея для стартапа', 'семейный бюджет', 'учёба онлайн'];

const names = (ids: string[]) => ids.map((id) => getObject(id)?.title.ru).join(', ');

export default function AutoBuild() {
    const {autoBuild, shuffle, auto} = useSceneStore();
    const [mode, setMode] = useState<Mode>('metaphor');
    const [text, setText] = useState('');
    const [bgCount, setBgCount] = useState(1);
    const [note, setNote] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const available = objects.map((o) => o.title.ru.toLowerCase()).join(', ');

    const buildFromComponents = (query: string) => {
        const {ids, unknown} = parseComponents(query);
        if (!ids.length) {
            setNote(`Не нашла ни одного компонента. Доступны: ${available}.`);
            return;
        }
        const notes: string[] = [];
        if (ids.length > MAX_MAIN) notes.push(`Взяла первые ${MAX_MAIN} объекта.`);
        if (unknown.length) notes.push(`Не распознала: ${unknown.join(', ')}.`);
        setNote(notes.join(' ') || null);
        autoBuild(ids, bgCount);
    };

    const buildFromMetaphor = async (query: string) => {
        setLoading(true);
        setNote(null);
        const result = await interpretMetaphor(query);
        setLoading(false);

        if (!result.ids.length) {
            setNote('Не нашла подходящих объектов. Попробуйте другими словами или режим «Компоненты».');
            return;
        }
        setNote(`${names(result.ids)}. ${result.reason}`.trim());
        autoBuild(result.ids, bgCount);
    };

    const run = (query = text) => {
        if (!query.trim() || loading) return;
        if (mode === 'metaphor') void buildFromMetaphor(query);
        else buildFromComponents(query);
    };

    return (
        <div className="auto">
            <h3>Автосборка</h3>
            <div className="row">
                <button className={mode === 'metaphor' ? 'active' : ''} onClick={() => setMode('metaphor')}>
                    Метафора
                </button>
                <button className={mode === 'components' ? 'active' : ''} onClick={() => setMode('components')}>
                    Компоненты
                </button>
            </div>

            <input
                value={text}
                placeholder={mode === 'metaphor' ? 'Метафора или заголовок' : 'телефон, пазл, книга'}
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
                                setText(ex);
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
                    <select value={bgCount} onChange={(e) => setBgCount(Number(e.target.value))}>
                        {Array.from({length: MAX_BG + 1}, (_, n) => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="row">
                <button className="active" onClick={() => run()} disabled={!text.trim() || loading}>
                    {loading ? 'Подбираю…' : mode === 'metaphor' ? 'Подобрать' : 'Собрать'}
                </button>
                <button onClick={shuffle} disabled={!auto}>Другой вариант</button>
            </div>

            {note && <p className="note">{note}</p>}
        </div>
    );
}