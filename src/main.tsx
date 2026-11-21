import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/latin-400.css'
import './styles/theme.css'
import './styles/app.css'
import './styles/markdown.css'
import './i18n'
import { App } from './App'
import { getRendererPerformanceReport } from './lib/performanceMetrics'

declare global {
  interface Window {
    __readmeWebPerformance?: {
      getRendererReport: () => ReturnType<typeof getRendererPerformanceReport>
    }
  }
}

window.__readmeWebPerformance = {
  getRendererReport: getRendererPerformanceReport
}

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err)
    })
  })
}
