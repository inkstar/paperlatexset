import { readFileSync, writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const MIGRATION_PATH = 'prisma/migrations/20260223_init/migration.sql';

function ensureMigrationSql() {
  const gen = spawnSync(
    'npx',
    ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
    { encoding: 'utf8' }
  );

  if (gen.status !== 0) {
    console.error(gen.stderr || gen.stdout || 'failed to generate migration sql');
    process.exit(gen.status || 1);
  }

  mkdirSync(dirname(MIGRATION_PATH), { recursive: true });
  writeFileSync(MIGRATION_PATH, gen.stdout, 'utf8');
}

function splitStatements(sql) {
  const cleaned = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  return cleaned
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isIgnorableError(message) {
  return (
    message.includes('already exists') ||
    message.includes('duplicate key value') ||
    message.includes('Duplicate object')
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  ensureMigrationSql();
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const statements = splitStatements(sql);
  const prisma = new PrismaClient();

  let applied = 0;
  let skipped = 0;

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      applied += 1;
    } catch (error) {
      const message = String(error?.message || error);
      if (isIgnorableError(message)) {
        skipped += 1;
        continue;
      }
      console.error('bootstrap failed on statement:', stmt.slice(0, 180));
      console.error(message);
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  await prisma.$disconnect();
  console.log(JSON.stringify({ ok: true, applied, skipped, total: statements.length }));
}

main();
