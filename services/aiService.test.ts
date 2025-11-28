import { describe, it, expect } from 'vitest';
import { convertRawDataToPlan } from './aiService';

describe('aiService', () => {
    it('should correctly process AI-generated door data and not oversize it', () => {
        const mockAiResult = {
            walls: [{ startX: 0, startY: 0, endX: 100, endY: 0 }],
            doors: [{ x: 50, y: 0, width: 80 }]
        };

        const plan = convertRawDataToPlan(mockAiResult);
        expect(plan.openings).toHaveLength(1);
        expect(plan.openings![0].width).toBe(80);
    });
});
