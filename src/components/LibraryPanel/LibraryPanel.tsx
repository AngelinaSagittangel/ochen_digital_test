import {selectPalette, useSceneStore} from '../../store/sceneStore';
import { recolorSvg } from '../../core/recolor';
import { objects, getObjectSvg } from '../../core/library';
import type { Variant } from '../../types';

export default function LibraryPanel() {
    const { size, addItem } = useSceneStore();
    const palette = useSceneStore(selectPalette);

    const row = (variant: Variant) =>
        objects.map((o) => {
            const svg = getObjectSvg(o.id, size, variant);
            if (!svg) return null;
            return (
                <button
                    key={`${o.id}-${variant}`}
                    className="thumb"
                    title={`${o.title.ru} (${variant === 'main' ? 'главный' : 'фоновый'})`}
                    onClick={() => addItem(o.id, variant)}
                    dangerouslySetInnerHTML={{ __html: recolorSvg(svg, palette, variant) }}
                />
            );
        });

    return (
        <div>
            <h3>Главные</h3>
            <div className="thumbs">{row('main')}</div>
            <h3>Фоновые</h3>
            <div className="thumbs">{row('bg')}</div>
        </div>
    );
}