import React, { useMemo } from 'react';
import { Wall, Opening, Stair, Dimension, RoomLabel, StairType, NorthArrow, SymbolInstance, PlanData, Point } from '../types';
import { dist, sub, add, scale, norm, len, dot, intersectInfiniteLines, getSegmentClippedByPolygons } from '../utils/geometry';

// --- Components ---

export const ResizeHandle = ({ x, y, cursor = 'cursor-pointer' }: { x: number, y: number, cursor?: string }) => (
    <circle cx={x} cy={y} r={5} fill="#3b82f6" stroke="white" strokeWidth={2} className={`${cursor} hover:scale-125 transition-transform pointer-events-none`} />
);

// --- Symbol Catalog Definition ---
export interface SymbolDef {
    id: string;
    category: 'furniture' | 'electrical' | 'plumbing' | 'hvac' | 'annotations' | 'doors' | 'windows';
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
    
    // Plumbing - Baths
    { id: 'bath_rect', category: 'plumbing', label: 'Recessed Bath', width: 1700, height: 750, render: (w, h) => (
        <g><rect x={-w/2} y={-h/2} width={w} height={h} rx="10" fill="none" stroke="currentColor" /><rect x={-w/2+50} y={-h/2+50} width={w-100} height={h-100} rx="50" fill="none" stroke="currentColor" /><circle cx={-w/2+150} cy={0} r={30} fill="none" stroke="currentColor" /></g>
    )},
    { id: 'bath_corner_round', category: 'plumbing', label: 'Corner Bath (Round)', width: 1500, height: 1500, render: (w, h) => (
        <g>
            <path d={`M ${-w/2} ${-h/2} L ${w/2} ${-h/2} L ${w/2} ${0} A ${w/2} ${h/2} 0 0 1 ${0} ${h/2} L ${-w/2} ${h/2} Z`} fill="none" stroke="currentColor" />
            <path d={`M ${-w/2+100} ${-h/2+100} L ${w/2-100} ${-h/2+100} L ${w/2-100} ${0} A ${w/2-100} ${h/2-100} 0 0 1 ${0} ${h/2-100} L ${-w/2+100} ${h/2-100} Z`} fill="none" stroke="currentColor" />
        </g>
    )},
    { id: 'bath_angle', category: 'plumbing', label: 'Corner Bath (Angle)', width: 1500, height: 1500, render: (w, h) => (
        <g>
            <path d={`M ${-w/2} ${-h/2} L ${w/2} ${-h/2} L ${w/2} ${0} L ${0} ${h/2} L ${-w/2} ${h/2} Z`} fill="none" stroke="currentColor" />
             <ellipse cx={0} cy={-100} rx={w/2.5} ry={h/3} transform="rotate(-45)" fill="none" stroke="currentColor" />
        </g>
    )},
    { id: 'bath_whirlpool', category: 'plumbing', label: 'Whirlpool Bath', width: 1800, height: 1000, render: (w, h) => (
        <g>
            <rect x={-w/2} y={-h/2} width={w} height={h} fill="none" stroke="currentColor" />
            <ellipse cx={0} cy={0} rx={w/2 - 100} ry={h/2 - 100} fill="none" stroke="currentColor" />
        </g>
    )},
    { id: 'bath_island', category: 'plumbing', label: 'Island Bath', width: 1800, height: 900, render: (w, h) => (
        <g>
            <rect x={-w/2} y={-h/2} width={w} height={h} rx={h/3} fill="none" stroke="currentColor" />
            <rect x={-w/2 + 50} y={-h/2 + 50} width={w - 100} height={h - 100} rx={h/3 - 50} fill="none" stroke="currentColor" />
        </g>
    )},

    // Plumbing - Showers
    { id: 'shower_corner', category: 'plumbing', label: 'Corner Shower', width: 900, height: 900, render: (w, h) => (
        <g><path d={`M ${-w/2} ${-h/2} L ${w/2} ${-h/2} L ${w/2} ${h/2} L ${-w/2} ${h/2} Z`} fill="none" stroke="currentColor" /><line x1={-w/2} y1={-h/2} x2={w/2} y2={h/2} stroke="currentColor" /><line x1={-w/2} y1={h/2} x2={w/2} y2={-h/2} stroke="currentColor" /></g>
    )},
    { id: 'shower_stall', category: 'plumbing', label: 'Shower Stall', width: 900, height: 900, render: (w, h) => (
        <g>
            <rect x={-w/2} y={-h/2} width={w} height={h} fill="none" stroke="currentColor" />
            <line x1={-w/2} y1={-h/2} x2={w/2} y2={h/2} stroke="currentColor" strokeWidth="0.5" />
            <line x1={w/2} y1={-h/2} x2={-w/2} y2={h/2} stroke="currentColor" strokeWidth="0.5" />
            <circle cx={0} cy={0} r={40} fill="none" stroke="currentColor" />
        </g>
    )},

