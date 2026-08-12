/**
 * Local schema harness (`pnpm db:local`).
 *
 * Boots a throwaway PostgreSQL 17 in Docker, applies the Supabase shim and
 * then every migration in order, so the schema can be proven correct long
 * before it touches a real Supabase project.
 *
 *   pnpm db:local            start (or restart) and apply everything
 *   pnpm db:local -- --keep  leave it running afterwards (default)
 *   pnpm db:local -- --stop  tear it down
 *
 * Connection string for other scripts:
 *   postgres://postgres:postgres@127.0.0.1:55432/postgres
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.join(HERE, '..', 'supabase', 'migrations');
const SHIM = path.join(HERE, '_local', '00_supabase_shim.sql');

export const CONTAINER = 'ahsan-traders-localdb';
export const PORT = 55432;
export const DB_URL = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...opts });

function quiet(cmd, args) {
  try {
    return sh(cmd, args);
  } catch {
    return null;
  }
}

export function stop() {
  quiet('docker', ['rm', '-f', CONTAINER]);
}

export async function start() {
  stop();
  sh('docker', [
    'run', '-d', '--name', CONTAINER,
    '-e', 'POSTGRES_PASSWORD=postgres',
    '-e', 'POSTGRES_DB=postgres',
    '-p', `${PORT}:5432`,
    'postgres:17-alpine',
  ]);

  process.stdout.write('waiting for postgres');
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = quiet('docker', ['exec', CONTAINER, 'pg_isready', '-U', 'postgres']);
    if (ready && ready.includes('accepting connections')) {
      process.stdout.write(' ready\n');
      return;
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('postgres did not become ready');
}

export function psqlFile(file) {
  sh('docker', ['cp', file, `${CONTAINER}:/tmp/apply.sql`]);
  return sh('docker', [
    'exec', '-e', 'ON_ERROR_STOP=1', CONTAINER,
    'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-f', '/tmp/apply.sql',
  ]);
}

export function psql(sql, extraArgs = []) {
  return sh('docker', [
    'exec', '-i', CONTAINER,
    'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres',
    ...extraArgs, '-c', sql,
  ]);
}

export function migrationFiles() {
  return readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => path.join(MIGRATIONS, f));
}

export async function rebuild() {
  await start();
  psqlFile(SHIM);
  const files = migrationFiles();
  for (const file of files) {
    try {
      psqlFile(file);
      console.log(`  ok    ${path.basename(file)}`);
    } catch (error) {
      console.error(`  FAIL  ${path.basename(file)}`);
      console.error((error.stdout ?? '') + (error.stderr ?? ''));
      throw new Error(`migration failed: ${path.basename(file)}`);
    }
  }
  console.log(`\n${files.length} migrations applied cleanly.`);
}

// pathToFileURL, not string concatenation: the project path contains a space,
// which import.meta.url percent-encodes and process.argv[1] does not.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--stop')) {
    stop();
    console.log('stopped.');
  } else {
    await rebuild();
    console.log(`\nConnect with:\n  psql "${DB_URL}"`);
  }
}
