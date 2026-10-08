import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// standardized-audio-context 25.3.77 (MIT) enumerates every possible path even
// in an acyclic graph. Per-grain connect/disconnect through a reconvergent mix
// graph consequently blocks the audio scheduler. Keep its cycle enumeration
// intact, but first prove whether the root is reachable in O(nodes + edges).
// No persistent cache: connect/disconnect changes the graph between calls.
const marker = '// sattari-cycle-reachability-v1';
const precheck = `${marker}
    return function detectCyclesWithReachability(chain, nextLink) {
        var pending = [nextLink];
        var visited = new Set();
        while (pending.length > 0) {
            var link = pending.pop();
            var node = isAudioNode(link) ? link : getValueForKey(audioParamAudioNodeStore, link);
            if (isDelayNode(node) || visited.has(node)) continue;
            if (node === chain[0]) return detectCycles(chain, nextLink);
            visited.add(node);
            getAudioNodeConnections(node).outputs.forEach(function (connection) {
                pending.push(connection[0]);
            });
        }
        return [];
    };`;
const hash = (value) => createHash('sha256').update(value).digest('hex');

export function patchCycleFactory(original, expectedHash) {
  // Validate the *original* body even when already patched. Unknown versions or
  // modified upstream code fail closed, rather than silently changing semantics.
  const clean = original
    .replace(`\n${precheck}`, '')
    .replace(
      'function detectCycles(chain, nextLink) {',
      'return function detectCycles(chain, nextLink) {'
    );
  const unpatched = original.includes(marker) ? clean : original;
  if (hash(unpatched) !== expectedHash)
    throw new Error(
      'Unrecognized audio cycle factory; review the dependency patch before upgrading'
    );
  const patched = unpatched.replace(
    'return function detectCycles(chain, nextLink)',
    'function detectCycles(chain, nextLink)'
  );
  const end = patched.lastIndexOf('\n');
  return `${patched.slice(0, end)}\n${precheck}${patched.slice(end)}`;
}

export async function applyAudioCyclePrecheck(
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
) {
  const dependency = path.join(root, 'node_modules/standardized-audio-context');
  const metadata = JSON.parse(await readFile(path.join(dependency, 'package.json'), 'utf8'));
  if (metadata.version !== '25.3.77')
    throw new Error(
      `Audio cycle patch requires reviewed version 25.3.77, received ${metadata.version}`
    );
  const specs = [
    {
      file: 'build/es2019/factories/detect-cycles.js',
      start: 'export const createDetectCycles',
      end: '\n//# sourceMappingURL',
      hash: 'c501aac36469b2ec415fb14ddcae8a92f097e39c29929e259350be74970cb4c2',
    },
    {
      file: 'build/es5/bundle.js',
      start: '    var createDetectCycles =',
      end: '\n\n    var getOutputAudioNodeAtIndex',
      hash: '08ea3380e7f89b1a0fe119749afa03fe5022989569cabff5d193af1964ec772c',
    },
  ];
  // Validate both entry points before writing either. Reapplication is idempotent.
  const updates = await Promise.all(
    specs.map(async (spec) => {
      const filename = path.join(dependency, spec.file);
      const source = await readFile(filename, 'utf8');
      const start = source.indexOf(spec.start);
      const end = source.indexOf(spec.end, start);
      if (start < 0 || end < 0) throw new Error(`Audio cycle factory missing: ${spec.file}`);
      return {
        filename,
        source:
          source.slice(0, start) +
          patchCycleFactory(source.slice(start, end), spec.hash) +
          source.slice(end),
      };
    })
  );
  for (const update of updates) await writeFile(update.filename, update.source);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await applyAudioCyclePrecheck();
  console.log('Applied reviewed audio cycle reachability precheck (ESM and bundled entry points).');
}
