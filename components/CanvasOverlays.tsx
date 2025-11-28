import React, { useMemo } from 'react';
import { PlanData, Point } from '../types';
import { List, ZoomIn, ZoomOut, Lock, Unlock, Trash2, Copy, RotateCw, RefreshCw, X, FlipHorizontal, FlipVertical } from 'lucide-react';
import { generateLegendData } from './CanvasEntities';
import { dist } from '../utils/geometry';

interface CanvasOverlaysProps {
    data: PlanData;
    onUpdate: (data: PlanData, addToHistory?: boolean) => void;
    zoom: number;
    setZoom: (z: number | ((prev: number) => number)) => void;
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
    showLegend: boolean;
    setShowLegend: (show: boolean) => void;
    mousePos: Point;
    contextMenu: { x: number, y: number, type: 'wall' | 'opening' | 'symbol' | 'background' | 'canvas', targetId?: string } | null;
    setContextMenu: (cm: any) => void;
}

export const CanvasOverlays: React.FC<CanvasOverlaysProps> = ({
    data, onUpdate, zoom, setZoom, selectedId, setSelectedId, showLegend, setShowLegend, mousePos, contextMenu, setContextMenu
}) => {
    const legendData = useMemo(() => generateLegendData(data), [data]);
    
    // Derived selected object
    const selectedObject = useMemo(() => {
        if (!selectedId) return null;
        if (selectedId === 'BACKGROUND') return data.background ? { type: 'background', ...data.background } : null;
        
        const wall = data.walls.find(w => w.id === selectedId);
        if (wall) return { type: 'wall', ...wall };
        
        const opening = data.openings.find(o => o.id === selectedId);
        if (opening) return { type: 'opening', ...opening };
        
        const symbol = data.symbols.find(s => s.id === selectedId);
        if (symbol) return { type: 'symbol', ...symbol };

        const label = data.labels.find(l => l.id === selectedId);
        if (label) return { type: 'label', ...label };

        return null;
    }, [selectedId, data]);

    // Actions
    const handleDelete = () => {
        if (!selectedId) return;
        setContextMenu(null);
        if (selectedId === 'BACKGROUND') {
            onUpdate({ ...data, background: undefined }, true);
            setSelectedId(null);
            return;
        }
        onUpdate({
            ...data,
            walls: data.walls.filter(w => w.id !== selectedId),
            openings: data.openings.filter(o => o.id !== selectedId && o.wallId !== selectedId), // Remove openings if wall deleted
            symbols: data.symbols.filter(s => s.id !== selectedId),
            labels: data.labels.filter(l => l.id !== selectedId),
            stairs: data.stairs.filter(s => s.id !== selectedId),
            dimensions: data.dimensions.filter(d => d.id !== selectedId),
        }, true);
        setSelectedId(null);
    };

    const handleLock = () => {
         if (!selectedId) return;
         setContextMenu(null);
         if (selectedId === 'BACKGROUND' && data.background) {
             onUpdate({ ...data, background: { ...data.background, locked: !data.background.locked } }, true);
             return;
         }
         // Generic toggle lock logic would require checking type, doing simpler per-type logic here
         const wall = data.walls.find(w => w.id === selectedId);
         if(wall) { onUpdate({...data, walls: data.walls.map(w => w.id === selectedId ? {...w, locked: !w.locked} : w)}, true); return; }
         const op = data.openings.find(o => o.id === selectedId);
         if(op) { onUpdate({...data, openings: data.openings.map(o => o.id === selectedId ? {...o, locked: !o.locked} : o)}, true); return; }
         const sym = data.symbols.find(s => s.id === selectedId);
         if(sym) { onUpdate({...data, symbols: data.symbols.map(s => s.id === selectedId ? {...s, locked: !s.locked} : s)}, true); return; }
    };

    const handleFlip = (axis: 'x' | 'y') => {
        setContextMenu(null);
        const op = data.openings.find(o => o.id === selectedId);
        if (op) {
            onUpdate({
                ...data,
                openings: data.openings.map(o => o.id === selectedId ? { ...o, [axis === 'x' ? 'flipX' : 'flipY']: !o[axis === 'x' ? 'flipX' : 'flipY'] } : o)
            }, true);
        }
    }

    const handleRotate = (deg: number) => {
        setContextMenu(null);
        const sym = data.symbols.find(s => s.id === selectedId);
        if (sym) {
            onUpdate({
                ...data,
                symbols: data.symbols.map(s => s.id === selectedId ? { ...s, rotation: (s.rotation + deg) % 360 } : s)
            }, true);
        }
    };

    return (
        <>
            {/* Quick Actions Context Menu */}
            {contextMenu && (
                <div 
                    className="absolute z-[100] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100 origin-top-left"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <div className="px-2 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider border-b dark:border-slate-700 mb-1">
                        {contextMenu.type.toUpperCase()} ACTIONS
                    </div>
                    
                    {contextMenu.type !== 'canvas' && (
                        <>
                            <button onClick={handleDelete} className="w-full text-left px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex items-center gap-2">
                                <Trash2 size={14} /> Delete
                            </button>
                            <button onClick={handleLock} className="w-full text-left px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex items-center gap-2">
                                {selectedObject?.locked ? <Unlock size={14} /> : <Lock size={14} />} 
                                {selectedObject?.locked ? 'Unlock' : 'Lock'}
                            </button>
                        </>
                    )}

                    {contextMenu.type === 'symbol' && (
                        <>
                            <button onClick={() => handleRotate(90)} className="w-full text-left px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex items-center gap-2">
                                <RotateCw size={14} /> Rotate +90°
                            </button>
                            <button onClick={() => handleRotate(-90)} className="w-full text-left px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex items-center gap-2">
                                <RefreshCw size={14} /> Rotate -90°
                            </button>
                        </>
                    )}

                    {contextMenu.type === 'opening' && (
                        <>
                             <button onClick={() => handleFlip('x')} className="w-full text-left px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex items-center gap-2">
                                <FlipHorizontal size={14} /> Flip Horizontal
                            </button>
                            <button onClick={() => handleFlip('y')} className="w-full text-left px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex items-center gap-2">
                                <FlipVertical size={14} /> Flip Vertical
                            </button>
                        </>
                    )}

                    {contextMenu.type === 'canvas' && (
                         <div className="px-2 py-2 text-xs text-slate-500 italic text-center">No object selected</div>
                    )}
                </div>
            )}

            {/* Properties Panel (Top Right) - Replaces Context Menu Properties */}
            {selectedObject && !contextMenu && (
                <div className="absolute top-4 right-4 z-40 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl animate-in slide-in-from-right-5 fade-in duration-300">
                    <div className="flex items-center justify-between p-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-t-lg">
                        <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                            {selectedObject.type} Properties
                        </span>
                        <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X size={14} />
                        </button>
                    </div>
                    
                    <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {/* ID Field */}
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">ID</label>
                            <div className="text-xs font-mono bg-slate-100 dark:bg-slate-800 p-1.5 rounded text-slate-600 dark:text-slate-400 truncate">
                                {selectedId}
                            </div>
                        </div>

                        {/* Wall Properties */}
                        {selectedObject.type === 'wall' && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Thickness (mm)</label>
                                    <input 
                                        type="number" 
                                        value={(selectedObject as any).thickness * 10} 
                                        onChange={(e) => onUpdate({...data, walls: data.walls.map(w => w.id === selectedId ? {...w, thickness: parseInt(e.target.value)/10} : w)}, true)}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Length (mm)</label>
                                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        {Math.round(dist((selectedObject as any).start, (selectedObject as any).end) * 10)}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Symbol Properties */}
                        {selectedObject.type === 'symbol' && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Rotation (°)</label>
                                    <input 
                                        type="number" 
                                        value={Math.round((selectedObject as any).rotation)} 
                                        onChange={(e) => onUpdate({...data, symbols: data.symbols.map(s => s.id === selectedId ? {...s, rotation: parseInt(e.target.value)} : s)}, true)}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Scale</label>
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        value={(selectedObject as any).scale || 1} 
                                        onChange={(e) => onUpdate({...data, symbols: data.symbols.map(s => s.id === selectedId ? {...s, scale: parseFloat(e.target.value)} : s)}, true)}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </>
                        )}
                        
                        {/* Opening Properties */}
                        {selectedObject.type === 'opening' && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Width (mm)</label>
                                    <input 
                                        type="number" 
                                        value={(selectedObject as any).width} 
                                        onChange={(e) => onUpdate({...data, openings: data.openings.map(o => o.id === selectedId ? {...o, width: parseInt(e.target.value)} : o)}, true)}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                 <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Label</label>
                                    <input 
                                        type="text" 
                                        value={(selectedObject as any).label || ''} 
                                        onChange={(e) => onUpdate({...data, openings: data.openings.map(o => o.id === selectedId ? {...o, label: e.target.value} : o)}, true)}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </>
                        )}

                        <div className="pt-2 border-t dark:border-slate-700 flex gap-2">
                             <button 
                                onClick={handleLock} 
                                className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${selectedObject.locked ? 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-900/20 dark:border-orange-800' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}
                             >
                                 {selectedObject.locked ? 'Unlock' : 'Lock Position'}
                             </button>
                             <button 
                                onClick={handleDelete}
                                className="flex-1 py-1.5 rounded text-xs font-medium bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
                             >
                                 Delete Object
                             </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend Toggle Button */}
            <div className="absolute top-4 left-4 z-50">
                <button 
                    onClick={() => setShowLegend(!showLegend)} 
                    className={`p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${showLegend ? 'text-blue-500' : 'text-slate-500'}`}
                    title="Toggle Legend"
                >
                    <List size={20} />
                </button>
            </div>

            {/* Legend Overlay */}
            {showLegend && legendData.length > 0 && (
                <div className="absolute top-16 left-4 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-4 max-h-[60vh] overflow-y-auto min-w-[200px] animate-in slide-in-from-left-2 fade-in duration-200">
                    <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-3 tracking-wider">Legend</h3>
                    <div className="space-y-2">
                        {legendData.map((item, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm">
                                <div className="font-mono font-bold text-slate-900 dark:text-white w-8">{item.code}</div>
                                <div className="text-slate-600 dark:text-slate-300 text-xs">{item.description}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* View Controls Overlay */}
            <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-50">
                <button onClick={() => setZoom(z => z * 1.2)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl hover:bg-slate-50 text-slate-700 dark:text-slate-200"><ZoomIn size={20} /></button>
                <button onClick={() => setZoom(z => z / 1.2)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl hover:bg-slate-50 text-slate-700 dark:text-slate-200"><ZoomOut size={20} /></button>
            </div>
            
             <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-800/90 p-2 rounded text-xs font-mono text-slate-500 shadow pointer-events-none">
                {Math.round(mousePos.x)}, {Math.round(mousePos.y)}
            </div>
        </>
    );
};
