
import React, { useMemo } from 'react';
import { Wall, Opening, Stair, Dimension, RoomLabel, StairType, NorthArrow, SymbolInstance, PlanData, Point } from '../types';
import { dist, sub, add, scale, norm, len, dot, intersectInfiniteLines, getSegmentClippedByPolygons } from '../utils/geometry';

// --- Symbol Catalog Definition ---
export interface SymbolDef {
    id: string;
    category: 'furniture' | 'electrical' | 'plumbing' | 'hvac';
    label: string;
    width: number;
    height: number;
    render: (w: number, h: number) => React.ReactNode;
}

export const SYMBOL_CATALOG: SymbolDef[] = [
    // Furniture
    { id: 'bed_double', category: 'furniture', label: 'Double Bed', width: 1500, height: 2000, render: (w, h) => (
        <g><rect x={-w/2} y={-h/2} width={w} height={h} rx="20" fill="none" stroke="currentColor" /><path d={`M ${-w/2} ${-h/2 + 500} L ${w/2} ${-h/2 + 500}`} stroke="currentColor" /><rect x={-w/2 + 100} y={-h/2 + 100} width="500" height="300" rx="10" fill="none" stroke="currentColor" /><rect x={w/2 - 600} y={-h/2 + 100} width="500" height="300" rx="10" fill="none" stroke="currentColor" /></g>
    )},
    { id: 'bed_single', category: 'furniture', label: 'Single Bed', width: 900, height: 2000, render: (w, h) => (
        <g><rect x={-w/2} y={-h/2} width={w} height={h} rx="20" fill="none" stroke="currentColor" /><path d={`M ${-w/2} ${-h/2 + 500} L ${w/2} ${-h/2 + 500}`} stroke="currentColor" /><rect x={-150} y={-h/2 + 100} width="300" height="300" rx="10" fill="none" stroke="currentColor" /></g>
    )},
    { id: 'sofa_3', category: 'furniture', label: 'Sofa (3-Seater)', width: 2200, height: 900, render: (w, h) => (
        <g><rect x={-w/2} y={-h/2} width={w} height={h} rx="50" fill="none" stroke="currentColor" /><rect x={-w/2} y={-h/2} width={w} height={h-200} rx="20" fill="none" stroke="currentColor" /><path d={`M ${-w/6} ${-h/2} L ${-w/6} ${h/2-200} M ${w/6} ${-h/2} L ${w/6} ${h/2-200}`} stroke="currentColor" /></g>
    )},
    { id: 'table_dining_rect', category: 'furniture', label: 'Dining Table', width: 1800, height: 900, render: (w, h) => (
         <g>
             <rect x={-w/2} y={-h/2} width={w} height={h} rx="10" fill="none" stroke="currentColor" />
             <rect x={-w/2 + 200} y={-h/2 - 300} width="400" height="250" rx="5" fill="none" stroke="currentColor" opacity="0.5" />
             <rect x={w/2 - 600} y={-h/2 - 300} width="400" height="250" rx="5" fill="none" stroke="currentColor" opacity="0.5" />
             <rect x={-w/2 + 200} y={h/2 + 50} width="400" height="250" rx="5" fill="none" stroke="currentColor" opacity="0.5" />
             <rect x={w/2 - 600} y={h/2 + 50} width="400" height="250" rx="5" fill="none" stroke="currentColor" opacity="0.5" />
         </g>
    )},
    { id: 'table_round', category: 'furniture', label: 'Round Table', width: 1000, height: 1000, render: (w, h) => (
         <circle cx="0" cy="0" r={w/2} fill="none" stroke="currentColor" />
    )},
    { id: 'tv_screen', category: 'furniture', label: 'Flat Screen TV', width: 1200, height: 150, render: (w, h) => (
        <g><rect x={-w/2} y={-20} width={w} height={40} rx="5" fill="currentColor" /><path d={`M -200 20 L 200 20 L 0 80 Z`} fill="currentColor" opacity="0.5" /></g>
    )},
    { id: 'wardrobe', category: 'furniture', label: 'Wardrobe', width: 1200, height: 600, render: (w, h) => (
        <g><rect x={-w/2} y={-h/2} width={w} height={h} fill="none" stroke="currentColor" /><line x1={0} y1={-h/2} x2={0} y2={h/2} stroke="currentColor" /><path d={`M ${-w/2+20} ${-h/2} L ${w/2-20} ${h/2}`} stroke="currentColor" strokeDasharray="4,4" opacity="0.3"/></g>
    )},
    { id: 'toilet', category: 'plumbing', label: 'Toilet', width: 400, height: 650, render: (w, h) => (
        <g><rect x={-200} y={-325} width={400} height={200} fill="none" stroke="currentColor" /><ellipse cx={0} cy={100} rx={180} ry={225} fill="none" stroke="currentColor" /></g>
    )},
    { id: 'bath_rect', category: 'plumbing', label: 'Bath', width: 1700, height: 750, render: (w, h) => (
        <g><rect x={-w/2} y={-h/2} width={w} height={h} rx="10" fill="none" stroke="currentColor" /><rect x={-w/2+50} y={-h/2+50} width={w-100} height={h-100} rx="50" fill="none" stroke="currentColor" /><circle cx={-w/2+150} cy={0} r={30} fill="none" stroke="currentColor" /></g>
    )},
    { id: 'sink_vanity', category: 'plumbing', label: 'Vanity Sink', width: 600, height: 500, render: (w, h) => (
        <g><rect x={-w/2} y={-h/2} width={w} height={h} fill="none" stroke="currentColor" /><circle cx={0} cy={0} r={180} fill="none" stroke="currentColor" /><rect x={-20} y={-h/2} width={40} height={50} fill="currentColor" /></g>
    )},
    { id: 'shower_corner', category: 'plumbing', label: 'Corner Shower', width: 900, height: 900, render: (w, h) => (
        <g><path d={`M ${-w/2} ${-h/2} L ${w/2} ${-h/2} L ${w/2} ${h/2} L ${-w/2} ${h/2} Z`} fill="none" stroke="currentColor" /><line x1={-w/2} y1={-h/2} x2={w/2} y2={h/2} stroke="currentColor" /><line x1={-w/2} y1={h/2} x2={w/2} y2={-h/2} stroke="currentColor" /></g>
    )},
    { id: 'socket_single', category: 'electrical', label: 'Single Socket', width: 300, height: 300, render: (w, h) => (
        <g transform="scale(0.8)"><circle cx="0" cy="0" r="100" fill="none" stroke="currentColor" strokeWidth="20" /><path d="M -100 0 A 100 100 0 0 1 100 0" fill="currentColor" /></g>
    )},
    { id: 'socket_double', category: 'electrical', label: 'Double Socket', width: 300, height: 300, render: (w, h) => (
        <g transform="scale(0.8)"><circle cx="0" cy="0" r="100" fill="none" stroke="currentColor" strokeWidth="20" /><path d="M -100 0 A 100 100 0 0 1 100 0" fill="currentColor" /><text x="0" y="-120" textAnchor="middle" fontSize="100" fontWeight="bold" fill="currentColor">2</text></g>
    )},
    { id: 'light_switch', category: 'electrical', label: 'Light Switch', width: 200, height: 200, render: (w, h) => (
        <g><circle cx="0" cy="0" r="50" fill="currentColor" /><line x1="0" y1="0" x2="100" y2="-100" stroke="currentColor" strokeWidth="20" /></g>
    )},
    { id: 'light_pendant', category: 'electrical', label: 'Pendant Light', width: 300, height: 300, render: (w, h) => (
         <g><circle cx="0" cy="0" r="50" fill="none" stroke="currentColor" strokeWidth="20"/><line x1="-50" y1="0" x2="50" y2="0" stroke="currentColor" strokeWidth="20"/><line x1="0" y1="-50" x2="0" y2="50" stroke="currentColor" strokeWidth="20"/></g>
    )},
    { id: 'db_board', category: 'electrical', label: 'Distribution Board', width: 400, height: 200, render: (w, h) => (
        <g><rect x={-200} y={-100} width={400} height={200} fill="currentColor" /><text x="0" y="20" textAnchor="middle" fill="white" fontSize="100" fontWeight="bold">DB</text></g>
    )},
    { id: 'stove_4plate', category: 'hvac', label: '4-Plate Stove', width: 600, height: 600, render: (w, h) => (
        <g><rect x={-300} y={-300} width={600} height={600} rx="10" fill="none" stroke="currentColor" /><circle cx={-150} cy={-150} r={100} fill="none" stroke="currentColor" /><circle cx={150} cy={-150} r={100} fill="none" stroke="currentColor" /><circle cx={-150} cy={150} r={100} fill="none" stroke="currentColor" /><circle cx={150} cy={150} r={100} fill="none" stroke="currentColor" /></g>
    )},
    { id: 'fridge', category: 'hvac', label: 'Fridge', width: 700, height: 700, render: (w, h) => (
        <g><rect x={-w/2} y={-h/2} width={w} height={h} fill="none" stroke="currentColor" /><text x="0" y="50" textAnchor="middle" fontSize="150" fontWeight="bold" fill="currentColor">REF</text></g>
    )},
    { id: 'sink_kitchen_double', category: 'plumbing', label: 'Double Sink', width: 1200, height: 500, render: (w, h) => (
        <g><rect x={-600} y={-250} width={1200} height={500} rx="20" fill="none" stroke="currentColor" /><rect x={-550} y={-200} width={500} height={400} rx="20" fill="none" stroke="currentColor" /><rect x={50} y={-200} width={500} height={400} rx="20" fill="none" stroke="currentColor" /><circle cx={0} cy={-200} r={30} fill="currentColor" /></g>
    )},
    { id: 'gas_bottle', category: 'hvac', label: 'Gas Bottle', width: 380, height: 380, render: (w, h) => (
        <g><circle cx="0" cy="0" r={190} fill="none" stroke="currentColor" strokeDasharray="20,10" /><text x="0" y="20" textAnchor="middle" fontSize="100" fontWeight="bold" fill="currentColor">GAS</text></g>
    )}
];

