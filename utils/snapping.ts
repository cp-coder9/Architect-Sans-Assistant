import { Point, Wall } from '../types';
import { dist, sub, add, scale, dot, intersect } from './geometry';

export const GRID_SIZE = 20;
export const SNAP_THRESHOLD = 15;

export interface SnapGuide {
    x1: number; y1: number;
    x2: number; y2: number;
    type: 'alignment' | 'extension';
}

export interface SnapResult {
    point: Point;
    guides: SnapGuide[];
    snapped: boolean;
}

export const getSnapPoint = (
    p: Point, 
    zoom: number, 
    walls: Wall[], 
    origin: Point | null = null, 
    excludeIds: string[] = []
): SnapResult => {
    const guides: SnapGuide[] = [];
    let bestPoint = { x: p.x, y: p.y };
    let minDist = SNAP_THRESHOLD / zoom;
    let foundSnap = false;

    const validWalls = walls.filter(w => !excludeIds.includes(w.id));

    // 1. Point Snapping (Endpoints) - High Priority
    for (const w of validWalls) {
        const dStart = dist(w.start, p);
        if (dStart < minDist) {
            minDist = dStart;
            bestPoint = w.start;
            foundSnap = true;
        }
        const dEnd = dist(w.end, p);
        if (dEnd < minDist) {
            minDist = dEnd;
            bestPoint = w.end;
            foundSnap = true;
        }
    }

    // 2. Intersection Snapping (Virtual Intersections)
    if (!foundSnap) {
        // Check intersections between all wall lines
        // This can be expensive O(N^2), so we limit to walls nearby if needed, 
        // but for N < 100 it's fine.
        for (let i = 0; i < validWalls.length; i++) {
            for (let j = i + 1; j < validWalls.length; j++) {
                const w1 = validWalls[i];
                const w2 = validWalls[j];
                
                const intPt = intersect(w1.start, w1.end, w2.start, w2.end, true);
                if (intPt) {
                    const d = dist(p, intPt);
                    if (d < minDist) {
                        minDist = d;
                        bestPoint = intPt;
                        foundSnap = true;
                        // Add guides to show which walls are intersecting
                        guides.push({ x1: w1.start.x, y1: w1.start.y, x2: intPt.x, y2: intPt.y, type: 'extension' });
                        guides.push({ x1: w1.end.x, y1: w1.end.y, x2: intPt.x, y2: intPt.y, type: 'extension' });
                        guides.push({ x1: w2.start.x, y1: w2.start.y, x2: intPt.x, y2: intPt.y, type: 'extension' });
                        guides.push({ x1: w2.end.x, y1: w2.end.y, x2: intPt.x, y2: intPt.y, type: 'extension' });
                    }
                }
            }
        }
    }

    // 3. Edge Snapping (Snap to line segments)
    if (!foundSnap) {
        for (const w of validWalls) {
            const v = sub(w.end, w.start);
            const l2 = dot(v, v);
            if (l2 === 0) continue;
            
            const t = Math.max(0, Math.min(1, dot(sub(p, w.start), v) / l2));
            const proj = add(w.start, scale(v, t));
            const dProj = dist(p, proj);

            if (dProj < minDist) {
                minDist = dProj;
                bestPoint = proj;
                foundSnap = true;
            }
        }
    }

    // 4. Alignment Snapping (Ortho from other points)
    if (!foundSnap) {
        const xCoords: { val: number, y: number }[] = [];
        const yCoords: { val: number, x: number }[] = [];

        validWalls.forEach(w => {
            xCoords.push({ val: w.start.x, y: w.start.y });
            xCoords.push({ val: w.end.x, y: w.end.y });
            yCoords.push({ val: w.start.y, x: w.start.x });
            yCoords.push({ val: w.end.y, x: w.end.x });
        });

        let snappedX = false;
        let snappedY = false;
        let bestX = p.x;
        let bestY = p.y;

        // Find X alignment
        for (const cand of xCoords) {
            if (Math.abs(p.x - cand.val) < minDist) {
                bestX = cand.val;
                snappedX = true;
                guides.push({ x1: cand.val, y1: cand.y, x2: cand.val, y2: p.y, type: 'alignment' }); 
                break; 
            }
        }

        // Find Y alignment
        for (const cand of yCoords) {
            if (Math.abs(p.y - cand.val) < minDist) {
                bestY = cand.val;
                snappedY = true;
                guides.push({ x1: cand.x, y1: cand.val, x2: p.x, y2: cand.val, type: 'alignment' }); 
                break;
            }
        }
        
        if (snappedX || snappedY) {
            bestPoint = { x: bestX, y: bestY };
            foundSnap = true;
        }
    }

    // 5. Ortho Lock (if dragging from origin)
    if (origin) {
        const dx = Math.abs(bestPoint.x - origin.x);
        const dy = Math.abs(bestPoint.y - origin.y);
        if (dx < minDist) { bestPoint.x = origin.x; foundSnap = true; }
        else if (dy < minDist) { bestPoint.y = origin.y; foundSnap = true; }
    }

    // 6. Grid Snap (Fallback)
    if (!foundSnap) {
        bestPoint = {
            x: Math.round(bestPoint.x / GRID_SIZE) * GRID_SIZE,
            y: Math.round(bestPoint.y / GRID_SIZE) * GRID_SIZE
        };
    }

    return { point: bestPoint, guides, snapped: foundSnap };
};
