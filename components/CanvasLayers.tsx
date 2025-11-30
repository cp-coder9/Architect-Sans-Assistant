
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

// Simple Context Menu Component
const ContextMenu: React.FC<{
    x: number;
    y: number;
    selectedId: string | null;
    data: PlanData;
    onUpdate: (data: PlanData, addToHistory?: boolean) => void;
    onClose: () => void;
    onSelect: (id: string | null) => void;
    onDelete: (id: string) => void;
    onLock: (id: string) => void;
    onDuplicate: (object: any) => void;
}> = ({ x, y, selectedId, data, onUpdate, onClose, onSelect, onDelete, onLock, onDuplicate }) => {
    const menuItems: Array<{label: string, action: () => void, disabled?: boolean}> = [];

    if (!selectedId) {
        menuItems.push(
            { label: 'Paste', action: () => console.log('Paste not implemented'), disabled: true }
        );
    } else if (selectedId === 'BACKGROUND') {
        menuItems.push(
            { label: 'Lock Position', action: () => onLock(selectedId) },
            { label: 'Duplicate', action: () => onDuplicate(data.background), disabled: !data.background },
            { label: 'Delete', action: () => onDelete(selectedId) }
        );
    } else {
        const getObject = (id: string) => {
            return data.walls.find(w => w.id === id) ||
                   data.openings.find(o => o.id === id) ||
                   data.symbols.find(s => s.id === id) ||
                   data.stairs.find(s => s.id === id) ||
                   data.dimensions.find(d => d.id === id) ||
                   data.labels.find(l => l.id === id);
        };

        const obj = getObject(selectedId);
        if (obj) {
            // Grouping options for walls
            const wall = data.walls.find(w => w.id === selectedId);
            if (wall) {
                const groupMembers = data.walls.filter(w => w.groupId === wall.groupId).length;
                if (wall.groupId) {
                    menuItems.push(
                        { label: `Ungroup (${groupMembers} walls)`, action: () => {
                            const updatedWalls = data.walls.map(w => w.id === wall.id ? {...w, groupId: undefined} : w);
                            onUpdate({...data, walls: updatedWalls}, true);
                        }},
                        { label: 'Group Info', action: () => console.log(`Group has ${groupMembers} walls`), disabled: false }
                    );
                } else {
                    menuItems.push({ label: 'Group', action: () => console.log('Group selection not implemented'), disabled: true });
                }
            }

            menuItems.push(
                { label: obj.locked ? 'Unlock' : 'Lock Position', action: () => onLock(selectedId) },
                { label: 'Duplicate', action: () => onDuplicate(obj) },
                { label: 'Delete', action: () => onDelete(selectedId) }
            );
        }
    }

    return (
        <div
            className="absolute z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl text-sm min-w-32 overflow-hidden"
            style={{ left: x, top: y }}
            onMouseLeave={onClose}
        >
            {menuItems.map((item, index) => (
                <button
                    key={index}
                    className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                        item.disabled ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300'
                    }`}
                    onClick={() => { if (!item.disabled) { item.action(); onClose(); } }}
                    disabled={item.disabled}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
};

export const CanvasLayers: React.FC<CanvasLayersProps> = ({
    data, layers, zoom, pan, selectedId, snapGuides
}) => {
    // Calculate plan center for dimension placement
    const planCenter = React.useMemo(() => {
        if (data.walls.length === 0) return null;
        const total = data.walls.reduce(
            (acc, wall) => ({
                x: acc.x + (wall.start.x + wall.end.x) / 2,
                y: acc.y + (wall.start.y + wall.end.y) / 2
            }),
            { x: 0, y: 0 }
        );
        return {
            x: total.x / data.walls.length,
            y: total.y / data.walls.length
        };
    }, [data.walls]);

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
                    {layers.showDimensions && <AutoDimensionEntity wall={wall} openings={data.openings.filter(o => o.wallId === wall.id)} planCenter={planCenter} />}
                </g>
            ))}

            {/* Room Group Selection Handles */}
            {(() => {
                // Check if selected wall belongs to a room group
                const selectedWall = data.walls.find(w => w.id === selectedId);
                if (!selectedWall || !selectedWall.groupId) return null;

                // Get all walls in the same group
                const roomWalls = data.walls.filter(w => w.groupId === selectedWall.groupId);
                if (roomWalls.length < 4) return null; // Not a complete room

                // Check if all walls in group are locked
                const allLocked = roomWalls.every(w => w.locked);
                if (allLocked) return null;

                // Calculate bounding box of the room
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                roomWalls.forEach(wall => {
                    minX = Math.min(minX, Math.min(wall.start.x, wall.end.x));
                    minY = Math.min(minY, Math.min(wall.start.y, wall.end.y));
                    maxX = Math.max(maxX, Math.max(wall.start.x, wall.end.x));
                    maxY = Math.max(maxY, Math.max(wall.start.y, wall.end.y));
                });

                return (
                    <g>
                        {/* Room bounding box outline */}
                        <rect
                            x={minX}
                            y={minY}
                            width={maxX - minX}
                            height={maxY - minY}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="1"
                            strokeDasharray="4,2"
                            vectorEffect="non-scaling-stroke"
                        />
                        {/* Room resize handles */}
                        <ResizeHandle x={minX} y={minY} cursor="cursor-nwse-resize" />
                        <ResizeHandle x={maxX} y={minY} cursor="cursor-nesw-resize" />
                        <ResizeHandle x={minX} y={maxY} cursor="cursor-nesw-resize" />
                        <ResizeHandle x={maxX} y={maxY} cursor="cursor-nwse-resize" />
                    </g>
                );
            })()}
            
            {layers.showOpenings && data.openings.map(op => {
                    const wall = data.walls.find(w => w.id === op.wallId);
                    if (!wall) return null;
                    return <OpeningEntity key={op.id} op={op} wall={wall} selected={selectedId === op.id} showLabel={layers.showLabels}>
                        {selectedId === op.id && !op.locked && (
                            <g>
                                <ResizeHandle x={-op.width/20} y={0} cursor="cursor-ew-resize" />
                                <ResizeHandle x={op.width/20} y={0} cursor="cursor-ew-resize" />
                            </g>
                        )}
                        </OpeningEntity>;
            })}

            {layers.showStairs && data.stairs.map(s => (
                <g key={s.id}>
                    <StairEntity stair={s} selected={selectedId === s.id} />
                    {selectedId === s.id && !s.locked && (
                        <ResizeHandle x={s.position.x} y={s.position.y} cursor="cursor-move" />
                    )}
                </g>
            ))}
            {layers.showSymbols && data.symbols.map(s => (
                <g key={s.id}>
                    <SymbolEntity symbol={s} selected={selectedId === s.id} />
                    {selectedId === s.id && !s.locked && (
                        <>
                            <ResizeHandle x={s.position.x - (s.width || 100)/2} y={s.position.y - (s.height || 100)/2} cursor="cursor-nwse-resize" />
                            <ResizeHandle x={s.position.x + (s.width || 100)/2} y={s.position.y - (s.height || 100)/2} cursor="cursor-nesw-resize" />
                            <ResizeHandle x={s.position.x - (s.width || 100)/2} y={s.position.y + (s.height || 100)/2} cursor="cursor-nesw-resize" />
                            <ResizeHandle x={s.position.x + (s.width || 100)/2} y={s.position.y + (s.height || 100)/2} cursor="cursor-nwse-resize" />
                        </>
                    )}
                </g>
            ))}
            {layers.showLabels && data.labels.map(l => (
                <g key={l.id}>
                    <LabelEntity label={l} selected={selectedId === l.id} />
                    {selectedId === l.id && !l.locked && (
                        <ResizeHandle x={l.position.x} y={l.position.y} cursor="cursor-move" />
                    )}
                </g>
            ))}
            {layers.showDimensions && data.dimensions.map(d => (
                <g key={d.id}>
                    <DimensionEntity dim={d} selected={selectedId === d.id} />
                    {selectedId === d.id && !d.locked && (
                        <>
                            <ResizeHandle x={d.start.x} y={d.start.y} cursor="cursor-move" />
                            <ResizeHandle x={d.end.x} y={d.end.y} cursor="cursor-move" />
                        </>
                    )}
                </g>
            ))}
            
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
