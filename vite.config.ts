import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { serverDocumentsPlugin } from './serverPlugin'

function keepKatexWoff2(css: string): string {
  return css.replace(
    /url\(fonts\/([\w-]+\.woff2)\) format\("woff2"\),\s*url\(fonts\/[\w-]+\.woff\) format\("woff"\),\s*url\(fonts\/[\w-]+\.ttf\) format\("truetype"\)/g,
    'url(fonts/$1) format("woff2")'
  )
}

/** Modern browsers support WOFF2, so avoid emitting KaTeX legacy font fallbacks */
function katexWoff2Only(): Plugin {
  return {
    name: 'katex-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      const normalizedId = id.split('?')[0].replace(/\\/g, '/')
      return normalizedId.includes('katex/dist/katex.min.css')
        ? { code: keepKatexWoff2(code), map: null }
        : null
    }
  }
}

/** Drop old font fallbacks for Inter */
function interWoff2Only(): Plugin {
  return {
    name: 'inter-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      const normalizedId = id.split('?')[0].replace(/\\/g, '/')
      if (!normalizedId.includes('@fontsource/inter')) return null
      return {
        code: code.replace(
          /url\(([^)]+\.woff2)\) format\('woff2'\),\s*url\([^)]+\.woff\) format\('woff'\)/g,
          'url($1) format("woff2")'
        ),
        map: null
      }
    }
  }
}

/** Dead code elimination for texmath */
function texmathWithoutFallbackKatex(): Plugin {
  return {
    name: 'texmath-without-fallback-katex',
    enforce: 'pre',
    transform(code, id) {
      const normalizedId = id.split('?')[0].replace(/\\/g, '/')
      if (!normalizedId.endsWith('/node_modules/markdown-it-texmath/texmath.js')) return null
      return {
        code: code.replace(
          /else if \(typeof module === "object"\)\s*texmath\.katex = require\('katex'\);\s*else/,
          'else'
        ),
        map: null
      }
    }
  }
}

/** Inlines KaTeX woff2 fonts as Base64 for standalone HTML exports */
function katexEmbeddedFonts(): Plugin {
  const virtualId = 'virtual:katex-fonts-css'
  const resolvedId = '\0' + virtualId
  return {
    name: 'katex-embedded-fonts',
    resolveId(id) {
      return id === virtualId ? resolvedId : null
    },
    load(id) {
      if (id !== resolvedId) return null
      const katexDist = resolve(__dirname, 'node_modules/katex/dist')
      let css = keepKatexWoff2(readFileSync(resolve(katexDist, 'katex.min.css'), 'utf8'))
      css = css.replace(
        /url\(fonts\/([\w-]+\.woff2)\)/g,
        (_match, file: string) =>
          `url(data:font/woff2;base64,${readFileSync(resolve(katexDist, 'fonts', file)).toString('base64')})`
      )
      return `export default ${JSON.stringify(css)}`
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    texmathWithoutFallbackKatex(),
    katexWoff2Only(),
    interWoff2Only(),
    katexEmbeddedFonts(),
    serverDocumentsPlugin()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  worker: {
    format: 'es'
  },
  server: {
    port: 5173
  }
})
