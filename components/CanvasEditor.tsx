
import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { PlanData, ToolType, Point, Wall, Opening, RoomLabel, Dimension, LayerConfig, Stair, StairType, SymbolInstance } from '../types';
import { X, Settings2, Scissors, Lock, Unlock, RotateCw, FlipHorizontal, Group, Ungroup, Trash2, Maximize2, Move } from 'lucide-react';
import { dist, sub, add, scale, norm, dot } from '../utils/geometry';
import { getSnapPoint, SnapGuide, GRID_SIZE } from '../utils/snapping';
import { WallEntity, OpeningEntity, StairEntity, DimensionEntity, LabelEntity, NorthArrowEntity, SymbolEntity, SYMBOL_CATALOG } from './CanvasEntities';

interface CanvasEditorProps {
  data: PlanData;
  tool: ToolType;
  viewMode: any;
  layers: LayerConfig;
  onUpdate: (newData: PlanData) => void;
  onToolChange: (tool: ToolType) => void;
  activeSymbolId: string;
  activeWallThickness: number;
  activeDoorType: string;
  activeWindowType: string;
}

interface EditInputState {
  x: number;
  y: number;
  value: string | number;
  onSave: (val: string) => void;
}

interface DragState {
    type: 'wall_endpoint' | 'wall_curve' | 'opening' | 'move_selection' | 'stair' | 'north_arrow' | 'north_arrow_rotate' | 'symbol_rotate';
    activeId?: string; 
    endpointType?: 'start' | 'end';
    startPos: Point;
    initialPos?: Point; // Generic fallback
    initialRotation?: number; // For rotation logic
    snapshots: {
        walls: { id: string, start: Point, end: Point }[];
        labels: { id: string, position: Point }[];
        stairs: { id: string, position: Point }[];
        dimensions: { id: string, start: Point, end: Point }[];
        openings: { id: string, t: number, wallId: string }[]; 
        symbols: { id: string, position: Point }[];
    };
}

interface ContextMenuState {
    x: number;
    y: number;
    targetId: string;
    targetType: 'wall' | 'opening' | 'symbol' | 'stair' | 'other';
    worldPos: Point;
}

