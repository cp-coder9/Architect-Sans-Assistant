
import React, { useState, useRef, useEffect } from 'react';
import { CanvasEditor } from './components/CanvasEditor';
import { Toolbar } from './components/Toolbar';
import { ElevationView } from './components/ElevationView';
import { ToolType, PlanData, ViewMode, ProjectMetadata, LayerConfig } from './types';
import { analyzeFloorPlanImage, checkSansCompliance } from './services/geminiService';
import { Upload, Loader2, CheckCircle, Save, Camera, Image as ImageIcon, Menu, Layers, FileJson, FolderOpen, Moon, Sun, ShieldCheck } from 'lucide-react';
import { SYMBOL_CATALOG } from './components/CanvasEntities';
import { exportAsPdf, exportAsPng, exportAsSvg } from './utils/exportUtils.tsx';

const INITIAL_DATA: PlanData = {
  walls: [],
  openings: [],
  labels: [],
  dimensions: [],
  stairs: [],
  symbols: [],
  northArrow: { position: { x: -100, y: -100 }, rotation: 0 },
  metadata: {
    title: "New Residence",
    client: "Client Name",
    erfNumber: "Erf 123",
    address: "Johannesburg, Gauteng",
    date: new Date().toISOString().split('T')[0],
    revision: "Rev A",
    drawnBy: "AI Assistant",
    scale: "1:100"
  }
};

const INITIAL_LAYERS: LayerConfig = {
  showWalls: true,
  showDimensions: true,
  showLabels: true,
  showOpenings: true,
  showStairs: true,
  showSymbols: true
};

