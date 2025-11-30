import React, { useMemo } from 'react';
import { PlanData, Point } from '../types';
import { List, ZoomIn, ZoomOut, Lock, Unlock, Trash2, Copy, RotateCw, RefreshCw, X, FlipHorizontal, FlipVertical, Group, Ungroup } from 'lucide-react';
import { generateLegendData } from './CanvasEntities';
import { deleteObject, toggleLock, duplicateObject } from '../utils/actions';
import { dist } from '../utils/geometry';

// Context Menu Component with Grouping Support
const ContextMenu: React.FC<{
    contextMenu: { x: number, y: number, type: 'wall' | 'opening' | 'symbol' | 'background' | 'canvas', targetId?: string } | null;
    data: PlanData;
    onUpdate: (data: PlanData, addToHistory?: boolean) => void;
    onClose: () => void;
    onDelete: (id: string) => void;
    onLock: (id: string) => void;
    onDuplicate: (id: string) => void;
    onFlip: (axis: 'x' | 'y') => void;
    onRotate: (deg: number) => void;
}> = ({ contextMenu, data, onUpdate, onClose, onDelete, onLock, onDuplicate, onFlip, onRotate }) => {

    const menuItems = useMemo(() => {
        if (!contextMenu) return [];

        const items = [];

        if (contextMenu.type === 'canvas') {
            items.push({ label: 'Paste (not implemented)', action: () => {}, disabled: true, icon: Copy });
        } else {
            // Grouping options for walls
            const wall = data.walls.find(w => w.id === contextMenu.targetId);
            if (wall && wall.groupId) {
                const groupMembers = data.walls.filter(w => w.groupId === wall.groupId);
                items.push({
                    label: `Ungroup (${groupMembers.length} walls)`,
                    action: () => {
                        const updatedWalls = data.walls.map(w =>
                            w.id === wall.id ? { ...w, groupId: undefined } : w
                        );
                        onUpdate({ ...data, walls: updatedWalls }, true);
                    },
                    disabled: false,
                    icon: Ungroup
                });
            } else if (wall) {
                items.push({ label: 'Group (select more)', action: () => console.log('Multi-select not implemented'), disabled: true, icon: Group });
            }

            // Standard actions
            const isLocked = (() => {
                if (!contextMenu.targetId) return false;
                const id = contextMenu.targetId;
                if (id === 'BACKGROUND') return data.background?.locked;
                const wall = data.walls.find(w => w.id === id);
                if (wall) return wall.locked;
                const opening = data.openings.find(o => o.id === id);
                if (opening) return opening.locked;
                const symbol = data.symbols.find(s => s.id === id);
                if (symbol) return symbol.locked;
                return false;
            })();

items.push(
    { label: isLocked ? 'Unlock Position' : 'Lock Position', action: () => onLock(contextMenu.targetId!), disabled: false, icon: isLocked ? Unlock : Lock },
    { label: 'Duplicate', action: () => onDuplicate(contextMenu.targetId!), disabled: false, icon: Copy },
    { label: 'Delete', action: () => onDelete(contextMenu.targetId!), disabled: false, icon: Trash2 }
);

            // Symbol actions
            if (contextMenu.type === 'symbol') {
                items.push(
                    { label: 'Rotate +90°', action: () => onRotate(90), disabled: false, icon: RotateCw },
                    { label: 'Rotate -90°', action: () => onRotate(-90), disabled: false, icon: RefreshCw }
                );
            }

            // Opening actions
            if (contextMenu.type === 'opening') {
                items.push(
                    { label: 'Flip Horizontal', action: () => onFlip('x'), disabled: false, icon: FlipHorizontal },
                    { label: 'Flip Vertical', action: () => onFlip('y'), disabled: false, icon: FlipVertical }
                );
            }
        }

        return items;
    }, [contextMenu, data, onUpdate, onLock, onDelete, onFlip, onRotate]);

    if (!contextMenu) return null;

    return (
        <div
            className="absolute z-[100] bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseLeave={onClose}
        >
            <div className="px-2 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider border-b dark:border-slate-700 mb-1">
                {contextMenu.type.toUpperCase()} ACTIONS
            </div>

            {menuItems.map((item, index) => (
                <button
                    key={index}
                    className={`w-full text-left px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-2 transition-colors ${
                        item.disabled ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300'
                    }`}
                    onClick={() => {
                        if (!item.disabled) {
                            item.action();
                            onClose();
                        }
                    }}
                    disabled={item.disabled}
                >
                    {React.createElement(item.icon, { size: 14 })}
                    {item.label}
                </button>
            ))}
        </div>
    );
};

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

    const handleDuplicate = (id: string) => {
        const updatedData = duplicateObject(data, id);
        onUpdate(updatedData, true);
        setContextMenu(null);
        // Select the new duplicated object if applicable
        if (id !== 'BACKGROUND') {
            const walls = data.walls.map((w, idx) => ({ id: `temp-${idx}`, ...w }));
            const newWalls = (updatedData as any).walls.slice(walls.length);
            const newOpenings = (updatedData as any).openings.slice(data.openings.length);
            const newSymbols = (updatedData as any).symbols.slice(data.symbols.length);

            if (newWalls.length > 0) setSelectedId(newWalls[0].id);
            else if (newOpenings.length > 0) setSelectedId(newOpenings[0].id);
            else if (newSymbols.length > 0) setSelectedId(newSymbols[0].id);
        }
    };

    return (
        <>
            {/* Quick Actions Context Menu */}
            <ContextMenu
                contextMenu={contextMenu}
                data={data}
                onUpdate={onUpdate}
                onClose={() => setContextMenu(null)}
                onDelete={handleDelete}
                onLock={handleLock}
                onDuplicate={handleDuplicate}
                onFlip={handleFlip}
                onRotate={handleRotate}
            />

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
