import type { ExportPageOrientation, ExportPageSize, ExportRequest } from '../types/app'

export const exportService = {
  async export(request: ExportRequest): Promise<{ ok: boolean; path?: string; error?: string }> {
    const format = request.format
    const suggested = request.suggestedName || 'document'

    if (format === 'html') {
      return this.exportHtml(request.html, suggested.endsWith('.html') ? suggested : `${suggested}.html`)
    }

    if (format === 'pdf') {
      return this.exportPdf(request.html, request.pageSize, request.orientation)
    }

    return { ok: false, error: `Unsupported format: ${format}` }
  },

  async exportHtml(htmlContent: string, fileName = 'document.html'): Promise<{ ok: boolean; path?: string }> {
    try {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return { ok: true, path: fileName }
    } catch (err) {
      return { ok: false }
    }
  },

  async exportPdf(
    htmlContent: string,
    pageSize: ExportPageSize = 'A4',
    orientation: ExportPageOrientation = 'portrait'
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (!doc) throw new Error('Cannot open print frame')

      const pageStyle = `@page { size: ${pageSize} ${orientation}; margin: 20mm; }`
      const printDoc = htmlContent.replace('</head>', `<style>${pageStyle}</style></head>`)

      doc.open()
      doc.write(printDoc)
      doc.close()

      // Give images & web fonts a moment to layout
      await new Promise((r) => setTimeout(r, 400))

      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()

      // Clean up iframe after printing dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)

      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Print error' }
    }
  },

  async exportDiagramPng(dataUrl: string, baseName = 'diagram.png'): Promise<{ ok: boolean; path?: string }> {
    try {
      const cleanName = baseName.endsWith('.png') ? baseName : `${baseName}.png`
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = cleanName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return { ok: true, path: cleanName }
    } catch (err) {
      return { ok: false }
    }
  }
}
