#!/usr/bin/env python3
"""
Generates (conversation -> summary) and (conversation + question -> answer)
training pairs for the small summarizer model, by distilling from the exact
same teacher model and prompt format already running in production
(functions/aiChat.js's buildPrompt), via Cloudflare Workers AI.

Two-stage generation per example:
  1. Ask the teacher to invent a realistic synthetic chat conversation
     (language, scenario, participant count, length varied for diversity)
     plus a plausible follow-up question about it.
  2. Feed that conversation through the *exact* production prompt to get the
     target summary and target answer -- the same shape the small model
     needs to learn to imitate.

Synthetic, not real user messages, deliberately: this app's chat content is
end-to-end encrypted, and curating a training corpus is a different privacy
question than the existing per-request AI-consent flow (see
src/services/aiConsent.ts) -- it wasn't worth conflating the two.
"""
import argparse
import json
import random
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]  # chatterbox/
ENV_FILE = ROOT / 'functions' / '.env'
OUT_DIR = ROOT / 'ml' / 'data'


def load_env(path: Path) -> dict:
    env = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


env = load_env(ENV_FILE)
ACCOUNT_ID = env['CLOUDFLARE_ACCOUNT_ID']
API_TOKEN = env['CLOUDFLARE_API_TOKEN']
# Same model functions/index.js currently calls for summarizeChat -- this is
# the primary teacher the small model is distilling from, so it must match
# exactly. --teacher deepseek (below) is a deliberately *different* second
# teacher, not a production match -- useful for extra volume once
# Cloudflare's daily quota is hit, and for the documented ja/ko gap, where
# Llama-3.3-70B specifically struggles (see README).
CLOUDFLARE_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
CLOUDFLARE_API_URL = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{CLOUDFLARE_MODEL}'

# Separate from functions/.env: this key has nothing to do with the
# production app, it's only used here to generate training data.
DEEPSEEK_ENV_FILE = ROOT / 'ml' / '.env'
DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
DEEPSEEK_MODEL = 'deepseek-chat'  # non-reasoning (V3), not deepseek-reasoner -- no need for chain-of-thought on this task
DEEPSEEK_API_KEY = load_env(DEEPSEEK_ENV_FILE).get('DEEPSEEK_API_KEY') if DEEPSEEK_ENV_FILE.exists() else None

TEACHER = 'cloudflare'  # overwritten from --teacher in main()

client = httpx.Client(timeout=60)


def call_teacher(prompt: str, retries: int = 3) -> str:
    for attempt in range(retries):
        try:
            if TEACHER == 'deepseek':
                resp = client.post(
                    DEEPSEEK_API_URL,
                    headers={'Authorization': f'Bearer {DEEPSEEK_API_KEY}', 'Content-Type': 'application/json'},
                    json={'model': DEEPSEEK_MODEL, 'messages': [{'role': 'user', 'content': prompt}]},
                )
                data = resp.json()
                if not resp.is_success:
                    raise RuntimeError(json.dumps(data.get('error') or data))
                content = (data.get('choices') or [{}])[0].get('message', {}).get('content')
                return (content or '').strip()
            else:
                resp = client.post(
                    CLOUDFLARE_API_URL,
                    headers={'Authorization': f'Bearer {API_TOKEN}', 'Content-Type': 'application/json'},
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
            print(f'  retry {attempt + 1}/{retries} after error: {e} (waiting {wait}s)', file=sys.stderr)
            time.sleep(wait)


# --- production prompt logic, mirrored exactly from functions/aiChat.js ---

def build_transcript(messages: list[dict]) -> str:
    return '\n'.join(f"{m.get('sender') or 'User'}: {m['text']}" for m in messages)


def build_summary_prompt(messages: list[dict]) -> str:
    transcript = build_transcript(messages)
    return (
        'The following is a transcript of a private chat conversation.\n'
        'Summarize the key points and topics discussed, concisely.\n'
        'Respond in the same language as the conversation.\n\n'
        '--- Conversation ---\n'
        f'{transcript}\n'
        '--- End conversation ---'
    )


def build_question_prompt(messages: list[dict], question: str) -> str:
    transcript = build_transcript(messages)
    return (
        'The following is a transcript of a private chat conversation.\n'
        "Answer the question below using only this conversation's content.\n"
        'Reference or quote the specific messages that support your answer.\n'
        'If the conversation does not contain relevant information, say so\n'
        'plainly rather than guessing.\n'
        'Respond in the same language as the conversation.\n\n'
        '--- Conversation ---\n'
        f'{transcript}\n'
        '--- End conversation ---\n\n'
        f'Question: {question}'
    )


# --- synthetic conversation generation ---

# Matches src/i18n/locales/*.json exactly.
LANGUAGES = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
    'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
    'ko': 'Korean', 'zh-Hans': 'Simplified Chinese', 'zh-Hant': 'Traditional Chinese',
    'ar': 'Arabic', 'hi': 'Hindi', 'tr': 'Turkish', 'vi': 'Vietnamese',
}

