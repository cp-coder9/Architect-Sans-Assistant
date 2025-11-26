
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

// Intersect two lines defined by points (not segments)
export const intersectInfiniteLines = (p1: Point, p2: Point, p3: Point, p4: Point): Point | null => {
    return intersect(p1, p2, p3, p4, true);
};

// Check if point is inside polygon (ray casting)
export const isPointInPolygon = (p: Point, polygon: Point[]): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > p.y) !== (yj > p.y)) &&
            (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

// Clip segment p1-p2 against a list of polygons
// Returns an array of visible segments (parts of p1-p2 that are NOT inside any polygon)
export const getSegmentClippedByPolygons = (p1: Point, p2: Point, polygons: Point[][]): {start: Point, end: Point}[] => {
    let tValues = [0, 1];
    
    // Collect all intersection t-values with all polygon edges
    polygons.forEach(poly => {
        for (let i = 0; i < poly.length; i++) {
            const p3 = poly[i];
            const p4 = poly[(i + 1) % poly.length];
            const int = intersect(p1, p2, p3, p4, false); // Strict segment intersection
            if (int) {
                const totalLen = dist(p1, p2);
                if (totalLen > 0.001) {
                    const t = dist(p1, int) / totalLen;
                    if (t > 0.001 && t < 0.999) tValues.push(t);
                }
            }
        }
    });

    tValues.sort((a, b) => a - b);
    // Remove duplicates
    tValues = tValues.filter((item, pos) => tValues.indexOf(item) === pos);

    const result = [];
    for (let i = 0; i < tValues.length - 1; i++) {
        const tStart = tValues[i];
        const tEnd = tValues[i+1];
        if (Math.abs(tEnd - tStart) < 0.001) continue;

        const tMid = (tStart + tEnd) / 2;
        const midPt = add(p1, scale(sub(p2, p1), tMid));
        
        // Check if midPt is inside ANY polygon
        let isInside = false;
        for (const poly of polygons) {
            if (isPointInPolygon(midPt, poly)) {
                isInside = true;
                break;
            }
        }
        
        if (!isInside) {
             result.push({
                 start: add(p1, scale(sub(p2, p1), tStart)),
                 end: add(p1, scale(sub(p2, p1), tEnd))
             });
        }
    }
    return result;
};
