import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import path from "node:path";
import { analyzeDataset, assertValidDataset, defaultJsonPath, loadDataset } from "./hymn-utils.mjs";

const prisma = new PrismaClient();
const jsonPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultJsonPath;
const chunkSize = Number.parseInt(process.env.IMPORT_CHUNK_SIZE || "500", 10);

const { dataset: payload, resolvedPath } = await loadDataset(jsonPath);
const analysis = analyzeDataset(payload);
assertValidDataset(analysis);

for (const warning of analysis.warnings) {
  console.warn(`Warning: ${warning}`);
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

const categoryCodes = payload.categories.map((category) => category.code);
const sourceIds = payload.hymns.map((hymn) => hymn.sourceId);

for (const category of payload.categories) {
  const data = {
    code: category.code,
    name: category.name,
    description: category.description,
    language: category.language,
    languageName: category.languageName,
    region: category.region,
    owner: category.owner,
    sourceOrder: category.sourceOrder,
    sourceDeclaredCount: category.sourceDeclaredCount,
    hymnCount: category.hymnCount,
  };

  await prisma.hymnCategory.upsert({
    where: { code: category.code },
    create: data,
    update: data,
  });
}

const categories = await prisma.hymnCategory.findMany({ select: { id: true, code: true } });
const categoryIdByCode = new Map(categories.map((category) => [category.code, category.id]));

for (const batch of chunks(payload.hymns, chunkSize)) {
  const values = batch.map((hymn) => Prisma.sql`(
    ${hymn.sourceId},
    ${hymn.sourceOrder},
    ${hymn.categoryOrder},
    ${categoryIdByCode.get(hymn.categoryCode)},
    ${hymn.categoryCode},
    ${hymn.number},
    ${hymn.numberNumeric},
    ${hymn.numberSuffix},
    ${hymn.duplicateIndex},
    ${hymn.title},
    ${hymn.gamme},
    ${hymn.author},
    ${hymn.lyrics ?? ""},
    ${JSON.stringify(hymn.lyricsLines ?? [])}::jsonb,
    ${JSON.stringify(hymn.verses ?? [])}::jsonb
  )`);

  await prisma.$executeRaw`
    INSERT INTO "hymns" (
      "source_id",
      "source_order",
      "category_order",
      "category_id",
      "category_code",
      "number",
      "number_numeric",
      "number_suffix",
      "duplicate_index",
      "title",
      "gamme",
      "author",
      "lyrics",
      "lyrics_lines",
      "verses"
    )
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("source_id") DO UPDATE SET
      "source_order" = EXCLUDED."source_order",
      "category_order" = EXCLUDED."category_order",
      "category_id" = EXCLUDED."category_id",
      "category_code" = EXCLUDED."category_code",
      "number" = EXCLUDED."number",
      "number_numeric" = EXCLUDED."number_numeric",
      "number_suffix" = EXCLUDED."number_suffix",
      "duplicate_index" = EXCLUDED."duplicate_index",
      "title" = EXCLUDED."title",
      "gamme" = EXCLUDED."gamme",
      "author" = EXCLUDED."author",
      "lyrics" = EXCLUDED."lyrics",
      "lyrics_lines" = EXCLUDED."lyrics_lines",
      "verses" = EXCLUDED."verses",
      "updated_at" = NOW()
  `;
}

await prisma.hymn.deleteMany({ where: { sourceId: { notIn: sourceIds } } });
await prisma.hymnCategory.deleteMany({ where: { code: { notIn: categoryCodes } } });

const [hymnCount, categoryCount] = await Promise.all([
  prisma.hymn.count(),
  prisma.hymnCategory.count(),
]);

console.log(`Imported ${hymnCount} hymns across ${categoryCount} categories from ${resolvedPath}`);
console.log(`Duplicate category/number groups handled: ${analysis.duplicateNumberGroups.length}`);
console.log(`Empty lyric records preserved: ${analysis.emptyLyrics.length}`);
await prisma.$disconnect();
