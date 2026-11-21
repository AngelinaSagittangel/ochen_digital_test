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
    background?: string;               // id готовой схемы, чей фон брать (по умолчанию = id)
    colors: Record<Role, string>;
}

export interface SceneItem {
    uid: string;
    objectId: string;
    variant: Variant;
    x: number;          // левый верхний угол объекта на холсте
    y: number;
    rotation: number;   // градусы, вокруг центра объекта
}