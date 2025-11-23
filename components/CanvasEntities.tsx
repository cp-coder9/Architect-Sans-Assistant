
import React from 'react';
import { Wall, Opening, Stair, Dimension, RoomLabel, StairType, NorthArrow, SymbolInstance } from '../types';
import { dist, sub, add, scale, norm, len } from '../utils/geometry';

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
             {/* Chairs Schematic */}
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

    // Plumbing
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

    // HVAC / Kitchen
    { id: 'stove_4plate', category: 'hvac', label: '4-Plate Stove', width: 600, height: 600, render: (w, h) => (
        <g>
            <rect x={-300} y={-300} width={600} height={600} rx="10" fill="none" stroke="currentColor" />
            <circle cx={-150} cy={-150} r={100} fill="none" stroke="currentColor" />
            <circle cx={150} cy={-150} r={100} fill="none" stroke="currentColor" />
            <circle cx={-150} cy={150} r={100} fill="none" stroke="currentColor" />
            <circle cx={150} cy={150} r={100} fill="none" stroke="currentColor" />
        </g>
    )},
    { id: 'fridge', category: 'hvac', label: 'Fridge', width: 700, height: 700, render: (w, h) => (
        <g><rect x={-w/2} y={-h/2} width={w} height={h} fill="none" stroke="currentColor" /><text x="0" y="50" textAnchor="middle" fontSize="150" fontWeight="bold" fill="currentColor">REF</text></g>
    )},
    { id: 'sink_kitchen_double', category: 'plumbing', label: 'Double Sink', width: 1200, height: 500, render: (w, h) => (
        <g>
            <rect x={-600} y={-250} width={1200} height={500} rx="20" fill="none" stroke="currentColor" />
            <rect x={-550} y={-200} width={500} height={400} rx="20" fill="none" stroke="currentColor" />
            <rect x={50} y={-200} width={500} height={400} rx="20" fill="none" stroke="currentColor" />
            <circle cx={0} cy={-200} r={30} fill="currentColor" />
        </g>
    )},
    { id: 'gas_bottle', category: 'hvac', label: 'Gas Bottle', width: 380, height: 380, render: (w, h) => (
        <g><circle cx="0" cy="0" r={190} fill="none" stroke="currentColor" strokeDasharray="20,10" /><text x="0" y="20" textAnchor="middle" fontSize="100" fontWeight="bold" fill="currentColor">GAS</text></g>
    )}
];

// --- Canvas Entities ---

/**
 * Calculates the SVG path for a wall, correctly calculating segments 
 * to create physical gaps where openings exist using interval merging.
 */
export const getWallPath = (w: Wall, openings: Opening[] = []) => {
    const hasCurve = w.curvature && Math.abs(w.curvature) > 1;
    const wallLen = dist(w.start, w.end);
    
    // If curved or no openings or invalid length, simple path
    if (hasCurve || !openings.length || wallLen < 0.1) {
        if (!hasCurve) {
            return `M ${w.start.x} ${w.start.y} L ${w.end.x} ${w.end.y}`;
        } else {
            const mid = scale(add(w.start, w.end), 0.5);
            const dir = norm(sub(w.end, w.start));
            const normal = { x: -dir.y, y: dir.x };
            const trueMid = { x: (w.start.x + w.end.x)/2, y: (w.start.y + w.end.y)/2 };
            const curv = w.curvature || 0;
            const control = add(trueMid, scale(normal, curv * 2));
            return `M ${w.start.x} ${w.start.y} Q ${control.x} ${control.y} ${w.end.x} ${w.end.y}`;
        }
    }

    // Straight Wall with Openings: Robust Segment Calculation
    // 1. Convert openings to intervals [0..1]
    let intervals: {start: number, end: number}[] = openings.map(op => {
        // Fix: op.width is in mm, wallLen is in canvas units (1 unit = 10mm).
        // Convert width to units by dividing by 10.
        const halfWidthT = (op.width / 20) / wallLen; 
        return {
            start: Math.max(0, op.t - halfWidthT),
            end: Math.min(1, op.t + halfWidthT)
        };
    });

    // 2. Sort by start
    intervals.sort((a, b) => a.start - b.start);

    // 3. Merge intervals (combine overlapping windows)
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

    // 4. Generate Wall Segments (The gaps between merged intervals)
    let currentT = 0;
    let path = "";
    const vec = sub(w.end, w.start);

    merged.forEach(gap => {
        // Draw solid wall before the gap
        if (gap.start > currentT) {
             const p1 = add(w.start, scale(vec, currentT));
             const p2 = add(w.start, scale(vec, gap.start));
             path += `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} `;
        }
        currentT = Math.max(currentT, gap.end);
    });

    // Final segment after last gap
    if (currentT < 1) {
         const p1 = add(w.start, scale(vec, currentT));
         const p2 = w.end;
         path += `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} `;
    }

    return path;
};

