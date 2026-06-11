#!/bin/bash
# setup-local.sh — one-time setup for FREE local image generation on Apple Silicon.
#
# Creates a venv at scripts/imagegen/.venv and installs mflux (FLUX.1 on Apple MLX),
# then verifies mflux imports. Idempotent: safe to re-run; skips work already done.
#
# After this completes, local image generation works with NO API keys and NO
# per-image cost via:
#   bash scripts/imagegen/local-image.sh "PROMPT" out.png
#   IMAGE_PROVIDER=local bash scripts/imagegen/generate-image.sh "PROMPT" out.png
#
# The FLUX.1-schnell weights (~several GB) download on the FIRST generation, not here.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$HERE/.venv"
PY="$VENV/bin/python"

# Require ~20GB free for the model weights (downloaded on first generation).
AVAIL_KB=$(df -k "$HERE" | awk 'NR==2{print $4}')
MIN_KB=$((20 * 1024 * 1024))
if [ "${AVAIL_KB:-0}" -lt "$MIN_KB" ]; then
  echo "ERROR: less than ~20GB free where $HERE lives; FLUX-schnell weights won't fit." >&2
  echo "Free up space and re-run, or use IMAGE_PROVIDER=cloudflare instead." >&2
  exit 1
fi

if [ ! -x "$PY" ]; then
  echo "[setup-local] creating venv at $VENV"
  python3 -m venv "$VENV"
fi

echo "[setup-local] upgrading pip"
"$PY" -m pip install --upgrade pip --quiet

if "$PY" -c "import mflux" 2>/dev/null; then
  echo "[setup-local] mflux already installed"
else
  echo "[setup-local] installing mflux (FLUX on Apple MLX) — this can take a few minutes"
  "$PY" -m pip install mflux
fi

# Verify the import resolves and an entrypoint we use is importable.
if "$PY" -c "import mflux; print('mflux', getattr(mflux,'__version__','?'))"; then
  echo "[setup-local] OK — local image generation is ready."
  echo "[setup-local] First generation will download FLUX.1-schnell weights (~several GB)."
  exit 0
else
  echo "ERROR: mflux installed but failed to import. See output above." >&2
  exit 2
fi
