#!/usr/bin/env python3
"""
Grades a model's held-out test.jsonl performance using an LLM judge, instead
of hand-picked spot checks. For each test example: query the model for its
answer, then ask DeepSeek to judge it against the original teacher's
reference answer for factual consistency (not exact wording). Reports pass
rate overall and per language.

Two query modes:
  --query-mode llama-server (default): the small model under test, via a
    running llama-server instance.
  --query-mode cloudflare: Cloudflare's Llama-3.3-70B directly -- the actual
    production teacher (functions/index.js's summarizeChat), queried fresh
    each time (not replaying its own saved reference answers), to get an
    independent baseline for "how good is what's already shipping" instead
    of only ever comparing small models against each other.

Caveat: DeepSeek was also used as the teacher for the ja/ko/hi
reinforcement data (see README), so treat the ja/ko/hi numbers here as a
useful signal, not a fully independent audit -- the judge and one of the
two teachers are the same model.

Usage:
  llama-server -m ml/models/gguf/qwen3-4b-summarizer-q5_k_m.gguf -c 4096 --port 8093 &
  python ml/scripts/eval.py --server http://localhost:8093

  python ml/scripts/eval.py --query-mode cloudflare
"""
import argparse
import collections
import json
import re
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / 'ml' / '.env'
FUNCTIONS_ENV_FILE = ROOT / 'functions' / '.env'


def load_env(path: Path) -> dict:
    env = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


DEEPSEEK_API_KEY = load_env(ENV_FILE)['DEEPSEEK_API_KEY']
DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

# Same production teacher functions/index.js's summarizeChat calls -- used
# here only for --query-mode cloudflare, to benchmark it independently.
_functions_env = load_env(FUNCTIONS_ENV_FILE) if FUNCTIONS_ENV_FILE.exists() else {}
CLOUDFLARE_ACCOUNT_ID = _functions_env.get('CLOUDFLARE_ACCOUNT_ID')
CLOUDFLARE_API_TOKEN = _functions_env.get('CLOUDFLARE_API_TOKEN')
CLOUDFLARE_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
CLOUDFLARE_URL = (
    f'https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/run/{CLOUDFLARE_MODEL}'
    if CLOUDFLARE_ACCOUNT_ID else None
)

client = httpx.Client(timeout=120)

# Cheap script-based language tagging for the results breakdown -- not the
# generation-time validator, just enough to group results per language.
SCRIPT_RANGES = {
    'ja': [(0x3040, 0x30FF), (0x4E00, 0x9FFF)],
    'ko': [(0xAC00, 0xD7A3)],
    'hi': [(0x0900, 0x097F)],
    'ar': [(0x0600, 0x06FF)],
    'ru': [(0x0400, 0x04FF)],
    'zh': [(0x4E00, 0x9FFF)],
}


def detect_lang(text: str) -> str:
    for c in text:
        for lang, ranges in SCRIPT_RANGES.items():
            if any(lo <= ord(c) <= hi for lo, hi in ranges):
                return lang
    return 'latin'  # en/es/fr/de/it/pt/tr/vi -- not distinguished by script alone


def query_model(server_url: str, prompt: str, retries: int = 3) -> str:
    for attempt in range(retries):
        try:
            resp = client.post(f'{server_url}/v1/chat/completions', json={
                'messages': [{'role': 'user', 'content': prompt}],
                'temperature': 0.3,
            })
            return resp.json()['choices'][0]['message']['content'].strip()
        except Exception as e:
            if attempt == retries - 1:
                raise
            print(f'  model query retry: {e}', file=sys.stderr)


def query_cloudflare(prompt: str, retries: int = 3) -> str:
    for attempt in range(retries):
        try:
            resp = client.post(
                CLOUDFLARE_URL,
                headers={'Authorization': f'Bearer {CLOUDFLARE_API_TOKEN}', 'Content-Type': 'application/json'},
                json={'messages': [{'role': 'user', 'content': prompt}]},
            )
            data = resp.json()
            if not resp.is_success or data.get('success') is False:
                raise RuntimeError(json.dumps(data.get('errors') or data))
            return (data.get('result', {}).get('response') or '').strip()
        except Exception as e:
            if attempt == retries - 1:
                raise
            wait = 2 ** attempt
            print(f'  cloudflare query retry: {e} (waiting {wait}s)', file=sys.stderr)
            time.sleep(wait)


