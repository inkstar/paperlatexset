import { env } from '../../config/env';
import { PARSE_LATEX_PROMPT, RECOGNIZE_PROMPT, SYSTEM_INSTRUCTION } from '../prompts';
import { ProviderResult, RecognitionProvider } from './types';

function extractJson(text: string): any {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  return {};
}

export class GlmProvider implements RecognitionProvider {
  name: 'glm' = 'glm';
  model = 'glm-5';

  private async call(messages: any[]): Promise<ProviderResult> {
    const start = Date.now();
    const response = await fetch(`${env.GLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GLM_API_KEY || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`GLM request failed: ${response.status}`);
    }

    const raw = await response.json();
    const content = raw?.choices?.[0]?.message?.content || '{}';
    const parsed = extractJson(content);
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

    return {
      questions: questions.map((q: any) => ({
        number: String(q.number || ''),
        content: String(q.content || ''),
        knowledgePoint: String(q.knowledgePoint || '未分类'),
        type: String(q.type || '其他'),
      })),
      usage: {
        inputTokens: Number(raw?.usage?.prompt_tokens || 0),
        outputTokens: Number(raw?.usage?.completion_tokens || 0),
        latencyMs: Date.now() - start,
      },
      raw,
    };
  }

  async recognizeFromFiles(files: { mimeType: string; dataBase64: string }[]): Promise<ProviderResult> {
    const userContent = [
      { type: 'text', text: RECOGNIZE_PROMPT },
      ...files.map((f) => ({
        type: 'image_url',
        image_url: { url: `data:${f.mimeType};base64,${f.dataBase64}` },
      })),
    ];

    return this.call([
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content: userContent },
    ]);
  }

  async parseLatex(latexCode: string): Promise<ProviderResult> {
    return this.call([
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content: PARSE_LATEX_PROMPT(latexCode) },
    ]);
  }
}
