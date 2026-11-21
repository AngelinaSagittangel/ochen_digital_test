import {useState} from 'react';
import {useSceneStore, selectPalette} from '../../store/sceneStore';
import {parsePaletteJson} from '../../core/palettes';
import {FORMATS} from '../../core/formats';
import {getObject} from '../../core/library';
import {buildSceneSvg, downloadSvg} from '../../core/exportSvg';
import type {Format, Size} from '../../types';

export default function Toolbar() {
    const {
        size, format, paletteId, palettes, items, selectedId,
        setSize, setFormat, setPalette, addPalette,
        select, rotate, duplicate, remove, toggleVariant, reorder, clear,
    } = useSceneStore();
    const palette = useSceneStore(selectPalette);
    const [error, setError] = useState<string | null>(null);

    const sel = items.find((i) => i.uid === selectedId);
    const off = !sel;

    const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            addPalette(parsePaletteJson(await file.text()));
            setError(null);
        } catch (err) {
            setError((err as Error).message);
        }
        e.target.value = '';
    };

    const onExport = () => {
        const svg = buildSceneSvg({items, size, format, palette});
        downloadSvg(svg, `composition-${size}-${format}-${palette.id}.svg`);
    };

    return (
        <div className="toolbar">
            <h3>Размер</h3>
            <div className="row">
                {(['L', 'S'] as Size[]).map((s) => (
                    <button key={s} className={s === size ? 'active' : ''} onClick={() => setSize(s)}>{s}</button>
                ))}
            </div>

            <h3>Формат</h3>
            <div className="row">
                {(Object.keys(FORMATS) as Format[]).map((f) => (
                    <button key={f} className={f === format ? 'active' : ''} onClick={() => setFormat(f)}>
                        {FORMATS[f].label}
                    </button>
                ))}
            </div>

            <h3>Цветовая схема</h3>
            <div className="row">
                {palettes.map((p) => (
                    <button key={p.id} className={p.id === paletteId ? 'active' : ''} onClick={() => setPalette(p.id)}>
                        {p.name}
                    </button>
                ))}
            </div>
            <label className="upload">
                Загрузить палитру (.json)
                <input type="file" accept="application/json,.json" onChange={onUpload} hidden/>
            </label>
            {error && <pre className="error">{error}</pre>}

            <h3>Объект</h3>
            <div className="row">
                <button disabled={off} onClick={() => sel && rotate(sel.uid, -15)}>⟲ 15°</button>
                <button disabled={off} onClick={() => sel && rotate(sel.uid, 15)}>⟳ 15°</button>
                <button disabled={off} onClick={() => sel && duplicate(sel.uid)}>Дублировать</button>
                <button disabled={off} onClick={() => sel && remove(sel.uid)}>Удалить</button>
                <button disabled={off} onClick={() => sel && toggleVariant(sel.uid)}>Главный ⇄ фоновый</button>
            </div>

            <h3>Слои</h3>
            <div className="row">
                <button disabled={off} onClick={() => sel && reorder(sel.uid, 'front')}>На передний</button>
                <button disabled={off} onClick={() => sel && reorder(sel.uid, 'up')}>Выше</button>
                <button disabled={off} onClick={() => sel && reorder(sel.uid, 'down')}>Ниже</button>
                <button disabled={off} onClick={() => sel && reorder(sel.uid, 'back')}>На задний</button>
            </div>
            <ul className="layers">
                {[...items].reverse().map((i) => (
                    <li key={i.uid} className={i.uid === selectedId ? 'active' : ''} onClick={() => select(i.uid)}>
                        {getObject(i.objectId)?.title.ru} · {i.variant === 'main' ? 'главный' : 'фоновый'}
                    </li>
                ))}
            </ul>

            <div className="row">
                <button onClick={clear} disabled={!items.length}>Очистить холст</button>
                <button className="active" onClick={onExport} disabled={!items.length}>Скачать SVG</button>
            </div>
        </div>
    );
}