    // Plumbing - Toilets & Urinals
    { id: 'toilet', category: 'plumbing', label: 'WC (Tank)', width: 400, height: 650, render: (w, h) => (
        <g><rect x={-200} y={-325} width={400} height={200} fill="none" stroke="currentColor" /><ellipse cx={0} cy={100} rx={180} ry={225} fill="none" stroke="currentColor" /></g>
    )},
    { id: 'wc_flush', category: 'plumbing', label: 'WC (Flush Valve)', width: 400, height: 600, render: (w, h) => (
        <g>
            <path d={`M ${-w/2} ${-h/2} L ${w/2} ${-h/2}`} stroke="currentColor" />
            <ellipse cx={0} cy={50} rx={w/2 - 20} ry={h/2 - 50} fill="none" stroke="currentColor" />
            <rect x={-40} y={-h/2 - 40} width={80} height={40} fill="none" stroke="currentColor" />
        </g>
    )},
    { id: 'wc_bidet', category: 'plumbing', label: 'Bidet', width: 400, height: 600, render: (w, h) => (
        <g>
            <path d={`M ${-w/2} ${-h/2} L ${w/2} ${-h/2}`} stroke="currentColor" />
            <path d={`M ${-w/2 + 30} ${-h/2} L ${-w/2 + 30} ${0} C ${-w/2 + 30} ${h/2} ${w/2 - 30} ${h/2} ${w/2 - 30} ${0} L ${w/2 - 30} ${-h/2}`} fill="none" stroke="currentColor" />
        </g>
    )},
    { id: 'urinal_wall', category: 'plumbing', label: 'Urinal (Wall)', width: 400, height: 300, render: (w, h) => (
        <g>
            <path d={`M ${-w/2} ${-h/2} L ${w/2} ${-h/2}`} stroke="currentColor" />
            <path d={`M ${-w/2 + 50} ${-h/2} C ${-w/2 + 50} ${h/2} ${w/2 - 50} ${h/2} ${w/2 - 50} ${-h/2}`} fill="none" stroke="currentColor" />
        </g>
    )},
    { id: 'urinal_stall', category: 'plumbing', label: 'Urinal (Stall)', width: 450, height: 600, render: (w, h) => (
        <g>
            <path d={`M ${-w/2} ${-h/2} L ${-w/2} ${h/2} L ${w/2} ${h/2} L ${w/2} ${-h/2}`} fill="none" stroke="currentColor" />
            <path d={`M ${-w/2 + 100} ${-h/2} L ${-w/2 + 100} ${h/2 - 100} L ${w/2 - 100} ${h/2 - 100} L ${w/2 - 100} ${-h/2}`} fill="none" stroke="currentColor" />
        </g>
    )},

    // Plumbing - Sinks
    { id: 'sink_vanity', category: 'plumbing', label: 'Vanity Sink', width: 600, height: 500, render: (w, h) => (
        <g><rect x={-w/2} y={-h/2} width={w} height={h} fill="none" stroke="currentColor" /><circle cx={0} cy={0} r={180} fill="none" stroke="currentColor" /><rect x={-20} y={-h/2} width={40} height={50} fill="currentColor" /></g>
    )},
    { id: 'sink_wall', category: 'plumbing', label: 'Wall Sink', width: 500, height: 400, render: (w, h) => (
        <g>
            <rect x={-w/2} y={-h/2} width={w} height={h} rx="20" fill="none" stroke="currentColor" />
            <rect x={-w/2 + 40} y={-h/2 + 40} width={w - 80} height={h - 80} rx="15" fill="none" stroke="currentColor" />
        </g>
    )},
    { id: 'sink_pedestal', category: 'plumbing', label: 'Pedestal Sink', width: 550, height: 450, render: (w, h) => (
        <g>
            <line x1={-w/2} y1={-h/2} x2={w/2} y2={-h/2} stroke="currentColor" />
            <ellipse cx={0} cy={0} rx={w/2} ry={h/2} fill="none" stroke="currentColor" />
            <rect x={-w/4} y={-h/2} width={w/2} height={h/4} fill="none" stroke="currentColor" />
        </g>
    )},
    { id: 'sink_corner', category: 'plumbing', label: 'Corner Sink', width: 600, height: 600, render: (w, h) => (
        <g>
            <path d={`M ${-w/2} ${-h/2} L ${w/2} ${-h/2} L ${w/2} ${0} L ${0} ${h/2} L ${-w/2} ${0} Z`} fill="none" stroke="currentColor" />
            <circle cx={0} cy={-h/4} r={w/4} fill="none" stroke="currentColor" />
        </g>
    )},
    { id: 'sink_kitchen_double', category: 'plumbing', label: 'Double Sink', width: 1200, height: 500, render: (w, h) => (
        <g><rect x={-600} y={-250} width={1200} height={500} rx="20" fill="none" stroke="currentColor" /><rect x={-550} y={-200} width={500} height={400} rx="20" fill="none" stroke="currentColor" /><rect x={50} y={-200} width={500} height={400} rx="20" fill="none" stroke="currentColor" /><circle cx={0} cy={-200} r={30} fill="currentColor" /></g>
    )},

