
import React from 'react';
import { PlanData } from '../types';
import { WallEntity, OpeningEntity, StairEntity, LabelEntity, SymbolEntity, DimensionEntity, NorthArrowEntity, AutoDimensionEntity, generateLegendData, getWallPath } from './CanvasEntities';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsPDF } from 'jspdf';

// A1 Dimensions in mm (Landscape) - Scaled for high res export but keeping aspect ratio
const SHEET_WIDTH_MM = 841;
const SHEET_HEIGHT_MM = 594;
const SCALE_FACTOR = 10; 
const SHEET_WIDTH = SHEET_WIDTH_MM * SCALE_FACTOR;
const SHEET_HEIGHT = SHEET_HEIGHT_MM * SCALE_FACTOR;

const TITLE_BLOCK_WIDTH = 120 * SCALE_FACTOR; // Widened
const GENERAL_NOTES_WIDTH = 180 * SCALE_FACTOR; // Widened
const MARGIN = 10 * SCALE_FACTOR;

export const generateSheetSvg = (data: PlanData) => {
    // 1. Calculate Bounding Box
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
        
        // Include North Arrow
        if (data.northArrow) {
            minX = Math.min(minX, data.northArrow.position.x - 50);
            maxX = Math.max(maxX, data.northArrow.position.x + 50);
            minY = Math.min(minY, data.northArrow.position.y - 50);
            maxY = Math.max(maxY, data.northArrow.position.y + 50);
        }

        minX -= 100; minY -= 100; maxX += 100; maxY += 100;
    }

    const planWidth = maxX - minX;
    const planHeight = maxY - minY;
    
    // Calculate Drawing Area based on present features
    const sideBarsWidth = TITLE_BLOCK_WIDTH + (data.metadata.generalNotes ? 20 * SCALE_FACTOR : 0);
    const drawAreaW = SHEET_WIDTH - sideBarsWidth - (data.metadata.generalNotes ? GENERAL_NOTES_WIDTH : 0) - (MARGIN * 2);
    const drawAreaH = SHEET_HEIGHT - (MARGIN * 2);
    
    const scaleX = drawAreaW / planWidth;
    const scaleY = drawAreaH / planHeight;
    const fitScale = Math.min(scaleX, scaleY) * 0.9;

    const planCenterX = (minX + maxX) / 2;
    const planCenterY = (minY + maxY) / 2;
    
    const drawAreaCenterX = MARGIN + (drawAreaW / 2);
    const drawAreaCenterY = SHEET_HEIGHT / 2;

    const translateX = drawAreaCenterX - (planCenterX * fitScale);
    const translateY = drawAreaCenterY - (planCenterY * fitScale);
    const planCenter = { x: planCenterX, y: planCenterY };

    const legendItems = generateLegendData(data);

    const SvgSheet = () => (
        <svg
            width={`${SHEET_WIDTH_MM}mm`}
            height={`${SHEET_HEIGHT_MM}mm`}
            viewBox={`0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}`}
            xmlns="http://www.w3.org/2000/svg"
            className="font-sans"
        >
            <defs>
                <pattern id="hatch_export" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="10" stroke="#cbd5e1" strokeWidth="2" />
                </pattern>
                <marker id="arrow_export" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
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
            
            <rect x={0} y={0} width={SHEET_WIDTH} height={SHEET_HEIGHT} fill="white" />
            
            {/* Border */}
            <rect x={MARGIN} y={MARGIN} width={SHEET_WIDTH - MARGIN*2} height={SHEET_HEIGHT - MARGIN*2} fill="none" stroke="black" strokeWidth="4" />

            <g transform={`translate(${translateX}, ${translateY}) scale(${fitScale})`}>
                {data.northArrow && <NorthArrowEntity arrow={data.northArrow} selected={false} />}

                {data.walls.map(wall => {
                    const openings = data.openings.filter(o => o.wallId === wall.id);
                    return (
                        <g key={wall.id}>
                            <WallEntity wall={wall} openings={openings} selected={false} />
                            <AutoDimensionEntity wall={wall} openings={openings} planCenter={planCenter} />
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
    );

    return renderToStaticMarkup(<SvgSheet />);
};

export const exportAsSvg = (data: PlanData) => {
    const svgString = generateSheetSvg(data);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.metadata.title.replace(/\s+/g, '_')}_sheet.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
};

export const exportAsPng = (data: PlanData) => {
    const svgString = generateSheetSvg(data);
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 2; 
        canvas.width = SHEET_WIDTH * scale;
        canvas.height = SHEET_HEIGHT * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        
        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${data.metadata.title.replace(/\s+/g, '_')}_sheet.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };
    img.src = url;
};

export const exportAsPdf = (data: PlanData) => {
    const svgString = generateSheetSvg(data);
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 1.5; 
        canvas.width = SHEET_WIDTH * scale;
        canvas.height = SHEET_HEIGHT * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        
        const pngUrl = canvas.toDataURL("image/png");
        
        // @ts-ignore
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: [SHEET_WIDTH_MM, SHEET_HEIGHT_MM]
        });
        
        pdf.addImage(pngUrl, 'PNG', 0, 0, SHEET_WIDTH_MM, SHEET_HEIGHT_MM);
        pdf.save(`${data.metadata.title.replace(/\s+/g, '_')}_sheet.pdf`);
        URL.revokeObjectURL(url);
    };
    img.src = url;
};