const BufferedInput = ({ 
    value, 
    onChange, 
    type = "text", 
    className = "",
    disabled = false
}: { 
    value: string | number, 
    onChange: (val: string) => void, 
    type?: string, 
    className?: string,
    disabled?: boolean
}) => {
    const [localValue, setLocalValue] = useState(value);
    useEffect(() => { setLocalValue(value); }, [value]);
    return (
        <input 
            type={type}
            className={`${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            value={localValue}
            disabled={disabled}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => onChange(localValue.toString())}
            onKeyDown={(e) => { if (e.key === 'Enter') { onChange(localValue.toString()); (e.target as HTMLInputElement).blur(); } }}
        />
    );
};

export const CanvasEditor = forwardRef<any, CanvasEditorProps>(({ data, tool, viewMode, layers, onUpdate, onToolChange, activeSymbolId, activeWallThickness, activeDoorType, activeWindowType }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawingStart, setDrawingStart] = useState<Point | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);
  
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [editInput, setEditInput] = useState<EditInputState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [snapMarker, setSnapMarker] = useState<Point | null>(null);

  const [isSpacePressed, setIsSpacePressed] = useState(false);

  useImperativeHandle(ref, () => ({
    exportSvg: () => {
      if (!svgRef.current) return null;
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      return URL.createObjectURL(blob);
    }
  }));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') setIsSpacePressed(true); };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setIsSpacePressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const toWorld = (clientX: number, clientY: number): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    };
  };

  const worldToScreen = (p: Point): Point => {
     if (!svgRef.current) return { x: 0, y: 0 };
     const rect = svgRef.current.getBoundingClientRect();
     return {
         x: p.x * zoom + pan.x + rect.left,
         y: p.y * zoom + pan.y + rect.top
     };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (contextMenu) setContextMenu(null);

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const shiftKey = 'shiftKey' in e ? e.shiftKey : false;
    
    const isTwoFinger = 'touches' in e && e.touches.length === 2;
    const isMiddleMouse = !('touches' in e) && (e as React.MouseEvent).button === 1;

    const isPanTool = tool === ToolType.PAN;
    const isSpacePan = isSpacePressed;

    if (isPanTool || isSpacePan || isMiddleMouse || isTwoFinger) {
      setIsPanning(true);
      setLastPanPoint({ x: clientX, y: clientY });
      return;
    }

    const worldPos = toWorld(clientX, clientY);
    const snapRes = getSnapPoint(worldPos, zoom, data.walls);
    const anchorPos = snapRes.point;

    if (tool === ToolType.CALIBRATE) {
        const newPoints = [...calibrationPoints, snapRes.point];
        setCalibrationPoints(newPoints);
        if (newPoints.length === 2) {
            setTimeout(() => {
                const currentDist = dist(newPoints[0], newPoints[1]);
                const actualDistStr = window.prompt(`Current distance is ${Math.round(currentDist*10)}mm. Enter actual distance in mm:`, Math.round(currentDist*10).toString());
                if (actualDistStr) {
                    const actualDist = parseFloat(actualDistStr);
                    if (!isNaN(actualDist) && actualDist > 0 && currentDist > 0) {
                        const ratio = (actualDist / 10) / currentDist;
                        const scalePoint = (p: Point) => ({ x: p.x * ratio, y: p.y * ratio });
                        const newWalls = data.walls.map(w => ({ ...w, start: scalePoint(w.start), end: scalePoint(w.end), thickness: w.thickness }));
                        const newLabels = data.labels.map(l => ({ ...l, position: scalePoint(l.position) }));
                        const newDims = data.dimensions.map(d => ({ ...d, start: scalePoint(d.start), end: scalePoint(d.end) }));
                        const newStairs = data.stairs.map(s => ({ ...s, position: scalePoint(s.position), width: s.width * ratio, treadDepth: s.treadDepth * ratio }));
                        const newSymbols = data.symbols.map(s => ({ ...s, position: scalePoint(s.position) }));
                        onUpdate({ ...data, walls: newWalls, labels: newLabels, dimensions: newDims, stairs: newStairs, symbols: newSymbols });
                    }
                }
                setCalibrationPoints([]);
            }, 100);
        }
        return;
    }

    if (tool === ToolType.SELECT) {
        // 1. Check North Arrow Logic (Rotation)
        if (selection.has("NORTH_ARROW") && data.northArrow) {
             const angleRad = data.northArrow.rotation * Math.PI / 180;
             const handleX = data.northArrow.position.x + 0 * Math.cos(angleRad) - (-35) * Math.sin(angleRad);
             const handleY = data.northArrow.position.y + 0 * Math.sin(angleRad) + (-35) * Math.cos(angleRad);
             if (dist(worldPos, { x: handleX, y: handleY }) < 10 / zoom) {
                 setDragState({ 
                     type: 'north_arrow_rotate', 
                     startPos: worldPos, 
                     initialRotation: data.northArrow.rotation,
                     snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [], symbols: [] }
                 });
                 return;
             }
        }
        // 2. Check North Arrow Logic (Move)
        if (data.northArrow && dist(worldPos, data.northArrow.position) < 20 / zoom) {
             setSelection(new Set(["NORTH_ARROW"]));
             setDragState({
                 type: 'north_arrow',
                 startPos: worldPos,
                 initialPos: data.northArrow.position,
                 snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [], symbols: [] }
             });
             return;
        }

        // 3. Check Symbol Logic (Rotation)
        if (selection.size === 1) {
             const selId = Array.from(selection)[0];
             const symbol = data.symbols.find(s => s.id === selId);
             if (symbol && !symbol.locked) {
                 const def = SYMBOL_CATALOG.find(d => d.id === symbol.type);
                 if (def) {
                     const h = def.height * 0.1 * symbol.scale;
                     const angleRad = symbol.rotation * Math.PI / 180;
                     // Handle is at (0, -h/2 - 20) local
                     const handleLocal = { x: 0, y: -h/2 - 20 };
                     // Rotate handle local
                     const handleWorldX = symbol.position.x + handleLocal.x * Math.cos(angleRad) - handleLocal.y * Math.sin(angleRad);
                     const handleWorldY = symbol.position.y + handleLocal.x * Math.sin(angleRad) + handleLocal.y * Math.cos(angleRad);

                     if (dist(worldPos, { x: handleWorldX, y: handleWorldY }) < 10 / zoom) {
                         setDragState({
                             type: 'symbol_rotate',
                             activeId: symbol.id,
                             startPos: worldPos,
                             initialRotation: symbol.rotation,
                             snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [], symbols: [] }
                         });
                         return;
                     }
                 }
             }
        }

        const updateSelection = (id: string, groupId?: string) => {
            let newSelection = new Set(shiftKey ? selection : []);
            const idsToToggle = [id];
            if (groupId) {
                data.walls.filter(w => w.groupId === groupId).forEach(w => idsToToggle.push(w.id));
                data.labels.filter(l => l.groupId === groupId).forEach(l => idsToToggle.push(l.id));
                data.stairs.filter(s => s.id === groupId).forEach(s => idsToToggle.push(s.id));
                data.symbols.filter(s => s.groupId === groupId).forEach(s => idsToToggle.push(s.id));
            }
            const primaryIsSelected = selection.has(id);
            idsToToggle.forEach(targetId => {
                if (shiftKey && primaryIsSelected) {
                    newSelection.delete(targetId);
                } else {
                    newSelection.add(targetId);
                }
            });
            setSelection(newSelection);
            return newSelection;
        };

        if (layers.showWalls && selection.size === 1) {
            const id = Array.from(selection)[0];
            if (id !== "NORTH_ARROW") {
                const wall = data.walls.find(w => w.id === id);
                if (wall && !wall.locked) {
                    if (dist(worldPos, wall.start) < 10 / zoom) {
                        setDragState({ type: 'wall_endpoint', activeId: id, endpointType: 'start', startPos: anchorPos, snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [], symbols: [] } });
                        return;
                    }
                    if (dist(worldPos, wall.end) < 10 / zoom) {
                        setDragState({ type: 'wall_endpoint', activeId: id, endpointType: 'end', startPos: anchorPos, snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [], symbols: [] } });
                        return;
                    }
                    const mid = scale(add(wall.start, wall.end), 0.5);
                    const dir = norm(sub(wall.end, wall.start));
                    const normal = { x: -dir.y, y: dir.x };
                    const curveControl = add(mid, scale(normal, wall.curvature || 0));
                    if (dist(worldPos, curveControl) < 10 / zoom) {
                        setDragState({ type: 'wall_curve', activeId: id, startPos: worldPos, snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [], symbols: [] } });
                        return;
                    }
                }
            }
        }

        let hitObj: { id: string, groupId?: string } | null = null;

        if (layers.showLabels && !hitObj) {
            const lbl = data.labels.find(l => dist(l.position, worldPos) < 200 / 10);
            if (lbl) hitObj = lbl;
        }
        if (layers.showStairs && !hitObj) {
            const stair = data.stairs.find(s => dist(s.position, worldPos) < Math.max(s.width, 100));
            if (stair) hitObj = stair;
        }
        if (layers.showSymbols && !hitObj) {
             const symbol = data.symbols.find(s => {
                 const def = SYMBOL_CATALOG.find(def => def.id === s.type);
                 const rad = def ? Math.max(def.width, def.height) * 0.1 * s.scale / 2 : 50;
                 return dist(s.position, worldPos) < rad;
             });
             if (symbol) hitObj = symbol;
        }
        if (layers.showWalls && !hitObj) {
            const wall = data.walls.find(w => {
                const l2 = dist(w.start, w.end)**2;
                if (l2 === 0) return false;
                let t = dot(sub(worldPos, w.start), sub(w.end, w.start)) / l2;
                t = Math.max(0, Math.min(1, t));
                const proj = add(w.start, scale(sub(w.end, w.start), t));
                return dist(worldPos, proj) < (w.thickness/2 + 100) / 10;
            });
            if (wall) hitObj = wall;
        }
        if (layers.showDimensions && !hitObj) {
             const dim = data.dimensions.find(d => {
                const center = scale(add(d.start, d.end), 0.5);
                return dist(center, worldPos) < 200/10;
            });
            if (dim) hitObj = dim;
        }
        if (layers.showOpenings && !hitObj) {
             for (const op of data.openings) {
                const wall = data.walls.find(w => w.id === op.wallId);
                if (!wall) continue;
                const opPos = add(wall.start, scale(sub(wall.end, wall.start), op.t));
                if (dist(worldPos, opPos) < Math.max(op.width/2, 200)/10 ) {
                     if (selection.has(op.id) && !op.locked) {
                         setDragState({ type: 'opening', activeId: op.id, startPos: worldPos, snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [], symbols: [] } });
                         return;
                     }
                     setSelection(new Set([op.id]));
                     if (!op.locked) {
                         setDragState({ type: 'opening', activeId: op.id, startPos: worldPos, snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [], symbols: [] } });
                     }
                     return;
                }
            }
        }

        if (hitObj) {
            const currentSelection = updateSelection(hitObj.id, hitObj.groupId);
            const snapshot = {
                walls: data.walls.filter(w => currentSelection.has(w.id)).map(w => ({ id: w.id, start: w.start, end: w.end })),
                labels: data.labels.filter(l => currentSelection.has(l.id)).map(l => ({ id: l.id, position: l.position })),
                stairs: data.stairs.filter(s => currentSelection.has(s.id)).map(s => ({ id: s.id, position: s.position })),
                dimensions: data.dimensions.filter(d => currentSelection.has(d.id)).map(d => ({ id: d.id, start: d.start, end: d.end })),
                symbols: data.symbols.filter(s => currentSelection.has(s.id)).map(s => ({ id: s.id, position: s.position })),
                openings: [], 
            };

            if (snapshot.walls.length > 0 || snapshot.labels.length > 0 || snapshot.stairs.length > 0 || snapshot.symbols.length > 0) {
                 setDragState({
                     type: 'move_selection',
                     startPos: anchorPos, 
                     snapshots: snapshot
                 });
            }
        } else {
            if (!shiftKey && !selection.has("NORTH_ARROW")) setSelection(new Set());
        }

    } else {
        const snappedPos = snapRes.point;

        if (tool === ToolType.WALL || tool === ToolType.ARCH_WALL || tool === ToolType.DIMENSION || tool === ToolType.SQUARE_ROOM) {
            setDrawingStart(snappedPos);
            setCurrentMousePos(snappedPos);
        } else if (tool === ToolType.ROOM_LABEL) {
            const newLabel: RoomLabel = {
                id: crypto.randomUUID(),
                position: snappedPos,
                text: "ROOM",
                area: 0
            };
            onUpdate({ ...data, labels: [...data.labels, newLabel] });
            setSelection(new Set([newLabel.id]));
            onToolChange(ToolType.SELECT);
        } else if (tool === ToolType.STAIR) {
            const newStair: Stair = {
                id: crypto.randomUUID(),
                position: snappedPos,
                width: 100,
                treadDepth: 25,
                riserHeight: 170, 
                count: 14,
                flight1Count: 7,
                rotation: 0,
                type: StairType.STRAIGHT
            };
            onUpdate({ ...data, stairs: [...data.stairs, newStair] });
            setSelection(new Set([newStair.id]));
            onToolChange(ToolType.SELECT);
        } else if (tool === ToolType.SYMBOL) {
            const newSymbol: SymbolInstance = {
                id: crypto.randomUUID(),
                type: activeSymbolId, 
                position: snappedPos,
                rotation: 0,
                scale: 1
            };
            onUpdate({ ...data, symbols: [...data.symbols, newSymbol] });
            setSelection(new Set([newSymbol.id]));
            onToolChange(ToolType.SELECT);
        } else if (tool === ToolType.DOOR || tool === ToolType.WINDOW) {
            let nearestWall: Wall | null = null;
            let minDist = Infinity;
            let tVal = 0;

            data.walls.forEach(wall => {
                const l2 = dist(wall.start, wall.end)**2;
                if (l2 === 0) return;
                let t = dot(sub(snappedPos, wall.start), sub(wall.end, wall.start)) / l2;
                t = Math.max(0, Math.min(1, t));
                const proj = add(wall.start, scale(sub(wall.end, wall.start), t));
                const d = dist(snappedPos, proj);
                if (d < minDist && d < 500) {
                    minDist = d;
                    nearestWall = wall;
                    tVal = t;
                }
            });

            if (nearestWall) {
                const isDoor = tool === ToolType.DOOR;
                const typePrefix = isDoor ? 'D' : 'W';
                const existingOpenings = data.openings.filter(o => o.type === (isDoor ? 'door' : 'window'));
                let maxNum = 0;
                existingOpenings.forEach(o => {
                    if (o.label && o.label.startsWith(typePrefix)) {
                        const num = parseInt(o.label.substring(1));
                        if (!isNaN(num)) maxNum = Math.max(maxNum, num);
                    }
                });
                
                // Determine width and subtype based on active tool settings
                let width = isDoor ? 813 : 1500;
                if (isDoor) {
                    if (activeDoorType === 'double') width = 1613;
                    else if (activeDoorType === 'sliding') width = 1800;
                } else {
                    if (activeWindowType === 'sliding') width = 1800;
                }

                const newOpening: Opening = {
                    id: crypto.randomUUID(),
                    wallId: (nearestWall as Wall).id,
                    t: tVal,
                    width: width,
                    height: isDoor ? 2100 : 1200,
                    sillHeight: isDoor ? 0 : 900,
                    type: isDoor ? 'door' : 'window',
                    subType: isDoor ? activeDoorType : activeWindowType,
                    label: `${typePrefix}${maxNum + 1}`,
                    flipX: false,
                    flipY: false
                };
                onUpdate({ ...data, openings: [...data.openings, newOpening] });
                setSelection(new Set([newOpening.id]));
                onToolChange(ToolType.SELECT);
            }
        }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      const worldPos = toWorld(e.clientX, e.clientY);
      let targetId = '';
      let targetType: ContextMenuState['targetType'] = 'other';
      
      // Hit Test Order: Opening -> Symbol -> Stair -> Wall
      
      if (!targetId) {
          for (const op of data.openings) {
            const wall = data.walls.find(w => w.id === op.wallId);
            if (!wall) continue;
            const opPos = add(wall.start, scale(sub(wall.end, wall.start), op.t));
            if (dist(worldPos, opPos) < Math.max(op.width/2, 200)/10 ) {
                targetId = op.id;
                targetType = 'opening';
                break;
            }
          }
      }

      if (!targetId) {
          const symbol = data.symbols.find(s => {
             const def = SYMBOL_CATALOG.find(def => def.id === s.type);
             const rad = def ? Math.max(def.width, def.height) * 0.1 * s.scale / 2 : 50;
             return dist(s.position, worldPos) < rad;
          });
          if (symbol) { targetId = symbol.id; targetType = 'symbol'; }
      }

      if (!targetId) {
          const stair = data.stairs.find(s => dist(s.position, worldPos) < Math.max(s.width, 100));
          if (stair) { targetId = stair.id; targetType = 'stair'; }
      }

      if (!targetId) {
          const hitWall = data.walls.find(w => {
              const l2 = dist(w.start, w.end)**2;
              if (l2 === 0) return false;
              let t = dot(sub(worldPos, w.start), sub(w.end, w.start)) / l2;
              t = Math.max(0, Math.min(1, t));
              const proj = add(w.start, scale(sub(w.end, w.start), t));
              return dist(worldPos, proj) < (w.thickness/2 + 100) / 10;
          });
          if (hitWall) { targetId = hitWall.id; targetType = 'wall'; }
      }

      if (targetId) {
          setSelection(new Set([targetId]));
          setContextMenu({ x: e.clientX, y: e.clientY, targetId, targetType, worldPos });
      }
  };

  const handleContextAction = (action: 'split' | 'delete' | 'flipX' | 'flipY' | 'rotateCW') => {
      if (!contextMenu) return;
      const { targetId, targetType, worldPos } = contextMenu;

      if (action === 'delete') {
          deleteSelected();
          setContextMenu(null);
          return;
      }

      if (targetType === 'wall' && action === 'split') {
        const wall = data.walls.find(w => w.id === targetId);
        if (!wall || wall.locked) return; 

        const l2 = dist(wall.start, wall.end)**2;
        let t = dot(sub(worldPos, wall.start), sub(wall.end, wall.start)) / l2;
        t = Math.max(0.01, Math.min(0.99, t)); 

        const splitPoint = add(wall.start, scale(sub(wall.end, wall.start), t));
        const id1 = crypto.randomUUID();
        const id2 = crypto.randomUUID();

        const wall1: Wall = { ...wall, id: id1, end: splitPoint };
        const wall2: Wall = { ...wall, id: id2, start: splitPoint };

        const newOpenings = data.openings.map(op => {
            if (op.wallId !== wall.id) return op;
            if (op.t < t) { return { ...op, wallId: id1, t: op.t / t }; } 
            else { return { ...op, wallId: id2, t: (op.t - t) / (1 - t) }; }
        });

        const newWalls = data.walls.filter(w => w.id !== wall.id).concat([wall1, wall2]);
        onUpdate({ ...data, walls: newWalls, openings: newOpenings });
      } 
      else if (targetType === 'opening') {
          if (action === 'flipX') {
              const newOps = data.openings.map(o => o.id === targetId ? { ...o, flipX: !o.flipX } : o);
              onUpdate({ ...data, openings: newOps });
          } else if (action === 'flipY') {
              const newOps = data.openings.map(o => o.id === targetId ? { ...o, flipY: !o.flipY } : o);
              onUpdate({ ...data, openings: newOps });
          }
      }
      else if (targetType === 'symbol' || targetType === 'stair') {
           if (action === 'rotateCW') {
               const newSymbols = data.symbols.map(s => s.id === targetId ? { ...s, rotation: (s.rotation + 45) % 360 } : s);
               const newStairs = data.stairs.map(s => s.id === targetId ? { ...s, rotation: (s.rotation + 45) % 360 } : s);
               onUpdate({ ...data, symbols: newSymbols, stairs: newStairs });
           }
      }

      setContextMenu(null);
  };

  const handleGroupSelection = () => {
      if (selection.size < 2) return;
      const newGroupId = crypto.randomUUID();
      
      const newWalls = data.walls.map(w => selection.has(w.id) ? { ...w, groupId: newGroupId } : w);
      const newLabels = data.labels.map(l => selection.has(l.id) ? { ...l, groupId: newGroupId } : l);
      const newSymbols = data.symbols.map(s => selection.has(s.id) ? { ...s, groupId: newGroupId } : s);
      
      onUpdate({ ...data, walls: newWalls, labels: newLabels, symbols: newSymbols });
  };

  const handleUngroupSelection = () => {
      const newWalls = data.walls.map(w => selection.has(w.id) ? { ...w, groupId: undefined } : w);
      const newLabels = data.labels.map(l => selection.has(l.id) ? { ...l, groupId: undefined } : l);
      const newSymbols = data.symbols.map(s => selection.has(s.id) ? { ...s, groupId: undefined } : s);
      onUpdate({ ...data, walls: newWalls, labels: newLabels, symbols: newSymbols });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    if (isPanning && lastPanPoint) {
      setPan({ x: pan.x + (clientX - lastPanPoint.x), y: pan.y + (clientY - lastPanPoint.y) });
      setLastPanPoint({ x: clientX, y: clientY });
      return;
    }

    const worldPos = toWorld(clientX, clientY);

    if (dragState) {
        if (dragState.type === 'move_selection') {
            const snapRes = getSnapPoint(worldPos, zoom, data.walls, null, dragState.snapshots.walls.map(w => w.id));
            const currentSnapped = snapRes.point;
            setSnapGuides(snapRes.guides);
            setSnapMarker(snapRes.snapped ? currentSnapped : null);

            const dx = currentSnapped.x - dragState.startPos.x;
            const dy = currentSnapped.y - dragState.startPos.y;
            
            const updatedWalls = data.walls.map(w => {
                const snap = dragState.snapshots.walls.find(s => s.id === w.id);
                if (snap) return { ...w, start: { x: snap.start.x + dx, y: snap.start.y + dy }, end: { x: snap.end.x + dx, y: snap.end.y + dy } };
                return w;
            });
            const updatedLabels = data.labels.map(l => {
                const snap = dragState.snapshots.labels.find(s => s.id === l.id);
                if (snap) return { ...l, position: { x: snap.position.x + dx, y: snap.position.y + dy } };
                return l;
            });
            const updatedStairs = data.stairs.map(s => {
                const snap = dragState.snapshots.stairs.find(s => s.id === s.id);
                if (snap) return { ...s, position: { x: snap.position.x + dx, y: snap.position.y + dy } };
                return s;
            });
             const updatedDims = data.dimensions.map(d => {
                const snap = dragState.snapshots.dimensions.find(s => s.id === d.id);
                if (snap) return { ...d, start: { x: snap.start.x + dx, y: snap.start.y + dy }, end: { x: snap.end.x + dx, y: snap.end.y + dy } };
                return d;
            });
             const updatedSymbols = data.symbols.map(s => {
                 const snap = dragState.snapshots.symbols.find(sn => sn.id === s.id);
                 if (snap) return { ...s, position: { x: snap.position.x + dx, y: snap.position.y + dy } };
                 return s;
             });

            onUpdate({ ...data, walls: updatedWalls, labels: updatedLabels, stairs: updatedStairs, dimensions: updatedDims, symbols: updatedSymbols });
        } 
        else if (dragState.type === 'north_arrow' && dragState.initialPos) {
            const dx = worldPos.x - dragState.startPos.x;
            const dy = worldPos.y - dragState.startPos.y;
            onUpdate({
                ...data,
                northArrow: {
                    ...data.northArrow,
                    position: { x: dragState.initialPos.x + dx, y: dragState.initialPos.y + dy }
                }
            });
        }
        else if (dragState.type === 'north_arrow_rotate' && dragState.initialRotation !== undefined) {
             const center = data.northArrow.position;
             const vec = sub(worldPos, center);
             const angleDeg = Math.atan2(vec.y, vec.x) * 180 / Math.PI + 90; 
             onUpdate({
                 ...data,
                 northArrow: {
                     ...data.northArrow,
                     rotation: angleDeg
                 }
             });
        }
        else if (dragState.type === 'symbol_rotate' && dragState.activeId && dragState.initialRotation !== undefined) {
            const symbol = data.symbols.find(s => s.id === dragState.activeId);
            if (symbol) {
                const vec = sub(worldPos, symbol.position);
                const angleDeg = Math.atan2(vec.y, vec.x) * 180 / Math.PI + 90;
                 onUpdate({ ...data, symbols: data.symbols.map(s => s.id === symbol.id ? { ...s, rotation: angleDeg } : s) });
            }
        }
        else if (dragState.type === 'wall_endpoint' && dragState.activeId && dragState.endpointType) {
            const wall = data.walls.find(w => w.id === dragState.activeId);
            if (wall && !wall.locked) {
                const otherEnd = dragState.endpointType === 'start' ? wall.end : wall.start;
                const snapRes = getSnapPoint(worldPos, zoom, data.walls, otherEnd, [wall.id]);
                setSnapGuides(snapRes.guides);
                setSnapMarker(snapRes.snapped ? snapRes.point : null);
                
                const newWall = { ...wall };
                if (dragState.endpointType === 'start') newWall.start = snapRes.point;
                else newWall.end = snapRes.point;

                const newWalls = data.walls.map(w => w.id === wall.id ? newWall : w);
                onUpdate({ ...data, walls: newWalls });
            }
        }
        else if (dragState.type === 'wall_curve' && dragState.activeId) {
            const wall = data.walls.find(w => w.id === dragState.activeId);
            if (wall && !wall.locked) {
                const mid = scale(add(wall.start, wall.end), 0.5);
                const dir = norm(sub(wall.end, wall.start));
                const normal = { x: -dir.y, y: dir.x };
                const vecToMouse = sub(worldPos, mid);
                const distAlongNormal = dot(vecToMouse, normal);
                const newWalls = data.walls.map(w => w.id === wall.id ? { ...w, curvature: distAlongNormal } : w);
                onUpdate({ ...data, walls: newWalls });
            }
        } 
        else if (dragState.type === 'opening' && dragState.activeId) {
            const op = data.openings.find(o => o.id === dragState.activeId);
            const wall = data.walls.find(w => w.id === op?.wallId);
            if (op && !op.locked && wall) {
                const wallVec = sub(wall.end, wall.start);
                const wallLenSq = dot(wallVec, wallVec);
                if (wallLenSq > 0) {
                    const t = dot(sub(worldPos, wall.start), wallVec) / wallLenSq;
                    const safeMargin = (op.width / 2) / Math.sqrt(wallLenSq) / 10; 
                    const clampedT = Math.max(safeMargin, Math.min(1 - safeMargin, t));
                    const newOpenings = data.openings.map(o => o.id === op.id ? { ...o, t: clampedT } : o);
                    onUpdate({ ...data, openings: newOpenings });
                }
            }
        }
        return;
    }

    const snapOrigin = (tool === ToolType.WALL || tool === ToolType.ARCH_WALL || tool === ToolType.DIMENSION) ? drawingStart : null;
    const snapRes = getSnapPoint(worldPos, zoom, data.walls, snapOrigin);
    setCurrentMousePos(snapRes.point);
    setSnapGuides(snapRes.guides);
    setSnapMarker(snapRes.snapped ? snapRes.point : null);
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      setLastPanPoint(null);
      return;
    }

    setSnapGuides([]);
    setSnapMarker(null);

    if (dragState) {
        setDragState(null);
        return;
    }

    if (drawingStart && currentMousePos) {
      if (tool === ToolType.WALL || tool === ToolType.ARCH_WALL) {
        if (dist(drawingStart, currentMousePos) > 20) { 
          const newWall: Wall = {
            id: crypto.randomUUID(),
            start: drawingStart,
            end: currentMousePos,
            thickness: activeWallThickness,
            height: 2700,
            curvature: tool === ToolType.ARCH_WALL ? 20 : 0
          };
          onUpdate({ ...data, walls: [...data.walls, newWall] });
          setSelection(new Set([newWall.id]));
        }
      } else if (tool === ToolType.SQUARE_ROOM) {
          const minX = Math.min(drawingStart.x, currentMousePos.x);
          const maxX = Math.max(drawingStart.x, currentMousePos.x);
          const minY = Math.min(drawingStart.y, currentMousePos.y);
          const maxY = Math.max(drawingStart.y, currentMousePos.y);

          if (maxX - minX > 20 && maxY - minY > 20) {
              const groupId = crypto.randomUUID();
              const p1 = { x: minX, y: minY };
              const p2 = { x: maxX, y: minY };
              const p3 = { x: maxX, y: maxY };
              const p4 = { x: minX, y: maxY };
              
              const w1: Wall = { id: crypto.randomUUID(), start: p1, end: p2, thickness: activeWallThickness, height: 2700, groupId };
              const w2: Wall = { id: crypto.randomUUID(), start: p2, end: p3, thickness: activeWallThickness, height: 2700, groupId };
              const w3: Wall = { id: crypto.randomUUID(), start: p3, end: p4, thickness: activeWallThickness, height: 2700, groupId };
              const w4: Wall = { id: crypto.randomUUID(), start: p4, end: p1, thickness: activeWallThickness, height: 2700, groupId };

              const label: RoomLabel = {
                  id: crypto.randomUUID(),
                  text: "Room",
                  position: { x: (minX + maxX)/2, y: (minY + maxY)/2 },
                  groupId
              };
              
              onUpdate({ ...data, walls: [...data.walls, w1, w2, w3, w4], labels: [...data.labels, label] });
              const newSel = new Set([w1.id, w2.id, w3.id, w4.id, label.id]);
              setSelection(newSel);
              onToolChange(ToolType.SELECT);
          }

      } else if (tool === ToolType.DIMENSION) {
         if (dist(drawingStart, currentMousePos) > 10) {
            const newDim: Dimension = {
                id: crypto.randomUUID(),
                start: drawingStart,
                end: currentMousePos,
                offset: 30
            };
            onUpdate({ ...data, dimensions: [...data.dimensions, newDim] });
            setSelection(new Set([newDim.id]));
            onToolChange(ToolType.SELECT);
         }
      }
      setDrawingStart(null);
      setCurrentMousePos(null);
    }
  };

  const deleteSelected = () => {
    if (selection.size === 0) return;

    let newWalls = data.walls;
    let newLabels = data.labels;
    let newDims = data.dimensions;
    let newOpenings = data.openings;
    let newStairs = data.stairs;
    let newSymbols = data.symbols;

    selection.forEach(id => {
        const wall = data.walls.find(w => w.id === id);
        if (wall && wall.locked) return;
        
        newWalls = newWalls.filter(w => w.id !== id);
        newLabels = newLabels.filter(l => l.id !== id);
        newDims = newDims.filter(d => d.id !== id);
        newOpenings = newOpenings.filter(o => o.wallId !== id && o.id !== id);
        newStairs = newStairs.filter(s => s.id !== id);
        newSymbols = newSymbols.filter(s => s.id !== id);
    });

    onUpdate({ ...data, walls: newWalls, labels: newLabels, openings: newOpenings, dimensions: newDims, stairs: newStairs, symbols: newSymbols });
    setSelection(new Set());
  };

  const updateSelectedProperty = (key: string, value: any) => {
      if (selection.size !== 1) return;
      const selectedId = Array.from(selection)[0];

      if (selectedId === "NORTH_ARROW") {
          onUpdate({...data, northArrow: { ...data.northArrow, [key]: value }});
          return;
      }

      const wall = data.walls.find(w => w.id === selectedId);
      if (wall) {
          if (wall.locked && key !== 'locked') return;
          
          let finalValue = value;
          // Validate thickness updates to ensure valid numbers
          if (key === 'thickness') {
              const num = parseFloat(value);
              if (isNaN(num) || num <= 0) return;
              finalValue = num;
          }

          onUpdate({...data, walls: data.walls.map(w => w.id === selectedId ? { ...w, [key]: finalValue } : w)});
          return;
      }
      const op = data.openings.find(o => o.id === selectedId);
      if (op) {
          if (op.locked && key !== 'locked') return;
          onUpdate({...data, openings: data.openings.map(o => o.id === selectedId ? { ...o, [key]: value } : o)});
          return;
      }
      const lbl = data.labels.find(l => l.id === selectedId);
      if (lbl) {
          if (lbl.locked && key !== 'locked') return;
          onUpdate({...data, labels: data.labels.map(l => l.id === selectedId ? { ...l, [key]: value } : l)});
          return;
      }
      const dim = data.dimensions.find(d => d.id === selectedId);
      if (dim) {
          if (dim.locked && key !== 'locked') return;
          onUpdate({...data, dimensions: data.dimensions.map(d => d.id === selectedId ? { ...d, [key]: value } : d)});
          return;
      }
      const stair = data.stairs.find(s => s.id === selectedId);
      if (stair) {
          if (stair.locked && key !== 'locked') return;
          onUpdate({...data, stairs: data.stairs.map(s => s.id === selectedId ? { ...s, [key]: value } : s)});
          return;
      }
      const symbol = data.symbols.find(s => s.id === selectedId);
      if (symbol) {
           if (symbol.locked && key !== 'locked') return;
           onUpdate({...data, symbols: data.symbols.map(s => s.id === selectedId ? { ...s, [key]: value } : s)});
           return;
      }
  };

  const getSelectedObject = () => {
      if (selection.size !== 1) return null;
      const selectedId = Array.from(selection)[0];
      if (selectedId === "NORTH_ARROW") return data.northArrow;
      return data.walls.find(w => w.id === selectedId) || 
             data.openings.find(o => o.id === selectedId) ||
             data.labels.find(l => l.id === selectedId) ||
             data.dimensions.find(d => d.id === selectedId) ||
             data.stairs.find(s => s.id === selectedId) ||
             data.symbols.find(s => s.id === selectedId);
  };

  const isSelected = (id: string) => selection.has(id);
  const selectionSummary = () => {
      if (selection.size === 0) return null;
      if (selection.size > 1) return "multiple";
      return getSelectedObject();
  };

  const summary = selectionSummary();
  const isMultiple = summary === "multiple";
  const singleObj = isMultiple ? null : summary as any;
  const canGroup = selection.size > 1;
  const canUngroup = Array.from(selection).some(id => {
      const w = data.walls.find(x => x.id === id);
      if (w && w.groupId) return true;
      const l = data.labels.find(x => x.id === id);
      if (l && l.groupId) return true;
      const s = data.symbols.find(x => x.id === id);
      if (s && s.groupId) return true;
      return false;
  });

  // Calculate Square Room Area for Display
  const getRectArea = () => {
      if (tool !== ToolType.SQUARE_ROOM || !drawingStart || !currentMousePos) return null;
      const w = Math.abs(currentMousePos.x - drawingStart.x) * 10;
      const h = Math.abs(currentMousePos.y - drawingStart.y) * 10;
      return (w * h) / 1000000;
  };

  // Quick Action Popup Logic
  const renderQuickActions = () => {
      if (selection.size !== 1 || dragState) return null;
      const selectedId = Array.from(selection)[0];
      const obj = getSelectedObject();
      if (!obj) return null;
      
      let pos = { x: 0, y: 0 };
      if ('position' in obj) { pos = worldToScreen(obj.position); }
      else if ('start' in obj && 'end' in obj) { pos = worldToScreen({ x: (obj.start.x+obj.end.x)/2, y: (obj.start.y+obj.end.y)/2 }); }
      else if ('wallId' in obj) {
          const wall = data.walls.find(w => w.id === (obj as Opening).wallId);
          if (wall) pos = worldToScreen(add(wall.start, scale(sub(wall.end, wall.start), (obj as Opening).t)));
      }

      if (!pos.x && !pos.y) return null;
      
      return (
          <div className="absolute flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 z-40 transform -translate-x-1/2 -translate-y-[60px]" style={{ left: pos.x, top: pos.y }}>
              {'type' in obj && (obj as any).type === 'door' && (
                  <>
                    <button onClick={() => updateSelectedProperty('flipX', !(obj as Opening).flipX)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300" title="Flip Hinge"><FlipHorizontal size={14} /></button>
                    <button onClick={() => updateSelectedProperty('flipY', !(obj as Opening).flipY)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300" title="Flip Swing"><RotateCw size={14} /></button>
                  </>
              )}
              {('rotation' in obj) && (
                  <button onClick={() => updateSelectedProperty('rotation', ((obj as any).rotation + 45) % 360)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300" title="Rotate +45°"><RotateCw size={14} /></button>
              )}
              <button onClick={deleteSelected} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-red-500" title="Delete"><Trash2 size={14} /></button>
          </div>
      );
  };

  const renderSmartDimensions = (wall: Wall) => {
      if (!layers.showDimensions) return null;
      if (Math.abs(wall.curvature || 0) > 1) return null; 
      // if (wall.locked) return null; // We might want to see them even if locked

      const openings = data.openings.filter(o => o.wallId === wall.id).sort((a, b) => a.t - b.t);
      if (openings.length === 0) return null;

      const wallLen = dist(wall.start, wall.end);
      if (wallLen === 0) return null;
      
      const dir = norm(sub(wall.end, wall.start));
      const normal = { x: -dir.y, y: dir.x };
      
      // Dynamic offset based on wall thickness to avoid overlap
      const offsetDist = (wall.thickness / 2) + 40; 
      const tickSize = 5;

      const points: { t: number, type: 'gap' | 'width', val: number, refOp?: Opening }[] = [];
      let prevT = 0;

      openings.forEach(op => {
          const opWidthUnits = op.width / 10;
          const halfWidthUnits = opWidthUnits / 2;
          const centerDist = op.t * wallLen;
          const startDist = centerDist - halfWidthUnits;
          const endDist = centerDist + halfWidthUnits;
          const startT = startDist / wallLen;
          const endT = endDist / wallLen;

          if (startT > prevT + 0.001) {
              points.push({ t: (prevT + startT)/2, type: 'gap', val: (startDist - (prevT * wallLen)) * 10, refOp: op });
          }
          points.push({ t: op.t, type: 'width', val: op.width, refOp: op });
          prevT = endT;
      });
      
      if (prevT < 0.999) {
           points.push({ t: (prevT + 1)/2, type: 'gap', val: (wallLen - (prevT * wallLen)) * 10, refOp: undefined }); 
      }

      const pStart = add(wall.start, scale(normal, offsetDist));
      const pEnd = add(wall.end, scale(normal, offsetDist));

      return (
          <g key={`dim-${wall.id}`} className="smart-dimensions pointer-events-none">
              <line x1={pStart.x} y1={pStart.y} x2={pEnd.x} y2={pEnd.y} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1" />
              <line x1={pStart.x - normal.x*tickSize} y1={pStart.y - normal.y*tickSize} x2={pStart.x + normal.x*tickSize} y2={pStart.y + normal.y*tickSize} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1"/>
              <line x1={pEnd.x - normal.x*tickSize} y1={pEnd.y - normal.y*tickSize} x2={pEnd.x + normal.x*tickSize} y2={pEnd.y + normal.y*tickSize} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1"/>
              
              {openings.map(op => {
                  const opWidthUnits = op.width / 10;
                  const center = add(wall.start, scale(sub(wall.end, wall.start), op.t));
                  const opStart = add(center, scale(dir, -opWidthUnits/2));
                  const opEnd = add(center, scale(dir, opWidthUnits/2));
                  const pOpStart = add(opStart, scale(normal, offsetDist));
                  const pOpEnd = add(opEnd, scale(normal, offsetDist));
                  const extStart = add(opStart, scale(normal, wall.thickness/2 + 5));
                  const extEnd = add(opEnd, scale(normal, wall.thickness/2 + 5));
                  
                  return (
                      <React.Fragment key={op.id}>
                          <line x1={pOpStart.x - normal.x*tickSize} y1={pOpStart.y - normal.y*tickSize} x2={pOpStart.x + normal.x*tickSize} y2={pOpStart.y + normal.y*tickSize} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1"/>
                          <line x1={pOpEnd.x - normal.x*tickSize} y1={pOpEnd.y - normal.y*tickSize} x2={pOpEnd.x + normal.x*tickSize} y2={pOpEnd.y + normal.y*tickSize} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1"/>
                          <line x1={extStart.x} y1={extStart.y} x2={pOpStart.x} y2={pOpStart.y} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1" strokeDasharray="2,2" />
                          <line x1={extEnd.x} y1={extEnd.y} x2={pOpEnd.x} y2={pOpEnd.y} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1" strokeDasharray="2,2" />
                      </React.Fragment>
                  )
              })}

              {points.map((pt, idx) => {
                  const pos = add(wall.start, scale(sub(wall.end, wall.start), pt.t));
                  const labelPos = add(pos, scale(normal, offsetDist + 10));
                  
                  let rotation = Math.atan2(dir.y, dir.x) * 180 / Math.PI;
                  if (rotation > 90 || rotation < -90) {
                      rotation += 180;
                  }

                  const lockedOp = pt.refOp?.locked;
                  // If it's a gap, check if adjacent openings are locked? For now, simplify: if wall is locked, all locked.
                  const isLocked = wall.locked || lockedOp;

                  return (
                    <g key={idx} className="pointer-events-auto cursor-pointer group" onClick={(e) => {
                         e.stopPropagation();
                         
                         if (isLocked) {
                             if(window.confirm("This dimension is locked. Unlock to edit?")) {
                                 if (wall.locked) onUpdate({ ...data, walls: data.walls.map(w => w.id === wall.id ? { ...w, locked: false } : w)});
                                 else if (pt.refOp) onUpdate({ ...data, openings: data.openings.map(o => o.id === pt.refOp!.id ? { ...o, locked: false } : o)});
                             }
                             return;
                         }

                         if (!pt.refOp && pt.type === 'gap') return; // Can't edit generic gaps yet without advanced solver
                         
                         const screenPos = worldToScreen(labelPos);
                         setEditInput({
                             x: screenPos.x,
                             y: screenPos.y,
                             value: Math.round(pt.val),
                             onSave: (val) => {
                                 const newVal = parseFloat(val);
                                 if (isNaN(newVal) || newVal <= 0) return;
                                 
                                 if (pt.type === 'width' && pt.refOp) {
                                     // Check limits
                                     const maxPossible = wallLen * 10;
                                     if (newVal > maxPossible) {
                                         alert(`Dimension out of range. Max width is ${Math.round(maxPossible)}mm`);
                                         return;
                                     }

                                     onUpdate({
                                         ...data, 
                                         openings: data.openings.map(o => o.id === pt.refOp!.id ? {...o, width: newVal, locked: true} : o)
                                     });
                                 } else if (pt.type === 'gap' && pt.refOp) {
                                      // Move the opening
                                      const delta = (newVal - pt.val) / 10; 
                                      const newT = Math.max(0, Math.min(1, pt.refOp.t + delta / wallLen));
                                      onUpdate({
                                          ...data, 
                                          openings: data.openings.map(o => o.id === pt.refOp!.id ? { ...o, t: newT, locked: true } : o)
                                      });
                                 }
                             }
                         });
                    }}>
                        <text x={labelPos.x} y={labelPos.y} textAnchor="middle" alignmentBaseline="middle" transform={`rotate(${rotation}, ${labelPos.x}, ${labelPos.y})`} className={`text-[10px] font-mono hover:fill-blue-600 dark:hover:fill-blue-400 select-none ${isLocked ? 'fill-red-500' : 'fill-slate-600 dark:fill-slate-400'}`} style={{fontSize: '10px'}}>
                            {Math.round(pt.val)} {isLocked ? '🔒' : ''}
                        </text>
                    </g>
                  );
              })}
          </g>
      )
  };

  return (
    <div className={`relative flex-1 bg-slate-50 dark:bg-slate-950 overflow-hidden touch-none ${tool === ToolType.PAN || isSpacePressed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'}`}>
      
      {editInput && (
          <div className="absolute z-50" style={{ left: editInput.x, top: editInput.y, transform: 'translate(-50%, -50%)' }}>
              <input autoFocus type="number" className="w-16 p-1 text-xs border border-blue-500 shadow-lg rounded text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white" defaultValue={editInput.value} onBlur={(e) => { setEditInput(null); editInput.onSave(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }} />
          </div>
      )}

      {tool === ToolType.CALIBRATE && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded shadow-lg text-sm pointer-events-none">
             {calibrationPoints.length === 0 ? "Click Point 1" : "Click Point 2"} to Calibrate
          </div>
      )}

      {renderQuickActions()}

      {contextMenu && (
          <div className="absolute z-50 bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 rounded p-1 min-w-[120px]" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseLeave={() => setContextMenu(null)}>
              {contextMenu.targetType === 'wall' && (
                  <button onClick={() => handleContextAction('split')} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
                      <Scissors size={14} /> Split Wall
                  </button>
              )}
              {contextMenu.targetType === 'opening' && (
                  <>
                      <button onClick={() => handleContextAction('flipX')} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"><FlipHorizontal size={14} /> Flip Hinge</button>
                      <button onClick={() => handleContextAction('flipY')} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"><RotateCw size={14} /> Flip Swing</button>
                  </>
              )}
              {(contextMenu.targetType === 'symbol' || contextMenu.targetType === 'stair') && (
                  <button onClick={() => handleContextAction('rotateCW')} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"><RotateCw size={14} /> Rotate 45°</button>
              )}
              
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
              <button onClick={() => handleContextAction('delete')} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                  <Trash2 size={14} /> Delete
              </button>
          </div>
      )}

      {summary && (
          <div 
            className="absolute bottom-28 right-4 z-30 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-4 w-64 animate-in slide-in-from-bottom-10 fade-in duration-200 max-h-[50vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()} // Stop propagation to prevent accidental deselection
          >
              <div className="flex justify-between items-center mb-3 border-b border-slate-100 dark:border-slate-700 pb-2 sticky top-0 bg-white dark:bg-slate-800 z-10">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Settings2 size={14} /> Properties
                  </h3>
                  <div className="flex gap-2">
                      {singleObj && 'locked' in singleObj && (
                        <button onClick={() => updateSelectedProperty('locked', !singleObj.locked)} className={`p-1 rounded ${singleObj.locked ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`} title={singleObj.locked ? "Unlock" : "Lock"}>
                            {singleObj.locked ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                      )}
                      <button onClick={deleteSelected} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded" title="Delete">
                          <X size={14} />
                      </button>
                  </div>
              </div>
              
              <div className="space-y-3">
                  {isMultiple && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 italic mb-2">
                          {selection.size} items selected
                      </div>
                  )}
                  
                  <div className="flex gap-2">
                    {canGroup && (
                        <button onClick={handleGroupSelection} className="flex-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40">
                            <Group size={14} /> Group
                        </button>
                    )}
                    {canUngroup && (
                         <button onClick={handleUngroupSelection} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-600">
                            <Ungroup size={14} /> Ungroup
                        </button>
                    )}
                  </div>

                  {singleObj && (
                      <>
                        {'rotation' in singleObj && 'position' in singleObj && !('type' in singleObj) && (
                             <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Rotation</label><BufferedInput type="number" value={Math.round((singleObj as any).rotation)} onChange={(val) => updateSelectedProperty('rotation', parseFloat(val))} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                        )}
                        {'type' in singleObj && 'scale' in singleObj && (
                            <>
                                <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 border-b pb-1 dark:border-slate-700">
                                    {SYMBOL_CATALOG.find(s => s.id === (singleObj as SymbolInstance).type)?.label || (singleObj as SymbolInstance).type}
                                </div>
                                <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Rotation (°)</label><BufferedInput type="number" value={Math.round((singleObj as SymbolInstance).rotation)} onChange={(val) => updateSelectedProperty('rotation', parseFloat(val))} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                                <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Scale</label><BufferedInput type="number" value={(singleObj as SymbolInstance).scale} onChange={(val) => updateSelectedProperty('scale', parseFloat(val))} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                            </>
                        )}
                        {'thickness' in singleObj && (
                            <>
                                <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Thickness (mm)</label>
                                <BufferedInput 
                                    type="number" 
                                    value={Math.round((singleObj as Wall).thickness * 10)} 
                                    disabled={(singleObj as Wall).locked} 
                                    onChange={(val) => {
                                        const parsed = parseFloat(val);
                                        if (!isNaN(parsed) && parsed > 0) {
                                            updateSelectedProperty('thickness', parsed / 10);
                                        }
                                    }} 
                                    className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" 
                                /></div>
                                <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Height (mm)</label><BufferedInput type="number" value={(singleObj as Wall).height} disabled={(singleObj as Wall).locked} onChange={(val) => updateSelectedProperty('height', parseFloat(val))} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                                <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Curvature</label><BufferedInput type="number" value={(singleObj as Wall).curvature || 0} disabled={(singleObj as Wall).locked} onChange={(val) => updateSelectedProperty('curvature', parseFloat(val))} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                            </>
                        )}
                        {'wallId' in singleObj && (
                             <>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Width</label><BufferedInput type="number" value={(singleObj as Opening).width} disabled={(singleObj as Opening).locked} onChange={(val) => updateSelectedProperty('width', parseFloat(val))} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                                    <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Height</label><BufferedInput type="number" value={(singleObj as Opening).height} disabled={(singleObj as Opening).locked} onChange={(val) => updateSelectedProperty('height', parseFloat(val))} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                                </div>
                                <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Sill Height</label><BufferedInput type="number" value={(singleObj as Opening).sillHeight} disabled={(singleObj as Opening).locked} onChange={(val) => updateSelectedProperty('sillHeight', parseFloat(val))} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                                <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Label</label><BufferedInput type="text" value={(singleObj as Opening).label || ''} disabled={(singleObj as Opening).locked} onChange={(val) => updateSelectedProperty('label', val)} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                                {(singleObj as Opening).type === 'door' && (
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={() => updateSelectedProperty('flipX', !(singleObj as Opening).flipX)} className="flex-1 bg-slate-100 dark:bg-slate-700 p-2 rounded text-xs flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors" disabled={(singleObj as Opening).locked}><FlipHorizontal size={14} /> Flip Hinge</button>
                                        <button onClick={() => updateSelectedProperty('flipY', !(singleObj as Opening).flipY)} className="flex-1 bg-slate-100 dark:bg-slate-700 p-2 rounded text-xs flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors" disabled={(singleObj as Opening).locked}><RotateCw size={14} /> Flip Swing</button>
                                    </div>
                                )}
                            </>
                        )}
                        {'treadDepth' in singleObj && (
                             <>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Stair Type</label>
                                    <select value={(singleObj as Stair).type} disabled={(singleObj as Stair).locked} onChange={(e) => updateSelectedProperty('type', e.target.value)} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                                        <option value={StairType.STRAIGHT}>Straight</option><option value={StairType.L_SHAPE}>L-Shape</option><option value={StairType.U_SHAPE}>U-Shape</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Width</label><BufferedInput type="number" value={(singleObj as Stair).width * 10} disabled={(singleObj as Stair).locked} onChange={(val) => updateSelectedProperty('width', parseFloat(val)/10)} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                                    <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Tread</label><BufferedInput type="number" value={(singleObj as Stair).treadDepth * 10} disabled={(singleObj as Stair).locked} onChange={(val) => updateSelectedProperty('treadDepth', parseFloat(val)/10)} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Risers</label><BufferedInput type="number" value={(singleObj as Stair).count} disabled={(singleObj as Stair).locked} onChange={(val) => updateSelectedProperty('count', parseInt(val))} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                                    <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Rotation</label><BufferedInput type="number" value={(singleObj as Stair).rotation} disabled={(singleObj as Stair).locked} onChange={(val) => updateSelectedProperty('rotation', parseFloat(val))} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                                </div>
                                {((singleObj as Stair).type !== StairType.STRAIGHT) && (
                                    <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Steps Before Turn</label><BufferedInput type="number" value={(singleObj as Stair).flight1Count} disabled={(singleObj as Stair).locked} onChange={(val) => updateSelectedProperty('flight1Count', parseInt(val))} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                                )}
                             </>
                        )}
                        {'text' in singleObj && 'position' in singleObj && (
                            <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Room Name</label><BufferedInput type="text" value={(singleObj as RoomLabel).text} disabled={(singleObj as RoomLabel).locked} onChange={(val) => updateSelectedProperty('text', val)} className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white" /></div>
                        )}
                        {'offset' in singleObj && (
                             <div><label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Measurement</label><div className="text-xs p-2 bg-slate-100 dark:bg-slate-700 rounded text-slate-900 dark:text-slate-100">{Math.round(dist((singleObj as Dimension).start, (singleObj as Dimension).end) * 10)} mm</div></div>
                        )}
                      </>
                  )}
              </div>
          </div>
      )}

      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="bg-white dark:bg-slate-800 p-2 rounded shadow text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">-</button>
        <span className="bg-white dark:bg-slate-800 p-2 rounded shadow text-slate-800 dark:text-slate-200 text-xs flex items-center w-12 justify-center border border-slate-200 dark:border-slate-700">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(5, z + 0.1))} className="bg-white dark:bg-slate-800 p-2 rounded shadow text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">+</button>
      </div>
      
      <svg
        ref={svgRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onContextMenu={handleContextMenu}
        onWheel={(e) => {
          if(e.ctrlKey) {
             e.preventDefault();
             setZoom(z => Math.max(0.1, z - e.deltaY * 0.001));
          } else {
             setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
          }
        }}
      >
        <defs>
            <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1"/>
            </pattern>
            <pattern id="wall_hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="10" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="2" />
            </pattern>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" className="fill-slate-600 dark:fill-slate-400" />
            </marker>
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          <rect width="10000" height="10000" transform="translate(-5000, -5000)" fill="url(#grid)" />

          {data.northArrow && (
              <NorthArrowEntity arrow={data.northArrow} selected={isSelected("NORTH_ARROW")} />
          )}

          {snapGuides.map((g, i) => (
              <line key={i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} strokeDasharray="4,4" className={g.type === 'extension' ? "stroke-fuchsia-500" : "stroke-cyan-500"} strokeWidth="1" opacity="0.8" />
          ))}
          {snapMarker && (
              <circle cx={snapMarker.x} cy={snapMarker.y} r={4} className="fill-none stroke-cyan-500" strokeWidth={2} />
          )}

          {tool === ToolType.CALIBRATE && calibrationPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={5} className="fill-blue-500" />
          ))}
          {tool === ToolType.CALIBRATE && calibrationPoints.length === 2 && (
              <line x1={calibrationPoints[0].x} y1={calibrationPoints[0].y} x2={calibrationPoints[1].x} y2={calibrationPoints[1].y} stroke="blue" strokeDasharray="4,4" />
          )}

          {layers.showWalls && data.walls.map(wall => {
             const selected = isSelected(wall.id);
             const openings = data.openings.filter(o => o.wallId === wall.id);
             return (
            <g key={wall.id}>
               <WallEntity wall={wall} openings={openings} selected={selected} />
               {renderSmartDimensions(wall)}
               {selected && selection.size === 1 && !wall.locked && (
                  <>
                    <circle cx={wall.start.x} cy={wall.start.y} r={6} fill="#3b82f6" stroke="white" strokeWidth={2} className="cursor-move hover:r-8 transition-all" />
                    <circle cx={wall.end.x} cy={wall.end.y} r={6} fill="#3b82f6" stroke="white" strokeWidth={2} className="cursor-move hover:r-8 transition-all" />
                    {(() => {
                        const mid = scale(add(wall.start, wall.end), 0.5);
                        const dir = norm(sub(wall.end, wall.start));
                        const normal = { x: -dir.y, y: dir.x };
                        const handlePos = add(mid, scale(normal, wall.curvature || 0));
                        return ( <circle cx={handlePos.x} cy={handlePos.y} r={4} fill="#10b981" stroke="white" strokeWidth={2} className="cursor-move" /> );
                    })()}
                  </>
               )}
            </g>
          )})}

          {drawingStart && currentMousePos && (
              <g className="pointer-events-none">
                  {(tool === ToolType.WALL || tool === ToolType.ARCH_WALL) && (
                    <g opacity="0.5">
                        <path d={`M ${drawingStart.x} ${drawingStart.y} L ${currentMousePos.x} ${currentMousePos.y}`} className="stroke-blue-500 dark:stroke-blue-400" strokeWidth={activeWallThickness} fill="none" />
                    </g>
                  )}
                  {tool === ToolType.SQUARE_ROOM && (
                      <g>
                          <rect x={Math.min(drawingStart.x, currentMousePos.x)} y={Math.min(drawingStart.y, currentMousePos.y)} width={Math.abs(drawingStart.x - currentMousePos.x)} height={Math.abs(drawingStart.y - currentMousePos.y)} className="stroke-blue-500 dark:stroke-blue-400" strokeWidth={activeWallThickness} fill="none" opacity="0.5" />
                          {getRectArea() && (
                              <text x={(drawingStart.x + currentMousePos.x)/2} y={(drawingStart.y + currentMousePos.y)/2} textAnchor="middle" className="fill-blue-600 dark:fill-blue-400 font-bold text-lg">
                                  {getRectArea()?.toFixed(1)} m²
                              </text>
                          )}
                      </g>
                  )}
                  {tool === ToolType.DIMENSION && (
                      <line x1={drawingStart.x} y1={drawingStart.y} x2={currentMousePos.x} y2={currentMousePos.y} className="stroke-slate-400 dark:stroke-slate-500" strokeDasharray="2,2"/>
                  )}
              </g>
          )}

          {layers.showOpenings && data.openings.map(op => {
            const wall = data.walls.find(w => w.id === op.wallId);
            if (!wall || !layers.showWalls) return null; 
            return <OpeningEntity key={op.id} op={op} wall={wall} selected={isSelected(op.id)} showLabel={layers.showLabels} />;
          })}

          {layers.showStairs && data.stairs.map(stair => <StairEntity key={stair.id} stair={stair} selected={isSelected(stair.id)} />)}

          {layers.showSymbols && data.symbols.map(sym => <SymbolEntity key={sym.id} symbol={sym} selected={isSelected(sym.id)} />)}

          {layers.showDimensions && data.dimensions.map(d => <DimensionEntity key={d.id} dim={d} selected={isSelected(d.id)} />)}

          {layers.showLabels && data.labels.map(label => <LabelEntity key={label.id} label={label} selected={isSelected(label.id)} />)}

        </g>
      </svg>
    </div>
  );
});
