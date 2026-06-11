#!/bin/bash
# generate-image.sh — generate an image with the Gemini API (REST, no SDK).
#
# Usage:
#   generate-image.sh "PROMPT" OUTFILE.png
#
# Env:
#   GEMINI_API_KEY        required (GOOGLE_API_KEY accepted as fallback)
#   GEMINI_IMAGE_MODEL    optional, default: gemini-2.5-flash-image
#
# Notes for fleet agents:
# - The gemini CLI on this host authenticates via OAuth (oauth-personal) and
#   exposes NO image-generation command — image gen requires an API key.
# - Free keys: https://aistudio.google.com (free tier covers gemini-2.5-flash-image).
set -euo pipefail

PROMPT="${1:-}"
OUTFILE="${2:-}"
MODEL="${GEMINI_IMAGE_MODEL:-gemini-2.5-flash-image}"
API_KEY="${GEMINI_API_KEY:-${GOOGLE_API_KEY:-}}"

if [ -z "$PROMPT" ] || [ -z "$OUTFILE" ]; then
  echo "usage: generate-image.sh \"PROMPT\" OUTFILE.png" >&2
  exit 2
fi

if [ -z "$API_KEY" ]; then
  cat >&2 <<'MSG'
ERROR: set GEMINI_API_KEY (free at aistudio.google.com).
The local gemini CLI uses OAuth and does not support image generation;
image generation needs a Gemini API key (free tier is sufficient).
Then re-run: GEMINI_API_KEY=... generate-image.sh "PROMPT" OUTFILE.png
MSG
  exit 3
fi

RESP=$(mktemp)
trap 'rm -f "$RESP"' EXIT

HTTP_CODE=$(curl -sS -o "$RESP" -w '%{http_code}' \
  "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent" \
  -H "x-goog-api-key: ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d "$(python3 - "$PROMPT" <<'PY'
import json, sys
print(json.dumps({
    "contents": [{"parts": [{"text": sys.argv[1]}]}],
    "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]},
}))
PY
)")

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: Gemini API returned HTTP $HTTP_CODE for model $MODEL" >&2
  python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d.get('error',{}).get('message','(no error message)'),file=sys.stderr)" "$RESP" 2>/dev/null || head -c 400 "$RESP" >&2
  exit 4
fi

python3 - "$RESP" "$OUTFILE" <<'PY'
import base64, json, sys
resp_path, outfile = sys.argv[1], sys.argv[2]
with open(resp_path) as f:
    data = json.load(f)
for cand in data.get("candidates", []):
    for part in cand.get("content", {}).get("parts", []):
        blob = part.get("inlineData") or part.get("inline_data")
        if blob and blob.get("data"):
            with open(outfile, "wb") as out:
                out.write(base64.b64decode(blob["data"]))
            print(f"wrote {outfile} ({blob.get('mimeType') or blob.get('mime_type')})")
            sys.exit(0)
print("ERROR: response contained no image data (model may have refused; try rephrasing the prompt)", file=sys.stderr)
sys.exit(5)
PY
