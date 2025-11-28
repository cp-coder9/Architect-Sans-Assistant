
import React from 'react';
import { PlanData, Wall, Opening, SymbolInstance } from '../types';
import { X } from 'lucide-react';
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
    if (wall) return { object: wall, type: 'Wall' };
    const opening = data.openings.find(o => o.id === selectedId);
    if (opening) return { object: opening, type: 'Opening' };
    const symbol = data.symbols.find(s => s.id === selectedId);
    if (symbol) return { object: symbol, type: 'Symbol' };

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
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Thickness (mm)</label>
                        <input
                            type="number"
                            value={(selectedObject as Wall).thickness * 10}
                            onChange={(e) => onUpdate({...data, walls: data.walls.map(w => w.id === selectedId ? {...w, thickness: parseInt(e.target.value)/10} : w)}, true)}
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
                        <label className="text-[10px] uppercase font-bold text-slate-500">Width (mm)</label>
                        <input
                            type="number"
                            value={(selectedObject as Opening).width}
                            onChange={(e) => onUpdate({...data, openings: data.openings.map(o => o.id === selectedId ? {...o, width: parseInt(e.target.value)} : o)}, true)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
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