// --- Wall Helpers ---

// Helper for Quadratic Bezier
// P(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
const getQuadBezierPoint = (p0: Point, p1: Point, p2: Point, t: number): Point => {
    const mt = 1 - t;
    return {
        x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
        y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
    };
};

// Sub-curve of a Quadratic Bezier from tStart to tEnd
// Returns {start, control, end} for the new segment
const getSubBezier = (p0: Point, p1: Point, p2: Point, tStart: number, tEnd: number) => {
    const u0 = 1 - tStart;
    const u1 = 1 - tEnd;

    const start = getQuadBezierPoint(p0, p1, p2, tStart);
    const end = getQuadBezierPoint(p0, p1, p2, tEnd);

    // Control point for the sub-segment
    // Derived from De Casteljau's algorithm or splitting properties
    // Q1 = (1-t0)P0 + t0P1 (This is point on P0-P1 at t0)
    // Q2 = (1-t0)P1 + t0P2 (This is point on P1-P2 at t0)
    // The subcurve from t0 to 1 has control point Q2.
    // We need general [t0, t1].
    // Simpler: Just interpolate between the Q points at tStart and tEnd? No.
    
    // Let's compute intermediate points for De Casteljau at tStart
    const q0_start = { x: u0 * p0.x + tStart * p1.x, y: u0 * p0.y + tStart * p1.y };
    const q1_start = { x: u0 * p1.x + tStart * p2.x, y: u0 * p1.y + tStart * p2.y };
    // The curve from tStart to 1 is defined by Start, q1_start, p2.
    // Now we need to split THIS curve at relative parameter for tEnd.
    // relative T' = (tEnd - tStart) / (1 - tStart)
    
    const tPrime = (tEnd - tStart) / (1 - tStart);
    const uPrime = 1 - tPrime;
    
    // Split the curve (Start, q1_start, p2) at tPrime. We want the first part.
    // Left sub-segment control point is (1-t')Start + t'q1_start ? No.
    // Standard split at T:
    // Left CP = (1-T)P0 + T P1
    // Here P0=Start, P1=q1_start.
    const cp = {
        x: uPrime * start.x + tPrime * q1_start.x, // This is close but check De Casteljau layers
        y: uPrime * start.y + tPrime * q1_start.y
    };
    // Actually, a cleaner way for sub-segment P0->P1->P2 from t1 to t2:
    // C = P1 + (P0-P1)*t1 + (P2-P1)*(1-t2) ? No.
    
    // Re-eval: Q(t) is tangent intersection.
    // Let's just use the geometric property that the new control point is the intersection 
    // of the tangent at Start and tangent at End.
    // Tangent at bezier(t) is vector: 2(1-t)(P1-P0) + 2t(P2-P1).
    // This is reliable.
    
    // Tangent vectors
    const tan1 = sub(getQuadBezierPoint(p0, p1, p2, tStart + 0.001), start);
    const tan2 = sub(end, getQuadBezierPoint(p0, p1, p2, tEnd - 0.001));
    
    // Intersect the lines: Start + k*tan1  and  End + j*tan2
    const intersection = intersectInfiniteLines(
        start, add(start, scale(tan1, 100)),
        end, add(end, scale(tan2, 100))
    );
    
    return { start, control: intersection || scale(add(start, end), 0.5), end };
};

