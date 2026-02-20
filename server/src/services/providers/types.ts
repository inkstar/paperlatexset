export type UsageStats = {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

export type RecognizedQuestion = {
  number: string;
  content: string;
  knowledgePoint: string;
  type: string;
};

export type ProviderResult = {
  questions: RecognizedQuestion[];
  usage: UsageStats;
  raw: unknown;
};

export interface RecognitionProvider {
  name: 'gemini' | 'glm';
  model: string;
  recognizeFromFiles(files: { mimeType: string; dataBase64: string }[]): Promise<ProviderResult>;
  parseLatex(latexCode: string): Promise<ProviderResult>;
}
