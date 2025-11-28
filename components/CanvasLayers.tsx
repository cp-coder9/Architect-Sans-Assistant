
import React from 'react';
import { PlanData, LayerConfig, Point } from '../types';
import { SnapGuide } from '../utils/snapping';
import { WallEntity, OpeningEntity, StairEntity, DimensionEntity, LabelEntity, NorthArrowEntity, SymbolEntity, AutoDimensionEntity, getWallPath, ResizeHandle } from './CanvasEntities';

interface CanvasLayersProps {
    data: PlanData;
    layers: LayerConfig;
    zoom: number;
    pan: Point;
    selectedId: string | null;
    snapGuides: SnapGuide[];
}

export const CanvasLayers: React.FC<CanvasLayersProps> = ({ 
    data, layers, zoom, pan, selectedId, snapGuides 
}) => {
    return (
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Grid */}
            <rect x="-50000" y="-50000" width="100000" height="100000" fill="url(#grid)" />
            
                {layers.showBackground && data.background && (
                    <g style={{ pointerEvents: 'none' }}>
                        <image 
                            href={data.background.url} 
                            x={data.background.x} 
                            y={data.background.y} 
                            width={data.background.width} 
                            height={data.background.height} 
                            opacity={data.background.opacity} 
                        />
                        {/* Background Selection UI */}
                        {selectedId === 'BACKGROUND' && (
                        <g>
                            <rect 
                                x={data.background.x} y={data.background.y} 
                                width={data.background.width} height={data.background.height} 
                                fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke"
                            />
                            {!data.background.locked && (
                                <>
                                    <ResizeHandle x={data.background.x} y={data.background.y} cursor="cursor-nwse-resize" />
                                    <ResizeHandle x={data.background.x + data.background.width} y={data.background.y} cursor="cursor-nesw-resize" />
                                    <ResizeHandle x={data.background.x} y={data.background.y + data.background.height} cursor="cursor-nesw-resize" />
                                    <ResizeHandle x={data.background.x + data.background.width} y={data.background.y + data.background.height} cursor="cursor-nwse-resize" />
                                </>
                            )}
                        </g>
                        )}
                    </g>
                )}

            {layers.showWalls && data.walls.map(wall => (
                <g key={wall.id}>
                    <WallEntity 
                        wall={wall} 
                        openings={data.openings.filter(o => o.wallId === wall.id)} 
                        selected={selectedId === wall.id}
                        allWalls={data.walls}
                    />
                    {layers.showDimensions && <AutoDimensionEntity wall={wall} openings={data.openings.filter(o => o.wallId === wall.id)} />}
                </g>
            ))}
            
            {layers.showOpenings && data.openings.map(op => {
                    const wall = data.walls.find(w => w.id === op.wallId);
                    if (!wall) return null;
                    return <OpeningEntity key={op.id} op={op} wall={wall} selected={selectedId === op.id} showLabel={layers.showLabels} />;
            })}

            {layers.showStairs && data.stairs.map(s => <StairEntity key={s.id} stair={s} selected={selectedId === s.id} />)}
            {layers.showSymbols && data.symbols.map(s => <SymbolEntity key={s.id} symbol={s} selected={selectedId === s.id} />)}
            {layers.showLabels && data.labels.map(l => <LabelEntity key={l.id} label={l} selected={selectedId === l.id} />)}
            {layers.showDimensions && data.dimensions.map(d => <DimensionEntity key={d.id} dim={d} selected={selectedId === d.id} />)}
            
            {data.northArrow && <NorthArrowEntity arrow={data.northArrow} selected={false} />}

            {snapGuides.map((g, i) => (
                <line 
                    key={i} 
                    x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} 
                    stroke="#f59e0b" strokeWidth={1/zoom} strokeDasharray="4,2" 
                />
            ))}
        </g>
    );
};
