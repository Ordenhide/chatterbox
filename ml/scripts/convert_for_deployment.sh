#!/bin/bash
# Fuse a trained LoRA adapter into its base model, then produce a quantized
# GGUF ready to run with llama.cpp on the Intel workstation. Two conversion
# paths are tried:
#
#   1. mlx_lm.fuse --export-gguf (fast, no extra deps) -- MLX's own GGUF
#      exporter. Confirmed NOT to support Qwen3's architecture (fails
#      immediately) -- path 2 always runs in practice, kept as an attempt
#      anyway in case a future mlx-lm release adds support.
#   2. Fuse to a plain HF-format model (--save-path, no --export-gguf), then
#      run llama.cpp's own convert_hf_to_gguf.py in the separate
#      ml/.venv-convert environment (kept separate from ml/.venv because its
#      pinned numpy 1.26 / transformers 4.57 would otherwise fight mlx-lm's
#      numpy 2.x / transformers 5.x in the same venv).
#
#      Qwen3's own tokenizer_config.json ships an `extra_special_tokens`
#      field as a list, but this transformers version's tokenizer loader
#      expects a dict there (AttributeError: 'list' object has no attribute
#      'keys'). Patched out below -- these are all vision-model tokens
#      (<|image_pad|>, <|box_start|>, etc.), irrelevant to a text-only
#      summarizer, and removing the field doesn't touch the actual
#      vocabulary (tokenizer.json), just this one metadata convenience list.
#
# The fp16 GGUF is then quantized with llama-quantize (Homebrew llama.cpp)
# down to Q5_K_M. Q4_K_M was tried first and produced a real, repeatable
# quality regression on Qwen3-1.7B specifically -- consistently confused a
# "who's waiting on whose boss" detail across multiple generations that both
# the unquantized MLX model and Q5_K_M got right every time. Q5_K_M costs
# ~200MB more (1.2GB vs 1.0GB for 1.7B) and is a non-issue on a 64GB
# workstation, so it's the default; fp16 is kept too as a quality ceiling to
# compare against if Q5_K_M ever looks off for a different model size.
#
# Usage: scripts/convert_for_deployment.sh <size>
#   where <size> matches the suffix already used under ml/models/ and
#   ml/adapters/, e.g.:  scripts/convert_for_deployment.sh 1.7b
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."  # repo root

SIZE="${1:?Usage: $0 <size>, e.g. '1.7b' or '0.6b' -- must match ml/models/qwen3-<size>-mlx}"

BASE_MODEL="ml/models/qwen3-${SIZE}-mlx"
ADAPTER_PATH="ml/adapters/qwen3-${SIZE}-summarizer"
FUSED_MLX="ml/models/qwen3-${SIZE}-summarizer-fused"
GGUF_DIR="ml/models/gguf"
GGUF_F16="$GGUF_DIR/qwen3-${SIZE}-summarizer-f16.gguf"
GGUF_Q5="$GGUF_DIR/qwen3-${SIZE}-summarizer-q5_k_m.gguf"

for path in "$BASE_MODEL" "$ADAPTER_PATH"; do
  if [ ! -d "$path" ]; then
    echo "error: $path does not exist" >&2
    exit 1
  fi
done

mkdir -p "$GGUF_DIR"

echo "==> 1/3  Attempting mlx_lm's built-in GGUF export"
source ml/.venv/bin/activate
if python -m mlx_lm fuse \
    --model "$BASE_MODEL" \
    --adapter-path "$ADAPTER_PATH" \
    --save-path "$FUSED_MLX" \
    --export-gguf \
    --gguf-path "$(cd "$GGUF_DIR" && pwd)/qwen3-${SIZE}-summarizer-f16.gguf"; then
  echo "    mlx_lm GGUF export succeeded."
else
  echo "    mlx_lm GGUF export failed or unsupported for this architecture -- falling back to llama.cpp's converter."
  echo "==> 1/3  Fusing adapter into plain HF-format weights instead"
  python -m mlx_lm fuse \
    --model "$BASE_MODEL" \
    --adapter-path "$ADAPTER_PATH" \
    --save-path "$FUSED_MLX"

  echo "    Patching tokenizer_config.json's extra_special_tokens (list -> removed; see header comment)"
  python3 -c "
import json
path = '$FUSED_MLX/tokenizer_config.json'
c = json.load(open(path))
c.pop('extra_special_tokens', None)
json.dump(c, open(path, 'w'), indent=2, ensure_ascii=False)
"

  echo "==> 2/3  Converting to GGUF via llama.cpp (separate venv)"
  deactivate
  source ml/.venv-convert/bin/activate
  python ml/llama.cpp-src/convert_hf_to_gguf.py \
    "$FUSED_MLX" \
    --outfile "$GGUF_F16" \
    --outtype f16
  deactivate
fi

echo "==> 3/3  Quantizing to Q5_K_M for deployment"
llama-quantize "$GGUF_F16" "$GGUF_Q5" Q5_K_M

echo ""
echo "Done."
echo "  fp16 (reference): $GGUF_F16"
echo "  Q5_K_M (deploy this): $GGUF_Q5"
echo ""
echo "Run it, e.g.:"
echo "  llama-server -m qwen3-${SIZE}-summarizer-q5_k_m.gguf -c 4096 --port 8080"
echo ""
echo "IMPORTANT: always pass -c explicitly. Qwen3's trained context length is"
echo "40960 -- omitting -c makes llama.cpp default to that, which allocates a"
echo "KV cache sized for it and makes even a 20-token generation take 2+"
echo "minutes. -c 4096 is comfortably more than any chat summarization prompt"
echo "here needs."
