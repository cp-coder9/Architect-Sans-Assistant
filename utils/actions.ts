
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
