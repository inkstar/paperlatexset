import { Document, Packer, Paragraph, TextRun } from 'docx';
import { PREAMBLE_TEMPLATE } from '../../../constants';

type ExportQuestion = {
  number: string;
  content: string;
  type: string;
  knowledgePoints: string[];
  source?: string | null;
};

export type ExportLatexOptions = {
  headerTitle?: string;
  choiceGap?: string;
  solutionGap?: string;
  lineSpacing?: number;
};

function resolvePaperTitle(title: string): string {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value || '';
  const month = parts.find((p) => p.type === 'month')?.value || '';
  const day = parts.find((p) => p.type === 'day')?.value || '';
  const defaultTitle = `${year}年${month}月${day}日试卷`;
  return String(title || defaultTitle).replace(/[{}]/g, '');
}

function buildFancyHeaderConfig(title: string): string {
  const safeTitle = resolvePaperTitle(title);
  return [
    '\\pagestyle{fancy}',
    '\\fancyhf{}',
    `\\fancyhead[C]{${safeTitle}}`,
    '\\fancyfoot[C]{第 \\thepage 页}',
  ].join('\n');
}

function spacingByType(type: string): '\\choicegap' | '\\solutiongap' {
  const normalized = String(type || '').trim();
  return normalized === '解答题' ? '\\solutiongap' : '\\choicegap';
}

export function buildLatex(title: string, questions: ExportQuestion[], options: ExportLatexOptions = {}) {
  const safeTitle = resolvePaperTitle(options.headerTitle || title);
  const choiceGap = options.choiceGap || '2cm';
  const solutionGap = options.solutionGap || '6cm';
  const lineSpacing = typeof options.lineSpacing === 'number' ? options.lineSpacing : 1.15;
  const preamble = PREAMBLE_TEMPLATE
    .replace('__CHOICE_GAP__', choiceGap)
    .replace('__SOLUTION_GAP__', solutionGap)
    .replace('__LINE_SPACING__', String(lineSpacing))
    .replace('__FANCY_HDR_CONFIG__', buildFancyHeaderConfig(safeTitle))
    .concat('\n\\begin{document}\n')
    .concat(`\\section*{${safeTitle}}\n`)
    .concat('\\begin{enumerate}[label=\\arabic*.]\n');

  const body = questions
    .map((q, idx) => {
      const meta = [q.knowledgePoints.join('/'), q.source].filter(Boolean).join(', ');
      const gap = spacingByType(q.type);
      return `\\item[${q.number || idx + 1}.] \\begin{minipage}[t]{\\linewidth} (${meta}) \\\\ \n${q.content}\n\\vspace{${gap}} \\end{minipage}`;
    })
    .join('\n\n');

  const end = '\n\\end{enumerate}\n\\end{document}\n';
  return preamble + body + end;
}

export async function buildWord(title: string, questions: ExportQuestion[]) {
  const safeTitle = resolvePaperTitle(title);
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: safeTitle, bold: true, size: 32 })],
          }),
          ...questions.flatMap((q, idx) => {
            const meta = [q.knowledgePoints.join('/'), q.source].filter(Boolean).join(' | ');
            return [
              new Paragraph({
                spacing: { before: 240 },
                children: [new TextRun({ text: `${idx + 1}. ${q.content}` })],
              }),
              new Paragraph({
                children: [new TextRun({ text: `题号: ${q.number}    ${meta}`, italics: true })],
              }),
            ];
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