export default function App() {
  // Theme Management
  const [darkMode, setDarkMode] = useState(true);

  // History Management
  const [history, setHistory] = useState<PlanData[]>([INITIAL_DATA]);
  const [currentStep, setCurrentStep] = useState(0);
  
  const planData = history[currentStep];

  const updatePlanData = (newData: PlanData, addToHistory = true) => {
    if (addToHistory) {
        const newHistory = history.slice(0, currentStep + 1);
        newHistory.push(newData);
        setHistory(newHistory);
        setCurrentStep(newHistory.length - 1);
    } else {
        // Replace current step
        const newHistory = [...history];
        newHistory[currentStep] = newData;
        setHistory(newHistory);
    }
  };

  const handleUndo = () => {
      if (currentStep > 0) {
          setCurrentStep(prev => prev - 1);
      }
  };

  const handleRedo = () => {
      if (currentStep < history.length - 1) {
          setCurrentStep(prev => prev + 1);
      }
  };

  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.SELECT);
  
  // Tool Settings
  const [activeSymbolId, setActiveSymbolId] = useState<string>(SYMBOL_CATALOG[0].id);
  const [activeSymbolCategory, setActiveSymbolCategory] = useState<string>('furniture');
  const [activeWallThickness, setActiveWallThickness] = useState<number>(22); // 220mm scaled down
  const [activeDoorType, setActiveDoorType] = useState<string>('single');
  const [activeWindowType, setActiveWindowType] = useState<string>('standard');

  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.PLAN);
  const [isLoading, setIsLoading] = useState(false);
  const [complianceReport, setComplianceReport] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [layers, setLayers] = useState<LayerConfig>(INITIAL_LAYERS);
  
  // Dropdowns
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  
  const canvasRef = useRef<any>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const analysis = await analyzeFloorPlanImage(base64);
        updatePlanData({
          ...planData,
          walls: analysis.walls || [],
          labels: analysis.labels || [],
          openings: [],
          stairs: [],
          symbols: [],
          northArrow: planData.northArrow
        });
      } catch (err) {
        alert("AI Analysis failed. Starting with blank canvas.");
      } finally {
        setIsLoading(false);
        setIsMenuOpen(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCheckCompliance = async () => {
    setIsLoading(true);
    const report = await checkSansCompliance(planData);
    setComplianceReport(report);
    setIsReportOpen(true);
    setIsLoading(false);
  };

  const handleSaveProject = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(planData));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `${planData.metadata.title.replace(/\s+/g, '_')}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      setIsMenuOpen(false);
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const loadedData = JSON.parse(event.target?.result as string);
              // Basic validation
              if (loadedData.walls && loadedData.metadata) {
                  // Ensure arrays exist for legacy files
                  if (!loadedData.stairs) loadedData.stairs = [];
                  if (!loadedData.symbols) loadedData.symbols = [];
                  if (!loadedData.northArrow) loadedData.northArrow = { position: { x: 50, y: 50 }, rotation: 0 };
                  updatePlanData(loadedData);
              } else {
                  alert("Invalid project file.");
              }
          } catch (error) {
              alert("Error reading file.");
          }
          setIsMenuOpen(false);
      };
      reader.readAsText(file);
  };
  
  const handleMetadataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      const newMetadata = { ...planData.metadata, [name]: value };
      updatePlanData({ ...planData, metadata: newMetadata }, false);
  };

  const toggleLayer = (key: keyof LayerConfig) => {
      setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={`${darkMode ? 'dark' : ''} h-full w-full`}>
      <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0 relative z-40 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Main Menu */}
            <div className="relative">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
                    <Menu size={20} />
                </button>
                
                {isMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-2">
                        <button 
                          onClick={() => { updatePlanData(INITIAL_DATA); setIsMenuOpen(false); }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                        >
                            <FileJson size={16} /> New Project
                        </button>
                        <button 
                          onClick={handleSaveProject}
                          className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                        >
                            <Save size={16} /> Save Project (JSON)
                        </button>
                        <label className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-sm cursor-pointer text-slate-700 dark:text-slate-200">
                            <FolderOpen size={16} /> Open Project
                            <input type="file" accept=".json" className="hidden" onChange={handleLoadProject} />
                        </label>
                        <label className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-sm cursor-pointer text-slate-700 dark:text-slate-200">
                            <ImageIcon size={16} /> Import Image
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                    </div>
                )}
            </div>

            <div>
              <h1 className="font-bold text-sm md:text-lg leading-tight text-slate-800 dark:text-slate-100">SANS 10400-XA Architect</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
              {/* View Switcher */}
               <select 
                value={viewMode} 
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                className="bg-slate-100 dark:bg-slate-800 border-none rounded px-2 py-1 text-xs md:text-sm text-slate-700 dark:text-slate-200 mr-2 cursor-pointer"
              >
                <option value={ViewMode.PLAN}>Plan View</option>
                <option value={ViewMode.ELEVATION_SOUTH}>Elevation (South)</option>
                <option value={ViewMode.SECTION}>Section A-A</option>
                <option value={ViewMode.SCHEDULE}>Schedules</option>
              </select>

              {/* Theme Toggle */}
              <button 
                onClick={() => setDarkMode(!darkMode)} 
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                title="Toggle Dark Mode"
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* Layers Dropdown */}
              <div className="relative">
                  <button 
                      onClick={() => setIsLayersOpen(!isLayersOpen)} 
                      className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${isLayersOpen ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                      <Layers size={14} />
                      Layers
                  </button>
                  {isLayersOpen && (
                      <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-2 p-3 z-50">
                          <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Visibility</h4>
                          <div className="space-y-2 text-slate-700 dark:text-slate-200">
                              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-500">
                                  <input type="checkbox" checked={layers.showWalls} onChange={() => toggleLayer('showWalls')} />
                                  Walls
                              </label>
                              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-500">
                                  <input type="checkbox" checked={layers.showOpenings} onChange={() => toggleLayer('showOpenings')} />
                                  Windows & Doors
                              </label>
                              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-500">
                                  <input type="checkbox" checked={layers.showDimensions} onChange={() => toggleLayer('showDimensions')} />
                                  Dimensions
                              </label>
                               <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-500">
                                  <input type="checkbox" checked={layers.showLabels} onChange={() => toggleLayer('showLabels')} />
                                  Room Labels
                              </label>
                              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-500">
                                  <input type="checkbox" checked={layers.showStairs} onChange={() => toggleLayer('showStairs')} />
                                  Stairs
                              </label>
                              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-500">
                                  <input type="checkbox" checked={layers.showSymbols} onChange={() => toggleLayer('showSymbols')} />
                                  Symbols & Furniture
                              </label>
                          </div>
                      </div>
                  )}
              </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden relative">
          
          {/* Canvas / View Area */}
          {viewMode === ViewMode.PLAN ? (
            <CanvasEditor 
              ref={canvasRef}
              data={planData}
              onUpdate={updatePlanData}
              tool={activeTool}
              onToolChange={setActiveTool}
              viewMode={viewMode}
              layers={layers}
              
              activeSymbolId={activeSymbolId}
              activeWallThickness={activeWallThickness}
              activeDoorType={activeDoorType}
              activeWindowType={activeWindowType}
            />
          ) : (
            <ElevationView 
              data={planData}
              mode={viewMode}
              onUpdate={updatePlanData}
            />
          )}

          {/* Floating Drawing Tools Dock */}
          <Toolbar 
            activeTool={activeTool} 
            setTool={setActiveTool} 
            onExportSvg={() => exportAsSvg(planData)}
            onExportPng={() => exportAsPng(planData)}
            onExportPdf={() => exportAsPdf(planData)}
            onCheckCompliance={handleCheckCompliance}
            onEditMetadata={() => setIsMetadataOpen(true)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={currentStep > 0}
            canRedo={currentStep < history.length - 1}
            
            activeSymbolId={activeSymbolId}
            onSymbolSelect={setActiveSymbolId}
            activeSymbolCategory={activeSymbolCategory}
            onSymbolCategorySelect={setActiveSymbolCategory}
            
            activeWallThickness={activeWallThickness}
            onWallThicknessChange={setActiveWallThickness}
            
            activeDoorType={activeDoorType}
            onDoorTypeChange={setActiveDoorType}
            
            activeWindowType={activeWindowType}
            onWindowTypeChange={setActiveWindowType}
          />

          {/* Compliance Report Modal */}
          {isReportOpen && (
            <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="text-emerald-500" /> SANS 10400-XA Compliance Report
                  </h2>
                  <button onClick={() => setIsReportOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                     ✕
                  </button>
                </div>
                <div className="p-6 overflow-y-auto text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {complianceReport}
                </div>
                <div className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end">
                  <button onClick={() => setIsReportOpen(false)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Metadata Modal */}
          {isMetadataOpen && (
            <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-lg">
                  <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                     <h2 className="font-bold text-slate-800 dark:text-white">Project Metadata</h2>
                     <button onClick={() => setIsMetadataOpen(false)} className="text-slate-500">✕</button>
                  </div>
                  <div className="p-6 grid gap-4">
                      {Object.entries(planData.metadata).map(([key, val]) => (
                          <div key={key}>
                              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">{key}</label>
                              <input 
                                name={key}
                                value={val}
                                onChange={handleMetadataChange}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                              />
                          </div>
                      ))}
                  </div>
                  <div className="p-4 border-t dark:border-slate-700 flex justify-end">
                     <button onClick={() => setIsMetadataOpen(false)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
                  </div>
               </div>
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur flex flex-col items-center justify-center text-slate-800 dark:text-white">
              <Loader2 className="animate-spin mb-4 text-blue-600" size={48} />
              <p className="font-medium">Processing...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
