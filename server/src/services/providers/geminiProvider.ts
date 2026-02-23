import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env';
import { PARSE_LATEX_PROMPT, RECOGNIZE_PROMPT, SYSTEM_INSTRUCTION } from '../prompts';
import { ProviderResult, RecognitionProvider } from './types';

function normalizeResult(rawText: string): ProviderResult {
  const parsed = JSON.parse(rawText || '{}');
  const questions = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.questions)
      ? parsed.questions
      : [];
  return {
    questions: questions.map((q) => ({
      number: String(q.number || ''),
      content: String(q.content || ''),
      knowledgePoint: String(q.knowledgePoint || '未分类'),
      type: String(q.type || '其他'),
    })),
    usage: {
      inputTokens: Number(parsed.usage?.inputTokens || 0),
      outputTokens: Number(parsed.usage?.outputTokens || 0),
      latencyMs: 0,
    },
    raw: parsed,
  };
}

export class GeminiProvider implements RecognitionProvider {
  name: 'gemini' = 'gemini';
  model = 'gemini-2.5-flash';
  private client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY || '' });

  async recognizeFromFiles(files: { mimeType: string; dataBase64: string }[]): Promise<ProviderResult> {
    const start = Date.now();
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            ...files.map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.dataBase64 } })),
            { text: RECOGNIZE_PROMPT },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const result = normalizeResult(response.text || '{}');
    result.usage.latencyMs = Date.now() - start;
    // SDK usage metadata varies by version; fallback to 0 when missing.
    const usageMetadata = (response as any).usageMetadata;
    if (usageMetadata) {
      result.usage.inputTokens = Number(usageMetadata.promptTokenCount || 0);
      result.usage.outputTokens = Number(usageMetadata.candidatesTokenCount || 0);
    }

    return result;
  }

  async parseLatex(latexCode: string): Promise<ProviderResult> {
    const start = Date.now();
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: PARSE_LATEX_PROMPT(latexCode),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        temperature: 0,
      },
    });

    const result = normalizeResult(response.text || '{}');
    result.usage.latencyMs = Date.now() - start;
    const usageMetadata = (response as any).usageMetadata;
    if (usageMetadata) {
      result.usage.inputTokens = Number(usageMetadata.promptTokenCount || 0);
      result.usage.outputTokens = Number(usageMetadata.candidatesTokenCount || 0);
    }

    return result;
  }
}