SCENARIOS = [
    'two friends planning a weekend camping trip, debating gear and dates',
    'roommates negotiating how to split a surprise repair bill',
    'a group chat coordinating a surprise birthday party, assigning tasks',
    'two old friends catching up after a year apart, trading life updates',
    'a couple disagreeing about how to spend a holiday, eventually compromising',
    'coworkers hashing out a project deadline that keeps slipping',
    'a family group chat planning who is hosting the next holiday dinner',
    'a friend venting about a bad day at work and another offering support',
    'friends debating where to eat, listing pros and cons of three restaurants',
    'coordinating who will pet-sit while a friend travels, with logistics',
    'planning a group road trip, splitting driving shifts and costs',
    'two friends discussing a movie they just watched, disagreeing on it',
    'a study group deciding how to divide up exam prep topics',
    "siblings arguing gently about who forgot a parent's birthday",
    'friends organizing a fantasy sports league, setting rules',
    'a small group planning a potluck, coordinating who brings what',
    'two friends discussing whether one should take a new job offer',
    'neighbors coordinating a noise complaint about a shared wall',
    'friends planning a surprise proposal, keeping it secret from one member',
    'a group discussing splitting a group gift for a mutual friend',
    'two friends planning a gym routine together, negotiating a schedule',
    'a group chat organizing carpool logistics for a shared commute',
    'friends debating which streaming show to watch next as a group',
    'a parent and adult child discussing a visit home, coordinating dates',
    'coworkers planning a farewell gift and card for a colleague leaving',
    'friends splitting up errands before a big group dinner they are hosting',
    'two friends troubleshooting one of their broken laptops over chat',
    'a group coordinating volunteering together for a weekend event',
    'friends comparing notes after a job interview one of them just had',
    'roommates deciding on a new shared streaming/subscription budget',
    'a group planning a themed costume party, dividing up who buys what',
    'two friends debating whether to adopt a pet, weighing pros and cons',
    'a family group chat arguing playfully about a recipe for a shared meal',
    'friends coordinating a group workout challenge, tracking progress',
    'two coworkers debugging a disagreement about how to split a task',
    'a group chat planning a reunion, nailing down a date most people can make',
    'friends deciding how to spend an unexpected windfall from a shared bet',
    'a couple planning a small home renovation, weighing two contractors',
    'two friends catching up about a recent breakup, one offering advice',
    'a group chat organizing a fundraiser for a mutual friend in need',
]


# Unicode block per non-Latin-script language, for a cheap sanity check that
# the teacher actually answered in the requested language instead of falling
# back to English -- observed happening for Japanese even with the explicit
# "respond in the same language" instruction in the prompt. Latin-script
# languages (es/fr/de/it/pt/tr/vi) aren't checked here: distinguishing them
# from English by character set alone isn't reliable enough to bother, and
# in testing the language instruction held for all of them.
SCRIPT_RANGES = {
    'ja': [(0x3040, 0x30FF), (0x4E00, 0x9FFF)],  # hiragana/katakana + kanji
    'ko': [(0xAC00, 0xD7A3)],  # hangul syllables
    'zh-Hans': [(0x4E00, 0x9FFF)],
    'zh-Hant': [(0x4E00, 0x9FFF)],
    'ar': [(0x0600, 0x06FF)],
    'ru': [(0x0400, 0x04FF)],  # cyrillic
    'hi': [(0x0900, 0x097F)],  # devanagari
}


