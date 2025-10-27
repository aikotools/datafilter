import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AikotoolsDatafilter',
      fileName: (format) => `aikotools-datafilter.${format === 'es' ? 'mjs' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    // Enable source maps for better debugging
    sourcemap: true,
    // Disable minification to keep code readable
    minify: false,
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
