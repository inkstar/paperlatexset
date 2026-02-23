import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BankQuestionItem } from '../types';
import { Download, FileText, Layers, MinusCircle, PackageOpen, PlusSquare, Trash2 } from 'lucide-react';
import { getAuthHeaders } from '../services/authClient';

type QueryState = {
  page: number;
  pageSize: number;
  knowledgePoint: string;
  type: string;
  sourceExam: string;
  sourceYear: string;
};

type ApiResponse = {
  data: BankQuestionItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  error: string | null;
  errorCode?: string;
};

const DEFAULT_QUERY: QueryState = {
  page: 1,
  pageSize: 20,
  knowledgePoint: '',
  type: '',
  sourceExam: '',
  sourceYear: '',
};

const BASKET_POS_KEY = 'paper_basket_position_v1';

type BasketPosition = { x: number; y: number };

type ComposerPageProps = {
  onAuthRequired?: () => void;
};

type ClientError = Error & { code?: string };

function createClientError(message: string, code?: string): ClientError {
  const error = new Error(message) as ClientError;
  error.code = code;
  return error;
}

function getFriendlyErrorMessage(error: unknown) {
  const message = (error as Error | undefined)?.message || '';
  if (message.includes('did not match the expected pattern')) {
    return '请求头格式异常（通常是 Bearer token 格式不合法）。请点击右上角“登录/鉴权”，清空 token 后重试。';
  }
  const code = (error as ClientError | undefined)?.code;
  if (code === 'AUTH_REQUIRED') {
    return '当前操作需要登录。请点击右上角“登录/鉴权”后重试。';
  }
  if (code === 'AUTH_FORBIDDEN') {
    return '当前账号权限不足。请切换到 teacher/admin 账号后重试。';
  }
  if (code === 'BACKEND_UNREACHABLE') {
    return '无法连接后端服务，请确认后端已启动（默认 3100 端口）。';
  }
  return message || '请求失败';
}

