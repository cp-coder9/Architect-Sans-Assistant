import { Point } from '../types';

export const dist = (p1: Point, p2: Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
export const sub = (p1: Point, p2: Point) => ({ x: p1.x - p2.x, y: p1.y - p2.y });
export const add = (p1: Point, p2: Point) => ({ x: p1.x + p2.x, y: p1.y + p2.y });
export const scale = (p: Point, s: number) => ({ x: p.x * s, y: p.y * s });
export const len = (p: Point) => Math.hypot(p.x, p.y);
export const norm = (p: Point) => { const l = len(p); return l === 0 ? { x: 0, y: 0 } : scale(p, 1/l); };
export const dot = (p1: Point, p2: Point) => p1.x * p2.x + p1.y * p2.y;
export const cross = (p1: Point, p2: Point) => p1.x * p2.y - p1.y * p2.x;

// Calculate intersection of two line segments p1-p2 and p3-p4
// Returns null if parallel or out of bounds (unless infiniteLines is true)
export const intersect = (p1: Point, p2: Point, p3: Point, p4: Point, infiniteLines = false): Point | null => {
    const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
    if (det === 0) return null;

    const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
    const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;

    if (infiniteLines || (0 < lambda && lambda < 1 && 0 < gamma && gamma < 1)) {
        return {
            x: p1.x + lambda * (p2.x - p1.x),
            y: p1.y + lambda * (p2.y - p1.y)
        };
    }
    return null;
};
