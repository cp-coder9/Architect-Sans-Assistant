
import React, { useState, useRef, useEffect } from 'react';
import { CanvasEditor } from './components/CanvasEditor';
import PropertiesPopup from './components/PropertiesPopup';
import { Toolbar } from './components/Toolbar';
import { ElevationView } from './components/ElevationView';
import { ElevationGrid } from './components/ElevationGrid';
import { ThreeDView } from './components/ThreeDView';
import { SheetPreview } from './components/SheetPreview';
import { ToolType, PlanData, ViewMode, ProjectMetadata, LayerConfig, AIProvider, AISettings } from './types';
import { analyzeFloorPlanImage, checkSansCompliance, modifyFloorPlan } from './services/aiService';
import { Upload, Loader2, CheckCircle, Save, Camera, Image as ImageIcon, Menu, Layers, FileJson, FolderOpen, Moon, Sun, ShieldCheck, Settings, FileText, ClipboardList, UserSquare2, Sparkles, Send, Trash2 } from 'lucide-react';
import { SYMBOL_CATALOG } from './components/CanvasEntities';
import { exportAsPdf, exportAsPng, exportAsSvg } from './components/SheetExporter';

const INITIAL_DATA: PlanData = {
  walls: [],
  openings: [],
  labels: [],
  dimensions: [],
  stairs: [],
  symbols: [],
  northArrow: { position: { x: 900, y: 900 }, rotation: 0 },
  metadata: {
    title: "RESIDENTIAL ADDITION",
    client: "JOHN DOE",
    erfNumber: "ERF 1234",
    address: "123 EXAMPLE STREET, JOHANNESBURG",
    date: new Date().toISOString().split('T')[0],
    revision: "REV A - ISSUED FOR APPROVAL",
    drawnBy: "ARCHITECT",
    scale: "1:100",
    sheetNumber: "A-101",
    drawingHeading: "FLOOR PLAN",
    generalNotes: "1. CONTRACTOR TO VERIFY ALL DIMENSIONS ON SITE BEFORE COMMENCING WORK.\n2. ALL WORK TO COMPLY WITH SANS 10400.\n3. FIGURED DIMENSIONS TO BE USED IN PREFERENCE TO SCALED DIMENSIONS.\n4. DISCREPANCIES TO BE REPORTED TO THE ARCHITECT IMMEDIATELY.",
    consultants: {
        "Structural Eng": "STRUCTURAL ENGINEERS INC.",
    }
  }
};

const INITIAL_LAYERS: LayerConfig = {
  showWalls: true,
  showDimensions: true,
  showLabels: true,
  showOpenings: true,
  showStairs: true,
  showSymbols: true,
  showBackground: true
};

// Safe environment variable access
const getEnvApiKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore error if process is not defined
  }
  return '';
};

const DEFAULT_AI_SETTINGS: AISettings = {
    provider: AIProvider.GOOGLE,
    apiKey: getEnvApiKey(),
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.0-flash'
};

