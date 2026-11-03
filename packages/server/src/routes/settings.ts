import type { FastifyInstance } from 'fastify';
import { getBrand, getMascot, saveBrand, saveMascot } from '../store.ts';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/brand', async () => getBrand());
  app.put('/api/brand', async (req) => saveBrand(req.body));
  app.get('/api/mascot', async () => getMascot());
  app.put('/api/mascot', async (req) => saveMascot(req.body));
}
