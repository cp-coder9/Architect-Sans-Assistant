import { GoogleGenAI, Type, Schema } from "@google/genai";
import { PlanData, Wall, Opening, RoomLabel } from "../types";

// Initialize the client with the API key from the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Analyzes an image of a floor plan and returns a structured JSON representation
 * that attempts to map walls, doors, and windows.
 */
export const analyzeFloorPlanImage = async (base64Image: string): Promise<Partial<PlanData>> => {
  try {
    // Define the schema for the expected output
    // Note: We simplify the schema to make it easier for the model to generate valid JSON
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        walls: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              startX: { type: Type.NUMBER },
              startY: { type: Type.NUMBER },
              endX: { type: Type.NUMBER },
              endY: { type: Type.NUMBER },
            }
          }
        },
        rooms: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER }
            }
          }
        }
      }
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png', // Assuming PNG or JPEG, generic prompt handles it
              data: base64Image.split(',')[1] // Remove data:image/png;base64, prefix
            }
          },
          {
            text: `Analyze this floor plan image. 
            I need to redraw it in a vector editor. 
            Identify the main walls and room labels. 
            Assume a coordinate system from 0,0 (top left) to 1000,1000 (bottom right).
            Return a JSON object with:
            1. 'walls': array of line segments (startX, startY, endX, endY). Combine collinear wall segments where possible.
            2. 'rooms': array of text labels (name, x, y).
            
            Strictly follow the JSON schema.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    const text = response.text;
    if (!text) return {};

    const result = JSON.parse(text);

    // Convert Gemini output to our internal types
    const walls: Wall[] = (result.walls || []).map((w: any) => ({
      id: crypto.randomUUID(),
      start: { x: w.startX, y: w.startY },
      end: { x: w.endX, y: w.endY },
      thickness: 10, // Default thickness
      height: 2700 // Default height in mm
    }));

    const labels: RoomLabel[] = (result.rooms || []).map((r: any) => ({
      id: crypto.randomUUID(),
      position: { x: r.x, y: r.y },
      text: r.name || "Room"
    }));

    return { walls, labels, openings: [] };

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze plan. Please try again.");
  }
};

/**
 * Checks the textual description of the plan against SANS 10400-XA requirements.
 * Enhanced to include SHGC and U-value considerations.
 */
export const checkSansCompliance = async (planData: PlanData): Promise<string> => {
  try {
    // 1. Calculate basic metrics locally
    const glazingArea = planData.openings
      .filter(o => o.type === 'window')
      .reduce((acc, curr) => acc + (curr.width * curr.height) / 1_000_000, 0); // m²

    // Heuristic for floor area if not explicitly calculated (12m² per label is a rough estimate for bedroom/study size)
    const roomCount = planData.labels.length;
    // If we have auto-detected walls, we could potentially estimate bounds, but using room count is a safe fallback
    const estimatedFloorArea = roomCount > 0 ? roomCount * 12 : 100; 
    const glazingRatio = (glazingArea / estimatedFloorArea) * 100;

    // 2. Determine Orientation info
    const northRotation = planData.northArrow?.rotation || 0;
    
    // Construct detailed prompt
    const prompt = `
      Act as a SANS 10400-XA Energy Efficiency expert for South Africa (Zone 1 - Highveld/Johannesburg).
      
      Analyze the following residential building data:
      - Estimated Floor Area: ${estimatedFloorArea.toFixed(1)} m²
      - Total Glazing Area: ${glazingArea.toFixed(2)} m²
      - Net Glazing Area to Floor Area Ratio: ${glazingRatio.toFixed(1)}%
      - North Point Rotation: ${northRotation}°
      - Number of habitable rooms: ${roomCount}
      
      Project Metadata:
      - Client: ${planData.metadata.client}
      - Address: ${planData.metadata.address}

      Please provide a detailed Energy Efficiency Compliance Report covering:

      1. **Fenestration Calculations:**
         - Evaluate the ${glazingRatio.toFixed(1)}% glazing ratio against the deemed-to-satisfy limit (15%).
         - If it exceeds 15%, specify the required steps (e.g., Rational Design via thermal modelling).

      2. **Glazing Performance Requirements (Zone 1):**
         - Specify the maximum allowed U-value and SHGC (Solar Heat Gain Coefficient) for windows in this zone to meet compliance.
         - Recommend appropriate glass types (e.g., Single Clear, Low-E, Double Glazing) that typically meet these targets.

      3. **Insulation Requirements:**
         - Specify the required R-value for Roof/Ceiling insulation in Zone 1.
         - Provide recommendations for wall insulation if applicable.

      4. **Orientation & Shading:**
         - Provide specific advice on shading for North vs West facing windows, considering the North arrow rotation is ${northRotation}°.

      Format the response as a professional architectural note suitable for submission.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response.text || "No compliance data returned.";
  } catch (error) {
    console.error("Compliance Check Error:", error);
    return "Error checking compliance.";
  }
};
