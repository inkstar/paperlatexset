import React, { useEffect, useMemo, useState } from 'react';

interface MathTextProps {
  text: string;
  className?: string;
}

type MathRange = {
  start: number;
  end: number;
  content: string;
  displayMode: boolean;
};

type Segment =
  | { type: 'text'; content: string }
  | { type: 'math'; content: string; displayMode: boolean };

declare global {
  interface Window {
    katex?: {
      renderToString: (
        expr: string,
        options: { displayMode: boolean; throwOnError: boolean; strict: string },
      ) => string;
    };
  }
}

const KATEX_CSS_ID = 'katex-css-cdn';
const KATEX_SCRIPT_ID = 'katex-js-cdn';

function extractRanges(input: string): MathRange[] {
  const ranges: MathRange[] = [];

  const collect = (regex: RegExp, displayMode: boolean, extractor: (m: RegExpExecArray) => string) => {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null = regex.exec(input);
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
      match = regex.exec(input);
    }
  };

  collect(/\$\$([\s\S]+?)\$\$/g, true, (m) => m[1]);
  collect(/\\\[([\s\S]+?)\\\]/g, true, (m) => m[1]);
  collect(/\\\(([\s\S]+?)\\\)/g, false, (m) => m[1]);

  const inlinePattern = /(^|[^\\])\$((?:\\.|[^$\n])+?)\$/gm;
  inlinePattern.lastIndex = 0;
  let inlineMatch: RegExpExecArray | null = inlinePattern.exec(input);
  while (inlineMatch) {
    const prefix = inlineMatch[1] ?? '';
    const raw = inlineMatch[2] ?? '';
    const content = raw.trim();
    if (content) {
      const start = inlineMatch.index + prefix.length;
      const end = start + raw.length + 2;
      ranges.push({ start, end, content, displayMode: false });
    }
    inlineMatch = inlinePattern.exec(input);
  }

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const deduped: MathRange[] = [];
  for (const range of ranges) {
    const last = deduped[deduped.length - 1];
    if (last && range.start < last.end) continue;
    deduped.push(range);
  }
  return deduped;
}

function splitSegments(input: string): Segment[] {
  const ranges = extractRanges(input);
  if (ranges.length === 0) return [{ type: 'text', content: input }];

  const segments: Segment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ type: 'text', content: input.slice(cursor, range.start) });
    }
    segments.push({ type: 'math', content: range.content, displayMode: range.displayMode });
    cursor = range.end;
  }
  if (cursor < input.length) {
    segments.push({ type: 'text', content: input.slice(cursor) });
  }
  return segments;
}

export const MathText: React.FC<MathTextProps> = ({ text, className }) => {
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
      const onLoad = () => setKatexReady(Boolean(window.katex));
      existing.addEventListener('load', onLoad);
      return () => existing.removeEventListener('load', onLoad);
    }

    const script = document.createElement('script');
    script.id = KATEX_SCRIPT_ID;
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.js';
    script.async = true;
    script.onload = () => setKatexReady(Boolean(window.katex));
    document.body.appendChild(script);
  }, []);

  const segments = useMemo(() => splitSegments(text || ''), [text]);

  if (!katexReady || !window.katex) {
    return <div className={className}>{text}</div>;
  }

  return (
    <div className={className}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return (
            <span key={`txt-${idx}`} className="whitespace-pre-wrap">
              {seg.content}
            </span>
          );
        }
        try {
          const html = window.katex!.renderToString(seg.content, {
            displayMode: seg.displayMode,
            throwOnError: false,
            strict: 'ignore',
          });
          return <span key={`math-${idx}`} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return (
            <span key={`raw-${idx}`} className="text-red-600">
              {seg.content}
            </span>
          );
        }
      })}
    </div>
  );
};
