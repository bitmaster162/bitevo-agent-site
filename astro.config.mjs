// @ts-check
import { defineConfig } from 'astro/config';

// Temporary Vite 8 compatibility bridge: preserve the reviewed BitEvo CSP/minification model while Astro 7 is adopted.
// Vite 8 supports these esbuild options but marks esbuild minification as deprecated; track removal as follow-up debt.
export default defineConfig({
  vite: {
    build: {
      minify: 'esbuild',
      cssMinify: 'esbuild'
    }
  }
});