    // Electrical
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

    // HVAC / Appliances
    { id: 'stove_4plate', category: 'hvac', label: '4-Plate Stove', width: 600, height: 600, render: (w, h) => (
        <g><rect x={-300} y={-300} width={600} height={600} rx="10" fill="none" stroke="currentColor" /><circle cx={-150} cy={-150} r={100} fill="none" stroke="currentColor" /><circle cx={150} cy={-150} r={100} fill="none" stroke="currentColor" /><circle cx={-150} cy={150} r={100} fill="none" stroke="currentColor" /><circle cx={150} cy={150} r={100} fill="none" stroke="currentColor" /></g>
    )},
    { id: 'fridge', category: 'hvac', label: 'Fridge', width: 700, height: 700, render: (w, h) => (
        <g><rect x={-w/2} y={-h/2} width={w} height={h} fill="none" stroke="currentColor" /><text x="0" y="50" textAnchor="middle" fontSize="150" fontWeight="bold" fill="currentColor">REF</text></g>
    )},
    { id: 'gas_bottle', category: 'hvac', label: 'Gas Bottle', width: 380, height: 380, render: (w, h) => (
        <g><circle cx="0" cy="0" r={190} fill="none" stroke="currentColor" strokeDasharray="20,10" /><text x="0" y="20" textAnchor="middle" fontSize="100" fontWeight="bold" fill="currentColor">GAS</text></g>
    )},

    // Annotations
    { id: 'north_arrow', category: 'annotations', label: 'North Arrow', width: 500, height: 500, render: (w, h) => (
        <g>
            <circle cx="0" cy="0" r={h/2} fill="none" stroke="currentColor" strokeWidth="2" />
            <path d={`M 0 ${-h/2 + 20} L 0 ${h/2 - 20}`} stroke="currentColor" strokeWidth="1" />
            <path d={`M ${-w/2 + 20} 0 L ${w/2 - 20} 0`} stroke="currentColor" strokeWidth="1" />
            <path d={`M 0 -25 L 10 0 L 0 25 L -10 0 Z`} fill="currentColor" />
            <text y="-35" textAnchor="middle" fontWeight="bold" fontSize="12" fill="currentColor">N</text>
        </g>
    )},
    { id: 'scale_bar', category: 'annotations', label: 'Scale Bar', width: 1000, height: 100, render: (w, h) => (
        <g>
            <rect x={-w/2} y={-h/2} width={w} height={h} fill="none" stroke="currentColor" strokeWidth="2" />
            <text x="0" y="0" textAnchor="middle" alignmentBaseline="middle" fontSize="30" fill="currentColor">1m</text>
        </g>
    )},

    // Appliances
    { id: 'washing_machine', category: 'hvac', label: 'Washing Machine', width: 600, height: 600, render: (w, h) => (
        <g>
            <rect x={-w/2} y={-h/2} width={w} height={h} rx="10" fill="none" stroke="currentColor" />
            <circle cx="0" cy="0" r={h/3} fill="none" stroke="currentColor" />
        </g>
    )},
    { id: 'dishwasher', category: 'hvac', label: 'Dishwasher', width: 600, height: 600, render: (w, h) => (
        <g>
            <rect x={-w/2} y={-h/2} width={w} height={h} rx="10" fill="none" stroke="currentColor" />
            <path d={`M ${-w/2 + 50} ${-h/2+50} L ${w/2 - 50} ${-h/2+50}`} stroke="currentColor" strokeDasharray="5,5" />
        </g>
    )}
];

