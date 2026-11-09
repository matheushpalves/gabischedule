import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/migrate.ts', 'src/gen-vapid.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // O pacote compartilhado é TypeScript puro: embutimos no bundle.
  noExternal: ['@gabi/shared'],
});