export const getWallPath = (w: Wall, openings: Opening[] = []) => {
    if (w.curvature && Math.abs(w.curvature) > 0.1) {
        const mid = scale(add(w.start, w.end), 0.5);
        const dir = norm(sub(w.end, w.start));
        const normal = { x: -dir.y, y: dir.x };
        const trueMid = { x: (w.start.x + w.end.x)/2, y: (w.start.y + w.end.y)/2 };
        const curv = w.curvature || 0;
        const control = add(trueMid, scale(normal, curv * 2));
        return `M ${w.start.x} ${w.start.y} Q ${control.x} ${control.y} ${w.end.x} ${w.end.y}`;
    }
    // Simple line for straight walls
    return `M ${w.start.x} ${w.start.y} L ${w.end.x} ${w.end.y}`;
};

// Returns INTERVALS [tStart, tEnd] for wall body parts (skipping openings)
const getWallIntervals = (w: Wall, openings: Opening[]) => {
    const wallLen = dist(w.start, w.end);
    if (wallLen < 0.1) return [{start: 0, end: 1}];

    let intervals: {start: number, end: number}[] = openings.map(op => {
        const widthUnits = op.width / 10;
        // Arc length approximation: Linear length. For steep curves this is inaccurate but usable for floor plans.
        const halfWidthT = (widthUnits / 2) / wallLen; 
        return {
            start: Math.max(0, op.t - halfWidthT),
            end: Math.min(1, op.t + halfWidthT)
        };
    });

    intervals.sort((a, b) => a.start - b.start);

    const merged: {start: number, end: number}[] = [];
    if (intervals.length > 0) {
        let current = intervals[0];
        for (let i = 1; i < intervals.length; i++) {
            if (intervals[i].start < current.end) {
                current.end = Math.max(current.end, intervals[i].end);
            } else {
                merged.push(current);
                current = intervals[i];
            }
        }
        merged.push(current);
    }

    const solidIntervals: {start: number, end: number}[] = [];
    let currentT = 0;

    merged.forEach(gap => {
        if (gap.start > currentT) {
             solidIntervals.push({ start: currentT, end: gap.start });
        }
        currentT = Math.max(currentT, gap.end);
    });

    if (currentT < 1) {
         solidIntervals.push({ start: currentT, end: 1 });
    }

    return solidIntervals;
};

interface WallEntityProps { 
    wall: Wall; 
    openings?: Opening[]; 
    selected: boolean; 
    allWalls?: Wall[];
    onMouseDown?: (e: React.MouseEvent) => void; 
}

