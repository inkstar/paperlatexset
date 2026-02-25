import { UploadedFile, QuestionItem } from '../types';
import { getAuthHeaders } from './authClient';
import { normalizeLatexContent } from '../shared/latexNormalizer';
import { GoogleGenAI } from '@google/genai';

export class ApiError extends Error {
  code?: string;
  status?: number;
  details?: Record<string, unknown> | null;

  constructor(message: string, opts?: { code?: string; status?: number; details?: Record<string, unknown> | null }) {
    super(message);
    this.name = 'ApiError';
    this.code = opts?.code;
    this.status = opts?.status;
    this.details = opts?.details || null;
  }
}

async function parseResponseJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function postForm<T>(url: string, formData: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
  } catch {
    throw new ApiError('无法连接后端服务，请确认后端已启动（默认 3100 端口）。', { code: 'BACKEND_UNREACHABLE' });
  }

  const json = await parseResponseJson(res);
  const requestId = res.headers.get('x-request-id');
  if (!res.ok || json?.error) {
    throw new ApiError(json?.error || 'Request failed', {
      code: json?.errorCode || `HTTP_${res.status}`,
      status: res.status,
      details: { ...(json?.details || {}), requestId },
    });
  }
  return json.data as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('无法连接后端服务，请确认后端已启动（默认 3100 端口）。', { code: 'BACKEND_UNREACHABLE' });
  }

  const json = await parseResponseJson(res);
  const requestId = res.headers.get('x-request-id');
  if (!res.ok || json?.error) {
    throw new ApiError(json?.error || 'Request failed', {
      code: json?.errorCode || `HTTP_${res.status}`,
      status: res.status,
      details: { ...(json?.details || {}), requestId },
    });
  }
  return json.data as T;
}

function getBrowserGeminiConfig() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const model = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || 'gemini-2.5-flash';
  return { apiKey: apiKey?.trim() || '', model };
}

function parseJsonLoose(text: string): any {
  const raw = (text || '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const obj = raw.match(/\{[\s\S]*\}/);
    if (obj?.[0]) return JSON.parse(obj[0]);
    return {};
  }
}

async function fileToInlinePart(file: File) {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const result = String(reader.result || '');
        resolve(result.split(',')[1] || '');
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: base64,
      mimeType: file.type || 'application/octet-stream',
    },
  };
}

function toQuestionItems(rawQuestions: any[], source: string) {
  return rawQuestions.map((q, idx) => ({
    id: `q-local-${idx}-${Date.now()}`,
    number: q.number || `${idx + 1}`,
    content: normalizeLatexContent(q.content || '', q.type || '其他'),
    knowledgePoint: q.knowledgePoint || '未分类',
    source,
    type: q.type || '其他',
  }));
}

async function analyzeExamViaBrowserGemini(files: UploadedFile[]): Promise<QuestionItem[]> {
  const { apiKey, model } = getBrowserGeminiConfig();
  if (!apiKey) {
    throw new ApiError('后端不可用，且未配置前端 Gemini Key（VITE_GEMINI_API_KEY）。', {
      code: 'BACKEND_UNREACHABLE',
    });
  }

  const ai = new GoogleGenAI({ apiKey });
  const all: QuestionItem[] = [];
  for (const file of files) {
    const part = await fileToInlinePart(file.file);
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            part,
            {
              text:
                '请识别图片中的题目并返回 JSON，格式：{"questions":[{"number":"1","content":"...","knowledgePoint":"...","type":"..."}]}。只输出 JSON，不要解释文字。',
            },
          ],
        },
      ],
    });
    const json = parseJsonLoose(response.text || '{}');
    const questions = Array.isArray(json?.questions) ? json.questions : [];
    all.push(...toQuestionItems(questions, file.file.name));
  }
  return all;
}

async function parseLatexViaBrowserGemini(latexCode: string): Promise<QuestionItem[]> {
  const { apiKey, model } = getBrowserGeminiConfig();
  if (!apiKey) {
    throw new ApiError('后端不可用，且未配置前端 Gemini Key（VITE_GEMINI_API_KEY）。', {
      code: 'BACKEND_UNREACHABLE',
    });
  }
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `请把下面 LaTeX 解析为题目 JSON，格式：{"questions":[{"number":"1","content":"...","knowledgePoint":"...","type":"..."}]}。只输出 JSON：\n${latexCode}`,
          },
        ],
      },
    ],
  });
  const json = parseJsonLoose(response.text || '{}');
  const todayStr = new Date().toISOString().split('T')[0];
  const questions = Array.isArray(json?.questions) ? json.questions : [];
  return toQuestionItems(questions, todayStr);
}

export async function analyzeExam(files: UploadedFile[], provider?: 'gemini' | 'glm'): Promise<QuestionItem[]> {
  try {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f.file));
    if (provider) formData.append('provider', provider);

    const data = await postForm<{ questions: Array<any> }>('/api/analyze', formData);
    const todayStr = new Date().toISOString().split('T')[0];

    return data.questions.map((q, idx) => {
      const cleanContent = normalizeLatexContent(q.content || '', q.type || '其他');

      return {
        id: `q-${idx}-${Date.now()}`,
        number: q.number || `${idx + 1}`,
        content: cleanContent,
        knowledgePoint: q.knowledgePoint || '未分类',
        source: todayStr,
        type: q.type || '其他',
      };
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'BACKEND_UNREACHABLE') {
      return analyzeExamViaBrowserGemini(files);
    }
    throw error;
  }
}

export async function parseLatexToQuestions(latexCode: string, provider?: 'gemini' | 'glm'): Promise<QuestionItem[]> {
  try {
    const data = await postJson<{ questions: Array<any> }>('/api/parse-latex', { latexCode, provider });
    const todayStr = new Date().toISOString().split('T')[0];

    return data.questions.map((q, idx) => ({
      id: `imported-${idx}-${Date.now()}`,
      number: q.number || `${idx + 1}`,
      content: normalizeLatexContent(q.content || '', q.type || '其他'),
      knowledgePoint: q.knowledgePoint || '未分类',
      source: q.source || todayStr,
      type: q.type || '其他',
    }));
  } catch (error) {
    if (error instanceof ApiError && error.code === 'BACKEND_UNREACHABLE') {
      return parseLatexViaBrowserGemini(latexCode);
    }
    throw error;
  }
}
