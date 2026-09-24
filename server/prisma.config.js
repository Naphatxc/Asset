import 'dotenv/config.js';
import { defineConfig } from 'prisma/config';

function createDatabaseUrl() {
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '3306';
  const database = process.env.DB_NAME ?? 'asset_management';
  const user = encodeURIComponent(process.env.DB_USER ?? 'root');
  const password = encodeURIComponent(process.env.DB_PASSWORD ?? '');

  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: createDatabaseUrl(),
  },
});
