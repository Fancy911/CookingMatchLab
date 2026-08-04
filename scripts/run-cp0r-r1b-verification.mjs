import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const reportSubdirectory = process.env.CP0R_R1B_REPORT_SUBDIR ?? '';
const evidencePrefix = process.env.CP0R_R1B_EVIDENCE_PREFIX ?? 'CP0R-R1B';
const reportDirectory = join(
  root,
  'reports',
  'cp0-r',
  'r1b',
  reportSubdirectory,
);
mkdirSync(reportDirectory, { recursive: true });

const commands = [
  ['npm', ['test']],
  ['npm', ['run', 'test:unit']],
  ['npm', ['run', 'test:scenarios']],
  ['npm', ['run', 'test:r0']],
  ['npm', ['run', 'test:r1a']],
  ['npm', ['run', 'test:r1b']],
  ['npm', ['run', 'typecheck']],
];
const records = [];
const log = [
  '# CP0-R1-B reproducible verification',
  `generatedAt=${new Date().toISOString()}`,
  `node=${process.version}`,
  '',
];

for (const [executable, args] of commands) {
  const startedAt = new Date();
  const started = performance.now();
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.replace(/\r\n?/g, '\n');
  const record = {
    command: [executable, ...args].join(' '),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    exitCode: result.status,
    signal: result.signal,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    outputSha256: createHash('sha256').update(output).digest('hex'),
  };
  records.push(record);
  log.push(
    `## ${record.command}`,
    `status=${record.status}`,
    `exitCode=${record.exitCode ?? 'null'}`,
    `durationMs=${record.durationMs}`,
    `outputSha256=${record.outputSha256}`,
    '',
    output,
    '',
  );
}

const summary = {
  reportId: `${evidencePrefix}-COMMAND-RESULTS`,
  generatedAt: new Date().toISOString(),
  status: records.every(({ status }) => status === 'PASS') ? 'PASS' : 'FAIL',
  nodeVersion: process.version,
  commands: records,
};
writeFileSync(
  join(reportDirectory, `${evidencePrefix}-Command-Results.json`),
  `${JSON.stringify(summary, null, 2)}\n`,
);
writeFileSync(
  join(reportDirectory, `${evidencePrefix}-Verification.log`),
  `${log.join('\n').trimEnd()}\n`,
);
console.log(`CP0-R1-B command verification: ${summary.status}`);
console.log(relative(root, reportDirectory));
if (summary.status !== 'PASS') process.exitCode = 1;
