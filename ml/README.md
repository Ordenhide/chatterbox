# ml — the summarizer's own small model

Trains a small model whose only job is the "Catch Up" feature's chat
summarization/Q&A, to eventually replace the Cloudflare Workers AI call in
`functions/index.js`'s `summarizeChat` (currently
`@cf/meta/llama-3.3-70b-instruct-fp8-fast`).

**Qwen3-8B is the chosen small model — `ml/models/gguf/qwen3-8b-summarizer-q5_k_m.gguf`
(5.85GB), 92.0% on the held-out eval — but it is not a quality upgrade
over what's already in production.** Cloudflare's 70B, benchmarked on the
identical 174-example eval once its daily quota reset, scores **98.3%**
(171/174). That's a real 6.3-point gap, not noise — roughly 11 more wrong
answers per 174 questions with the small model. Deploying 8B trades that
accuracy for running locally/cheaply instead of paying for cloud
inference; it is not currently a strictly-better replacement. See "How
good is it, really?" below for the full comparison and what the gap looks
like in practice.

Sizes 0.6B/1.7B/4B/14B were all tried and set aside before landing on 8B:
1.7B 59.8%, 4B 84.5%, 8B 92.0%, 14B 90.8% — a clean climb that broke at
14B (see "14B: QLoRA, and the trend breaks" below), with deployment cost
doubling at every step for no further gain past 8B. None of them closed
meaningfully on 70B's 98.3% either. See "4B: two divergences, then a real
result" and "8B: the fix transfers" for the training-instability fix these
were trained with.

Training happens here, on Apple Silicon, via `mlx-lm`. Deployment target is
a separate machine with no discrete GPU (Intel i7-1185G7 / Iris Xe / 64GB
RAM) — MLX is Metal-only and won't run there at all, so trained weights are
converted to a quantized GGUF and served with `llama.cpp` instead. Two
separate ecosystems bridged by an explicit conversion step, not one tool
end-to-end.

## Why synthetic data, not real conversations

This app's messages are end-to-end encrypted. Curating a training corpus
from real user content is a materially different privacy question than the
existing per-request AI-consent flow (`src/services/aiConsent.ts`), which is
scoped to "this user asked to summarize this one conversation right now" —
not "collect conversations into a training set." Rather than resolve that
separately, `scripts/generate_data.py` generates synthetic conversations
instead, across all 15 locales this app ships (`src/i18n/locales/`).

## Pipeline

```
scripts/generate_data.py           synthetic conversations -> teacher (Cloudflare
                                    70B) summaries/answers -> data/pool.jsonl
                                    -> data/{train,valid,test}.jsonl
        |
        v
scripts/lora_config.yaml           mlx_lm.lora -c scripts/lora_config.yaml
scripts/lora_config_1.7b.yaml      (or the *_1.7b.yaml variant)
        |
        v
scripts/convert_for_deployment.sh  fuse adapter -> GGUF -> quantize (Q5_K_M)
        |
        v
                                    copy the .gguf to the workstation, serve with
                                    llama-server -c 4096 (see gotcha below)
```

### 1. Data generation (`scripts/generate_data.py`)

Two-stage distillation, per example:

1. Ask the teacher model to invent a realistic synthetic conversation in a
   given language/scenario/length, plus a plausible follow-up question about
   it.
2. Feed that conversation through the *exact* prompt production uses
   (`functions/aiChat.js`'s `buildPrompt`, mirrored at the top of this
   script — keep the two in sync by hand if one changes) to get the target
   summary and target answer. This is what the small model is actually
   distilling: not "summarization in general," but this specific prompt's
   behavior.

```sh
source .venv/bin/activate   # after: python3.12 -m venv .venv && pip install mlx-lm
python scripts/generate_data.py --scenarios-per-language 4
```

Needs `functions/.env`'s `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN`
(same credentials the Cloud Function already uses — read directly from that
file, not duplicated).

Every successful example is appended immediately to `data/pool.jsonl` and
flushed — generation is slow and API-dependent, so nothing waits until "the
end" to be saved. `train`/`valid`/`test`.jsonl are always deterministically
re-derived from the pool afterwards (or on demand: `--resplit-only`). This
matters because **Cloudflare Workers AI's free tier caps out at 10,000
neurons/day** — a 270-combo run hit that wall partway through and failed
every call from that point on with `AiError: ... daily free allocation ...`.
No amount of retrying fixes it; it resets on Cloudflare's own schedule. Only
the incremental-write design meant that wall didn't also erase the ~120
examples already generated before it hit. If you see this error, either wait
for the reset or upgrade to Workers AI's paid plan — nothing to fix in the
script.

