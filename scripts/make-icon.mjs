// Draws the app icon (rounded pastel square with a check mark) as a 256px PNG.
// No dependencies: anti-aliasing via signed distance fields, PNG via zlib.
import { deflateSync } from 'zlib'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const SIZE = 256
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const BG = [185, 168, 240] // lavender
const FG = [255, 255, 255]

function roundedRectDist(x, y, cx, cy, half, r) {
  const qx = Math.abs(x - cx) - half + r
  const qy = Math.abs(y - cy) - half + r
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
}

function segmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const pixels = Buffer.alloc(SIZE * SIZE * 4)
const check = [
  [78, 132],
  [112, 166],
  [180, 94]
]

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const px = x + 0.5
    const py = y + 0.5
    const shape = clamp01(0.5 - roundedRectDist(px, py, 128, 128, 116, 56))
    const d = Math.min(
      segmentDist(px, py, ...check[0], ...check[1]),
      segmentDist(px, py, ...check[1], ...check[2])
    )
    const mark = clamp01(0.5 - (d - 14)) * shape
    const i = (y * SIZE + x) * 4
    for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(BG[c] * (1 - mark) + FG[c] * mark)
    pixels[i + 3] = Math.round(shape * 255)
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8
ihdr[9] = 6
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

for (const dir of ['build', 'resources']) {
  mkdirSync(join(root, dir), { recursive: true })
  writeFileSync(join(root, dir, 'icon.png'), png)
}
console.log('icon written to build/icon.png and resources/icon.png')
