import React, { useMemo, useState, useRef } from 'react';
import { PlanData, ViewMode, Wall, Opening } from '../types';
import { Settings2, X } from 'lucide-react';

interface Props {
  data: PlanData;
  mode: ViewMode;
  onUpdate: (data: PlanData) => void;
}

// Helper to update deep properties
const updateOpening = (openings: Opening[], id: string, updates: Partial<Opening>) => {
    return openings.map(o => o.id === id ? { ...o, ...updates } : o);
};

// Buffered Input for Performance
const BufferedInput = ({ 
    value, 
    onChange, 
    type = "text", 
    className = "" 
}: { 
    value: string | number, 
    onChange: (val: string) => void, 
    type?: string, 
    className?: string 
}) => {
    const [localValue, setLocalValue] = useState(value);
    
    React.useEffect(() => {
        setLocalValue(value);
    }, [value]);

    return (
        <input 
            type={type}
            className={className}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => onChange(localValue.toString())}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    onChange(localValue.toString());
                    (e.target as HTMLInputElement).blur();
                }
            }}
        />
    );
};

export const ElevationView: React.FC<Props> = ({ data, mode, onUpdate }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Interaction State
  const [dragState, setDragState] = useState<{ id: string, startX: number, startY: number, startT: number, startSill: number, wallId: string } | null>(null);

  // Calculate SANS Compliance Data
  const calculations = useMemo(() => {
      const floorArea = data.labels.length * 12; // Estimated
      const glazingArea = data.openings
        .filter(o => o.type === 'window')
        .reduce((acc, curr) => acc + (curr.width * curr.height) / 1000000, 0);
      const percentage = floorArea > 0 ? (glazingArea / floorArea) * 100 : 0;
      
      return { floorArea, glazingArea, percentage };
  }, [data]);

  // View Transformation
  const groundY = 400;
  const scale = 0.15;

  const screenToWorld = (clientX: number, clientY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      // SVG Viewbox is 0 0 1000 600
      // ground is at 400. Scale is 0.15.
      // Y-axis is flipped in the projection group: translate(50, 400) scale(0.15, -0.15)
      const svgX = (clientX - rect.left) * (1000 / rect.width);
      const svgY = (clientY - rect.top) * (600 / rect.height);
      return { x: svgX, y: svgY };
  };

  const handleMouseDown = (e: React.MouseEvent, op: Opening, wall: Wall, wallLength: number) => {
      e.stopPropagation();
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      setDragState({
          id: op.id,
          startX: x,
          startY: y,
          startT: op.t,
          startSill: op.sillHeight,
          wallId: wall.id
      });
      setSelectedId(op.id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragState) return;
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      
      const wall = data.walls.find(w => w.id === dragState.wallId);
      if (!wall) return;
      const wallLen = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);

      // Calculate Deltas
      // Note: X in SVG coordinates is scaled by 0.15
      // Y in SVG coordinates is scaled by -0.15
      const deltaXScreen = (x - dragState.startX);
      const deltaYScreen = (y - dragState.startY);

      // Convert to World Units
      const deltaXUnits = deltaXScreen / scale;
      const deltaYUnits = deltaYScreen / -scale; // Inverse Y

      // Update T (Horizontal)
      const newT = Math.max(0, Math.min(1, dragState.startT + (deltaXUnits / wallLen)));
      
      // Update Sill (Vertical)
      const newSill = Math.max(0, dragState.startSill + deltaYUnits);

      const newOpenings = updateOpening(data.openings, dragState.id, { t: newT, sillHeight: Math.round(newSill) });
      onUpdate({ ...data, openings: newOpenings });
  };

  const handleMouseUp = () => {
      setDragState(null);
  };

  // Render Logic
  if (mode === ViewMode.SCHEDULE) {
    // ... existing schedule code ...
    const windows = data.openings.filter(o => o.type === 'window');
    const doors = data.openings.filter(o => o.type === 'door');

    return (
      <div className="flex-1 bg-white dark:bg-slate-900 p-8 overflow-auto font-sans text-slate-800 dark:text-slate-200">
        <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white border-b dark:border-slate-700 pb-2">Fenestration Schedule & Energy Compliance</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded border dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Floor Area (Est.)</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{calculations.floorArea.toFixed(1)} m²</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded border dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Glazing Area</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{calculations.glazingArea.toFixed(2)} m²</p>
                </div>
                <div className={`p-4 rounded border dark:border-slate-700 ${calculations.percentage <= 15 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Glazing to Floor Ratio</p>
                    <p className={`text-2xl font-bold ${calculations.percentage <= 15 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {calculations.percentage.toFixed(1)}%
                    </p>
                    <p className="text-xs mt-1 text-slate-600 dark:text-slate-400">SANS 10400-XA Limit: 15%</p>
                </div>
            </div>

            <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-300">Windows ({windows.length})</h3>
            <table className="w-full border-collapse border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                    <th className="border dark:border-slate-700 p-2">ID</th>
                    <th className="border dark:border-slate-700 p-2">Size (WxH)</th>
                    <th className="border dark:border-slate-700 p-2">Area (m²)</th>
                    <th className="border dark:border-slate-700 p-2">Description</th>
                    <th className="border dark:border-slate-700 p-2">U-Value (Target)</th>
                </tr>
                </thead>
                <tbody>
                {windows.map((w, i) => (
                    <tr key={w.id}>
                    <td className="border dark:border-slate-700 p-2 text-center font-bold">W{i + 1}</td>
                    <td className="border dark:border-slate-700 p-2 text-center">{w.width} x {w.height}</td>
                    <td className="border dark:border-slate-700 p-2 text-center">{((w.width * w.height) / 1000000).toFixed(2)}</td>
                    <td className="border dark:border-slate-700 p-2">Aluminium Top Hung</td>
                    <td className="border dark:border-slate-700 p-2 text-center">7.9</td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
            
            <div>
            <h3 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-300">Doors ({doors.length})</h3>
            <table className="w-full border-collapse border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                    <th className="border dark:border-slate-700 p-2">ID</th>
                    <th className="border dark:border-slate-700 p-2">Size (WxH)</th>
                    <th className="border dark:border-slate-700 p-2">Material</th>
                    <th className="border dark:border-slate-700 p-2">Location</th>
                </tr>
                </thead>
                <tbody>
                {doors.map((d, i) => (
                    <tr key={d.id}>
                    <td className="border dark:border-slate-700 p-2 text-center font-bold">D{i + 1}</td>
                    <td className="border dark:border-slate-700 p-2 text-center">{d.width} x {d.height}</td>
                    <td className="border dark:border-slate-700 p-2 text-center">Timber Semi-Solid</td>
                    <td className="border dark:border-slate-700 p-2 text-center">Internal</td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        </div>
      </div>
    );
  }

  // Helper to render vertical dimension line
  const RenderDim = ({ x, y1, y2, val, label = "" }: { x: number, y1: number, y2: number, val: number, label?: string }) => {
      const center = (y1 + y2) / 2;
      return (
          <g>
              <line x1={x} y1={y1} x2={x} y2={y2} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="10" />
              <line x1={x-20} y1={y1} x2={x+20} y2={y1} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="10" />
              <line x1={x-20} y1={y2} x2={x+20} y2={y2} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="10" />
              <g transform={`translate(${x + 60}, ${center}) scale(1, -1)`}>
                <text className="fill-slate-800 dark:fill-slate-200 text-[80px]" textAnchor="start" alignmentBaseline="middle">
                   {Math.round(val)} {label}
                </text>
              </g>
          </g>
      );
  };

  // Properties Panel Logic
  const selectedObj = data.openings.find(o => o.id === selectedId);

  return (
    <div className="flex-1 bg-white dark:bg-slate-900 flex flex-col items-center justify-center h-full w-full overflow-hidden relative">
      
      {/* Properties Panel */}
      {selectedObj && (
          <div className="absolute top-4 right-4 z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-4 w-64">
              <div className="flex justify-between items-center mb-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Settings2 size={14} />
                      Elevation Properties
                  </h3>
                  <button onClick={() => setSelectedId(null)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded">
                      <X size={14} />
                  </button>
              </div>
              <div className="space-y-3">
                <div className="text-xs text-slate-500 font-mono mb-2">{selectedObj.label || selectedObj.type}</div>
                <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Sill Height</label>
                    <BufferedInput 
                        type="number" 
                        value={selectedObj.sillHeight} 
                        onChange={(val) => onUpdate({ ...data, openings: updateOpening(data.openings, selectedObj.id, { sillHeight: parseFloat(val) }) })}
                        className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Height</label>
                    <BufferedInput 
                        type="number" 
                        value={selectedObj.height} 
                        onChange={(val) => onUpdate({ ...data, openings: updateOpening(data.openings, selectedObj.id, { height: parseFloat(val) }) })}
                        className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                </div>
                 <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">Width</label>
                    <BufferedInput 
                        type="number" 
                        value={selectedObj.width} 
                        onChange={(val) => onUpdate({ ...data, openings: updateOpening(data.openings, selectedObj.id, { width: parseFloat(val) }) })}
                        className="w-full border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                </div>
              </div>
          </div>
      )}

      <div className="border border-slate-300 dark:border-slate-700 w-full h-full relative bg-slate-50 dark:bg-slate-800 shadow-inner cursor-crosshair">
          <svg 
            ref={svgRef} 
            width="100%" 
            height="100%" 
            viewBox="0 0 1000 600"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
              <defs>
                   <pattern id="hatch" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                       <line x1="0" y1="0" x2="0" y2="20" className="stroke-slate-400 dark:stroke-slate-600" strokeWidth="2" />
                   </pattern>
              </defs>

              {/* Sky/Ground Context */}
              <rect x="0" y="0" width="1000" height={groundY} className="fill-blue-50 dark:fill-slate-800/50" />
              <rect x="0" y={groundY} width="1000" height="200" className="fill-emerald-50 dark:fill-slate-900" />
              <line x1="0" y1={groundY} x2="1000" y2={groundY} className="stroke-slate-800 dark:stroke-slate-600" strokeWidth="2" />
              
              <g transform={`translate(50, ${groundY}) scale(${scale}, -${scale})`}>
                {/* Filter and sort walls for simple occlusion (Painter's algorithm based on depth) */}
                {data.walls
                   .filter(w => {
                      const dx = Math.abs(w.end.x - w.start.x);
                      const dy = Math.abs(w.end.y - w.start.y);
                      return dx > dy; // Horizontal-ish walls for South Elevation
                   })
                   .sort((a, b) => {
                       // Sort by Y coordinate (depth in top-down view)
                       // Larger Y is "closer" to South viewer if origin is Top-Left
                       return a.start.y - b.start.y; 
                   })
                   .map((wall, idx) => {
                    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
                    const xPos = Math.min(wall.start.x, wall.end.x);
                    const height = wall.height;
                    const isSection = mode === ViewMode.SECTION;

                    // Find openings for this wall
                    const openings = data.openings.filter(o => o.wallId === wall.id);

                    return (
                        <g key={wall.id} transform={`translate(${xPos}, 0)`}>
                            {/* Wall Surface */}
                            <rect 
                                width={length} 
                                height={height} 
                                className={isSection ? "fill-white dark:fill-slate-700" : "fill-white dark:fill-slate-700"} 
                                stroke="#334155" 
                                strokeWidth="10" 
                            />

                            {/* Section Hatching */}
                            {isSection && (
                                <g>
                                    {/* Foundation */}
                                    <rect x="0" y="-300" width={length} height="300" fill="url(#hatch)" stroke="none" />
                                    {/* Cut Walls at ends */}
                                    <rect x="0" y="0" width="220" height={height} fill="url(#hatch)" />
                                    <rect x={length - 220} y="0" width="220" height={height} fill="url(#hatch)" />
                                    {/* Slab */}
                                    <rect x="0" y={height} width={length} height="200" fill="url(#hatch)" />
                                </g>
                            )}
                            
                            {/* Roof Schematic */}
                            {!isSection && (
                                <path d={`M -200 ${height} L ${length/2} ${height + 1200} L ${length + 200} ${height} Z`} className="fill-slate-200 dark:fill-slate-600 stroke-slate-500 dark:stroke-slate-400" strokeWidth="5" />
                            )}

                            {/* Dimensions (Only for the front-most wall usually, but we show all for now) */}
                            {idx === data.walls.length - 1 && ( // Show dims for closest wall
                                <g transform={`translate(${length + 100}, 0)`}>
                                    <RenderDim x={0} y1={0} y2={height} val={height} />
                                </g>
                            )}

                            {/* Openings */}
                            {openings.map(op => {
                                const opX = op.t * length; 
                                const isSelected = selectedId === op.id;
                                
                                return (
                                    <g 
                                        key={op.id} 
                                        transform={`translate(${opX}, ${op.sillHeight})`}
                                        onMouseDown={(e) => handleMouseDown(e, op, wall, length)}
                                        className="cursor-pointer hover:opacity-80"
                                    >
                                        {/* Window/Door shape */}
                                        <rect 
                                            x={-op.width/2} 
                                            y={0} 
                                            width={op.width} 
                                            height={op.height} 
                                            className={`${isSelected ? 'fill-blue-200 dark:fill-blue-900' : 'fill-blue-50 dark:fill-slate-800'}`}
                                            stroke={isSelected ? "#2563eb" : "#475569"} 
                                            strokeWidth="10" 
                                        />
                                        
                                        {/* Glazing Lines */}
                                        {op.type === 'window' && (
                                            <g stroke={isSelected ? "#2563eb" : "#94a3b8"} strokeWidth="5">
                                                <line x1={-op.width/2} y1={op.height/2} x2={op.width/2} y2={op.height/2} />
                                                <line x1={0} y1={0} x2={0} y2={op.height} />
                                            </g>
                                        )}

                                        {/* Door Handle */}
                                        {op.type === 'door' && (
                                             <circle cx={op.width/2 - 100} cy={1000} r={30} className="fill-slate-400" />
                                        )}

                                        {/* Vertical Dimensions (Smart) */}
                                        {isSelected && (
                                            <g transform={`translate(${op.width/2 + 50}, 0)`}>
                                                {/* Sill Height Dim */}
                                                <RenderDim x={0} y1={-op.sillHeight} y2={0} val={op.sillHeight} label="Sill" />
                                                {/* Opening Height Dim */}
                                                <RenderDim x={0} y1={0} y2={op.height} val={op.height} label="H" />
                                                {/* Head to Ceiling Dim */}
                                                <RenderDim x={0} y1={op.height} y2={height - op.sillHeight} val={height - (op.sillHeight + op.height)} label="Head" />
                                            </g>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    );
                })}
              </g>
              
              {/* Overlay UI */}
              <text x="20" y="30" className="text-xl font-bold fill-slate-700 dark:fill-slate-300">
                  {mode === ViewMode.SECTION ? "Section A-A" : "South Elevation"}
              </text>
              <text x="20" y="50" className="text-xs fill-slate-500 dark:fill-slate-400">
                  Interactive Mode: Click and drag windows to adjust position.
              </text>
          </svg>
      </div>
    </div>
  );
};