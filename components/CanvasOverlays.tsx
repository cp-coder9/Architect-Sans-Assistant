import React, { useMemo } from 'react';
import { PlanData, Point } from '../types';
import { List, ZoomIn, ZoomOut, Lock, Unlock, Trash2, Copy, RotateCw, RefreshCw, X, FlipHorizontal, FlipVertical } from 'lucide-react';
import { generateLegendData } from './CanvasEntities';
import { deleteObject, toggleLock } from '../utils/actions';
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

    const isLocked = useMemo(() => {
        if (!contextMenu?.targetId) return false;
        const id = contextMenu.targetId;
        if (id === 'BACKGROUND') return data.background?.locked;
        const wall = data.walls.find(w => w.id === id);
        if (wall) return wall.locked;
        const opening = data.openings.find(o => o.id === id);
        if (opening) return opening.locked;
        const symbol = data.symbols.find(s => s.id === id);
        if (symbol) return symbol.locked;
        return false;
    }, [contextMenu, data]);

    // Actions
    const handleDelete = () => {
        if (!contextMenu?.targetId) return;
        const updatedData = deleteObject(data, contextMenu.targetId);
        onUpdate(updatedData, true);
        setContextMenu(null);
        setSelectedId(null);
    };

    const handleLock = () => {
        if (!contextMenu?.targetId) return;
        const updatedData = toggleLock(data, contextMenu.targetId);
        onUpdate(updatedData, true);
        setContextMenu(null);
    };

    const handleFlip = (axis: 'x' | 'y') => {
        if (!contextMenu?.targetId) return;
        const idToFlip = contextMenu.targetId;
        setContextMenu(null);
        const op = data.openings.find(o => o.id === idToFlip);
        if (op) {
            onUpdate({
                ...data,
                openings: data.openings.map(o => o.id === idToFlip ? { ...o, [axis === 'x' ? 'flipX' : 'flipY']: !o[axis === 'x' ? 'flipX' : 'flipY'] } : o)
            }, true);
        }
    }

    const handleRotate = (deg: number) => {
        if (!contextMenu?.targetId) return;
        const idToRotate = contextMenu.targetId;
        setContextMenu(null);
        const sym = data.symbols.find(s => s.id === idToRotate);
        if (sym) {
            onUpdate({
                ...data,
                symbols: data.symbols.map(s => s.id === idToRotate ? { ...s, rotation: (s.rotation + deg) % 360 } : s)
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
                                {isLocked ? <Unlock size={14} /> : <Lock size={14} />} {isLocked ? 'Unlock' : 'Lock'}
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