// --- Wall Geometry & Miter Logic ---

const getQuadBezierPoint = (p0: Point, p1: Point, p2: Point, t: number): Point => {
    const mt = 1 - t;
    return {
        x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
        y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
    };
};

const getSubBezier = (p0: Point, p1: Point, p2: Point, tStart: number, tEnd: number) => {
    const start = getQuadBezierPoint(p0, p1, p2, tStart);
    const end = getQuadBezierPoint(p0, p1, p2, tEnd);
    const tan1 = sub(getQuadBezierPoint(p0, p1, p2, tStart + 0.001), start);
    const tan2 = sub(end, getQuadBezierPoint(p0, p1, p2, tEnd - 0.001));
    const intersection = intersectInfiniteLines(
        start, add(start, scale(tan1, 100)),
        end, add(end, scale(tan2, 100))
    );
    return { start, control: intersection || scale(add(start, end), 0.5), end };
};

// Robust Miter Calculation using Radial Sorting
const getCornerPoints = (p: Point, currentId: string, allWalls: Wall[]): { left: Point, right: Point } => {
    // 1. Find all walls connected at point p
    const connected = allWalls.filter(w => dist(w.start, p) < 0.1 || dist(w.end, p) < 0.1);
    
    // Fallback if isolated
    const currentWall = allWalls.find(w => w.id === currentId);
    if (!currentWall || connected.length <= 1) {
        if (!currentWall) return { left: p, right: p };
        const otherEnd = dist(currentWall.start, p) < 0.1 ? currentWall.end : currentWall.start;
        const v = norm(sub(otherEnd, p));
        const n = { x: -v.y, y: v.x };
        const half = currentWall.thickness / 2;
        return { left: add(p, scale(n, half)), right: sub(p, scale(n, half)) };
    }

    // 2. Map walls to angular vectors leaving p
    const radialWalls = connected.map(w => {
        const otherEnd = dist(w.start, p) < 0.1 ? w.end : w.start;
        const v = norm(sub(otherEnd, p));
        // Angle in standard cartesian (0 is Right, 90 is Down in SVG y-down)
        const angle = Math.atan2(v.y, v.x); 
        return { id: w.id, v, angle, thickness: w.thickness };
    });

    // 3. Sort radially
    radialWalls.sort((a, b) => a.angle - b.angle);

    // 4. Find neighbors in sorted list
    const idx = radialWalls.findIndex(rw => rw.id === currentId);
    const cw = radialWalls[idx]; // Current Wall
    const nextW = radialWalls[(idx + 1) % radialWalls.length]; // Next Wall (CCW if y-down? Let's verify)
    const prevW = radialWalls[(idx - 1 + radialWalls.length) % radialWalls.length]; // Prev Wall

    // 5. Calculate intersection of offset lines
    // Normal n is rotated -90 deg from v (Left hand side relative to v)
    // Offset Line Left: p + n * (thickness/2) + t * v
    // Offset Line Right: p - n * (thickness/2) + t * v
    
    const getOffsetLine = (rw: typeof cw, side: 'left' | 'right') => {
        const n = { x: -rw.v.y, y: rw.v.x }; // Normal
        const sign = side === 'left' ? 1 : -1;
        const origin = add(p, scale(n, sign * rw.thickness / 2));
        const p2 = add(origin, rw.v);
        return { p1: origin, p2 };
    };

    // Current Left should meet Next Right (due to cyclic order)
    const lineL = getOffsetLine(cw, 'left');
    const lineNextR = getOffsetLine(nextW, 'right');
    let leftIntersection = intersectInfiniteLines(lineL.p1, lineL.p2, lineNextR.p1, lineNextR.p2);

    // Current Right should meet Prev Left
    const lineR = getOffsetLine(cw, 'right');
    const linePrevL = getOffsetLine(prevW, 'left');
    let rightIntersection = intersectInfiniteLines(lineR.p1, lineR.p2, linePrevL.p1, linePrevL.p2);

    // Safety caps for near-parallel lines
    const MAX_MITER_LEN = Math.max(cw.thickness, nextW.thickness, prevW.thickness) * 3;
    
    // Fallback if parallel (180 deg join)
    if (!leftIntersection || dist(p, leftIntersection) > MAX_MITER_LEN) {
        // Use bisector or fallback
        const n = { x: -cw.v.y, y: cw.v.x };
        leftIntersection = add(p, scale(n, cw.thickness/2));
    }
    if (!rightIntersection || dist(p, rightIntersection) > MAX_MITER_LEN) {
        const n = { x: -cw.v.y, y: cw.v.x };
        rightIntersection = sub(p, scale(n, cw.thickness/2));
    }

    return { left: leftIntersection, right: rightIntersection };
};

