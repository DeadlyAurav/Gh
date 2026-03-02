import { GoogleGenAI } from "@google/genai";

export const getAI = (apiKey: string) => {
  return new GoogleGenAI({ apiKey });
};

export const VEO_MODEL = "veo-3.1-fast-generate-preview";

export interface VideoGenerationState {
  status: 'idle' | 'generating' | 'polling' | 'completed' | 'error';
  progress: number;
  videoUrl?: string;
  error?: string;
  operationId?: string;
}
