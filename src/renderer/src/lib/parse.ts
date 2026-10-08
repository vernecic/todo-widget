import type { Priority } from './types'

export interface QuickTask {
  title: string
  priority: Priority
  project: string | null
}

/**
 * Parses the add bar: "Send invoice #google !!" gives title "Send invoice",
 * project "google", priority Medium. `!` low, `!!` medium, `!!!` high.
 */
export function parseQuick(input: string): QuickTask {
  let priority: Priority = 0
  let project: string | null = null
  const words = input
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => {
      if (/^!{1,3}$/.test(word)) {
        priority = word.length as Priority
        return false
      }
      if (/^#[^\s#]+$/.test(word)) {
        project = word.slice(1)
        return false
      }
      return true
    })
  return { title: words.join(' '), priority, project }
}
