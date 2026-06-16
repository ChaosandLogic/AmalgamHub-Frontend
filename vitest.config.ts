import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { stubCssPlugin } from './test/stubCssPlugin'

export default defineConfig({
  plugins: [stubCssPlugin(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    include: ['**/*.test.{ts,tsx}'],
    css: false,
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, '.') },
      { find: /\.module\.css$/, replacement: path.resolve(__dirname, 'test/cssStub.ts') },
      { find: /\.css$/, replacement: path.resolve(__dirname, 'test/cssStub.ts') },
    ],
  },
})
