export type Size = 'S' | 'L';
export type Variant = 'main' | 'bg';
export type Format = 'square' | 'landscape' | 'portrait';

export type Role =
    | 'ink' | 'paper'
    | 'bg-1' | 'bg-2' | 'bg-3'
    | 'obj-1' | 'obj-2' | 'obj-3';

export interface LibraryObject {
    id: string;
    title: { ru: string; en: string };
    tags: string[];
    files: Record<Size, Partial<Record<Variant, string>>>;
    viewBox: Record<Size, Partial<Record<Variant, { w: number; h: number }>>>;
}

export interface Palette {
    id: string;
    name: string;
    background?: string;
    colors: Record<Role, string>;
}

export interface SceneItem {
    uid: string;
    objectId: string;
    variant: Variant;
    x: number;
    y: number;
    rotation: number;
}