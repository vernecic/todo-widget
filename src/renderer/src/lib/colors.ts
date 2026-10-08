import type { Priority } from './types'

/**
 * `bg`/`fg` are the soft tag colors. `chart`/`chartDark` are the same hues at
 * chart strength, checked as a set for color-blind separation and contrast
 * (light and dark surfaces), since the pastels read as gray in a chart.
 */
export const PROJECT_COLORS = [
  { name: 'Mint', bg: '#cde7d8', fg: '#2f5d45', chart: '#1baf7a', chartDark: '#199e70' },
  { name: 'Lavender', bg: '#dcd3f5', fg: '#4b3d7a', chart: '#4a3aa7', chartDark: '#9085e9' },
  { name: 'Peach', bg: '#f8d9c4', fg: '#7a4627', chart: '#eb6834', chartDark: '#d95926' },
  { name: 'Sky', bg: '#cfe3f5', fg: '#2d5576', chart: '#2a78d6', chartDark: '#3987e5' },
  { name: 'Rose', bg: '#f5d0dc', fg: '#7a2f48', chart: '#e87ba4', chartDark: '#d55181' },
  { name: 'Butter', bg: '#f3e6b5', fg: '#6b5a1d', chart: '#eda100', chartDark: '#c98500' },
  { name: 'Sage', bg: '#d9e5c4', fg: '#4a5a2a', chart: '#008300', chartDark: '#008300' },
  { name: 'Lilac', bg: '#e9d5ec', fg: '#6a3a70', chart: '#a35cc4', chartDark: '#b072d6' }
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