export const computeWallCorners = (wall: Wall, allWalls: Wall[]): Point[] => {
    if (wall.curvature && Math.abs(wall.curvature) > 0.1) return []; 

    const startCorners = getCornerPoints(wall.start, wall.id, allWalls);
    const endCorners = getCornerPoints(wall.end, wall.id, allWalls);

    // Topology: StartLeft -> EndLeft -> EndRight -> StartRight
    return [
        startCorners.left,
        endCorners.right,
        endCorners.left,
        startCorners.right
    ];
};

export const getWallPath = (w: Wall, openings: Opening[] = []) => {
    if (w.curvature && Math.abs(w.curvature) > 0.1) {
        const trueMid = { x: (w.start.x + w.end.x)/2, y: (w.start.y + w.end.y)/2 };
        const dir = norm(sub(w.end, w.start));
        const normal = { x: -dir.y, y: dir.x };
        const control = add(trueMid, scale(normal, w.curvature * 2));
        return `M ${w.start.x} ${w.start.y} Q ${control.x} ${control.y} ${w.end.x} ${w.end.y}`;
    }
    return `M ${w.start.x} ${w.start.y} L ${w.end.x} ${w.end.y}`;
};

export const getWallOutlinePath = (w: Wall, allWalls: Wall[]): string => {
    if (w.curvature && Math.abs(w.curvature) > 0.1) return getWallPath(w); 
    const corners = computeWallCorners(w, allWalls);
    if (corners.length !== 4) return getWallPath(w);
    return `M ${corners[0].x} ${corners[0].y} L ${corners[1].x} ${corners[1].y} L ${corners[2].x} ${corners[2].y} L ${corners[3].x} ${corners[3].y} Z`;
};

const getWallIntervals = (w: Wall, openings: Opening[]) => {
    const wallLen = dist(w.start, w.end);
    if (wallLen < 0.1) return [{start: 0, end: 1}];

    let intervals: {start: number, end: number}[] = openings.map(op => {
        const widthUnits = op.width / 10;
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
        if (gap.start > currentT) solidIntervals.push({ start: currentT, end: gap.start });
        currentT = Math.max(currentT, gap.end);
    });

    if (currentT < 1) solidIntervals.push({ start: currentT, end: 1 });

    return solidIntervals;
};

const getWallHatch = (thickness: number) => {
    if (thickness <= 10) return "url(#hatch_drywall)"; 
    return "url(#hatch_brick)"; 
};

interface WallEntityProps { 
    wall: Wall; 
    openings?: Opening[]; 
    selected: boolean; 
    allWalls?: Wall[];
    layer?: 'fill' | 'hatch' | 'stroke' | 'all';
    onMouseDown?: (e: React.MouseEvent) => void; 
}

