
import { PlanData } from '../types';

export const deleteObject = (data: PlanData, id: string): PlanData => {
    if (id === 'BACKGROUND') {
        return { ...data, background: undefined };
    }
    return {
        ...data,
        walls: data.walls.filter(w => w.id !== id),
        openings: data.openings.filter(o => o.id !== id && o.wallId !== id),
        symbols: data.symbols.filter(s => s.id !== id),
        labels: data.labels.filter(l => l.id !== id),
        stairs: data.stairs.filter(s => s.id !== id),
        dimensions: data.dimensions.filter(d => d.id !== id),
    };
};

export const toggleLock = (data: PlanData, id: string): PlanData => {
    if (id === 'BACKGROUND' && data.background) {
        return { ...data, background: { ...data.background, locked: !data.background.locked } };
    }
    const wall = data.walls.find(w => w.id === id);
    if(wall) return {...data, walls: data.walls.map(w => w.id === id ? {...w, locked: !w.locked} : w)};

    const op = data.openings.find(o => o.id === id);
    if(op) return {...data, openings: data.openings.map(o => o.id === id ? {...o, locked: !o.locked} : o)};

    const sym = data.symbols.find(s => s.id === id);
    if(sym) return {...data, symbols: data.symbols.map(s => s.id === id ? {...s, locked: !s.locked} : s)};

    return data;
};

export const duplicateObject = (data: PlanData, id: string): PlanData => {
    if (id === 'BACKGROUND' && data.background) {
        const newBg = { ...data.background, x: data.background.x + 100, y: data.background.y + 100 };
        return { ...data, background: newBg };
    }

    const wall = data.walls.find(w => w.id === id);
    if (wall) {
        const newWall = {
            ...wall,
            id: crypto.randomUUID(),
            start: { x: wall.start.x + 100, y: wall.start.y + 100 },
            end: { x: wall.end.x + 100, y: wall.end.y + 100 }
        };
        return { ...data, walls: [...data.walls, newWall] };
    }

    const opening = data.openings.find(o => o.id === id);
    if (opening) {
        const newOpening = { ...opening, id: crypto.randomUUID() };
        return { ...data, openings: [...data.openings, newOpening] };
    }

    const symbol = data.symbols.find(s => s.id === id);
    if (symbol) {
        const newSymbol = {
            ...symbol,
            id: crypto.randomUUID(),
            position: { x: symbol.position.x + 100, y: symbol.position.y + 100 }
        };
        return { ...data, symbols: [...data.symbols, newSymbol] };
    }

    const stair = data.stairs.find(s => s.id === id);
    if (stair) {
        const newStair = {
            ...stair,
            id: crypto.randomUUID(),
            position: { x: stair.position.x + 100, y: stair.position.y + 100 }
        };
        return { ...data, stairs: [...data.stairs, newStair] };
    }

    const dimension = data.dimensions.find(d => d.id === id);
    if (dimension) {
        const newDimension = {
            ...dimension,
            id: crypto.randomUUID(),
            start: { x: dimension.start.x + 100, y: dimension.start.y + 100 },
            end: { x: dimension.end.x + 100, y: dimension.end.y + 100 }
        };
        return { ...data, dimensions: [...data.dimensions, newDimension] };
    }

    const label = data.labels.find(l => l.id === id);
    if (label) {
        const newLabel = {
            ...label,
            id: crypto.randomUUID(),
            position: { x: label.position.x + 100, y: label.position.y + 100 }
        };
        return { ...data, labels: [...data.labels, newLabel] };
    }

    return data;
};
