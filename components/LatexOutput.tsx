import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Download, ExternalLink } from 'lucide-react';

interface Props {
  latexCode: string;
}

interface MathSegment {
  content: string;
  displayMode: boolean;
}

declare global {
  interface Window {
    katex?: {
      renderToString: (expr: string, options: { displayMode: boolean; throwOnError: boolean; strict: string }) => string;
    };
  }
}

const KATEX_CSS_ID = 'katex-css-cdn';
const KATEX_SCRIPT_ID = 'katex-js-cdn';

function extractMathSegments(latexCode: string): MathSegment[] {
  const ranges: Array<{ start: number; end: number; content: string; displayMode: boolean }> = [];

  const collect = (regex: RegExp, displayMode: boolean, extractor: (match: RegExpExecArray) => string) => {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null = regex.exec(latexCode);
    while (match) {
      const content = extractor(match).trim();
      if (content) {
        ranges.push({
          start: match.index,
          end: match.index + match[0].length,
          content,
          displayMode,
        });
      }
      match = regex.exec(latexCode);
    }
  };

  collect(/\$\$([\s\S]+?)\$\$/g, true, (m) => m[1]);
  collect(/\\\[([\s\S]+?)\\\]/g, true, (m) => m[1]);
  collect(/\\\(([\s\S]+?)\\\)/g, false, (m) => m[1]);

  const inlinePattern = /(^|[^\\])\$((?:\\.|[^$\n])+?)\$/gm;
  inlinePattern.lastIndex = 0;
  let inlineMatch: RegExpExecArray | null = inlinePattern.exec(latexCode);
  while (inlineMatch) {
    const prefix = inlineMatch[1] ?? '';
    const raw = inlineMatch[2] ?? '';
    const content = raw.trim();
    if (content) {
      const start = inlineMatch.index + prefix.length;
      const end = start + raw.length + 2;
      ranges.push({ start, end, content, displayMode: false });
    }
    inlineMatch = inlinePattern.exec(latexCode);
  }

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: typeof ranges = [];
  for (const item of ranges) {
    const last = merged[merged.length - 1];
    if (last && item.start < last.end) continue;
    merged.push(item);
  }

  return merged.map((x) => ({ content: x.content, displayMode: x.displayMode }));
}

export const LatexOutput: React.FC<Props> = ({ latexCode }) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [katexReady, setKatexReady] = useState<boolean>(Boolean(window.katex));

  useEffect(() => {
    if (!document.getElementById(KATEX_CSS_ID)) {
      const link = document.createElement('link');
      link.id = KATEX_CSS_ID;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css';
      document.head.appendChild(link);
    }

    if (window.katex) {
      setKatexReady(true);
      return;
    }

    const existing = document.getElementById(KATEX_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => setKatexReady(Boolean(window.katex)));
      return;
    }

    const script = document.createElement('script');
    script.id = KATEX_SCRIPT_ID;
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.js';
    script.async = true;
    script.onload = () => setKatexReady(Boolean(window.katex));
    document.body.appendChild(script);
  }, []);

  const renderedMath = useMemo(() => {
    if (!katexReady || !window.katex) return [];
    const segments = extractMathSegments(latexCode);
    return segments.map((segment) => {
      try {
        const html = window.katex!.renderToString(segment.content, {
          displayMode: segment.displayMode,
          throwOnError: true,
          strict: 'ignore',
        });
        return { ...segment, html, error: null as string | null };
      } catch (error: any) {
        return { ...segment, html: '', error: error?.message || 'KaTeX render failed' };
      }
    });
  }, [katexReady, latexCode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(latexCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([latexCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exam_paper.tex';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenOverleaf = () => {
    // Overleaf API form submission
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://www.overleaf.com/docs';
    form.target = '_blank';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'snip';
    input.value = latexCode;
    form.appendChild(input);

    const nameInput = document.createElement('input');
    nameInput.type = 'hidden';
    nameInput.name = 'snip_name';
    nameInput.value = 'exam_paper.tex';
    form.appendChild(nameInput);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-700">生成的 LaTeX 代码</h3>
        <div className="flex gap-2 items-center">
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 text-sm ${
                viewMode === 'preview' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              预览
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-3 py-1.5 text-sm ${
                viewMode === 'code' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              代码
            </button>
          </div>
          <button
            onClick={handleOpenOverleaf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#47a141] rounded-md hover:bg-[#3d8b38] transition-colors"
          >
            <ExternalLink size={14} />
            Overleaf
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Download size={14} />
            .tex
          </button>
          <button
            onClick={handleCopy}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-all duration-200
              ${copied 
                ? 'bg-green-50 text-green-700 border-green-200' 
                : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              }
            `}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '复制' : '复制'}
          </button>
        </div>
      </div>
      {viewMode === 'code' ? (
        <div className="relative flex-1 bg-[#282c34] overflow-auto">
          <pre className="p-4 text-sm font-mono text-gray-300 leading-relaxed whitespace-pre-wrap break-all">
            {latexCode}
          </pre>
        </div>
      ) : (
        <div className="relative flex-1 bg-white overflow-auto p-4 space-y-3">
          {!katexReady && (
            <div className="text-sm text-gray-500 border border-gray-200 rounded-lg p-3">
              正在加载 KaTeX 渲染引擎...
            </div>
          )}
          {katexReady && renderedMath.length === 0 ? (
            <div className="h-full border border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm">
              未检测到可预览的数学公式（可切换到“代码”查看全文）
            </div>
          ) : katexReady ? (
            renderedMath.map((item, index) => (
              <div key={`${index}-${item.content.slice(0, 20)}`} className="border border-gray-200 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-2">公式 {index + 1}</div>
                {item.error ? (
                  <div className="space-y-2">
                    <div className="text-sm text-red-600">渲染失败：{item.error}</div>
                    <pre className="text-xs bg-red-50 text-red-800 p-2 rounded whitespace-pre-wrap break-all">
                      {item.content}
                    </pre>
                  </div>
                ) : (
                  <div className={item.displayMode ? 'overflow-x-auto py-1' : 'overflow-x-auto py-1'}>
                    <div dangerouslySetInnerHTML={{ __html: item.html }} />
                  </div>
                )}
              </div>
            ))
          ) : null
          }
        </div>
      )}
    </div>
  );
};
