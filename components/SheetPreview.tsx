
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { PlanData } from '../types';
import { WallEntity, OpeningEntity, StairEntity, LabelEntity, SymbolEntity, DimensionEntity, AutoDimensionEntity, generateLegendData, getWallPath } from './CanvasEntities';
import { ZoomIn, ZoomOut, RotateCcw, Compass } from 'lucide-react';

interface SheetPreviewProps {
  data: PlanData;
  onUpdate: (data: PlanData) => void;
}

// A1 Dimensions in mm (Landscape)
const SHEET_WIDTH_MM = 841;
const SHEET_HEIGHT_MM = 594;
// Canvas Units (10 units = 1mm)
const SCALE_FACTOR = 10; 
const SHEET_WIDTH = SHEET_WIDTH_MM * SCALE_FACTOR;
const SHEET_HEIGHT = SHEET_HEIGHT_MM * SCALE_FACTOR;

// Updated layout constants
const TITLE_BLOCK_WIDTH = 130 * SCALE_FACTOR; // Widened for better legibility
const LEGEND_WIDTH = 160 * SCALE_FACTOR; // Reserved width for Legend
const MARGIN = 15 * SCALE_FACTOR; // Increased margin
const BLOCK_GAP = 5 * SCALE_FACTOR;

export const SheetPreview: React.FC<SheetPreviewProps> = ({ data, onUpdate }) => {
    // State for interactive view
    const [zoom, setZoom] = useState(0.5); 
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPoint, setLastPanPoint] = useState<{x: number, y: number} | null>(null);
    const [viewRotation, setViewRotation] = useState(0); // Rotation of the plan within the sheet
    
    const containerRef = useRef<HTMLDivElement>(null);
    
    const zoomRef = useRef(zoom);
    const panRef = useRef(pan);
    useEffect(() => { zoomRef.current = zoom; panRef.current = pan; }, [zoom, pan]);

    // Generate Legend Data
    const legendData = useMemo(() => generateLegendData(data), [data]);

    // Calculate Internal Layout
    const layout = useMemo(() => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        if (data.walls.length === 0) {
            minX = 0; minY = 0; maxX = 1000; maxY = 1000;
        } else {
            data.walls.forEach(w => {
                minX = Math.min(minX, w.start.x, w.end.x);
                minY = Math.min(minY, w.start.y, w.end.y);
                maxX = Math.max(maxX, w.start.x, w.end.x);
                maxY = Math.max(maxY, w.start.y, w.end.y);
            });
            // Note: We ignore North Arrow model position for bounding box now as it's fixed on sheet
            
            // Add padding around model
            minX -= 100; minY -= 100; maxX += 100; maxY += 100;
        }

        const planWidth = maxX - minX;
        const planHeight = maxY - minY;

        // Space available for drawing (Everything left of Title Block AND Legend)
        // General Notes now overlays bottom left, so we don't subtract it from width
        const drawAreaW = SHEET_WIDTH - TITLE_BLOCK_WIDTH - LEGEND_WIDTH - (MARGIN * 4);
        const drawAreaH = SHEET_HEIGHT - (MARGIN * 2);

        // Adjust for rotation (swap width/height if 90/270 degrees)
        const isRotated = Math.abs(viewRotation % 180) === 90;
        const effectivePlanW = isRotated ? planHeight : planWidth;
        const effectivePlanH = isRotated ? planWidth : planHeight;

        const scaleX = drawAreaW / effectivePlanW;
        const scaleY = drawAreaH / effectivePlanH;
        
        let fitScale = Math.min(scaleX, scaleY) * 0.9; 
        
        const planCenterX = (minX + maxX) / 2;
        const planCenterY = (minY + maxY) / 2;
        
        // Center in the drawing area
        const drawAreaCenterX = MARGIN + (drawAreaW / 2);
        const drawAreaCenterY = SHEET_HEIGHT / 2;

        return {
            scale: fitScale,
            // Translate to center, then apply rotation around that center
            translateX: drawAreaCenterX,
            translateY: drawAreaCenterY,
            planCenterX,
            planCenterY,
            planCenter: { x: planCenterX, y: planCenterY }
        };
    }, [data, viewRotation]);

    // Initial Fit Calculation
    useEffect(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const pxPerMm = 3.7795;
            const paperW_px = SHEET_WIDTH_MM * pxPerMm;
            const paperH_px = SHEET_HEIGHT_MM * pxPerMm;

            const scaleX = (rect.width - 64) / paperW_px; 
            const scaleY = (rect.height - 64) / paperH_px;
            const fitScale = Math.min(scaleX, scaleY) * 0.9; 
            
            setZoom(fitScale);
            const startX = (rect.width - paperW_px * fitScale) / 2;
            const startY = (rect.height - paperH_px * fitScale) / 2;
            setPan({ x: startX, y: startY });
        }
    }, []);

    const handleZoomBtn = (factor: number) => {
        if (!containerRef.current) return;
        const newZoom = Math.max(0.05, Math.min(5, zoom * factor));
        // Simple center zoom for buttons
        setZoom(newZoom);
    };

    const handleReset = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const pxPerMm = 3.7795;
        const paperW_px = SHEET_WIDTH_MM * pxPerMm;
        const paperH_px = SHEET_HEIGHT_MM * pxPerMm;
        const scale = Math.min((rect.width - 64) / paperW_px, (rect.height - 64) / paperH_px) * 0.9;
        setZoom(scale);
        setPan({ x: (rect.width - paperW_px * scale) / 2, y: (rect.height - paperH_px * scale) / 2 });
        setViewRotation(0);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsPanning(true);
        setLastPanPoint({ x: e.clientX, y: e.clientY });
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning || !lastPanPoint) return;
        const dx = e.clientX - lastPanPoint.x;
        const dy = e.clientY - lastPanPoint.y;
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setLastPanPoint({ x: e.clientX, y: e.clientY });
    };
    const handleMouseUp = () => { setIsPanning(false); setLastPanPoint(null); };

    // --- Helper for Title Block Sections ---
    const TitleBlockSection = ({ y, h, title, children }: any) => (
        <g transform={`translate(0, ${y})`}>
            <rect width={TITLE_BLOCK_WIDTH} height={h} fill="white" stroke="black" strokeWidth="3" />
            <rect width={TITLE_BLOCK_WIDTH} height="35" fill="black" stroke="black" strokeWidth="1" />
            <text x="15" y="24" fontSize="18" fontWeight="bold" fill="white" letterSpacing="2">{title}</text>
            <g transform="translate(15, 60)">{children}</g>
        </g>
    );

    // Calculate dynamic notes box height
    const notesLines = data.metadata.generalNotes ? data.metadata.generalNotes.split('\n') : [];
    const notesBoxHeight = Math.max(500, 150 + (notesLines.length * 60));

    return (
        <div 
            ref={containerRef}
            className="flex-1 bg-slate-200 dark:bg-slate-900 overflow-hidden relative cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div className="absolute top-4 right-4 z-10 bg-white dark:bg-slate-800 p-2 rounded shadow flex gap-2 select-none">
                <div className="text-xs text-slate-500 dark:text-slate-400 p-2">A1 Sheet Preview</div>
            </div>
            <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-50">
                <button onClick={() => setViewRotation(r => (r + 90) % 360)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl hover:bg-slate-50" title="Rotate View"><Compass size={20} /></button>
                <button onClick={() => handleZoomBtn(1.2)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl hover:bg-slate-50"><ZoomIn size={20} /></button>
                <button onClick={() => handleZoomBtn(0.8)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl hover:bg-slate-50"><ZoomOut size={20} /></button>
                <button onClick={handleReset} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl hover:bg-slate-50"><RotateCcw size={20} /></button>
            </div>

            <div className="bg-white shadow-2xl relative origin-top-left" style={{ width: '841mm', height: '594mm', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
                <svg width="100%" height="100%" viewBox={`0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}`} xmlns="http://www.w3.org/2000/svg" className="w-full h-full font-sans">
                    <defs>
                        <pattern id="hatch_brick" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="1" /></pattern>
                        <pattern id="hatch_drywall" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="4" y2="0" stroke="#cbd5e1" strokeWidth="1" />
                            <line x1="0" y1="0" x2="0" y2="4" stroke="#cbd5e1" strokeWidth="1" />
                        </pattern>
                        <marker id="arrow_preview" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#475569" /></marker>
                        <mask id="wall-cleaner"><rect x="-100000" y="-100000" width="200000" height="200000" fill="white" />{data.walls.map(w => (<path key={w.id} d={getWallPath(w)} stroke="black" strokeWidth={Math.max(0.1, w.thickness - 2)} fill="none" strokeLinecap="square" />))}</mask>
                    </defs>

                    {/* Paper & Border */}
                    <rect width="100%" height="100%" fill="white" />
                    <rect x={MARGIN} y={MARGIN} width={SHEET_WIDTH - MARGIN*2} height={SHEET_HEIGHT - MARGIN*2} fill="none" stroke="black" strokeWidth="5" />

                    {/* Drawing Heading (Top Left) */}
                    <text x={MARGIN + 50} y={MARGIN + 120} fontSize="120" fontWeight="900" fill="#0f172a" style={{textTransform: 'uppercase', fontFamily: 'Arial Black, sans-serif'}} letterSpacing="2">
                        {data.metadata.drawingHeading || "FLOOR PLAN"}
                    </text>

                    {/* Viewport */}
                    <g transform={`translate(${layout.translateX}, ${layout.translateY}) rotate(${viewRotation}) scale(${layout.scale}) translate(${-layout.planCenterX}, ${-layout.planCenterY})`}>
                         {/* LAYER 1: FILLS */}
                         {data.walls.map(wall => {
                            const openings = data.openings.filter(o => o.wallId === wall.id);
                            return (<g key={`fill-${wall.id}`}><WallEntity wall={wall} openings={openings} selected={false} layer="fill" allWalls={data.walls} /></g>);
                        })}
                        {/* LAYER 2: HATCHES */}
                        {data.walls.map(wall => {
                            const openings = data.openings.filter(o => o.wallId === wall.id);
                            return (<g key={`hatch-${wall.id}`}><WallEntity wall={wall} openings={openings} selected={false} layer="hatch" allWalls={data.walls} /></g>);
                        })}
                        {/* LAYER 3: STROKES */}
                        {data.walls.map(wall => {
                            const openings = data.openings.filter(o => o.wallId === wall.id);
                            return (<g key={`stroke-${wall.id}`}><WallEntity wall={wall} openings={openings} selected={false} layer="stroke" allWalls={data.walls} /><AutoDimensionEntity wall={wall} openings={openings} planCenter={layout.planCenter} /></g>);
                        })}

                        {data.openings.map(op => {
                             const wall = data.walls.find(w => w.id === op.wallId);
                             if (!wall) return null;
                             return <OpeningEntity key={op.id} op={op} wall={wall} selected={false} showLabel={true} />;
                        })}
                        {data.stairs.map(s => <StairEntity key={s.id} stair={s} selected={false} />)}
                        {data.symbols.map(s => <SymbolEntity key={s.id} symbol={s} selected={false} />)}
                        {data.labels.map(l => <LabelEntity key={l.id} label={l} selected={false} />)}
                        {data.dimensions.map(d => <DimensionEntity key={d.id} dim={d} selected={false} />)}
                    </g>

                    {/* Fixed North Arrow */}
                    {data.northArrow && (
                        <g transform={`translate(${SHEET_WIDTH - TITLE_BLOCK_WIDTH - LEGEND_WIDTH - MARGIN - 300}, ${SHEET_HEIGHT - MARGIN - 300}) scale(3.5)`}>
                             <g transform={`rotate(${data.northArrow.rotation + viewRotation})`}>
                                <circle r="30" fill="none" stroke="black" strokeWidth="2" />
                                <path d="M 0 -25 L 10 0 L 0 25 L -10 0 Z" fill="black" />
                                <text y="-35" textAnchor="middle" fontWeight="bold" fontSize="12" fill="black">N</text>
                             </g>
                        </g>
                    )}

                    {/* General Notes (Bottom Left Overlay) - Dynamic Size */}
                    {data.metadata.generalNotes && (
                        <g transform={`translate(${MARGIN + 30}, ${SHEET_HEIGHT - MARGIN - notesBoxHeight - 50})`}>
                            <rect width="2500" height={notesBoxHeight} fill="white" stroke="black" strokeWidth="4" />
                            <text x="40" y="60" fontSize="42" fontWeight="bold" fill="black" textDecoration="underline">GENERAL NOTES</text>
                            <g transform="translate(40, 130)">
                                {notesLines.map((line, i) => (
                                    <text key={i} y={i * 60} fontSize="32" fontWeight="medium" fill="#1e293b" style={{fontFamily: 'monospace'}}>
                                        {line.length > 85 ? line.substring(0, 85) + '...' : line}
                                    </text>
                                ))}
                            </g>
                        </g>
                    )}

                    {/* Object Legend (Top Right of Draw Area) */}
                    {legendData.length > 0 && (
                        <g transform={`translate(${SHEET_WIDTH - TITLE_BLOCK_WIDTH - MARGIN - LEGEND_WIDTH}, ${MARGIN})`}>
                            <rect width={LEGEND_WIDTH} height={100 + legendData.length * 80} fill="white" stroke="black" strokeWidth="3" />
                            <rect width={LEGEND_WIDTH} height="80" fill="black" />
                            <text x={LEGEND_WIDTH/2} y="55" textAnchor="middle" fill="white" fontSize="42" fontWeight="bold" letterSpacing="5">LEGEND</text>
                            
                            {legendData.map((item, i) => (
                                <g key={i} transform={`translate(0, ${100 + i * 80})`}>
                                    <line x1="0" y1="-20" x2={LEGEND_WIDTH} y2="-20" stroke="#cbd5e1" strokeWidth="2" />
                                    {/* Code */}
                                    <text x="40" y="30" fontSize="32" fontWeight="bold" fill="black">{item.code}</text>
                                    {/* Description */}
                                    <text x="300" y="30" fontSize="32" fill="#334155">{item.description}</text>
                                </g>
                            ))}
                        </g>
                    )}

                    {/* Title Block (Right Side) - Separated Blocks */}
                    <g transform={`translate(${SHEET_WIDTH - TITLE_BLOCK_WIDTH - MARGIN}, ${MARGIN})`}>
                        
                        {/* 1. Logo Block */}
                        <g transform="translate(0, 0)">
                             <rect width={TITLE_BLOCK_WIDTH} height="1200" fill="white" stroke="black" strokeWidth="3" />
                             {data.metadata.logo ? (
                                <image href={data.metadata.logo} x="50" y="50" width={TITLE_BLOCK_WIDTH - 100} height="500" preserveAspectRatio="xMidYMid meet" />
                             ) : (
                                <text x={TITLE_BLOCK_WIDTH/2} y="300" textAnchor="middle" fontSize="60" fill="#cbd5e1" fontWeight="bold">LOGO</text>
                             )}
                             <text x={TITLE_BLOCK_WIDTH/2} y="700" textAnchor="middle" fontSize="42" fontWeight="bold">ARCHITECT</text>
                             <text x={TITLE_BLOCK_WIDTH/2} y="760" textAnchor="middle" fontSize="32" fill="#64748b">Architecture Firm Inc.</text>
                             <text x={TITLE_BLOCK_WIDTH/2} y="810" textAnchor="middle" fontSize="32" fill="#64748b">JHB, South Africa</text>
                        </g>

                        {/* 2. Project Details */}
                        <TitleBlockSection y="1250" h="1200" title="PROJECT DETAILS">
                             <text y="0" fontSize="24" fill="#94a3b8" fontWeight="bold">PROJECT TITLE</text>
                             <text y="50" fontSize="48" fontWeight="bold">{data.metadata.title}</text>
                             
                             <text y="150" fontSize="24" fill="#94a3b8" fontWeight="bold">CLIENT</text>
                             <text y="200" fontSize="40" fontWeight="medium">{data.metadata.client}</text>
                             
                             <text y="300" fontSize="24" fill="#94a3b8" fontWeight="bold">SITE</text>
                             <text y="350" fontSize="32" fontWeight="medium">{data.metadata.address}</text>
                             <text y="400" fontSize="32" fontWeight="medium">{data.metadata.erfNumber}</text>
                        </TitleBlockSection>

                        {/* 3. Consultants */}
                        <TitleBlockSection y="2500" h="1000" title="CONSULTANTS">
                             {Object.entries(data.metadata.consultants).map(([role, name], i) => (
                                <g key={i} transform={`translate(0, ${i * 100})`}>
                                    <text fontSize="22" fontWeight="bold" fill="#000">{role}</text>
                                    <text y="35" fontSize="28" fill="#475569">{name}</text>
                                </g>
                             ))}
                        </TitleBlockSection>

                        {/* 4. Revisions */}
                        <TitleBlockSection y="3550" h="800" title="REVISIONS">
                             <text fontSize="32" fontWeight="bold">{data.metadata.revision}</text>
                             <text y="50" fontSize="24" fill="#64748b">{data.metadata.date}</text>
                        </TitleBlockSection>

                         {/* 5. Sheet Info (Bottom Block) - High Contrast */}
                         <g transform="translate(0, 4400)">
                             <rect width={TITLE_BLOCK_WIDTH} height={SHEET_HEIGHT - MARGIN*2 - 4400} fill="black" stroke="black" strokeWidth="3" />
                             <text x={TITLE_BLOCK_WIDTH/2} y="250" textAnchor="middle" fontSize="220" fontWeight="bold" fill="white">{data.metadata.sheetNumber}</text>
                             <text x={TITLE_BLOCK_WIDTH/2} y="400" textAnchor="middle" fontSize="48" fontWeight="bold" fill="#94a3b8" letterSpacing="5">SHEET NO</text>
                             
                             {/* Mini Grid inside black block */}
                             <line x1="50" y1="500" x2={TITLE_BLOCK_WIDTH - 50} y2="500" stroke="#333" strokeWidth="2" />
                             
                             <g transform="translate(50, 600)">
                                 <text fontSize="24" fill="#94a3b8" fontWeight="bold">DATE</text>
                                 <text y="40" fontSize="36" fill="white" fontWeight="bold">{data.metadata.date}</text>
                             </g>
                             <g transform="translate(700, 600)">
                                 <text fontSize="24" fill="#94a3b8" fontWeight="bold">SCALE</text>
                                 <text y="40" fontSize="36" fill="white" fontWeight="bold">{data.metadata.scale}</text>
                             </g>
                             <g transform="translate(50, 800)">
                                 <text fontSize="24" fill="#94a3b8" fontWeight="bold">DRAWN BY</text>
                                 <text y="40" fontSize="36" fill="white" fontWeight="bold">{data.metadata.drawnBy}</text>
                             </g>
                         </g>
                    </g>
                </svg>
            </div>
        </div>
    );
};
