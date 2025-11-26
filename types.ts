
export interface Point {
  x: number;
  y: number;
}

export enum ToolType {
  SELECT = 'SELECT',
  WALL = 'WALL',
  ARCH_WALL = 'ARCH_WALL',
  DOOR = 'DOOR',
  WINDOW = 'WINDOW',
  ROOM_LABEL = 'ROOM_LABEL',
  DIMENSION = 'DIMENSION',
  SQUARE_ROOM = 'SQUARE_ROOM',
  STAIR = 'STAIR',
  CALIBRATE = 'CALIBRATE',
  SYMBOL = 'SYMBOL',
  PAN = 'PAN'
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  height: number; // For elevation generation (usually 2700mm)
  curvature?: number; // Distance of control point from midpoint (0 = straight)
  locked?: boolean;
  groupId?: string;
}

export interface Opening {
  id: string;
  wallId: string;
  t: number; // Position along wall (0-1)
  width: number;
  height: number;
  sillHeight: number; // Height from floor
  type: 'door' | 'window';
  subType?: string; // 'single' | 'double' | 'sliding' | 'folding' | 'top-hung' | 'casement'
  label?: string; // e.g., D1, W1
  locked?: boolean;
  flipX?: boolean; // Hinge side
  flipY?: boolean; // Swing direction (In/Out)
}

export interface RoomLabel {
  id: string;
  position: Point;
  text: string;
  area?: number; // Cached area calculation
  locked?: boolean;
  groupId?: string;
}

export interface Dimension {
  id: string;
  start: Point;
  end: Point;
  offset: number; // Distance of text from the line
  locked?: boolean;
}

export enum StairType {
  STRAIGHT = 'STRAIGHT',
  L_SHAPE = 'L_SHAPE',
  U_SHAPE = 'U_SHAPE'
}

export interface Stair {
  id: string;
  position: Point;
  width: number; // Flight width (e.g. 1000mm)
  treadDepth: number; // e.g. 250mm
  riserHeight: number; // e.g. 170mm
  count: number; // Total risers
  flight1Count: number; // Steps in first flight (for L/U)
  rotation: number; // Degrees
  type: StairType;
  locked?: boolean;
  label?: string;
}

export interface SymbolInstance {
  id: string;
  type: string; // Key from SYMBOL_CATALOG
  position: Point;
  rotation: number;
  scale: number;
  locked?: boolean;
  groupId?: string;
}

export interface NorthArrow {
  position: Point;
  rotation: number; // Degrees
}

export interface ProjectMetadata {
  title: string;
  client: string;
  erfNumber: string;
  address: string;
  date: string;
  revision: string;
  drawnBy: string;
  scale: string;
  // New Fields
  sheetNumber: string;
  drawingHeading: string;
  generalNotes: string;
  consultants: Record<string, string>; // Role -> Name map
  logo?: string; // Base64 encoded logo
}

export interface PlanData {
  walls: Wall[];
  openings: Opening[];
  labels: RoomLabel[];
  dimensions: Dimension[];
  stairs: Stair[];
  symbols: SymbolInstance[];
  metadata: ProjectMetadata;
  northArrow: NorthArrow;
}

export enum ViewMode {
  PLAN = 'PLAN',
  ELEVATION_SOUTH = 'ELEVATION_SOUTH',
  SECTION = 'SECTION',
  SCHEDULE = 'SCHEDULE',
  SHEET = 'SHEET'
}

export interface LayerConfig {
  showWalls: boolean;
  showDimensions: boolean;
  showLabels: boolean;
  showOpenings: boolean;
  showStairs: boolean;
  showSymbols: boolean;
}

export enum AIProvider {
  GOOGLE = 'GOOGLE',
  DEEPSEEK = 'DEEPSEEK',
  OPENROUTER = 'OPENROUTER',
  MOONSHOT = 'MOONSHOT',
  MISTRAL = 'MISTRAL',
  CUSTOM = 'CUSTOM'
}

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}
