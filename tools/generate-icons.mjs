/**
 * Generates every PNG asset used by the plugin.
 *
 * The icons are drawn as signed distance fields and encoded with the built-in
 * zlib, so the build needs no image dependencies. Run with `npm run icons`.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const imgs = resolve(root, "com.moritz-koschel.radioboss.sdPlugin/imgs");

/* -------------------------------------------------------------------------- */
/* PNG encoding                                                               */
/* -------------------------------------------------------------------------- */

const crcTable = (() => {
	const table = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c;
	}
	return table;
})();

function crc32(buffer) {
	let c = -1;
	for (const byte of buffer) {
		c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
	}
	return (c ^ -1) >>> 0;
}

function chunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);

	const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));

	return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
	const stride = size * 4;
	const raw = Buffer.alloc((stride + 1) * size);
	for (let y = 0; y < size; y++) {
		rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
	}

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // truecolour with alpha

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0))
	]);
}

/* -------------------------------------------------------------------------- */
/* Signed distance fields (unit square, y grows downwards)                    */
/* -------------------------------------------------------------------------- */

const length2 = (x, y) => Math.hypot(x, y);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function sdSegment(px, py, ax, ay, bx, by, r) {
	const pax = px - ax;
	const pay = py - ay;
	const bax = bx - ax;
	const bay = by - ay;
	const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
	return length2(pax - bax * h, pay - bay * h) - r;
}

/** Lower half of a ring, with rounded caps at both ends — the mic's bracket. */
function sdArcDown(px, py, cx, cy, radius, thickness) {
	const caps = Math.min(length2(px - (cx - radius), py - cy), length2(px - (cx + radius), py - cy)) - thickness;
	if (py < cy) {
		return caps;
	}
	return Math.min(Math.abs(length2(px - cx, py - cy) - radius) - thickness, caps);
}

function sdRoundedRect(px, py, cx, cy, halfW, halfH, r) {
	const qx = Math.abs(px - cx) - (halfW - r);
	const qy = Math.abs(py - cy) - (halfH - r);
	return length2(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Distance to the microphone glyph, drawn inside the unit square. */
function sdMicrophone(px, py) {
	const capsule = sdSegment(px, py, 0.5, 0.215, 0.5, 0.435, 0.108);
	const bracket = sdArcDown(px, py, 0.5, 0.415, 0.205, 0.039);
	const stem = sdSegment(px, py, 0.5, 0.62, 0.5, 0.775, 0.039);
	const base = sdSegment(px, py, 0.355, 0.79, 0.645, 0.79, 0.039);
	return Math.min(capsule, bracket, stem, base);
}

/** The diagonal "muted" stroke, running corner to corner across the glyph. */
function sdSlash(px, py, thickness) {
	return sdSegment(px, py, 0.185, 0.145, 0.815, 0.855, thickness);
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

const hex = (value) => [
	parseInt(value.slice(1, 3), 16),
	parseInt(value.slice(3, 5), 16),
	parseInt(value.slice(5, 7), 16)
];

/**
 * Renders a single icon.
 *
 * @param {object} options
 * @param {number} options.size Width and height, in pixels.
 * @param {string} options.color Glyph colour, as `#rrggbb`.
 * @param {boolean} [options.muted] Draws the diagonal stroke when `true`.
 * @param {number} [options.scale] Fraction of the canvas the glyph occupies.
 * @param {string} [options.background] Rounded-rect backdrop, as `#rrggbb`.
 * @returns {Buffer} The encoded PNG.
 */
function render({ size, color, muted = false, scale = 0.66, background }) {
	const rgba = Buffer.alloc(size * size * 4);
	const [gr, gg, gb] = hex(color);
	const [br, bg, bb] = background ? hex(background) : [0, 0, 0];

	// One device pixel, expressed in the glyph's own coordinate space.
	const aa = 1 / (size * scale);
	const coverage = (d) => clamp(0.5 - d / aa, 0, 1);

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			// Canvas pixel -> unit square, centred and scaled.
			const ux = ((x + 0.5) / size - 0.5) / scale + 0.5;
			const uy = ((y + 0.5) / size - 0.5) / scale + 0.5;

			let glyph = coverage(sdMicrophone(ux, uy));
			if (muted) {
				// Punch a gap around the stroke so it stays readable, then add the stroke.
				glyph *= 1 - coverage(sdSlash(ux, uy, 0.085));
				glyph = Math.min(1, glyph + coverage(sdSlash(ux, uy, 0.036)));
			}

			let r = gr;
			let g = gg;
			let b = gb;
			let a = glyph;

			if (background) {
				// The backdrop is drawn in canvas space, so `scale` does not affect it.
				const bx = (x + 0.5) / size;
				const by = (y + 0.5) / size;
				const back = clamp(0.5 - sdRoundedRect(bx, by, 0.5, 0.5, 0.5, 0.5, 0.24) * size, 0, 1);
				a = back + glyph * (1 - back);
				if (a > 0) {
					// Composite the glyph over the backdrop, then un-premultiply.
					r = (gr * glyph + br * back * (1 - glyph)) / a;
					g = (gg * glyph + bg * back * (1 - glyph)) / a;
					b = (gb * glyph + bb * back * (1 - glyph)) / a;
				}
			}

			const i = (y * size + x) * 4;
			rgba[i] = Math.round(r);
			rgba[i + 1] = Math.round(g);
			rgba[i + 2] = Math.round(b);
			rgba[i + 3] = Math.round(a * 255);
		}
	}

	return encodePng(size, rgba);
}

function write(path, buffer) {
	const target = resolve(imgs, path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, buffer);
	console.log(`${path}  ${buffer.length} bytes`);
}

const LIVE = "#ff3b30";
const MUTED = "#8b919c";
// Action list and category icons must be monochrome white on transparent.
const LIST = "#ffffff";
const BACKDROP = "#1b1e24";

// Action list icon.
write("actions/mic/icon.png", render({ size: 20, color: LIST, scale: 0.86 }));
write("actions/mic/icon@2x.png", render({ size: 40, color: LIST, scale: 0.86 }));

// State 0 — microphone off.
write("actions/mic/key-off.png", render({ size: 72, color: MUTED, muted: true, scale: 0.6 }));
write("actions/mic/key-off@2x.png", render({ size: 144, color: MUTED, muted: true, scale: 0.6 }));

// State 1 — microphone live.
write("actions/mic/key-on.png", render({ size: 72, color: LIVE, scale: 0.6 }));
write("actions/mic/key-on@2x.png", render({ size: 144, color: LIVE, scale: 0.6 }));

// Category icon, and the 256/512 plugin icon the Marketplace requires.
write("plugin/category-icon.png", render({ size: 28, color: LIST, scale: 0.86 }));
write("plugin/category-icon@2x.png", render({ size: 56, color: LIST, scale: 0.86 }));
write("plugin/marketplace.png", render({ size: 256, color: LIVE, scale: 0.56, background: BACKDROP }));
write("plugin/marketplace@2x.png", render({ size: 512, color: LIVE, scale: 0.56, background: BACKDROP }));
