import { analyzeDataset, assertValidDataset, defaultJsonPath, loadDataset } from "./hymn-utils.mjs";

const jsonPath = process.argv[2] || defaultJsonPath;
const asJson = process.argv.includes("--json");

const { dataset, resolvedPath } = await loadDataset(jsonPath);
const analysis = analyzeDataset(dataset);

if (asJson) {
  console.log(JSON.stringify({ file: resolvedPath, ...analysis }, null, 2));
} else {
  console.log(`Validated ${resolvedPath}`);
  console.log(`Categories: ${analysis.totalCategories}`);
  console.log(`Hymns: ${analysis.totalHymns}`);
  console.log(`Duplicate category/number groups: ${analysis.duplicateNumberGroups.length}`);
  console.log(`Duplicate import keys: ${analysis.duplicateRecords.length}`);
  console.log(`Empty lyric records: ${analysis.emptyLyrics.length}`);

  for (const warning of analysis.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  for (const error of analysis.errors) {
    console.error(`Error: ${error}`);
  }
}

assertValidDataset(analysis);
