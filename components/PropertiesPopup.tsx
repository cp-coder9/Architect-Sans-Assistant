
import React from 'react';
import { PlanData, Wall, Opening, SymbolInstance, Stair, Dimension, RoomLabel } from '../types';
import { X, Copy, Trash2, Lock, Unlock } from 'lucide-react';
import { deleteObject, toggleLock } from '../utils/actions';
import { dist } from '../utils/geometry';

interface PropertiesPopupProps {
  selectedId: string | null;
  data: PlanData;
  onUpdate: (updatedData: PlanData, addToHistory?: boolean) => void;
  onClose: () => void;
  setSelectedId: (id: string | null) => void;
}

const PropertiesPopup: React.FC<PropertiesPopupProps> = ({ selectedId, data, onUpdate, onClose, setSelectedId }) => {
    const { object: selectedObject, type: objectType } = React.useMemo(() => {
    if (!selectedId) return { object: null, type: null };

    if (selectedId === 'BACKGROUND') {
      return { object: { id: 'BACKGROUND', type: 'background', ...(data.background || {}) }, type: 'Background' };
    }
    const wall = data.walls.find(w => w.id === selectedId);
    if (wall) {
        // Check if this wall belongs to a room group
        if (wall.groupId) {
            const roomWalls = data.walls.filter(w => w.groupId === wall.groupId);
            if (roomWalls.length >= 4) {
                // Calculate room properties
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                roomWalls.forEach(w => {
                    minX = Math.min(minX, Math.min(w.start.x, w.end.x));
                    minY = Math.min(minY, Math.min(w.start.y, w.end.y));
                    maxX = Math.max(maxX, Math.max(w.start.x, w.end.x));
                    maxY = Math.max(maxY, Math.max(w.start.y, w.end.y));
                });
                const roomArea = (maxX - minX) * (maxY - minY) / 1000000; // Convert to m²
                return {
                    object: {
                        id: wall.groupId,
                        walls: roomWalls,
                        position: { x: minX, y: minY },
                        size: { width: maxX - minX, height: maxY - minY },
                        area: roomArea,
                        thickness: roomWalls[0].thickness,
                        groupId: wall.groupId,
                        locked: roomWalls.every(w => w.locked)
                    },
                    type: 'Room'
                };
            }
        }
        return { object: wall, type: 'Wall' };
    }
    const opening = data.openings.find(o => o.id === selectedId);
    if (opening) return { object: opening, type: 'Opening' };
    const symbol = data.symbols.find(s => s.id === selectedId);
    if (symbol) return { object: symbol, type: 'Symbol' };
    const stair = data.stairs.find(s => s.id === selectedId);
    if (stair) return { object: stair, type: 'Stair' };
    const dimension = data.dimensions.find(d => d.id === selectedId);
    if (dimension) return { object: dimension, type: 'Dimension' };
    const label = data.labels.find(l => l.id === selectedId);
    if (label) return { object: label, type: 'Room Label' };

    return { object: null, type: null };
  }, [selectedId, data]);

  if (!selectedId || !selectedObject) return null;

  const handleDelete = () => {
    if (!selectedId) return;
    const updatedData = deleteObject(data, selectedId);
    onUpdate(updatedData, true);
    setSelectedId(null);
  };

  const handleLock = () => {
    if (!selectedId) return;
    const updatedData = toggleLock(data, selectedId);
    onUpdate(updatedData, true);
  };

  return (
    <div className="absolute top-4 right-4 z-40 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl animate-in slide-in-from-right-5 fade-in duration-300">
        <div className="flex items-center justify-between p-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-t-lg">
            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                {objectType} Properties
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
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
            {objectType === 'Wall' && (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Start X</label>
                            <input
                                type="number"
                                step="10"
                                value={Math.round((selectedObject as Wall).start.x * 10)}
                                onChange={(e) => onUpdate({...data, walls: data.walls.map(w => w.id === selectedId ? {...w, start: {x: parseInt(e.target.value)/10, y: w.start.y}} : w)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Start Y</label>
                            <input
                                type="number"
                                step="10"
                                value={Math.round((selectedObject as Wall).start.y * 10)}
                                onChange={(e) => onUpdate({...data, walls: data.walls.map(w => w.id === selectedId ? {...w, start: {x: w.start.x, y: parseInt(e.target.value)/10}} : w)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">End X</label>
                            <input
                                type="number"
                                step="10"
                                value={Math.round((selectedObject as Wall).end.x * 10)}
                                onChange={(e) => onUpdate({...data, walls: data.walls.map(w => w.id === selectedId ? {...w, end: {x: parseInt(e.target.value)/10, y: w.end.y}} : w)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">End Y</label>
                            <input
                                type="number"
                                step="10"
                                value={Math.round((selectedObject as Wall).end.y * 10)}
                                onChange={(e) => onUpdate({...data, walls: data.walls.map(w => w.id === selectedId ? {...w, end: {x: w.end.x, y: parseInt(e.target.value)/10}} : w)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Thickness (mm)</label>
                        <input
                            type="number"
                            step="10"
                            value={(selectedObject as Wall).thickness * 10}
                            onChange={(e) => onUpdate({...data, walls: data.walls.map(w => w.id === selectedId ? {...w, thickness: parseInt(e.target.value)/10} : w)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Height (mm)</label>
                        <input
                            type="number"
                            step="50"
                            value={(selectedObject as Wall).height}
                            onChange={(e) => onUpdate({...data, walls: data.walls.map(w => w.id === selectedId ? {...w, height: parseInt(e.target.value)} : w)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Curvature</label>
                        <input
                            type="number"
                            step="50"
                            value={(selectedObject as Wall).curvature || 0}
                            onChange={(e) => onUpdate({...data, walls: data.walls.map(w => w.id === selectedId ? {...w, curvature: parseInt(e.target.value) || undefined} : w)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Length (mm)</label>
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {Math.round(dist((selectedObject as Wall).start, (selectedObject as Wall).end) * 10)}
                        </div>
                    </div>
                </>
            )}

            {/* Symbol Properties */}
            {objectType === 'Symbol' && (
                <>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Rotation (°)</label>
                        <input
                            type="number"
                            value={Math.round((selectedObject as SymbolInstance).rotation)}
                            onChange={(e) => onUpdate({...data, symbols: data.symbols.map(s => s.id === selectedId ? {...s, rotation: parseInt(e.target.value)} : s)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Scale</label>
                        <input
                            type="number"
                            step="0.1"
                            value={(selectedObject as SymbolInstance).scale || 1}
                            onChange={(e) => onUpdate({...data, symbols: data.symbols.map(s => s.id === selectedId ? {...s, scale: parseFloat(e.target.value)} : s)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </>
            )}

            {/* Opening Properties */}
            {objectType === 'Opening' && (
                <>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Type</label>
                        <select
                            value={(selectedObject as Opening).type}
                            onChange={(e) => onUpdate({...data, openings: data.openings.map(o => o.id === selectedId ? {...o, type: e.target.value as 'door' | 'window'} : o)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="door">Door</option>
                            <option value="window">Window</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Sub-Type</label>
                        <select
                            value={(selectedObject as Opening).subType || ''}
                            onChange={(e) => onUpdate({...data, openings: data.openings.map(o => o.id === selectedId ? {...o, subType: e.target.value || undefined} : o)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="">None</option>
                            {(selectedObject as Opening).type === 'door' ? (
                                <>
                                    <option value="single">Single</option>
                                    <option value="double">Double</option>
                                    <option value="sliding">Sliding</option>
                                </>
                            ) : (
                                <>
                                    <option value="standard">Standard</option>
                                    <option value="sliding">Sliding</option>
                                    <option value="fixed">Fixed</option>
                                </>
                            )}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Width (mm)</label>
                            <input
                                type="number"
                                value={(selectedObject as Opening).width}
                                onChange={(e) => onUpdate({...data, openings: data.openings.map(o => o.id === selectedId ? {...o, width: parseInt(e.target.value)} : o)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Height (mm)</label>
                            <input
                                type="number"
                                value={(selectedObject as Opening).height}
                                onChange={(e) => onUpdate({...data, openings: data.openings.map(o => o.id === selectedId ? {...o, height: parseInt(e.target.value)} : o)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Position (t)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="1"
                                value={(selectedObject as Opening).t}
                                onChange={(e) => onUpdate({...data, openings: data.openings.map(o => o.id === selectedId ? {...o, t: parseFloat(e.target.value)} : o)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Sill Height</label>
                            <input
                                type="number"
                                step="50"
                                value={(selectedObject as Opening).sillHeight}
                                onChange={(e) => onUpdate({...data, openings: data.openings.map(o => o.id === selectedId ? {...o, sillHeight: parseInt(e.target.value)} : o)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Label</label>
                        <input
                            type="text"
                            value={(selectedObject as Opening).label || ''}
                            onChange={(e) => onUpdate({...data, openings: data.openings.map(o => o.id === selectedId ? {...o, label: e.target.value} : o)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </>
            )}

            {/* Stair Properties */}
            {objectType === 'Stair' && (
                <>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Type</label>
                        <select
                            value={(selectedObject as Stair).type}
                            onChange={(e) => onUpdate({...data, stairs: data.stairs.map(s => s.id === selectedId ? {...s, type: e.target.value as any} : s)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="STRAIGHT">Straight</option>
                            <option value="L_SHAPE">L-Shape</option>
                            <option value="U_SHAPE">U-Shape</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Position X</label>
                            <input
                                type="number"
                                step="10"
                                value={Math.round((selectedObject as Stair).position.x * 10)}
                                onChange={(e) => onUpdate({...data, stairs: data.stairs.map(s => s.id === selectedId ? {...s, position: {x: parseInt(e.target.value)/10, y: s.position.y}} : s)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Position Y</label>
                            <input
                                type="number"
                                step="10"
                                value={Math.round((selectedObject as Stair).position.y * 10)}
                                onChange={(e) => onUpdate({...data, stairs: data.stairs.map(s => s.id === selectedId ? {...s, position: {x: s.position.x, y: parseInt(e.target.value)/10}} : s)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Width (mm)</label>
                            <input
                                type="number"
                                step="50"
                                value={(selectedObject as Stair).width}
                                onChange={(e) => onUpdate({...data, stairs: data.stairs.map(s => s.id === selectedId ? {...s, width: parseInt(e.target.value)} : s)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Tread Depth</label>
                            <input
                                type="number"
                                step="5"
                                value={(selectedObject as Stair).treadDepth}
                                onChange={(e) => onUpdate({...data, stairs: data.stairs.map(s => s.id === selectedId ? {...s, treadDepth: parseInt(e.target.value)} : s)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Riser Height</label>
                            <input
                                type="number"
                                step="5"
                                value={(selectedObject as Stair).riserHeight}
                                onChange={(e) => onUpdate({...data, stairs: data.stairs.map(s => s.id === selectedId ? {...s, riserHeight: parseInt(e.target.value)} : s)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Total Steps</label>
                            <input
                                type="number"
                                min="1"
                                value={(selectedObject as Stair).count}
                                onChange={(e) => onUpdate({...data, stairs: data.stairs.map(s => s.id === selectedId ? {...s, count: parseInt(e.target.value)} : s)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Rotation (°)</label>
                            <input
                                type="number"
                                step="15"
                                value={(selectedObject as Stair).rotation}
                                onChange={(e) => onUpdate({...data, stairs: data.stairs.map(s => s.id === selectedId ? {...s, rotation: parseInt(e.target.value)} : s)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Label</label>
                        <input
                            type="text"
                            value={(selectedObject as Stair).label || ''}
                            onChange={(e) => onUpdate({...data, stairs: data.stairs.map(s => s.id === selectedId ? {...s, label: e.target.value} : s)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </>
            )}

            {/* Dimension Properties */}
            {objectType === 'Dimension' && (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Start X</label>
                            <input
                                type="number"
                                step="10"
                                value={Math.round((selectedObject as Dimension).start.x * 10)}
                                onChange={(e) => onUpdate({...data, dimensions: data.dimensions.map(d => d.id === selectedId ? {...d, start: {x: parseInt(e.target.value)/10, y: d.start.y}} : d)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Start Y</label>
                            <input
                                type="number"
                                step="10"
                                value={Math.round((selectedObject as Dimension).start.y * 10)}
                                onChange={(e) => onUpdate({...data, dimensions: data.dimensions.map(d => d.id === selectedId ? {...d, start: {x: d.start.x, y: parseInt(e.target.value)/10}} : d)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">End X</label>
                            <input
                                type="number"
                                step="10"
                                value={Math.round((selectedObject as Dimension).end.x * 10)}
                                onChange={(e) => onUpdate({...data, dimensions: data.dimensions.map(d => d.id === selectedId ? {...d, end: {x: parseInt(e.target.value)/10, y: d.end.y}} : d)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">End Y</label>
                            <input
                                type="number"
                                step="10"
                                value={Math.round((selectedObject as Dimension).end.y * 10)}
                                onChange={(e) => onUpdate({...data, dimensions: data.dimensions.map(d => d.id === selectedId ? {...d, end: {x: d.end.x, y: parseInt(e.target.value)/10}} : d)}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Offset</label>
                        <input
                            type="number"
                            step="10"
                            value={(selectedObject as Dimension).offset}
                            onChange={(e) => onUpdate({...data, dimensions: data.dimensions.map(d => d.id === selectedId ? {...d, offset: parseInt(e.target.value)} : d)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Length (mm)</label>
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {Math.round(dist((selectedObject as Dimension).start, (selectedObject as Dimension).end) * 10)}
                        </div>
                    </div>
                </>
            )}

            {/* Room Label Properties */}
            {objectType === 'Room Label' && (
                <>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Position X</label>
                        <input
                            type="number"
                            step="10"
                            value={Math.round((selectedObject as RoomLabel).position.x * 10)}
                            onChange={(e) => onUpdate({...data, labels: data.labels.map(l => l.id === selectedId ? {...l, position: {x: parseInt(e.target.value)/10, y: l.position.y}} : l)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Position Y</label>
                        <input
                            type="number"
                            step="10"
                            value={Math.round((selectedObject as RoomLabel).position.y * 10)}
                            onChange={(e) => onUpdate({...data, labels: data.labels.map(l => l.id === selectedId ? {...l, position: {x: l.position.x, y: parseInt(e.target.value)/10}} : l)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Text</label>
                        <input
                            type="text"
                            value={(selectedObject as RoomLabel).text}
                            onChange={(e) => onUpdate({...data, labels: data.labels.map(l => l.id === selectedId ? {...l, text: e.target.value} : l)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Area (m²)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={(selectedObject as RoomLabel).area || ''}
                            onChange={(e) => onUpdate({...data, labels: data.labels.map(l => l.id === selectedId ? {...l, area: parseFloat(e.target.value) || undefined} : l)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Auto-calculated"
                        />
                    </div>
                </>
            )}

            {/* Background Properties */}
            {objectType === 'Background' && (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Position X</label>
                            <input
                                type="number"
                                step="100"
                                value={Math.round(((selectedObject as any).x || 0) * 10)}
                                onChange={(e) => onUpdate({...data, background: {...data.background, x: parseInt(e.target.value)/10}}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Position Y</label>
                            <input
                                type="number"
                                step="100"
                                value={Math.round(((selectedObject as any).y || 0) * 10)}
                                onChange={(e) => onUpdate({...data, background: {...data.background, y: parseInt(e.target.value)/10}}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Width (mm)</label>
                            <input
                                type="number"
                                step="100"
                                value={Math.round(((selectedObject as any).width || 0) * 10)}
                                onChange={(e) => onUpdate({...data, background: {...data.background, width: parseInt(e.target.value)/10}}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Height (mm)</label>
                            <input
                                type="number"
                                step="100"
                                value={Math.round(((selectedObject as any).height || 0) * 10)}
                                onChange={(e) => onUpdate({...data, background: {...data.background, height: parseInt(e.target.value)/10}}, true)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Opacity</label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={(selectedObject as any).opacity || 0.5}
                            onChange={(e) => onUpdate({...data, background: {...data.background, opacity: parseFloat(e.target.value)}}, true)}
                            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                        />
                        <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                            <span>0%</span>
                            <span>{Math.round(((selectedObject as any).opacity || 0.5) * 100)}%</span>
                            <span>100%</span>
                        </div>
                    </div>
                </>
            )}

            <div className="pt-2 border-t dark:border-slate-700 flex gap-2">
                 <button
                    onClick={handleLock}
                    className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${(selectedObject as any).locked ? 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-900/20 dark:border-orange-800' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}
                 >
                     {(selectedObject as any).locked ? 'Unlock' : 'Lock Position'}
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
  );
};

export default PropertiesPopup;
