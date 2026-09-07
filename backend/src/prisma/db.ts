import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});
const dbClient = db.orm.public
export default dbClient
