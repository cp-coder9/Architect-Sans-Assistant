import React from 'react';
import { Point } from '../types';

interface RulerProps {
    width: number;
    height: number;
    pan: Point;
    zoom: number;
    type: 'horizontal' | 'vertical';
    position: 'top' | 'left';
}

export const Ruler: React.FC<RulerProps> = ({ width, height, pan, zoom, type, position }) => {
    const rulerSize = 25; // Size of ruler in pixels
    const majorTick = 100; // Major tick every 1m (100 units)
    const minorTick = 20;  // Minor tick every 200mm (20 units)

    const renderHorizontalRuler = () => {
        const startX = -pan.x / zoom;
        const endX = (width - pan.x) / zoom;
        const visibleStart = Math.floor(startX / majorTick) * majorTick;
        const visibleEnd = Math.ceil(endX / majorTick) * majorTick;

        const ticks = [];
        for (let x = visibleStart; x <= visibleEnd; x += minorTick) {
            const screenX = pan.x + x * zoom;
            const isMajor = x % majorTick === 0;

            if (screenX >= 0 && screenX <= width) {
                ticks.push(
                    <g key={x}>
                        <line
                            x1={screenX}
                            y1={rulerSize - (isMajor ? 8 : 4)}
                            x2={screenX}
                            y2={rulerSize}
                            stroke="#64748b"
                            strokeWidth={1}
                        />
                        {isMajor && (
                            <text
                                x={screenX + 2}
                                y={rulerSize - 2}
                                textAnchor="start"
                                dominantBaseline="alphabetic"
                                fontSize="10"
                                fill="#64748b"
                                className="font-mono select-none"
                            >
                                {Math.abs(x / 10)}m
                            </text>
                        )}
                    </g>
                );
            }
        }

        return (
            <g>
                {/* Ruler background */}
                <rect width={width} height={rulerSize} fill="#f8fafc" className="dark:fill-slate-800" />
                <line x1={0} y1={rulerSize} x2={width} y2={rulerSize} stroke="#e2e8f0" className="dark:stroke-slate-600" strokeWidth={1} />

                {/* Ticks */}
                {ticks}

                {/* Zero indicator */}
                {pan.x / zoom >= 0 && pan.x / zoom <= width && (
                    <g>
                        <line
                            x1={pan.x}
                            y1={0}
                            x2={pan.x}
                            y2={rulerSize}
                            stroke="#ef4444"
                            strokeWidth={2}
                            className="dark:stroke-red-500"
                        />
                        <text
                            x={pan.x + 2}
                            y={rulerSize - 2}
                            textAnchor="start"
                            dominantBaseline="alphabetic"
                            fontSize="10"
                            fill="#ef4444"
                            className="dark:fill-red-500 font-bold font-mono select-none"
                        >
                            0
                        </text>
                    </g>
                )}
            </g>
        );
    };

    const renderVerticalRuler = () => {
        const startY = -pan.y / zoom;
        const endY = (height - pan.y) / zoom;
        const visibleStart = Math.floor(startY / majorTick) * majorTick;
        const visibleEnd = Math.ceil(endY / majorTick) * majorTick;

        const ticks = [];
        for (let y = visibleStart; y <= visibleEnd; y += minorTick) {
            const screenY = pan.y + y * zoom;
            const isMajor = y % majorTick === 0;

            if (screenY >= 0 && screenY <= height) {
                ticks.push(
                    <g key={y}>
                        <line
                            x1={rulerSize - (isMajor ? 8 : 4)}
                            y1={screenY}
                            x2={rulerSize}
                            y2={screenY}
                            stroke="#64748b"
                            strokeWidth={1}
                        />
                        {isMajor && (
                            <text
                                x={rulerSize - 2}
                                y={screenY - 2}
                                textAnchor="end"
                                dominantBaseline="alphabetic"
                                fontSize="10"
                                fill="#64748b"
                                className="font-mono select-none"
                                transform={`rotate(-90 ${rulerSize - 2} ${screenY - 2})`}
                            >
                                {Math.abs(y / 10)}m
                            </text>
                        )}
                    </g>
                );
            }
        }

        return (
            <g>
                {/* Ruler background */}
                <rect width={rulerSize} height={height} fill="#f8fafc" className="dark:fill-slate-800" />
                <line x1={rulerSize} y1={0} x2={rulerSize} y2={height} stroke="#e2e8f0" className="dark:stroke-slate-600" strokeWidth={1} />

                {/* Ticks */}
                {ticks}

                {/* Zero indicator */}
                {pan.y / zoom >= 0 && pan.y / zoom <= height && (
                    <g>
                        <line
                            x1={0}
                            y1={pan.y}
                            x2={rulerSize}
                            y2={pan.y}
                            stroke="#ef4444"
                            strokeWidth={2}
                            className="dark:stroke-red-500"
                        />
                        <text
                            x={rulerSize - 2}
                            y={pan.y - 2}
                            textAnchor="end"
                            dominantBaseline="alphabetic"
                            fontSize="10"
                            fill="#ef4444"
                            className="dark:fill-red-500 font-bold font-mono select-none"
                            transform={`rotate(-90 ${rulerSize - 2} ${pan.y - 2})`}
                        >
                            0
                        </text>
                    </g>
                )}
            </g>
        );
    };

    if (type === 'horizontal') {
        return renderHorizontalRuler();
    } else {
        return renderVerticalRuler();
    }
};
