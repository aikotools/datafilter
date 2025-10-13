import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AikotoolsDatafilter',
      fileName: 'aikotools-datafilter',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['luxon'],
      output: {
        globals: {
          luxon: 'luxon',
        },
      },
    },
  },
  plugins: [
    dts({
      include: ['src/**/*'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    }),
  ],
});
