import { useEffect, useRef } from 'react';
import { useSceneStore, selectPalette } from '../../store/sceneStore';
import { bgIdOf } from '../../core/palettes';
import { recolorSvg } from '../../core/recolor';
import { getFormatSize, getBackgroundTransform } from '../../core/formats';
import { getBackgroundSvg, getObjectBox, getObjectSvg, parseSvg } from '../../core/library';
import type { Palette, SceneItem, Size } from '../../types';

interface ItemViewProps {
    item: SceneItem;
    size: Size;
    palette: Palette;
    selected: boolean;
    onDown: (e: React.PointerEvent) => void;
}

function ItemView({ item, size, palette, selected, onDown }: ItemViewProps) {
    const svg = getObjectSvg(item.objectId, size, item.variant);
    const box = getObjectBox(item.objectId, size, item.variant);
    if (!svg || !box) return null;

    const { inner } = parseSvg(recolorSvg(svg, palette, item.variant));
    const transform = `translate(${item.x} ${item.y}) rotate(${item.rotation} ${box.w / 2} ${box.h / 2})`;

    return (
        <g transform={transform} onPointerDown={onDown} style={{ cursor: 'move' }}>
            <g dangerouslySetInnerHTML={{ __html: inner }} />
            {selected && (
                <rect
                    width={box.w} height={box.h} fill="none"
                    stroke="#2563eb" strokeWidth={2} strokeDasharray="8 6"
                    vectorEffect="non-scaling-stroke" pointerEvents="none"
                />
            )}
        </g>
    );
}

export default function Canvas() {
    const { size, format, items, selectedId, select, move, remove } = useSceneStore();
    const palette = useSceneStore(selectPalette);
    const bgId = bgIdOf(palette);
    const canvas = getFormatSize(bgId, size, format);
    const bgTransform = getBackgroundTransform(bgId, size, format);
    const bgSvg = getBackgroundSvg(bgId, size);

    const svgRef = useRef<SVGSVGElement>(null);
    const drag = useRef<{ uid: string; sx: number; sy: number; ox: number; oy: number } | null>(null);

    const toScene = (e: { clientX: number; clientY: number }) => {
        const svg = svgRef.current!;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
        return { x: p.x, y: p.y };
    };

    const onItemDown = (e: React.PointerEvent, item: SceneItem) => {
        e.stopPropagation();
        select(item.uid);
        const p = toScene(e);
        drag.current = { uid: item.uid, sx: p.x, sy: p.y, ox: item.x, oy: item.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };

    const onMove = (e: React.PointerEvent) => {
        if (!drag.current) return;
        const p = toScene(e);
        const d = drag.current;
        move(d.uid, d.ox + (p.x - d.sx), d.oy + (p.y - d.sy));
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const id = useSceneStore.getState().selectedId;
                if (id) remove(id);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [remove]);

    const bgInner = bgSvg ? parseSvg(recolorSvg(bgSvg, palette, 'background')).inner : '';

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${canvas.w} ${canvas.h}`}
            fill="none"
            className="canvas"
            style={{
                aspectRatio: `${canvas.w} / ${canvas.h}`,
                width: `min(100%, 680px, calc((100vh - 32px) * ${canvas.w / canvas.h}))`,
            }}
            onPointerDown={() => select(null)}
            onPointerMove={onMove}
            onPointerUp={() => (drag.current = null)}
        >
            <g transform={bgTransform} dangerouslySetInnerHTML={{ __html: bgInner }} />
            {items.map((item) => (
                <ItemView
                    key={item.uid}
                    item={item}
                    size={size}
                    palette={palette}
                    selected={item.uid === selectedId}
                    onDown={(e) => onItemDown(e, item)}
                />
            ))}
        </svg>
    );
}