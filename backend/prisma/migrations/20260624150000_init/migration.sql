CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "hymn_categories" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "language" TEXT,
  "language_name" TEXT,
  "region" TEXT,
  "owner" TEXT,
  "source_order" INTEGER NOT NULL,
  "source_declared_count" INTEGER,
  "hymn_count" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "hymns" (
  "id" SERIAL PRIMARY KEY,
  "source_id" TEXT NOT NULL UNIQUE,
  "source_order" INTEGER NOT NULL,
  "category_order" INTEGER NOT NULL,
  "category_id" INTEGER NOT NULL REFERENCES "hymn_categories"("id") ON DELETE CASCADE,
  "category_code" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "number_numeric" INTEGER,
  "number_suffix" TEXT,
  "duplicate_index" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL,
  "gamme" TEXT,
  "author" TEXT,
  "lyrics" TEXT NOT NULL,
  "lyrics_lines" JSONB NOT NULL,
  "verses" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "hymns_category_number_duplicate_key" UNIQUE ("category_id", "number", "duplicate_index")
);

CREATE INDEX "hymns_number_idx" ON "hymns"("number");
CREATE INDEX "hymns_title_idx" ON "hymns"("title");
CREATE INDEX "hymns_category_id_idx" ON "hymns"("category_id");
CREATE INDEX "hymns_category_code_idx" ON "hymns"("category_code");
CREATE INDEX "hymns_category_number_idx" ON "hymns"("category_id", "number_numeric", "number_suffix");
CREATE INDEX "hymns_title_trgm_idx" ON "hymns" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "hymns_full_text_idx" ON "hymns" USING GIN (
  to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("lyrics", ''))
);