export const WallEntity: React.FC<WallEntityProps> = ({ wall, openings = [], selected, allWalls = [], layer = 'all', onMouseDown }) => {
    const isCurved = wall.curvature && Math.abs(wall.curvature) > 0.1;
    const solidIntervals = getWallIntervals(wall, openings);
    const hatchUrl = getWallHatch(wall.thickness);

    const showFill = layer === 'all' || layer === 'fill';
    const showHatch = layer === 'all' || layer === 'hatch';
    const showStroke = layer === 'all' || layer === 'stroke';

    // Distinction for Exterior (>200mm/20 units) vs Interior walls
    const isExterior = wall.thickness >= 20;
    
    // Fill Colors
    const fillClass = isExterior ? "fill-slate-400 dark:fill-slate-600" : "fill-slate-200 dark:fill-slate-800";
    // Stroke color for curved walls (which use stroke for body)
    const curveStrokeClass = isExterior ? "stroke-slate-400 dark:stroke-slate-600" : "stroke-slate-200 dark:stroke-slate-800";

    // --- CURVED WALL RENDERING ---
    if (isCurved) {
        const trueMid = { x: (wall.start.x + wall.end.x)/2, y: (wall.start.y + wall.end.y)/2 };
        const dir = norm(sub(wall.end, wall.start));
        const normal = { x: -dir.y, y: dir.x };
        const curv = wall.curvature || 0;
        const control = add(trueMid, scale(normal, curv * 2)); 

        return (
            <g onMouseDown={onMouseDown} className="wall-entity">
                {/* Hit Area */}
                {layer === 'all' && <path d={getWallPath(wall)} stroke="transparent" strokeWidth={wall.thickness + 20} fill="none" />}
                
                {solidIntervals.map((interval, i) => {
                    if (Math.abs(interval.end - interval.start) < 0.001) return null;
                    const subC = getSubBezier(wall.start, control, wall.end, interval.start, interval.end);
                    const d = `M ${subC.start.x} ${subC.start.y} Q ${subC.control.x} ${subC.control.y} ${subC.end.x} ${subC.end.y}`;
                    return (
                        <g key={i}>
                            {showFill && <path d={d} className={curveStrokeClass} strokeWidth={Math.max(0.1, wall.thickness - 2)} fill="none" strokeLinecap="butt" />}
                            {showHatch && <path d={d} stroke={hatchUrl} strokeWidth={Math.max(0.1, wall.thickness - 2)} fill="none" strokeLinecap="butt" opacity="0.5" />}
                            {showStroke && (
                                <>
                                    <path d={d} stroke="black" className={selected ? 'stroke-blue-500' : 'stroke-black dark:stroke-slate-200'} strokeWidth={selected ? 2 : 1} fill="none" strokeLinecap="butt" mask="url(#wall-cleaner)" vectorEffect="non-scaling-stroke" />
                                    {selected && <path d={d} stroke="#3b82f6" strokeWidth={wall.thickness} opacity="0.3" fill="none" />}
                                </>
                            )}
                        </g>
                    );
                })}
            </g>
        );
    }

    // --- STRAIGHT WALL RENDERING ---
    const corners = computeWallCorners(wall, allWalls);
    if (corners.length !== 4) return null;
    
    const p1 = corners[0]; // Start Left
    const p2 = corners[1]; // End Right
    const p3 = corners[2]; // End Left
    const p4 = corners[3]; // Start Right
    
    const vecLeft = sub(p2, p1);
    const vecRight = sub(p3, p4);

    return (
        <g onMouseDown={onMouseDown} className="wall-entity">
             {layer === 'all' && <path d={getWallPath(wall, openings)} stroke="transparent" strokeWidth={wall.thickness + 20} fill="none" />}

            {solidIntervals.map((interval, i) => {
                const subP1 = add(p1, scale(vecLeft, interval.start));
                const subP2 = add(p1, scale(vecLeft, interval.end));
                const subP4 = add(p4, scale(vecRight, interval.start));
                const subP3 = add(p4, scale(vecRight, interval.end));

                const polyPath = `M ${subP1.x} ${subP1.y} L ${subP2.x} ${subP2.y} L ${subP3.x} ${subP3.y} L ${subP4.x} ${subP4.y} Z`;

                return (
                    <g key={i}>
                        {showFill && <path d={polyPath} className={fillClass} stroke="none" shapeRendering="crispEdges" />}
                        {showHatch && <path d={polyPath} fill={hatchUrl} stroke="none" opacity="0.5" />}
                        {selected && showHatch && <path d={polyPath} fill="#3b82f6" opacity="0.2" stroke="none" />}
                        {showStroke && (
                            <path 
                                d={polyPath} 
                                fill="none" 
                                stroke={selected ? "#3b82f6" : "black"} 
                                className={selected ? '' : 'dark:stroke-slate-200'}
                                strokeWidth="1" 
                                mask="url(#wall-cleaner)"
                                vectorEffect="non-scaling-stroke"
                            />
                        )}
                    </g>
                );
            })}
            
            {selected && !wall.locked && layer === 'stroke' && (
                <>
                    <ResizeHandle x={wall.start.x} y={wall.start.y} />
                    <ResizeHandle x={wall.end.x} y={wall.end.y} />
                </>
            )}
        </g>
    );
};

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
                </g>
            )}
            
            {showLabel && (
                <text 
                    x={0} 
                    y={0} 
                    dy="0.3em" 
                    textAnchor="middle" 
                    className="text-[10px] fill-slate-900 dark:fill-slate-100 font-bold pointer-events-none" 
                    transform={`rotate(${-angle})`}
                    style={{ textShadow: '0px 0px 3px rgba(255,255,255,0.7), 0px 0px 3px rgba(0,0,0,0.3)' }}
                >
                    {op.label}
                </text>
            )}

            {selected && !op.locked && (
                <g>
                    <ResizeHandle x={-op.width/20} y={0} cursor="cursor-ew-resize" />
                    <ResizeHandle x={op.width/20} y={0} cursor="cursor-ew-resize" />
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

    // Perpendicular ticks logic (straight ticks)
    const tickSize = 3;
    const tickVec = { x: normal.x * tickSize, y: normal.y * tickSize };

    return (
        <g className="cursor-pointer group">
            {/* Hit Area */}
            <line x1={pStart.x} y1={pStart.y} x2={pEnd.x} y2={pEnd.y} stroke="transparent" strokeWidth="10" />
            
            {/* Extension Lines */}
            <line x1={dim.start.x} y1={dim.start.y} x2={pStart.x} y2={pStart.y} className="stroke-slate-300 dark:stroke-slate-600" strokeDasharray="2,2" strokeWidth="0.5" />
            <line x1={dim.end.x} y1={dim.end.y} x2={pEnd.x} y2={pEnd.y} className="stroke-slate-300 dark:stroke-slate-600" strokeDasharray="2,2" strokeWidth="0.5" />
            
            {/* Dimension Line */}
            <line x1={pStart.x} y1={pStart.y} x2={pEnd.x} y2={pEnd.y} className={`${selected ? 'stroke-blue-500' : 'stroke-slate-500 dark:stroke-slate-400'}`} strokeWidth="1" />
            
            {/* Straight Ticks */}
            <line x1={pStart.x - tickVec.x} y1={pStart.y - tickVec.y} x2={pStart.x + tickVec.x} y2={pStart.y + tickVec.y} className={`${selected ? 'stroke-blue-500' : 'stroke-slate-500 dark:stroke-slate-400'}`} strokeWidth="1.5" />
            <line x1={pEnd.x - tickVec.x} y1={pEnd.y - tickVec.y} x2={pEnd.x + tickVec.x} y2={pEnd.y + tickVec.y} className={`${selected ? 'stroke-blue-500' : 'stroke-slate-500 dark:stroke-slate-400'}`} strokeWidth="1.5" />

            <g transform={`translate(${ (pStart.x + pEnd.x)/2 }, ${ (pStart.y + pEnd.y)/2 })`}>
                <rect x="-14" y="-7" width="28" height="14" rx="2" fill="white" className="dark:fill-slate-900" opacity="0.8" />
                <text textAnchor="middle" alignmentBaseline="middle" className={`text-[10px] font-mono select-none ${selected ? 'fill-blue-500' : 'fill-slate-600 dark:fill-slate-300'}`}>{Math.round(d * 10)}</text>
            </g>
        </g>
    )
};

interface LabelEntityProps { label: RoomLabel; selected: boolean; }
export const LabelEntity: React.FC<LabelEntityProps> = ({ label, selected }) => {
    // Dynamic scaling based on area to prevent overlap on small rooms
    // Base size approx 10px-14px for typical rooms, scaled down for small areas
    // Clamp between 6px (tiny) and 16px (large)
    const area = label.area || 0;
    const baseSize = area > 0 ? Math.max(6, Math.min(16, Math.sqrt(area) * 2)) : 10;

    return (
        <g transform={`translate(${label.position.x}, ${label.position.y})`} className="cursor-move">
            <text textAnchor="middle" style={{ fontSize: `${baseSize}px` }} className={`font-bold select-none ${selected ? 'fill-blue-500' : 'fill-slate-800 dark:fill-slate-200'}`}>{label.text}</text>
            {label.area && <text y={baseSize + 2} textAnchor="middle" style={{ fontSize: `${baseSize * 0.7}px` }} className="fill-slate-500 dark:fill-slate-400">{label.area.toFixed(1)} m²</text>}
            {label.locked && <circle r="2" cx={baseSize} cy={-baseSize/2} fill="red" opacity="0.5" />}
        </g>
    );
};

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
    // Use instance width/height if available, else fall back to catalog defaults scaled
    const w = symbol.width !== undefined ? symbol.width / 10 : (def.width / 10) * symbol.scale;
    const h = symbol.height !== undefined ? symbol.height / 10 : (def.height / 10) * symbol.scale;
    return (
        <g transform={`translate(${symbol.position.x}, ${symbol.position.y}) rotate(${symbol.rotation})`} className={`cursor-move transition-colors ${selected ? 'text-blue-500' : 'text-slate-700 dark:text-slate-300'}`}>
             {def.render(w, h)}
             {symbol.locked && <circle r="5" fill="red" opacity="0.5" />}
             {selected && !symbol.locked && (
                 <g>
                     <ResizeHandle x={-w/2} y={-h/2} cursor="cursor-nw-resize" />
                     <ResizeHandle x={w/2} y={-h/2} cursor="cursor-ne-resize" />
                     <ResizeHandle x={-w/2} y={h/2} cursor="cursor-sw-resize" />
                     <ResizeHandle x={w/2} y={h/2} cursor="cursor-se-resize" />
                 </g>
             )}
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
    // Increased offsets to avoid intersections
    const tier1Offset = baseOffset + 120; 
    const tier2Offset = baseOffset + 200;

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
        const tickSize = 3; // Straight/Perpendicular tick size
        const tickVec = { x: normal.x * tickSize, y: normal.y * tickSize };

        let rotation = Math.atan2(dir.y, dir.x) * 180 / Math.PI;
        if (rotation > 90 || rotation <= -90) rotation += 180;

        return (
            <g>
                <line x1={pStart.x} y1={pStart.y} x2={pEnd.x} y2={pEnd.y} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="0.5" />
                {/* Start Tick (Straight) */}
                <line x1={pStart.x - tickVec.x} y1={pStart.y - tickVec.y} x2={pStart.x + tickVec.x} y2={pStart.y + tickVec.y} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1"/>
                {/* End Tick (Straight) */}
                <line x1={pEnd.x - tickVec.x} y1={pEnd.y - tickVec.y} x2={pEnd.x + tickVec.x} y2={pEnd.y + tickVec.y} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1"/>

                {!isOverall && sortedOpenings.map((op, i) => {
                     const opWidthUnits = op.width / 10;
                     const center = add(wall.start, scale(sub(wall.end, wall.start), op.t));
                     const opStart = add(center, scale(dir, -opWidthUnits/2));
                     const opEnd = add(center, scale(dir, opWidthUnits/2));
                     const pOpStart = add(opStart, scale(normal, offset));
                     const pOpEnd = add(opEnd, scale(normal, offset));
                     
                     // Accurate edge-to-edge: Start extension lines from wall face
                     const extStart = add(opStart, scale(normal, wall.thickness/2)); 
                     const extEnd = add(opEnd, scale(normal, wall.thickness/2)); 
                     
                     return (
                         <g key={i}>
                             <line x1={extStart.x} y1={extStart.y} x2={pOpStart.x} y2={pOpStart.y} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="0.5" />
                             <line x1={extEnd.x} y1={extEnd.y} x2={pOpEnd.x} y2={pOpEnd.y} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="0.5" />
                             {/* Ticks (Straight) */}
                             <line x1={pOpStart.x - tickVec.x} y1={pOpStart.y - tickVec.y} x2={pOpStart.x + tickVec.x} y2={pOpStart.y + tickVec.y} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1"/>
                             <line x1={pOpEnd.x - tickVec.x} y1={pOpEnd.y - tickVec.y} x2={pOpEnd.x + tickVec.x} y2={pOpEnd.y + tickVec.y} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1"/>
                         </g>
                     )
                })}

                {segments.map((seg, idx) => {
                    const pos = add(wall.start, scale(sub(wall.end, wall.start), seg.t));
                    // Place text on the line (center)
                    const textPos = add(pos, scale(normal, offset)); 
                    return (
                        <g key={idx} transform={`translate(${textPos.x}, ${textPos.y}) rotate(${rotation})`}>
                            <rect x="-10" y="-4" width="20" height="8" fill="white" className="dark:fill-slate-900" opacity="0.8" />
                            <text x="0" y="0" textAnchor="middle" alignmentBaseline="middle" fontSize="8" className="fill-slate-600 dark:fill-slate-400 font-mono font-semibold">{Math.round(seg.val)}</text>
                        </g>
                    )
                })}
            </g>
        );
    };

    return (
        <g pointerEvents="none">
             {sortedOpenings.length > 0 ? (
                 <>
                    {renderDimLine(tier1Offset, points)}
                    {renderDimLine(tier2Offset, [{t: 0.5, val: wallLen * 10}], true)}
                 </>
             ) : (
                 renderDimLine(tier1Offset, [{t: 0.5, val: wallLen * 10}], true)
             )}
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