interface WallEntityProps { wall: Wall; openings?: Opening[]; selected: boolean; onMouseDown?: (e: React.MouseEvent) => void; }
export const WallEntity: React.FC<WallEntityProps> = ({ wall, openings = [], selected, onMouseDown }) => {
    // We use a simplified path for the "hatch" fill to ensure it looks solid in the preview
    // But for the stroke, we use the segmented path to show gaps.
    const solidPath = getWallPath(wall, []); 
    const segmentedPath = getWallPath(wall, openings);

    return (
        <g onMouseDown={onMouseDown}>
            {/* Hit area (invisible thicker line) */}
            <path d={solidPath} stroke="transparent" strokeWidth={wall.thickness + 20} fill="none" />
            
            {/* Fill/Hatch - Only draw where wall exists */}
            {/* Note: Using segments for stroke is easy, but for fill (strokeWidth) we need to rely on strokeDash or multiple paths. 
                Here we use the segmented path for the main thick wall body. */}
            {selected && (
                <path d={segmentedPath} stroke="url(#wall_hatch)" strokeWidth={wall.thickness} strokeLinecap="butt" fill="none" className="pointer-events-none" />
            )}
            
            {/* Main Wall Body (White fill to cover grid if needed, or transparent with thick stroke) */}
            {/* In CAD, walls are usually thick lines. We use stroke. */}
            <path d={segmentedPath} stroke={selected ? "#3b82f6" : "currentColor"} strokeWidth={wall.thickness} strokeLinecap="butt" fill="none" className={`transition-colors duration-150 ${selected ? '' : 'text-slate-700 dark:text-slate-300'}`} />
            
            {/* Center Line (Thin) */}
            <path d={segmentedPath} stroke="currentColor" strokeWidth={1} strokeLinecap="butt" fill="none" className="text-slate-400 dark:text-slate-600" />
            
            {selected && wall.locked && (
                 <g transform={`translate(${(wall.start.x + wall.end.x)/2}, ${(wall.start.y + wall.end.y)/2})`}>
                    <circle r="8" fill="red" fillOpacity="0.2" />
                 </g>
            )}
        </g>
    );
};

