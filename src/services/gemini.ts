import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export type ModelId = "gemini-3.1-pro-preview" | "gemini-3-flash-preview" | "gemini-3.1-flash-lite-preview";

export interface ModelResponse {
  modelId: ModelId;
  text: string;
  loading: boolean;
  error?: string;
}

export async function getModelResponse(modelId: ModelId, prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
  });
  return response.text || "No response generated.";
}

export interface VerificationResult {
  consensus: string;
  discrepancies: {
    point: string;
    models: { [key: string]: string };
    resolution: string;
    severity: "low" | "medium" | "high";
  }[];
  winner?: ModelId;
  winnerReason?: string;
}

export async function verifyResponses(prompt: string, responses: ModelResponse[]): Promise<VerificationResult> {
  const verifierPrompt = `
    You are a critical verifier AI. Your task is to compare the responses from three different AI models to the same prompt and determine the most accurate and complete answer.
    
    ORIGINAL PROMPT:
    "${prompt}"
    
    RESPONSES:
    ${responses.map(r => `--- MODEL: ${r.modelId} ---\n${r.text}`).join("\n\n")}
    
    TASK:
    1. Identify any factual discrepancies or significant differences in reasoning between the models.
    2. For each discrepancy, identify which models said what, provide a resolution based on your superior knowledge, and assign a severity (low, medium, high).
    3. Point out which model provided the most comprehensive and accurate information (the "winner").
    4. Synthesize a final "Consensus Answer".
    
    OUTPUT FORMAT (JSON):
    {
      "consensus": "The final synthesized answer...",
      "discrepancies": [
        {
          "point": "The specific fact or logic point in question",
          "models": { "model-id": "what this model said" },
          "resolution": "The correct answer and why",
          "severity": "low|medium|high"
        }
      ],
      "winner": "gemini-3.1-pro-preview|gemini-3-flash-preview|gemini-3.1-flash-lite-preview",
      "winnerReason": "Why this model was chosen"
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: verifierPrompt,
    config: {
      responseMimeType: "application/json",
    },
  });
  
  try {
    return JSON.parse(response.text || "{}") as VerificationResult;
  } catch (e) {
    return {
      consensus: response.text || "Verification failed to parse.",
      discrepancies: [],
    };
  }
}
