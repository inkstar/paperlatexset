#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[smoke-export-format] verify latex export template and spacing rules"

npx tsx -e "
import { buildLatex } from './server/src/services/exportService.ts';

const latex = buildLatex('', [
  { number: '1', type: '选择题', content: 'A', knowledgePoints: ['K1'], source: 'S1' },
  { number: '2', type: '填空题', content: 'B', knowledgePoints: ['K2'], source: 'S2' },
  { number: '3', type: '解答题', content: 'C', knowledgePoints: ['K3'], source: 'S3' },
]);

function mustContain(fragment: string, label: string) {
  if (!latex.includes(fragment)) {
    console.error('[smoke-export-format] FAIL: missing ' + label + ': ' + fragment);
    process.exit(1);
  }
}

mustContain('\\\\newcommand{\\\\choicegap}{2cm}', 'choicegap');
mustContain('\\\\newcommand{\\\\solutiongap}{6cm}', 'solutiongap');
mustContain('\\\\pagestyle{fancy}', 'fancy pagestyle');
mustContain('\\\\fancyhead[C]{', 'fancy header');
mustContain('\\\\fancyfoot[C]{第 \\\\thepage 页}', 'fancy footer');
mustContain('\\\\section*{', 'section title');
mustContain('\\\\vspace{\\\\choicegap}', 'choice/blank spacing');
mustContain('\\\\vspace{\\\\solutiongap}', 'solution spacing');
mustContain('年', 'default date title');

console.log('[smoke-export-format] PASS');
"
