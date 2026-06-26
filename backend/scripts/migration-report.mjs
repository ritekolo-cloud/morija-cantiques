import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeDataset, defaultJsonPath, loadDataset } from "./hymn-utils.mjs";

const prisma = new PrismaClient();
const jsonPath = process.argv[2] || defaultJsonPath;
const reportPath = path.resolve("reports/migration-report.json");

const { dataset, resolvedPath } = await loadDataset(jsonPath);
const analysis = analyzeDataset(dataset);

try {
  const [totalHymnsImported, totalCategoriesImported, dbCategoryCounts] = await Promise.all([
    prisma.hymn.count(),
    prisma.hymnCategory.count(),
    prisma.hymn.groupBy({
      by: ["categoryCode"],
      _count: { _all: true },
      orderBy: { categoryCode: "asc" },
    }),
  ]);

  const categoryCounts = Object.fromEntries(
    dbCategoryCounts.map((row) => [row.categoryCode, row._count._all]),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    datasetFile: resolvedPath,
    totalHymnsImported,
    totalCategoriesImported,
    duplicateRecordsDetected: analysis.duplicateNumberGroups,
    duplicateImportKeys: analysis.duplicateRecords,
    emptyLyricRecords: analysis.emptyLyrics,
    categoryCounts,
    validationWarnings: analysis.warnings,
    validationErrors: analysis.errors,
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Migration report written to ${reportPath}`);
  console.log(`Total hymns imported: ${report.totalHymnsImported}`);
  console.log(`Duplicate records detected: ${report.duplicateRecordsDetected.length}`);
  console.log(`Empty lyric records: ${report.emptyLyricRecords.length}`);
  console.log("Category counts:");
  for (const [categoryCode, count] of Object.entries(categoryCounts)) {
    console.log(`- ${categoryCode}: ${count}`);
  }
} finally {
  await prisma.$disconnect();
}
