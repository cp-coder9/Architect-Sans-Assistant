
// This file is deprecated. Please use services/aiService.ts which supports multiple providers.
// Keeping this file empty to prevent import errors if cached, but removing the crashing initialization logic.

import { PlanData } from "../types";

export const analyzeFloorPlanImage = async (base64Image: string): Promise<Partial<PlanData>> => {
    throw new Error("This service is deprecated. Use aiService.ts");
};

export const checkSansCompliance = async (planData: PlanData): Promise<string> => {
    throw new Error("This service is deprecated. Use aiService.ts");
};
