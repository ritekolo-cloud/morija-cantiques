import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const collections = [
  { code: 'ob', slug: 'only-believe', name: 'Only Believe', hymns: 222, language: 'en' },
  { code: 'cs', slug: 'crois-seulement', name: 'Crois Seulement', hymns: 226, language: 'fr' },
  { code: 'hos', slug: 'hosanna', name: 'Hosanna', hymns: 247, language: 'fr' },
  { code: 'ac', slug: 'autres-cantiques', name: 'Autres Cantiques', hymns: 214, language: 'fr' },
  { code: 'cc', slug: 'collection-des-cantiques', name: 'Collection des Cantiques', hymns: 511, language: 'fr' },
  { code: 'cv', slug: 'chant-de-victoire', name: 'Chant de Victoire', hymns: 324, language: 'fr' },
  { code: 'nm', slug: 'nyimbo-za-mungu', name: 'Nyimbo za Mungu', hymns: 327, language: 'sw' },
  { code: 'nw', slug: 'nyimbo-za-wokovu', name: 'Nyimbo za Wokovu', hymns: 300, language: 'sw' },
  { code: 'rs', slug: 'roc-seculaire', name: 'Roc Séculaire', hymns: 347, language: 'fr' },
  { code: 'qtg', slug: 'quel-temps-glorieux', name: 'Quel Temps Glorieux', hymns: 602, language: 'fr' },
  { code: 'sss', slug: 'sacred-songs-and-solos', name: 'Sacred Songs and Solos', hymns: 1200, language: 'en' },
  { code: 'ob2', slug: 'only-believe-2', name: 'Only Believe 2', hymns: 1085, language: 'en' },
  { code: 'rsp2', slug: 'roc-seculaire-paris', name: 'Roc Séculaire Paris', hymns: 604, language: 'fr' },
];

async function main() {
  console.log('Seeding collections...');
  for (let i = 0; i < collections.length; i++) {
    const coll = collections[i];
    await prisma.collection.upsert({
      where: { slug: coll.slug },
      update: {
        name: coll.name,
        subtitle: `${coll.hymns} Hymns`,
        language: coll.language,
        order: i + 1,
      },
      create: {
        slug: coll.slug,
        name: coll.name,
        subtitle: `${coll.hymns} Hymns`,
        language: coll.language,
        order: i + 1,
      },
    });
  }
  console.log('Collections seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
