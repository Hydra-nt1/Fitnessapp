// Erzeugt public/icon.svg + PNG-Icons (Favicon, PWA, Apple Touch, Maskable).
// Aufruf: node scripts/icons.mjs
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync } from 'node:fs'

const VOLT = '#c8ff2e'
const art = (scale) => `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <circle cx="512" cy="512" r="318" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="84"/>
    <circle cx="512" cy="512" r="318" fill="none" stroke="url(#ring)" stroke-width="84" stroke-linecap="round"
      stroke-dasharray="1560 2000" transform="rotate(118 512 512)"/>
    <g transform="translate(512 512) scale(.8) translate(-512 -512)">
      <path d="M566 236 L360 548 L494 548 L452 788 L664 468 L528 468 L590 236 Z" fill="url(#bolt)" stroke="${VOLT}" stroke-width="18" stroke-linejoin="round"/>
    </g>
  </g>`
const defs = `
  <defs>
    <radialGradient id="bg" cx="78%" cy="12%" r="95%">
      <stop offset="0" stop-color="#2a3310"/>
      <stop offset=".45" stop-color="#121310"/>
      <stop offset="1" stop-color="#08080a"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e6ff7a"/>
      <stop offset="1" stop-color="${VOLT}"/>
    </linearGradient>
    <linearGradient id="bolt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eaff8f"/>
      <stop offset="1" stop-color="${VOLT}"/>
    </linearGradient>
  </defs>`
const svg = ({ rounded, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defs}
  ${rounded ? '<rect width="1024" height="1024" rx="232" fill="url(#bg)"/>' : '<rect width="1024" height="1024" fill="url(#bg)"/>'}
  ${art(scale)}
</svg>`

const icon = svg({ rounded: true, scale: 1 })
const fullBleed = svg({ rounded: false, scale: 1 })
const maskable = svg({ rounded: false, scale: 0.78 })
writeFileSync('public/icon.svg', icon)
const png = (src, size, file) => writeFileSync(`public/${file}`, new Resvg(src, { fitTo: { mode: 'width', value: size } }).render().asPng())
png(icon, 192, 'icon-192.png')
png(icon, 512, 'icon-512.png')
png(fullBleed, 180, 'apple-touch-icon.png')
png(maskable, 512, 'icon-maskable-512.png')
console.log('Icons erzeugt')
