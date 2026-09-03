// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// Keep the site static by default. The adapter exists only so explicitly
// non-prerendered routes can run on Vercel without converting the public site
// to server output.
export default defineConfig({
  adapter: vercel()
});
