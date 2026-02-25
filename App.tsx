
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { 
  UploadCloud, 
  Wand2, 
  RefreshCw, 
  AlertCircle, 
  FileUp, 
  ArrowUpDown, 
  FileText, 
  Layers, 
  CheckSquare, 
  Hash, 
  History as HistoryIcon, 
  X,
  RotateCw,
  RotateCcw,
  Layout,
  ClipboardPaste,
  PlusCircle,
  Import,
  Settings2,
  Type as TypeIcon,
  Info,
  Sparkles,
  ChevronRight
} from 'lucide-react';

import { UploadedFile, ProcessingStatus, HistoryRecord, QuestionItem, StyleSettings } from './types';
import { ApiError, analyzeExam, parseLatexToQuestions } from './services/geminiService';
import { SortableFileItem } from './components/SortableFileItem';
import { LatexOutput } from './components/LatexOutput';
import { HistoryPanel } from './components/HistoryPanel';
import { QuestionTable } from './components/QuestionTable';
import { PREAMBLE_TEMPLATE } from './constants';
import { ComposerPage } from './components/ComposerPage';
import {
  AuthCapabilities,
  fetchAuthCapabilities,
  fetchWechatAuthorizeUrl,
  fetchCurrentUser,
  loginWithWechatCode,
  loginWithCode,
  loginWithEmail,
  registerWithEmail,
  requestLoginCode,
} from './services/authApi';
import {
  AUTH_BEARER_STORAGE_KEY,
  AUTH_ROLE_STORAGE_KEY,
  DevAuthRole,
  getAuthClientConfig,
  getAuthHeaders,
  setAuthClientConfig,
} from './services/authClient';

const uid = () => Math.random().toString(36).substring(2, 9);

function getFriendlyErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.code === 'BACKEND_UNREACHABLE') {
      return '无法连接后端服务。请先启动后端（默认端口 3100），或执行 npm run dev / npm run preview:full。';
    }
    if (error.code === 'PROVIDER_NOT_CONFIGURED') {
      return '识别模型未配置。请在 .env.server 中配置 Gemini/GLM 的 API Key，或切换已配置的 provider。';
    }
    if (error.code === 'PROVIDER_AUTH_FAILED') {
      return '识别模型鉴权失败。请检查 API Key、权限和配额配置。';
    }
    if (error.code === 'PROVIDER_RATE_LIMITED') {
      return '识别模型触发限流。请稍后重试，或切换到另一 provider。';
    }
    if (error.code === 'PROVIDER_UPSTREAM_ERROR') {
      return '识别模型上游或网络异常。请稍后重试并查看后端日志中的 request-id。';
    }
    if (error.code === 'PROVIDER_RESPONSE_INVALID') {
      return '识别模型返回格式异常。请重试或切换 provider。';
    }
    if (error.code === 'PROVIDER_PRECHECK_FAILED') {
      return '识别预检查失败：当前 provider 配置与模型设置不一致。';
    }
    if (error.code === 'PROVIDER_REQUEST_FAILED') {
      return `模型请求失败：${error.message}`;
    }
    if (error.code === 'AUTH_EMAIL_NOT_CONFIGURED') {
      return '邮箱验证码通道未配置。请在后端开启邮箱通道，或先使用邮箱密码登录。';
    }
    if (error.code === 'AUTH_SMS_NOT_CONFIGURED') {
      return '短信验证码通道未配置。请先使用邮箱登录，或配置短信/验证码通道。';
    }
    if (error.code === 'AUTH_CODE_DELIVERY_FAILED') {
      return '验证码投递失败。请稍后重试，或联系管理员检查 webhook/短信网关。';
    }
    if (error.code === 'AUTH_CODE_INVALID') {
      return '验证码错误，请检查后重试。';
    }
    if (error.code === 'AUTH_CODE_EXPIRED') {
      return '验证码已过期，请重新获取验证码。';
    }
    if (error.code === 'AUTH_WECHAT_NOT_CONFIGURED') {
      return '微信登录尚未配置。请先在后端设置 WECHAT_APP_ID / WECHAT_APP_SECRET / WECHAT_REDIRECT_URI。';
    }
    if (error.code === 'AUTH_WECHAT_EXCHANGE_NOT_IMPLEMENTED') {
      return '微信授权链接已就绪，但回调换码登录还未实现。当前可继续使用邮箱/验证码登录。';
    }
    if (error.code === 'AUTH_WECHAT_CODE_INVALID') {
      return '微信授权码无效或已过期，请重新发起微信登录。';
    }
    if (error.code === 'AUTH_WECHAT_UPSTREAM_FAILED') {
      return '微信服务暂时不可用，请稍后重试。';
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

const CHANGELOG = [
  {
    version: "v1.1.0",
    date: "2026-02-20",
    features: [
      "✨ 智能页眉：自动根据题目来源设置页眉标题",
      "🎨 样式增强：新增知识点、题目来源显示开关",
      "🔢 题号恢复：完美支持保留识别到的原始题号",
      "📝 更新说明：新增版本功能介绍模块",
      "🏗️ 结构优化：题目自动包裹 minipage 防止跨页断开"
    ]
  },
  {
    version: "v1.0.9",
    date: "2026-02-19",
    features: [
      "🚀 Overleaf 导出：一键发送至 Overleaf 并自动设置 XeLaTeX",
      "📏 间距调整：支持自由设置题间距与行间距",
      "📥 导入功能：支持将已有 LaTeX 代码重新解析为列表"
    ]
  }
];

export default function App() {
  const [activeView, setActiveView] = useState<'extract' | 'compose'>('extract');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Options
  const [sortByType, setSortByType] = useState(false);
  const [keepOriginalNumbers, setKeepOriginalNumbers] = useState(false);
  const [appendMode, setAppendMode] = useState(false);

  // Style Settings
  const [style, setStyle] = useState<StyleSettings>({
    showHeaderFooter: true,
    showKnowledgePoint: true,
    showSource: true,
    headerTitle: '',
    choiceGap: '2cm',
    solutionGap: '6cm',
    lineSpacing: 1.5
  });

  const [showHistory, setShowHistory] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [authRole, setAuthRole] = useState<DevAuthRole>('teacher');
  const [authBearerToken, setAuthBearerToken] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'email_login' | 'email_register' | 'code_login'>('email_login');
  const [authIdentity, setAuthIdentity] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [currentAuthSummary, setCurrentAuthSummary] = useState('');
  const [wechatAuthorizeUrl, setWechatAuthorizeUrl] = useState('');
  const [authCapabilities, setAuthCapabilities] = useState<AuthCapabilities | null>(null);

  useEffect(() => {
    const storedRole = localStorage.getItem(AUTH_ROLE_STORAGE_KEY) as DevAuthRole | null;
    const storedToken = localStorage.getItem(AUTH_BEARER_STORAGE_KEY) || '';
    if (storedRole === 'admin' || storedRole === 'teacher' || storedRole === 'viewer') {
      setAuthRole(storedRole);
    }
    setAuthBearerToken(storedToken);
  }, []);

  useEffect(() => {
    localStorage.setItem(AUTH_ROLE_STORAGE_KEY, authRole);
    localStorage.setItem(AUTH_BEARER_STORAGE_KEY, authBearerToken);
    setAuthClientConfig({ role: authRole, bearerToken: authBearerToken });
    const sanitized = getAuthClientConfig().bearerToken;
    if (authBearerToken && !sanitized) {
      setAuthMessage('检测到 Bearer token 格式不合法，已自动忽略并回退为角色鉴权。');
    }
  }, [authRole, authBearerToken]);

  const identityInput = authIdentity.trim();
  const identityIsPhone = /^1\d{10}$/.test(identityInput);
  const identityPayload = identityIsPhone ? { phone: identityInput } : { email: identityInput.toLowerCase() };

  const handleRequestCode = async () => {
    if (!identityInput) {
      setAuthMessage('请输入邮箱或手机号。');
      return;
    }
    setAuthLoading(true);
    setAuthMessage('');
    try {
      const resp = await requestLoginCode(identityPayload);
      setCodeRequested(true);
      setAuthMessage(`验证码已发送（开发模式验证码：${resp.debugCode || '请查看服务端通道'}）`);
    } catch (error: unknown) {
      setAuthMessage(getFriendlyErrorMessage(error, '验证码发送失败。'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSubmitAuth = async () => {
    if (!identityInput) {
      setAuthMessage('请输入邮箱或手机号。');
      return;
    }
    setAuthLoading(true);
    setAuthMessage('');
    try {
      let result;
      if (authMode === 'email_register') {
        if (!authPassword) {
          setAuthMessage('请输入密码。');
          setAuthLoading(false);
          return;
        }
        result = await registerWithEmail(identityPayload.email || '', authPassword);
      } else if (authMode === 'email_login') {
        if (!authPassword) {
          setAuthMessage('请输入密码。');
          setAuthLoading(false);
          return;
        }
        result = await loginWithEmail(identityPayload.email || '', authPassword);
      } else {
        if (!authCode) {
          setAuthMessage('请输入验证码。');
          setAuthLoading(false);
          return;
        }
        result = await loginWithCode({ ...identityPayload, code: authCode });
      }

      setAuthBearerToken(result.accessToken);
      setAuthMessage(`登录成功：${result.user.email} (${result.user.role})`);
      setCurrentAuthSummary(`${result.user.email} · ${result.user.role}`);
    } catch (error: unknown) {
      setAuthMessage(getFriendlyErrorMessage(error, '登录失败。'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCheckCurrentAuth = async () => {
    setAuthLoading(true);
    setAuthMessage('');
    try {
      const data = await fetchCurrentUser();
      setCurrentAuthSummary(`${data.user.email} · ${data.user.role} · ${data.auth.mode}`);
      setAuthMessage(`当前身份：${data.user.email} (${data.user.role})`);
    } catch (error: unknown) {
      setCurrentAuthSummary('');
      setAuthMessage(getFriendlyErrorMessage(error, '身份校验失败。'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleFetchWechatUrl = async () => {
    setAuthLoading(true);
    setAuthMessage('');
    try {
      const state = `paper_${Date.now()}`;
      const data = await fetchWechatAuthorizeUrl(state);
      setWechatAuthorizeUrl(data.authorizeUrl);
      setAuthMessage('微信授权链接已生成，可点击下方“打开微信登录页”。');
    } catch (error: unknown) {
      setWechatAuthorizeUrl('');
      setAuthMessage(getFriendlyErrorMessage(error, '获取微信授权链接失败。'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleFetchAuthCapabilities = async () => {
    try {
      const data = await fetchAuthCapabilities();
      setAuthCapabilities(data);
    } catch {
      setAuthCapabilities(null);
    }
  };

  const clearBearerToken = () => {
    setAuthBearerToken('');
    setCurrentAuthSummary('');
    setAuthMessage('已清空本地 Bearer token，将回退为开发角色鉴权。');
  };

  useEffect(() => {
    if (showAuthModal) {
      handleFetchAuthCapabilities();
    }
  }, [showAuthModal]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state || !state.startsWith('paper_')) {
      return;
    }

    setShowAuthModal(true);
    setAuthLoading(true);
    setAuthMessage('检测到微信回调，正在完成登录...');
    loginWithWechatCode(code)
      .then((result) => {
        setAuthBearerToken(result.accessToken);
        setCurrentAuthSummary(`${result.user.email} · ${result.user.role} · wechat`);
        setAuthMessage(`微信登录成功：${result.user.email} (${result.user.role})`);
        const next = new URL(window.location.href);
        next.searchParams.delete('code');
        next.searchParams.delete('state');
        window.history.replaceState({}, '', next.pathname + next.search);
      })
      .catch((error: unknown) => {
        setAuthMessage(getFriendlyErrorMessage(error, '微信登录失败。'));
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('math_latex_history_v2');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const openLogKey = 'page_open_logged_v1';
    if (sessionStorage.getItem(openLogKey) === '1') {
      return;
    }

    const payload = {
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent,
      openedAt: new Date().toISOString(),
    };

    fetch('/api/client-events/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload),
      keepalive: true,
    })
      .then(() => {
        sessionStorage.setItem(openLogKey, '1');
      })
      .catch(() => {
        // Ignore logging failures in UI flow.
      });
  }, []);

  // Sync default header title based on questions sources
  useEffect(() => {
    if (questions.length > 0) {
      const sources = Array.from(new Set(questions.map(q => q.source))).filter(s => s && s.trim() !== '');
      const today = new Date();
      const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
      
      // If user hasn't manually typed a custom title, auto-detect
      if (!style.headerTitle || CHANGELOG.some(c => style.headerTitle.includes('试卷'))) {
         if (sources.length === 1) {
           setStyle(prev => ({ ...prev, headerTitle: sources[0] }));
         } else {
           setStyle(prev => ({ ...prev, headerTitle: dateStr + '试卷' }));
         }
      }
    }
  }, [questions]);

  const saveToHistory = useCallback((record: HistoryRecord) => {
    setHistory(prev => {
      const updated = [record, ...prev].slice(0, 50);
      localStorage.setItem('math_latex_history_v2', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const generatedLatex = useMemo(() => {
    if (questions.length === 0) return '';

    const today = new Date();
    const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    const finalTitle = style.headerTitle || (dateStr + '试卷');
    
    // Dynamic Preamble
    let fancyHdrConfig = '';
    if (style.showHeaderFooter) {
      fancyHdrConfig = `
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[C]{${finalTitle}}
\\fancyfoot[C]{第 \\thepage 页}
      `;
    } else {
      fancyHdrConfig = `\\pagestyle{empty}`;
    }

    let customizedPreamble = PREAMBLE_TEMPLATE
      .replace('__EXAM_TITLE__', finalTitle)
      .replace('__CHOICE_GAP__', style.choiceGap)
      .replace('__SOLUTION_GAP__', style.solutionGap)
      .replace('__LINE_SPACING__', style.lineSpacing.toString())
      .replace('__FANCY_HDR_CONFIG__', fancyHdrConfig);

    let body = `\\begin{document}\n\n`;

    const formatQuestion = (q: QuestionItem) => {
      // Restore "Keep Original Numbering" logic
      const itemLabel = keepOriginalNumbers ? `[${q.number}.]` : '';
      
      // Dynamic meta info (Knowledge points and Source)
      const metaParts = [];
      if (style.showKnowledgePoint && q.knowledgePoint) metaParts.push(q.knowledgePoint);
      if (style.showSource && q.source) metaParts.push(q.source);
      const metaInfo = metaParts.length > 0 ? `(${metaParts.join(', ')})` : '';
      
      let content = '';
      if (q.type === '解答题') {
        content = `  \\item${itemLabel} \\begin{minipage}[t]{\\linewidth} ${metaInfo} \\\\ \n  ${q.content}\n  \\vspace{\\solutiongap} \\end{minipage}\n`;
      } else {
        content = `  \\item${itemLabel} \\begin{minipage}[t]{\\linewidth} ${metaInfo} ${q.content}\n  \\vspace{\\choicegap} \\end{minipage}\n`;
      }
      return content;
    };

    if (sortByType) {
      const types = Array.from(new Set(questions.map(q => q.type)));
      types.forEach(type => {
        body += `\\section*{${type}}\n`;
        body += `\\begin{enumerate}[label=\\arabic*.]\n`;
        questions.filter(q => q.type === type).forEach(q => {
          body += formatQuestion(q);
        });
        body += `\\end{enumerate}\n\n`;
      });
    } else {
      body += `\\begin{enumerate}[label=\\arabic*.]\n`;
      questions.forEach(q => {
        body += formatQuestion(q);
      });
      body += `\\end{enumerate}\n`;
    }

    body += `\n\\end{document}`;
    return customizedPreamble + body;
  }, [questions, sortByType, keepOriginalNumbers, style]);

  const handleUpdateQuestion = (id: string, field: keyof QuestionItem, value: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handleBatchUpdate = (startIdx: number, endIdx: number, field: keyof QuestionItem, value: string) => {
    setQuestions(prev => prev.map((q, idx) => {
      const sequence = idx + 1;
      return (sequence >= startIdx && sequence <= endIdx) ? { ...q, [field]: value } : q;
    }));
  };

  const handleImportLatex = async () => {
    if (!importText.trim()) return;
    setIsImporting(true);
    setErrorMessage('');
    try {
      const parsed = await parseLatexToQuestions(importText);
      setQuestions(prev => appendMode ? [...prev, ...parsed] : parsed);
      setShowImportModal(false);
      setImportText('');
    } catch (error: unknown) {
      setErrorMessage(getFriendlyErrorMessage(error, '无法解析 LaTeX 代码。'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleGenerate = async () => {
    if (files.length === 0) return;
    setStatus(ProcessingStatus.PROCESSING);
    setErrorMessage('');
    try {
      const extractedQuestions = await analyzeExam(files);
      let finalQuestions;
      if (appendMode) {
        const lastNum = questions.length > 0 ? parseInt(questions[questions.length - 1].number) : 0;
        const offsetExtracted = extractedQuestions.map((q, i) => ({
          ...q,
          number: isNaN(lastNum) ? q.number : (lastNum + i + 1).toString()
        }));
        finalQuestions = [...questions, ...offsetExtracted];
      } else {
        finalQuestions = extractedQuestions;
      }
      setQuestions(finalQuestions);
      setStatus(ProcessingStatus.SUCCESS);
      saveToHistory({
        id: uid(),
        timestamp: Date.now(),
        title: `${files.length} 个文件生成的试卷`,
        fileNames: files.map(f => f.file.name),
        questions: finalQuestions,
        latex: generatedLatex,
        options: { sortByType, keepOriginalNumbers, enableTikz: false, style }
      });
    } catch (error: unknown) {
      setStatus(ProcessingStatus.ERROR);
      setErrorMessage(getFriendlyErrorMessage(error, '分析试卷时发生错误。'));
    }
  };

  const processFiles = useCallback((incomingFiles: File[]) => {
    const newFiles = incomingFiles.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf').map(file => ({
      id: uid(), file, type: (file.type.startsWith('image/') ? 'image' : 'pdf') as 'image' | 'pdf',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (showImportModal) return;
    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          pastedFiles.push(new File([blob], `pasted-${Date.now()}.png`, { type: blob.type }));
        }
      }
    }
    if (pastedFiles.length > 0) processFiles(pastedFiles);
  }, [processFiles, showImportModal]);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50" onPaste={handlePaste}>
      {/* Modals */}
      {showChangelog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Sparkles size={20} className="text-yellow-500" /> 版本更新说明
              </h3>
              <button onClick={() => setShowChangelog(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-8">
              {CHANGELOG.map((log, i) => (
                <div key={i} className="relative pl-6 border-l-2 border-blue-100">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 bg-blue-500 rounded-full border-2 border-white" />
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="font-bold text-blue-600 text-lg">{log.version}</span>
                    <span className="text-xs text-gray-400 font-mono">{log.date}</span>
                  </div>
                  <ul className="space-y-2">
                    {log.features.map((f, fi) => (
                      <li key={fi} className="text-sm text-gray-600 flex gap-2">
                        <span className="text-blue-300">•</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-center">
              <button onClick={() => setShowChangelog(false)} className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">我知道了</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Import size={20} className="text-blue-600" /> 导入现有 LaTeX 代码
              </h3>
              <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <textarea 
                className="w-full h-64 p-4 font-mono text-sm bg-gray-900 text-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="\begin{enumerate} ... \item ... \end{enumerate}"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                <button disabled={!importText.trim() || isImporting} onClick={handleImportLatex} className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-2">
                  {isImporting ? <RefreshCw className="animate-spin" size={16}/> : <CheckSquare size={16}/>} 解析并加载
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800">登录与鉴权</h3>
              <button onClick={() => setShowAuthModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setAuthMode('email_login')} className={`px-3 py-1.5 rounded text-sm ${authMode === 'email_login' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>邮箱登录</button>
                <button onClick={() => setAuthMode('email_register')} className={`px-3 py-1.5 rounded text-sm ${authMode === 'email_register' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>邮箱注册</button>
                <button onClick={() => setAuthMode('code_login')} className={`px-3 py-1.5 rounded text-sm ${authMode === 'code_login' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>验证码登录</button>
              </div>

              <input
                type="text"
                value={authIdentity}
                onChange={(e) => setAuthIdentity(e.target.value)}
                placeholder={authMode === 'code_login' ? '邮箱或手机号(11位)' : '邮箱'}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />

              {(authMode === 'email_login' || authMode === 'email_register') && (
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="密码（至少8位）"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              )}

              {authMode === 'code_login' && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder="6位验证码"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  />
                  <button
                    onClick={handleRequestCode}
                    disabled={authLoading}
                    className="px-3 py-2 text-sm rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                  >
                    获取验证码
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSubmitAuth}
                  disabled={authLoading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {authLoading ? '处理中...' : '提交'}
                </button>
                <button
                  onClick={handleCheckCurrentAuth}
                  disabled={authLoading}
                  className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  校验当前身份
                </button>
                <button
                  onClick={() => {
                    setAuthBearerToken('');
                    setCurrentAuthSummary('');
                    setWechatAuthorizeUrl('');
                    setAuthMessage('已清除 Bearer token');
                  }}
                  className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50"
                >
                  退出登录
                </button>
              </div>

              <div className="border-t pt-3">
                {authCapabilities && (
                  <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-1">
                    <div>服务能力：</div>
                    <div>验证码：email {authCapabilities.codeLogin.emailEnabled ? 'on' : 'off'} / phone {authCapabilities.codeLogin.phoneEnabled ? 'on' : 'off'} / debug {authCapabilities.codeLogin.debugEnabled ? 'on' : 'off'}</div>
                    <div>微信登录：{authCapabilities.wechat.configured ? 'configured' : 'not configured'}</div>
                    <div>存储模式：{authCapabilities.storage.mode}（fallback {authCapabilities.storage.fallbackLocalEnabled ? 'on' : 'off'}）</div>
                  </div>
                )}
                <div className="text-xs text-gray-500 mb-2">微信登录（预留）</div>
                <div className="flex gap-2">
                  <button
                    onClick={handleFetchAuthCapabilities}
                    disabled={authLoading}
                    className="px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    刷新服务状态
                  </button>
                  <button
                    onClick={handleFetchWechatUrl}
                    disabled={authLoading}
                    className="px-4 py-2 border border-green-200 text-green-700 text-sm rounded-lg hover:bg-green-50 disabled:opacity-50"
                  >
                    获取微信登录链接
                  </button>
                  {wechatAuthorizeUrl && (
                    <a
                      href={wechatAuthorizeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                    >
                      打开微信登录页
                    </a>
                  )}
                </div>
              </div>

              {authMessage && <div className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{authMessage}</div>}
              {currentAuthSummary && <div className="text-xs text-gray-500">当前：{currentAuthSummary}</div>}
              {authMode === 'code_login' && !codeRequested && (
                <div className="text-xs text-gray-400">提示：当前开发模式会在响应中返回 `debugCode`。</div>
              )}
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4" onClick={() => setPreviewImage(null)}>
          <div className="absolute top-4 right-4 flex gap-4 z-50">
            <button onClick={(e) => { e.stopPropagation(); setRotation(r => r - 90); }} className="text-white bg-white/10 p-2 rounded-full"><RotateCcw size={24}/></button>
            <button onClick={(e) => { e.stopPropagation(); setRotation(r => r + 90); }} className="text-white bg-white/10 p-2 rounded-full"><RotateCw size={24}/></button>
            <button onClick={() => setPreviewImage(null)} className="text-white bg-white/10 p-2 rounded-full"><X size={24}/></button>
          </div>
          <img src={previewImage} style={{ transform: `rotate(${rotation}deg)` }} className="max-w-full max-h-full object-contain transition-transform" />
        </div>
      )}

      <HistoryPanel isOpen={showHistory} onClose={() => setShowHistory(false)} history={history} onRestore={(r) => { setQuestions(r.questions); setStatus(ProcessingStatus.SUCCESS); setShowHistory(false); }} onClear={() => setHistory([])} onDelete={(id) => setHistory(h => h.filter(i => i.id !== id))} />

      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold font-mono shadow-md">TeX</div>
          <h1 className="text-lg font-bold tracking-tight">试卷 AI 识别助手</h1>
          <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-[10px] text-blue-600 font-bold rounded uppercase tracking-wider border border-blue-100">v1.1.0</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden xl:flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50">
            <select
              value={authRole}
              onChange={(e) => setAuthRole(e.target.value as DevAuthRole)}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
              title="开发角色（无 Bearer token 时生效）"
            >
              <option value="admin">admin</option>
              <option value="teacher">teacher</option>
              <option value="viewer">viewer</option>
            </select>
            <input
              value={authBearerToken}
              onChange={(e) => setAuthBearerToken(e.target.value)}
              placeholder="Bearer token（可选）"
              className="w-48 text-xs border border-gray-200 rounded px-2 py-1 bg-white"
              title="填入后优先使用 Bearer 鉴权"
            />
            {authBearerToken && (
              <button
                onClick={clearBearerToken}
                className="text-xs px-2 py-1 border border-gray-200 rounded bg-white hover:bg-gray-100"
                title="清除 Bearer token"
              >
                清除
              </button>
            )}
          </div>
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveView('extract')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeView === 'extract' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
            >
              识别与编辑
            </button>
            <button
              onClick={() => setActiveView('compose')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeView === 'compose' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
            >
              题库组卷
            </button>
          </div>
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100"
            title="登录、获取token、校验当前身份"
          >
            <span>登录/鉴权</span>
          </button>
          <button
            onClick={clearBearerToken}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-100"
            title="清空本地 Bearer token"
          >
            <span>清空Token</span>
          </button>
          {currentAuthSummary && (
            <span className="hidden xl:inline text-xs text-gray-500 max-w-56 truncate" title={currentAuthSummary}>
              {currentAuthSummary}
            </span>
          )}
          <button onClick={() => setShowChangelog(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group">
            <Info size={18} className="group-hover:text-blue-500 transition-colors" /><span>更新说明</span>
          </button>
          <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors border border-blue-100">
            <Import size={18} /><span>导入代码</span>
          </button>
          <button onClick={() => setShowHistory(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
            <HistoryIcon size={18} /><span>历史</span>
          </button>
        </div>
      </header>

      {activeView === 'extract' ? (
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden lg:h-[calc(100vh-7.5rem)]">
        {/* Left Column */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar lg:h-full">
          <div onDrop={(e) => { e.preventDefault(); processFiles(Array.from(e.dataTransfer.files)); }} onDragOver={(e) => e.preventDefault()} className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-white hover:border-blue-500 transition-all text-center group shadow-sm">
            <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => e.target.files && processFiles(Array.from(e.target.files))} className="hidden" id="f-up" />
            <label htmlFor="f-up" className="cursor-pointer flex flex-col items-center gap-2">
              <UploadCloud size={32} className="text-blue-500 group-hover:scale-110 transition-transform" />
              <span className="font-medium text-sm">上传图片或粘贴内容</span>
              <p className="text-[10px] text-gray-400 font-mono">XeLaTeX 环境已配置</p>
            </label>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => {
            const { active, over } = e;
            if (over && active.id !== over.id) {
              setFiles((items) => {
                const oldIdx = items.findIndex(x => x.id === active.id);
                const newIdx = items.findIndex(x => x.id === over.id);
                return arrayMove(items, oldIdx, newIdx);
              });
            }
          }}>
            <SortableContext items={files.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {files.map((f, i) => <SortableFileItem key={f.id} id={f.id} fileData={f} index={i} onRemove={(id) => setFiles(fs => fs.filter(x => x.id !== id))} onPreview={setPreviewImage} />)}
              </div>
            </SortableContext>
          </DndContext>

          {/* Style Settings Panel */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 px-1">
              <Settings2 size={12}/> 试卷样式与内容开关
            </h4>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 flex items-center gap-1 ml-1 mb-1">
                  <TypeIcon size={12} /> 页眉标题设置
                </label>
                <input 
                  type="text"
                  placeholder="留空自动适配来源"
                  value={style.headerTitle}
                  onChange={(e) => setStyle({...style, headerTitle: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-300"
                />
              </div>

              <div className="grid grid-cols-1 gap-1.5 border-t border-gray-100 pt-3">
                <label className="flex items-center justify-between group cursor-pointer p-1.5 hover:bg-gray-50 rounded-lg transition-colors">
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">显示页眉页脚</span>
                  <input type="checkbox" checked={style.showHeaderFooter} onChange={(e) => setStyle({...style, showHeaderFooter: e.target.checked})} className="w-4 h-4 rounded text-blue-600 border-gray-300" />
                </label>
                <label className="flex items-center justify-between group cursor-pointer p-1.5 hover:bg-gray-50 rounded-lg transition-colors">
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">显示题目考察点</span>
                  <input type="checkbox" checked={style.showKnowledgePoint} onChange={(e) => setStyle({...style, showKnowledgePoint: e.target.checked})} className="w-4 h-4 rounded text-blue-600 border-gray-300" />
                </label>
                <label className="flex items-center justify-between group cursor-pointer p-1.5 hover:bg-gray-50 rounded-lg transition-colors">
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">显示题目来源</span>
                  <input type="checkbox" checked={style.showSource} onChange={(e) => setStyle({...style, showSource: e.target.checked})} className="w-4 h-4 rounded text-blue-600 border-gray-300" />
                </label>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-gray-500">题型间距</span>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>选择/填空间距</span>
                      <span className="font-mono text-blue-600">{style.choiceGap}</span>
                    </div>
                    <input type="range" min="0" max="10" step="0.5" value={parseFloat(style.choiceGap)} onChange={(e) => setStyle({...style, choiceGap: e.target.value + 'cm'})} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>解答题间距</span>
                      <span className="font-mono text-blue-600">{style.solutionGap}</span>
                    </div>
                    <input type="range" min="0" max="20" step="1" value={parseFloat(style.solutionGap)} onChange={(e) => setStyle({...style, solutionGap: e.target.value + 'cm'})} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <div className="flex justify-between text-[11px] font-bold text-gray-500">
                  <span>行间距</span>
                  <span className="font-mono text-blue-600">{style.lineSpacing}x</span>
                </div>
                <input type="range" min="1" max="2.5" step="0.1" value={style.lineSpacing} onChange={(e) => setStyle({...style, lineSpacing: parseFloat(e.target.value)})} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
              </div>

              <div className="space-y-1 pt-3 border-t border-gray-100">
                <label className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                  <input type="checkbox" checked={appendMode} onChange={() => setAppendMode(!appendMode)} className="w-4 h-4 rounded text-blue-600 border-gray-300" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">追加识别模式</span>
                </label>
                <label className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                  <input type="checkbox" checked={sortByType} onChange={() => setSortByType(!sortByType)} className="w-4 h-4 rounded text-blue-600 border-gray-300" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">按题型智能归类</span>
                </label>
                <label className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                  <input type="checkbox" checked={keepOriginalNumbers} onChange={() => setKeepOriginalNumbers(!keepOriginalNumbers)} className="w-4 h-4 rounded text-blue-600 border-gray-300" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">保留原始题号</span>
                </label>
              </div>
            </div>
            
            <button 
              onClick={handleGenerate} 
              disabled={files.length === 0 || status === ProcessingStatus.PROCESSING} 
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                status === ProcessingStatus.PROCESSING 
                  ? 'bg-gray-100 text-gray-400' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-blue-500/20'
              }`}
            >
              {status === ProcessingStatus.PROCESSING ? <RefreshCw className="animate-spin" size={20} /> : <Wand2 size={20}/>} 
              {status === ProcessingStatus.PROCESSING ? "正在智能处理..." : "开始提取题目"}
            </button>
          </div>
          
          {/* Quick Version Module (Always visible info) */}
          <div className="p-4 bg-yellow-50/50 border border-yellow-100 rounded-xl flex items-start gap-3">
             <Sparkles size={18} className="text-yellow-600 shrink-0 mt-0.5" />
             <div className="space-y-1">
                <p className="text-xs font-bold text-yellow-800">最新版本 v1.1.0 已上线</p>
                <p className="text-[10px] text-yellow-700/80 leading-relaxed">新增页眉智能适配来源，支持知识点/来源开关，恢复原题号显示。</p>
             </div>
          </div>
        </div>

        {/* Middle Column */}
        <div className="lg:col-span-5 lg:h-full min-h-[520px]">
          {questions.length > 0 ? (
            <QuestionTable questions={questions} onUpdate={handleUpdateQuestion} onBatchUpdate={handleBatchUpdate} />
          ) : (
            <div className="h-full border border-gray-200 border-dashed rounded-xl bg-gray-50 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                 <Layout size={40} className="opacity-10" />
              </div>
              <p className="font-bold text-gray-500">暂无题目数据</p>
              <p className="text-xs mt-2 text-gray-400 max-w-[240px]">上传试卷图片或直接导入 LaTeX 代码，系统将自动分析并展示在这里。</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                 <span className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] text-gray-500 font-mono">XeLaTeX Support</span>
                 <span className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] text-gray-500 font-mono">Anti-pagebreak</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 lg:h-full min-h-[520px]">
          {generatedLatex ? (
            <LatexOutput latexCode={generatedLatex} />
          ) : (
            <div className="h-full bg-white border border-gray-200 rounded-xl flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 opacity-10">
                 <FileText size={64} />
                 <p className="font-mono text-xs">TEX PREVIEW</p>
              </div>
            </div>
          )}
        </div>
      </main>
      ) : (
      <main className="flex-1 max-w-[1280px] w-full mx-auto p-6 overflow-auto">
        <ComposerPage onAuthRequired={() => {
          setShowAuthModal(true);
          setAuthMessage('检测到当前操作需要登录或权限不足，请先完成登录。');
        }} />
      </main>
      )}

      {errorMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50">
          <AlertCircle size={20} /> 
          <span className="text-sm font-medium">{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="p-1 hover:bg-white/20 rounded-full"><X size={18}/></button>
        </div>
      )}
    </div>
  );
}
