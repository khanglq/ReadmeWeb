import { set, del, values } from 'idb-keyval'

export interface AutoSaveDraft {
  id: string
  title: string
  content: string
  updatedAt?: number
}

const DRAFT_PREFIX = 'readmeweb_draft_'

export const draftService = {
  async getDrafts(): Promise<AutoSaveDraft[]> {
    try {
      const allValues = await values()
      const drafts: AutoSaveDraft[] = []
      for (const val of allValues) {
        if (val && typeof val === 'object' && 'id' in val && 'content' in val) {
          drafts.push(val as AutoSaveDraft)
        }
      }
      return drafts
    } catch (err) {
      console.warn('Failed to read drafts from IndexedDB', err)
      return []
    }
  },

  async saveDraft(draft: AutoSaveDraft): Promise<{ ok: boolean; error?: string }> {
    try {
      await set(`${DRAFT_PREFIX}${draft.id}`, {
        ...draft,
        updatedAt: Date.now()
      })
      return { ok: true }
    } catch (err) {
      console.error('Failed to save draft to IndexedDB', err)
      return { ok: false, error: err instanceof Error ? err.message : 'Storage error' }
    }
  },

  async removeDraft(id: string): Promise<{ ok: boolean }> {
    try {
      await del(`${DRAFT_PREFIX}${id}`)
      return { ok: true }
    } catch (err) {
      console.warn('Failed to remove draft from IndexedDB', err)
      return { ok: false }
    }
  }
}
