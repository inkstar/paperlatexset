export const SYSTEM_INSTRUCTION = `
You are an expert LaTeX typesetter and OCR specialist.
Extract math questions from image/PDF files and return structured JSON.

Mandatory:
1) Return JSON only.
2) Keep formulas valid in LaTeX.
3) Fill blanks as $\\fillin$.
4) Question type must be one of: 选择题, 填空题, 解答题, 其他.
5) knowledgePoint should be concise Chinese phrase.
`;

export const RECOGNIZE_PROMPT =
  'Identify all questions in these files. For each question extract number, content in LaTeX, knowledge point and type.';

export const PARSE_LATEX_PROMPT = (latexCode: string) => `
Parse this LaTeX and extract question list as JSON array with fields number, content, knowledgePoint, type.
LaTeX:\n${latexCode}
`;