export const WallEntity: React.FC<WallEntityProps> = ({ wall, openings = [], selected, allWalls = [], onMouseDown }) => {
    const isCurved = wall.curvature && Math.abs(wall.curvature) > 0.1;
    const solidIntervals = getWallIntervals(wall, openings);

    // --- CURVED WALL RENDERING ---
    if (isCurved) {
        const mid = scale(add(wall.start, wall.end), 0.5);
        const dir = norm(sub(wall.end, wall.start));
        const normal = { x: -dir.y, y: dir.x };
        const curv = wall.curvature || 0;
        const trueMid = { x: (wall.start.x + wall.end.x)/2, y: (wall.start.y + wall.end.y)/2 };
        const control = add(trueMid, scale(normal, curv * 2)); // Control point for the quadratic bezier

        return (
            <g onMouseDown={onMouseDown} className="wall-entity">
                {/* Hit Area */}
                <path d={getWallPath(wall)} stroke="transparent" strokeWidth={wall.thickness + 20} fill="none" />

                {solidIntervals.map((interval, i) => {
                    if (Math.abs(interval.end - interval.start) < 0.001) return null;
                    const subC = getSubBezier(wall.start, control, wall.end, interval.start, interval.end);
                    const d = `M ${subC.start.x} ${subC.start.y} Q ${subC.control.x} ${subC.control.y} ${subC.end.x} ${subC.end.y}`;
                    
                    // Render using Layered Strokes to simulate a filled wall with borders
                    return (
                        <g key={i}>
                            {/* 1. Border simulation (Thick black line background) */}
                            <path d={d} stroke="black" strokeWidth={wall.thickness} fill="none" strokeLinecap="butt" mask="url(#wall-cleaner)" />
                            
                            {/* 2. Fill simulation (Thinner white line inside) */}
                            <path d={d} stroke="white" className="dark:stroke-slate-900" strokeWidth={Math.max(0.1, wall.thickness - 2)} fill="none" strokeLinecap="butt" />
                            
                            {/* 3. Hatch Pattern (Overlay on fill) */}
                            <path d={d} stroke="url(#wall_hatch)" strokeWidth={Math.max(0.1, wall.thickness - 2)} fill="none" strokeLinecap="butt" opacity="0.5" />
                            
                            {/* 4. Selection Highlight */}
                            {selected && <path d={d} stroke="#3b82f6" strokeWidth={wall.thickness} opacity="0.3" fill="none" />}
                        </g>
                    );
                })}
            </g>
        );
    }

    // --- STRAIGHT WALL RENDERING ---
    const dir = norm(sub(wall.end, wall.start));
    const normal = { x: -dir.y, y: dir.x };
    const halfThick = wall.thickness / 2;
    const vec = sub(wall.end, wall.start);

    return (
        <g onMouseDown={onMouseDown} className="wall-entity">
             {/* Hit Area */}
            <path d={getWallPath(wall, openings)} stroke="transparent" strokeWidth={wall.thickness + 20} fill="none" />

            {solidIntervals.map((interval, i) => {
                const pStart = add(wall.start, scale(vec, interval.start));
                const pEnd = add(wall.start, scale(vec, interval.end));

                const sp1 = add(pStart, scale(normal, halfThick));
                const sp2 = add(pEnd, scale(normal, halfThick));
                const sp3 = add(pEnd, scale(normal, -halfThick));
                const sp4 = add(pStart, scale(normal, -halfThick));
                
                const polyPath = `M ${sp1.x} ${sp1.y} L ${sp2.x} ${sp2.y} L ${sp3.x} ${sp3.y} L ${sp4.x} ${sp4.y} Z`;

                return (
                    <g key={i}>
                        {/* 1. Fill (White) */}
                        <path d={polyPath} fill="white" className="dark:fill-slate-900" stroke="none" />
                        
                        {/* 2. Hatch Pattern */}
                        <path d={polyPath} fill="url(#wall_hatch)" stroke="none" opacity="0.5"/>
                        
                        {/* 3. Selection Highlight */}
                        {selected && <path d={polyPath} fill="#3b82f6" opacity="0.2" stroke="none" />}
                        
                        {/* 4. Stroke (Edging) with Mask */}
                        <path 
                            d={polyPath} 
                            fill="none" 
                            stroke={selected ? "#3b82f6" : "black"} 
                            className={selected ? '' : 'dark:stroke-slate-200'}
                            strokeWidth="1" 
                            mask="url(#wall-cleaner)"
                            vectorEffect="non-scaling-stroke"
                        />
                    </g>
                );
            })}
        </g>
    );
};

// ... (OpeningEntity, StairEntity, DimensionEntity, LabelEntity, NorthArrowEntity, SymbolEntity, AutoDimensionEntity, generateLegendData - keep unchanged) ...

