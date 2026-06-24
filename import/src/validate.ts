#!/usr/bin/env ts-node
/**
 * Morija-Cantiques Hymn Numbering Validator
 * ==========================================
 * Validates that:
 *   1. No duplicate hymn numbers within a collection
 *   2. Numbers are positive integers
 *   3. All 13 collections exist
 *   4. Total hymn count matches expected (if provided)
 *
 * Usage:
 *   pnpm --filter import run validate
 *   pnpm --filter import run validate -- --expected 1085
 */

import { PrismaClient } from "@prisma/client";
import { parseArgs } from "util";
import chalk from "chalk";
import ora from "ora";

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    expected: { type: "string" },
    help:     { type: "boolean", short: "h" },
  },
});

const prisma = new PrismaClient({ log: ["error"] });

const EXPECTED_COLLECTIONS = [
  "only-believe", "crois-seulement", "hosanna", "autres-cantiques",
  "collection-de-cantiques", "chant-de-victoire", "nyimbo-za-mungu",
  "nyimbo-za-wokovu", "roc-seculaire", "quel-temps-glorieux",
  "sacred-songs-and-solos", "only-believe-2", "roc-seculaire-paris-2",
];

async function validate(): Promise<void> {
  console.log(chalk.yellow("\n🔍 Morija-Cantiques Hymn Numbering Validator\n"));

  let hasErrors = false;

  // 1. Check all collections exist
  {
    const spinner = ora("Checking collections...").start();
    const collections = await prisma.collection.findMany({ select: { slug: true, name: true } });
    const slugs = collections.map((c) => c.slug);

    const missing = EXPECTED_COLLECTIONS.filter((s) => !slugs.includes(s));
    if (missing.length > 0) {
      spinner.fail(`Missing collections: ${chalk.red(missing.join(", "))}`);
      hasErrors = true;
    } else {
      spinner.succeed(`All ${EXPECTED_COLLECTIONS.length} collections present`);
    }
  }

  // 2. Check for duplicate hymn numbers per collection
  {
    const spinner = ora("Checking for duplicate hymn numbers...").start();
    const collections = await prisma.collection.findMany({
      include: { songs: { select: { songNumber: true, title: true } } },
    });

    let dupErrors = 0;
    for (const coll of collections) {
      const nums = coll.songs.map((s) => s.songNumber);
      const seen  = new Set<number>();
      const dupes: number[] = [];

      for (const n of nums) {
        if (seen.has(n)) dupes.push(n);
        seen.add(n);
      }

      if (dupes.length > 0) {
        console.log(chalk.red(`\n  Duplicate numbers in "${coll.slug}": ${dupes.join(", ")}`));
        dupErrors++;
      }
    }

    if (dupErrors > 0) {
      spinner.fail(`Found duplicate hymn numbers in ${dupErrors} collection(s)`);
      hasErrors = true;
    } else {
      spinner.succeed("No duplicate hymn numbers found");
    }
  }

  // 3. Check for invalid hymn numbers
  {
    const spinner = ora("Checking hymn number validity...").start();
    const badSongs = await prisma.song.findMany({
      where: { OR: [{ songNumber: { lte: 0 } }] },
      select: { songNumber: true, title: true, collection: { select: { slug: true } } },
    });

    if (badSongs.length > 0) {
      spinner.fail(`Found ${badSongs.length} songs with invalid numbers (≤ 0)`);
      badSongs.forEach((s) =>
        console.log(chalk.red(`  - "${s.title}" in ${s.collection.slug}: number ${s.songNumber}`))
      );
      hasErrors = true;
    } else {
      spinner.succeed("All hymn numbers are valid (> 0)");
    }
  }

  // 4. Total count check
  {
    const spinner = ora("Counting total hymns...").start();
    const total = await prisma.song.count();

    if (args.expected) {
      const expected = parseInt(args.expected);
      if (total !== expected) {
        spinner.warn(
          `Total hymns: ${chalk.cyan(total)} (expected ${chalk.yellow(expected)}). ` +
          `Difference: ${chalk.red(total - expected)}`
        );
      } else {
        spinner.succeed(`Total hymns: ${chalk.green(total)} ✓ matches expected count`);
      }
    } else {
      spinner.succeed(`Total hymns in database: ${chalk.cyan(total)}`);
    }
  }

  // 5. Per-collection summary
  {
    console.log(chalk.yellow("\n  Collection Summary:"));
    const collections = await prisma.collection.findMany({
      include: { _count: { select: { songs: true } } },
      orderBy: { order: "asc" },
    });

    for (const coll of collections) {
      const count  = coll._count.songs;
      const status = count > 0 ? chalk.green(`${count} hymns`) : chalk.red("0 hymns ⚠");
      console.log(`  ${chalk.cyan(coll.slug.padEnd(35))} ${status}`);
    }
  }

  // 6. Final result
  console.log();
  if (hasErrors) {
    console.log(chalk.red("✗ Validation failed — see errors above"));
    process.exit(1);
  } else {
    console.log(chalk.green("✓ All validations passed!"));
  }
}

validate()
  .catch((err) => {
    console.error(chalk.red("Validation error:"), err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
