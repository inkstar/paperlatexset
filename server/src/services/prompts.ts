import {
  buildUnifiedParseLatexPrompt,
  UNIFIED_RECOGNIZE_PROMPT,
  UNIFIED_SYSTEM_INSTRUCTION,
} from '../../../shared/recognitionConfig';

export const SYSTEM_INSTRUCTION = UNIFIED_SYSTEM_INSTRUCTION;
export const RECOGNIZE_PROMPT = UNIFIED_RECOGNIZE_PROMPT;
export const PARSE_LATEX_PROMPT = (latexCode: string): string => buildUnifiedParseLatexPrompt(latexCode);
