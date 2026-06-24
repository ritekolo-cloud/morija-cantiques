#!/usr/bin/env ts-node
/**
 * Morija-Cantiques Database Seeder
 * ==================================
 * Reads parsed hymn data and upserts it into PostgreSQL via Prisma.
 *
 * Data sources (in priority order):
 *   1. ./data/parsed/hymns.json  (from extractor → parser pipeline)
 *   2. ./data/sample-hymns.json  (bundled sample data / fallback)
 *
 * Usage:
 *   pnpm --filter import run seed                    # seeds from parsed data
 *   pnpm --filter import run seed -- --sample        # seeds from sample data
 *   pnpm --filter import run seed -- --reset         # clears existing hymns first
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { parseArgs } from "util";
import chalk from "chalk";
import ora from "ora";
import cliProgress from "cli-progress";
import bcrypt from "bcryptjs";
import type { ParsedHymn, ParsedOutput, SongSection } from "./parser.js";

// ─── CLI Args ───────────────────────────────────────────────
const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    sample: { type: "boolean", default: false },
    reset:  { type: "boolean", default: false },
    help:   { type: "boolean", short: "h" },
  },
});

if (args.help) {
  console.log(`
${chalk.yellow("Morija-Cantiques Database Seeder")}

Usage:
  ts-node src/seed.ts [options]

Options:
  --sample   Use bundled sample data instead of parsed APK data
  --reset    Clear all existing hymn data before seeding
  --help     Show this help
  `);
  process.exit(0);
}

// ─── Prisma ─────────────────────────────────────────────────
const prisma = new PrismaClient({
  log: ["warn", "error"],
});

// ─── Collection definitions ──────────────────────────────────
const COLLECTIONS = [
  { slug: "only-believe",            name: "Only Believe",              subtitle: "Gospel Songs",          language: "English",   order: 1 },
  { slug: "crois-seulement",         name: "Crois Seulement",           subtitle: "Cantiques de Foi",      language: "French",    order: 2 },
  { slug: "hosanna",                 name: "Hosanna",                   subtitle: "Songs of Praise",        language: "English",   order: 3 },
  { slug: "autres-cantiques",        name: "Autres Cantiques",          subtitle: "Hymnes Supplémentaires", language: "French",    order: 4 },
  { slug: "collection-de-cantiques", name: "Collection de Cantiques",   subtitle: "Recueil de Louanges",    language: "French",    order: 5 },
  { slug: "chant-de-victoire",       name: "Chant de Victoire",         subtitle: "Chants Triomphants",     language: "French",    order: 6 },
  { slug: "nyimbo-za-mungu",         name: "Nyimbo za Mungu",           subtitle: "Nyimbo za Ibada",        language: "Kiswahili", order: 7 },
  { slug: "nyimbo-za-wokovu",        name: "Nyimbo za Wokovu",          subtitle: "Wimbo wa Wokovu",        language: "Kiswahili", order: 8 },
  { slug: "roc-seculaire",           name: "Roc Séculaire",             subtitle: "Hymnes Classiques",      language: "French",    order: 9 },
  { slug: "quel-temps-glorieux",     name: "Quel Temps Glorieux",       subtitle: "Cantiques de Gloire",    language: "French",    order: 10 },
  { slug: "sacred-songs-and-solos",  name: "Sacred Songs and Solos",    subtitle: "Classic Hymns",          language: "English",   order: 11 },
  { slug: "only-believe-2",          name: "Only Believe 2",            subtitle: "Gospel Songs Vol. 2",    language: "English",   order: 12 },
  { slug: "roc-seculaire-paris-2",   name: "Roc Séculaire (Paris-2)",   subtitle: "Édition Paris",          language: "French",    order: 13 },
];

// ─── Languages ───────────────────────────────────────────────
const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "sw", name: "Kiswahili" },
];

// ─── Main ───────────────────────────────────────────────────
async function seed(): Promise<void> {
  console.log(chalk.yellow("\n🎵 Morija-Cantiques Database Seeder\n"));

  // 1. Determine data source
  const parsedFile  = path.resolve("./data/parsed/hymns.json");
  const sampleFile  = path.resolve("./data/sample-hymns.json");

  let dataFile: string;
  let dataSource: string;

  if (args.sample || !fs.existsSync(parsedFile)) {
    if (!fs.existsSync(sampleFile)) {
      console.error(chalk.red("No hymn data found. Run extractor first or provide sample data."));
      process.exit(1);
    }
    dataFile   = sampleFile;
    dataSource = "sample data";
  } else {
    dataFile   = parsedFile;
    dataSource = "parsed APK data";
  }

  console.log(`  Data source : ${chalk.cyan(dataSource)}`);
  console.log(`  Data file   : ${chalk.cyan(dataFile)}`);

  const hymnData = JSON.parse(fs.readFileSync(dataFile, "utf8")) as ParsedOutput;

  // 2. Optional reset
  if (args.reset) {
    const spinner = ora("Clearing existing hymn data...").start();
    await prisma.playlistSong.deleteMany();
    await prisma.recentSong.deleteMany();
    await prisma.favorite.deleteMany();
    await prisma.song.deleteMany();
    await prisma.collection.deleteMany();
    spinner.succeed("Cleared existing data");
  }

  // 3. Seed languages
  {
    const spinner = ora("Seeding languages...").start();
    for (const lang of LANGUAGES) {
      await prisma.language.upsert({
        where:  { code: lang.code },
        update: { name: lang.name },
        create: { code: lang.code, name: lang.name },
      });
    }
    spinner.succeed(`Seeded ${LANGUAGES.length} languages`);
  }

  // 4. Seed collections
  {
    const spinner = ora("Seeding collections...").start();
    for (const coll of COLLECTIONS) {
      await prisma.collection.upsert({
        where:  { slug: coll.slug },
        update: { name: coll.name, subtitle: coll.subtitle, language: coll.language, order: coll.order },
        create: { slug: coll.slug, name: coll.name, subtitle: coll.subtitle, language: coll.language, order: coll.order },
      });
    }
    spinner.succeed(`Seeded ${COLLECTIONS.length} collections`);
  }

  // 5. Seed admin user
  {
    const spinner = ora("Seeding admin user...").start();
    const adminEmail    = process.env.ADMIN_EMAIL    ?? "admin@morijacantiques.com";
    const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@123456";
    const adminName     = process.env.ADMIN_NAME     ?? "Administrator";

    const hashedPw = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where:  { email: adminEmail },
      update: {},
      create: {
        name:       adminName,
        email:      adminEmail,
        password:   hashedPw,
        role:       "ADMIN",
        isVerified: true,
      },
    });
    spinner.succeed(`Admin user ready: ${chalk.cyan(adminEmail)}`);
  }

  // 6. Seed hymns
  console.log("\n  Seeding hymns...");

  const bar = new cliProgress.SingleBar({
    format: `  {bar} {percentage}% | {value}/{total} hymns | {collection}`,
    barCompleteChar:   "█",
    barIncompleteChar: "░",
    hideCursor: true,
  });

  let totalSeeded = 0;
  const totalHymns = Object.values(hymnData.collections).reduce((s, c) => s + c.length, 0);
  bar.start(totalHymns, 0, { collection: "" });

  for (const [collSlug, hymns] of Object.entries(hymnData.collections)) {
    const collection = await prisma.collection.findUnique({ where: { slug: collSlug } });
    if (!collection) {
      console.warn(chalk.yellow(`\n  ⚠ Collection "${collSlug}" not found in DB — skipping`));
      continue;
    }

    for (const hymn of hymns) {
      const lyricsJson = JSON.stringify(hymn.sections);

      await prisma.song.upsert({
        where: {
          collectionId_songNumber: {
            collectionId: collection.id,
            songNumber:   hymn.songNumber,
          },
        },
        update: {
          title:    hymn.title,
          lyrics:   lyricsJson,
          language: hymn.language,
        },
        create: {
          songNumber:   hymn.songNumber,
          title:        hymn.title,
          lyrics:       lyricsJson,
          language:     hymn.language ?? collection.language,
          collectionId: collection.id,
        },
      });

      totalSeeded++;
      bar.update(totalSeeded, { collection: collSlug });
    }
  }

  bar.stop();

  console.log(chalk.green(`\n✓ Seeding complete!`));
  console.log(`  Total hymns seeded: ${chalk.cyan(totalSeeded)}`);
  console.log(`  Collections:        ${chalk.cyan(Object.keys(hymnData.collections).length)}`);
  console.log(`\nNext step: ${chalk.yellow("pnpm --filter import run validate")}`);
}

// ─── Run ────────────────────────────────────────────────────
seed()
  .catch((err) => {
    console.error(chalk.red("\nSeeding failed:"), err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
