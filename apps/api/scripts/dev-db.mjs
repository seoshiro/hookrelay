// Local Postgres without Docker, for development and integration tests.
// Uses the binaries shipped in the embedded-postgres npm package, copied to a short path
// because Windows refuses to run them from deep node_modules paths (MAX_PATH).
import { cpSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const PORT = Number(process.env.PG_PORT ?? 54329);
const root = process.env.PG_HOME ?? join(homedir(), '.hookrelay');
const nativeDst = join(root, 'native');
const dataDir = join(root, 'data');
const require = createRequire(import.meta.url);

const pkg = `@embedded-postgres/${platform() === 'win32' ? 'windows' : platform()}-x64`;
const nativeSrc = join(dirname(require.resolve(pkg)), '..', 'native');
if (!existsSync(join(nativeDst, 'bin'))) {
  mkdirSync(root, { recursive: true });
  cpSync(nativeSrc, nativeDst, { recursive: true });
}
const bin = (name) => join(nativeDst, 'bin', platform() === 'win32' ? `${name}.exe` : name);
const run = (cmd, args, stdio = 'inherit') => {
  const r = spawnSync(cmd, args, { stdio });
  if (r.status !== 0) throw new Error(`${cmd} exited with ${r.status}`);
};

if (!existsSync(join(dataDir, 'PG_VERSION'))) {
  rmSync(dataDir, { recursive: true, force: true });
  const pw = join(root, 'pw.txt');
  writeFileSync(pw, 'postgres\n');
  run(bin('initdb'), ['-D', dataDir, '-U', 'postgres', '--pwfile', pw, '-A', 'scram-sha-256', '-E', 'UTF8', '--locale=C']);
}

if (spawnSync(bin('pg_ctl'), ['-D', dataDir, 'status']).status !== 0) run(bin('pg_ctl'), ['-D', dataDir, '-o', `-p ${PORT}`, '-l', join(root, 'pg.log'), '-w', 'start'], 'ignore'); // ignore: the server inherits pipes and would block spawnSync
for (const db of ['hookrelay_dev', 'hookrelay_test']) {
  const { Client } = require('pg');
  const c = new Client({ connectionString: `postgresql://postgres:postgres@localhost:${PORT}/postgres` });
  await c.connect();
  const exists = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
  if (exists.rowCount === 0) await c.query(`CREATE DATABASE ${db}`);
  await c.end();
}
console.log(`postgres ready on postgresql://postgres:postgres@localhost:${PORT}/hookrelay`);

const stop = () => {
  spawnSync(bin('pg_ctl'), ['-D', dataDir, '-m', 'fast', 'stop'], { stdio: 'inherit' });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
if (process.argv.includes('--detach')) process.exit(0);
setInterval(() => {}, 1 << 30);