### Second teacher: DeepSeek

`--teacher deepseek` switches the teacher from Cloudflare's Llama-3.3-70B to
DeepSeek's API (OpenAI-compatible `/chat/completions`, `deepseek-chat`
model). Needs `DEEPSEEK_API_KEY` in `ml/.env` (a separate file from
`functions/.env` — this key has nothing to do with the production app,
gitignored the same way). This is a deliberately *different* second teacher,
not a production match the way Cloudflare is — added to solve two problems
Cloudflare's teacher has:

- **No daily quota wall.** DeepSeek is pay-as-you-go, so a big generation
  run doesn't die partway through like the 270-combo Cloudflare run did.
- **The Japanese/Korean gap** (see below) — DeepSeek's training mix is far
  more CJK-heavy than Llama-3.3's, and it shows: a 6-combo ja/ko-only test
  batch produced 12/12 examples with only one retry needed, versus
  Cloudflare's roughly 1-in-12 success rate on the same task shape.

Examples from both teachers land in the same `data/pool.jsonl` and get
mixed together by `resplit_pool()` — nothing downstream distinguishes which
teacher produced which example.

Useful flags: `--languages ja,ko,zh-Hans` (comma-separated subset, e.g. to
backfill one language without a full run), `--max-combos N` (quick test),
`--resplit-only` (re-derive splits from the existing pool without generating
anything).

Three data-quality gates, all discovered by actually running this rather
than assumed up front:

- **Response-language consistency.** The teacher doesn't reliably respond
  in the conversation's own language even when told to — this showed up
  first as Italian/Russian conversations getting English summaries. Fixed
  the underlying prompt (`buildPrompt` now explicitly says "Respond in the
  same language as the conversation" — a real improvement to the *production*
  Cloud Function too, not just training data), but the instruction still
  isn't 100% reliable, especially for Japanese specifically (see below).
  `matches_expected_script()` checks the teacher's answer against the
  conversation's expected Unicode block and retries (4 attempts); if it
  still doesn't match, the example is dropped rather than kept. Better to
  lose an example than train the small model on the same inconsistency.
- **CJK colon parsing.** The teacher correctly uses the full-width colon "："
  (U+FF1A) for Chinese/Japanese/Korean conversations — that's correct
  punctuation on its part. The transcript parser originally only recognized
  ASCII ":", silently dropping every line of every CJK conversation. Fixed
  in `_split_on_colon`.
- **Occasional degenerate generations.** A conversation where every message
  comes back empty ("Name: " with nothing after it) is a one-off teacher
  hiccup, not systematic — confirmed by hand for Korean, which failed once
  then succeeded 3/3 immediately after on the identical scenario. The main
  loop retries conversation generation up to 3 times before giving up on a
  combo.

**Japanese/Korean: substantially improved via DeepSeek, not fully solved.**
Cloudflare's teacher (Llama-3.3-70B) essentially cannot reliably produce
Japanese output for this task — even at 4 retries per call, one dedicated
12-combo ja/ko-only run against it produced exactly 1 usable example.
Switching to DeepSeek for these two languages fixed *generation* (12/12 on
the same kind of run, see above) and clearly helped the *trained model's*
fluency and correctness in these languages — but held-out testing after
training on the enlarged dataset still found real mistakes: a Korean answer
that cited an unrelated line as if it supported the (correct) core fact, and
a Japanese answer whose one-sentence summary directly contradicted its own
supporting bullet points. Meaningfully better than before, not yet as
reliable as English. Not chasing this further right now; revisit if ja/ko
usage turns out to matter a lot in practice.

**Hindi: occasional, not systematic, language-mismatch drops.** Of 8
DeepSeek-generated Hindi combos, 3 examples got dropped after exhausting all
4 retry attempts (teacher answered in English/Romanized text instead of
Devanagari). The other 13 succeeded, most on the first attempt. Not
investigated further — small enough to not be worth chasing given every
other language (including ja/ko once moved to DeepSeek) works reliably.

