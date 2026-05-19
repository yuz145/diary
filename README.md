# 個人日記アプリ

Cloudflare Workers + D1 + R2 と単一 HTML クライアントで構成する個人用日記です。ダッシュボードのバインディング名は **D1: `diaryD1`**、**R2: `diaryR2`**、ログインは Variables の **`pass`**（プレーンテキスト）に合わせています。

## リポジトリ構成

| パス | 内容 |
|------|------|
| `HANDOFF.md` | Cursor 引き継ぎ・運用手順 |
| `schema.sql` | D1 スキーマ |
| `wrangler.toml` | Worker / D1 / R2（`database_id` を自分の UUID に） |
| `src/worker.js` | REST API・`env.diaryD1` / `env.diaryR2` / `env.pass` |
| `/index.html` | フロント（**ルート**。デプロイ前に `static/` へコピー） |
| `/diary-config.json` | `apiBaseUrl`（**Pages のときは Worker の URL が必須**） |
| `static/` | Worker `[assets]` 用（`npm run sync-static`） |
| `scripts/diary-gen.py` | Ubuntu cron 用 |
| `docs/PRODUCTION.md` | 本番: D1 / R2 / `pass` / `JWT_SECRET` |
| `docs/EMAIL_ROUTING.md` | **`diary-email` + メールルート + 確認手順（任意）** |

## Cloudflare ダッシュボードとコードの対応

| ダッシュボード | コード・wrangler |
|----------------|------------------|
| バインディング D1 名 **`diaryD1`** | `env.diaryD1`、`[[d1_databases]].binding` |
| バインディング R2 名 **`diaryR2`**、バケット **`diary-media`** | `env.diaryR2`、`[[r2_buckets]]` |
| 変数 **`pass`**（プレーン） | ログイン `/auth/login` で入力と照合 |
| シークレット **`JWT_SECRET`** | JWT 署名 |

詳細は **`docs/PRODUCTION.md`**。

## R2・Pages と Worker の URL

- **フロントと API が同じ Worker**（`*.workers.dev` で開く）なら、`diary-config.json` の **`apiBaseUrl` は空のまま**、`sameOrigin` 未設定でも同一オリジンに向きます。
- **Cloudflare Pages**（`*.pages.dev`）だけでフロントを出している場合、API は **別 URL の Worker** なので、`diary-config.json` に **`apiBaseUrl`: `https://（Worker名）.workers.dev`** を書いて push・再デプロイしてください。

```json
{
  "apiBaseUrl": "https://あなたのWorker.サブドメイン.workers.dev",
  "sameOrigin": false
}
```

## ローカルで API を試す

```bash
npm run dev
```

`wrangler dev` が Worker を起動します。`.dev.vars.example` → `.dev.vars` に `pass` と `JWT_SECRET` を書いてください。

## デプロイ

```bash
npm run deploy
```

（内部で `sync-static` のあと `wrangler deploy`。`database_id` がプレースホルダーのままだと **code 10021** で失敗します。）

## クイックセットアップ

1. D1 を作成し **`wrangler.toml` の `database_id`** を UUID に。
2. `wrangler d1 execute （database_name） --remote --file=schema.sql`
3. ダッシュボード: **`pass`**、**`JWT_SECRET`**（Secret）、バインディング **`diaryD1`** / **`diaryR2`**
4. Pages 利用時は **`diary-config.json` の `apiBaseUrl`**

## メール経由で日記に取り込む

**詳細チェックリストは `docs/EMAIL_ROUTING.md`。** 概要だけ:

- **Pages のプロジェクト `diary` がメールの宛先一覧に出ない**ことがある。その場合 **`oyuzen.com` で Email Routing 用 Worker（例: `diary-email`）を作り、変数名 `diaryD1` で本番 D1 と同じ DB に書く**。サイト用 Git の環境変数は **増やさなくていい**。
- **自分でコピペ**だけなら、メール本文を編集画面に貼って保存でもよい。
- **Perplexity API（有料）は不要**。転送先を **`diary@（あなたのドメイン）`** に設定する。

## ライセンス

個人利用を想定しています。
