import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
// The server only accepts Host 127.0.0.1:4000 / localhost:4000, so the proxy rewrites Host.
const api = { target: 'http://127.0.0.1:4000', changeOrigin: true };

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@reelmaker/video': path.join(here, '..', 'video', 'src', 'exports.ts') },
    // one copy each, shared by the app, @remotion/player and the video package
    dedupe: ['react', 'react-dom', 'remotion'],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': api, '/files': api, '/character': api },
  },
});
