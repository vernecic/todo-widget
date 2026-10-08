import type { Priority } from './types'

export const PROJECT_COLORS = [
  { name: 'Mint', bg: '#cde7d8', fg: '#2f5d45' },
  { name: 'Lavender', bg: '#dcd3f5', fg: '#4b3d7a' },
  { name: 'Peach', bg: '#f8d9c4', fg: '#7a4627' },
  { name: 'Sky', bg: '#cfe3f5', fg: '#2d5576' },
  { name: 'Rose', bg: '#f5d0dc', fg: '#7a2f48' },
  { name: 'Butter', bg: '#f3e6b5', fg: '#6b5a1d' },
  { name: 'Sage', bg: '#d9e5c4', fg: '#4a5a2a' },
  { name: 'Lilac', bg: '#e9d5ec', fg: '#6a3a70' }
]

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 0, label: 'None', color: 'transparent' },
  { value: 1, label: 'Low', color: '#a9c8f0' },
  { value: 2, label: 'Medium', color: '#f2cf7e' },
  { value: 3, label: 'High', color: '#ee9e9e' }
]

export function projectColor(index: number): (typeof PROJECT_COLORS)[number] {
  return PROJECT_COLORS[((index % PROJECT_COLORS.length) + PROJECT_COLORS.length) % PROJECT_COLORS.length]
}
