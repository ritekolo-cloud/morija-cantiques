#!/usr/bin/env ts-node
/**
 * Morija-Cantiques APK Extractor
 * ================================
 * Extracts hymn data from an Android APK file.
 *
 * The extractor tries three strategies in order:
 *   1. SQLite database (assets/*.db, databases/*.db)
 *   2. XML string resources (res/values/strings.xml, res/raw/*.xml)
 *   3. JSON assets (assets/*.json)
 *
 * Usage:
 *   pnpm --filter import run extract -- --apk ./path/to/hymns.apk --out ./data/raw
 */

import AdmZip from "adm-zip";
import * as fs from "fs";
import * as path from "path";
import { parseArgs } from "util";
import Database from "better-sqlite3";
import { XMLParser } from "fast-xml-parser";
import ora from "ora";
import chalk from "chalk";

// ─── CLI Args ───────────────────────────────────────────────
const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    apk:  { type: "string", short: "a" },
    out:  { type: "string", short: "o", default: "./data/raw" },
    help: { type: "boolean", short: "h" },
  },
});

if (args.help || !args.apk) {
  console.log(`
${chalk.yellow("Morija-Cantiques APK Extractor")}

Usage:
  ts-node src/extractor.ts --apk <path-to-apk> [--out <output-dir>]

Options:
  --apk, -a   Path to the APK file (required)
  --out, -o   Output directory for extracted files (default: ./data/raw)
  --help, -h  Show this help
  `);
  process.exit(args.help ? 0 : 1);
}

const APK_PATH = path.resolve(args.apk!);
const OUT_DIR  = path.resolve(args.out!);

if (!fs.existsSync(APK_PATH)) {
  console.error(chalk.red(`APK not found: ${APK_PATH}`));
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── Types ──────────────────────────────────────────────────
export interface RawHymn {
  number:     number;
  title:      string;
  lyrics:     string;         // raw text
  collection: string;
  language?:  string;
}

export interface ExtractResult {
  strategy: "sqlite" | "xml" | "json" | "unknown";
  collections: Record<string, RawHymn[]>;
  totalHymns:  number;
}

// ─── Main ───────────────────────────────────────────────────
async function extract(): Promise<void> {
  const spinner = ora(`Opening APK: ${chalk.cyan(APK_PATH)}`).start();

  let zip: AdmZip;
  try {
    zip = new AdmZip(APK_PATH);
  } catch (err) {
    spinner.fail("Failed to open APK file");
    throw err;
  }

  const entries = zip.getEntries();
  spinner.succeed(`Opened APK — ${entries.length} entries found`);

  // List all entry names for inspection
  const entryNames = entries.map((e) => e.entryName);
  fs.writeFileSync(path.join(OUT_DIR, "apk-entries.txt"), entryNames.join("\n"));
  console.log(chalk.gray(`  APK entry list → ${path.join(OUT_DIR, "apk-entries.txt")}`));

  let result: ExtractResult | null = null;

  // ── Strategy 1: SQLite ────────────────────────────────────
  result = await trySQLite(zip, entries, OUT_DIR);
  if (result) {
    await saveResult(result, OUT_DIR);
    return;
  }

  // ── Strategy 2: XML ───────────────────────────────────────
  result = await tryXML(zip, entries, OUT_DIR);
  if (result) {
    await saveResult(result, OUT_DIR);
    return;
  }

  // ── Strategy 3: JSON assets ───────────────────────────────
  result = await tryJSON(zip, entries, OUT_DIR);
  if (result) {
    await saveResult(result, OUT_DIR);
    return;
  }

  // ── Fallback: dump all assets for manual inspection ────────
  console.log(chalk.yellow("\n⚠  Could not auto-detect hymn format. Dumping all assets for inspection..."));
  dumpAssets(zip, entries, OUT_DIR);
  console.log(chalk.yellow(`   Inspect files in: ${OUT_DIR}`));
  console.log(chalk.yellow("   Then update parser.ts with the correct strategy."));
}

// ─── Strategy 1: SQLite ─────────────────────────────────────
async function trySQLite(
  zip: AdmZip,
  entries: AdmZip.IZipEntry[],
  outDir: string
): Promise<ExtractResult | null> {
  const spinner = ora("Strategy 1: Looking for SQLite database...").start();

  const dbEntries = entries.filter(
    (e) =>
      (e.entryName.endsWith(".db") || e.entryName.endsWith(".sqlite")) &&
      !e.entryName.includes("__MACOSX")
  );

  if (dbEntries.length === 0) {
    spinner.info("No SQLite databases found");
    return null;
  }

  spinner.text = `Found ${dbEntries.length} database(s): ${dbEntries.map((e) => e.entryName).join(", ")}`;

  const result: ExtractResult = {
    strategy: "sqlite",
    collections: {},
    totalHymns: 0,
  };

  for (const dbEntry of dbEntries) {
    const dbPath = path.join(outDir, path.basename(dbEntry.entryName));
    zip.extractEntryTo(dbEntry, outDir, false, true);

    let db: Database.Database;
    try {
      db = new Database(dbPath, { readonly: true });
    } catch {
      continue;
    }

    // Inspect tables
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];

    fs.writeFileSync(
      path.join(outDir, `${path.basename(dbPath)}-tables.json`),
      JSON.stringify(tables, null, 2)
    );

    // Try common hymn table names
    const hymnTableCandidates = ["hymns", "songs", "cantiques", "nyimbo", "psalm", "verses", "items"];
    for (const tbl of hymnTableCandidates) {
      if (!tables.find((t) => t.name.toLowerCase() === tbl.toLowerCase())) continue;

      const cols = (
        db.prepare(`PRAGMA table_info(${tbl})`).all() as { name: string }[]
      ).map((c) => c.name);

      fs.writeFileSync(
        path.join(outDir, `${tbl}-columns.json`),
        JSON.stringify(cols, null, 2)
      );

      // Try to read all rows
      const rows = db.prepare(`SELECT * FROM ${tbl} LIMIT 5000`).all() as Record<string, unknown>[];
      if (rows.length === 0) continue;

      // Map to RawHymn
      const hymns = rows.map((row, i) => mapRowToHymn(row, i, cols));
      const collName = detectCollectionFromDb(dbEntry.entryName);
      result.collections[collName] = hymns;
      result.totalHymns += hymns.length;
    }

    db.close();
  }

  if (result.totalHymns === 0) {
    spinner.info("SQLite databases found but no hymn tables detected");
    return null;
  }

  spinner.succeed(`SQLite: Extracted ${chalk.green(result.totalHymns)} hymns`);
  return result;
}

