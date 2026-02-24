#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[smoke-export-format] verify latex export template and spacing rules (static source checks)"

TARGET="server/src/services/exportService.ts"

must_have() {
  local pattern="$1"
  local label="$2"
  if ! rg -F -q -- "$pattern" "$TARGET"; then
    echo "[smoke-export-format] FAIL: missing ${label}"
    exit 1
  fi
}

must_have ".replace('__CHOICE_GAP__', '2cm')" "choice gap 2cm"
must_have ".replace('__SOLUTION_GAP__', '6cm')" "solution gap 6cm"
must_have "\\pagestyle{fancy}" "fancy pagestyle"
must_have "\\fancyhead[C]{" "fancy header"
must_have "\\fancyfoot[C]{第 \\\\thepage 页}" "fancy footer"
must_have "function resolvePaperTitle" "default date title resolver"
must_have "return normalized === '解答题'" "type-based spacing"
must_have "\\solutiongap" "solution gap branch"
must_have "\\choicegap" "choice gap branch"
must_have "\\vspace{\${gap}}" "runtime spacing render"

echo "[smoke-export-format] PASS"

if [[ "${SMOKE_EXPORT_RUNTIME:-0}" == "1" ]]; then
  echo "[smoke-export-format] runtime check enabled"
  npx tsx -e "import { buildLatex } from './server/src/services/exportService.ts'; console.log(buildLatex('', [{number:'1',type:'解答题',content:'A',knowledgePoints:['K'],source:'S'}]).slice(0, 240));"
fi
