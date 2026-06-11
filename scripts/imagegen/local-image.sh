#!/bin/bash
# local-image.sh — FREE local image generation on Apple Silicon via mflux (FLUX.1 on MLX).
#
# No API key, no per-image cost. Runs the FLUX.1-schnell model entirely on-device.
#
# Usage:
#   local-image.sh "PROMPT" OUTFILE.png [--steps N] [--size WxH] [--seed N] [--model NAME]
#
# Defaults: schnell, 2 steps, 1024x1024. schnell is tuned for 2-4 steps.
# Overridable via env: MLX_STEPS, MLX_SIZE, MLX_SEED, MLX_MODEL.
#
# Exit codes:
#   0  success (image written)
#   2  usage error (missing prompt/outfile)
#   3  local model not set up (run setup-local.sh once)
#   4  generation failed / no image written
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$HERE/.venv"
PY="$VENV/bin/python"
GEN="$VENV/bin/mflux-generate"

PROMPT="${1:-}"
OUTFILE="${2:-}"
if [ "$#" -ge 2 ]; then shift 2; else set --; fi

STEPS="${MLX_STEPS:-2}"
SIZE="${MLX_SIZE:-1024x1024}"
SEED="${MLX_SEED:-42}"
MODEL="${MLX_MODEL:-schnell}"
# Default to an UNGATED, Apache-2.0, mflux-format 4-bit FLUX.1-schnell mirror.
# The canonical black-forest-labs/FLUX.1-schnell repo is HF-gated (401 without a
# token); this mirror needs no HF auth, so the local path stays zero-friction.
MODEL_REPO="${MLX_MODEL_REPO:-dhairyashil/FLUX.1-schnell-mflux-4bit}"

while [ $# -gt 0 ]; do
  case "$1" in
    --steps) STEPS="$2"; shift 2;;
    --size)  SIZE="$2";  shift 2;;
    --seed)  SEED="$2";  shift 2;;
    --model) MODEL="$2"; shift 2;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

if [ -z "$PROMPT" ] || [ -z "$OUTFILE" ]; then
  echo "usage: local-image.sh \"PROMPT\" OUTFILE.png [--steps N] [--size WxH] [--seed N]" >&2
  exit 2
fi

if [ ! -x "$GEN" ] || ! "$PY" -c "import mflux" 2>/dev/null; then
  echo "ERROR: local image model not installed." >&2
  echo "Run once:  bash $HERE/setup-local.sh" >&2
  exit 3
fi

WIDTH="${SIZE%x*}"
HEIGHT="${SIZE#*x}"

# mflux-generate writes to --output; it downloads the model on first run.
# HF_HUB_ENABLE_HF_TRANSFER speeds up the one-time weight download.
HF_HUB_ENABLE_HF_TRANSFER=1 "$GEN" \
  --model "$MODEL_REPO" \
  --base-model "$MODEL" \
  --prompt "$PROMPT" \
  --steps "$STEPS" \
  --height "$HEIGHT" \
  --width "$WIDTH" \
  --seed "$SEED" \
  --output "$OUTFILE" \
  || { echo "ERROR: mflux generation failed" >&2; exit 4; }

if [ ! -s "$OUTFILE" ]; then
  echo "ERROR: no image written to $OUTFILE" >&2
  exit 4
fi

echo "wrote $OUTFILE (${WIDTH}x${HEIGHT}, ${STEPS} steps, model=${MODEL})"
