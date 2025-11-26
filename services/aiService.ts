
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { PlanData, Wall, Opening, RoomLabel, Stair, StairType, AIProvider, AISettings } from "../types";
import { dist, sub, dot, add, scale } from "../utils/geometry";

// --- Google Provider Implementation ---

const googleAnalyze = async (base64Image: string, apiKey: string, model: string): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey });
    
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        walls: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              startX: { type: Type.NUMBER, description: "0-1000 coordinate" },
              startY: { type: Type.NUMBER, description: "0-1000 coordinate" },
              endX: { type: Type.NUMBER, description: "0-1000 coordinate" },
              endY: { type: Type.NUMBER, description: "0-1000 coordinate" },
              thickness: { type: Type.NUMBER, description: "Estimated thickness in units (e.g. 10-30)" }
            },
            required: ["startX", "startY", "endX", "endY"]
          }
        },
        doors: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              width: { type: Type.NUMBER }
            },
            required: ["x", "y"]
          }
        },
        windows: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                width: { type: Type.NUMBER }
              },
              required: ["x", "y"]
            }
        },
        stairs: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    width: { type: Type.NUMBER },
                    length: { type: Type.NUMBER },
                    rotation: { type: Type.NUMBER }
                },
                required: ["x", "y"]
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
            },
            required: ["name", "x", "y"]
          }
        }
      },
      required: ["walls"]
    };

    const prompt = `
      You are an expert Architectural CAD Digitizer. Your task is to convert a raster floor plan image into precise vector data.
      
      **CRITICAL INSTRUCTIONS:**
      1.  **Coordinate System:** Map the image to a grid from (0,0) Top-Left to (1000,1000) Bottom-Right.
      2.  **Orthogonality:** Most walls in floor plans are either horizontal or vertical. Snapping coordinates to align with X or Y axes is highly preferred unless the wall is clearly diagonal.
      3.  **Wall Connectivity:** Walls MUST connect. If Wall A ends near where Wall B starts, use the EXACT same coordinate for both points. Do not leave gaps.
      4.  **Walls:** Identify the solid, thick structural lines. Ignore dimension lines, furniture lines, or hatch patterns. Combine collinear segments into single long walls where possible.
      5.  **Scale:** Assume a standard single door is roughly 50-60 units wide in this 1000x1000 system.
      6.  **Accuracy:** Be precise. Do not hallucinate rooms or walls that do not exist.

      Return a JSON object matching the schema.
    `;

    try {
        const response = await ai.models.generateContent({
          model: model,
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/png', data: base64Image.split(',')[1] } },
              { text: prompt }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
          }
        });

        const text = response.text;
        if (!text) return {};
        return JSON.parse(text);
    } catch (e: any) {
        if (e.message?.includes('404') || e.status === 404) {
            throw new Error(`Model '${model}' not found. Please verify the Model ID in settings (e.g. try 'gemini-2.0-flash').`);
        }
        throw e;
    }
};

const googleCompliance = async (planData: PlanData, apiKey: string, model: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildCompliancePrompt(planData);
    
    try {
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
        });

        return response.text || "No compliance data returned.";
    } catch (e: any) {
        if (e.message?.includes('404') || e.status === 404) {
             throw new Error(`Model '${model}' not found. Please verify the Model ID in settings.`);
        }
        throw e;
    }
};

// --- OpenAI Compatible Provider Implementation (DeepSeek, OpenRouter, Mistral, etc) ---

const openAIAnalyze = async (base64Image: string, settings: AISettings): Promise<any> => {
    if (settings.provider === AIProvider.DEEPSEEK) {
         throw new Error("DeepSeek API does not currently support image input. Please use Google Gemini or an OpenRouter model with vision capabilities.");
    }

    const prompt = `
      You are an Architectural Digitizer. Convert this floor plan image into JSON vector data.
      
      Grid: 0,0 (Top-Left) to 1000,1000 (Bottom-Right).
      
      Rules:
      1. Detect WALLS as thick lines. Ensure walls connect perfectly at corners (share coordinates).
      2. Snap lines to 90 degrees where applicable.
      3. Detect Doors and Windows on the walls.
      
      Output JSON format:
      {
        "walls": [{"startX": number, "startY": number, "endX": number, "endY": number, "thickness": number}],
        "doors": [{"x": number, "y": number, "width": number}],
        "windows": [{"x": number, "y": number, "width": number}],
        "stairs": [{"x": number, "y": number, "width": number, "length": number, "rotation": number}],
        "rooms": [{"name": string, "x": number, "y": number}]
      }
      
      Provide ONLY valid JSON.
    `;

    const body = {
        model: settings.model,
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: base64Image } }
                ]
            }
        ],
        response_format: { type: "json_object" }
    };

    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI Provider Error: ${err}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    
    // Clean markdown if present
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(content);
};

