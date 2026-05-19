CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,          -- YYYY-MM-DD
  title TEXT,
  content TEXT NOT NULL,       -- Markdown
  source TEXT DEFAULT 'manual', -- 'manual' | 'cron' | 'email' | 'perplexity'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  entry_date TEXT,             -- YYYY-MM-DD
  r2_key TEXT NOT NULL,
  filename TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
