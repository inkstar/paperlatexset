import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BankQuestionItem } from '../types';
import { Download, FileText, Layers, MinusCircle, PackageOpen, PlusSquare, Trash2 } from 'lucide-react';
import { AUTH_BEARER_STORAGE_KEY, getAuthHeaders, setAuthClientConfig } from '../services/authClient';
import { MathText } from './MathText';

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

type FacetsResponse = {
  data: {
    knowledgePoints: string[];
    types: string[];
    sources: string[];
    years: number[];
  };
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
  const [facets, setFacets] = useState<{ knowledgePoints: string[]; types: string[]; sources: string[]; years: number[] }>({
    knowledgePoints: [],
    types: [],
    sources: [],
    years: [],
  });
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

  async function loadFacets() {
    try {
      const params = new URLSearchParams();
      if (query.knowledgePoint) params.set('knowledgePoint', query.knowledgePoint);
      if (query.type) params.set('type', query.type);
      if (query.sourceExam) params.set('sourceExam', query.sourceExam);
      if (query.sourceYear) params.set('sourceYear', query.sourceYear);

      const res = await fetch(`/api/questions/facets?${params.toString()}`, { headers: getAuthHeaders() });
      const json: FacetsResponse = await res.json();
      if (!res.ok || json.error) return;
      setFacets({
        knowledgePoints: Array.isArray(json.data?.knowledgePoints) ? json.data.knowledgePoints : [],
        types: Array.isArray(json.data?.types) ? json.data.types : [],
        sources: Array.isArray(json.data?.sources) ? json.data.sources : [],
        years: Array.isArray(json.data?.years) ? json.data.years : [],
      });
    } catch {
      // Ignore facet loading errors to keep list usable.
    }
  }

  useEffect(() => {
    loadQuestions();
  }, [queryString]);

  useEffect(() => {
    loadFacets();
  }, [query.knowledgePoint, query.type, query.sourceExam, query.sourceYear]);

  useEffect(() => {
    localStorage.setItem(BASKET_POS_KEY, JSON.stringify(basketPos));
  }, [basketPos]);

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const filterOptions = useMemo(() => {
    const knowledgePoints = facets.knowledgePoints.length > 0 ? facets.knowledgePoints : Array.from(new Set(items.flatMap((x) => x.knowledgePoints)));
    const types = facets.types.length > 0 ? facets.types : Array.from(new Set(items.map((x) => x.type).filter(Boolean)));
    const sources = facets.sources.length > 0 ? facets.sources : Array.from(new Set(items.map((x) => x.source).filter(Boolean)));
    const years = facets.years.length > 0 ? facets.years.map((x) => String(x)) : [];
    return {
      knowledgePoints: knowledgePoints.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
      types: types.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
      sources: sources.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
      years,
    };
  }, [facets.knowledgePoints, facets.sources, facets.types, facets.years, items]);
  const statsByKnowledgePoint = useMemo(() => {
    const map: Record<string, number> = {};
    for (const q of selectedList) {
      for (const point of q.knowledgePoints || []) {
        map[point] = (map[point] || 0) + 1;
      }
    }
    return map;
  }, [selectedList]);
  const activeFilterCount = useMemo(() => {
    return [query.knowledgePoint, query.type, query.sourceExam, query.sourceYear].filter((v) => v.trim() !== '').length;
  }, [query.knowledgePoint, query.sourceExam, query.sourceYear, query.type]);

  function applyQuickFilter(key: 'knowledgePoint' | 'type' | 'sourceExam', value: string) {
    setQuery((prev) => ({
      ...prev,
      page: 1,
      [key]: prev[key] === value ? '' : value,
    }));
  }

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

  function clearStoredToken() {
    localStorage.removeItem(AUTH_BEARER_STORAGE_KEY);
    setAuthClientConfig({ bearerToken: '' });
    setError('已清空本地 token，可重试操作。');
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
        <datalist id="composer-kp-options">
          {filterOptions.knowledgePoints.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        <datalist id="composer-type-options">
          {filterOptions.types.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        <datalist id="composer-source-options">
          {filterOptions.sources.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        <datalist id="composer-year-options">
          {filterOptions.years.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">筛选器</div>
          <div className="text-xs text-slate-500">已启用筛选 {activeFilterCount}</div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
          <input list="composer-kp-options" value={query.knowledgePoint} onChange={(e) => setQuery((q) => ({ ...q, page: 1, knowledgePoint: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="知识点" />
          <input list="composer-type-options" value={query.type} onChange={(e) => setQuery((q) => ({ ...q, page: 1, type: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="题型" />
          <input list="composer-source-options" value={query.sourceExam} onChange={(e) => setQuery((q) => ({ ...q, page: 1, sourceExam: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="来源" />
          <input list="composer-year-options" value={query.sourceYear} onChange={(e) => setQuery((q) => ({ ...q, page: 1, sourceYear: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="年份" />
          <button onClick={selectCurrentPage} className="flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-sm text-white transition hover:bg-blue-700"><PlusSquare size={14} />当前页全选</button>
          <button onClick={selectAllResults} className="flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white transition hover:bg-indigo-700"><Layers size={14} />全部结果全选</button>
        </div>
        <div className="mt-3 space-y-2">
          {filterOptions.knowledgePoints.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {filterOptions.knowledgePoints.slice(0, 8).map((kp) => {
                const active = query.knowledgePoint === kp;
                return (
                  <button
                    key={kp}
                    onClick={() => applyQuickFilter('knowledgePoint', kp)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
                    }`}
                  >
                    {kp}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {filterOptions.types.slice(0, 5).map((t) => {
              const active = query.type === t;
              return (
                <button
                  key={t}
                  onClick={() => applyQuickFilter('type', t)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    active
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setQuery((q) => ({ ...q, page: 1, knowledgePoint: '', type: '', sourceExam: '', sourceYear: '' }))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
          >
            清空筛选
          </button>
          <button onClick={clearCurrentPage} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">取消当前页</button>
          <button onClick={() => setSelected({})} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600">清空试卷篮</button>
          <span className="self-center text-sm text-slate-500">已选 {selectedList.length} / 命中 {meta.total}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3 text-sm">
          <span className="font-medium text-slate-700">题库列表</span>
          <span className="text-xs text-slate-500">共 {meta.total} 题</span>
        </div>
        {loading ? <div className="p-4 text-sm text-slate-500">加载中...</div> : null}
        {error ? (
          <div className="flex items-center justify-between gap-2 p-4 text-sm text-red-600">
            <span>{error}</span>
            <button onClick={clearStoredToken} className="shrink-0 rounded border border-red-200 px-2 py-1 text-xs text-red-700">
              清空本地 token
            </button>
          </div>
        ) : null}
        <div className="divide-y divide-slate-100">
          {items.map((q) => {
            const checked = !!selected[q.id];
            return (
              <div key={q.id} className={`flex items-start gap-3 p-3 transition ${checked ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleSelect(q)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">#{q.number}</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{q.type}</span>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">{q.source || '未标注来源'}</span>
                  </div>
                  <MathText text={q.content} className="break-words text-[15px] leading-7 text-slate-800" />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {q.knowledgePoints.map((kp) => (
                      <button
                        key={`${q.id}-${kp}`}
                        onClick={() => applyQuickFilter('knowledgePoint', kp)}
                        className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                      >
                        {kp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t p-3 text-sm">
          <span className="text-slate-600">第 {meta.page} / {Math.max(meta.totalPages, 1)} 页</span>
          <div className="flex gap-2">
            <button
              disabled={query.page <= 1}
              onClick={() => setQuery((q) => ({ ...q, page: Math.max(q.page - 1, 1) }))}
              className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
            >上一页</button>
            <button
              disabled={query.page >= meta.totalPages}
              onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}
              className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
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
              <MathText text={q.stemText || q.content} className="line-clamp-2 break-words" />
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
                  <MathText text={q.stemText || q.content} className="break-words" />
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
