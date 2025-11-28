
import React, { useState } from 'react';
import { Square, DoorOpen, LayoutTemplate, Type, MousePointer2, Ruler, Download, ShieldCheck, FileSignature, Undo2, Redo2, BoxSelect, Spline, Scaling, Footprints, Armchair, RectangleHorizontal, BrickWall, BookOpen, GalleryVertical, Maximize, Minimize, ArrowLeftRight, FileImage, FileType, Hand, Sparkles, Save } from 'lucide-react';
import { ToolType } from '../types';
import { SYMBOL_CATALOG } from './CanvasEntities';

interface ToolbarProps {
  activeTool: ToolType;
  setTool: (t: ToolType) => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onCheckCompliance: () => void;
  onEditMetadata: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  onAIEdit: () => void;

  activeSymbolId: string;
  onSymbolSelect: (id: string) => void;
  activeSymbolCategory: string;
  onSymbolCategorySelect: (category: string) => void;
  
  activeWallThickness: number;
  onWallThicknessChange: (thickness: number) => void;
  
  activeDoorType: string;
  onDoorTypeChange: (type: string) => void;
  
  activeWindowType: string;
  onWindowTypeChange: (type: string) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  activeTool, 
  setTool, 
  onExportSvg,
  onExportPng,
  onExportPdf,
  onCheckCompliance, 
  onEditMetadata,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onAIEdit,
  activeSymbolId,
  onSymbolSelect,
  activeSymbolCategory,
  onSymbolCategorySelect,
  activeWallThickness,
  onWallThicknessChange,
  activeDoorType,
  onDoorTypeChange,
  activeWindowType,
  onWindowTypeChange
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const tools = [
    { id: ToolType.SELECT, icon: MousePointer2, label: 'Select' },
    { id: ToolType.PAN, icon: Hand, label: 'Pan' },
    { id: ToolType.WALL, icon: Square, label: 'Wall' },
    { id: ToolType.ARCH_WALL, icon: Spline, label: 'Arc Wall' },
    { id: ToolType.SQUARE_ROOM, icon: BoxSelect, label: 'Room' },
    { id: ToolType.STAIR, icon: Footprints, label: 'Stair' },
    { id: ToolType.DOOR, icon: DoorOpen, label: 'Door' },
    { id: ToolType.WINDOW, icon: LayoutTemplate, label: 'Window' },
    { id: ToolType.SYMBOL, icon: Armchair, label: 'Symbol' },
    { id: ToolType.DIMENSION, icon: Ruler, label: 'Dimension' },
    { id: ToolType.ROOM_LABEL, icon: Type, label: 'Label' },
    { id: ToolType.CALIBRATE, icon: Scaling, label: 'Scale' },
  ];

  const wallTypes = [
      { id: 23, label: 'Exterior (230mm)', icon: BrickWall },
      { id: 11, label: 'Interior (110mm)', icon: RectangleHorizontal },
      { id: 9, label: 'Drywall (90mm)', icon: Minimize },
  ];

  const doorTypes = [
      { id: 'single', label: 'Single Swing', icon: DoorOpen },
      { id: 'double', label: 'Double Swing', icon: BookOpen },
      { id: 'sliding', label: 'Sliding Door', icon: ArrowLeftRight },
  ];
  