function mapRowToHymn(row: Record<string, unknown>, index: number, cols: string[]): RawHymn {
  const numberCol  = cols.find((c) => /num|no|numb|order|id/.test(c.toLowerCase())) ?? cols[0];
  const titleCol   = cols.find((c) => /title|name|titre|jina/.test(c.toLowerCase())) ?? cols[1];
  const lyricsCol  = cols.find((c) => /lyric|text|content|parole|maneno|stanza|verse|body/.test(c.toLowerCase())) ?? cols[2];
  const collCol    = cols.find((c) => /collection|book|category|categorie/.test(c.toLowerCase()));

  return {
    number:     Number(row[numberCol]) || index + 1,
    title:      String(row[titleCol] ?? `Hymn ${index + 1}`),
    lyrics:     String(row[lyricsCol] ?? ""),
    collection: String(row[collCol!] ?? "Unknown"),
  };
}

function detectCollectionFromDb(entryName: string): string {
  const base = path.basename(entryName, path.extname(entryName));
  return base.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Strategy 2: XML ────────────────────────────────────────
async function tryXML(
  zip: AdmZip,
  entries: AdmZip.IZipEntry[],
  outDir: string
): Promise<ExtractResult | null> {
  const spinner = ora("Strategy 2: Looking for XML hymn data...").start();

  const xmlEntries = entries.filter(
    (e) =>
      e.entryName.endsWith(".xml") &&
      (e.entryName.includes("res/values") || e.entryName.includes("res/raw") || e.entryName.includes("assets"))
  );

  if (xmlEntries.length === 0) {
    spinner.info("No relevant XML files found");
    return null;
  }

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const result: ExtractResult = {
    strategy: "xml",
    collections: {},
    totalHymns: 0,
  };

  for (const xmlEntry of xmlEntries) {
    const content = zip.readAsText(xmlEntry);
    const xmlDir  = path.join(outDir, "xml");
    fs.mkdirSync(xmlDir, { recursive: true });
    fs.writeFileSync(path.join(xmlDir, xmlEntry.entryName.replace(/\//g, "_")), content);

    let parsed: unknown;
    try {
      parsed = parser.parse(content);
    } catch {
      continue;
    }

    // Try to extract hymns from various XML structures
    const hymns = extractHymnsFromXML(parsed);
    if (hymns.length > 0) {
      const collName = path.basename(xmlEntry.entryName, ".xml");
      result.collections[collName] = hymns;
      result.totalHymns += hymns.length;
    }
  }

  if (result.totalHymns === 0) {
    spinner.info("XML files found but no hymn data extracted");
    return null;
  }

  spinner.succeed(`XML: Extracted ${chalk.green(result.totalHymns)} hymns`);
  return result;
}

function extractHymnsFromXML(obj: unknown): RawHymn[] {
  const hymns: RawHymn[] = [];

  function walk(node: unknown, depth = 0): void {
    if (depth > 10 || !node || typeof node !== "object") return;

    const o = node as Record<string, unknown>;

    // Look for hymn/song arrays
    for (const key of Object.keys(o)) {
      const val = o[key];
      if (Array.isArray(val) && val.length > 0) {
        const first = val[0] as Record<string, unknown>;
        if (first && (first["title"] || first["titre"] || first["name"] || first["text"] || first["lyric"])) {
          val.forEach((item: Record<string, unknown>, i: number) => {
            hymns.push({
              number:     Number(item["number"] ?? item["num"] ?? item["id"] ?? i + 1),
              title:      String(item["title"] ?? item["titre"] ?? item["name"] ?? `Hymn ${i + 1}`),
              lyrics:     String(item["text"] ?? item["lyric"] ?? item["content"] ?? item["paroles"] ?? ""),
              collection: "Unknown",
            });
          });
        }
      } else {
        walk(val, depth + 1);
      }
    }
  }

  walk(obj);
  return hymns;
}

// ─── Strategy 3: JSON assets ────────────────────────────────
async function tryJSON(
  zip: AdmZip,
  entries: AdmZip.IZipEntry[],
  outDir: string
): Promise<ExtractResult | null> {
  const spinner = ora("Strategy 3: Looking for JSON hymn data...").start();

  const jsonEntries = entries.filter(
    (e) => e.entryName.endsWith(".json") && !e.entryName.includes("__MACOSX")
  );

  if (jsonEntries.length === 0) {
    spinner.info("No JSON assets found");
    return null;
  }

  const result: ExtractResult = {
    strategy: "json",
    collections: {},
    totalHymns: 0,
  };

  const jsonDir = path.join(outDir, "json");
  fs.mkdirSync(jsonDir, { recursive: true });

  for (const jsonEntry of jsonEntries) {
    const content = zip.readAsText(jsonEntry);
    fs.writeFileSync(path.join(jsonDir, jsonEntry.entryName.replace(/\//g, "_")), content);

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      continue;
    }

    const hymns = extractHymnsFromJSON(parsed);
    if (hymns.length > 0) {
      const collName = path.basename(jsonEntry.entryName, ".json");
      result.collections[collName] = hymns;
      result.totalHymns += hymns.length;
    }
  }

  if (result.totalHymns === 0) {
    spinner.info("JSON files found but no hymn data extracted");
    return null;
  }

  spinner.succeed(`JSON: Extracted ${chalk.green(result.totalHymns)} hymns`);
  return result;
}

function extractHymnsFromJSON(data: unknown): RawHymn[] {
  if (!data) return [];

  const tryArray = (arr: unknown[]): RawHymn[] => {
    return arr
      .filter((item) => item && typeof item === "object")
      .map((item: unknown, i: number) => {
        const o = item as Record<string, unknown>;
        return {
          number:     Number(o["number"] ?? o["num"] ?? o["songNumber"] ?? o["id"] ?? i + 1),
          title:      String(o["title"] ?? o["titre"] ?? o["name"] ?? o["jina"] ?? `Hymn ${i + 1}`),
          lyrics:     String(o["lyrics"] ?? o["lyric"] ?? o["text"] ?? o["content"] ?? o["paroles"] ?? o["maneno"] ?? ""),
          collection: String(o["collection"] ?? o["book"] ?? o["category"] ?? "Unknown"),
        };
      });
  };

  if (Array.isArray(data)) return tryArray(data);

  const obj = data as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (Array.isArray(val) && val.length > 0) {
      const hymns = tryArray(val);
      if (hymns.length > 0) return hymns;
    }
  }

  return [];
}

// ─── Dump all assets ────────────────────────────────────────
function dumpAssets(
  zip: AdmZip,
  entries: AdmZip.IZipEntry[],
  outDir: string
): void {
  const dumpDir = path.join(outDir, "dump");
  fs.mkdirSync(dumpDir, { recursive: true });

  const assetsAndRes = entries.filter(
    (e) =>
      (e.entryName.startsWith("assets/") || e.entryName.startsWith("res/raw/")) &&
      !e.entryName.endsWith("/")
  );

  for (const entry of assetsAndRes) {
    const destPath = path.join(dumpDir, entry.entryName.replace(/\//g, "_"));
    try {
      fs.writeFileSync(destPath, zip.readFile(entry) ?? Buffer.alloc(0));
    } catch {
      // skip binary files that fail
    }
  }
}

// ─── Save result ────────────────────────────────────────────
async function saveResult(result: ExtractResult, outDir: string): Promise<void> {
  const outFile = path.join(outDir, "extracted-hymns.json");
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(chalk.green(`\n✓ Extraction complete`));
  console.log(`  Strategy : ${chalk.cyan(result.strategy)}`);
  console.log(`  Collections: ${chalk.cyan(Object.keys(result.collections).length)}`);
  console.log(`  Total Hymns: ${chalk.cyan(result.totalHymns)}`);
  console.log(`  Output   : ${chalk.cyan(outFile)}`);
  console.log(`\nNext step: ${chalk.yellow("pnpm --filter import run parse")}`);
}

// ─── Run ────────────────────────────────────────────────────
extract().catch((err) => {
  console.error(chalk.red("Extraction failed:"), err);
  process.exit(1);
});
