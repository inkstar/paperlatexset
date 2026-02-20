import { UploadedFile, QuestionItem } from '../types';

async function postForm<T>(url: string, formData: FormData): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error || 'Request failed');
  }
  return json.data as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error || 'Request failed');
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
