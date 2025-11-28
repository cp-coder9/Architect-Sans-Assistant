import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { PlanData, ToolType, LayerConfig } from '../types';
import { getWallPath } from './CanvasEntities';
import { useCanvasLogic } from './CanvasLogic';
import { CanvasLayers } from './CanvasLayers';
import { CanvasOverlays } from './CanvasOverlays';

interface CanvasEditorProps {
  data: PlanData;
  tool: ToolType;
  viewMode: any;
  layers: LayerConfig;
  onUpdate: (newData: PlanData, addToHistory?: boolean) => void;
  onToolChange: (tool: ToolType) => void;
  activeSymbolId: string;
  activeWallThickness: number;
  activeDoorType: string;
  activeWindowType: string;
}

export const CanvasEditor = forwardRef<any, CanvasEditorProps>((props, ref) => {
    const { data, layers, onUpdate } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const [showLegend, setShowLegend] = useState(false);

    // Extract logic to custom hook
    const logic = useCanvasLogic({ ...props, containerRef });

    useImperativeHandle(ref, () => ({
        resetView: () => {
            logic.setZoom(1);
            logic.setPan({ x: 0, y: 0 });
        }
    }));

    return (
        <div 
            ref={containerRef}
            className="w-full h-full bg-slate-100 dark:bg-slate-900 overflow-hidden relative cursor-crosshair touch-none select-none"
            onMouseDown={logic.handleMouseDown}
            onMouseMove={logic.handleMouseMove}
            onMouseUp={logic.handleMouseUp}
            onMouseLeave={logic.handleMouseUp}
            onWheel={logic.handleWheel}
            onContextMenu={logic.handleContextMenu}
        >
            <svg 
                width="100%" 
                height="100%"
                viewBox={`0 0 ${containerRef.current?.clientWidth || 800} ${containerRef.current?.clientHeight || 600}`}
            >
                <defs>
                    <pattern id="hatch_brick" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="1" /></pattern>
                    <pattern id="hatch_drywall" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="4" y2="0" stroke="#cbd5e1" strokeWidth="1" />
                        <line x1="0" y1="0" x2="0" y2="4" stroke="#cbd5e1" strokeWidth="1" />
                    </pattern>
                    {/* Grid Pattern */}
                    <pattern id="grid" width={100} height={100} patternUnits="userSpaceOnUse">
                        <path d="M 100 0 L 0 0 0 100" fill="none" stroke="gray" strokeWidth="0.5" opacity="0.2"/>
                    </pattern>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#475569" /></marker>
                    <mask id="wall-cleaner">
                        <rect x="-100000" y="-100000" width="200000" height="200000" fill="white" />
                        {data.walls.map(w => (
                            <path 
                                key={w.id} 
                                d={getWallPath(w)} 
                                stroke="black" 
                                strokeWidth={Math.max(0.1, w.thickness - 2)} 
                                fill="none" 
                                strokeLinecap="square"
                            />
                        ))}
                    </mask>
                </defs>

                <CanvasLayers 
                    data={data}
                    layers={layers}
                    zoom={logic.zoom}
                    pan={logic.pan}
                    selectedId={logic.selectedId}
                    snapGuides={logic.snapGuides}
                />
            </svg>

            <CanvasOverlays 
                data={data}
                onUpdate={onUpdate}
                zoom={logic.zoom}
                setZoom={logic.setZoom}
                selectedId={logic.selectedId}
                setSelectedId={logic.setSelectedId}
                showLegend={showLegend}
                setShowLegend={setShowLegend}
                mousePos={logic.mousePos}
                contextMenu={logic.contextMenu}
                setContextMenu={logic.setContextMenu}
            />
        </div>
    );
});

CanvasEditor.displayName = "CanvasEditor";