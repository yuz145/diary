# 個人日記アプリ

Cloudflare Workers + D1 + R2 と Pages 単一 HTML クライアントで構成する個人用日記です。

## リポジトリ構成

| パス | 内容 |
|------|------|
| `HANDOFF.md` | Cursor 引き継ぎ・運用手順の詳細 |
| `schema.sql` | D1 スキーマ |
| `wrangler.toml` | Worker / D1 / R2 バインディング（プレースホルダーを置換） |
| `src/worker.js` | REST API と Email ハンドラ |
| `diary-app/diary-config.json` | API のベース URL（`YOUR_SUBDOMAIN` を差し替え、`?api=` が最優先） |
| `diary-app/index.html` | Pages 用フロントエンド |
| `scripts/diary-gen.py` | Ubuntu cron 用：inbox → Gemini → POST `/diary` |

## ローカルでホーム画面を表示

リポジトリ直下で次を実行します（Python 3 のみ使用、`diary-app` を静的配信します）。

```bash
npm run dev
```

ブラウザで **http://127.0.0.1:5173/** を開くと、ログイン画面（ホーム）が表示されます。

- API 未デプロイでも画面枠だけ見たい場合：`http://127.0.0.1:5173?preview=1`
- 別 URL の Worker を試す場合：`?api=https://あなたのworker.workers.dev`

## クイックセットアップ

`HANDOFF.md` の「8. セットアップ順序」に従ってください。デプロイ前に次を必ず置換してください。

- `YOUR_SUBDOMAIN`（Workers URL）
- `YOUR_D1_DATABASE_ID`
- `JWT_SECRET` / `ADMIN_PASSWORD_HASH`（`verifyPassword` は平文の SHA-256 16進と比較。開発用は `wrangler.toml` で `"test"` のハッシュを入れてある。本番は Cloudflare の Variables / Secrets で上書き）
- `diary-app/diary-config.json` の `apiBaseUrl`（または `?api=`。プレースホルダーのままならパスワード `test` は表示のみログイン）
- 任意：`EMAIL_SECRET` を `wrangler secret put EMAIL_SECRET` で設定（`/diary/inbound-email` 用）

## ライセンス

個人利用を想定しています。
