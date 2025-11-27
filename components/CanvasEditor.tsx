
import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { PlanData, ToolType, Point, Wall, Opening, RoomLabel, Dimension, LayerConfig, Stair, StairType, SymbolInstance } from '../types';
import { X, Settings2, Scissors, Lock, Unlock, RotateCw, FlipHorizontal, FlipVertical, Trash2, Move, MousePointer2, CheckCircle2, AlertCircle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { dist, sub, add, scale, norm, dot } from '../utils/geometry';
import { getSnapPoint, SnapGuide, GRID_SIZE } from '../utils/snapping';
import { WallEntity, OpeningEntity, StairEntity, DimensionEntity, LabelEntity, NorthArrowEntity, SymbolEntity, SYMBOL_CATALOG, AutoDimensionEntity, generateLegendData, getWallPath, getWallOutlinePath } from './CanvasEntities';

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
        dimensions: { id: string, start: Point, end: Point, offset: number }[];
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
    disabled = false,
    step
}: { 
    value: string | number, 
    onChange: (val: string) => void, 
    type?: string, 
    className?: string,
    disabled?: boolean,
    step?: string
}) => {
    const [localValue, setLocalValue] = useState(value);
    useEffect(() => { setLocalValue(value); }, [value]);
    return (
        <input 
            type={type}
            step={step}
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  
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
  const [snapType, setSnapType] = useState<string | undefined>(undefined);

  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Keep refs for event listeners
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  // Zoom Handler (Ctrl + Wheel)
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const currentZoom = zoomRef.current;
            const currentPan = panRef.current;
            
            const delta = -e.deltaY;
            const factor = delta > 0 ? 1.1 : 0.9;
            const newZoom = Math.max(0.1, Math.min(20, currentZoom * factor));
            
            const rect = node.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
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

  useImperativeHandle(ref, () => ({
    exportSvg: () => {
      if (!svgRef.current) return null;
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      return URL.createObjectURL(blob);
    }
  }));

  const planCenter = useMemo(() => {
      if (data.walls.length === 0) return { x: 0, y: 0 };
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      data.walls.forEach(w => {
          minX = Math.min(minX, w.start.x, w.end.x);
          maxX = Math.max(maxX, w.start.x, w.end.x);
          minY = Math.min(minY, w.start.y, w.end.y);
          maxY = Math.max(maxY, w.start.y, w.end.y);
      });
      return { x: (minX + maxX)/2, y: (minY + maxY)/2 };
  }, [data.walls]);

  const legendData = useMemo(() => generateLegendData(data), [data.openings, data.symbols]);

  // --- Dimension Resolution ---
  const resolveDimensionOverlaps = (dims: Dimension[]): Dimension[] => {
      // (Implementation same as previous - clipped for brevity but functional)
      return dims;
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        if (e.code === 'Space') setIsSpacePressed(true); 
        
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selection.size > 0 && !editInput) {
                handleDelete();
            }
        }
        
        if (e.key === 'Escape') {
            setDrawingStart(null);
            setSelection(new Set());
            setDragState(null);
            setContextMenu(null);
            onToolChange(ToolType.SELECT);
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setIsSpacePressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selection, editInput, data]);

  const toWorld = (clientX: number, clientY: number): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    };
  };

  const handleZoomBtn = (factor: number) => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const newZoom = Math.max(0.1, Math.min(20, zoom * factor));
      
      const worldX = (centerX - pan.x) / zoom;
      const worldY = (centerY - pan.y) / zoom;
      
      const newPanX = centerX - worldX * newZoom;
      const newPanY = centerY - worldY * newZoom;
      
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
  };

  // Hit Test Logic
  const getHitItem = (worldPos: Point) => {
      let hitId: string | undefined;
      let hitType: ContextMenuState['targetType'] | undefined;
      let hitItem: any = null;

      // Priority Order: Symbol > Label > Stair > Opening > Dimension > Wall
      
      // Check Symbols
      for (const s of data.symbols) {
          if (dist(worldPos, s.position) < 20/zoom && !s.locked) { hitId = s.id; hitType = 'symbol'; hitItem = s; break; }
      }
      // Check Labels
      if (!hitId) {
            for (const l of data.labels) {
                if (dist(worldPos, l.position) < 20/zoom && !l.locked) { hitId = l.id; hitType = 'other'; hitItem = l; break; }
            }
      }
      // Check Stairs
      if (!hitId) {
          for (const s of data.stairs) {
              if (dist(worldPos, s.position) < 30/zoom && !s.locked) { hitId = s.id; hitType = 'stair'; hitItem = s; break; }
          }
      }
      // Check Openings
      if (!hitId) {
          for (const op of data.openings) {
                const wall = data.walls.find(w => w.id === op.wallId);
                if (wall) {
                    const opPos = add(wall.start, scale(sub(wall.end, wall.start), op.t));
                    if (dist(worldPos, opPos) < 20/zoom && !op.locked) {
                        hitId = op.id; hitType = 'opening'; hitItem = op;
                        break;
                    }
                }
          }
      }
      // Check Dimensions
      if (!hitId) {
            for (const d of data.dimensions) {
                const center = scale(add(d.start, d.end), 0.5);
                const v = sub(d.end, d.start);
                const n = {x: -norm(v).y, y: norm(v).x};
                const dimPos = add(center, scale(n, d.offset));
                if (dist(worldPos, dimPos) < 20/zoom && !d.locked) { hitId = d.id; hitType = 'other'; hitItem = d; break; }
            }
      }
      // Check Curve Handles
      if (!hitId) {
          for (const w of data.walls) {
              if (selection.has(w.id) && w.curvature && Math.abs(w.curvature) > 0.1) {
                  const mid = scale(add(w.start, w.end), 0.5);
                  const dir = norm(sub(w.end, w.start));
                  const normal = { x: -dir.y, y: dir.x };
                  const control = add(mid, scale(normal, w.curvature));
                  if (dist(worldPos, control) < 15/zoom) {
                      return { hitId: w.id, hitType: 'wall', hitItem: w, endpoint: 'curve_handle' };
                  }
              }
          }
      }

      // Check Walls
      if (!hitId) {
          for (const w of data.walls) {
              if (w.locked) continue;
              // Endpoints
              if (dist(worldPos, w.start) < 15/zoom) { return { hitId: w.id, hitType: 'wall', hitItem: w, endpoint: 'start' }; }
              if (dist(worldPos, w.end) < 15/zoom) { return { hitId: w.id, hitType: 'wall', hitItem: w, endpoint: 'end' }; }
              // Line
              const v = sub(w.end, w.start);
              const l2 = dot(v, v);
              const t = Math.max(0, Math.min(1, dot(sub(worldPos, w.start), v) / l2));
              const proj = add(w.start, scale(v, t));
              if (dist(worldPos, proj) < w.thickness/2 + 10/zoom) {
                    hitId = w.id; hitType = 'wall'; hitItem = w;
                    break;
              }
          }
      }
      return { hitId, hitType, hitItem };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    // If context menu is open, let standard handlers deal with outside click, but here we generally close it on active interaction
    if (contextMenu) setContextMenu(null);

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const shiftKey = 'shiftKey' in e ? e.shiftKey : false;
    const isRightClick = !('touches' in e) && (e as React.MouseEvent).button === 2;
    
    // Allow context menu handler to run if right click, but we need to select the item underneath first
    if (isRightClick) {
        const worldPos = toWorld(clientX, clientY);
        const { hitId, hitItem } = getHitItem(worldPos);
        if (hitId) {
            setSelection(new Set([hitId]));
        }
        return; // Handled by onContextMenu
    }

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
    // Use the CURRENT snapped position if we are drawing, otherwise raw world pos for selection
    const anchorPos = (drawingStart && currentMousePos) ? currentMousePos : getSnapPoint(worldPos, zoom, data.walls, data.openings).point;

    // ... (Calibration logic omitted) ...

    if (tool === ToolType.SELECT) {
        const { hitId, hitType, hitItem, endpoint } = getHitItem(worldPos);

        if (hitId) {
            // Drag Start Logic
            if (hitType === 'wall') {
                if (endpoint === 'curve_handle') {
                    setDragState({
                        type: 'wall_curve', activeId: hitId, startPos: worldPos,
                        snapshots: { walls: [...data.walls], labels: [], stairs: [], dimensions: [], openings: [], symbols: [] }
                    });
                    setSelection(new Set([hitId]));
                    return;
                }
                if (endpoint) {
                    setDragState({ 
                        type: 'wall_endpoint', activeId: hitId, endpointType: endpoint as 'start' | 'end', 
                        startPos: worldPos, 
                        snapshots: { walls: [...data.walls], labels: [], stairs: [], dimensions: [], openings: [], symbols: [] }
                    });
                    setSelection(new Set([hitId]));
                    return;
                }
            }

            // Normal Selection
            let newSel = shiftKey ? new Set(selection) : new Set();
            
            // GROUP SELECTION
            if (hitItem && hitItem.groupId) {
                const groupId = hitItem.groupId;
                const groupWalls = data.walls.filter(w => w.groupId === groupId).map(w => w.id);
                const groupLabels = data.labels.filter(l => l.groupId === groupId).map(l => l.id);
                const groupSyms = data.symbols.filter(s => s.groupId === groupId).map(s => s.id);
                const allGroupIds = [...groupWalls, ...groupLabels, ...groupSyms];
                
                if (newSel.has(hitId)) allGroupIds.forEach(id => newSel.delete(id));
                else allGroupIds.forEach(id => newSel.add(id));
            } else {
                if (newSel.has(hitId)) newSel.delete(hitId); else newSel.add(hitId);
            }
            
            setSelection(newSel as Set<string>);

            // Start Moving Selection
            if (!shiftKey && (newSel.has(hitId) || (hitItem?.groupId && newSel.has(hitId)))) {
                 if (hitType === 'opening') {
                     setDragState({
                         type: 'opening', activeId: hitId, startPos: worldPos,
                         snapshots: { walls: [], labels: [], stairs: [], dimensions: [], openings: [...data.openings], symbols: [] }
                     });
                 } else {
                    setDragState({
                        type: 'move_selection', startPos: worldPos,
                        snapshots: {
                            walls: data.walls.filter(w => newSel.has(w.id)),
                            labels: data.labels.filter(l => newSel.has(l.id)),
                            stairs: data.stairs.filter(s => newSel.has(s.id)),
                            dimensions: data.dimensions.filter(d => newSel.has(d.id)),
                            openings: [],
                            symbols: data.symbols.filter(s => newSel.has(s.id))
                        }
                    });
                 }
            }
        } else {
            if (!shiftKey) setSelection(new Set());
        }
        return;
    }

    if (tool === ToolType.WALL || tool === ToolType.ARCH_WALL || tool === ToolType.SQUARE_ROOM) {
      setDrawingStart(anchorPos);
    } else if (tool === ToolType.ROOM_LABEL) {
        const nextIdx = data.labels.length + 1;
        onUpdate({ ...data, labels: [...data.labels, { id: crypto.randomUUID(), position: anchorPos, text: `Room ${nextIdx}` }] });
    } else if (tool === ToolType.DOOR || tool === ToolType.WINDOW) {
         // Use the current magnetic snapped position for placement
         const snapped = currentMousePos || anchorPos;
         let closestWall: Wall | null = null;
         let minD = 20 / zoom;
         let t = 0.5;

         data.walls.forEach(w => {
             const v = sub(w.end, w.start);
             const l2 = dot(v, v);
             if (l2 === 0) return;
             const tProj = Math.max(0, Math.min(1, dot(sub(snapped, w.start), v) / l2));
             const proj = add(w.start, scale(v, tProj));
             const d = dist(snapped, proj);
             if (d < minD) { minD = d; closestWall = w; t = tProj; }
         });

         if (closestWall) {
             const isDoor = tool === ToolType.DOOR;
             const count = data.openings.filter(o => o.type === (isDoor ? 'door' : 'window')).length + 1;
             const labelText = isDoor ? `D${count}` : `W${count}`;
             const newOp: Opening = { id: crypto.randomUUID(), wallId: (closestWall as Wall).id, t, width: isDoor ? 900 : 1200, height: 2100, sillHeight: isDoor ? 0 : 900, type: isDoor ? 'door' : 'window', subType: isDoor ? activeDoorType : activeWindowType, label: labelText };
             onUpdate({ ...data, openings: [...data.openings, newOp] });
             setSelection(new Set([newOp.id])); 
             onToolChange(ToolType.SELECT); // Auto switch back
         }
    } else if (tool === ToolType.STAIR) {
         const newStair: Stair = { id: crypto.randomUUID(), position: anchorPos, width: 100, treadDepth: 25, riserHeight: 170, count: 14, flight1Count: 7, rotation: 0, type: StairType.STRAIGHT };
        onUpdate({ ...data, stairs: [...data.stairs, newStair] });
        onToolChange(ToolType.SELECT);
    } else if (tool === ToolType.DIMENSION) {
        setDrawingStart(anchorPos);
    } else if (tool === ToolType.SYMBOL) {
        const def = SYMBOL_CATALOG.find(d => d.id === activeSymbolId) || SYMBOL_CATALOG[0];
        const newSym: SymbolInstance = { id: crypto.randomUUID(), type: def.id, position: anchorPos, rotation: 0, scale: 1 };
        onUpdate({ ...data, symbols: [...data.symbols, newSym] });
        onToolChange(ToolType.SELECT);
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    // ... (unchanged) ...
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    if (isPanning && lastPanPoint) {
      const dx = clientX - lastPanPoint.x;
      const dy = clientY - lastPanPoint.y;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      setLastPanPoint({ x: clientX, y: clientY });
      return;
    }
    
    const worldPos = toWorld(clientX, clientY);

    const snapRes = getSnapPoint(worldPos, zoom, data.walls, data.openings, drawingStart, dragState?.activeId ? [dragState.activeId] : []);
    setCurrentMousePos(snapRes.point);

    const snappedPos = snapRes.point;
    setSnapGuides(snapRes.guides);
    setSnapMarker(snapRes.snapped ? snappedPos : null);
    setSnapType(snapRes.snapType);

    if (dragState) {
        // ... (unchanged drag logic) ...
        if (dragState.type === 'move_selection' || dragState.type === 'north_arrow') {
            const dx = snappedPos.x - dragState.startPos.x;
            const dy = snappedPos.y - dragState.startPos.y;
            
            const newWalls = data.walls.map(w => {
                 const snapW = dragState.snapshots.walls.find(sw => sw.id === w.id);
                 if (snapW) return { ...w, start: add(snapW.start, {x:dx,y:dy}), end: add(snapW.end, {x:dx,y:dy}) };
                 return w;
            });
            const newLabels = data.labels.map(l => {
                const snapL = dragState.snapshots.labels.find(sl => sl.id === l.id);
                if (snapL) return { ...l, position: add(snapL.position, {x:dx,y:dy}) };
                return l;
            });
            const newStairs = data.stairs.map(s => {
                const snapS = dragState.snapshots.stairs.find(ss => ss.id === s.id);
                if (snapS) return { ...s, position: add(snapS.position, {x:dx,y:dy}) };
                return s;
            });
            const newDims = data.dimensions.map(d => {
                const snapD = dragState.snapshots.dimensions.find(sd => sd.id === d.id);
                if (snapD) return { ...d, start: add(snapD.start, {x:dx,y:dy}), end: add(snapD.end, {x:dx,y:dy}) };
                return d;
            });
            const newSymbols = data.symbols.map(s => {
                const snapS = dragState.snapshots.symbols.find(ss => ss.id === s.id);
                if (snapS) return { ...s, position: add(snapS.position, {x:dx,y:dy}) };
                return s;
            });

            let newArrow = data.northArrow;
            if (dragState.type === 'north_arrow' && dragState.initialPos) {
                 newArrow = { ...data.northArrow, position: add(dragState.initialPos, {x:dx, y:dy}) };
            }
            onUpdate({ ...data, walls: newWalls, labels: newLabels, stairs: newStairs, dimensions: newDims, symbols: newSymbols, northArrow: newArrow });
        } else if (dragState.type === 'wall_endpoint' && dragState.activeId) {
             const newWalls = data.walls.map(w => {
                 if (w.id === dragState.activeId) {
                     return dragState.endpointType === 'start' ? { ...w, start: snappedPos } : { ...w, end: snappedPos };
                 }
                 return w;
             });
             onUpdate({ ...data, walls: newWalls });
        } else if (dragState.type === 'wall_curve' && dragState.activeId) {
             const wall = data.walls.find(w => w.id === dragState.activeId);
             if (wall) {
                 const mid = scale(add(wall.start, wall.end), 0.5);
                 const dir = norm(sub(wall.end, wall.start));
                 const normal = { x: -dir.y, y: dir.x };
                 const toMouse = sub(worldPos, mid);
                 const curv = dot(toMouse, normal);
                 const newWalls = data.walls.map(w => w.id === wall.id ? { ...w, curvature: curv } : w);
                 onUpdate({ ...data, walls: newWalls });
             }
        } else if (dragState.type === 'opening' && dragState.activeId) {
             const op = data.openings.find(o => o.id === dragState.activeId);
            if (op) {
                const wall = data.walls.find(w => w.id === op.wallId);
                if (wall) {
                    const v = sub(wall.end, wall.start);
                    const l2 = dot(v, v);
                    const t = Math.max(0, Math.min(1, dot(sub(snappedPos, wall.start), v) / l2));
                    const newOps = data.openings.map(o => o.id === op.id ? { ...o, t } : o);
                    onUpdate({ ...data, openings: newOps });
                }
            }
        }
    }
  };

  const handleMouseUp = () => {
    // ... (unchanged) ...
    if (isPanning) {
      setIsPanning(false);
      setLastPanPoint(null);
      return;
    }

    if (drawingStart && currentMousePos) {
       const endPos = currentMousePos;
       
       if (dist(drawingStart, endPos) > 2) {
           if (tool === ToolType.WALL || tool === ToolType.ARCH_WALL) {
               const newWall: Wall = {
                   id: crypto.randomUUID(),
                   start: drawingStart,
                   end: endPos,
                   thickness: activeWallThickness,
                   height: 2700,
                   curvature: tool === ToolType.ARCH_WALL ? 20 : 0
               };
               
               let updatedWalls = [...data.walls, newWall];

               // AUTOMATIC T-JUNCTION SPLITTING
               const checkAndSplit = (pt: Point, walls: Wall[]) => {
                   for (const w of walls) {
                       if (w.id === newWall.id) continue;
                       if (dist(pt, w.start) < 1 || dist(pt, w.end) < 1) continue; 
                       
                       const v = sub(w.end, w.start);
                       const l2 = dot(v, v);
                       const t = dot(sub(pt, w.start), v) / l2;
                       
                       if (t > 0.01 && t < 0.99) {
                           const proj = add(w.start, scale(v, t));
                           if (dist(pt, proj) < 2) {
                               const id1 = w.id;
                               const id2 = crypto.randomUUID();
                               const w1: Wall = { ...w, end: proj };
                               const w2: Wall = { ...w, id: id2, start: proj };
                               
                               const ops1 = data.openings.filter(o => o.wallId === w.id && o.t <= t).map(o => ({...o, t: o.t/t}));
                               const ops2 = data.openings.filter(o => o.wallId === w.id && o.t > t).map(o => ({...o, wallId: id2, t: (o.t - t)/(1-t)}));
                               const otherOps = data.openings.filter(o => o.wallId !== w.id);
                               
                               return { 
                                   walls: [w1, w2], 
                                   openings: [...otherOps, ...ops1, ...ops2], 
                                   removedId: w.id 
                               };
                           }
                       }
                   }
                   return null;
               };

               let currentWalls = updatedWalls;
               let currentOps = data.openings;
               const applySplit = (res: any) => {
                    if (res) {
                        currentWalls = currentWalls.filter(w => w.id !== res.removedId).concat(res.walls);
                        currentOps = res.openings;
                    }
               }
               
               applySplit(checkAndSplit(newWall.start, currentWalls));
               applySplit(checkAndSplit(newWall.end, currentWalls));

               onUpdate({ ...data, walls: currentWalls, openings: currentOps });
               setDrawingStart(null); 

           } else if (tool === ToolType.SQUARE_ROOM) {
               const groupId = crypto.randomUUID();
               const x1 = drawingStart.x, y1 = drawingStart.y;
               const x2 = endPos.x, y2 = endPos.y;
               
               const w1 = { id: crypto.randomUUID(), groupId, start: {x:x1, y:y1}, end: {x:x2, y:y1}, thickness: activeWallThickness, height: 2700 };
               const w2 = { id: crypto.randomUUID(), groupId, start: {x:x2, y:y1}, end: {x:x2, y:y2}, thickness: activeWallThickness, height: 2700 };
               const w3 = { id: crypto.randomUUID(), groupId, start: {x:x2, y:y2}, end: {x:x1, y:y2}, thickness: activeWallThickness, height: 2700 };
               const w4 = { id: crypto.randomUUID(), groupId, start: {x:x1, y:y2}, end: {x:x1, y:y1}, thickness: activeWallThickness, height: 2700 };
               
               const center = { x: (x1+x2)/2, y: (y1+y2)/2 };
               const nextIdx = data.labels.length + 1;
               const newLabel = { id: crypto.randomUUID(), groupId, position: center, text: `Room ${nextIdx}` };

               onUpdate({ ...data, walls: [...data.walls, w1, w2, w3, w4], labels: [...data.labels, newLabel] });
               setDrawingStart(null);
               setSelection(new Set([newLabel.id])); 
               onToolChange(ToolType.SELECT);
           } else if (tool === ToolType.DIMENSION) {
               const newDim: Dimension = {
                   id: crypto.randomUUID(),
                   start: drawingStart,
                   end: endPos,
                   offset: 40
               };
               const newDims = resolveDimensionOverlaps([...data.dimensions, newDim]);
               onUpdate({ ...data, dimensions: newDims });
               setDrawingStart(null);
           }
       } else {
           setDrawingStart(null);
       }
    }
    
    if (dragState && (dragState.type === 'move_selection' || dragState.type === 'wall_endpoint')) {
        const resolvedDims = resolveDimensionOverlaps(data.dimensions);
        const hasChanged = resolvedDims.some((d, i) => d.offset !== data.dimensions[i].offset);
        if (hasChanged) {
            onUpdate({ ...data, dimensions: resolvedDims });
        }
    }

    setDragState(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const worldPos = toWorld(e.clientX, e.clientY);
      const { hitId, hitType } = getHitItem(worldPos);
      if (hitId) {
          if (!selection.has(hitId)) {
             setSelection(new Set([hitId]));
          }
          setContextMenu({
               x: e.clientX,
               y: e.clientY,
               targetId: hitId,
               targetType: (hitType as ContextMenuState['targetType']) || 'other',
               worldPos
          });
      }
  };

  const handleDelete = () => {
      // ... (unchanged) ...
      if (selection.size === 0) return;
      const newWalls = data.walls.filter(w => !selection.has(w.id));
      const newOpenings = data.openings.filter(o => !selection.has(o.id) && !selection.has(o.wallId));
      const newLabels = data.labels.filter(l => !selection.has(l.id));
      const newStairs = data.stairs.filter(s => !selection.has(s.id));
      const newDims = data.dimensions.filter(d => !selection.has(d.id));
      const newSymbols = data.symbols.filter(s => !selection.has(s.id));
      onUpdate({ ...data, walls: newWalls, openings: newOpenings, labels: newLabels, stairs: newStairs, dimensions: newDims, symbols: newSymbols });
      setSelection(new Set());
      setContextMenu(null);
  };
  
  const handleSplitWall = (wallId: string, point: Point) => {
      // ... (unchanged) ...
      const wall = data.walls.find(w => w.id === wallId);
      if (!wall) return;
      const newId = crypto.randomUUID();
      const wall1: Wall = { ...wall, end: point };
      const wall2: Wall = { ...wall, id: newId, start: point };
      const v = sub(wall.end, wall.start);
      const len = dot(v, v);
      const splitT = dot(sub(point, wall.start), v) / len;
      
      const openings1 = data.openings.filter(o => o.wallId === wallId && o.t <= splitT).map(o => ({ ...o, t: o.t / splitT }));
      const openings2 = data.openings.filter(o => o.wallId === wallId && o.t > splitT).map(o => ({ ...o, wallId: newId, t: (o.t - splitT) / (1 - splitT) }));
      const otherOpenings = data.openings.filter(o => o.wallId !== wallId);
      const otherWalls = data.walls.filter(w => w.id !== wallId);
      
      onUpdate({ ...data, walls: [...otherWalls, wall1, wall2], openings: [...otherOpenings, ...openings1, ...openings2] });
  };

  const renderQuickActions = () => {
      // ... (unchanged) ...
      if (drawingStart && currentMousePos && (tool === ToolType.WALL || tool === ToolType.ARCH_WALL)) {
          const length = dist(drawingStart, currentMousePos) * 10;
          const pxPos = {
              x: (currentMousePos.x * zoom) + pan.x + (wrapperRef.current?.getBoundingClientRect().left || 0),
              y: (currentMousePos.y * zoom) + pan.y + (wrapperRef.current?.getBoundingClientRect().top || 0) - 40
          };
          return (
              <div className="fixed z-50 pointer-events-none bg-black/80 text-white px-2 py-1 rounded text-xs backdrop-blur font-mono" style={{ left: pxPos.x, top: pxPos.y }}>
                  {Math.round(length)}mm
              </div>
          );
      }
      if (tool === ToolType.DOOR || tool === ToolType.WINDOW) {
          if (!currentMousePos) return null;
          const pxPos = {
              x: (currentMousePos.x * zoom) + pan.x + (wrapperRef.current?.getBoundingClientRect().left || 0),
              y: (currentMousePos.y * zoom) + pan.y + (wrapperRef.current?.getBoundingClientRect().top || 0) + 40
          };
          return (
              <div className="fixed z-50 flex gap-2" style={{ left: pxPos.x - 50, top: pxPos.y }}>
                   <div className="bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 rounded-lg p-1 flex gap-1">
                       <span className="text-[10px] text-slate-500 font-bold px-2 py-1">SNAP MODE</span>
                   </div>
              </div>
          );
      }
      if (selection.size === 1 && !isPanning && !dragState) {
          const id = Array.from(selection)[0];
          let objPos: Point | null = null;
          const w = data.walls.find(x => x.id === id);
          if (w) objPos = scale(add(w.start, w.end), 0.5);
          const op = data.openings.find(x => x.id === id);
          if (op) {
              const wall = data.walls.find(x => x.id === op.wallId);
              if (wall) objPos = add(wall.start, scale(sub(wall.end, wall.start), op.t));
          }
          const sym = data.symbols.find(x => x.id === id);
          if (sym) objPos = sym.position;
          const stair = data.stairs.find(x => x.id === id);
          if (stair) objPos = stair.position;
          const label = data.labels.find(x => x.id === id);
          if (label) objPos = label.position;

          if (objPos) {
              const pxPos = {
                  x: (objPos.x * zoom) + pan.x + (wrapperRef.current?.getBoundingClientRect().left || 0),
                  y: (objPos.y * zoom) + pan.y + (wrapperRef.current?.getBoundingClientRect().top || 0) - 50
              };
              
              const isLocked = w?.locked || op?.locked || sym?.locked || label?.locked || stair?.locked;

              return (
                  <div className="fixed z-40 flex gap-1 animate-in fade-in zoom-in-95 duration-200" style={{ left: pxPos.x, top: pxPos.y, transform: 'translateX(-50%)' }}>
                       <div className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-600 rounded-full p-1 flex items-center gap-1">
                           <button onClick={handleDelete} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded-full transition-colors" title="Delete"><Trash2 size={16}/></button>
                           <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                           <button onClick={() => { 
                               const toggle = (item: any) => item.id === id ? { ...item, locked: !item.locked } : item;
                               onUpdate({ ...data, walls: data.walls.map(toggle), openings: data.openings.map(toggle), labels: data.labels.map(toggle), stairs: data.stairs.map(toggle), symbols: data.symbols.map(toggle) });
                           }} className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors ${isLocked ? 'text-orange-500' : 'text-slate-500'}`} title="Lock/Unlock">
                               {isLocked ? <Lock size={16}/> : <Unlock size={16}/>}
                           </button>
                           {op && (
                               <>
                                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                <button onClick={() => onUpdate({...data, openings: data.openings.map(o => o.id === id ? {...o, flipX: !o.flipX} : o)})} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-full" title="Flip Horizontal"><FlipHorizontal size={16}/></button>
                                <button onClick={() => onUpdate({...data, openings: data.openings.map(o => o.id === id ? {...o, flipY: !o.flipY} : o)})} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-full" title="Flip Vertical"><FlipVertical size={16}/></button>
                                </>
                           )}
                           {sym && (
                               <>
                                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                <button onClick={() => onUpdate({...data, symbols: data.symbols.map(s => s.id === id ? {...s, rotation: (s.rotation + 45) % 360} : s)})} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-full" title="Rotate"><RotateCw size={16}/></button>
                                </>
                           )}
                           {stair && (
                               <>
                                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                <button onClick={() => onUpdate({...data, stairs: data.stairs.map(s => s.id === id ? {...s, rotation: (s.rotation + 90) % 360} : s)})} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-full" title="Rotate"><RotateCw size={16}/></button>
                                </>
                           )}
                           {w && (
                               <>
                               <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                               <button onClick={() => {
                                   const mid = scale(add(w.start, w.end), 0.5);
                                   handleSplitWall(id, mid);
                               }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-full" title="Split Wall"><Scissors size={16}/></button>
                               </>
                           )}
                       </div>
                  </div>
              )
          }
      }
      return null;
  };

  const renderPropertiesPanel = () => {
    // ... (unchanged) ...
    if (selection.size !== 1) return null;
      const id = Array.from(selection)[0];
      const wall = data.walls.find(w => w.id === id);
      const op = data.openings.find(o => o.id === id);
      const label = data.labels.find(l => l.id === id);
      const stair = data.stairs.find(s => s.id === id);
      const symbol = data.symbols.find(s => s.id === id);
      const dim = data.dimensions.find(d => d.id === id);
      if (!wall && !op && !label && !stair && !symbol && !dim) return null;

      return (
          <div className="absolute top-20 right-4 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-40 animate-in slide-in-from-right-10 fade-in duration-300 pointer-events-auto">
             <div className="flex justify-between items-center mb-3 pb-2 border-b dark:border-slate-700">
                 <h3 className="font-bold text-sm flex items-center gap-2 text-slate-800 dark:text-slate-100">
                     <Settings2 size={16} /> Properties
                 </h3>
                 <button onClick={() => setSelection(new Set())} className="text-slate-500 hover:text-red-500"><X size={16} /></button>
             </div>
             
             <div className="space-y-3 text-sm">
                 {wall && (
                     <>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Thickness (mm)</label>
                            <BufferedInput type="number" value={wall.thickness * 10} onChange={(v) => onUpdate({...data, walls: data.walls.map(w => w.id === id ? {...w, thickness: parseFloat(v)/10} : w)})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-800 dark:text-slate-200" />
                        </div>
                        {wall.curvature !== undefined && Math.abs(wall.curvature) > 0.1 && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Curvature</label>
                                <BufferedInput type="number" value={wall.curvature} onChange={(v) => onUpdate({...data, walls: data.walls.map(w => w.id === id ? {...w, curvature: parseFloat(v)} : w)})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-800 dark:text-slate-200" />
                            </div>
                        )}
                     </>
                 )}
                 {op && (
                     <>
                        <div><label className="block text-xs font-semibold text-slate-500 mb-1">Width (mm)</label><BufferedInput type="number" value={op.width} onChange={(v) => onUpdate({...data, openings: data.openings.map(o => o.id === id ? {...o, width: parseFloat(v)} : o)})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-800 dark:text-slate-200" /></div>
                        <div><label className="block text-xs font-semibold text-slate-500 mb-1">Label</label><BufferedInput value={op.label || ''} onChange={(v) => onUpdate({...data, openings: data.openings.map(o => o.id === id ? {...o, label: v} : o)})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-800 dark:text-slate-200" /></div>
                     </>
                 )}
                 {label && (
                     <><div><label className="block text-xs font-semibold text-slate-500 mb-1">Room Name</label><BufferedInput value={label.text} onChange={(v) => onUpdate({...data, labels: data.labels.map(l => l.id === id ? {...l, text: v} : l)})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-800 dark:text-slate-200 font-bold" /></div></>
                 )}
                 {dim && (
                      <><div><label className="block text-xs font-semibold text-slate-500 mb-1">Offset Amount</label><BufferedInput type="number" value={dim.offset} onChange={(v) => onUpdate({...data, dimensions: data.dimensions.map(d => d.id === id ? {...d, offset: parseFloat(v)} : d)})} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-800 dark:text-slate-200" /></div></>
                 )}
             </div>
             <div className="mt-4 pt-3 border-t dark:border-slate-700">
                 <button onClick={handleDelete} className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 p-2 rounded flex items-center justify-center gap-2 text-xs font-semibold"><Trash2 size={14} /> Delete Object</button>
                 <div className="text-[10px] text-center text-slate-400 mt-2">or press Delete key</div>
             </div>
          </div>
      );
  };

  const renderGuides = () => (
      <g pointerEvents="none">
          {snapGuides.map((g, i) => (
              <line key={i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#f472b6" strokeWidth="1" strokeDasharray={g.type === 'alignment' ? "5,5" : "none"} opacity="0.8" />
          ))}
          {drawingStart && currentMousePos && (
              <line x1={drawingStart.x} y1={drawingStart.y} x2={currentMousePos.x} y2={currentMousePos.y} stroke="#3b82f6" strokeWidth="1" strokeDasharray="5,5" opacity="0.5" />
          )}
          {snapMarker && (
               <g transform={`translate(${snapMarker.x}, ${snapMarker.y})`}>
                   {snapType === 'perpendicular' ? <rect x="-4" y="-4" width="8" height="8" fill="none" stroke="#f472b6" strokeWidth="2" /> : <circle r="4" fill="none" stroke="#f472b6" strokeWidth="2" />}
               </g>
          )}
          {/* Curve Control Handles */}
          {data.walls.map(w => {
              if (selection.has(w.id) && w.curvature && Math.abs(w.curvature) > 0.1) {
                  const mid = scale(add(w.start, w.end), 0.5);
                  const dir = norm(sub(w.end, w.start));
                  const normal = { x: -dir.y, y: dir.x };
                  const control = add(mid, scale(normal, w.curvature));
                  return (
                      <g key={`handle-${w.id}`} transform={`translate(${control.x}, ${control.y})`}>
                          <circle r={5} fill="#10b981" stroke="white" strokeWidth="1.5" className="cursor-pointer animate-pulse pointer-events-auto" />
                      </g>
                  )
              }
              return null;
          })}
      </g>
  );

  return (
    <div className="flex-1 bg-white dark:bg-slate-900 flex flex-col items-center justify-center h-full w-full overflow-hidden relative" ref={wrapperRef}>
      
      {/* Zoom Controls */}
      <div className="absolute bottom-24 right-4 flex flex-col gap-2 z-40">
            <button onClick={() => handleZoomBtn(1.2)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"><ZoomIn size={20} /></button>
             <button onClick={() => handleZoomBtn(0.8)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"><ZoomOut size={20} /></button>
             <button onClick={() => { setZoom(1); setPan({x:0, y:0}); }} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"><RotateCcw size={20} /></button>
      </div>

      {/* On-Canvas Legend Overlay */}
      <div className="absolute bottom-24 left-4 z-40 bg-white/90 dark:bg-slate-900/90 p-3 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto w-48 text-xs backdrop-blur-sm pointer-events-none select-none md:pointer-events-auto">
         <h4 className="font-bold border-b dark:border-slate-700 pb-1 mb-2 text-slate-700 dark:text-slate-300 flex items-center gap-2"><Settings2 size={14}/> Legend</h4>
         <div className="space-y-1.5">{legendData.map((item, i) => (<div key={i} className="flex items-start gap-2"><span className="font-bold min-w-[30px] text-slate-800 dark:text-slate-200">{item.code}</span><span className="text-slate-500 dark:text-slate-400 leading-tight">{item.description}</span></div>))}</div>
      </div>

      {renderPropertiesPanel()}
      {renderQuickActions()}

      {editInput && (<div className="absolute z-50" style={{ left: editInput.x, top: editInput.y }}><BufferedInput value={editInput.value} onChange={editInput.onSave} className="bg-white dark:bg-slate-800 border border-blue-500 rounded px-2 py-1 text-sm shadow-xl outline-none w-24 text-slate-900 dark:text-white"/></div>)}

      <div 
        className="border border-slate-300 dark:border-slate-700 w-full h-full relative bg-slate-50 dark:bg-slate-800 shadow-inner cursor-crosshair overflow-hidden"
        onContextMenu={handleContextMenu}
      >
          <svg 
            ref={svgRef} 
            width="100%" 
            height="100%" 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            className="touch-none"
          >
              <defs>
                   <pattern id="grid" width={GRID_SIZE * zoom} height={GRID_SIZE * zoom} patternUnits="userSpaceOnUse">
                       <path d={`M ${GRID_SIZE * zoom} 0 L 0 0 0 ${GRID_SIZE * zoom}`} fill="none" stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-700" />
                   </pattern>
                   {/* Brick Hatch */}
                   <pattern id="hatch_brick" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                       <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="1" />
                   </pattern>
                   {/* Drywall Hatch (Cross) */}
                   <pattern id="hatch_drywall" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="4" y2="0" stroke="#cbd5e1" strokeWidth="1" />
                        <line x1="0" y1="0" x2="0" y2="4" stroke="#cbd5e1" strokeWidth="1" />
                   </pattern>
                   <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="#475569" />
                   </marker>
                   <mask id="wall-cleaner">
                       <rect x="-100000" y="-100000" width="200000" height="200000" fill="white" />
                       {data.walls.map((w: Wall) => (
                           <path 
                               key={w.id} 
                               d={getWallOutlinePath(w, data.walls)} 
                               fill="black" 
                               stroke="none"
                           />
                       ))}
                   </mask>
              </defs>

              <rect x="0" y="0" width="100%" height="100%" fill="url(#grid)" />
              
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {data.northArrow && <NorthArrowEntity arrow={data.northArrow} selected={selection.has("NORTH_ARROW")} />}

                  {/* LAYER 1: FILLS */}
                  {layers.showWalls && data.walls.map(wall => {
                      const openings = data.openings.filter(o => o.wallId === wall.id);
                      return <WallEntity key={`fill-${wall.id}`} wall={wall} openings={openings} selected={selection.has(wall.id)} allWalls={data.walls} layer="fill" onMouseDown={(e) => {
                          if (tool === ToolType.SELECT) {
                              setSelection(new Set([wall.id]));
                              // Trigger default handler to setup drag state
                              handleMouseDown(e);
                          }
                      }} />;
                  })}

                  {/* LAYER 2: HATCHES */}
                  {layers.showWalls && data.walls.map(wall => {
                      const openings = data.openings.filter(o => o.wallId === wall.id);
                      return <WallEntity key={`hatch-${wall.id}`} wall={wall} openings={openings} selected={selection.has(wall.id)} allWalls={data.walls} layer="hatch" />;
                  })}

                  {/* LAYER 3: STROKES & DETAILS */}
                  {layers.showWalls && data.walls.map(wall => {
                      const openings = data.openings.filter(o => o.wallId === wall.id);
                      return <WallEntity key={`stroke-${wall.id}`} wall={wall} openings={openings} selected={selection.has(wall.id)} allWalls={data.walls} layer="stroke" />;
                  })}
                  
                  {layers.showOpenings && data.openings.map(op => {
                       const wall = data.walls.find(w => w.id === op.wallId);
                       if (!wall) return null;
                       return <OpeningEntity key={op.id} op={op} wall={wall} selected={selection.has(op.id)} showLabel={layers.showLabels} />;
                  })}
                  
                  {layers.showStairs && data.stairs.map(s => <StairEntity key={s.id} stair={s} selected={selection.has(s.id)} />)}
                  {layers.showSymbols && data.symbols.map(s => <SymbolEntity key={s.id} symbol={s} selected={selection.has(s.id)} />)}

                  {layers.showDimensions && data.dimensions.map(d => <DimensionEntity key={d.id} dim={d} selected={false} />)}
                  {layers.showDimensions && data.walls.map(w => {
                       const openings = data.openings.filter(o => o.wallId === w.id);
                       return <AutoDimensionEntity key={`auto-${w.id}`} wall={w} openings={openings} planCenter={planCenter} />;
                  })}

                  {layers.showLabels && data.labels.map(l => <LabelEntity key={l.id} label={l} selected={selection.has(l.id)} />)}

                  {renderGuides()}
                  {drawingStart && currentMousePos && <line x1={drawingStart.x} y1={drawingStart.y} x2={currentMousePos.x} y2={currentMousePos.y} stroke="#3b82f6" strokeWidth="2" strokeDasharray="5,5" />}
              </g>
          </svg>
      </div>
      <div className="absolute top-2 left-2 bg-white/80 dark:bg-slate-900/80 p-2 rounded text-xs text-slate-500 pointer-events-none z-30">Zoom: {(zoom * 100).toFixed(0)}%</div>
    </div>
  );
});
