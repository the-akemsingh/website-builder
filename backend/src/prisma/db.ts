import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

function getDatabaseUrl() {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }

  // pg-connection-string currently treats `require` as certificate verification.
  // Keep the existing `sslmode=require` intent explicit until the driver changes
  // its default to standard libpq semantics.
  const databaseUrl = new URL(url);
  if (databaseUrl.searchParams.get('sslmode') === 'require' && !databaseUrl.searchParams.has('uselibpqcompat')) {
    databaseUrl.searchParams.set('uselibpqcompat', 'true');
  }
  return databaseUrl.toString();
}

const db = postgres<Contract>({
  contractJson,
  url: getDatabaseUrl(),
});

const dbClient = db.orm.public;
export default dbClient;
export { db };
