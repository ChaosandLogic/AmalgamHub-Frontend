import type { Plugin } from 'vite'

/** Stub CSS imports so component tests do not need PostCSS/Tailwind. */
export function stubCssPlugin(): Plugin {
  return {
    name: 'stub-css',
    enforce: 'pre',
    resolveId(source) {
      if (source.endsWith('.css') || source.endsWith('.module.css')) {
        return `\0stub-css:${source}`
      }
    },
    load(id) {
      if (id.startsWith('\0stub-css:')) {
        return id.endsWith('.module.css') ? 'export default {}' : ''
      }
    },
  }
}