export default function App() {
  // Theme Management
  const [darkMode, setDarkMode] = useState(true);

  // AI Settings
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
      const saved = localStorage.getItem('ai_settings');
      return saved ? JSON.parse(saved) : DEFAULT_AI_SETTINGS;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
  const [loadingText, setLoadingText] = useState("Processing...");
  const [complianceReport, setComplianceReport] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isAIEditOpen, setIsAIEditOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [metadataTab, setMetadataTab] = useState<'project' | 'sheet' | 'consultants' | 'notes'>('project');

  const [layers, setLayers] = useState<LayerConfig>(INITIAL_LAYERS);
  
  // Dropdowns
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const canvasRef = useRef<any>(null);

  const saveAiSettings = (newSettings: AISettings) => {
      setAiSettings(newSettings);
      localStorage.setItem('ai_settings', JSON.stringify(newSettings));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!aiSettings.apiKey) {
        alert("Please configure an API Key in Settings first.");
        setIsSettingsOpen(true);
        return;
    }

    setLoadingText("Analyzing Floor Plan...");
    setIsLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const analysis = await analyzeFloorPlanImage(base64, aiSettings);
        updatePlanData({
          ...planData,
          walls: analysis.walls || [],
          labels: analysis.labels || [],
          openings: analysis.openings || [],
          stairs: analysis.stairs || [],
          symbols: [],
          northArrow: planData.northArrow
        });
      } catch (err) {
        alert(`AI Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
        setIsMenuOpen(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          const result = event.target?.result as string;
          // Load image to get dimensions
          const img = new Image();
          img.onload = () => {
              // Scale to fit roughly 1000 units wide by default if huge
              let width = img.width;
              let height = img.height;
              if (width > 2000) {
                  const r = 2000 / width;
                  width = 2000;
                  height *= r;
              }
              // Center it roughly at 0,0 or just start at 0,0
              updatePlanData({
                  ...planData,
                  background: {
                      url: result,
                      x: 0, 
                      y: 0, 
                      width: width / 2, // assume high DPI, scale down a bit to match mm units better? 
                      height: height / 2,
                      opacity: 0.5
                  }
              });
              setLayers(l => ({ ...l, showBackground: true }));
              setIsMenuOpen(false);
          };
          img.src = result;
      };
      reader.readAsDataURL(file);
  };

  const handleRemoveBackground = () => {
      const newData = { ...planData };
      delete newData.background;
      updatePlanData(newData);
      setIsMenuOpen(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        handleMetadataChange('logo', event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCheckCompliance = async () => {
    if (!aiSettings.apiKey) {
        alert("Please configure an API Key in Settings first.");
        setIsSettingsOpen(true);
        return;
    }
    setLoadingText("Checking Compliance...");
    setIsLoading(true);
    const report = await checkSansCompliance(planData, aiSettings);
    setComplianceReport(report);
    setIsReportOpen(true);
    setIsLoading(false);
  };

  const handleAIEdit = async () => {
    if (!aiPrompt.trim()) return;
    if (!aiSettings.apiKey) {
        alert("Please configure an API Key in Settings first.");
        setIsSettingsOpen(true);
        return;
    }
    setLoadingText("Modifying Plan...");
    setIsLoading(true);
    try {
        const modified = await modifyFloorPlan(planData, aiPrompt, aiSettings);
        // Merge modifications
        updatePlanData({
            ...planData,
            walls: modified.walls || planData.walls,
            openings: modified.openings || planData.openings,
            labels: modified.labels || planData.labels,
            stairs: modified.stairs || planData.stairs,
            // Keep existing metadata/symbols unless we specifically handle them in future
            symbols: planData.symbols, 
            northArrow: planData.northArrow,
            metadata: planData.metadata
        });
        setAiPrompt("");
        setIsAIEditOpen(false);
    } catch (err) {
        alert(`AI Modification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
        setIsLoading(false);
    }
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
                  // Ensure new metadata fields
                  if (!loadedData.metadata.generalNotes) loadedData.metadata.generalNotes = INITIAL_DATA.metadata.generalNotes;
                  if (!loadedData.metadata.sheetNumber) loadedData.metadata.sheetNumber = "A001";
                  if (!loadedData.metadata.drawingHeading) loadedData.metadata.drawingHeading = "FLOOR PLAN";
                  if (!loadedData.metadata.consultants) loadedData.metadata.consultants = {};

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
  
  const handleMetadataChange = (key: string, value: string) => {
      const newMetadata = { ...planData.metadata, [key]: value };
      updatePlanData({ ...planData, metadata: newMetadata }, false);
  };

  const handleConsultantChange = (role: string, name: string) => {
      const newConsultants = { ...planData.metadata.consultants, [role]: name };
      // Filter empty
      if (!name) delete newConsultants[role];
      const newMetadata = { ...planData.metadata, consultants: newConsultants };
      updatePlanData({ ...planData, metadata: newMetadata }, false);
  };

  const toggleLayer = (key: keyof LayerConfig) => {
      setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderContent = () => {
      switch (viewMode) {
          case ViewMode.PLAN:
              return (
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
                    selectedId={selectedId}
                    setSelectedId={setSelectedId}
                />
              );
          case ViewMode.ELEVATIONS:
              return (
                <ElevationGrid
                  onSwitchView={setViewMode}
                />
              );
          case ViewMode.ELEVATION_SOUTH:
          case ViewMode.ELEVATION_NORTH:
          case ViewMode.ELEVATION_WEST:
          case ViewMode.ELEVATION_EAST:
          case ViewMode.SECTION:
          case ViewMode.SCHEDULE:
              return (
                <ElevationView 
                    data={planData}
                    mode={viewMode}
                    onUpdate={updatePlanData}
                />
              );
          case ViewMode.SHEET:
              return (
                  <SheetPreview 
                      data={planData}
                      onUpdate={updatePlanData}
                  />
              );
          case ViewMode.THREE_D:
              return (
                  <ThreeDView
                      data={planData}
                  />
              );
          default:
              return null;
      }
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
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-2 max-h-[80vh] overflow-y-auto">
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
                        <div className="border-t dark:border-slate-700 my-1"></div>
                        <label className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-sm cursor-pointer text-slate-700 dark:text-slate-200">
                            <ImageIcon size={16} /> Import AI Image
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                        <label className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-sm cursor-pointer text-slate-700 dark:text-slate-200">
                            <Layers size={16} /> Upload Tracing Plan
                            <input type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
                        </label>
                        {planData.background && (
                            <button 
                                onClick={handleRemoveBackground}
                                className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
                            >
                                <Trash2 size={16} /> Remove Tracing Plan
                            </button>
                        )}
                        <div className="border-t dark:border-slate-700 my-1"></div>
                        <p className="px-4 py-2 text-xs text-slate-400">Settings moved to top bar.</p>
                    </div>
                )}
            </div>

            <div>
              <h1 className="font-bold text-sm md:text-lg leading-tight text-slate-800 dark:text-slate-100">SANS 10400-XA Architect</h1>
            </div>
            
            <button 
              onClick={() => { setMetadataTab('project'); setIsMetadataOpen(true); }}
              className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 ml-4 hidden md:flex"
            >
                <UserSquare2 size={14} /> Title Block Editor
            </button>
          </div>
          
          <div className="flex items-center gap-2">
              {/* View Switcher */}
               <select 
                value={viewMode} 
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                className="bg-slate-100 dark:bg-slate-800 border-none rounded px-2 py-1 text-xs md:text-sm text-slate-700 dark:text-slate-200 mr-2 cursor-pointer"
                data-testid="view-switcher"
              >
                <option value={ViewMode.PLAN}>2D Plan</option>
                <option value={ViewMode.ELEVATIONS}>Elevations</option>
                <option value={ViewMode.SECTION}>Section A-A</option>
                <option value={ViewMode.THREE_D}>3D View</option>
                <option value={ViewMode.SCHEDULE}>Schedules</option>
                <option value={ViewMode.SHEET}>Sheet Preview (A1)</option>
              </select>

              {/* Theme Toggle */}
              <button 
                onClick={() => setDarkMode(!darkMode)} 
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                title="Toggle Dark Mode"
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* Settings Button */}
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                    title="AI Settings"
                >
                    <Settings size={18} />
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
                                  <input type="checkbox" checked={layers.showBackground} onChange={() => toggleLayer('showBackground')} />
                                  Tracing Background
                              </label>
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
          
          {/* View Area */}
          {renderContent()}

          {/* Properties Popup */}
          {selectedId && (
            <PropertiesPopup
              selectedId={selectedId}
              data={planData}
              onUpdate={(updatedData, addToHistory) => updatePlanData(updatedData, addToHistory)}
              onClose={() => setSelectedId(null)}
              setSelectedId={setSelectedId}
            />
          )}

          {/* Floating Drawing Tools Dock (Only in Plan View) */}
          {viewMode === ViewMode.PLAN && (
            <Toolbar 
                activeTool={activeTool} 
                setTool={setActiveTool} 
                onExportSvg={() => exportAsSvg(planData)}
                onExportPng={() => exportAsPng(planData)}
                onExportPdf={() => exportAsPdf(planData)}
                onCheckCompliance={handleCheckCompliance}
                onEditMetadata={() => { setMetadataTab('project'); setIsMetadataOpen(true); }}
                onSave={handleSaveProject}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={currentStep > 0}
                canRedo={currentStep < history.length - 1}
                onAIEdit={() => setIsAIEditOpen(true)}
                
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
          )}

          {/* AI Settings Modal */}
          {isSettingsOpen && (
              <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-lg">
                      <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                          <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Settings size={18} /> AI Provider Settings</h2>
                          <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500">✕</button>
                      </div>
                      <div className="p-6 gap-4 flex flex-col">
                          <div>
                              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Provider</label>
                              <select 
                                value={aiSettings.provider}
                                onChange={(e) => {
                                    const p = e.target.value as AIProvider;
                                    let defaults = { ...aiSettings, provider: p };
                                    if (p === AIProvider.GOOGLE) { defaults.baseUrl = 'https://generativelanguage.googleapis.com'; defaults.model = 'gemini-2.0-flash'; }
                                    else if (p === AIProvider.OPENROUTER) { defaults.baseUrl = 'https://openrouter.ai/api/v1'; defaults.model = 'google/gemini-2.0-flash-001'; }
                                    else if (p === AIProvider.DEEPSEEK) { defaults.baseUrl = 'https://api.deepseek.com'; defaults.model = 'deepseek-chat'; }
                                    else if (p === AIProvider.MISTRAL) { defaults.baseUrl = 'https://api.mistral.ai/v1'; defaults.model = 'pixtral-12b-2409'; }
                                    else if (p === AIProvider.MOONSHOT) { defaults.baseUrl = 'https://api.moonshot.cn/v1'; defaults.model = 'moonshot-v1-8k'; }
                                    setAiSettings(defaults);
                                }}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                              >
                                  <option value={AIProvider.GOOGLE}>Google Gemini (Recommended)</option>
                                  <option value={AIProvider.DEEPSEEK}>DeepSeek</option>
                                  <option value={AIProvider.OPENROUTER}>OpenRouter</option>
                                  <option value={AIProvider.MISTRAL}>Mistral / Pixtral</option>
                                  <option value={AIProvider.MOONSHOT}>Moonshot AI</option>
                                  <option value={AIProvider.CUSTOM}>Custom OpenAI Compatible</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">API Key</label>
                              <input 
                                type="password"
                                value={aiSettings.apiKey}
                                onChange={(e) => setAiSettings({...aiSettings, apiKey: e.target.value})}
                                placeholder="sk-..."
                                className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                              />
                              <p className="text-[10px] text-slate-500 mt-1">Your key is stored locally in your browser.</p>
                          </div>
                          <div>
                              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Base URL</label>
                              <input 
                                value={aiSettings.baseUrl}
                                onChange={(e) => setAiSettings({...aiSettings, baseUrl: e.target.value})}
                                disabled={aiSettings.provider === AIProvider.GOOGLE}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Model ID</label>
                              <input 
                                value={aiSettings.model}
                                onChange={(e) => setAiSettings({...aiSettings, model: e.target.value})}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                              />
                          </div>
                      </div>
                      <div className="p-4 border-t dark:border-slate-700 flex justify-end gap-2">
                          <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">Cancel</button>
                          <button onClick={() => { saveAiSettings(aiSettings); setIsSettingsOpen(false); }} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Settings</button>
                      </div>
                  </div>
              </div>
          )}

          {/* AI Edit Modal */}
          {isAIEditOpen && (
              <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-purple-600 to-blue-600 rounded-t-lg">
                          <h2 className="font-bold text-white flex items-center gap-2"><Sparkles size={18} /> AI Architect</h2>
                          <button onClick={() => setIsAIEditOpen(false)} className="text-white/80 hover:text-white">✕</button>
                      </div>
                      <div className="p-6">
                          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                              Describe how you want to modify the plan. You can ask to move walls, add rooms, or check compliance.
                          </p>
                          <textarea 
                              value={aiPrompt}
                              onChange={(e) => setAiPrompt(e.target.value)}
                              placeholder="e.g. 'Make the living room larger', 'Add a bathroom next to the bedroom', 'Ensure windows are SANS compliant'"
                              className="w-full h-32 border border-slate-300 dark:border-slate-600 rounded p-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                              autoFocus
                          />
                      </div>
                      <div className="p-4 border-t dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-b-lg">
                          <button onClick={() => setIsAIEditOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-sm font-medium">Cancel</button>
                          <button 
                            onClick={handleAIEdit} 
                            disabled={!aiPrompt.trim()}
                            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send size={16} /> Generate Changes
                          </button>
                      </div>
                  </div>
              </div>
          )}

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

          {/* Metadata & Title Block Editor Modal */}
          {isMetadataOpen && (
            <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                  
                  <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center shrink-0">
                     <h2 className="font-bold text-slate-800 dark:text-white">Title Block & Metadata Editor</h2>
                     <button onClick={() => setIsMetadataOpen(false)} className="text-slate-500">✕</button>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b dark:border-slate-700 shrink-0">
                      <button onClick={() => setMetadataTab('project')} className={`flex-1 py-3 text-sm font-medium ${metadataTab === 'project' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Project Info</button>
                      <button onClick={() => setMetadataTab('sheet')} className={`flex-1 py-3 text-sm font-medium ${metadataTab === 'sheet' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Sheet Details</button>
                      <button onClick={() => setMetadataTab('consultants')} className={`flex-1 py-3 text-sm font-medium ${metadataTab === 'consultants' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Consultants</button>
                      <button onClick={() => setMetadataTab('notes')} className={`flex-1 py-3 text-sm font-medium ${metadataTab === 'notes' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>General Notes</button>
                  </div>

                  <div className="p-6 overflow-y-auto">
                      {/* Project Info Tab */}
                      {metadataTab === 'project' && (
                          <div className="grid gap-4">
                               {/* Logo Upload */}
                               <div className="flex items-start gap-4 p-4 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                   <div className="flex-1">
                                       <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">Company Logo</label>
                                       <label className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200">
                                            <Upload size={14} /> Upload Image
                                            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                       </label>
                                   </div>
                                   {planData.metadata.logo && (
                                       <div className="relative w-24 h-24 border border-slate-200 dark:border-slate-700 bg-white rounded flex items-center justify-center overflow-hidden">
                                           <img src={planData.metadata.logo} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                                       </div>
                                   )}
                               </div>

                              <div>
                                  <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Project Name (Title)</label>
                                  <input 
                                    value={planData.metadata.title}
                                    onChange={(e) => handleMetadataChange('title', e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Client Name</label>
                                  <input 
                                    value={planData.metadata.client}
                                    onChange={(e) => handleMetadataChange('client', e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Project Address / Site</label>
                                  <input 
                                    value={planData.metadata.address}
                                    onChange={(e) => handleMetadataChange('address', e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Erf / Plot Number</label>
                                  <input 
                                    value={planData.metadata.erfNumber}
                                    onChange={(e) => handleMetadataChange('erfNumber', e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                  />
                              </div>
                          </div>
                      )}

                      {/* Sheet Details Tab */}
                      {metadataTab === 'sheet' && (
                          <div className="grid gap-4">
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Sheet Number</label>
                                      <input 
                                        value={planData.metadata.sheetNumber}
                                        onChange={(e) => handleMetadataChange('sheetNumber', e.target.value)}
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold"
                                        placeholder="A-101"
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Revision</label>
                                      <input 
                                        value={planData.metadata.revision}
                                        onChange={(e) => handleMetadataChange('revision', e.target.value)}
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                        placeholder="ISSUED FOR CONSTRUCTION"
                                      />
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Drawing Heading</label>
                                  <input 
                                    value={planData.metadata.drawingHeading}
                                    onChange={(e) => handleMetadataChange('drawingHeading', e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                    placeholder="EXTERIOR BUILDING PLAN DETAILS"
                                  />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Date</label>
                                      <input 
                                        type="date"
                                        value={planData.metadata.date}
                                        onChange={(e) => handleMetadataChange('date', e.target.value)}
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Scale</label>
                                      <input 
                                        value={planData.metadata.scale}
                                        onChange={(e) => handleMetadataChange('scale', e.target.value)}
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                      />
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Drawn By</label>
                                  <input 
                                    value={planData.metadata.drawnBy}
                                    onChange={(e) => handleMetadataChange('drawnBy', e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                  />
                              </div>
                          </div>
                      )}

                      {/* Consultants Tab */}
                      {metadataTab === 'consultants' && (
                          <div className="grid gap-4">
                              <p className="text-xs text-slate-500">Add key project team members to appear in the title block.</p>
                              {["Design Build Contractor", "Civil/Structural Engineer", "Landscape Architect", "MEP Engineer"].map(role => (
                                  <div key={role}>
                                      <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">{role}</label>
                                      <input 
                                        value={planData.metadata.consultants[role] || ''}
                                        onChange={(e) => handleConsultantChange(role, e.target.value)}
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                        placeholder={`Company Name`}
                                      />
                                  </div>
                              ))}
                          </div>
                      )}

                      {/* General Notes Tab */}
                      {metadataTab === 'notes' && (
                          <div className="h-full flex flex-col">
                              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">General Notes (Appears on Sheet)</label>
                              <textarea 
                                value={planData.metadata.generalNotes}
                                onChange={(e) => handleMetadataChange('generalNotes', e.target.value)}
                                className="w-full flex-1 min-h-[300px] border border-slate-300 dark:border-slate-600 rounded p-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-sm leading-relaxed"
                                placeholder="1. All dimensions to be checked on site..."
                              />
                          </div>
                      )}

                  </div>
                  <div className="p-4 border-t dark:border-slate-700 flex justify-end shrink-0">
                     <button onClick={() => setIsMetadataOpen(false)} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium shadow-sm">Done</button>
                  </div>
               </div>
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur flex flex-col items-center justify-center text-slate-800 dark:text-white">
              <Loader2 className="animate-spin mb-4 text-blue-600" size={48} />
              <p className="font-medium animate-pulse">{loadingText}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
