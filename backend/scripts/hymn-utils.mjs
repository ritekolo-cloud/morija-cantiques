import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const defaultJsonPath = path.resolve(__dirname, "../data/cantiques-hymns.json");

export async function loadDataset(jsonPath = defaultJsonPath) {
  const resolvedPath = path.resolve(jsonPath);
  const dataset = JSON.parse(await readFile(resolvedPath, "utf8"));
  return { dataset, resolvedPath };
}

export function analyzeDataset(dataset) {
  const errors = [];
  const warnings = [];
  const duplicateNumberGroups = new Map();
  const duplicateImportKeys = new Map();
  const sourceIds = new Set();
  const categoryCodes = new Set();
  const emptyLyrics = [];
  const categoryCounts = new Map();

  if (!dataset || typeof dataset !== "object") {
    return {
      valid: false,
      errors: ["Dataset root must be an object."],
      warnings,
      totalHymns: 0,
      totalCategories: 0,
      duplicateRecords: [],
      duplicateNumberGroups: [],
      emptyLyrics,
      categoryCounts: {},
    };
  }

  if (!Array.isArray(dataset.categories)) {
    errors.push("Dataset must include a categories array.");
  }

  if (!Array.isArray(dataset.hymns)) {
    errors.push("Dataset must include a hymns array.");
  }

  for (const [index, category] of (dataset.categories || []).entries()) {
    if (!category || typeof category !== "object") {
      errors.push(`Category at index ${index} must be an object.`);
      continue;
    }

    if (!category.code || typeof category.code !== "string") {
      errors.push(`Category at index ${index} is missing a string code.`);
      continue;
    }

    if (categoryCodes.has(category.code)) {
      errors.push(`Duplicate category code detected: ${category.code}`);
    }

    categoryCodes.add(category.code);
    categoryCounts.set(category.code, 0);
  }

  for (const [index, hymn] of (dataset.hymns || []).entries()) {
    if (!hymn || typeof hymn !== "object") {
      errors.push(`Hymn at index ${index} must be an object.`);
      continue;
    }

    const label = hymn.sourceId || `hymn index ${index}`;

    for (const field of ["sourceId", "categoryCode", "number", "title"]) {
      if (typeof hymn[field] !== "string" || hymn[field].length === 0) {
        errors.push(`${label} is missing required string field: ${field}`);
      }
    }

    if (sourceIds.has(hymn.sourceId)) {
      errors.push(`Duplicate sourceId detected: ${hymn.sourceId}`);
    }
    sourceIds.add(hymn.sourceId);

    if (hymn.categoryCode && !categoryCodes.has(hymn.categoryCode)) {
      errors.push(`${label} references unknown categoryCode: ${hymn.categoryCode}`);
    }

    if (!Number.isInteger(hymn.duplicateIndex) || hymn.duplicateIndex < 1) {
      errors.push(`${label} must have a positive integer duplicateIndex.`);
    }

    if (!Array.isArray(hymn.lyricsLines)) {
      errors.push(`${label} must include lyricsLines as an array.`);
    }

    if (!Array.isArray(hymn.verses)) {
      errors.push(`${label} must include verses as an array.`);
    }

    if (typeof hymn.lyrics !== "string") {
      errors.push(`${label} must include lyrics as a string, even when empty.`);
    } else if (hymn.lyrics.trim().length === 0) {
      emptyLyrics.push({
        sourceId: hymn.sourceId,
        categoryCode: hymn.categoryCode,
        number: hymn.number,
        title: hymn.title,
      });
    }

    if (hymn.categoryCode) {
      categoryCounts.set(hymn.categoryCode, (categoryCounts.get(hymn.categoryCode) || 0) + 1);
    }

    const numberGroupKey = `${hymn.categoryCode}|${hymn.number}`;
    if (!duplicateNumberGroups.has(numberGroupKey)) {
      duplicateNumberGroups.set(numberGroupKey, []);
    }
    duplicateNumberGroups.get(numberGroupKey).push(hymn);

    const importKey = `${hymn.categoryCode}|${hymn.number}|${hymn.duplicateIndex}`;
    if (!duplicateImportKeys.has(importKey)) {
      duplicateImportKeys.set(importKey, []);
    }
    duplicateImportKeys.get(importKey).push(hymn.sourceId);
  }

  const duplicateRecords = [...duplicateImportKeys.entries()]
    .filter(([, sourceIdsForKey]) => sourceIdsForKey.length > 1)
    .map(([key, sourceIdsForKey]) => ({ key, sourceIds: sourceIdsForKey }));

  if (duplicateRecords.length > 0) {
    for (const duplicate of duplicateRecords) {
      errors.push(`Duplicate import key detected: ${duplicate.key}`);
    }
  }

  const duplicateNumberReport = [...duplicateNumberGroups.entries()]
    .filter(([, hymns]) => hymns.length > 1)
    .map(([key, hymns]) => {
      const [categoryCode, number] = key.split("|");
      return {
        categoryCode,
        number,
        count: hymns.length,
        records: hymns.map((hymn) => ({
          sourceId: hymn.sourceId,
          duplicateIndex: hymn.duplicateIndex,
          title: hymn.title,
        })),
      };
    });

  if (duplicateNumberReport.length > 0) {
    warnings.push(`${duplicateNumberReport.length} duplicate category/number group(s) detected and handled with duplicateIndex.`);
  }

  if (emptyLyrics.length > 0) {
    warnings.push(`${emptyLyrics.length} empty lyric record(s) detected and preserved as empty strings.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalHymns: Array.isArray(dataset.hymns) ? dataset.hymns.length : 0,
    totalCategories: Array.isArray(dataset.categories) ? dataset.categories.length : 0,
    duplicateRecords,
    duplicateNumberGroups: duplicateNumberReport,
    emptyLyrics,
    categoryCounts: Object.fromEntries([...categoryCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
}

export function assertValidDataset(analysis) {
  if (analysis.valid) {
    return;
  }

  const message = [
    "Hymn dataset validation failed.",
    ...analysis.errors.map((error) => `- ${error}`),
  ].join("\n");

  throw new Error(message);
}