  const windowTypes = [
      { id: 'standard', label: 'Standard Casement', icon: LayoutTemplate },
      { id: 'sliding', label: 'Sliding Window', icon: GalleryVertical },
      { id: 'fixed', label: 'Fixed Glass', icon: Maximize },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 w-auto max-w-[95vw]">
        
        {/* Main Floating Bar */}
        <div className="flex items-center gap-2 p-2 rounded-2xl shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/20 dark:border-slate-700 resize-x overflow-x-auto overflow-y-hidden min-w-[fit-content]" style={{ maxWidth: '95vw' }}>
            
            {/* History & Save Group */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-200 dark:border-slate-700 shrink-0">
                <button 
                    onClick={onSave} 
                    className="group relative p-2 rounded-xl transition-all hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    title="Save Project"
                >
                    <Save size={20} />
                </button>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <button 
                    onClick={onUndo} 
                    disabled={!canUndo}
                    className={`group relative p-2 rounded-xl transition-all ${!canUndo ? 'opacity-30 cursor-not-allowed text-slate-500' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
                    title="Undo"
                >
                    <Undo2 size={20} />
                </button>
                <button 
                    onClick={onRedo} 
                    disabled={!canRedo}
                    className={`group relative p-2 rounded-xl transition-all ${!canRedo ? 'opacity-30 cursor-not-allowed text-slate-500' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
                    title="Redo"
                >
                    <Redo2 size={20} />
                </button>
            </div>

            {/* Drawing Tools Group */}
            <div className="flex items-center gap-1 px-1 overflow-x-auto no-scrollbar">
                {tools.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTool(t.id)}
                        className={`group relative p-2 rounded-xl transition-all duration-200 flex flex-col items-center min-w-[44px] ${
                            activeTool === t.id 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                            : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}
                        title={t.label}
                    >
                        <t.icon size={22} strokeWidth={activeTool === t.id ? 2.5 : 2} />
                    </button>
                ))}
            </div>

            {/* Actions Group */}
            <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700 shrink-0 relative">
                <button onClick={onAIEdit} className="p-2 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400" title="AI Edit">
                    <Sparkles size={20} />
                </button>
                <button onClick={onEditMetadata} className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400" title="Project Info">
                    <FileSignature size={20} />
                </button>
                <button onClick={onCheckCompliance} className="p-2 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" title="Check SANS Compliance">
                    <ShieldCheck size={20} />
                </button>
                
                <div className="relative">
                    <button 
                        onClick={() => setShowExportMenu(!showExportMenu)} 
                        className={`p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 ${showExportMenu ? 'bg-slate-200 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} 
                        title="Export Sheet"
                    >
                        <Download size={20} />
                    </button>
                    {showExportMenu && (
                        <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-1 min-w-[140px] animate-in slide-in-from-bottom-2">
                             <button onClick={() => { onExportPdf(); setShowExportMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-left">
                                 <FileType size={16} className="text-red-500"/> PDF (A3)
                             </button>
                             <button onClick={() => { onExportPng(); setShowExportMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-left">
                                 <FileImage size={16} className="text-blue-500"/> PNG Image
                             </button>
                             <button onClick={() => { onExportSvg(); setShowExportMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-left">
                                 <Spline size={16} className="text-orange-500"/> SVG Vector
                             </button>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Context Drawers */}
        
        {/* Wall Type Drawer */}
        {(activeTool === ToolType.WALL || activeTool === ToolType.ARCH_WALL || activeTool === ToolType.SQUARE_ROOM) && (
            <div className="animate-in slide-in-from-bottom-2 fade-in duration-300 w-full">
                <div className="p-2 rounded-xl shadow-lg backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700 flex justify-center gap-4">
                    {wallTypes.map(w => (
                        <button
                            key={w.id}
                            onClick={() => onWallThicknessChange(w.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${Math.round(activeWallThickness) === w.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                        >
                            <w.icon size={14} />
                            {w.label}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Door Type Drawer */}
        {activeTool === ToolType.DOOR && (
            <div className="animate-in slide-in-from-bottom-2 fade-in duration-300 w-full">
                <div className="p-2 rounded-xl shadow-lg backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700 flex justify-center gap-4">
                    {doorTypes.map(d => (
                        <button
                            key={d.id}
                            onClick={() => onDoorTypeChange(d.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeDoorType === d.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                        >
                            <d.icon size={14} />
                            {d.label}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Window Type Drawer */}
        {activeTool === ToolType.WINDOW && (
            <div className="animate-in slide-in-from-bottom-2 fade-in duration-300 w-full">
                <div className="p-2 rounded-xl shadow-lg backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700 flex justify-center gap-4">
                    {windowTypes.map(w => (
                        <button
                            key={w.id}
                            onClick={() => onWindowTypeChange(w.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeWindowType === w.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                        >
                            <w.icon size={14} />
                            {w.label}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Symbol Drawer */}
        {activeTool === ToolType.SYMBOL && (
            <div className="w-full animate-in slide-in-from-bottom-5 fade-in duration-300 origin-bottom max-h-[40vh] flex flex-col">
                <div className="p-3 rounded-2xl shadow-2xl backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700 flex flex-col gap-3 overflow-hidden">
                    {/* Categories */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 shrink-0">
                         {['furniture', 'electrical', 'plumbing', 'hvac', 'annotations'].map(cat => (
                            <button 
                                key={cat}
                                onClick={() => onSymbolCategorySelect(cat)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-colors ${activeSymbolCategory === cat ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    
                    {/* Grid */}
                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 overflow-y-auto pr-1 custom-scrollbar">
                        {SYMBOL_CATALOG.filter(s => s.category === activeSymbolCategory).map(sym => (
                            <button
                                key={sym.id}
                                onClick={() => onSymbolSelect(sym.id)}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all aspect-square ${activeSymbolId === sym.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                title={sym.label}
                            >
                                <div className="w-6 h-6 flex items-center justify-center text-slate-700 dark:text-slate-300">
                                    <svg viewBox={`-${sym.width/2} -${sym.height/2} ${sym.width} ${sym.height}`} className="w-full h-full pointer-events-none">
                                        {sym.render(sym.width, sym.height)}
                                    </svg>
                                </div>
                                <span className="text-[8px] text-center truncate w-full mt-1 text-slate-500 dark:text-slate-400 leading-tight">{sym.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