def judge(prompt: str, expected: str, actual: str, retries: int = 3) -> tuple[str, str]:
    judge_prompt = (
        "You are grading a small model's output on a chat-summarization/QA task.\n\n"
        f"TASK GIVEN TO THE MODEL:\n{prompt}\n\n"
        f"REFERENCE ANSWER (from a trusted larger model):\n{expected}\n\n"
        f"MODEL'S ANSWER:\n{actual}\n\n"
        "Judge whether the model's answer is factually consistent with the reference "
        "answer and the conversation -- not whether it's phrased identically. Minor "
        "wording differences, added-but-correct detail, or different emphasis are fine. "
        "Fail it if it states something false, contradicts itself, misattributes who "
        "said or did something, or fails to actually answer the question asked.\n\n"
        "Respond with EXACTLY one line in this format:\n"
        "VERDICT: PASS or FAIL | REASON: <one short sentence>"
    )
    for attempt in range(retries):
        try:
            resp = client.post(
                DEEPSEEK_URL,
                headers={'Authorization': f'Bearer {DEEPSEEK_API_KEY}', 'Content-Type': 'application/json'},
                json={'model': 'deepseek-chat', 'messages': [{'role': 'user', 'content': judge_prompt}], 'temperature': 0},
            )
            data = resp.json()
            text = data['choices'][0]['message']['content'].strip()
            m = re.search(r'VERDICT:\s*(PASS|FAIL)\s*\|\s*REASON:\s*(.*)', text, re.IGNORECASE | re.DOTALL)
            if m:
                return m.group(1).upper(), m.group(2).strip()
            return 'FAIL', f'unparseable judge output: {text[:200]}'
        except Exception as e:
            if attempt == retries - 1:
                raise
            print(f'  judge retry: {e}', file=sys.stderr)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--server', default='http://localhost:8093', help='running llama-server base URL (query-mode llama-server only)')
    parser.add_argument('--query-mode', choices=['llama-server', 'cloudflare'], default='llama-server', help='llama-server: the small model under test. cloudflare: the actual production teacher, for an independent baseline.')
    parser.add_argument('--test-file', default=str(ROOT / 'ml' / 'data' / 'test.jsonl'))
    parser.add_argument('--limit', type=int, default=None)
    args = parser.parse_args()

    if args.query_mode == 'cloudflare' and not CLOUDFLARE_URL:
        print('error: --query-mode cloudflare needs CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN in functions/.env', file=sys.stderr)
        sys.exit(1)

    examples = [json.loads(line) for line in Path(args.test_file).read_text().splitlines() if line.strip()]
    if args.limit:
        examples = examples[:args.limit]

    results = []
    for i, ex in enumerate(examples):
        prompt = ex['messages'][0]['content']
        expected = ex['messages'][1]['content']
        lang = detect_lang(prompt)
        print(f'[{i + 1}/{len(examples)}] ({lang})...', file=sys.stderr)
        try:
            actual = query_cloudflare(prompt) if args.query_mode == 'cloudflare' else query_model(args.server, prompt)
            verdict, reason = judge(prompt, expected, actual)
        except Exception as e:
            verdict, reason = 'ERROR', str(e)
        results.append({'lang': lang, 'verdict': verdict, 'reason': reason})
        print(f'  {verdict}: {reason}', file=sys.stderr)

    by_lang = collections.defaultdict(collections.Counter)
    for r in results:
        by_lang[r['lang']][r['verdict']] += 1

    print('\n=== RESULTS ===')
    total_pass = sum(1 for r in results if r['verdict'] == 'PASS')
    print(f'Overall: {total_pass}/{len(results)} ({100 * total_pass / len(results):.1f}%)')
    for lang in sorted(by_lang):
        c = by_lang[lang]
        total = sum(c.values())
        p = c.get('PASS', 0)
        print(f'  {lang}: {p}/{total} ({100 * p / total:.1f}%)')

    fails = [r for r in results if r['verdict'] != 'PASS']
    if fails:
        print('\n=== FAILURES ===')
        for r in fails:
            print(f"  [{r['lang']}] {r['verdict']}: {r['reason']}")


if __name__ == '__main__':
    main()