const openAICompliance = async (planData: PlanData, settings: AISettings): Promise<string> => {
    const prompt = buildCompliancePrompt(planData);
    
    const body = {
        model: settings.model,
        messages: [
            { role: "system", content: "You are an expert architect familiar with SANS 10400-XA regulations." },
            { role: "user", content: prompt }
        ]
    };

    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
         const err = await response.text();
        throw new Error(`AI Provider Error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
};


// --- Common Helpers ---

const buildCompliancePrompt = (planData: PlanData) => {
     const glazingArea = planData.openings
      .filter(o => o.type === 'window')
      .reduce((acc, curr) => acc + (curr.width * curr.height) / 1_000_000, 0); // m²

    const roomCount = planData.labels.length;
    const estimatedFloorArea = roomCount > 0 ? roomCount * 12 : 100; 
    const glazingRatio = (glazingArea / estimatedFloorArea) * 100;
    const northRotation = planData.northArrow?.rotation || 0;
    
    return `
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
      1. **Fenestration Calculations:** Evaluate glazing ratio against 15% limit.
      2. **Glazing Performance:** Requirements for U-value and SHGC in Zone 1.
      3. **Insulation:** Roof/Ceiling R-value requirements.
      4. **Orientation:** Shading advice based on ${northRotation}° orientation.

      Format as a professional architectural note.
    `;
};

const convertRawDataToPlan = (result: any): Partial<PlanData> => {
    // 1. Walls
    const walls: Wall[] = (result.walls || []).map((w: any) => ({
      id: crypto.randomUUID(),
      start: { x: w.startX, y: w.startY },
      end: { x: w.endX, y: w.endY },
      thickness: w.thickness ? Math.min(Math.max(w.thickness, 10), 30) : 22, // Validate thickness
      height: 2700 
    }));

    // 2. Openings (Doors & Windows) - Snap to nearest wall
    const openings: Opening[] = [];

    const processOpening = (item: any, type: 'door' | 'window') => {
        const pt = { x: item.x, y: item.y };
        let bestWall: Wall | null = null;
        let bestDist = Infinity;
        let bestT = 0;

        for (const wall of walls) {
            const v = sub(wall.end, wall.start);
            const l2 = dot(v, v);
            if (l2 === 0) continue;
            
            let t = dot(sub(pt, wall.start), v) / l2;
            t = Math.max(0, Math.min(1, t));
            
            const proj = add(wall.start, scale(v, t));
            const d = dist(pt, proj);

            if (d < 60 && d < bestDist) {
                bestDist = d;
                bestWall = wall;
                bestT = t;
            }
        }

        if (bestWall) {
            const defaultWidth = type === 'door' ? 90 : 120; // 900mm or 1200mm
            const detectedWidth = item.width && item.width > 10 ? item.width : defaultWidth;

            openings.push({
                id: crypto.randomUUID(),
                wallId: bestWall.id,
                t: bestT,
                width: detectedWidth * 10, // Convert to mm (assuming AI returns relative 0-100 units or pixels)
                height: 2100,
                sillHeight: type === 'window' ? 900 : 0,
                type: type,
                subType: type === 'door' ? 'single' : 'standard',
                label: type === 'door' ? `D${openings.length+1}` : `W${openings.length+1}`,
                flipX: false,
                flipY: false
            });
        }
    };

    (result.doors || []).forEach((d: any) => processOpening(d, 'door'));
    (result.windows || []).forEach((w: any) => processOpening(w, 'window'));

    // 3. Stairs
    const stairs: Stair[] = (result.stairs || []).map((s: any) => ({
        id: crypto.randomUUID(),
        position: { x: s.x, y: s.y },
        width: s.width || 100,
        treadDepth: (s.length || 200) / 12, 
        riserHeight: 170,
        count: 12, 
        flight1Count: 6,
        rotation: s.rotation || 0,
        type: StairType.STRAIGHT
    }));

    // 4. Labels
    const labels: RoomLabel[] = (result.rooms || []).map((r: any) => ({
      id: crypto.randomUUID(),
      position: { x: r.x, y: r.y },
      text: r.name || "Room"
    }));

    return { walls, labels, openings, stairs };
};

// --- Main Exports ---

export const analyzeFloorPlanImage = async (base64Image: string, settings: AISettings): Promise<Partial<PlanData>> => {
  try {
    let rawResult;
    if (settings.provider === AIProvider.GOOGLE) {
        rawResult = await googleAnalyze(base64Image, settings.apiKey, settings.model);
    } else {
        // DeepSeek, OpenRouter, Mistral, Moonshot etc using OpenAI Compatible API
        rawResult = await openAIAnalyze(base64Image, settings);
    }
    return convertRawDataToPlan(rawResult);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw error;
  }
};

export const checkSansCompliance = async (planData: PlanData, settings: AISettings): Promise<string> => {
  try {
    if (settings.provider === AIProvider.GOOGLE) {
        return await googleCompliance(planData, settings.apiKey, settings.model);
    } else {
        return await openAICompliance(planData, settings);
    }
  } catch (error) {
    console.error("Compliance Check Error:", error);
    return "Error checking compliance: " + (error instanceof Error ? error.message : "Unknown error");
  }
};
