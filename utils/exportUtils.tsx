
import React from 'react';
import { PlanData } from '../types';
import { WallEntity, OpeningEntity, StairEntity, LabelEntity, SymbolEntity, DimensionEntity, NorthArrowEntity, AutoDimensionEntity } from '../components/CanvasEntities';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsPDF } from 'jspdf';

// A3 Dimensions in mm (Landscape)
const SHEET_WIDTH = 420;
const SHEET_HEIGHT = 297;
const SCALE_FACTOR = 10; // 10 units = 1mm
const VIEWBOX_WIDTH = SHEET_WIDTH * SCALE_FACTOR;
const VIEWBOX_HEIGHT = SHEET_HEIGHT * SCALE_FACTOR;

const TITLE_BLOCK_WIDTH = 80 * SCALE_FACTOR;
const VIEWPORT_WIDTH = VIEWBOX_WIDTH - TITLE_BLOCK_WIDTH;
const VIEWPORT_HEIGHT = VIEWBOX_HEIGHT;
const MARGIN = 10 * SCALE_FACTOR;

export const generateSheetSvg = (data: PlanData) => {
    // 1. Calculate Bounding Box of the plan
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
    }

    // Add padding
    const padding = 50;
    minX -= padding; minY -= padding; maxX += padding; maxY += padding;

    const planWidth = maxX - minX;
    const planHeight = maxY - minY;
    
    // 2. Calculate Scale to fit Viewport
    // Available space in viewport (minus margins)
    const availW = VIEWPORT_WIDTH - (MARGIN * 2);
    const availH = VIEWPORT_HEIGHT - (MARGIN * 2);
    
    // Avoid division by zero
    const safePlanWidth = planWidth || 1;
    const safePlanHeight = planHeight || 1;
    
    const scaleX = availW / safePlanWidth;
    const scaleY = availH / safePlanHeight;
    const fitScale = Math.min(scaleX, scaleY, 1.5); // Cap scale so small plans aren't massive

    // 3. Calculate Translation to center
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const sheetCenterX = VIEWPORT_WIDTH / 2;
    const sheetCenterY = VIEWPORT_HEIGHT / 2;
    
    // Transform string: Move to center of sheet, Scale, Move center of plan to origin
    const transform = `translate(${sheetCenterX}, ${sheetCenterY}) scale(${fitScale}) translate(${-centerX}, ${-centerY})`;

    const SvgSheet = () => (
        <svg
            width={`${SHEET_WIDTH}mm`}
            height={`${SHEET_HEIGHT}mm`}
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="10" stroke="#cbd5e1" strokeWidth="2" />
                </pattern>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill="#475569" />
                </marker>
            </defs>
            
            {/* White Background (Paper) */}
            <rect x={0} y={0} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="white" />

            {/* Title Block Area */}
            <rect x={VIEWPORT_WIDTH} y={0} width={TITLE_BLOCK_WIDTH} height={VIEWBOX_HEIGHT} fill="white" stroke="black" strokeWidth="2" />
            <line x1={VIEWPORT_WIDTH} y1={0} x2={VIEWPORT_WIDTH} y2={VIEWBOX_HEIGHT} stroke="black" strokeWidth="2" />

            {/* Drawing Viewport Border */}
            <rect x={MARGIN} y={MARGIN} width={VIEWPORT_WIDTH - MARGIN * 2} height={VIEWPORT_HEIGHT - MARGIN * 2} fill="none" stroke="#e2e8f0" strokeWidth="1" />

            {/* Plan Content */}
            <g transform={transform}>
                {data.northArrow && <NorthArrowEntity arrow={data.northArrow} selected={false} />}

                {/* Walls with Auto Dimensions */}
                {data.walls.map(wall => {
                    const openings = data.openings.filter(o => o.wallId === wall.id);
                    return (
                        <g key={wall.id}>
                            <WallEntity wall={wall} openings={openings} selected={false} />
                            <AutoDimensionEntity wall={wall} openings={openings} />
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

            {/* Title Block Content */}
            <g transform={`translate(${VIEWPORT_WIDTH + 20}, 50)`} fontFamily="monospace">
                {/* Logo / Header Area */}
                <text y="0" fontSize="40" fontWeight="bold">PROJECT</text>

                <g transform="translate(0, 100)">
                    <text y="0" fontSize="20" fill="#64748b">PROJECT TITLE</text>
                    <text y="30" fontSize="25" fontWeight="bold">{data.metadata.title}</text>
                    <line x1="0" y1="45" x2={TITLE_BLOCK_WIDTH - 40} y2="45" stroke="black" strokeWidth="2" />
                </g>

                <g transform="translate(0, 250)">
                    <text y="0" fontSize="20" fill="#64748b">CLIENT</text>
                    <text y="30" fontSize="25">{data.metadata.client}</text>
                    <line x1="0" y1="45" x2={TITLE_BLOCK_WIDTH - 40} y2="45" stroke="black" strokeWidth="1" />
                </g>

                <g transform="translate(0, 350)">
                    <text y="0" fontSize="20" fill="#64748b">ADDRESS</text>
                    <text y="30" fontSize="20" width="600">{data.metadata.address}</text>
                    <text y="60" fontSize="20">{data.metadata.erfNumber}</text>
                    <line x1="0" y1="75" x2={TITLE_BLOCK_WIDTH - 40} y2="75" stroke="black" strokeWidth="1" />
                </g>

                <g transform="translate(0, 2400)">
                    <line x1="0" y1="-20" x2={TITLE_BLOCK_WIDTH - 40} y2="-20" stroke="black" strokeWidth="2" />

                    <text y="0" fontSize="18" fill="#64748b">DATE</text>
                    <text y="25" fontSize="22">{data.metadata.date}</text>

                    <text y="60" fontSize="18" fill="#64748b">SCALE</text>
                    <text y="85" fontSize="22">{data.metadata.scale}</text>

                    <text y="120" fontSize="18" fill="#64748b">DRAWN BY</text>
                    <text y="145" fontSize="22">{data.metadata.drawnBy}</text>

                    <text y="180" fontSize="18" fill="#64748b">REVISION</text>
                    <text y="205" fontSize="22">{data.metadata.revision}</text>
                </g>
            </g>

            {/* Outer Border */}
            <rect x={0} y={0} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="none" stroke="black" strokeWidth="5" />
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
        // High res for print
        const scale = 2; 
        canvas.width = VIEWBOX_WIDTH * scale;
        canvas.height = VIEWBOX_HEIGHT * scale;
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
        // 1.5x scale usually sufficient for PDF rasterization without crashing browser memory
        const scale = 1.5; 
        canvas.width = VIEWBOX_WIDTH * scale;
        canvas.height = VIEWBOX_HEIGHT * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        
        const pngUrl = canvas.toDataURL("image/png");
        
        // A3 Landscape PDF
        // @ts-ignore - jsPDF type definitions might vary in this environment
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a3'
        });
        
        pdf.addImage(pngUrl, 'PNG', 0, 0, 420, 297);
        pdf.save(`${data.metadata.title.replace(/\s+/g, '_')}_sheet.pdf`);
        URL.revokeObjectURL(url);
    };
    img.src = url;
};
