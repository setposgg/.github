/** Rebuild from the setpos source checkout, without copying its data or crosshair code.
 * Node 24+, setpos dependencies installed; node brand/build.mjs [setpos-checkout]
 * Uses local Chrome through Playwright, with no network requests.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(out, '../../..'));
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('playwright-core');
const sharp = require('sharp');
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
const uri = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;
const font = async (file) => (await fs.readFile(path.join(root, 'node_modules', file))).toString('base64');
const fonts = `@font-face{font-family:DM;src:url(data:font/woff2;base64,${await font('@fontsource-variable/dm-sans/files/dm-sans-latin-opsz-normal.woff2')});font-weight:100 1000}@font-face{font-family:Chakra;src:url(data:font/woff2;base64,${await font('@fontsource/chakra-petch/files/chakra-petch-latin-700-normal.woff2')});font-weight:700}`;
const logo = await read('assets/brand/setpos-logo.svg');
const mark = await read('static/favicon.svg');
const avatar = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000"><title>setpos.gg</title><rect width="1000" height="1000" fill="#0b1320"/><svg x="160" y="160" width="680" height="680" viewBox="35 34.6281 199.65 200">${mark.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg></svg>`;
await fs.writeFile(path.join(out, 'avatar.svg'), avatar + '\n');
const radar = await read('static/radars/mirage/radar.svg');
const data = JSON.parse(await read('src/lib/competitive-spawns.json'));
// Read calibration from its source so the card follows changes to the map.
const maps = await read('src/lib/maps.ts');
const calibration = maps.match(/slug: 'mirage',[\s\S]*?calibration: \{ posX: ([-\d.]+), posY: ([-\d.]+), scale: ([\d.]+)/);
if (!calibration) throw new Error('Mirage calibration not found');
const [, ox, oy, scale] = calibration.map(Number);
const slots = data.maps.mirage.slots.filter((s) => s.side === 't');
const points = slots.map((s) => ({ x: (s.x-ox)/scale, y: (oy-s.y)/scale, n: s.label.match(/\d+/)[0] }));
const minX = Math.min(...points.map(p=>p.x))-28, minY = Math.min(...points.map(p=>p.y))-25;
const w = Math.max(...points.map(p=>p.x))-minX+28, h = Math.max(...points.map(p=>p.y))-minY+25;
const size = Math.max(w,h);
const vb = `${minX-(size-w)/2} ${minY-(size-h)/2} ${size} ${size}`;
const spawnRadar = radar.replace(/viewBox="[^"]*"/, `viewBox="${vb}"`).replace(/<\/svg>\s*$/, `${points.map(p=>`<g><circle cx="${p.x}" cy="${p.y}" r="5.5" fill="#f2c66d" stroke="#0b1320" stroke-width="1.2"/><text x="${p.x}" y="${p.y+0.3}" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="5.8" font-weight="700" fill="#0b1320">${p.n}</text></g>`).join('')}</svg>`);
// Import the site's actual renderer, including after its move to the public package.
const source = await read('src/lib/crosshair.ts');
const crosshair = /\bfrom\s+['"]/.test(source)
  ? await import(pathToFileURL(path.join(root, 'src/lib/crosshair.ts')))
  : await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
const { crosshairDrawing, DEFAULT_CROSSHAIR, SITE_CROSSHAIR } = crosshair;
const examples = [
  ['Classic static', SITE_CROSSHAIR],
  ['Dynamic cross', {...DEFAULT_CROSSHAIR, style:0}],
  ['Dynamic quad', {...DEFAULT_CROSSHAIR, color:[146,180,237,255]}],
  ['Static quad', {...DEFAULT_CROSSHAIR, style:8, color:[255,255,255,255]}]
];
const rgba = (c) => `rgba(${c.slice(0,3).join(',')},${c[3]/255})`;
const crosshairs = examples.map(([name, config]) => {
  const d = crosshairDrawing(config, {width:1080,height:1080});
  const [before,after] = d.outline;
  if (d.shapes.some(s=>s.kind!=='rect')) throw new Error('Add a renderer for non-rectangle shapes');
  const rectangles = (outline) => d.shapes.map(s=>`<rect x="${s.x-(outline?before:0)}" y="${s.y-(outline?before:0)}" width="${s.width+(outline?before+after:0)}" height="${s.height+(outline?before+after:0)}"/>`).join('');
  return `<div class="cross"><svg viewBox="500 500 80 80" shape-rendering="crispEdges"><g fill="${rgba(d.outlineColor)}">${rectangles(true)}</g><g fill="${rgba(d.color)}">${rectangles(false)}</g></svg><span>${name}</span></div>`;
}).join('');
const css = `${fonts}*{box-sizing:border-box}body{margin:0;background:#0c1422;color:#f1f2f4;font-family:DM,sans-serif}.card{width:1280px;height:640px;position:relative;overflow:hidden}.brand{position:absolute;left:96px;top:88px;width:244px;height:54px;object-fit:contain}.copy{position:absolute;left:104px;top:210px;width:580px}h1{font:700 76px/1.06 Chakra,sans-serif;letter-spacing:-2px;margin:0 0 26px}p{font-size:27px;line-height:1.4;color:#bcc6d6;margin:0}.foot{position:absolute;left:104px;top:514px;font-size:19px;color:#96a4ba}.visual{position:absolute;left:720px;top:98px;width:456px;height:444px}.map{width:100%;height:100%;object-fit:contain}.map-label{position:absolute;bottom:0;right:0;font-size:18px;color:#bcc6d6;background:#0c1422;padding:8px 0 0 18px}.spawn .visual{border:1px solid #33445e;border-radius:12px;background:#101a2a;overflow:hidden}.spawn .map{height:410px;margin-top:6px}.spawn .map-label{right:16px;bottom:12px;background:#101a2a;padding:0}.cross-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.cross{height:215px;background:#101a2a;border:1px solid #33445e;border-radius:12px;text-align:center}.cross svg{display:block;width:160px;height:160px;margin:4px auto 0}.cross span{font-size:18px;color:#bcc6d6}`;
const specs = [
 ['cs2-minimaps','CS2<br>minimaps','Vector maps, ready to use.<br>Dark + light. SVG + PNG.','CC BY 4.0',`<img class="map" src="${uri(radar)}"><div class="map-label">Mirage</div>`,''],
 ['cs2-spawns','CS2<br>spawns','Every competitive spawn.<br>Positions + console commands.','CC BY 4.0',`<img class="map" src="${uri(spawnRadar)}"><div class="map-label">Mirage · T spawns</div>`,'spawn'],
 ['cs2-crosshair','CS2<br>crosshair','Share codes + exact drawing.<br>With the grenade reticle.','MIT',`<div class="cross-grid">${crosshairs}</div>`,'']
];
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
 const page = await browser.newPage({deviceScaleFactor:1});
 await page.route('**/*', route => route.abort()); // All content is embedded.
 async function render(html, width, height, file) {
  await page.setViewportSize({width,height});
  await page.setContent(html);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
  const png = await page.screenshot({type:'png'});
  const compressed = await sharp(png).png({compressionLevel:9}).toBuffer();
  await fs.writeFile(path.join(out,file),compressed);
  const meta = await sharp(compressed).metadata();
  if (meta.width!==width || meta.height!==height || compressed.length>=1000000) throw new Error(`Invalid output: ${file}`);
  console.log(`${file}: ${width}×${height}, ${compressed.length} bytes`);
 }
 await render(`<style>body{margin:0}svg{display:block}</style>${avatar}`,1000,1000,'avatar.png');
 for (const [repo,title,desc,license,visual,kind] of specs) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="card ${kind}"><img class="brand" src="${uri(logo)}"><div class="copy"><h1>${title}</h1><p>${desc}</p></div><div class="visual">${visual}</div><div class="foot">${repo} &nbsp;·&nbsp; ${license}</div></div></body></html>`;
  await render(html,1280,640,`social-${repo}.png`);
 }
} finally { await browser.close(); }
