import { Point, Wall, Opening } from '../types';
import { dist, sub, add, scale, dot, intersect, norm } from './geometry';

export const GRID_SIZE = 20;
export const SNAP_THRESHOLD = 15;

export interface SnapGuide {
    x1: number; y1: number;
    x2: number; y2: number;
    type: 'alignment' | 'extension' | 'perpendicular';
}

export interface SnapResult {
    point: Point;
    guides: SnapGuide[];
    snapped: boolean;
    snapType?: 'point' | 'edge' | 'perpendicular' | 'intersection' | 'alignment' | 'grid';
}

export const getSnapPoint = (
    p: Point, 
    zoom: number, 
    walls: Wall[], 
    openings: Opening[] = [],
    origin: Point | null = null, 
    excludeIds: string[] = []
): SnapResult => {
    const guides: SnapGuide[] = [];
    const validWalls = walls.filter(w => !excludeIds.includes(w.id));
    
    // Thresholds
    const POINT_THRESHOLD = (SNAP_THRESHOLD + 5) / zoom; 
    const EDGE_THRESHOLD = SNAP_THRESHOLD / zoom;

    let bestPoint = { x: p.x, y: p.y };
    let minPointDist = POINT_THRESHOLD;
    let hasPointSnap = false;
    let snapType: SnapResult['snapType'] = undefined;

    // --- TIER 1: HIGH PRIORITY (Perpendicular, Endpoints, Intersections, Opening Centers) ---

    // 0. Perpendicular Snap (Relative to drawing origin)
    if (origin) {
        for (const w of validWalls) {
             const v = sub(w.end, w.start);
             const l2 = dot(v, v);
             if (l2 === 0) continue;
             
             // Project origin onto wall line (infinite)
             const t = dot(sub(origin, w.start), v) / l2;
             const perpPoint = add(w.start, scale(v, t));
             
             const d = dist(p, perpPoint);
             if (d < minPointDist) {
                 minPointDist = d;
                 bestPoint = perpPoint;
                 hasPointSnap = true;
                 snapType = 'perpendicular';
                 
                 const dir = norm(v);
                 // Guide showing the wall line being snapped to (perpendicular base)
                 const g1 = add(perpPoint, scale(dir, -1000/zoom));
                 const g2 = add(perpPoint, scale(dir, 1000/zoom));
                 guides.length = 0; 
                 guides.push({ x1: g1.x, y1: g1.y, x2: g2.x, y2: g2.y, type: 'perpendicular' });
                 // Guide from origin to perp point
                 guides.push({ x1: origin.x, y1: origin.y, x2: perpPoint.x, y2: perpPoint.y, type: 'perpendicular' });
             }
        }
    }

    // 1. Wall Endpoints
    for (const w of validWalls) {
        const dStart = dist(w.start, p);
        if (dStart < minPointDist) {
            minPointDist = dStart;
            bestPoint = w.start;
            hasPointSnap = true;
            snapType = 'point';
            guides.length = 0;
        }
        const dEnd = dist(w.end, p);
        if (dEnd < minPointDist) {
            minPointDist = dEnd;
            bestPoint = w.end;
            hasPointSnap = true;
            snapType = 'point';
            guides.length = 0;
        }
    }

    // 2. Opening Centers
    for (const op of openings) {
        const wall = walls.find(w => w.id === op.wallId);
        if (wall && !excludeIds.includes(wall.id)) {
            const opPos = add(wall.start, scale(sub(wall.end, wall.start), op.t));
            const d = dist(opPos, p);
            if (d < minPointDist) {
                minPointDist = d;
                bestPoint = opPos;
                hasPointSnap = true;
                snapType = 'point';
                guides.length = 0;
            }
        }
    }

    // 3. Wall Intersections
    for (let i = 0; i < validWalls.length; i++) {
        for (let j = i + 1; j < validWalls.length; j++) {
            const w1 = validWalls[i];
            const w2 = validWalls[j];
            
            const intPt = intersect(w1.start, w1.end, w2.start, w2.end, true);
            if (intPt) {
                const d = dist(p, intPt);
                if (d < minPointDist) {
                    minPointDist = d;
                    bestPoint = intPt;
                    hasPointSnap = true;
                    snapType = 'intersection';
                    guides.length = 0;
                    guides.push({ x1: w1.start.x, y1: w1.start.y, x2: intPt.x, y2: intPt.y, type: 'extension' });
                    guides.push({ x1: w1.end.x, y1: w1.end.y, x2: intPt.x, y2: intPt.y, type: 'extension' });
                    guides.push({ x1: w2.start.x, y1: w2.start.y, x2: intPt.x, y2: intPt.y, type: 'extension' });
                    guides.push({ x1: w2.end.x, y1: w2.end.y, x2: intPt.x, y2: intPt.y, type: 'extension' });
                }
            }
        }
    }

    if (hasPointSnap) {
        return { point: bestPoint, guides, snapped: true, snapType };
    }

    // --- TIER 2: LOW PRIORITY (Edges, Alignments) ---
    
    // 1. Edge Snap Candidate
    let edgeCandidate: { point: Point, wall: Wall } | null = null;
    let minEdgeDist = EDGE_THRESHOLD;

    for (const w of validWalls) {
        const v = sub(w.end, w.start);
        const l2 = dot(v, v);
        if (l2 === 0) continue;
        
        const t = Math.max(0, Math.min(1, dot(sub(p, w.start), v) / l2));
        const proj = add(w.start, scale(v, t));
        const dProj = dist(p, proj);

        if (dProj < minEdgeDist) {
            minEdgeDist = dProj;
            edgeCandidate = { point: proj, wall: w };
        }
    }

    // 2. Alignment Candidates
    const xCoords: { val: number, y: number }[] = [];
    const yCoords: { val: number, x: number }[] = [];

    validWalls.forEach(w => {
        xCoords.push({ val: w.start.x, y: w.start.y });
        xCoords.push({ val: w.end.x, y: w.end.y });
        yCoords.push({ val: w.start.y, x: w.start.x });
        yCoords.push({ val: w.end.y, x: w.end.x });
    });

    openings.forEach(op => {
         const wall = walls.find(w => w.id === op.wallId);
         if (wall && !excludeIds.includes(wall.id)) {
            const opPos = add(wall.start, scale(sub(wall.end, wall.start), op.t));
            xCoords.push({ val: opPos.x, y: opPos.y });
            yCoords.push({ val: opPos.y, x: opPos.x });
         }
    });

    let alignX: { val: number, y: number } | null = null;
    let alignY: { val: number, x: number } | null = null;

    let minDistX = EDGE_THRESHOLD;
    for (const cand of xCoords) {
        if (Math.abs(p.x - cand.val) < minDistX) {
            minDistX = Math.abs(p.x - cand.val);
            alignX = cand;
        }
    }

    let minDistY = EDGE_THRESHOLD;
    for (const cand of yCoords) {
        if (Math.abs(p.y - cand.val) < minDistY) {
            minDistY = Math.abs(p.y - cand.val);
            alignY = cand;
        }
    }

    // 3. Resolve
    guides.length = 0;
    
    // Case A: Edge Snap found
    if (edgeCandidate) {
        bestPoint = edgeCandidate.point;
        snapType = 'edge';
        
        // Try to intersect edge with alignment lines
        let intersected = false;

        // Check X Alignment intersection with Edge
        if (alignX) {
            const w = edgeCandidate.wall;
            const v = sub(w.end, w.start);
            // x = alignX.val.  P = S + tV.  alignX.val = S.x + t*V.x
            if (Math.abs(v.x) > 0.001) {
                const t = (alignX.val - w.start.x) / v.x;
                if (t >= 0 && t <= 1) {
                    const intPt = add(w.start, scale(v, t));
                    if (dist(p, intPt) < EDGE_THRESHOLD * 2) { // Slightly larger grab for intersection
                        bestPoint = intPt;
                        snapType = 'intersection';
                        guides.push({ x1: alignX.val, y1: alignX.y, x2: intPt.x, y2: intPt.y, type: 'alignment' });
                        intersected = true;
                    }
                }
            }
        }
        
        // Check Y Alignment intersection with Edge (priority if closer or if no X intersection)
        if (alignY) {
             const w = edgeCandidate.wall;
             const v = sub(w.end, w.start);
             if (Math.abs(v.y) > 0.001) {
                 const t = (alignY.val - w.start.y) / v.y;
                 if (t >= 0 && t <= 1) {
                     const intPt = add(w.start, scale(v, t));
                     // If we haven't intersected yet, or if this point is closer to cursor (or similar logic)
                     // Here we just check proximity
                     if (dist(p, intPt) < EDGE_THRESHOLD * 2) {
                         bestPoint = intPt;
                         snapType = 'intersection';
                         guides.push({ x1: alignY.x, y1: alignY.val, x2: intPt.x, y2: intPt.y, type: 'alignment' });
                         intersected = true;
                     }
                 }
             }
        }
        
        return { point: bestPoint, guides, snapped: true, snapType };
    }

    // Case B: No Edge Snap, pure alignment
    let snapped = false;
    
    if (alignX) {
        bestPoint.x = alignX.val;
        snapped = true;
        snapType = 'alignment';
        guides.push({ x1: alignX.val, y1: alignX.y, x2: alignX.val, y2: bestPoint.y, type: 'alignment' });
    }
    
    if (alignY) {
        bestPoint.y = alignY.val;
        snapped = true;
        snapType = 'alignment';
        guides.push({ x1: alignY.x, y1: alignY.val, x2: bestPoint.x, y2: alignY.val, type: 'alignment' });
    }
    
    if (snapped) return { point: bestPoint, guides, snapped: true, snapType };

    // Case C: Ortho Lock (if drawing)
    if (origin) {
        const dx = Math.abs(p.x - origin.x);
        const dy = Math.abs(p.y - origin.y);
        
        if (dx < EDGE_THRESHOLD) { 
            bestPoint.x = origin.x; 
            snapped = true; 
            snapType = 'alignment';
            guides.push({ x1: origin.x, y1: origin.y, x2: origin.x, y2: p.y, type: 'alignment' });
        }
        else if (dy < EDGE_THRESHOLD) { 
            bestPoint.y = origin.y; 
            snapped = true; 
            snapType = 'alignment'; 
            guides.push({ x1: origin.x, y1: origin.y, x2: p.x, y2: origin.y, type: 'alignment' });
        }
    }
    
    // Case D: Grid Snap
    if (!snapped) {
        const gridX = Math.round(p.x / GRID_SIZE) * GRID_SIZE;
        const gridY = Math.round(p.y / GRID_SIZE) * GRID_SIZE;
        if (Math.abs(gridX - p.x) < GRID_SIZE/2 && Math.abs(gridY - p.y) < GRID_SIZE/2) {
            bestPoint = { x: gridX, y: gridY };
            snapType = 'grid';
        }
    }

    return { point: bestPoint, guides, snapped, snapType };
};