interface OpeningEntityProps { op: Opening; wall: Wall; selected: boolean; showLabel: boolean; }
export const OpeningEntity: React.FC<OpeningEntityProps> = ({ op, wall, selected, showLabel }) => {
    const x = wall.start.x + op.t * (wall.end.x - wall.start.x);
    const y = wall.start.y + op.t * (wall.end.y - wall.start.y);
    const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x) * 180 / Math.PI;
    
    return (
        <g transform={`translate(${x},${y}) rotate(${angle})`} className="cursor-pointer">
            {op.type === 'door' ? (
                <g>
                    <g transform={`scale(${op.flipX ? -1 : 1}, ${op.flipY ? -1 : 1})`}>
                        {op.subType === 'double' ? (
                             <g>
                                <path d={`M ${-op.width/20} ${-wall.thickness/2} L ${-op.width/20} ${-wall.thickness/2 - op.width/20} A ${op.width/20} ${op.width/20} 0 0 1 0 ${-wall.thickness/2}`} fill="none" stroke={selected ? "#2563eb" : "#ef4444"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                <path d={`M ${op.width/20} ${-wall.thickness/2} L ${op.width/20} ${-wall.thickness/2 - op.width/20} A ${op.width/20} ${op.width/20} 0 0 0 0 ${-wall.thickness/2}`} fill="none" stroke={selected ? "#2563eb" : "#ef4444"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                             </g>
                        ) : op.subType === 'sliding' ? (
                             <g>
                                 <rect x={-op.width/20} y={-wall.thickness/2 - 5} width={op.width/20} height={5} fill={selected ? "#2563eb" : "#ef4444"} opacity="0.7" />
                                 <rect x={0} y={-wall.thickness/2 + 5} width={op.width/20} height={5} fill={selected ? "#2563eb" : "#ef4444"} opacity="0.7" />
                                 <line x1={-10} y1={0} x2={10} y2={0} stroke={selected ? "#2563eb" : "#ef4444"} markerEnd="url(#arrow)" />
                             </g>
                        ) : (
                            <path d={`M ${-op.width/20} ${-wall.thickness/2} L ${-op.width/20} ${-wall.thickness/2 - op.width/10} A ${op.width/10} ${op.width/10} 0 0 1 ${op.width/20} ${-wall.thickness/2}`} fill="none" stroke={selected ? "#2563eb" : "#ef4444"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        )}
                    </g>
                    {op.subType !== 'sliding' && (<line x1={-op.width/20} y1={0} x2={op.width/20} y2={0} stroke="#ef4444" strokeWidth="1" strokeDasharray="2,2" />)}
                    {showLabel && <text y={-wall.thickness/2 - op.width/10 - 10} textAnchor="middle" className="text-[10px] fill-slate-600 dark:fill-slate-400 font-bold" transform={`rotate(${-angle})`}>{op.label}</text>}
                </g>
            ) : (
                <g>
                    {op.subType === 'fixed' ? (
                         <g><rect x={-op.width/20} y={-2} width={op.width/10} height={4} fill="none" stroke={selected ? "#60a5fa" : "#3b82f6"} strokeWidth="1" /><line x1={-op.width/20} y1={0} x2={op.width/20} y2={0} stroke={selected ? "#60a5fa" : "#3b82f6"} strokeWidth="2" /></g>
                    ) : op.subType === 'sliding' ? (
                         <g><line x1={-op.width/20} y1={-2} x2={0} y2={-2} stroke={selected ? "#60a5fa" : "#3b82f6"} strokeWidth="2" /><line x1={0} y1={2} x2={op.width/20} y2={2} stroke={selected ? "#60a5fa" : "#3b82f6"} strokeWidth="2" /><line x1={-5} y1={0} x2={5} y2={0} stroke={selected ? "#60a5fa" : "#3b82f6"} markerEnd="url(#arrow)" strokeWidth="0.5" /></g>
                    ) : (
                         <rect x={-op.width/20} y={-2} width={op.width/10} height={4} fill={selected ? "#60a5fa" : "#3b82f6"} opacity="0.5" />
                    )}
                    <line x1={-op.width/20} y1={-wall.thickness/2} x2={op.width/20} y2={-wall.thickness/2} className="stroke-slate-700 dark:stroke-slate-300" strokeWidth="0.5"/>
                    <line x1={-op.width/20} y1={wall.thickness/2} x2={op.width/20} y2={wall.thickness/2} className="stroke-slate-700 dark:stroke-slate-300" strokeWidth="0.5"/>
                    {showLabel && <text y={wall.thickness/2 + 20} textAnchor="middle" className="text-[10px] fill-slate-600 dark:fill-slate-400 font-bold" transform={`rotate(${-angle})`}>{op.label}</text>}
                </g>
            )}
        </g>
    );
};

interface StairEntityProps { stair: Stair; selected: boolean; }
export const StairEntity: React.FC<StairEntityProps> = ({ stair, selected }) => {
    const treadLen = stair.treadDepth;
    const w = stair.width;
    let path = "";
    let arrowPath = "";
    let totalLen = 0;
    
    if (stair.type === StairType.STRAIGHT) {
        const len = stair.count * treadLen;
        totalLen = len;
        path = `M 0 0 L ${w} 0 L ${w} ${len} L 0 ${len} Z `;
        for(let i=1; i<stair.count; i++) path += `M 0 ${i*treadLen} L ${w} ${i*treadLen} `;
        arrowPath = `M ${w/2} ${treadLen} L ${w/2} ${len - treadLen} L ${w/2 - 5} ${len - treadLen - 10} M ${w/2} ${len - treadLen} L ${w/2 + 5} ${len - treadLen - 10}`;
    } else if (stair.type === StairType.L_SHAPE) {
        const f1Len = stair.flight1Count * treadLen;
        const f2Len = (stair.count - stair.flight1Count) * treadLen;
        path += `M 0 0 L ${w} 0 L ${w} ${f1Len} L 0 ${f1Len} Z `;
        for(let i=1; i<stair.flight1Count; i++) path += `M 0 ${i*treadLen} L ${w} ${i*treadLen} `;
        path += `M 0 ${f1Len} L ${w} ${f1Len} L ${w} ${f1Len + w} L 0 ${f1Len + w} Z `;
        const f2StartX = w; const f2StartY = f1Len;
        path += `M ${f2StartX} ${f2StartY} L ${f2StartX + f2Len} ${f2StartY} L ${f2StartX + f2Len} ${f2StartY + w} L ${f2StartX} ${f2StartY + w} Z `;
        for(let i=1; i<(stair.count - stair.flight1Count); i++) path += `M ${f2StartX + i*treadLen} ${f2StartY} L ${f2StartX + i*treadLen} ${f2StartY + w} `;
        arrowPath = `M ${w/2} ${treadLen} L ${w/2} ${f1Len + w/2} L ${w + treadLen} ${f1Len + w/2}`;
    } else if (stair.type === StairType.U_SHAPE) {
        const f1Len = stair.flight1Count * treadLen;
        const f2Len = (stair.count - stair.flight1Count) * treadLen;
        const gap = 10; 
        path += `M 0 0 L ${w} 0 L ${w} ${f1Len} L 0 ${f1Len} Z `;
        for(let i=1; i<stair.flight1Count; i++) path += `M 0 ${i*treadLen} L ${w} ${i*treadLen} `;
        path += `M 0 ${f1Len} L ${w*2 + gap} ${f1Len} L ${w*2 + gap} ${f1Len + w} L 0 ${f1Len + w} Z `;
        const f2X = w + gap;
        path += `M ${f2X} 0 L ${f2X + w} 0 L ${f2X + w} ${f2Len} L ${f2X} ${f2Len} Z `;
        for(let i=1; i<(stair.count - stair.flight1Count); i++) path += `M ${f2X} ${i*treadLen} L ${f2X + w} ${i*treadLen} `;
    }

    const RenderLocalDim = ({ start, end, val, offset = 20 }: { start: {x:number, y:number}, end: {x:number, y:number}, val: number, offset?: number }) => {
         const dx = end.x - start.x;
         const dy = end.y - start.y;
         const len = Math.hypot(dx, dy);
         if (len < 0.1) return null;
         const nx = -dy / len;
         const ny = dx / len;
         const p1 = { x: start.x + nx * offset, y: start.y + ny * offset };
         const p2 = { x: end.x + nx * offset, y: end.y + ny * offset };
         const ext1 = { x: start.x + nx * (offset + 5), y: start.y + ny * (offset + 5) };
         const ext2 = { x: end.x + nx * (offset + 5), y: end.y + ny * (offset + 5) };
         let rotation = Math.atan2(dy, dx) * 180 / Math.PI;
         if (rotation > 90 || rotation <= -90) rotation += 180;
         return (
             <g>
                 <line x1={start.x} y1={start.y} x2={ext1.x} y2={ext1.y} stroke="black" strokeWidth="0.5" vectorEffect="non-scaling-stroke" opacity="0.3" />
                 <line x1={end.x} y1={end.y} x2={ext2.x} y2={ext2.y} stroke="black" strokeWidth="0.5" vectorEffect="non-scaling-stroke" opacity="0.3" />
                 <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="black" strokeWidth="1" vectorEffect="non-scaling-stroke" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                 <g transform={`translate(${(p1.x + p2.x)/2}, ${(p1.y + p2.y)/2}) rotate(${rotation})`}>
                    <text x="0" y="-4" textAnchor="middle" alignmentBaseline="baseline" fontSize="14" fontWeight="bold" stroke="white" strokeWidth="3" paintOrder="stroke" fill="black" className="font-mono">{Math.round(val)}</text>
                 </g>
             </g>
         )
    };

    return (
        <g transform={`translate(${stair.position.x}, ${stair.position.y}) rotate(${stair.rotation})`} className="cursor-move group">
            <path d={path} stroke={selected ? "#3b82f6" : "black"} strokeWidth="1" vectorEffect="non-scaling-stroke" fill="none" className="text-slate-800 dark:text-slate-200"/>
            <path d={arrowPath} stroke={selected ? "#3b82f6" : "black"} strokeWidth="1" vectorEffect="non-scaling-stroke" fill="none" markerEnd="url(#arrow)" className="text-slate-800 dark:text-slate-200"/>
            <RenderLocalDim start={{x:0, y:0}} end={{x:w, y:0}} val={w * 10} offset={-20} />
            {stair.type === StairType.STRAIGHT && (<RenderLocalDim start={{x:w, y:0}} end={{x:w, y:totalLen}} val={totalLen * 10} offset={20} />)}
            {stair.type === StairType.L_SHAPE && (<g><RenderLocalDim start={{x:w, y:0}} end={{x:w, y:stair.flight1Count * treadLen}} val={stair.flight1Count * treadLen * 10} offset={20} /><RenderLocalDim start={{x:w, y:stair.flight1Count * treadLen + w}} end={{x:w + (stair.count - stair.flight1Count) * treadLen, y:stair.flight1Count * treadLen + w}} val={(stair.count - stair.flight1Count) * treadLen * 10} offset={20} /></g>)}
            {stair.type === StairType.U_SHAPE && (<g><RenderLocalDim start={{x:w*2 + 10, y:0}} end={{x:w*2 + 10, y:stair.flight1Count * treadLen}} val={stair.flight1Count * treadLen * 10} offset={20} /></g>)}
            {stair.locked && <circle r="5" fill="red" opacity="0.5" />}
        </g>
    )
};

interface DimensionEntityProps { dim: Dimension; selected: boolean; }
export const DimensionEntity: React.FC<DimensionEntityProps> = ({ dim, selected }) => {
    const angle = Math.atan2(dim.end.y - dim.start.y, dim.end.x - dim.start.x) * 180 / Math.PI;
    const center = scale(add(dim.start, dim.end), 0.5);
    const d = dist(dim.start, dim.end);
    const dir = norm(sub(dim.end, dim.start));
    const normal = { x: -dir.y, y: dir.x };
    const offset = dim.offset || 40; 
    const pStart = add(dim.start, scale(normal, offset));
    const pEnd = add(dim.end, scale(normal, offset));

    return (
        <g className="cursor-pointer group">
            <line x1={pStart.x} y1={pStart.y} x2={pEnd.x} y2={pEnd.y} stroke="transparent" strokeWidth="10" />
            <line x1={dim.start.x} y1={dim.start.y} x2={pStart.x} y2={pStart.y} className="stroke-slate-300 dark:stroke-slate-600" strokeDasharray="2,2" />
            <line x1={dim.end.x} y1={dim.end.y} x2={pEnd.x} y2={pEnd.y} className="stroke-slate-300 dark:stroke-slate-600" strokeDasharray="2,2" />
            <line x1={pStart.x} y1={pStart.y} x2={pEnd.x} y2={pEnd.y} className={`${selected ? 'stroke-blue-500' : 'stroke-slate-500 dark:stroke-slate-400'}`} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
            <g transform={`translate(${ (pStart.x + pEnd.x)/2 }, ${ (pStart.y + pEnd.y)/2 })`}>
                <rect x="-20" y="-10" width="40" height="20" rx="4" fill="white" className="dark:fill-slate-900" opacity="0.8" />
                <text textAnchor="middle" alignmentBaseline="middle" className={`text-xs font-mono select-none ${selected ? 'fill-blue-500' : 'fill-slate-600 dark:fill-slate-300'}`}>{Math.round(d * 10)}</text>
            </g>
        </g>
    )
};

interface LabelEntityProps { label: RoomLabel; selected: boolean; }
export const LabelEntity: React.FC<LabelEntityProps> = ({ label, selected }) => (
    <g transform={`translate(${label.position.x}, ${label.position.y})`} className="cursor-move">
        <text textAnchor="middle" className={`text-sm font-bold select-none ${selected ? 'fill-blue-500' : 'fill-slate-800 dark:fill-slate-200'}`}>{label.text}</text>
        {label.area && <text y="15" textAnchor="middle" className="text-xs fill-slate-500 dark:fill-slate-400">{label.area.toFixed(1)} m²</text>}
        {label.locked && <circle r="4" cx="20" cy="-5" fill="red" opacity="0.5" />}
    </g>
);

interface NorthArrowEntityProps { arrow: NorthArrow; selected: boolean; }
export const NorthArrowEntity: React.FC<NorthArrowEntityProps> = ({ arrow, selected }) => (
    <g transform={`translate(${arrow.position.x}, ${arrow.position.y}) rotate(${arrow.rotation})`} className="cursor-move">
        <circle r="30" fill="none" stroke={selected ? "#3b82f6" : "currentColor"} strokeWidth="2" className="text-slate-800 dark:text-slate-200" />
        <path d="M 0 -25 L 10 0 L 0 25 L -10 0 Z" fill={selected ? "#3b82f6" : "currentColor"} className="text-slate-800 dark:text-slate-200" />
        <text y="-35" textAnchor="middle" fontWeight="bold" fontSize="12" fill={selected ? "#3b82f6" : "currentColor"} className="text-slate-800 dark:text-slate-200">N</text>
        {selected && (<g transform="translate(0, -50)"><line x1="0" y1="20" x2="0" y2="0" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2,2" /><circle r="6" fill="#10b981" stroke="white" strokeWidth="2" className="cursor-pointer hover:scale-110 transition-transform" /></g>)}
    </g>
);

interface SymbolEntityProps { symbol: SymbolInstance; selected: boolean; }
export const SymbolEntity: React.FC<SymbolEntityProps> = ({ symbol, selected }) => {
    const def = SYMBOL_CATALOG.find(d => d.id === symbol.type);
    if (!def) return null;
    const w = (def.width / 10) * symbol.scale;
    const h = (def.height / 10) * symbol.scale;
    return (
        <g transform={`translate(${symbol.position.x}, ${symbol.position.y}) rotate(${symbol.rotation})`} className={`cursor-move transition-colors ${selected ? 'text-blue-500' : 'text-slate-700 dark:text-slate-300'}`}>
             {def.render(w, h)}
             {symbol.locked && <circle r="5" fill="red" opacity="0.5" />}
        </g>
    );
};

// --- Helper: Auto-Dimensions Entity ---
interface AutoDimensionEntityProps {
    wall: Wall;
    openings: Opening[];
    planCenter?: { x: number, y: number };
}

export const AutoDimensionEntity: React.FC<AutoDimensionEntityProps> = ({ wall, openings, planCenter }) => {
    if (Math.abs(wall.curvature || 0) > 1) return null;
    if (dist(wall.start, wall.end) < 1) return null;

    const dir = norm(sub(wall.end, wall.start));
    let normal = { x: -dir.y, y: dir.x };
    
    if (planCenter) {
        const mid = scale(add(wall.start, wall.end), 0.5);
        const toCenter = sub(planCenter, mid);
        if (dot(normal, toCenter) > 0) normal = scale(normal, -1);
    }

    const baseOffset = (wall.thickness / 2);
    const tier1Offset = baseOffset + 30; 
    const tier2Offset = baseOffset + 60;

    const wallLen = dist(wall.start, wall.end);
    const sortedOpenings = [...openings].sort((a, b) => a.t - b.t);

    const points: { t: number, type: 'gap' | 'width', val: number }[] = [];
    let prevT = 0;

    sortedOpenings.forEach(op => {
        const opWidthUnits = op.width / 10;
        const halfWidthT = (opWidthUnits / 2) / wallLen;
        const startT = op.t - halfWidthT;
        const endT = op.t + halfWidthT;

        if (startT > prevT + 0.001) {
            const gapLen = (startT - prevT) * wallLen * 10;
            points.push({ t: (prevT + startT)/2, type: 'gap', val: gapLen });
        }
        points.push({ t: op.t, type: 'width', val: op.width });
        prevT = endT;
    });

    if (prevT < 0.999) {
        const gapLen = (1 - prevT) * wallLen * 10;
        points.push({ t: (prevT + 1)/2, type: 'gap', val: gapLen });
    }

    const renderDimLine = (offset: number, segments: {t: number, val: number}[], isOverall = false) => {
        const pStart = add(wall.start, scale(normal, offset));
        const pEnd = add(wall.end, scale(normal, offset));
        const tickSize = 5;
        let rotation = Math.atan2(dir.y, dir.x) * 180 / Math.PI;
        if (rotation > 90 || rotation <= -90) rotation += 180;

        return (
            <g>
                <line x1={pStart.x} y1={pStart.y} x2={pEnd.x} y2={pEnd.y} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="0.5" />
                <line x1={pStart.x - normal.x*tickSize + dir.x*tickSize} y1={pStart.y - normal.y*tickSize + dir.y*tickSize} x2={pStart.x + normal.x*tickSize - dir.x*tickSize} y2={pStart.y + normal.y*tickSize - dir.y*tickSize} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1"/>
                <line x1={pEnd.x - normal.x*tickSize + dir.x*tickSize} y1={pEnd.y - normal.y*tickSize + dir.y*tickSize} x2={pEnd.x + normal.x*tickSize - dir.x*tickSize} y2={pEnd.y + normal.y*tickSize - dir.y*tickSize} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1"/>

                {!isOverall && sortedOpenings.map((op, i) => {
                     const opWidthUnits = op.width / 10;
                     const center = add(wall.start, scale(sub(wall.end, wall.start), op.t));
                     const opStart = add(center, scale(dir, -opWidthUnits/2));
                     const opEnd = add(center, scale(dir, opWidthUnits/2));
                     const pOpStart = add(opStart, scale(normal, offset));
                     const pOpEnd = add(opEnd, scale(normal, offset));
                     const extStart = add(opStart, scale(normal, wall.thickness/2 + 2));
                     const extEnd = add(opEnd, scale(normal, wall.thickness/2 + 2));
                     
                     return (
                         <g key={i}>
                             <line x1={extStart.x} y1={extStart.y} x2={pOpStart.x} y2={pOpStart.y} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="0.5" />
                             <line x1={extEnd.x} y1={extEnd.y} x2={pOpEnd.x} y2={pOpEnd.y} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="0.5" />
                             <line x1={pOpStart.x - normal.x*tickSize + dir.x*tickSize} y1={pOpStart.y - normal.y*tickSize + dir.y*tickSize} x2={pOpStart.x + normal.x*tickSize - dir.x*tickSize} y2={pOpStart.y + normal.y*tickSize - dir.y*tickSize} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1"/>
                             <line x1={pOpEnd.x - normal.x*tickSize + dir.x*tickSize} y1={pOpEnd.y - normal.y*tickSize + dir.y*tickSize} x2={pOpEnd.x + normal.x*tickSize - dir.x*tickSize} y2={pOpEnd.y + normal.y*tickSize - dir.y*tickSize} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1"/>
                         </g>
                     )
                })}

                {segments.map((seg, idx) => {
                    const pos = add(wall.start, scale(sub(wall.end, wall.start), seg.t));
                    const textPos = add(pos, scale(normal, offset + 5)); 
                    return (
                        <g key={idx} transform={`translate(${textPos.x}, ${textPos.y}) rotate(${rotation})`}>
                            <rect x="-14" y="-6" width="28" height="12" fill="white" className="dark:fill-slate-900" opacity="0.8" />
                            <text x="0" y="0" textAnchor="middle" alignmentBaseline="middle" fontSize="10" className="fill-slate-600 dark:fill-slate-400 font-mono font-semibold">{Math.round(seg.val)}</text>
                        </g>
                    )
                })}
            </g>
        );
    };

    return (
        <g pointerEvents="none">
             {sortedOpenings.length > 0 && renderDimLine(tier1Offset, points)}
             {renderDimLine(sortedOpenings.length > 0 ? tier2Offset : tier1Offset, [{t: 0.5, val: wallLen * 10}], true)}
        </g>
    );
};

export const generateLegendData = (data: PlanData) => {
    const legendItems: { code: string, description: string, icon?: React.ReactNode }[] = [];
    const seenCodes = new Set<string>();
    const doors = data.openings.filter(o => o.type === 'door');
    doors.forEach(d => {
        const code = d.label || 'D?';
        const uniqueKey = `${code}-${d.subType}-${d.width}`;
        if (!seenCodes.has(uniqueKey)) {
            let desc = d.subType === 'double' ? "Double Swing Door" : d.subType === 'sliding' ? "Sliding Door" : "Single Swing Door";
            legendItems.push({ code, description: `${desc} (${d.width}x${d.height})` });
            seenCodes.add(uniqueKey);
        }
    });
    const windows = data.openings.filter(o => o.type === 'window');
    windows.forEach(w => {
        const code = w.label || 'W?';
        const uniqueKey = `${code}-${w.subType}-${w.width}`;
        if (!seenCodes.has(uniqueKey)) {
            let desc = w.subType === 'sliding' ? "Sliding Window" : w.subType === 'fixed' ? "Fixed Window" : "Casement Window";
            legendItems.push({ code, description: `${desc} (${w.width}x${w.height})` });
            seenCodes.add(uniqueKey);
        }
    });
    data.symbols.forEach(s => {
        const def = SYMBOL_CATALOG.find(d => d.id === s.type);
        if (def && !seenCodes.has(def.label)) {
            legendItems.push({ code: 'SYM', description: def.label, icon: def.render(20, 20) });
            seenCodes.add(def.label);
        }
    });
    return Array.from(new Map(legendItems.map(item => [item.code + item.description, item])).values()).sort((a, b) => a.code.localeCompare(b.code));
};
