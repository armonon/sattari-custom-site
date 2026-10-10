import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  patchCycleFactory,
  applyAudioCyclePrecheck,
} from '../scripts/apply-audio-cycle-precheck.mjs';

const source = readFileSync(
  path.resolve(
    process.cwd(),
    'node_modules/standardized-audio-context/build/es2019/factories/detect-cycles.js'
  ),
  'utf8'
);
const body = source.slice(
  source.indexOf('export const createDetectCycles'),
  source.indexOf('\n//# sourceMappingURL')
);
const expectedHash = 'c501aac36469b2ec415fb14ddcae8a92f097e39c29929e259350be74970cb4c2';
const instantiate = (text) =>
  new Function(
    'isAudioNode',
    'isDelayNode',
    `${text.replace('export const ', 'const ')}; return createDetectCycles;`
  )(
    (node) => 'context' in node,
    (node) => 'delayTime' in node
  );
const createDetectCycles = instantiate(body);
const originalBody = body
  .replace(/\n\/\/ sattari-cycle-reachability-v1[\s\S]*(?=\n};$)/, '')
  .replace(
    'function detectCycles(chain, nextLink)',
    'return function detectCycles(chain, nextLink)'
  );
const createOriginal = instantiate(originalBody);
function graph(factory = createDetectCycles) {
  let reads = 0;
  const parameters = new Map();
  const node = (name, ...destinations) => ({
    name,
    context: {},
    outputs: new Set(destinations.map((dest) => [dest])),
  });
  const parameter = (owner) => {
    const value = {};
    parameters.set(value, owner);
    return value;
  };
  const detect = factory(
    parameters,
    (value) => {
      reads++;
      return value;
    },
    (map, key) => {
      if (!map.has(key)) throw Error('Unknown parameter');
      return map.get(key);
    }
  );
  return { node, parameter, detect, reads: () => reads };
}

describe('installed audio cycle reachability patch', () => {
  it('is version-fenced, idempotent, and rejects altered source', async () => {
    expect(createHash('sha256').update(originalBody).digest('hex')).toBe(expectedHash);
    expect(patchCycleFactory(originalBody, expectedHash)).toBe(body);
    expect(patchCycleFactory(body, expectedHash)).toBe(body);
    expect(() =>
      patchCycleFactory(body.replace('chain.includes', 'chain.indexOf'), expectedHash)
    ).toThrow(/Unrecognized/);
    await applyAudioCyclePrecheck(process.cwd());
  });
  it('refuses an unreviewed dependency version before modifying installed code', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'audio-cycle-version-'));
    try {
      const dependency = path.join(root, 'node_modules/standardized-audio-context');
      await mkdir(dependency, { recursive: true });
      await writeFile(
        path.join(dependency, 'package.json'),
        JSON.stringify({ version: '25.3.78' })
      );
      await expect(applyAudioCyclePrecheck(root)).rejects.toThrow(/requires reviewed version/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('visits each node only once in a deep reconvergent acyclic graph', () => {
    for (const factory of [createOriginal, createDetectCycles]) {
      const g = graph(factory);
      const root = g.node('root');
      let tail = g.node('sink');
      for (let level = 0; level < 14; level++)
        tail = g.node('fork', g.node('left', tail), g.node('right', tail));
      expect(g.detect([root], tail)).toEqual([]);
      if (factory === createOriginal) expect(g.reads()).toBeGreaterThan(60000);
      else expect(g.reads()).toBe(43);
    }
  });
  it('preserves every feedback path and path order, including AudioParam connections', () => {
    const g = graph();
    const root = g.node('root');
    const a = g.node('a', root);
    const b = g.node('b', g.parameter(root));
    const fork = g.node('fork', a, b);
    expect(g.detect([root], fork)).toEqual([
      [root, fork, a],
      [root, fork, b],
    ]);
    expect(g.detect([root], root)).toEqual([[root]]);
    expect(g.detect([root], g.parameter(root))).toEqual([[root]]);
  });
  it('stops at delay nodes, as required by upstream cycle handling', () => {
    const g = graph();
    const root = g.node('root');
    const delay = Object.assign(g.node('delay', root), { delayTime: {} });
    expect(g.detect([root], delay)).toEqual([]);
    expect(g.detect([delay], delay)).toEqual([]);
  });
  it('terminates on non-root cycles and follows newly connected/disconnected paths', () => {
    const g = graph();
    const root = g.node('root');
    const a = g.node('a');
    const b = g.node('b', a);
    a.outputs.add([b]);
    expect(g.detect([root], a)).toEqual([]);
    const edge = [root];
    b.outputs.add(edge);
    expect(g.detect([root], a)).toEqual([[root, a, b]]);
    b.outputs.delete(edge);
    expect(g.detect([root], a)).toEqual([]);
    b.outputs.add(edge);
    expect(g.detect([root, a], b)).toEqual([[root, a, b]]);
    expect(g.detect([root, a], a)).toEqual([]);
  });
  it('agrees with upstream on all directed graphs of three nodes, with and without a delay', () => {
    for (let bits = 0; bits < 512; bits++)
      for (const delay of [false, true]) {
        const g = graph();
        const nodes = [g.node('a'), g.node('b'), g.node('c')];
        if (delay) nodes[2].delayTime = {};
        for (let edge = 0; edge < 9; edge++)
          if (bits & (1 << edge)) nodes[Math.floor(edge / 3)].outputs.add([nodes[edge % 3]]);
        const original = createOriginal(
          new Map(),
          (node) => node,
          (map, key) => map.get(key)
        );
        expect(g.detect([nodes[0]], nodes[1])).toEqual(original([nodes[0]], nodes[1]));
      }
  });
  it('patches the bundled entry point with identical reachable-cycle behavior', () => {
    const bundled = readFileSync(
      path.resolve(process.cwd(), 'node_modules/standardized-audio-context/build/es5/bundle.js'),
      'utf8'
    );
    const start = bundled.indexOf('    var createDetectCycles =');
    const end = bundled.indexOf('\n\n    var getOutputAudioNodeAtIndex', start);
    const factory = new Function(
      'isAudioNode',
      'isDelayNode',
      '_toConsumableArray',
      `${bundled.slice(start, end)}; return createDetectCycles;`
    )(
      (node) => 'context' in node,
      (node) => 'delayTime' in node,
      (value) => [...value]
    );
    const g = graph(factory);
    const root = g.node('root');
    const leaf = g.node('leaf', root);
    expect(g.detect([root], leaf)).toEqual([[root, leaf]]);
    leaf.outputs.clear();
    expect(g.detect([root], leaf)).toEqual([]);
  });
});
