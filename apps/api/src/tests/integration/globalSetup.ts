import { execSync } from 'node:child_process';

/** Applies migrations to the test database once. Without TEST_DATABASE_URL, integration suites skip themselves. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
}
