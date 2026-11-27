#!/usr/bin/env node
// Keep the fitted guitar-wall slab; copy every retained SPZ attribute verbatim.
// SPZ v2 layout: https://github.com/nianticlabs/spz#file-format
// Usage: node scripts/filter-showroom-spz.mjs [--min -0.4] [--max 0.55]
// This is a reversible geometric crop, not a reconstruction or image edit.
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = {
  input: 'public/showroom/guitar-wall-atlas.spz',
  output: 'public/showroom/guitar-wall-front.spz',
  manifest: 'docs/showroom-front-filter.json',
  min: -0.4,
  max: 0.55,
};
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index].replace(/^--/, '');
  const value = process.argv[index + 1];
  if (!(key in options) || value === undefined)
    throw new Error(`Unknown or incomplete option: ${key}`);
  options[key] = key === 'min' || key === 'max' ? Number(value) : value;
}
if (!Number.isFinite(options.min) || !Number.isFinite(options.max) || options.min >= options.max)
  throw new Error('The distance band must be finite and increasing.');
const inputPath = resolve(projectRoot, options.input);
const outputPath = resolve(projectRoot, options.output);
const manifestPath = resolve(projectRoot, options.manifest);
if (inputPath === outputPath || inputPath === manifestPath || outputPath === manifestPath)
  throw new Error('Input, derivative, and provenance must have distinct paths.');

const original = await readFile(inputPath);
const raw = gunzipSync(original);
if (raw.length < 16 || raw.readUInt32LE(0) !== 0x5053474e || raw.readUInt32LE(4) !== 2)
  throw new Error('This filter requires a gzip-compressed SPZ v2 asset.');
const count = raw.readUInt32LE(8);
const shDegree = raw[12];
const fractionalBits = raw[13];
if (shDegree > 3 || fractionalBits > 23) throw new Error('Unexpected SPZ attribute encoding.');
const shBytes = [0, 9, 24, 45][shDegree];
const attributes = [
  ['positions', 9],
  ['alphas', 1],
  ['colors', 3],
  ['scales', 3],
  ['rotations', 3],
  ['sphericalHarmonics', shBytes],
];
const bytesPerPoint = attributes.reduce((sum, [, stride]) => sum + stride, 0);
if (raw.length !== 16 + count * bytesPerPoint)
  throw new Error('Unexpected SPZ stream length; refusing to discard unknown data.');

// Lower-wall fit, 14,543 samples, from frontal-camera-candidate.json.
// x = a*y + b*z + c. Positive signed distance points into the room.
const plane = {
  a: 0.0037473263179399474,
  b: 0.07362146874269582,
  c: -1.7838554488730078,
};
const normalLength = Math.hypot(1, plane.a, plane.b);
const positionScale = 2 ** -fractionalBits;
const signed24 = (offset) => {
  const value = raw[offset] | (raw[offset + 1] << 8) | (raw[offset + 2] << 16);
  return (value & 0x800000 ? value - 0x1000000 : value) * positionScale;
};
const selected = new Uint32Array(count);
let kept = 0;
let behind = 0;
let inFront = 0;
const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
let minimumDistance = Infinity;
let maximumDistance = -Infinity;
for (let index = 0; index < count; index++) {
  const offset = 16 + index * 9;
  const x = signed24(offset);
  const y = signed24(offset + 3);
  const z = signed24(offset + 6);
  const distance = (x - plane.a * y - plane.b * z - plane.c) / normalLength;
  if (distance < options.min) behind++;
  else if (distance > options.max) inFront++;
  else {
    selected[kept++] = index;
    const point = [x, y, z];
    for (let axis = 0; axis < 3; axis++) {
      bounds.min[axis] = Math.min(bounds.min[axis], point[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], point[axis]);
    }
    minimumDistance = Math.min(minimumDistance, distance);
    maximumDistance = Math.max(maximumDistance, distance);
  }
}
if (!kept) throw new Error('The filter selected no splats; no derivative was written.');
const output = Buffer.allocUnsafe(16 + kept * bytesPerPoint);
raw.copy(output, 0, 0, 16);
output.writeUInt32LE(kept, 8);
let sourceOffset = 16;
let destinationOffset = 16;
for (const [, stride] of attributes) {
  if (!stride) continue;
  for (let index = 0; index < kept; index++) {
    const start = sourceOffset + selected[index] * stride;
    raw.copy(output, destinationOffset + index * stride, start, start + stride);
  }
  sourceOffset += count * stride;
  destinationOffset += kept * stride;
}
if (sourceOffset !== raw.length || destinationOffset !== output.length)
  throw new Error('Attribute stream accounting failed.');
const derivative = gzipSync(output, { level: 9 });
if (!gunzipSync(derivative).equals(output)) throw new Error('Derivative gzip round-trip failed.');
// Verify every retained attribute against the original, not just the positions.
sourceOffset = 16;
destinationOffset = 16;
for (const [, stride] of attributes) {
  if (!stride) continue;
  for (let index = 0; index < kept; index++) {
    const originalStart = sourceOffset + selected[index] * stride;
    const derivativeStart = destinationOffset + index * stride;
    if (
      !raw
        .subarray(originalStart, originalStart + stride)
        .equals(output.subarray(derivativeStart, derivativeStart + stride))
    )
      throw new Error('A retained attribute changed during filtering.');
  }
  sourceOffset += count * stride;
  destinationOffset += kept * stride;
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const provenance = {
  operation: 'Filter existing Gaussian centers to a fitted wall-plane distance band',
  source: {
    path: relative(projectRoot, inputPath),
    sha256: sha256(original),
    bytes: original.length,
    splats: count,
  },
  derivative: {
    path: relative(projectRoot, outputPath),
    sha256: sha256(derivative),
    bytes: derivative.length,
    splats: kept,
  },
  encoding: { spzVersion: 2, shDegree, fractionalBits, flags: raw[14], reserved: raw[15] },
  filter: {
    planeEquation: 'x = a*y + b*z + c',
    coefficients: plane,
    distanceDefinition: '(x - a*y - b*z - c) / sqrt(1 + a*a + b*b)',
    inclusiveDistanceRange: [options.min, options.max],
    axisAlignedCrop: null,
    removedBehindWall: behind,
    removedInFrontOfWall: inFront,
    retainedDistanceRange: [minimumDistance, maximumDistance],
    retainedBounds: bounds,
  },
  provenance: {
    fit: '../showroom-concepts/atlas-run/frontal-camera-candidate.json',
    format: 'https://github.com/nianticlabs/spz#file-format',
    reproduction: `node scripts/filter-showroom-spz.mjs --min ${options.min} --max ${options.max}`,
    preserves:
      'Original file unchanged. Every retained position, opacity, color, scale, rotation, and SH byte is copied without requantization.',
    limitation:
      'A geometric crop removes off-wall centers, not all splat extents; visual QA is required. It does not recover unseen geometry or add product detail.',
  },
  validation: {
    gzipRoundTrip: true,
    allRetainedAttributesUnchanged: true,
    visualReview: 'pending',
  },
};
await writeFile(`${outputPath}.tmp`, derivative);
await rename(`${outputPath}.tmp`, outputPath);
await writeFile(manifestPath, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      output: provenance.derivative,
      removed: { behind, inFront },
      retainedBounds: bounds,
      provenance: relative(projectRoot, manifestPath),
    },
    null,
    2
  )
);
