#!/usr/bin/env ts-node
/**
 * Morija-Cantiques Hymn Parser
 * =============================
 * Converts raw extracted hymn data into structured JSON
 * that matches the Prisma Song model.
 *
 * Input:  ./data/raw/extracted-hymns.json  (from extractor.ts)
 * Output: ./data/parsed/hymns.json
 *
 * Usage:
 *   pnpm --filter import run parse
 */

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import type { ExtractResult, RawHymn } from "./extractor.js";

// ─── Types ──────────────────────────────────────────────────
export interface SongSection {
  type:  "verse" | "chorus" | "bridge" | "outro" | "intro";
  label: string;
  lines: string[];
}

export interface ParsedHymn {
  songNumber:  number;
  title:       string;
  sections:    SongSection[];
  lyricsRaw:   string;        // original unformatted
  collection:  string;        // collection slug
  language?:   string;
  keySignature?: string;
}

export interface ParsedOutput {
  version:     string;
  parsedAt:    string;
  totalHymns:  number;
  collections: Record<string, ParsedHymn[]>;
}

// ─── Collection slug map ─────────────────────────────────────
const COLLECTION_SLUGS: Record<string, string> = {
  "only believe":              "only-believe",
  "only_believe":              "only-believe",
  "crois seulement":           "crois-seulement",
  "crois_seulement":           "crois-seulement",
  "hosanna":                   "hosanna",
  "autres cantiques":          "autres-cantiques",
  "autres_cantiques":          "autres-cantiques",
  "collection de cantiques":   "collection-de-cantiques",
  "chant de victoire":         "chant-de-victoire",
  "chant_de_victoire":         "chant-de-victoire",
  "nyimbo za mungu":           "nyimbo-za-mungu",
  "nyimbo_za_mungu":           "nyimbo-za-mungu",
  "nyimbo za wokovu":          "nyimbo-za-wokovu",
  "nyimbo_za_wokovu":          "nyimbo-za-wokovu",
  "roc seculaire":             "roc-seculaire",
  "roc_seculaire":             "roc-seculaire",
  "quel temps glorieux":       "quel-temps-glorieux",
  "quel_temps_glorieux":       "quel-temps-glorieux",
  "sacred songs and solos":    "sacred-songs-and-solos",
  "sacred_songs_and_solos":    "sacred-songs-and-solos",
  "only believe 2":            "only-believe-2",
  "only believe-2":            "only-believe-2",
  "only_believe_2":            "only-believe-2",
  "roc seculaire paris 2":     "roc-seculaire-paris-2",
  "roc seculaire paris-2":     "roc-seculaire-paris-2",
};

const LANGUAGE_MAP: Record<string, string> = {
  "only-believe":            "English",
  "hosanna":                 "English",
  "sacred-songs-and-solos":  "English",
  "only-believe-2":          "English",
  "crois-seulement":         "French",
  "autres-cantiques":        "French",
  "collection-de-cantiques": "French",
  "chant-de-victoire":       "French",
  "roc-seculaire":           "French",
  "quel-temps-glorieux":     "French",
  "roc-seculaire-paris-2":   "French",
  "nyimbo-za-mungu":         "Kiswahili",
  "nyimbo-za-wokovu":        "Kiswahili",
};

// ─── Main ───────────────────────────────────────────────────
async function parse(): Promise<void> {
  const inputFile  = path.resolve("./data/raw/extracted-hymns.json");
  const outputDir  = path.resolve("./data/parsed");
  const outputFile = path.join(outputDir, "hymns.json");

  if (!fs.existsSync(inputFile)) {
    console.error(chalk.red(`Input file not found: ${inputFile}`));
    console.error(chalk.yellow("Run extractor first: pnpm --filter import run extract -- --apk path/to/hymns.apk"));
    process.exit(1);
  }

  const spinner = ora("Parsing extracted hymn data...").start();
  fs.mkdirSync(outputDir, { recursive: true });

  const raw = JSON.parse(fs.readFileSync(inputFile, "utf8")) as ExtractResult;

  const output: ParsedOutput = {
    version:     "1.0.0",
    parsedAt:    new Date().toISOString(),
    totalHymns:  0,
    collections: {},
  };

  for (const [collectionName, hymns] of Object.entries(raw.collections)) {
    const slug = resolveSlug(collectionName);
    const language = LANGUAGE_MAP[slug] ?? "Unknown";

    const parsedHymns: ParsedHymn[] = hymns.map((hymn) =>
      parseHymn(hymn, slug, language)
    );

    // Sort by hymn number
    parsedHymns.sort((a, b) => a.songNumber - b.songNumber);

    output.collections[slug] = parsedHymns;
    output.totalHymns += parsedHymns.length;
  }

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

  spinner.succeed(`Parsed ${chalk.green(output.totalHymns)} hymns across ${chalk.cyan(Object.keys(output.collections).length)} collections`);
  console.log(`  Output: ${chalk.cyan(outputFile)}`);
  console.log(`\nNext step: ${chalk.yellow("pnpm --filter import run seed")}`);
}

