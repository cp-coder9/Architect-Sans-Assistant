
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { PlanData } from '../types';
import { WallEntity, OpeningEntity, StairEntity, LabelEntity, SymbolEntity, DimensionEntity, NorthArrowEntity, AutoDimensionEntity, generateLegendData, getWallPath } from './CanvasEntities';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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

// Updated layout constants for new design
const TITLE_BLOCK_WIDTH = 120 * SCALE_FACTOR; // Widened for better readability
const GENERAL_NOTES_WIDTH = 180 * SCALE_FACTOR; // Widened and separated
const MARGIN = 10 * SCALE_FACTOR;

export const SheetPreview: React.FC<SheetPreviewProps> = ({ data, onUpdate }) => {
    // State for interactive view
    const [zoom, setZoom] = useState(0.5); // Initial zoom, overwritten on mount
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPoint, setLastPanPoint] = useState<{x: number, y: number} | null>(null);
    
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Refs for event listener closure
    const zoomRef = useRef(zoom);
    const panRef = useRef(pan);
    useEffect(() => { zoomRef.current = zoom; panRef.current = pan; }, [zoom, pan]);

    // Calculate Internal Layout (Drawing on Paper)
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
            // Include North Arrow in bounds so it is not cut off
            if (data.northArrow) {
                minX = Math.min(minX, data.northArrow.position.x - 50);
                maxX = Math.max(maxX, data.northArrow.position.x + 50);
                minY = Math.min(minY, data.northArrow.position.y - 50);
                maxY = Math.max(maxY, data.northArrow.position.y + 50);
            }
            
            // Add padding
            minX -= 100; minY -= 100; maxX += 100; maxY += 100;
        }

        const planWidth = maxX - minX;
        const planHeight = maxY - minY;

        // Space available for drawing (Left of Notes & Title Block)
        // General Notes are now a box, potentially part of right side or separate. 
        // Let's assume General Notes + Title Block are on the right.
        const sideBarsWidth = TITLE_BLOCK_WIDTH + (data.metadata.generalNotes ? 20 * SCALE_FACTOR : 0); // 20mm gap if notes exist
        const drawAreaW = SHEET_WIDTH - sideBarsWidth - (data.metadata.generalNotes ? GENERAL_NOTES_WIDTH : 0) - (MARGIN * 2);
        const drawAreaH = SHEET_HEIGHT - (MARGIN * 2);

        const scaleX = drawAreaW / planWidth;
        const scaleY = drawAreaH / planHeight;
        
        let fitScale = Math.min(scaleX, scaleY) * 0.9; 
        
        const planCenterX = (minX + maxX) / 2;
        const planCenterY = (minY + maxY) / 2;
        
        const drawAreaCenterX = MARGIN + (drawAreaW / 2);
        const drawAreaCenterY = SHEET_HEIGHT / 2;

        return {
            scale: fitScale,
            translateX: drawAreaCenterX - (planCenterX * fitScale),
            translateY: drawAreaCenterY - (planCenterY * fitScale),
            planCenter: { x: planCenterX, y: planCenterY }
        };
    }, [data]);

    const legendItems = useMemo(() => generateLegendData(data), [data.openings, data.symbols]);

    // Initial Fit Calculation (Fit paper to screen)
    useEffect(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // 1mm ~ 3.78px
            const pxPerMm = 3.7795;
            const paperW_px = SHEET_WIDTH_MM * pxPerMm;
            const paperH_px = SHEET_HEIGHT_MM * pxPerMm;

            const scaleX = (rect.width - 64) / paperW_px; 
            const scaleY = (rect.height - 64) / paperH_px;
            const fitScale = Math.min(scaleX, scaleY) * 0.9; // 90% fit
            
            setZoom(fitScale);
            // Center
            const startX = (rect.width - paperW_px * fitScale) / 2;
            const startY = (rect.height - paperH_px * fitScale) / 2;
            setPan({ x: startX, y: startY });
        }
    }, []);

    // Wheel Zoom Handler
    useEffect(() => {
        const node = containerRef.current;
        if (!node) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const currentZoom = zoomRef.current;
                const currentPan = panRef.current;
                
                const delta = -e.deltaY;
                const factor = delta > 0 ? 1.1 : 0.9;
                const newZoom = Math.max(0.05, Math.min(5, currentZoom * factor));
                
                const rect = node.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // Pivot zoom math
                const worldX = (mouseX - currentPan.x) / currentZoom;
                const worldY = (mouseY - currentPan.y) / currentZoom;
                
                const newPanX = mouseX - worldX * newZoom;
                const newPanY = mouseY - worldY * newZoom;
                
                setZoom(newZoom);
                setPan({ x: newPanX, y: newPanY });
            }
        };

        node.addEventListener('wheel', handleWheel, { passive: false });
        return () => node.removeEventListener('wheel', handleWheel);
    }, []);

    const handleZoomBtn = (factor: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const newZoom = Math.max(0.05, Math.min(5, zoom * factor));
        
        const worldX = (centerX - pan.x) / zoom;
        const worldY = (centerY - pan.y) / zoom;
        
        const newPanX = centerX - worldX * newZoom;
        const newPanY = centerY - worldY * newZoom;
        
        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
    };

    const handleReset = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const pxPerMm = 3.7795;
        const paperW_px = SHEET_WIDTH_MM * pxPerMm;
        const paperH_px = SHEET_HEIGHT_MM * pxPerMm;
        const scale = Math.min((rect.width - 64) / paperW_px, (rect.height - 64) / paperH_px) * 0.9;
        setZoom(scale);
        setPan({ 
            x: (rect.width - paperW_px * scale) / 2, 
            y: (rect.height - paperH_px * scale) / 2 
        });
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

    const handleMouseUp = () => {
        setIsPanning(false);
        setLastPanPoint(null);
    };

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
                <div className="text-xs text-slate-500 dark:text-slate-400 p-2">
                    A1 Sheet Preview
                </div>
            </div>

             {/* Zoom Controls */}
             <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-50">
                <button onClick={() => handleZoomBtn(1.2)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" title="Zoom In">
                    <ZoomIn size={20} />
                </button>
                <button onClick={() => handleZoomBtn(0.8)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" title="Zoom Out">
                    <ZoomOut size={20} />
                </button>
                <button onClick={handleReset} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" title="Fit to Screen">
                    <RotateCcw size={20} />
                </button>
            </div>

            {/* Paper Container */}
            <div 
                className="bg-white shadow-2xl relative origin-top-left"
                style={{ 
                    width: '841mm', 
                    height: '594mm',
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
                }}
            >
                <svg
                    id="sheet-preview-svg"
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}`}
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full font-sans"
                >
                    <defs>
                        <pattern id="hatch_preview" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="20" stroke="#94a3b8" strokeWidth="2" />
                        </pattern>
                        <marker id="arrow_preview" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L0,6 L9,3 z" fill="#475569" />
                        </marker>
                        <mask id="wall-cleaner">
                            <rect x="-100000" y="-100000" width="200000" height="200000" fill="white" />
                            {data.walls.map(w => (
                                <path 
                                    key={w.id} 
                                    d={getWallPath(w)} 
                                    stroke="black" 
                                    strokeWidth={Math.max(0.1, w.thickness - 2)} 
                                    fill="none" 
                                    strokeLinecap="square"
                                />
                            ))}
                        </mask>
                    </defs>

                    {/* Paper Background */}
                    <rect width="100%" height="100%" fill="white" />

                    {/* Border */}
                    <rect x={MARGIN} y={MARGIN} width={SHEET_WIDTH - MARGIN*2} height={SHEET_HEIGHT - MARGIN*2} fill="none" stroke="black" strokeWidth="4" />

                    {/* Drawing Viewport */}
                    <g transform={`translate(${layout.translateX}, ${layout.translateY}) scale(${layout.scale})`}>
                         {data.walls.map(wall => {
                            const openings = data.openings.filter(o => o.wallId === wall.id);
                            return (
                                <g key={wall.id}>
                                    <WallEntity wall={wall} openings={openings} selected={false} />
                                    <AutoDimensionEntity wall={wall} openings={openings} planCenter={layout.planCenter} />
                                </g>
                            );
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
                        
                        {/* North Arrow on Drawing */}
                        {data.northArrow && (
                            <NorthArrowEntity arrow={data.northArrow} selected={false} />
                        )}
                    </g>

                    {/* --- GENERAL NOTES BOX (Improved) --- */}
                    {data.metadata.generalNotes && (
                        <g transform={`translate(${SHEET_WIDTH - TITLE_BLOCK_WIDTH - GENERAL_NOTES_WIDTH - MARGIN - 50}, ${MARGIN})`}>
                             {/* Box Outline */}
                             <rect x="0" y="0" width={GENERAL_NOTES_WIDTH} height={SHEET_HEIGHT - MARGIN*2} fill="white" stroke="black" strokeWidth="2" />
                             
                             {/* Header Background */}
                             <rect x="0" y="0" width={GENERAL_NOTES_WIDTH} height="80" fill="#f1f5f9" stroke="none" />
                             <line x1="0" y1="80" x2={GENERAL_NOTES_WIDTH} y2="80" stroke="black" strokeWidth="2" />
                             
                             <text x={GENERAL_NOTES_WIDTH/2} y="55" fontSize="28" fontWeight="bold" textAnchor="middle" letterSpacing="1">GENERAL NOTES</text>
                             
                             <g transform="translate(20, 120)">
                                 {data.metadata.generalNotes.split('\n').map((line, i) => (
                                     <text key={i} y={i * 35} fontSize="20" fontWeight="normal" fill="#1e293b" width={GENERAL_NOTES_WIDTH - 40} style={{fontFamily: 'monospace'}}>
                                        {line}
                                     </text>
                                 ))}
                             </g>
                        </g>
                    )}

                    {/* --- TITLE BLOCK (Redesigned) --- */}
                    <g transform={`translate(${SHEET_WIDTH - TITLE_BLOCK_WIDTH - MARGIN}, ${MARGIN})`}>
                        {/* Outline */}
                        <rect width={TITLE_BLOCK_WIDTH} height={SHEET_HEIGHT - MARGIN*2} fill="white" stroke="black" strokeWidth="4" />

                        {/* 1. ARCHITECT / LOGO SECTION (Top) */}
                        <g transform="translate(0, 0)">
                            {/* Logo Area */}
                            <rect width={TITLE_BLOCK_WIDTH} height="350" fill="none" stroke="none" />
                            
                            {data.metadata.logo ? (
                                <image href={data.metadata.logo} x="10" y="20" width={TITLE_BLOCK_WIDTH - 20} height="200" preserveAspectRatio="xMidYMid meet" />
                            ) : (
                                <g transform="translate(60, 120)">
                                    <text textAnchor="middle" fontSize="60" fontWeight="bold" letterSpacing="5">LOGO</text>
                                    <rect x="-100" y="-80" width="200" height="160" fill="none" stroke="#ccc" strokeDasharray="10,5" strokeWidth="2"/>
                                </g>
                            )}

                            {/* Architect Details */}
                            <g transform="translate(20, 250)">
                                <text x="0" y="0" fontSize="24" fontWeight="bold" letterSpacing="1">ARCHITECT</text>
                                <text x="0" y="30" fontSize="18" fill="#1e293b">Architecture Firm Inc.</text>
                                <text x="0" y="55" fontSize="16" fill="#475569">123 Design Avenue</text>
                                <text x="0" y="75" fontSize="16" fill="#475569">Johannesburg, 2000</text>
                            </g>
                        </g>

                        <line x1="0" y1="350" x2={TITLE_BLOCK_WIDTH} y2="350" stroke="black" strokeWidth="3" />

                        {/* 2. PROJECT INFO */}
                        <g transform="translate(20, 390)">
                            <text fontSize="18" fontWeight="bold" fill="#64748b" letterSpacing="1">PROJECT</text>
                            <text y="40" fontSize="32" fontWeight="bold" width={TITLE_BLOCK_WIDTH - 40}>{data.metadata.title}</text>
                            
                            <g transform="translate(0, 80)">
                                <text fontSize="18" fontWeight="bold" fill="#64748b" letterSpacing="1">CLIENT</text>
                                <text y="30" fontSize="24" fontWeight="bold">{data.metadata.client}</text>
                            </g>
                            
                            <g transform="translate(0, 150)">
                                <text fontSize="18" fontWeight="bold" fill="#64748b" letterSpacing="1">SITE ADDRESS</text>
                                <text y="30" fontSize="18" width={TITLE_BLOCK_WIDTH - 40}>{data.metadata.address}</text>
                                <text y="55" fontSize="18">{data.metadata.erfNumber}</text>
                            </g>
                        </g>
                        
                        <line x1="0" y1="650" x2={TITLE_BLOCK_WIDTH} y2="650" stroke="black" strokeWidth="2" />

                        {/* 3. CONSULTANTS (Grid) */}
                        <g transform="translate(20, 690)">
                             <text fontSize="18" fontWeight="bold" fill="#64748b" letterSpacing="1">CONSULTANTS</text>
                            {Object.entries(data.metadata.consultants).map(([role, name], i) => (
                                <g key={i} transform={`translate(0, ${40 + i * 50})`}>
                                    <text fontSize="14" fontWeight="bold" fill="#000">{role.toUpperCase()}</text>
                                    <text y="20" fontSize="16" fill="#475569">{name}</text>
                                </g>
                            ))}
                        </g>
                        
                        <line x1="0" y1="1000" x2={TITLE_BLOCK_WIDTH} y2="1000" stroke="black" strokeWidth="2" />
                        
                        {/* 4. REVISIONS */}
                        <g transform="translate(0, 1000)">
                             <rect width={TITLE_BLOCK_WIDTH} height="30" fill="#f1f5f9" />
                             <text x="20" y="20" fontSize="14" fontWeight="bold">REVISIONS</text>
                             <line x1="0" y1="30" x2={TITLE_BLOCK_WIDTH} y2="30" stroke="black" strokeWidth="1" />
                             
                             <g transform="translate(20, 60)">
                                <text fontSize="14" fontWeight="bold">{data.metadata.revision}</text>
                                <text y="25" fontSize="12" fill="#64748b">{data.metadata.date}</text>
                             </g>
                        </g>

                        <line x1="0" y1="1200" x2={TITLE_BLOCK_WIDTH} y2="1200" stroke="black" strokeWidth="3" />

                        {/* 6. DRAWING META (Bottom) */}
                        <g transform={`translate(0, 1200)`}>
                            
                            <g transform="translate(20, 40)">
                                <text fontSize="14" fontWeight="bold" fill="#64748b" letterSpacing="1">DRAWING TITLE</text>
                                <text y="40" fontSize="48" fontWeight="bold" fill="#000">{data.metadata.drawingHeading}</text>
                            </g>

                            <line x1="0" y1="100" x2={TITLE_BLOCK_WIDTH} y2="100" stroke="black" strokeWidth="1" />
                            
                            {/* Metadata Grid */}
                             <g transform="translate(20, 140)">
                                 <g>
                                     <text fontSize="12" fill="#64748b" fontWeight="bold" letterSpacing="1">DATE</text>
                                     <text y="20" fontSize="18" fontWeight="bold">{data.metadata.date}</text>
                                 </g>
                                 <g transform="translate(TITLE_BLOCK_WIDTH/2, 0)">
                                     <text fontSize="12" fill="#64748b" fontWeight="bold" letterSpacing="1">SCALE</text>
                                     <text y="20" fontSize="18" fontWeight="bold">{data.metadata.scale}</text>
                                 </g>
                                 
                                  <g transform="translate(0, 60)">
                                     <text fontSize="12" fill="#64748b" fontWeight="bold" letterSpacing="1">DRAWN BY</text>
                                     <text y="20" fontSize="18" fontWeight="bold">{data.metadata.drawnBy}</text>
                                 </g>
                                  <g transform="translate(TITLE_BLOCK_WIDTH/2, 60)">
                                     <text fontSize="12" fill="#64748b" fontWeight="bold" letterSpacing="1">CHECKED</text>
                                     <text y="20" fontSize="18" fontWeight="bold">ARCH</text>
                                 </g>
                             </g>
                             
                             <line x1="0" y1="240" x2={TITLE_BLOCK_WIDTH} y2="240" stroke="black" strokeWidth="3" />

                             {/* Big Sheet Number */}
                             <rect x="0" y="240" width={TITLE_BLOCK_WIDTH} height={SHEET_HEIGHT - MARGIN*2 - 1440} fill="none" />
                             
                             <text x={TITLE_BLOCK_WIDTH/2} y="400" fontSize="180" fontWeight="bold" textAnchor="middle" fill="#000">{data.metadata.sheetNumber}</text>
                             <text x={TITLE_BLOCK_WIDTH/2} y="440" fontSize="24" fontWeight="bold" textAnchor="middle" fill="#64748b" letterSpacing="2">SHEET NO.</text>
                        </g>
                    </g>
                </svg>
            </div>
        </div>
    );
};
