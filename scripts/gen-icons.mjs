// Gera os ícones PNG do PWA (public/pwa-192.png e public/pwa-512.png).
// Sem dependências: encoder PNG mínimo (RGBA, sem filtro).
// Rode com:  node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(OUT, { recursive: true })

const BG = [15, 23, 42, 255] // #0f172a
const GREEN = [52, 211, 153, 255] // #34d399
const RED = [248, 113, 113, 255] // #f87171

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td), 0)
  return Buffer.concat([len, td, crc])
}
function png(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0 // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function icon(size) {
  const buf = Buffer.alloc(size * size * 4)
  const put = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    buf[i] = r
    buf[i + 1] = g
    buf[i + 2] = b
    buf[i + 3] = a
  }
  const rect = (x0, y0, w, h, color) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, color)
  }
  rect(0, 0, size, size, BG)
  const barW = Math.round(size * 0.14)
  const gap = Math.round(size * 0.08)
  const baseY = Math.round(size * 0.8)
  const startX = Math.round(size * 0.22)
  const heights = [0.3, 0.5, 0.68]
  const colors = [GREEN, GREEN, RED]
  heights.forEach((hFrac, idx) => {
    const h = Math.round(size * hFrac)
    const x = startX + idx * (barW + gap)
    rect(x, baseY - h, barW, h, colors[idx])
  })
  return png(size, size, buf)
}

for (const size of [192, 512]) {
  const file = join(OUT, `pwa-${size}.png`)
  writeFileSync(file, icon(size))
  console.log('wrote', file)
}