### 2. LoRA fine-tune (`scripts/lora_config.yaml` / `lora_config_1.7b.yaml`)

```sh
python -m mlx_lm lora -c scripts/lora_config_1.7b.yaml
```

16 of 28 layers (both 0.6B and 1.7B are 28 layers deep, just different
width), prompt masked out of the loss (only trained to predict the
summary/answer, not to reproduce the instruction+transcript it was given).

**On a small dataset, watch the val loss curve, don't trust a fixed `iters`
guess.** The first 0.6B run used `iters: 300`, `steps_per_eval: 25` and
badly overfit — train loss collapsed toward 0 while val loss rose
monotonically from iter 25 onward (1.053 -> 1.901 by the end). The *actual*
best checkpoint was sitting at iter 25, silently passed over because
`save_every: 50` never captured it. Fixed by cutting to `iters: 40` with
`steps_per_eval: 5` / `save_every: 5` — fine-grained enough to actually see
where the curve turns, with a checkpoint at every eval point to pick from.
Both config files now start fine-grained from the start rather than
guessing a schedule first. After training, check `ml/adapters/.../` for
`NNNNNNN_adapters.safetensors` files and copy the one at the true validation
minimum over `adapters.safetensors` if it isn't already the last one saved
— `mlx_lm.fuse` always reads `adapters.safetensors` by that exact name.

The dataset grew twice more after that, each time rescaling `iters` to
roughly a 3-epoch target and keeping ~20-40 eval points:

- **96 → 344 examples**: `iters: 200`, eval every 10. 1.7B bottomed at iter
  80 (val loss 0.996, broad plateau iter 60-130, mild drift to 1.037 by
  iter 200); 0.6B bottomed at iter 80 too (val loss 1.347, similar shape,
  drifting to 1.406).
- **344 → 1744 examples** (1396 train, after the large DeepSeek batch, see
  above): `iters: 1000`, eval every 25. This produced by far the smoothest
  curve yet — a long, steady decline all the way to iter 700 (val loss
  0.859), only mild drift after (up to ~0.87 by iter 1000). No sharp
  overfitting blowup, consistent with having much more data. 0.6B wasn't
  re-trained a third time — the 0.6B-vs-1.7B gap was already re-confirmed
  once (see below) and isn't the open question anymore.

