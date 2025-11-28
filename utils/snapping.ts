
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
    snapType?: 'point' | 'edge' | 'perpendicular' | 'intersection' | 'alignment' | 'grid' | 'midpoint';
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
    
    // Zoom-adjusted threshold for consistent feel
    const THRESHOLD = SNAP_THRESHOLD / zoom; 

    // --- PRIORITY 1: CRITICAL POINTS (Endpoints, Midpoints, Real Intersections) ---
    // These are the strongest snaps.

    let bestPointDist = THRESHOLD;
    let bestPointSnap: { point: Point, type: SnapResult['snapType'] } | null = null;

    // 1. Collect Point Candidates
    const candidates: { point: Point, type: SnapResult['snapType'] }[] = [];
    
    validWalls.forEach(w => {
        candidates.push({ point: w.start, type: 'point' });
        candidates.push({ point: w.end, type: 'point' });
        candidates.push({ point: { x: (w.start.x + w.end.x)/2, y: (w.start.y + w.end.y)/2 }, type: 'midpoint' });
    });

    // 2. Real Wall Intersections (where walls actually cross or meet)
    for (let i = 0; i < validWalls.length; i++) {
        for (let j = i + 1; j < validWalls.length; j++) {
            const w1 = validWalls[i];
            const w2 = validWalls[j];
            // Check strict segment intersection first for strong snap
            const segInt = intersect(w1.start, w1.end, w2.start, w2.end, false);
            if (segInt) candidates.push({ point: segInt, type: 'intersection' });
        }
    }

    // Evaluate Point Candidates
    for (const cand of candidates) {
        const d = dist(p, cand.point);
        if (d < bestPointDist) {
            bestPointDist = d;
            bestPointSnap = cand;
        }
    }

    // 3. Perpendicular, Extension, and Angle Snap (Only if drawing from an origin)
    if (origin) {
        // Angle Snapping
        const d = dist(origin, p);
        if (d > THRESHOLD) {
            const angle = Math.atan2(p.y - origin.y, p.x - origin.x);
            const snappedAngle = snapAngle(angle);
            const snappedPoint = {
                x: origin.x + d * Math.cos(snappedAngle),
                y: origin.y + d * Math.sin(snappedAngle)
            };
            if (dist(p, snappedPoint) < THRESHOLD) {
                guides.push({ x1: origin.x, y1: origin.y, x2: snappedPoint.x, y2: snappedPoint.y, type: 'alignment' });
                return { point: snappedPoint, guides, snapped: true, snapType: 'alignment' };
            }
        }

        // Parallel snapping
        if (origin) {
            const currentDir = norm(sub(p, origin));
            for (const w of validWalls) {
                const wallDir = norm(sub(w.end, w.start));
                const dotProd = Math.abs(dot(currentDir, wallDir));
                if (dotProd > 0.995) { // Close to 1 (parallel) or -1 (anti-parallel)
                    const d = dist(origin, p);
                    const snappedPoint = add(origin, scale(wallDir, d * Math.sign(dot(currentDir, wallDir))));
                     if (dist(p, snappedPoint) < THRESHOLD) {
                        guides.push({ x1: w.start.x, y1: w.start.y, x2: w.end.x, y2: w.end.y, type: 'alignment' });
                        return { point: snappedPoint, guides, snapped: true, snapType: 'alignment' };
                    }
                }
            }
        }

        for (const w of validWalls) {
            // Extension snapping
            const wallDir = norm(sub(w.end, w.start));
            [w.start, w.end].forEach(ep => {
                const pToEp = sub(p, ep);
                const t = dot(pToEp, wallDir);
                const projectedPoint = add(ep, scale(wallDir, t));
                const d = dist(p, projectedPoint);

                if (d < THRESHOLD) {
                    guides.push({ x1: ep.x, y1: ep.y, x2: projectedPoint.x, y2: projectedPoint.y, type: 'extension' });
                    if (d < bestPointDist) {
                        bestPointDist = d;
                        bestPointSnap = { point: projectedPoint, type: 'alignment' };
                    }
                }
            });

             const v = sub(w.end, w.start);
             const l2 = dot(v, v);
             if (l2 === 0) continue;
             const t = dot(sub(origin, w.start), v) / l2;
             // Perpendicular snap
             if (t >= 0 && t <= 1) { 
                 const perp = add(w.start, scale(v, t));
                 const d = dist(p, perp);
                 if (d < bestPointDist) {
                     bestPointDist = d;
                     bestPointSnap = { point: perp, type: 'perpendicular' };
                 }
             }
        }
    }

    // Return Priority 1 Snap if found
    if (bestPointSnap) {
        if (bestPointSnap.type === 'perpendicular' && origin) {
             guides.push({ x1: origin.x, y1: origin.y, x2: bestPointSnap.point.x, y2: bestPointSnap.point.y, type: 'perpendicular' });
             // Draw the wall base as a guide
             const w = validWalls.find(w => dist(projectOnSegment(w.start, w.end, bestPointSnap!.point), bestPointSnap!.point) < 0.1);
             if(w) guides.push({ x1: w.start.x, y1: w.start.y, x2: w.end.x, y2: w.end.y, type: 'perpendicular' });
        }
        return { point: bestPointSnap.point, guides, snapped: true, snapType: bestPointSnap.type };
    }

    // --- PRIORITY 2: SMART ALIGNMENTS & EDGE SNAPS ---
    
    // Gather Alignment Candidates (X and Y coordinates)
    // We store the 'source' point to draw the guide line from.
    const xCandidates: { x: number, source: Point }[] = [];
    const yCandidates: { y: number, source: Point }[] = [];

    if (origin) {
        xCandidates.push({ x: origin.x, source: origin });
        yCandidates.push({ y: origin.y, source: origin });
    }
    
    validWalls.forEach(w => {
        xCandidates.push({ x: w.start.x, source: w.start });
        xCandidates.push({ x: w.end.x, source: w.end });
        yCandidates.push({ y: w.start.y, source: w.start });
        yCandidates.push({ y: w.end.y, source: w.end });
        const mid = { x: (w.start.x + w.end.x)/2, y: (w.start.y + w.end.y)/2 };
        xCandidates.push({ x: mid.x, source: mid });
        yCandidates.push({ y: mid.y, source: mid });
    });

    // Find Best X Alignment
    let bestXAlign: { x: number, source: Point } | null = null;
    let minXDist = THRESHOLD;
    for (const cand of xCandidates) {
        const d = Math.abs(p.x - cand.x);
        if (d < minXDist - 0.001) { // Found significantly closer
            minXDist = d;
            bestXAlign = cand;
        } else if (Math.abs(d - minXDist) < 0.001) { // Found equally close
            // Prefer the source closest to cursor for cleaner guides
            if (!bestXAlign || dist(cand.source, p) < dist(bestXAlign.source, p)) {
                bestXAlign = cand;
            }
        }
    }

    // Find Best Y Alignment
    let bestYAlign: { y: number, source: Point } | null = null;
    let minYDist = THRESHOLD;
    for (const cand of yCandidates) {
        const d = Math.abs(p.y - cand.y);
        if (d < minYDist - 0.001) {
            minYDist = d;
            bestYAlign = cand;
        } else if (Math.abs(d - minYDist) < 0.001) {
            if (!bestYAlign || dist(cand.source, p) < dist(bestYAlign.source, p)) {
                bestYAlign = cand;
            }
        }
    }

    // Find Closest Edge
    let bestEdge: { point: Point, wall: Wall } | null = null;
    let minEdgeDist = THRESHOLD;
    for (const w of validWalls) {
        const proj = projectOnSegment(w.start, w.end, p);
        const d = dist(p, proj);
        if (d < minEdgeDist) {
            minEdgeDist = d;
            bestEdge = { point: proj, wall: w };
        }
    }

    // 4. Virtual Corner (Intersection of X and Y Alignments)
    if (bestXAlign && bestYAlign) {
        const virtualPt = { x: bestXAlign.x, y: bestYAlign.y };
        // Check if cursor is close to this virtual point
        if (dist(p, virtualPt) < THRESHOLD * 1.5) {
            guides.push({ x1: bestXAlign.source.x, y1: bestXAlign.source.y, x2: virtualPt.x, y2: virtualPt.y, type: 'alignment' });
            guides.push({ x1: bestYAlign.source.x, y1: bestYAlign.source.y, x2: virtualPt.x, y2: virtualPt.y, type: 'alignment' });
            return { point: virtualPt, guides, snapped: true, snapType: 'intersection' };
        }
    }

    // 5. Intersection of Alignment and Edge
    if (bestEdge) {
        const edgePt = bestEdge.point;
        
        // Try to snap along the edge to an X alignment
        if (bestXAlign && Math.abs(edgePt.x - bestXAlign.x) < THRESHOLD) {
             const w = bestEdge.wall;
             // Intersect Vertical Line x=bestX with Wall Segment
             const intPt = intersectLineSegment({p1: {x: bestXAlign.x, y: -10000}, p2: {x: bestXAlign.x, y: 10000}}, w.start, w.end);
             if (intPt && dist(p, intPt) < THRESHOLD * 2) {
                 guides.push({ x1: bestXAlign.source.x, y1: bestXAlign.source.y, x2: intPt.x, y2: intPt.y, type: 'alignment' });
                 return { point: intPt, guides, snapped: true, snapType: 'intersection' };
             }
        }

        // Try to snap along the edge to a Y alignment
        if (bestYAlign && Math.abs(edgePt.y - bestYAlign.y) < THRESHOLD) {
             const w = bestEdge.wall;
             // Intersect Horizontal Line y=bestY with Wall Segment
             const intPt = intersectLineSegment({p1: {x: -10000, y: bestYAlign.y}, p2: {x: 10000, y: bestYAlign.y}}, w.start, w.end);
             if (intPt && dist(p, intPt) < THRESHOLD * 2) {
                 guides.push({ x1: bestYAlign.source.x, y1: bestYAlign.source.y, x2: intPt.x, y2: intPt.y, type: 'alignment' });
                 return { point: intPt, guides, snapped: true, snapType: 'intersection' };
             }
        }

        // Just basic Edge Snap
        return { point: bestEdge.point, guides: [], snapped: true, snapType: 'edge' };
    }

    // 6. Single Alignment (X or Y)
    if (bestXAlign) {
        guides.push({ x1: bestXAlign.source.x, y1: bestXAlign.source.y, x2: bestXAlign.x, y2: p.y, type: 'alignment' });
        return { point: { x: bestXAlign.x, y: p.y }, guides, snapped: true, snapType: 'alignment' };
    }
    if (bestYAlign) {
        guides.push({ x1: bestYAlign.source.x, y1: bestYAlign.source.y, x2: p.x, y2: bestYAlign.y, type: 'alignment' });
        return { point: { x: p.x, y: bestYAlign.y }, guides, snapped: true, snapType: 'alignment' };
    }

    // --- PRIORITY 3: GRID ---
    const gridX = Math.round(p.x / GRID_SIZE) * GRID_SIZE;
    const gridY = Math.round(p.y / GRID_SIZE) * GRID_SIZE;
    if (Math.abs(gridX - p.x) < GRID_SIZE/2 && Math.abs(gridY - p.y) < GRID_SIZE/2) {
        return { point: { x: gridX, y: gridY }, guides: [], snapped: true, snapType: 'grid' };
    }

    return { point: p, guides: [], snapped: false };
};

