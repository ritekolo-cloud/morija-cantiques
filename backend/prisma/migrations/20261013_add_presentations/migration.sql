CREATE TYPE "PresentationSharePermission" AS ENUM ('VIEW', 'EDIT');

CREATE TABLE "presentations" (
  "id" TEXT NOT NULL,
  "owner_id" INTEGER NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "document" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "presentations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "presentation_versions" (
  "id" TEXT NOT NULL,
  "presentation_id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "author_id" INTEGER NOT NULL,
  "document" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "presentation_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "presentation_shares" (
  "id" TEXT NOT NULL,
  "presentation_id" TEXT NOT NULL,
  "recipient_id" INTEGER NOT NULL,
  "permission" "PresentationSharePermission" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "presentation_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "presentation_versions_presentation_id_revision_key" ON "presentation_versions"("presentation_id", "revision");
CREATE UNIQUE INDEX "presentation_shares_presentation_id_recipient_id_key" ON "presentation_shares"("presentation_id", "recipient_id");
CREATE INDEX "presentations_owner_id_updated_at_idx" ON "presentations"("owner_id", "updated_at");
CREATE INDEX "presentation_versions_presentation_id_created_at_idx" ON "presentation_versions"("presentation_id", "created_at");
CREATE INDEX "presentation_shares_recipient_id_idx" ON "presentation_shares"("recipient_id");

ALTER TABLE "presentations" ADD CONSTRAINT "presentations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "presentation_versions" ADD CONSTRAINT "presentation_versions_presentation_id_fkey" FOREIGN KEY ("presentation_id") REFERENCES "presentations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "presentation_versions" ADD CONSTRAINT "presentation_versions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "presentation_shares" ADD CONSTRAINT "presentation_shares_presentation_id_fkey" FOREIGN KEY ("presentation_id") REFERENCES "presentations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "presentation_shares" ADD CONSTRAINT "presentation_shares_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "presentation_assets" (
  "id" TEXT NOT NULL,
  "presentation_id" TEXT NOT NULL,
  "owner_id" INTEGER NOT NULL,
  "storage_key" TEXT NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "size" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "presentation_assets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "presentation_assets_storage_key_key" ON "presentation_assets"("storage_key");
CREATE INDEX "presentation_assets_presentation_id_idx" ON "presentation_assets"("presentation_id");
CREATE INDEX "presentation_assets_owner_id_idx" ON "presentation_assets"("owner_id");
ALTER TABLE "presentation_assets" ADD CONSTRAINT "presentation_assets_presentation_id_fkey" FOREIGN KEY ("presentation_id") REFERENCES "presentations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "presentation_assets" ADD CONSTRAINT "presentation_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;