export const ComposerPage: React.FC<ComposerPageProps> = ({ onAuthRequired }) => {
  const [query, setQuery] = useState<QueryState>(DEFAULT_QUERY);
  const [items, setItems] = useState<BankQuestionItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selected, setSelected] = useState<Record<string, BankQuestionItem>>({});
  const [mobileBasketOpen, setMobileBasketOpen] = useState(false);

  const [basketPos, setBasketPos] = useState<BasketPosition>(() => {
    const cached = localStorage.getItem(BASKET_POS_KEY);
    if (!cached) return { x: window.innerWidth - 380, y: window.innerHeight - 500 };
    try {
      return JSON.parse(cached) as BasketPosition;
    } catch {
      return { x: window.innerWidth - 380, y: window.innerHeight - 500 };
    }
  });

  const dragRef = useRef<{ offsetX: number; offsetY: number; dragging: boolean }>({
    offsetX: 0,
    offsetY: 0,
    dragging: false,
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(query.page));
    params.set('pageSize', String(query.pageSize));
    if (query.knowledgePoint) params.set('knowledgePoint', query.knowledgePoint);
    if (query.type) params.set('type', query.type);
    if (query.sourceExam) params.set('sourceExam', query.sourceExam);
    if (query.sourceYear) params.set('sourceYear', query.sourceYear);
    return params.toString();
  }, [query]);

  async function loadQuestions() {
    setLoading(true);
    setError('');
    try {
      let res: Response;
      try {
        res = await fetch(`/api/questions?${queryString}`, { headers: getAuthHeaders() });
      } catch {
        throw createClientError('后端连接失败', 'BACKEND_UNREACHABLE');
      }
      const json: ApiResponse = await res.json();
      if (!res.ok || json.error) throw createClientError(json.error || '加载失败', json.errorCode || `HTTP_${res.status}`);
      setItems(json.data);
      setMeta(json.meta);
    } catch (error) {
      const code = (error as ClientError | undefined)?.code;
      if (code === 'AUTH_REQUIRED' || code === 'AUTH_FORBIDDEN') onAuthRequired?.();
      setError(getFriendlyErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions();
  }, [queryString]);

  useEffect(() => {
    localStorage.setItem(BASKET_POS_KEY, JSON.stringify(basketPos));
  }, [basketPos]);

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const statsByKnowledgePoint = useMemo(() => {
    const map: Record<string, number> = {};
    for (const q of selectedList) {
      for (const point of q.knowledgePoints || []) {
        map[point] = (map[point] || 0) + 1;
      }
    }
    return map;
  }, [selectedList]);

  function toggleSelect(question: BankQuestionItem) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[question.id]) {
        delete next[question.id];
      } else {
        next[question.id] = question;
      }
      return next;
    });
  }

  function selectCurrentPage() {
    setSelected((prev) => {
      const next = { ...prev };
      for (const q of items) next[q.id] = q;
      return next;
    });
  }

  async function selectAllResults() {
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', String(Math.max(meta.total, 1)));
    if (query.knowledgePoint) params.set('knowledgePoint', query.knowledgePoint);
    if (query.type) params.set('type', query.type);
    if (query.sourceExam) params.set('sourceExam', query.sourceExam);
    if (query.sourceYear) params.set('sourceYear', query.sourceYear);

    try {
      let res: Response;
      try {
        res = await fetch(`/api/questions?${params.toString()}`, { headers: getAuthHeaders() });
      } catch {
        throw createClientError('后端连接失败', 'BACKEND_UNREACHABLE');
      }
      const json: ApiResponse = await res.json();
      if (!res.ok || json.error) throw createClientError(json.error || '全选失败', json.errorCode || `HTTP_${res.status}`);
      setSelected((prev) => {
        const next = { ...prev };
        json.data.forEach((q) => {
          next[q.id] = q;
        });
        return next;
      });
    } catch (error) {
      const code = (error as ClientError | undefined)?.code;
      if (code === 'AUTH_REQUIRED' || code === 'AUTH_FORBIDDEN') onAuthRequired?.();
      setError(getFriendlyErrorMessage(error));
    }
  }

  function clearCurrentPage() {
    setSelected((prev) => {
      const next = { ...prev };
      for (const q of items) delete next[q.id];
      return next;
    });
  }

  async function exportPaper(type: 'latex' | 'word') {
    if (selectedList.length === 0) {
      setError('请先选择题目');
      return;
    }

    try {
      let createRes: Response;
      try {
        createRes = await fetch('/api/papersets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ name: `组卷-${new Date().toLocaleDateString()}` }),
        });
      } catch {
        throw createClientError('后端连接失败', 'BACKEND_UNREACHABLE');
      }
      const created = await createRes.json();
      if (!createRes.ok || created.error) {
        throw createClientError(created.error || '创建组卷失败', created.errorCode || `HTTP_${createRes.status}`);
      }

      const paperSetId = created.data.id;
      const batchRes = await fetch(`/api/papersets/${paperSetId}/items/batch-select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ questionIds: selectedList.map((q) => q.id) }),
      });
      const batchJson = await batchRes.json();
      if (!batchRes.ok || batchJson.error) {
        throw createClientError(batchJson.error || '保存组卷失败', batchJson.errorCode || `HTTP_${batchRes.status}`);
      }

      const exportRes = await fetch(`/api/papersets/${paperSetId}/export-${type}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!exportRes.ok) {
        const errJson = await exportRes.json();
        throw createClientError(errJson.error || '导出失败', errJson.errorCode || `HTTP_${exportRes.status}`);
      }

      const blob = await exportRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'latex' ? 'paper.tex' : 'paper.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      const code = (error as ClientError | undefined)?.code;
      if (code === 'AUTH_REQUIRED' || code === 'AUTH_FORBIDDEN') onAuthRequired?.();
      setError(getFriendlyErrorMessage(error));
    }
  }

  function handleDragStart(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current.dragging = true;
    dragRef.current.offsetX = e.clientX - basketPos.x;
    dragRef.current.offsetY = e.clientY - basketPos.y;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleDragging(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.dragging) return;
    setBasketPos({
      x: Math.max(8, Math.min(window.innerWidth - 340, e.clientX - dragRef.current.offsetX)),
      y: Math.max(8, Math.min(window.innerHeight - 400, e.clientY - dragRef.current.offsetY)),
    });
  }

  function handleDragEnd() {
    dragRef.current.dragging = false;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <input value={query.knowledgePoint} onChange={(e) => setQuery((q) => ({ ...q, page: 1, knowledgePoint: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="知识点" />
          <input value={query.type} onChange={(e) => setQuery((q) => ({ ...q, page: 1, type: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="题型" />
          <input value={query.sourceExam} onChange={(e) => setQuery((q) => ({ ...q, page: 1, sourceExam: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="来源" />
          <input value={query.sourceYear} onChange={(e) => setQuery((q) => ({ ...q, page: 1, sourceYear: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="年份" />
          <button onClick={selectCurrentPage} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg flex items-center justify-center gap-1"><PlusSquare size={14} />当前页全选</button>
          <button onClick={selectAllResults} className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg flex items-center justify-center gap-1"><Layers size={14} />全部结果全选</button>
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={clearCurrentPage} className="px-3 py-1.5 border rounded-lg text-sm">取消当前页</button>
          <button onClick={() => setSelected({})} className="px-3 py-1.5 border rounded-lg text-sm text-red-600">清空试卷篮</button>
          <span className="text-sm text-gray-500 self-center">已选 {selectedList.length} / 命中 {meta.total}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b text-sm text-gray-600">题库列表</div>
        {loading ? <div className="p-4 text-sm text-gray-500">加载中...</div> : null}
        {error ? <div className="p-4 text-sm text-red-600">{error}</div> : null}
        <div className="divide-y">
          {items.map((q) => {
            const checked = !!selected[q.id];
            return (
              <div key={q.id} className="p-3 flex items-start gap-3 hover:bg-gray-50">
                <input type="checkbox" checked={checked} onChange={() => toggleSelect(q)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">#{q.number} · {q.type} · {q.source}</div>
                  <div className="text-sm text-gray-800 break-all">{q.content}</div>
                  <div className="mt-1 text-xs text-blue-600">{q.knowledgePoints.join(' / ')}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t flex items-center justify-between text-sm">
          <span>第 {meta.page} / {Math.max(meta.totalPages, 1)} 页</span>
          <div className="flex gap-2">
            <button
              disabled={query.page <= 1}
              onClick={() => setQuery((q) => ({ ...q, page: Math.max(q.page - 1, 1) }))}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >上一页</button>
            <button
              disabled={query.page >= meta.totalPages}
              onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >下一页</button>
          </div>
        </div>
      </div>

      <button
        className="fixed md:hidden bottom-4 right-4 z-40 px-4 py-3 bg-blue-600 text-white rounded-full shadow-xl"
        onClick={() => setMobileBasketOpen(true)}
      >
        试卷篮 ({selectedList.length})
      </button>

      <div
        className="hidden md:flex fixed z-40 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl flex-col"
        style={{ left: basketPos.x, top: basketPos.y }}
      >
        <div
          className="px-3 py-2 border-b bg-gray-50 cursor-move rounded-t-xl flex items-center justify-between"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragging}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <span className="text-sm font-medium flex items-center gap-1"><PackageOpen size={14} /> 试卷篮</span>
          <span className="text-xs text-gray-500">{selectedList.length} 题</span>
        </div>
        <div className="max-h-64 overflow-auto p-2 space-y-2">
          {selectedList.length === 0 ? <div className="text-xs text-gray-400">暂无已选题目</div> : null}
          {selectedList.map((q) => (
            <div key={q.id} className="text-xs border rounded p-2">
              <div className="text-gray-500">#{q.number} · {q.type}</div>
              <div className="line-clamp-2">{q.stemText || q.content}</div>
              <button onClick={() => toggleSelect(q)} className="mt-1 text-red-600 inline-flex items-center gap-1"><MinusCircle size={12} />移除</button>
            </div>
          ))}
        </div>
        <div className="px-3 py-2 border-t">
          <div className="text-xs text-gray-500 mb-2">知识点统计</div>
          <div className="max-h-20 overflow-auto space-y-1">
            {Object.entries(statsByKnowledgePoint).map(([k, v]) => (
              <div key={k} className="text-xs flex justify-between"><span>{k}</span><span>{v}</span></div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={() => exportPaper('latex')} className="px-2 py-2 bg-blue-600 text-white rounded text-xs flex items-center justify-center gap-1"><FileText size={12} />导出LaTeX</button>
            <button onClick={() => exportPaper('word')} className="px-2 py-2 bg-emerald-600 text-white rounded text-xs flex items-center justify-center gap-1"><Download size={12} />导出Word</button>
          </div>
          <button onClick={() => setSelected({})} className="mt-2 w-full px-2 py-1.5 border text-red-600 rounded text-xs inline-flex justify-center items-center gap-1"><Trash2 size={12} />清空</button>
        </div>
      </div>

      {mobileBasketOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setMobileBasketOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 max-h-[75vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold mb-2">试卷篮 ({selectedList.length})</div>
            <div className="space-y-2">
              {selectedList.map((q) => (
                <div key={q.id} className="text-xs border rounded p-2">
                  <div>{q.stemText || q.content}</div>
                  <button onClick={() => toggleSelect(q)} className="text-red-600 mt-1">移除</button>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => exportPaper('latex')} className="px-3 py-2 bg-blue-600 text-white rounded">导出LaTeX</button>
              <button onClick={() => exportPaper('word')} className="px-3 py-2 bg-emerald-600 text-white rounded">导出Word</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
