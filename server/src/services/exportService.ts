import { Document, Packer, Paragraph, TextRun } from 'docx';

type ExportQuestion = {
  number: string;
  content: string;
  type: string;
  knowledgePoints: string[];
  source?: string | null;
};

export function buildLatex(title: string, questions: ExportQuestion[]) {
  const preamble = `\\documentclass[11pt,a4paper]{article}
\\usepackage[UTF8]{ctex}
\\usepackage{amsmath,amssymb}
\\usepackage{enumitem}
\\begin{document}
\\section*{${title}}
\\begin{enumerate}[label=\\arabic*.]
`;

  const body = questions
    .map((q, idx) => {
      const meta = [q.knowledgePoints.join('/'), q.source].filter(Boolean).join(', ');
      return `\\item[${q.number || idx + 1}.] (${meta}) ${q.content}`;
    })
    .join('\n\n');

  const end = '\n\\end{enumerate}\n\\end{document}\n';
  return preamble + body + end;
}

export async function buildWord(title: string, questions: ExportQuestion[]) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 32 })],
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
