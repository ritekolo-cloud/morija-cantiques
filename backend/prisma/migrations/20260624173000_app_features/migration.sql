CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

CREATE TABLE "app_users" (
  "id" SERIAL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "refresh_tokens" (
  "id" SERIAL PRIMARY KEY,
  "token_hash" TEXT NOT NULL UNIQUE,
  "user_id" INTEGER NOT NULL REFERENCES "app_users"("id") ON DELETE CASCADE,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "favorites" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "app_users"("id") ON DELETE CASCADE,
  "hymn_id" INTEGER NOT NULL REFERENCES "hymns"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("user_id", "hymn_id")
);

CREATE TABLE "recent_hymns" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "app_users"("id") ON DELETE CASCADE,
  "hymn_id" INTEGER NOT NULL REFERENCES "hymns"("id") ON DELETE CASCADE,
  "view_count" INTEGER NOT NULL DEFAULT 1,
  "viewed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("user_id", "hymn_id")
);

CREATE TABLE "playlists" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "app_users"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_public" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "playlist_hymns" (
  "id" SERIAL PRIMARY KEY,
  "playlist_id" INTEGER NOT NULL REFERENCES "playlists"("id") ON DELETE CASCADE,
  "hymn_id" INTEGER NOT NULL REFERENCES "hymns"("id") ON DELETE CASCADE,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("playlist_id", "hymn_id")
);

CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "favorites_hymn_id_idx" ON "favorites"("hymn_id");
CREATE INDEX "recent_hymns_user_id_viewed_at_idx" ON "recent_hymns"("user_id", "viewed_at");
CREATE INDEX "recent_hymns_hymn_id_idx" ON "recent_hymns"("hymn_id");
CREATE INDEX "playlists_user_id_idx" ON "playlists"("user_id");
CREATE INDEX "playlist_hymns_hymn_id_idx" ON "playlist_hymns"("hymn_id");