Val loss isn't comparable across different dataset sizes (different
validation sets each time) — what matters is the shape (no repeat of the
first run's severe blowup) and, more importantly now, the actual held-out
eval results below, which are a much stronger signal than val loss alone.

### 0.6B vs 1.7B: real evidence, not a guess

Both trained on the identical 96-example dataset for direct comparison.

- **Validation loss**: 0.6B bottomed out at 1.048 (iter 20 of 40). 1.7B
  plateaued at 0.832 (iter 30-40) — meaningfully better fit at the same
  data scale.
- **Fact-checking, same test prompts on both**: 0.6B got 2 of 4 facts wrong
  on an English trip-planning summary (swapped who was bringing
  snacks/firewood, invented that "Jamie" rather than "Priya" was waiting on
  a boss's approval). 1.7B got all 4 facts right, and separately answered a
  French question-in-context and summarized a Chinese group conversation
  both correctly and in-language.

0.6B has the right *shape* (concise, correct-language, cites sources when
asked a question) but not the factual grounding at this data scale. 1.7B
does.

**Re-tested after the dataset grew to 344 examples — 1.7B still wins,
clearly.** This was flagged as worth re-checking rather than assumed, since
small-model factual grounding is often more a data-volume problem than an
architecture one. Re-ran the identical held-out fact-check battery (1
English + 3 ja/ko examples) against both freshly-retrained models:

- **English**: 1.7B fully correct. 0.6B introduced a subtle
  reversed-attribution error (swapped who was supposed to keep whom posted
  about a scheduling detail).
- **Korean (cake question)**: both got the core fact right, but 0.6B's
  supporting "quote" was a one-word filler ("맞아") that isn't actually the
  supporting line, while 1.7B at least quoted a real (if not fully relevant)
  line from the conversation.
- **Japanese (water bottles question)**: 1.7B answered cleanly and
  correctly. 0.6B got the fact right but padded the answer with an
  unrelated citation from a different speaker.
- **Japanese (subscriptions question)**: 1.7B got the headline sentence
  wrong but its own supporting bullets were correct and clearly named the
  right subscription. 0.6B never answered the question at all — its
  response was repetitive, grammatically broken filler that circled the
  topic without ever stating which subscription was cancelled.

3.6x more training data narrowed the gap somewhat but didn't close it — 0.6B
still can't reliably hold onto and correctly cite specific facts the way
1.7B does. At this task and model-size range, it looks like a real capacity
ceiling, not just a data-volume shortfall.

### How good is it, really? (`scripts/eval.py`)

Every quality claim above the very large dataset (344 examples and below)
was a hand-picked spot check — 3-4 examples, manually read. That's not
rigorous enough to answer "is this good enough" with any confidence, and it
turned out to be misleading: those spot checks kept landing on either
mostly-right or mostly-wrong examples by chance, giving a rosier picture
than the model actually earns.

After growing the dataset again to 1744 examples (1396 train) and
retraining 1.7B (see below), `scripts/eval.py` was built to actually
measure this: it runs the *entire* 174-example held-out test set through a
running `llama-server` instance, then asks DeepSeek to judge each answer
against the original teacher's reference answer for factual consistency
(not exact wording — added-but-correct detail or different phrasing is
fine; misattributing who said or did something, stating something false,
or not answering the question is a fail).

```sh
llama-server -m ml/models/gguf/qwen3-1.7b-summarizer-q5_k_m.gguf -c 4096 --port 8093 &
python ml/scripts/eval.py --server http://localhost:8093
```

**Result: 104/174 correct (59.8%).** Per language (`latin` lumps together
en/es/fr/de/it/pt/tr/vi — the script-based detector in eval.py can't tell
them apart, a real gap in the eval tool itself). 4B/8B/14B's numbers
included for comparison, same eval, same test set — 4B shown both as the
messy salvaged run and the later clean run after the instability fix (see
"4B: two divergences, then a real result" below); 8B and 14B were both
clean from the start (see "8B: the fix transfers" and "14B: QLoRA, and the
trend breaks" below). Cloudflare's 70B (the actual production teacher,
queried fresh via `--query-mode cloudflare`, see "The Cloudflare baseline"
below) included as the bar every small model is actually trying to clear:

| lang | 1.7B | 4B (messy) | 4B (clean) | 8B | 14B | **CF 70B** |
|---|---|---|---|---|---|---|
| ja | 30/40 (75.0%) | 33/40 (82.5%) | 35/40 (87.5%) | 38/40 (95.0%) | 36/40 (90.0%) | 39/40 (97.5%) |
| ar | 9/16 (56.2%) | 11/16 (68.8%) | 13/16 (81.2%) | 14/16 (87.5%) | 14/16 (87.5%) | 16/16 (100.0%) |
| latin | 47/78 (60.3%) | 70/78 (89.7%) | 68/78 (87.2%) | 72/78 (92.3%) | 70/78 (89.7%) | 77/78 (98.7%) |
| ko | 9/18 (50.0%) | 12/18 (66.7%) | 15/18 (83.3%) | 16/18 (88.9%) | 17/18 (94.4%) | 17/18 (94.4%) |
| ru | 5/10 (50.0%) | 9/10 (90.0%) | 9/10 (90.0%) | 9/10 (90.0%) | 9/10 (90.0%) | 10/10 (100.0%) |
| hi | 4/12 (33.3%) | 9/12 (75.0%) | 7/12 (58.3%) | 11/12 (91.7%) | 12/12 (100.0%) | 12/12 (100.0%) |
| **overall** | **104/174 (59.8%)** | **144/174 (82.8%)** | **147/174 (84.5%)** | **160/174 (92.0%)** | **158/174 (90.8%)** | **171/174 (98.3%)** |

A clean, near-monotonic trend with model size through 8B — every language
above 87%, including Hindi's big jump back up (58.3% → 91.7%) after being
the one soft spot in the clean 4B run. **The trend breaks at 14B**: overall
dips slightly to 90.8%, with ja and latin both a few points below their 8B
scores, while hi (100%) and ko (94.4%) improve further. With per-language
samples this small (10-18 examples), some of that movement is plausibly
noise rather than a real regression in either direction — but the headline
holds regardless: 14B does not clearly beat 8B on this eval, despite a
cleaner, lower-val-loss training run.

**None of the small models close on 70B.** Even 8B, the best of them,
sits 6.3 points behind — and the gap is bigger than that in the languages
that matter most for coverage (ar: 87.5% vs 100%, latin: 92.3% vs 98.7%).
This is the real headline of the whole eval table, not the 1.7B→8B climb.

The 4B clean run beats the messy one overall despite Hindi and Latin dipping
slightly — both are small samples (12 and 78 examples) where a couple of
answers flipping is enough to move the percentage a few points; not treated
as a real regression on its own.

Manually spot-checked two of the judge's verdicts against the raw model
output to make sure this number is real and not a broken eval: one
confirmed failure (a Hindi restaurant-planning summary that garbled
transliterated proper nouns — "Tandoori Junction" became तंदूर जूनियन — and
named the wrong restaurant as the one whose brownie they'd try), one
confirmed pass on a second random example. The eval is measuring something
real.

**The dominant failure mode across every language, not just ja/ko/hi, is
misattribution** — getting *who* said, decided, or did something wrong
(swapping two participants' roles, assigning a cost/quote/decision to the
wrong person), not garbled language or off-topic answers. That's a classic
small-model weakness at tracking multiple named entities through a
multi-turn conversation, and it didn't go away when the dataset grew 18x
(96 → 1744) — the retrain's validation loss did improve substantially
(0.996 → 0.859 at the true-optimum checkpoint, see above), just not enough
to fix this specific failure pattern. Worth treating as a real signal that
more data alone may not close this gap, rather than assuming another
order of magnitude of examples will fix it the way it hasn't fully fixed it
twice now.

**Bottom line on 1.7B: not production-ready at 59.8%.** A wrong answer in
this feature actively misleads someone about what people in their own
conversation said — that's a worse failure mode than no answer at all.

### 4B: two divergences, then a real result

More data (18x, twice) hadn't fixed 1.7B's misattribution problem, which
looked like a real capacity ceiling rather than a data-volume shortfall
(see above) — so the next lever tried was a bigger base model:
`ml/scripts/lora_config_4b.yaml`, same 1744-example dataset, `num_layers:
20` (36-layer model, same ~57% "upper portion" ratio as the smaller
configs' 16-of-28).

**Attempt 1** (`learning_rate: 1.0e-5`, same as 1.7B, `iters: 1000`):
looked excellent early — val loss 0.802 by iter 25, already better than
1.7B ever reached — then diverged hard from iter 125 on, exploding to the
11-14 range and never recovering. Not overfitting (which rises gradually);
a genuine training instability. mlx_lm's `lora` trainer has no
gradient-clipping flag, so the fix path is the learning rate.

**Attempt 2** (`learning_rate: 5.0e-6`, half): stable through 200 iters
with no blow-up, but the curve was still actively descending at the cutoff
(1.212 at iter 200, having just broken past a long plateau around iter
130-135) — training was stopped before it converged, so the run was
extended by resuming from that checkpoint (`resume_adapter_file`) for 400
more iterations rather than judging an unfinished result.

**The resume diverged too** — a second, separate instability, this time
starting from a genuinely good point (val loss 1.090 at iter 10 of the
resume, the best seen anywhere in the whole 4B effort) and climbing
steadily to 9.7+ by iter 90 with no sign of recovering, matching attempt
1's pattern closely enough that it was killed early rather than let run to
completion. **Diverging twice, at two different learning rates, is a real
signal that this specific model/framework/LoRA-config combination has a
stability problem at 4B that 1.7B didn't have** — not simply "the first LR
guess was wrong." Not yet root-caused; a further reduced learning rate,
gradient accumulation (`--grad-accumulation-steps`, effectively smoothing
the batch), or a different `num_layers` are the untried next steps if this
needs to be revisited.

The iter-10 checkpoint from the resume (val loss 1.090) was locked in as
the best available result despite the mess — and despite scoring *worse*
on validation loss than 1.7B's 0.859 on the identical validation set.

**It doesn't matter — 4B scored 82.8% (144/174) on the held-out eval,
against 1.7B's 59.8%, a large jump in every single language** (see the
table above). That result held even though this 4B checkpoint came from an
interrupted, unstable run that never got a clean, fully-converged pass —
which is a striking result in its own right: model capacity, not training
polish or dataset size, looks like it was the actual bottleneck for the
misattribution problem all along.

**The instability was root-caused and fixed, not just routed around.**
Two separate, concrete issues:

- **Memory pressure causing swap.** The M5 Max used for training has 48GB
  RAM (not 64GB — that's the separate Intel deployment target). Attempt 1
  alone, with no grad accumulation, hit "Peak mem 68.493 GB" — well over
  physical RAM — and the machine was directly observed mid-run swapping
  heavily (15.9 of 17.4GB swap in use). Added `grad_checkpoint: true`
  (trades some recompute for a large activation-memory cut) — peak memory
  dropped to 22.7GB and stayed flat there for the entire run, no swapping.
- **Noisy small-batch gradients.** `batch_size: 4` gives a noisy gradient
  estimate; an occasional bad batch could plausibly take a step large
  enough to destabilize Adam's accumulated moment estimates, which then
  compounds over subsequent steps. Added `grad_accumulation_steps: 4`
  (effective batch 16 without raising per-step memory), switched
  `optimizer` from plain `adam` to `adamw` (decoupled weight decay, a
  standard regularizer neither prior attempt had), and dropped
  `learning_rate` to `3.0e-6` as an added margin.

Retrained from scratch (not resumed — `--resume-adapter-file` only
restores model weights, not optimizer state, so both divergences happened
independent of starting point) with all four changes together: **300
iters, zero instability, a monotonically decreasing curve the entire way**
— 1.781 → 0.746, still improving slightly at the very last checkpoint
rather than blowing up. For the first time in the 4B effort, the final
checkpoint (iter 300) *is* the true optimum, no need to hunt through
earlier saves. Converted to GGUF and eval'd exactly like every other model
here (`scripts/eval.py`) — **84.5% (147/174)** at the time, then quickly
superseded (see below).

### 8B: the fix transfers

With the instability root-caused rather than patched around, going to 8B
was a matter of reusing the same recipe (`scripts/lora_config_8b.yaml`):
`optimizer: adamw`, `grad_accumulation_steps: 4`, `grad_checkpoint: true`,
`learning_rate: 3.0e-6`, applied from the very first run instead of
discovering it through two crashes again. Also 36 layers deep like 4B
(just wider: hidden_size 4096 vs 2560), same `num_layers: 20`.

One real risk going in: the training M5 Max has 48GB RAM, and 4B's first
(unfixed) attempt alone had already hit 68.5GB peak. 8B roughly doubles
base-weight memory again. Watched closely during the run — peak memory
settled at 33.7GB (up from 4B's 22.7GB, in line with the size increase)
and stayed flat there, comfortable headroom under 48GB, no swapping.

**Result: 300 iters, zero instability, monotonically decreasing the entire
way** — 1.564 → 0.653, beating 4B's clean-run final val loss (0.746) on an
identical setup (same dataset, same effective batch size, same iter
count). Converted to GGUF and eval'd the same way: **92.0% (160/174)** at
the time — until 14B (below) reopened the question of whether size was
still the right lever to pull. The instability fix transferring cleanly to
a bigger model on the first try was itself a useful result: it was a real,
fixable engineering problem, not something inherent to fine-tuning Qwen3
at this scale.

### 14B: QLoRA, and the trend breaks

14B doesn't exist as a round number to jump to by coincidence — it's the
actual next size in Qwen3's lineup after 8B (there is no 16B; checked
directly against the HuggingFace API before downloading anything, since
guessing wrong here would have wasted a full download/convert/train
cycle). 40 layers deep (vs 36 for 4B/8B, same architecture family just
deeper), `num_layers: 23` to keep the same ~57% ratio used at every size.

**Memory required a different approach this time, not just
`grad_checkpoint`.** 14B's frozen bf16 weights alone are ~28GB, and 8B's
training already used ~33.7GB total (16GB weights + ~18GB overhead) on
this 48GB machine — scaling that up put full-bf16 14B training right at or
past the RAM ceiling, a real risk of swap regardless of gradient
checkpointing, since this time the base weights themselves are most of the
cost, not activations. Fix: convert the base model twice — once to bf16
(`ml/models/qwen3-14b-mlx`, kept for deployment fusing) and once to a
4-bit-quantized copy (`ml/models/qwen3-14b-mlx-q4`, 7.8GB), then train the
LoRA adapter against the *quantized* copy (QLoRA-style) while keeping the
bf16 copy to fuse the trained adapter onto afterward, so the final GGUF
isn't compounding two quantization passes. Verified `mlx_lm`'s LoRA
trainer accepts a quantized base model before committing to the full run.

**Result: peak memory 23.1GB** — lower than 8B's 33.7GB despite being the
bigger model, confirming the quantized-training approach worked as
intended. **300 iters, zero instability, monotonically decreasing the
entire way** — 1.380 → 0.609, beating 8B's final val loss (0.653) — but
noticeably slower per step (~12s/iter vs 8B's ~4s/iter, quantization
compute overhead), the full run taking a little over 5 hours versus 8B's
~35 minutes.

**Eval: 90.8% (158/174) — the trend that held cleanly through 8B breaks
here.** Slightly below 8B's 92.0%, despite the cleaner training curve and
lower val loss — a direct demonstration that val loss and downstream eval
accuracy aren't the same thing, and that the eval, not the loss curve, is
the number that actually matters. Not a uniform regression: Hindi hit a
perfect 12/12 (100%, up from 8B's 91.7%) and Korean improved too (94.4%
vs 88.9%), while Japanese and the Latin-script group both dipped a few
points (see the table above). Combined with deployment cost doubling again
(14B's GGUF is 10.5GB vs 8B's 5.85GB) for no net accuracy gain, this is a
real signal to stop climbing on size alone rather than a data point that
argues for trying even bigger.

### The Cloudflare baseline

Every number above compares small models against each other, or against a
reference answer the teacher itself wrote — never against the teacher's
own accuracy on fresh generations. That was the single biggest gap in this
whole eval effort: "92.0%" doesn't mean anything on its own without
knowing what the thing it's meant to replace actually scores.

`scripts/eval.py --query-mode cloudflare` queries Cloudflare's 70B
directly on the same 174 held-out prompts (not replaying its own saved
reference answers — generating fresh each time, same as production
actually does), judged by DeepSeek the same way as every small model. The
first attempt hit Cloudflare's daily free-tier wall immediately (zero
data, quota already exhausted from earlier work that session). Retried the
next day and it went through cleanly, no wall hit this time.

**Result: 171/174 (98.3%)** — see the full per-language breakdown in the
table above. Only 3 failures out of 174, and they're minor by comparison
to the small models' failure modes: overstating a positive-but-unconfirmed
detail, treating a lean-toward-yes as a firm decision, mixing up two very
similar grocery items. Nothing like the flat-out wrong-person
misattributions that dominate the small models' failures.

**This resets what "good enough" means for this whole project.** 8B's
92.0% looked strong right up until it had something real to compare
against. A 6.3-point gap sounds small as a percentage but means roughly
11 more wrong answers per 174 questions — for a feature where a wrong
answer actively misleads someone about their own conversation, that's not
a rounding error. Deploying 8B today would be a real, measurable quality
downgrade for users, traded for running locally instead of paying for
cloud inference. That might still be the right tradeoff depending on cost
constraints (see the deployment-cost discussion earlier in this
conversation's history) — but it should be made knowingly, not on the
assumption that 92.0% was already close to as good as it gets.

### 3. Convert for deployment (`scripts/convert_for_deployment.sh`)

```sh
scripts/convert_for_deployment.sh 1.7b   # or 0.6b, or any size present under ml/models/
```

Fuses the LoRA adapter into the base weights, converts to GGUF, quantizes.
Two conversion paths:

1. `mlx_lm.fuse --export-gguf` — MLX's own exporter. **Confirmed not to
   support Qwen3's architecture**; fails immediately every time. Left in as
   an attempt in case a future mlx-lm release adds support, but path 2
   always runs in practice.
2. Fuse to plain HF-format weights, then llama.cpp's own
   `convert_hf_to_gguf.py`, run in a *separate* venv (`.venv-convert` — its
   pinned `numpy~=1.26`/`transformers==4.57` would otherwise fight
   `mlx-lm`'s `numpy` 2.x/`transformers` 5.x in the same environment).

   Qwen3's own `tokenizer_config.json` ships an `extra_special_tokens` field
   as a *list*, but `transformers==4.57.6`'s tokenizer loader expects a
   *dict* there (`AttributeError: 'list' object has no attribute 'keys'`).
   This is upstream — present in the base model's tokenizer config too, not
   introduced by fusing. The script patches the field out of the fused
   model's config before conversion; these are all vision-model tokens
   (`<|image_pad|>`, `<|box_start|>`, etc.), irrelevant to a text-only
   summarizer, and removing this metadata list doesn't touch the actual
   vocabulary (`tokenizer.json`).

**Quantize to Q5_K_M, not Q4_K_M.** Tried Q4_K_M first (smaller, ~1.0GB vs
1.2GB for 1.7B) and found a real, repeatable quality regression: it
consistently got the same "who's waiting on whose boss" detail wrong across
multiple generations (`llama-completion` and `llama-server`, different
sampling each time) that both the unquantized MLX model and Q5_K_M got right
every time, no exceptions, across three separate test runs. On a 64GB
deployment target the extra ~200MB is not a real cost — not worth the
quality loss.

Needs Homebrew `llama.cpp` (`brew install llama.cpp`, for `llama-quantize`
and `llama-server`) and a shallow clone of the llama.cpp repo at
`llama.cpp-src/` (only for `convert_hf_to_gguf.py` — Homebrew's bottle ships
compiled binaries only, not the Python conversion scripts).

### Deployment gotcha: always pass `-c` explicitly

Qwen3's trained context length is 40960, embedded in the GGUF as
`qwen3.context_length`. Both `llama-cli` and `llama-server` default to it
when `-c`/`--ctx-size` is omitted — which allocates a KV cache sized for
40960 tokens before doing anything else, and turned a 20-token test
generation into a 2+-minute hang (confirmed: the process was genuinely
burning CPU the whole time, not stuck waiting on input). `-c 4096` is
comfortably more than any chat-summarization prompt here needs and starts
in well under a second.

```sh
llama-server -m ml/models/gguf/qwen3-1.7b-summarizer-q5_k_m.gguf -c 4096 --port 8080
# then: POST /v1/chat/completions with {"messages": [{"role": "user", "content": "<buildPrompt output>"}]}
```

`llama-cli`/`llama-completion` also default to an interactive REPL that
inserts a demo `Hello`/`Hi there` exchange before your actual prompt unless
you're careful with `-no-cnv` (which, confusingly, *also* disables chat
templating entirely — tested giving a broken, repetitive completion with no
structure). `llama-server`'s `/v1/chat/completions` endpoint sidesteps all
of this ambiguity and is what a real integration would use anyway.

## What's not decided yet

- **Whether the local/cost tradeoff is worth a 6.3-point quality drop.**
  Now that the Cloudflare baseline exists (98.3% vs 8B's 92.0%, see "The
  Cloudflare baseline" above), this is a real decision, not a placeholder.
  Shipping 8B means users get worse "Catch Up" answers than they do today,
  in exchange for the app not depending on Cloudflare's API and (per the
  serverless-hosting discussion) a summarization request costing roughly a
  cent or less instead of whatever Cloudflare currently bills. Not
  obviously the right call either way — depends on how much the cost/
  independence side of that trade actually matters versus how much a
  ~1-in-16 chance of a misattributed fact matters for this feature.
- **Cloud Function integration.** Nothing in `functions/` calls this yet —
  `summarizeChat` still calls Cloudflare's 70B. Given the gap above,
  swapping it over outright doesn't look justified yet; a middle path
  (e.g. small model first, escalate to Cloudflare on low-confidence
  answers) hasn't been explored.
- **Deployment size/latency, still not measured.** 8B's GGUF is 5.85GB.
  CPU-only inference on the Intel workstation target hasn't actually been
  measured yet — worth doing regardless of the quality-tradeoff decision
  above, since it could turn out to be a binding constraint on its own.
- **Model size is settled (8B), not still open.** 0.6B/1.7B/4B/14B were
  all tried and set aside — see the trend above and "14B: QLoRA, and the
  trend breaks." None of them closed meaningfully on Cloudflare's 98.3%
  either, so this isn't a "try a bigger size" problem anymore.
- **Japanese/Korean/Hindi generation coverage** is solid (DeepSeek fixed
  the generation-side gap) and the eval gap closed at 8B — every language
  scores at or above 87.5%. No longer a language-specific concern.