// ─── Helpers ────────────────────────────────────────────────
function resolveSlug(name: string): string {
  const lower = name.toLowerCase().trim();
  return COLLECTION_SLUGS[lower] ?? lower.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function parseHymn(raw: RawHymn, collectionSlug: string, language: string): ParsedHymn {
  return {
    songNumber:  raw.number,
    title:       cleanTitle(raw.title),
    sections:    parseLyrics(raw.lyrics),
    lyricsRaw:   raw.lyrics,
    collection:  collectionSlug,
    language,
  };
}

function cleanTitle(title: string): string {
  return title
    .trim()
    .replace(/^\d+[\.\-\s]+/, "")   // Remove leading number
    .replace(/\s+/g, " ")
    .trim();
}

function parseLyrics(raw: string): SongSection[] {
  if (!raw || raw.trim() === "") return [];

  const sections: SongSection[] = [];
  const lines = raw.split(/\r?\n/);

  let currentSection: SongSection | null = null;
  let verseCount = 0;
  let chorusCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Detect section headers
    const isVerseHeader  = /^(verse|stanza|couplet|mstari|msitari)\s*(\d*)/i.test(line);
    const isChorusHeader = /^(chorus|refrain|kiitikio|refren)/i.test(line);
    const isBridgeHeader = /^(bridge|pont)/i.test(line);
    const isOutroHeader  = /^(outro|fin|mwisho)/i.test(line);

    if (isVerseHeader) {
      if (currentSection) sections.push(currentSection);
      verseCount++;
      currentSection = {
        type:  "verse",
        label: getVerseLabel(line, verseCount, "verse"),
        lines: [],
      };
    } else if (isChorusHeader) {
      if (currentSection) sections.push(currentSection);
      chorusCount++;
      currentSection = {
        type:  "chorus",
        label: getVerseLabel(line, chorusCount, "chorus"),
        lines: [],
      };
    } else if (isBridgeHeader) {
      if (currentSection) sections.push(currentSection);
      currentSection = { type: "bridge", label: "Bridge", lines: [] };
    } else if (isOutroHeader) {
      if (currentSection) sections.push(currentSection);
      currentSection = { type: "outro", label: "Outro", lines: [] };
    } else if (line === "") {
      // Blank line = potential section break
      if (currentSection && currentSection.lines.length > 0) {
        sections.push(currentSection);
        currentSection = null;
      }
    } else {
      // Regular lyric line
      if (!currentSection) {
        // No header detected yet - start a verse
        verseCount++;
        currentSection = {
          type:  verseCount === 1 ? "verse" : "verse",
          label: `Verse ${verseCount}`,
          lines: [],
        };
      }
      if (line.length > 0) {
        currentSection.lines.push(line);
      }
    }
  }

  if (currentSection && currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  // Fallback: if only one unlabelled block, treat as verse 1
  if (sections.length === 0 && raw.trim().length > 0) {
    sections.push({
      type:  "verse",
      label: "Verse 1",
      lines: raw.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    });
  }

  return sections;
}

function getVerseLabel(headerLine: string, count: number, defaultType: "verse" | "chorus"): string {
  const numMatch = headerLine.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0]) : count;

  if (defaultType === "chorus") return num > 1 ? `Chorus ${num}` : "Chorus";
  return `Verse ${num}`;
}

// ─── Run ────────────────────────────────────────────────────
parse().catch((err) => {
  console.error(chalk.red("Parsing failed:"), err);
  process.exit(1);
});