def matches_expected_script(text: str, lang_code: str, min_ratio: float = 0.3) -> bool:
    ranges = SCRIPT_RANGES.get(lang_code)
    if not ranges:
        return True  # Latin-script language, not checked -- see note above.
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return True  # nothing to judge (e.g. a pure-number answer); don't reject on this alone
    in_script = sum(1 for c in letters if any(lo <= ord(c) <= hi for lo, hi in ranges))
    return (in_script / len(letters)) >= min_ratio


def generate_conversation(language_name: str, scenario: str, participants: int, length: int) -> str:
    gen_prompt = (
        f'Invent a realistic, natural-sounding chat conversation in {language_name}. '
        f'Scenario: {scenario}. It involves {participants} distinct people with realistic '
        f'first names appropriate for {language_name} speakers. Make it exactly {length} '
        'messages long, casual and natural like real texting (contractions, some short '
        'messages, occasional typos are fine).\n\n'
        'Output ONLY the conversation, one message per line, in this exact format:\n'
        'Name: message text\n\n'
        'After the conversation, on a new line write:\n'
        f'QUESTION: <a natural question a participant might ask later to catch up on this '
        f'conversation, answerable from it, written in {language_name}>'
    )
    return call_teacher(gen_prompt)



# CJK conversations naturally use the full-width colon "：" (U+FF1A) rather
# than ASCII ":" -- observed directly from the teacher's own Chinese output,
# which is correct punctuation on its part. A parser that only recognized
# ASCII ":" silently dropped every line of every CJK conversation.
COLON_CHARS = ':：'


def _split_on_colon(line: str) -> tuple[str, str] | None:
    for i, ch in enumerate(line):
        if ch in COLON_CHARS:
            return line[:i], line[i + 1:]
    return None


def parse_conversation(raw: str) -> tuple[list[dict], str | None]:
    messages = []
    question = None
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        if line.upper().startswith('QUESTION') and _split_on_colon(line):
            _, question = _split_on_colon(line)
            question = question.strip()
            continue
        split = _split_on_colon(line)
        if split:
            sender, text = split
            sender, text = sender.strip().strip('*').strip(), text.strip()
            if sender and text and len(sender) < 40:
                messages.append({'sender': sender, 'text': text})
    return messages, question


def make_example(prompt: str, answer: str) -> dict:
    return {'messages': [{'role': 'user', 'content': prompt}, {'role': 'assistant', 'content': answer}]}


def call_teacher_in_language(prompt: str, lang_code: str, max_attempts: int = 2) -> str | None:
    """call_teacher, but reject/retry an answer that doesn't match the
    conversation's script (see matches_expected_script) instead of silently
    training the small model on the same inconsistency the 70B teacher
    occasionally has. Returns None if it never gets a matching answer."""
    for attempt in range(max_attempts):
        answer = call_teacher(prompt)
        if matches_expected_script(answer, lang_code):
            return answer
        print(f'  language mismatch for {lang_code} on attempt {attempt + 1}/{max_attempts}, retrying', file=sys.stderr)
    return None


# All successful examples land here immediately, one JSON line at a time,
# flushed after every write -- generation is slow and API-dependent (a
# Cloudflare daily quota wall killed a 270-combo run partway through once
# already), so anything held in memory until "the end" is one interruption
# away from being silently thrown away. train/valid/test are re-derived from
# this pool afterwards, deterministically, so the pool is the only thing
# that actually needs to survive a crash.
POOL_FILE = OUT_DIR / 'pool.jsonl'


def append_to_pool(example: dict) -> None:
    with POOL_FILE.open('a') as f:
        f.write(json.dumps(example, ensure_ascii=False) + '\n')
        f.flush()


