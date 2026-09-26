// Read-only report of the same canonical inventory used by capture UI/reconstruction.
import {
  PERFORMANCE_STAGES,
  PERFORMANCE_SUPPORT,
  SUPPORT_LABELS,
  performanceReleaseMatrix,
} from '../src/utils/performanceSupport.js';
import { execFileSync } from 'node:child_process';
if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      performanceReleaseMatrix(
        execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
      ),
      null,
      2
    )
  );
  process.exit(0);
}
console.log('# Performance action implementation inventory\n');
console.log(
  'PASS requires stage-specific evidence. Implemented but unqualified paths remain PARTIAL. No row is certified across the complete musical/hardware lifecycle.\n'
);
console.log(`| Action | ${PERFORMANCE_STAGES.join(' | ')} | Destination |`);
console.log(`|---|${PERFORMANCE_STAGES.map(() => '---|').join('')}---|`);
for (const item of PERFORMANCE_SUPPORT)
  console.log(
    `| ${item.label} | ${PERFORMANCE_STAGES.map((stage) => SUPPORT_LABELS[item.stages[stage]]).join(' | ')} | ${item.destination} |`
  );
console.log('\n## Conditions\n');
for (const item of PERFORMANCE_SUPPORT) console.log(`- ${item.label}: ${item.limit}`);
