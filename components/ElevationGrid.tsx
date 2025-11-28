import React from 'react';
import { PlanData, ViewMode } from '../types';
import { Sun, Wind, Compass, Mountain } from 'lucide-react';

interface Props {
  onSwitchView: (view: ViewMode) => void;
}

const elevations = [
  { name: 'South Elevation', icon: <Sun size={24} />, view: ViewMode.ELEVATION_SOUTH },
  { name: 'North Elevation', icon: <Compass size={24} />, view: ViewMode.ELEVATION_NORTH },
  { name: 'West Elevation', icon: <Wind size={24} />, view: ViewMode.ELEVATION_WEST },
  { name: 'East Elevation', icon: <Mountain size={24} />, view: ViewMode.ELEVATION_EAST },
];

export const ElevationGrid: React.FC<Props> = ({ onSwitchView }) => {
  return (
    <div className="flex-1 bg-white dark:bg-slate-900 p-8 overflow-auto font-sans text-slate-800 dark:text-slate-200">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-slate-800 dark:text-white border-b dark:border-slate-700 pb-4">
          Building Elevations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          {elevations.map((elevation) => (
            <div
              key={elevation.name}
              className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-300 cursor-pointer"
              onClick={() => onSwitchView(elevation.view)}
            >
              <div className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 p-3 rounded-full">
                    {elevation.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{elevation.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Click to view detailed elevation</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900/50 h-64 w-full rounded-b-lg flex items-center justify-center">
                <p className="text-slate-400 dark:text-slate-600 text-sm">Live Preview Coming Soon</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
