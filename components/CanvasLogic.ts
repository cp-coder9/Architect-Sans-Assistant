import { useState, useRef, useEffect } from 'react';
import { PlanData, ToolType, Point, Wall, Opening, RoomLabel, SymbolInstance, DragState, LayerConfig, StairType, Stair, Dimension } from '../types';
import { dist, sub, add, scale, dot } from '../utils/geometry';
import { getSnapPoint, SnapGuide } from '../utils/snapping';

// Helper: Project point p onto segment a-b
const projectOnSegment = (a: Point, b: Point, p: Point): Point => {
    const v = sub(b, a);
    const l2 = dot(v, v);
    if (l2 === 0) return a;
    const t = Math.max(0, Math.min(1, dot(sub(p, a), v) / l2));
    return add(a, scale(v, t));
};

interface UseCanvasLogicProps {
    data: PlanData;
    onUpdate: (data: PlanData, addToHistory?: boolean) => void;
    tool: ToolType;
    layers: LayerConfig;
    activeWallThickness: number;
    activeDoorType: string;
    activeWindowType: string;
    activeSymbolId: string;
    containerRef: React.RefObject<HTMLDivElement>;
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
}

export const useCanvasLogic = ({
    data,
    onUpdate,
    tool,
    layers,
    activeWallThickness,
    activeDoorType,
    activeWindowType,
    activeSymbolId,
    containerRef,
    selectedId,
    setSelectedId
}: UseCanvasLogicProps) => {
    // View State
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    // Interaction State
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
    const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
    
    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'wall' | 'opening' | 'symbol' | 'background' | 'canvas', targetId?: string } | null>(null);

    const screenToWorld = (clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        // Ensure pan and zoom have valid values
        const safePan = pan || { x: 0, y: 0 };
        const safeZoom = zoom || 1;
        return {
            x: (clientX - rect.left - safePan.x) / safeZoom,
            y: (clientY - rect.top - safePan.y) / safeZoom
        };
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const worldPos = screenToWorld(e.clientX, e.clientY);
        
        // Hit Test for Context Menu Priority
        
        // 1. Symbols
        const clickedSymbol = data.symbols.find(s => dist(s.position, worldPos) < 20/zoom);
        if (clickedSymbol) {
            setSelectedId(clickedSymbol.id);
            setContextMenu({ x: e.clientX, y: e.clientY, type: 'symbol', targetId: clickedSymbol.id });
            return;
        }

        // 2. Openings
        // Check openings by checking walls first, then projecting
        let clickedOpening: Opening | null = null;
        for (const w of data.walls) {
             const proj = projectOnSegment(w.start, w.end, worldPos);
             if (dist(proj, worldPos) < w.thickness/2 + 10/zoom) {
                 // On wall line, check openings
                 const wallLen = dist(w.start, w.end);
                 const t = dist(w.start, proj) / wallLen;
                 // Find opening overlapping this t
                 const op = data.openings.find(o => o.wallId === w.id && Math.abs(o.t - t) * wallLen < o.width/20); // approx check
                 if (op) {
                     clickedOpening = op;
                     break;
                 }
             }
        }
        if (clickedOpening) {
            setSelectedId(clickedOpening.id);
            setContextMenu({ x: e.clientX, y: e.clientY, type: 'opening', targetId: clickedOpening.id });
            return;
        }

        // 3. Walls
        const clickedWall = data.walls.find(w => dist(projectOnSegment(w.start, w.end, worldPos), worldPos) < w.thickness/2 + 10/zoom);
        if (clickedWall) {
            setSelectedId(clickedWall.id);
            setContextMenu({ x: e.clientX, y: e.clientY, type: 'wall', targetId: clickedWall.id });
            return;
        }

        // 4. Background
        if (data.background && layers.showBackground) {
             if (worldPos.x >= data.background.x && worldPos.x <= data.background.x + data.background.width && 
                 worldPos.y >= data.background.y && worldPos.y <= data.background.y + data.background.height) {
                 setSelectedId('BACKGROUND');
                 setContextMenu({ x: e.clientX, y: e.clientY, type: 'background', targetId: 'BACKGROUND' });
                 return;
             }
        }

        // 5. Canvas (Empty)
        setSelectedId(null);
        setContextMenu({ x: e.clientX, y: e.clientY, type: 'canvas' });
    };

    const handleWallMouseDown = (worldPos: Point) => {
        const snap = getSnapPoint(worldPos, zoom, data.walls, data.openings);
        const startP = snap.snapped ? snap.point : worldPos;
        const newWall: Wall = {
            id: crypto.randomUUID(),
            start: startP,
            end: startP,
            thickness: activeWallThickness || 22,
            height: 2700
        };
        onUpdate({ ...data, walls: [...data.walls, newWall] }, true);
        setSelectedId(newWall.id);
        setDragState({
            type: 'new_wall',
            activeId: newWall.id,
            startPos: startP,
            endpointType: 'end',
            snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [], symbols: [] }
        });
    };

    const handleSelectMouseDown = (worldPos: Point) => {
        let selectedGroupId: string | null = null;

        if (selectedId === 'BACKGROUND' && data.background && !data.background.locked) {
            const bg = data.background;
            const handleRadius = 15 / zoom;
            let handle: DragState['handle'] | null = null;
            if (dist(worldPos, {x: bg.x, y: bg.y}) < handleRadius) handle = 'tl';
            else if (dist(worldPos, {x: bg.x + bg.width, y: bg.y}) < handleRadius) handle = 'tr';
            else if (dist(worldPos, {x: bg.x, y: bg.y + bg.height}) < handleRadius) handle = 'bl';
            else if (dist(worldPos, {x: bg.x + bg.width, y: bg.y + bg.height}) < handleRadius) handle = 'br';

            if (handle) {
                setDragState({
                    type: 'resize_background',
                    handle: handle,
                    startPos: worldPos,
                    initialPos: { x: bg.x, y: bg.y },
                    initialSize: { w: bg.width, h: bg.height },
                    snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [] }
                });
                return;
            }
        }

        const clickedWall = data.walls.find(w => dist(projectOnSegment(w.start, w.end, worldPos), worldPos) < w.thickness/2 + 10/zoom);
        if (clickedWall) {
            setSelectedId(clickedWall.id);
            selectedGroupId = clickedWall.groupId || null;

            if (dist(worldPos, clickedWall.start) < 20/zoom) {
                setDragState({ type: 'wall_endpoint', activeId: clickedWall.id, endpointType: 'start', startPos: worldPos, snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [] } });
            } else if (dist(worldPos, clickedWall.end) < 20/zoom) {
                setDragState({ type: 'wall_endpoint', activeId: clickedWall.id, endpointType: 'end', startPos: worldPos, snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [] } });
            } else {
                // Group movement - find all objects with same groupId
                if (selectedGroupId) {
                    const groupObjects = [
                        ...data.walls.filter(w => w.groupId === selectedGroupId),
                        ...data.symbols.filter(s => s.groupId === selectedGroupId),
                        ...data.labels.filter(l => l.groupId === selectedGroupId)
                    ].map(obj => obj.id);

                    setDragState({
                        type: 'move_group',
                        activeId: selectedGroupId,
                        startPos: worldPos,
                        snapshots: {
                            walls: data.walls.filter(w => w.groupId === selectedGroupId).map(w => ({ id: w.id, start: w.start, end: w.end })),
                            labels: data.labels.filter(l => l.groupId === selectedGroupId).map(l => ({ id: l.id, position: l.position })),
                            stairs: [],
                            dimensions: [],
                            openings: data.openings.filter(o => {
                                const wall = data.walls.find(w => w.id === o.wallId);
                                return wall?.groupId === selectedGroupId;
                            }).map(o => ({ id: o.id, t: o.t, wallId: o.wallId })),
                            symbols: data.symbols.filter(s => s.groupId === selectedGroupId).map(s => ({ id: s.id, position: s.position }))
                        }
                    });
                } else {
                    setDragState({ type: 'move_selection', activeId: clickedWall.id, startPos: worldPos, initialPos: clickedWall.start, snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [] } });
                }
            }
            return;
        }

        const clickedSymbol = data.symbols.find(s => dist(s.position, worldPos) < 20/zoom);
        if (clickedSymbol) {
            setSelectedId(clickedSymbol.id);
             if (!clickedSymbol.locked) {
                const handleRadius = 15 / zoom;
                const w = clickedSymbol.width || 100;
                const h = clickedSymbol.height || 100;
                let handle: DragState['handle'] | null = null;
                if (dist(worldPos, {x: clickedSymbol.position.x - w/2, y: clickedSymbol.position.y - h/2}) < handleRadius) handle = 'tl';
                else if (dist(worldPos, {x: clickedSymbol.position.x + w/2, y: clickedSymbol.position.y - h/2}) < handleRadius) handle = 'tr';
                else if (dist(worldPos, {x: clickedSymbol.position.x - w/2, y: clickedSymbol.position.y + h/2}) < handleRadius) handle = 'bl';
                else if (dist(worldPos, {x: clickedSymbol.position.x + w/2, y: clickedSymbol.position.y + h/2}) < handleRadius) handle = 'br';

                if (handle) {
                    setDragState({ type: 'resize_symbol', activeId: clickedSymbol.id, handle, startPos: worldPos, initialSize: { w, h }, snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [] } });
                    return;
                }
            }
            setDragState({ type: 'move_selection', activeId: clickedSymbol.id, startPos: worldPos, initialPos: clickedSymbol.position, snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [] } });
            return;
        }

        if (layers.showBackground && data.background) {
            const bg = data.background;
            if (worldPos.x >= bg.x && worldPos.x <= bg.x + bg.width &&
                worldPos.y >= bg.y && worldPos.y <= bg.y + bg.height) {
                setSelectedId('BACKGROUND');
                if (!bg.locked) {
                    setDragState({
                        type: 'move_background',
                        startPos: worldPos,
                        initialPos: { x: bg.x, y: bg.y },
                        snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [] }
                    });
                }
                return;
            }
        }

        setSelectedId(null);
    };

    const handleOpeningMouseDown = (worldPos: Point) => {
        // Find opening by checking if worldPos is close to the opening's position on its wall
        const clickedOpening = data.openings.find(o => {
            const wall = data.walls.find(w => w.id === o.wallId);
            if (!wall) return false;
            
            // Calculate opening position along the wall
            const wallLength = dist(wall.start, wall.end);
            if (wallLength === 0) return false;
            
            const openingPos = {
                x: wall.start.x + (wall.end.x - wall.start.x) * o.t,
                y: wall.start.y + (wall.end.y - wall.start.y) * o.t
            };
            
            return dist(openingPos, worldPos) < 20/zoom;
        });
        
        if (clickedOpening) {
            setSelectedId(clickedOpening.id);
            if (!clickedOpening.locked) {
                const handleRadius = 15 / zoom;
                const wall = data.walls.find(w => w.id === clickedOpening.wallId);
                if (wall) {
                    // Calculate opening position along the wall
                    const wallLength = dist(wall.start, wall.end);
                    const openingPos = {
                        x: wall.start.x + (wall.end.x - wall.start.x) * clickedOpening.t,
                        y: wall.start.y + (wall.end.y - wall.start.y) * clickedOpening.t
                    };
                    
                    let handle: DragState['handle'] | null = null;
                    if (dist(worldPos, {x: openingPos.x - clickedOpening.width/20, y: openingPos.y}) < handleRadius) handle = 'start';
                    else if (dist(worldPos, {x: openingPos.x + clickedOpening.width/20, y: openingPos.y}) < handleRadius) handle = 'end';

                    if (handle) {
                        setDragState({ type: 'resize_opening', activeId: clickedOpening.id, handle, startPos: worldPos, initialSize: { w: clickedOpening.width, h: clickedOpening.height }, snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [] } });
                        return;
                    }
                }
            }
            return;
        }

        let bestWall: Wall | null = null;
        let minDst = Infinity;
        let bestT = 0;
        data.walls.forEach(w => {
            const p = projectOnSegment(w.start, w.end, worldPos);
            const dst = dist(p, worldPos);
            if (dst < w.thickness + 20) {
                if (dst < minDst) {
                    minDst = dst;
                    bestWall = w;
                    const len = dist(w.start, w.end);
                    bestT = len > 0 ? dist(w.start, p) / len : 0;
                }
            }
        });

        if (bestWall) {
            const newOp: Opening = {
                id: crypto.randomUUID(),
                wallId: bestWall!.id,
                t: bestT,
                width: tool === ToolType.DOOR ? 90 : 120,
                height: 2100,
                sillHeight: tool === ToolType.WINDOW ? 900 : 0,
                type: tool === ToolType.DOOR ? 'door' : 'window',
                subType: tool === ToolType.DOOR ? activeDoorType : activeWindowType,
                label: tool === ToolType.DOOR ? `D${data.openings.length + 1}` : `W${data.openings.length + 1}`
            };
            onUpdate({ ...data, openings: [...data.openings, newOp] }, true);
            setSelectedId(newOp.id);
        }
    };

    const handleSymbolMouseDown = (worldPos: Point) => {
        const newSym: SymbolInstance = {
            id: crypto.randomUUID(),
            type: activeSymbolId,
            position: worldPos,
            rotation: 0,
            scale: 1
        };
        onUpdate({ ...data, symbols: [...data.symbols, newSym] }, true);
        setSelectedId(newSym.id);
    };

    const handleRoomLabelMouseDown = (worldPos: Point) => {
        const newLbl: RoomLabel = {
            id: crypto.randomUUID(),
            position: worldPos,
            text: "Room Name"
        };
        onUpdate({ ...data, labels: [...data.labels, newLbl] }, true);
        setSelectedId(newLbl.id);
    };

    const handleSquareRoomMouseDown = (worldPos: Point) => {
        // Start drawing a room - first corner
        setDragState({
            type: 'new_room',
            startPos: worldPos,
            endPos: worldPos,
            snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [] }
        });
    };

    const handleArchWallMouseDown = (worldPos: Point) => {
        const snap = getSnapPoint(worldPos, zoom, data.walls, data.openings);
        const startP = snap.snapped ? snap.point : worldPos;
        const newWall: Wall = {
            id: crypto.randomUUID(),
            start: startP,
            end: startP,
            thickness: activeWallThickness || 22,
            height: 2700,
            curvature: 500 // Default curvature for arch walls
        };
        onUpdate({ ...data, walls: [...data.walls, newWall] }, true);
        setSelectedId(newWall.id);
        setDragState({
            type: 'new_wall',
            activeId: newWall.id,
            startPos: startP,
            endpointType: 'end',
            snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [] }
        });
    };

    const handleDimensionMouseDown = (worldPos: Point) => {
        const newDimension = {
            id: crypto.randomUUID(),
            start: worldPos,
            end: worldPos,
            offset: 100
        };
        onUpdate({ ...data, dimensions: [...data.dimensions, newDimension] }, true);
        setSelectedId(newDimension.id);
        setDragState({
            type: 'new_dimension',
            activeId: newDimension.id,
            startPos: worldPos,
            snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [] }
        });
    };

    const handleStairMouseDown = (worldPos: Point) => {
        const newStair: Stair = {
            id: crypto.randomUUID(),
            position: worldPos,
            width: 1000,
            treadDepth: 250,
            riserHeight: 170,
            count: 12,
            flight1Count: 12,
            rotation: 0,
            type: StairType.STRAIGHT,
            label: `S${data.stairs.length + 1}`
        };
        onUpdate({ ...data, stairs: [...data.stairs, newStair] }, true);
        setSelectedId(newStair.id);
    };

    const handleCalibrateMouseDown = (worldPos: Point) => {
        // Calibration tool - for now just add a dimension line for scaling
        handleDimensionMouseDown(worldPos);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setContextMenu(null);
        if (tool !== ToolType.PAN) e.preventDefault();
        const worldPos = screenToWorld(e.clientX, e.clientY);

        if (tool === ToolType.PAN || e.button === 1) {
            setDragState({
                type: 'pan',
                startPos: { x: e.clientX, y: e.clientY },
                initialPos: pan,
                snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [] }
            });
            return;
        }

        switch (tool) {
            case ToolType.WALL:
                handleWallMouseDown(worldPos);
                break;
            case ToolType.ARCH_WALL:
                handleArchWallMouseDown(worldPos);
                break;
            case ToolType.SELECT:
                handleSelectMouseDown(worldPos);
                break;
            case ToolType.DOOR:
            case ToolType.WINDOW:
                handleOpeningMouseDown(worldPos);
                break;
            case ToolType.SYMBOL:
                handleSymbolMouseDown(worldPos);
                break;
            case ToolType.ROOM_LABEL:
                handleRoomLabelMouseDown(worldPos);
                break;
            case ToolType.SQUARE_ROOM:
                handleSquareRoomMouseDown(worldPos);
                break;
            case ToolType.DIMENSION:
                handleDimensionMouseDown(worldPos);
                break;
            case ToolType.STAIR:
                handleStairMouseDown(worldPos);
                break;
            case ToolType.CALIBRATE:
                handleCalibrateMouseDown(worldPos);
                break;
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        setMousePos(worldPos);

        if (dragState) {
            if (dragState.type === 'new_room' && dragState.startPos) {
                // Update room preview end position
                setDragState({...dragState, endPos: worldPos});
                return;
            }
            if (dragState.type === 'pan') {
                const dx = e.clientX - dragState.startPos.x;
                const dy = e.clientY - dragState.startPos.y;
                setPan({ x: (dragState.initialPos?.x || 0) + dx, y: (dragState.initialPos?.y || 0) + dy });
                return;
            }

            if (dragState.type === 'move_background' && data.background && dragState.initialPos) {
                const dx = worldPos.x - dragState.startPos.x;
                const dy = worldPos.y - dragState.startPos.y;
                onUpdate({
                    ...data,
                    background: {
                        ...data.background,
                        x: dragState.initialPos.x + dx,
                        y: dragState.initialPos.y + dy
                    }
                }, false); // No History
                return;
            }

            if (dragState.type === 'resize_background' && data.background && dragState.initialPos && dragState.initialSize) {
                const dx = worldPos.x - dragState.startPos.x;
                const dy = worldPos.y - dragState.startPos.y;
                let { x, y } = dragState.initialPos;
                let { w, h } = dragState.initialSize;

                if (dragState.handle === 'tl') { x += dx; y += dy; w -= dx; h -= dy; } 
                else if (dragState.handle === 'tr') { y += dy; w += dx; h -= dy; } 
                else if (dragState.handle === 'bl') { x += dx; w -= dx; h += dy; } 
                else if (dragState.handle === 'br') { w += dx; h += dy; }
                
                if (w < 10) w = 10;
                if (h < 10) h = 10;

                onUpdate({ ...data, background: { ...data.background, x, y, width: w, height: h } }, false);
                return;
            }

            if (dragState.type === 'new_wall' && dragState.activeId) {
                const snap = getSnapPoint(worldPos, zoom, data.walls, data.openings, dragState.startPos, [dragState.activeId]);
                setSnapGuides(snap.guides);
                const endP = snap.snapped ? snap.point : worldPos;
                onUpdate({ 
                    ...data, 
                    walls: data.walls.map(w => w.id === dragState.activeId ? { ...w, end: endP } : w) 
                }, false);
            }
            
            if (dragState.type === 'wall_endpoint' && dragState.activeId) {
                 const snap = getSnapPoint(worldPos, zoom, data.walls, data.openings, undefined, [dragState.activeId]);
                 setSnapGuides(snap.guides);
                 const p = snap.snapped ? snap.point : worldPos;
                 onUpdate({
                     ...data,
                     walls: data.walls.map(w => {
                         if (w.id === dragState.activeId) {
                             return dragState.endpointType === 'start' ? { ...w, start: p } : { ...w, end: p };
                         }
                         return w;
                     })
                 }, false);
            }
            
            if (dragState.type === 'move_selection' && dragState.activeId) {
                 onUpdate({
                     ...data,
                     symbols: data.symbols.map(s => s.id === dragState.activeId ? { ...s, position: add(dragState.initialPos!, sub(worldPos, screenToWorld(dragState.startPos.x, dragState.startPos.y))) } : s)
                 }, false);
            }

            if (dragState.type === 'resize_symbol' && dragState.activeId && dragState.initialSize) {
                const dx = worldPos.x - dragState.startPos.x;
                const dy = worldPos.y - dragState.startPos.y;
                let { w, h } = dragState.initialSize;

                if (dragState.handle === 'tl') { w -= dx; h -= dy; }
                else if (dragState.handle === 'tr') { w += dx; h -= dy; }
                else if (dragState.handle === 'bl') { w -= dx; h += dy; }
                else if (dragState.handle === 'br') { w += dx; h += dy; }

                if (e.ctrlKey) {
                    const ratio = dragState.initialSize.w / dragState.initialSize.h;
                    h = w / ratio;
                }

                if (w < 10) w = 10;
                if (h < 10) h = 10;

                onUpdate({ ...data, symbols: data.symbols.map(s => s.id === dragState.activeId ? { ...s, width: w, height: h } : s)}, false);
            }

            if (dragState.type === 'resize_opening' && dragState.activeId && dragState.initialSize) {
                const dx = worldPos.x - dragState.startPos.x;
                let { w } = dragState.initialSize;

                if (dragState.handle === 'start') w -= dx;
                else if (dragState.handle === 'end') w += dx;

                if (w < 20) w = 20;

                onUpdate({ ...data, openings: data.openings.map(o => o.id === dragState.activeId ? { ...o, width: w } : o)}, false);
            }

            if (dragState.type === 'move_group' && dragState.activeId && dragState.snapshots) {
                const dx = worldPos.x - dragState.startPos.x;
                const dy = worldPos.y - dragState.startPos.y;

                // Move all group objects together
                const groupId = dragState.activeId;

                let updatedData = { ...data };

                // Move walls in the group
                updatedData.walls = updatedData.walls.map(w => {
                    const snapshot = dragState.snapshots!.walls.find(s => s.id === w.id);
                    if (snapshot && w.groupId === groupId) {
                        return {
                            ...w,
                            start: { x: snapshot.start.x + dx, y: snapshot.start.y + dy },
                            end: { x: snapshot.end.x + dx, y: snapshot.end.y + dy }
                        };
                    }
                    return w;
                });

                // Move labels in the group
                updatedData.labels = updatedData.labels.map(l => {
                    const snapshot = dragState.snapshots!.labels.find(s => s.id === l.id);
                    if (snapshot && l.groupId === groupId) {
                        return {
                            ...l,
                            position: { x: snapshot.position.x + dx, y: snapshot.position.y + dy }
                        };
                    }
                    return l;
                });

                // Move symbols in the group
                updatedData.symbols = updatedData.symbols.map(s => {
                    const snapshot = dragState.snapshots!.symbols?.find(sn => sn.id === s.id);
                    if (snapshot && s.groupId === groupId) {
                        return {
                            ...s,
                            position: { x: snapshot.position.x + dx, y: snapshot.position.y + dy }
                        };
                    }
                    return s;
                });

                // Update openings attached to walls in the group
                updatedData.openings = updatedData.openings.map(o => {
                    const snapshot = dragState.snapshots!.openings.find(s => s.id === o.id);
                    if (snapshot && data.walls.find(w => w.id === o.wallId)?.groupId === groupId) {
                        // Openings move with their walls, so their t-value stays the same
                        return o;
                    }
                    return o;
                });

                onUpdate(updatedData, false);
            }
        } else {
            if (tool === ToolType.WALL) {
                const snap = getSnapPoint(worldPos, zoom, data.walls, data.openings);
                setSnapGuides(snap.guides);
            } else {
                setSnapGuides([]);
            }
        }
    };

    const handleMouseUp = () => {
        if (dragState && dragState.type === 'new_room' && dragState.startPos && dragState.endPos) {
            // Create the room walls
            const roomId = crypto.randomUUID();
            const width = Math.abs(dragState.endPos.x - dragState.startPos.x);
            const height = Math.abs(dragState.endPos.y - dragState.startPos.y);
            const minX = Math.min(dragState.startPos.x, dragState.endPos.x);
            const minY = Math.min(dragState.startPos.y, dragState.endPos.y);

            if (width > 50 && height > 50) { // Minimum room size
                const walls: Wall[] = [
                    {
                        id: crypto.randomUUID(),
                        start: { x: minX, y: minY },
                        end: { x: minX + width, y: minY },
                        thickness: activeWallThickness || 22,
                        height: 2700,
                        groupId: roomId
                    },
                    {
                        id: crypto.randomUUID(),
                        start: { x: minX + width, y: minY },
                        end: { x: minX + width, y: minY + height },
                        thickness: activeWallThickness || 22,
                        height: 2700,
                        groupId: roomId
                    },
                    {
                        id: crypto.randomUUID(),
                        start: { x: minX + width, y: minY + height },
                        end: { x: minX, y: minY + height },
                        thickness: activeWallThickness || 22,
                        height: 2700,
                        groupId: roomId
                    },
                    {
                        id: crypto.randomUUID(),
                        start: { x: minX, y: minY + height },
                        end: { x: minX, y: minY },
                        thickness: activeWallThickness || 22,
                        height: 2700,
                        groupId: roomId
                    }
                ];

                onUpdate({
                    ...data,
                    walls: [...data.walls, ...walls]
                }, true);

                // Select the group (the room) by selecting one wall (they share groupId)
                setSelectedId(walls[0].id);
            }
        }

        setDragState(null);
        setSnapGuides([]);
    };

    const handleWheel = (e: React.WheelEvent) => {
        const scaleBy = 1.1;
        const oldZoom = zoom;
        const newZoom = e.deltaY < 0 ? oldZoom * scaleBy : oldZoom / scaleBy;
        
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const worldMouseX = (mouseX - pan.x) / oldZoom;
            const worldMouseY = (mouseY - pan.y) / oldZoom;
            const newPanX = mouseX - worldMouseX * newZoom;
            const newPanY = mouseY - worldMouseY * newZoom;
            
            setZoom(newZoom);
            setPan({ x: newPanX, y: newPanY });
        }
    };

    return {
        zoom, setZoom,
        pan, setPan,
        dragState,
        snapGuides,
        mousePos,
        contextMenu, setContextMenu,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleWheel,
        handleContextMenu
    };
};
