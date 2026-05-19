#!/usr/bin/env python3
"""inbox のメモを Gemini で要約し Workers API に投稿する。cron 用。"""

import glob
import json
import os
import urllib.request
from datetime import date

# 配置に合わせて変更（元ドキュメントは ~/diary/inbox）
INBOX_DIR = os.path.expanduser("~/diary/inbox")
WORKERS_API = "https://diary-worker.YOUR_SUBDOMAIN.workers.dev"
WORKERS_TOKEN = os.environ.get("DIARY_TOKEN")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")


def read_inbox():
    files = glob.glob(os.path.join(INBOX_DIR, "*.txt")) + glob.glob(
        os.path.join(INBOX_DIR, "*.md")
    )
    texts = []
    for f in sorted(files):
        with open(f, "r", encoding="utf-8") as fp:
            texts.append(fp.read())
    return "\n\n".join(texts)


def summarize_with_gemini(raw_text):
    prompt = f"""以下は今日のメモや会話ログです。
これを自然な日記エントリとして、Markdown形式でまとめてください。
箇条書きや見出しを使い、読みやすく整理してください。

---
{raw_text}
---

日記エントリ："""

    payload = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode()

    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode())
    return data["candidates"][0]["content"]["parts"][0]["text"]


def post_to_workers(content, entry_date):
    payload = json.dumps(
        {
            "date": entry_date,
            "content": content,
            "source": "cron",
        }
    ).encode()

    req = urllib.request.Request(
        f"{WORKERS_API}/diary",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {WORKERS_TOKEN}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())


def clear_inbox():
    for f in glob.glob(os.path.join(INBOX_DIR, "*")):
        os.remove(f)


def main():
    if not WORKERS_TOKEN:
        print("DIARY_TOKEN is not set.")
        return
    if not GEMINI_API_KEY:
        print("GEMINI_API_KEY is not set.")
        return

    raw = read_inbox()
    if not raw.strip():
        print("inbox empty, skipping.")
        return

    today = str(date.today())
    summary = summarize_with_gemini(raw)
    result = post_to_workers(summary, today)
    print(f"Posted: {result}")
    clear_inbox()


if __name__ == "__main__":
    main()