def resplit_pool(seed: int) -> None:
    if not POOL_FILE.exists():
        print(f'no pool file at {POOL_FILE} yet', file=sys.stderr)
        return
    examples = [json.loads(line) for line in POOL_FILE.read_text().splitlines() if line.strip()]
    rng = random.Random(seed)
    rng.shuffle(examples)
    n = len(examples)
    n_valid = max(1, n // 10)
    n_test = max(1, n // 10)
    splits = {
        'valid': examples[:n_valid],
        'test': examples[n_valid:n_valid + n_test],
        'train': examples[n_valid + n_test:],
    }
    for name, split in splits.items():
        path = OUT_DIR / f'{name}.jsonl'
        with path.open('w') as f:
            for ex in split:
                f.write(json.dumps(ex, ensure_ascii=False) + '\n')
        print(f'{name}: {len(split)} examples -> {path}', file=sys.stderr)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--scenarios-per-language', type=int, default=4)
    parser.add_argument('--max-combos', type=int, default=None, help='cap total conversations generated, for a quick test run')
    parser.add_argument('--languages', type=str, default=None, help='comma-separated subset of language codes, e.g. ja,ko,zh-Hans (default: all)')
    parser.add_argument('--resplit-only', action='store_true', help='skip generation, just re-derive train/valid/test from the existing pool (e.g. after an interrupted run)')
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--teacher', choices=['cloudflare', 'deepseek'], default='cloudflare', help='which model to distill from -- deepseek needs DEEPSEEK_API_KEY in ml/.env, and is a different model from what production runs, not a match')
    args = parser.parse_args()

    global TEACHER
    TEACHER = args.teacher
    if TEACHER == 'deepseek' and not DEEPSEEK_API_KEY:
        print('error: --teacher deepseek needs DEEPSEEK_API_KEY set in ml/.env', file=sys.stderr)
        sys.exit(1)

    random.seed(args.seed)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.resplit_only:
        resplit_pool(args.seed)
        return

    languages = LANGUAGES
    if args.languages:
        wanted = set(args.languages.split(','))
        languages = {k: v for k, v in LANGUAGES.items() if k in wanted}
        missing = wanted - languages.keys()
        if missing:
            print(f'unknown language code(s): {missing}', file=sys.stderr)
            sys.exit(1)

    combos = []
    for lang_code, lang_name in languages.items():
        for scenario in random.sample(SCENARIOS, min(args.scenarios_per_language, len(SCENARIOS))):
            participants = random.choice([2, 2, 2, 3, 4])
            length = random.choice([6, 10, 14, 20, 28])
            combos.append((lang_code, lang_name, scenario, participants, length))
    random.shuffle(combos)
    if args.max_combos:
        combos = combos[:args.max_combos]

    pool_added = 0
    print(f'Generating {len(combos)} synthetic conversations...', file=sys.stderr)
    for i, (lang_code, lang_name, scenario, participants, length) in enumerate(combos):
        print(f'[{i + 1}/{len(combos)}] {lang_code} / {scenario[:40]}...', file=sys.stderr)
        try:
            # A degenerate generation (e.g. every message empty after "Name:")
            # is an occasional teacher hiccup, not a systematic incompatibility
            # -- confirmed by hand for Korean, which failed once then
            # succeeded 3/3 immediately after on the same scenario. Retry
            # before giving up on the whole conversation.
            messages, question = [], None
            for parse_attempt in range(3):
                raw = generate_conversation(lang_name, scenario, participants, length)
                messages, question = parse_conversation(raw)
                if len(messages) >= 3:
                    break
                print(f'  parsed only {len(messages)} messages on attempt {parse_attempt + 1}/3, retrying', file=sys.stderr)
            if len(messages) < 3:
                print('  skipped: conversation generation kept failing to parse', file=sys.stderr)
                continue

            summary_prompt = build_summary_prompt(messages)
            summary = call_teacher_in_language(summary_prompt, lang_code, max_attempts=4)
            if summary:
                append_to_pool(make_example(summary_prompt, summary))
                pool_added += 1
            else:
                print('  dropped: summary never matched conversation language', file=sys.stderr)

            if question:
                qa_prompt = build_question_prompt(messages, question)
                answer = call_teacher_in_language(qa_prompt, lang_code, max_attempts=4)
                if answer:
                    append_to_pool(make_example(qa_prompt, answer))
                    pool_added += 1
                else:
                    print('  dropped: answer never matched conversation language', file=sys.stderr)
        except Exception as e:
            print(f'  FAILED: {e}', file=sys.stderr)
            continue

    print(f'Added {pool_added} examples to the pool this run.', file=sys.stderr)
    resplit_pool(args.seed)


if __name__ == '__main__':
    main()