interface OpeningEntityProps { op: Opening; wall: Wall; selected: boolean; showLabel: boolean; }
export const OpeningEntity: React.FC<OpeningEntityProps> = ({ op, wall, selected, showLabel }) => {
    const x = wall.start.x + op.t * (wall.end.x - wall.start.x);
    const y = wall.start.y + op.t * (wall.end.y - wall.start.y);
    const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x) * 180 / Math.PI;
    
    // Gap Logic is handled by WallEntity segmentation now. 
    // We just render the door/window geometry here.

    return (
        <g transform={`translate(${x},${y}) rotate(${angle})`} className="cursor-pointer">
            
            {op.type === 'door' ? (
                <g>
                    <g transform={`scale(${op.flipX ? -1 : 1}, ${op.flipY ? -1 : 1})`}>
                        {/* Render Door Leaf based on SubType */}
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
                             // Default Single
                            <path d={`M ${-op.width/20} ${-wall.thickness/2} L ${-op.width/20} ${-wall.thickness/2 - op.width/10} A ${op.width/10} ${op.width/10} 0 0 1 ${op.width/20} ${-wall.thickness/2}`} fill="none" stroke={selected ? "#2563eb" : "#ef4444"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        )}
                    </g>
                    
                    {op.subType !== 'sliding' && (
                         <line x1={-op.width/20} y1={0} x2={op.width/20} y2={0} stroke="#ef4444" strokeWidth="1" strokeDasharray="2,2" />
                    )}

                    {showLabel && (
                        <text y={-wall.thickness/2 - op.width/10 - 10} textAnchor="middle" className="text-[10px] fill-slate-600 dark:fill-slate-400 font-bold" transform={`rotate(${-angle})`}>{op.label}</text>
                    )}
                </g>
            ) : (
                <g>
                    {op.subType === 'fixed' ? (
                         <g>
                            <rect x={-op.width/20} y={-2} width={op.width/10} height={4} fill="none" stroke={selected ? "#60a5fa" : "#3b82f6"} strokeWidth="1" />
                            <line x1={-op.width/20} y1={0} x2={op.width/20} y2={0} stroke={selected ? "#60a5fa" : "#3b82f6"} strokeWidth="2" />
                         </g>
                    ) : op.subType === 'sliding' ? (
                         <g>
                            <line x1={-op.width/20} y1={-2} x2={0} y2={-2} stroke={selected ? "#60a5fa" : "#3b82f6"} strokeWidth="2" />
                            <line x1={0} y1={2} x2={op.width/20} y2={2} stroke={selected ? "#60a5fa" : "#3b82f6"} strokeWidth="2" />
                            <line x1={-5} y1={0} x2={5} y2={0} stroke={selected ? "#60a5fa" : "#3b82f6"} markerEnd="url(#arrow)" strokeWidth="0.5" />
                         </g>
                    ) : (
                        // Standard/Casement
                         <rect x={-op.width/20} y={-2} width={op.width/10} height={4} fill={selected ? "#60a5fa" : "#3b82f6"} opacity="0.5" />
                    )}

                    <line x1={-op.width/20} y1={-wall.thickness/2} x2={op.width/20} y2={-wall.thickness/2} className="stroke-slate-700 dark:stroke-slate-300" strokeWidth="1"/>
                    <line x1={-op.width/20} y1={wall.thickness/2} x2={op.width/20} y2={wall.thickness/2} className="stroke-slate-700 dark:stroke-slate-300" strokeWidth="1"/>
                    {showLabel && (
                        <text y={wall.thickness/2 + 20} textAnchor="middle" className="text-[10px] fill-slate-600 dark:fill-slate-400 font-bold" transform={`rotate(${-angle})`}>{op.label}</text>
                    )}
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
    
    if (stair.type === StairType.STRAIGHT) {
        const len = stair.count * treadLen;
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

    return (
        <g transform={`translate(${stair.position.x}, ${stair.position.y}) rotate(${stair.rotation})`} className="cursor-move">
            <path d={path} stroke={selected ? "#3b82f6" : "currentColor"} strokeWidth="1" fill="none" className="text-slate-800 dark:text-slate-200"/>
            <path d={arrowPath} stroke={selected ? "#3b82f6" : "currentColor"} strokeWidth="1" fill="none" markerEnd="url(#arrow)" className="text-slate-800 dark:text-slate-200"/>
            {stair.locked && <circle r="5" fill="red" opacity="0.5" />}
        </g>
    )
};

interface DimensionEntityProps { dim: Dimension; selected: boolean; }
export const DimensionEntity: React.FC<DimensionEntityProps> = ({ dim, selected }) => {
    const angle = Math.atan2(dim.end.y - dim.start.y, dim.end.x - dim.start.x);
    const length = Math.round(dist(dim.start, dim.end) * 10);
    const offsetX = -Math.sin(angle) * dim.offset;
    const offsetY = Math.cos(angle) * dim.offset;
    const p1 = { x: dim.start.x + offsetX, y: dim.start.y + offsetY };
    const p2 = { x: dim.end.x + offsetX, y: dim.end.y + offsetY };
    const textX = (p1.x + p2.x) / 2 + offsetX * 0.5;
    const textY = (p1.y + p2.y) / 2 + offsetY * 0.5;

    return (
        <g className={dim.locked ? "cursor-not-allowed" : "cursor-pointer"}>
            <line x1={dim.start.x} y1={dim.start.y} x2={p1.x} y2={p1.y} stroke="#94a3b8" strokeDasharray="2,2"/>
            <line x1={dim.end.x} y1={dim.end.y} x2={p2.x} y2={p2.y} stroke="#94a3b8" strokeDasharray="2,2"/>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={selected ? "#3b82f6" : "#64748b"} markerEnd="url(#arrow)" markerStart="url(#arrow)"/>
            <text x={textX} y={textY} className={`${selected ? "fill-blue-500" : "fill-slate-800 dark:fill-slate-200"}`} textAnchor="middle" fontSize="10">
                {length} mm {dim.locked ? "🔒" : ""}
            </text>
        </g>
    );
};

interface AutoDimensionEntityProps { wall: Wall; openings: Opening[]; }
export const AutoDimensionEntity: React.FC<AutoDimensionEntityProps> = ({ wall, openings }) => {
    const wallLen = dist(wall.start, wall.end);
    if (wallLen === 0) return null;
    
    const dir = norm(sub(wall.end, wall.start));
    const normal = { x: -dir.y, y: dir.x };
    const offsetDist = (wall.thickness / 2) + 60; 
    const tickSize = 5;

    const sortedOpenings = [...openings].sort((a, b) => a.t - b.t);
    
    // Calculate measurement points
    const points: { t: number, val: number, type: 'gap' | 'width' }[] = [];
    let prevT = 0;

    sortedOpenings.forEach(op => {
        const opWidthUnits = op.width / 10;
        const halfWidth = opWidthUnits / 2;
        const centerDist = op.t * wallLen;
        const startDist = centerDist - halfWidth;
        const startT = startDist / wallLen;
        const endDist = centerDist + halfWidth;
        const endT = endDist / wallLen;

        if (startT > prevT + 0.01) {
            points.push({ t: (prevT + startT)/2, val: (startDist - (prevT * wallLen)) * 10, type: 'gap' });
        }
        points.push({ t: op.t, val: op.width, type: 'width' });
        prevT = endT;
    });

    if (prevT < 0.99) {
         points.push({ t: (prevT + 1)/2, val: (wallLen - (prevT * wallLen)) * 10, type: 'gap' });
    }

    const pStart = add(wall.start, scale(normal, offsetDist));
    const pEnd = add(wall.end, scale(normal, offsetDist));

    let rotation = Math.atan2(dir.y, dir.x) * 180 / Math.PI;
    if (rotation > 90 || rotation < -90) rotation += 180;

    return (
        <g>
             {/* Main Line */}
            <line x1={pStart.x} y1={pStart.y} x2={pEnd.x} y2={pEnd.y} stroke="#64748b" strokeWidth="1" />
            {/* End Ticks */}
            <line x1={pStart.x - normal.x*tickSize} y1={pStart.y - normal.y*tickSize} x2={pStart.x + normal.x*tickSize} y2={pStart.y + normal.y*tickSize} stroke="#64748b" strokeWidth="1"/>
            <line x1={pEnd.x - normal.x*tickSize} y1={pEnd.y - normal.y*tickSize} x2={pEnd.x + normal.x*tickSize} y2={pEnd.y + normal.y*tickSize} stroke="#64748b" strokeWidth="1"/>
            
            {/* Opening Ticks & Text */}
            {sortedOpenings.map(op => {
                const opWidthUnits = op.width / 10;
                const center = add(wall.start, scale(sub(wall.end, wall.start), op.t));
                const opStart = add(center, scale(dir, -opWidthUnits/2));
                const opEnd = add(center, scale(dir, opWidthUnits/2));
                const pOpStart = add(opStart, scale(normal, offsetDist));
                const pOpEnd = add(opEnd, scale(normal, offsetDist));

                return (
                    <React.Fragment key={op.id}>
                        <line x1={pOpStart.x - normal.x*tickSize} y1={pOpStart.y - normal.y*tickSize} x2={pOpStart.x + normal.x*tickSize} y2={pOpStart.y + normal.y*tickSize} stroke="#64748b" strokeWidth="1"/>
                        <line x1={pOpEnd.x - normal.x*tickSize} y1={pOpEnd.y - normal.y*tickSize} x2={pOpEnd.x + normal.x*tickSize} y2={pOpEnd.y + normal.y*tickSize} stroke="#64748b" strokeWidth="1"/>
                    </React.Fragment>
                )
            })}

            {/* Text Labels */}
            {points.map((pt, i) => {
                 const pos = add(wall.start, scale(sub(wall.end, wall.start), pt.t));
                 const labelPos = add(pos, scale(normal, offsetDist + 15));
                 return (
                     <text key={i} x={labelPos.x} y={labelPos.y} textAnchor="middle" alignmentBaseline="middle" transform={`rotate(${rotation}, ${labelPos.x}, ${labelPos.y})`} fontSize="8" fill="#475569">
                         {Math.round(pt.val)}
                     </text>
                 )
            })}
        </g>
    );
}

interface LabelEntityProps { label: RoomLabel; selected: boolean; }
export const LabelEntity: React.FC<LabelEntityProps> = ({ label, selected }) => {
    return (
        <g className="cursor-pointer">
                <text x={label.position.x} y={label.position.y} textAnchor="middle" className={`text-[12px] font-bold ${selected ? "fill-blue-600" : "fill-slate-800 dark:fill-slate-200"}`}>
                    {label.text} {label.locked ? "🔒" : ""}
                </text>
                <text x={label.position.x} y={label.position.y + 15} textAnchor="middle" className="text-[10px] fill-slate-500 dark:fill-slate-400">
                    {label.area ? `${label.area.toFixed(1)} m²` : '-- m²'}
                </text>
        </g>
    );
};

interface NorthArrowEntityProps { arrow: NorthArrow; selected: boolean; }
export const NorthArrowEntity: React.FC<NorthArrowEntityProps> = ({ arrow, selected }) => {
    return (
        <g transform={`translate(${arrow.position.x}, ${arrow.position.y}) rotate(${arrow.rotation})`} className="cursor-move">
            <circle r="20" stroke="currentColor" strokeWidth="2" fill="none" className={selected ? "text-blue-500" : "text-slate-800 dark:text-slate-200"} />
            <path d="M 0 -18 L -6 0 L 0 -5 L 6 0 Z" fill="currentColor" className={selected ? "text-blue-500" : "text-slate-800 dark:text-slate-200"} />
            <text y="14" textAnchor="middle" fontSize="12" fontWeight="bold" className={selected ? "fill-blue-500" : "fill-slate-800 dark:text-slate-200"}>N</text>
            {selected && (
                <g>
                     {/* Rotation Handle */}
                    <line x1="0" y1="-20" x2="0" y2="-35" stroke="#3b82f6" strokeWidth="1" />
                    <circle cx="0" cy="-35" r="4" fill="#3b82f6" className="cursor-grab" />
                </g>
            )}
        </g>
    );
};

interface SymbolEntityProps { symbol: SymbolInstance; selected: boolean; }
export const SymbolEntity: React.FC<SymbolEntityProps> = ({ symbol, selected }) => {
    const def = SYMBOL_CATALOG.find(s => s.id === symbol.type);
    if (!def) return null;

    return (
        <g transform={`translate(${symbol.position.x}, ${symbol.position.y}) rotate(${symbol.rotation})`} className="cursor-move text-slate-800 dark:text-slate-200">
            <g style={{ pointerEvents: 'none' }}>
                {/* Scale down the vector art by 10x to match scene units (mm to canvas units approx) */}
                 <g transform={`scale(${symbol.scale * 0.1})`}>
                    {def.render(def.width, def.height)}
                 </g>
            </g>
            {/* Hit Area & Highlight */}
             <rect 
                x={-def.width * 0.1 * symbol.scale / 2} 
                y={-def.height * 0.1 * symbol.scale / 2} 
                width={def.width * 0.1 * symbol.scale} 
                height={def.height * 0.1 * symbol.scale} 
                fill="transparent" 
                stroke={selected ? "#3b82f6" : "none"} 
                strokeWidth="2" 
                rx="5"
            />
            {selected && (
                 <g>
                     {/* Rotation Handle */}
                     <line x1="0" y1={-def.height * 0.1 * symbol.scale / 2} x2="0" y2={-def.height * 0.1 * symbol.scale / 2 - 20} stroke="#3b82f6" strokeWidth="1" />
                     <circle cx="0" cy={-def.height * 0.1 * symbol.scale / 2 - 20} r="4" fill="#3b82f6" className="cursor-grab" />
                 </g>
            )}
            {selected && symbol.locked && <circle r="5" fill="red" opacity="0.5" />}
        </g>
    )
}
