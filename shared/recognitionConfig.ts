const LATEX_SAFETY_APPENDIX = `
STRICT XELATEX SAFETY APPENDIX (must preserve original meaning while auto-fixing syntax):

A. Math mode safety
1) Never nest $...$.
2) All $ must be paired.
3) Never output unclosed math mode.
4) Do not wrap full Chinese sentences in math mode.
5) Chinese punctuation should be outside math mode.

B. Function/expression safety
6) Function names must stay continuous: f(x), g(x). Never output f\\\\(x) or g\\\\ (x).
7) Never inject bare \\\\ into inline math expression.
8) Multi-line math must use legal environments: align/aligned/cases.

C. Line-break safety
9) Only legal line break command \\\\ is allowed.
10) Do not output illegal combinations like \\\\\\, \\\\$ or malformed escaped dollars.
11) Never break math structure with line breaks.

D. Piecewise functions
12) Piecewise function must stay as one full math structure.
13) Prefer: \\[ f(x)=\\begin{cases} ... \\end{cases} \\]

E. Symbol legality
14) Use standard commands only: \\ne, \\le, \\ge, \\in, \\mathbb{R}, etc.
15) Never output illegal control sequences.

F. Mandatory self-check before final JSON
- nested $ ?
- unpaired $ ?
- function names containing broken \\\\ ?
- illegal \\\\\\ or malformed escaped dollars ?
- math environments broken ?
- full Chinese sentence wrapped by $...$ ?
If any issue exists, auto-fix first, then output final JSON only.
`;

export const UNIFIED_SYSTEM_INSTRUCTION = `
You are an expert LaTeX typesetter and OCR specialist.
Extract questions from images/PDFs and return them as structured JSON.

MANDATORY LaTeX FORMATTING RULES:
1. Return JSON only.
2. Keep formulas valid in LaTeX.
3. Fill-in-the-blanks use "$\\fillin$".
4. Question type must be one of: 选择题, 填空题, 解答题, 其他.
5. knowledgePoint should be concise Chinese phrase.
6. Use "\\\\" for explicit line breaks inside LaTeX content when needed.
7. Use \\mathbin{/\\!/} for parallel.
8. Use \\overrightarrow{AB} for vectors, \\mathbf for bold math, and \\varphi for phi.
9. Convert circled numbers like ① ② to \\textcircled{\\scriptsize{1}} \\textcircled{\\scriptsize{2}}.
10. Never output illegal prefixes like /b or \\b.
11. Fractions must use \\frac{...}{...}.
12. For solution sub-questions (e.g. (1)(2), ①②), add explicit line breaks.

${LATEX_SAFETY_APPENDIX}
`;

export const UNIFIED_RECOGNIZE_PROMPT =
  `Identify all questions in these files. For each question extract number, content in LaTeX, knowledgePoint and type. Do not output /b or \\b. Fractions must use \\frac.
Apply strict XeLaTeX safety self-check and auto-fix before final JSON output.
`;

export const buildUnifiedParseLatexPrompt = (latexCode: string): string => `
Parse this LaTeX and extract question list as JSON array with fields number, content, knowledgePoint, type.
Apply strict XeLaTeX safety self-check and auto-fix before final JSON output.
LaTeX:\n${latexCode}
`;

export const UNIFIED_QUESTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          number: { type: 'STRING', description: 'Question number seen in image' },
          content: { type: 'STRING', description: 'LaTeX content of the question' },
          knowledgePoint: { type: 'STRING', description: 'Predicted math knowledge point' },
          type: { type: 'STRING', description: 'Type: 选择题, 填空题, 解答题, or 其他' },
        },
        required: ['number', 'content', 'knowledgePoint', 'type'],
      },
    },
  },
  required: ['questions'],
} as const;
