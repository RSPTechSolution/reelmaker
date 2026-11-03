import { buildApp } from './app.ts';
import { DATA_DIR } from './paths.ts';

const HOST = '127.0.0.1'; // local only: no auth, single user
const PORT = 4000;

const app = buildApp({ logger: true });
try {
  await app.listen({ host: HOST, port: PORT });
  app.log.info(`data folder: ${DATA_DIR}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