// Helper: Snap angle to nearest 45 degrees
const snapAngle = (angle: number): number => {
    const fortyFive = Math.PI / 4;
    return Math.round(angle / fortyFive) * fortyFive;
};

// Helper: Project point p onto segment AB
function projectOnSegment(a: Point, b: Point, p: Point): Point {
    const v = sub(b, a);
    const l2 = dot(v, v);
    if (l2 === 0) return a;
    const t = Math.max(0, Math.min(1, dot(sub(p, a), v) / l2));
    return add(a, scale(v, t));
}

// Helper: Intersect infinite line (p1-p2) with segment (a-b)
function intersectLineSegment(line: {p1: Point, p2: Point}, a: Point, b: Point): Point | null {
    const det = (line.p2.x - line.p1.x) * (b.y - a.y) - (b.x - a.x) * (line.p2.y - line.p1.y);
    if (det === 0) return null;
    // We need intersection point. We can use standard intersect logic but treat line 1 as infinite and line 2 as segment.
    return intersect(line.p1, line.p2, a, b, true); // true = infinite lines. We check segment bounds manually or trust use case.
    // Actually, `intersect` with true returns intersection of lines. We need to check if it lies on a-b.
    // Re-using utils/geometry intersect is better if we have access, but for this self-contained helper:
    const pt = intersect(line.p1, line.p2, a, b, true);
    if (!pt) return null;
    
    // Check if pt is on segment a-b
    const dAB = dist(a, b);
    if (Math.abs(dist(a, pt) + dist(pt, b) - dAB) < 0.01) return pt;
    return null;
}
