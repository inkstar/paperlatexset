import { UploadedFile, QuestionItem } from '../types';
import { getAuthHeaders } from './authClient';

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

export async function analyzeExam(files: UploadedFile[], provider?: 'gemini' | 'glm'): Promise<QuestionItem[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f.file));
  if (provider) formData.append('provider', provider);

  const data = await postForm<{ questions: Array<any> }>('/api/analyze', formData);
  const todayStr = new Date().toISOString().split('T')[0];

  return data.questions.map((q, idx) => {
    let cleanContent = q.content || '';
    if (typeof cleanContent === 'string') {
      cleanContent = cleanContent.replace(/\\n/g, '\\\\');
      if (q.type === '填空题') {
        cleanContent = cleanContent.replace(/_{3,}/g, '$\\fillin$');
        cleanContent = cleanContent.replace(/（\s*）/g, '$\\fillin$');
        cleanContent = cleanContent.replace(/(?<!\$)\\fillin(?!\$)/g, '$\\fillin$');
      }
    }

    return {
      id: `q-${idx}-${Date.now()}`,
      number: q.number || `${idx + 1}`,
      content: cleanContent,
      knowledgePoint: q.knowledgePoint || '未分类',
      source: todayStr,
      type: q.type || '其他',
    };
  });
}

export async function parseLatexToQuestions(latexCode: string, provider?: 'gemini' | 'glm'): Promise<QuestionItem[]> {
  const data = await postJson<{ questions: Array<any> }>('/api/parse-latex', { latexCode, provider });
  const todayStr = new Date().toISOString().split('T')[0];

  return data.questions.map((q, idx) => ({
    id: `imported-${idx}-${Date.now()}`,
    number: q.number || `${idx + 1}`,
    content: q.content || '',
    knowledgePoint: q.knowledgePoint || '未分类',
    source: q.source || todayStr,
    type: q.type || '其他',
  }));
}
