const assetRegistry = new Map<string, string>()

export const assetService = {
  registerFile(name: string, file: File): string {
    const existing = assetRegistry.get(name)
    if (existing) URL.revokeObjectURL(existing)
    const url = URL.createObjectURL(file)
    assetRegistry.set(name, url)
    return url
  },

  registerFiles(files: FileList | File[]): void {
    const list = Array.isArray(files) ? files : Array.from(files)
    for (const f of list) {
      if (f.type.startsWith('image/')) {
        this.registerFile(f.name, f)
      }
    }
  },

  resolveUrl(src: string): string {
    if (!src) return src
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('blob:')) {
      return src
    }

    const clean = src.replace(/^\.\//, '')
    const basename = clean.split(/[/\\]/).pop() || clean

    return assetRegistry.get(clean) || assetRegistry.get(basename) || src
  },

  clear(): void {
    for (const url of assetRegistry.values()) {
      URL.revokeObjectURL(url)
    }
    assetRegistry.clear()
  }
}
