import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `base` controls the public path the app is served from.
//  - User/Org Pages (https://user.github.io/)        -> "/"
//  - Project Pages   (https://user.github.io/<repo>/) -> "/<repo>/"
// The deploy workflow sets VITE_BASE automatically; defaults to "/" for local dev.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    // The CSG/3MF libraries are large; raise the warning ceiling.
    chunkSizeWarningLimit: 2000,
  },
});
