import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const outputDirectory = join(root, 'reports', 'cp0-r', 'r0', 'a1');
const resultPath = join(outputDirectory, 'CP0R-R0-A1-Command-Results.json');
const logPath = join(outputDirectory, 'CP0R-R0-A1-Verification.log');
mkdirSync(outputDirectory, { recursive: true });

const commands = [
  ['npm', ['test']],
  ['npm', ['run', 'test:unit']],
  ['npm', ['run', 'test:scenarios']],
  ['npm', ['run', 'test:r0']],
  ['npm', ['run', 'typecheck']],
];
const results = [];
const log = [
  '# CP0-R0-A1 reproducible command verification',
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
  const command = [executable, ...args].join(' ');
  const record = {
    command,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    exitCode: result.status,
    signal: result.signal,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    outputSha256: createHash('sha256').update(output).digest('hex'),
  };
  results.push(record);
  log.push(
    `## ${command}`,
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
  reportId: 'CP0-R-R0-A1-COMMAND-RESULTS',
  generatedAt: new Date().toISOString(),
  status: results.every((result) => result.status === 'PASS') ? 'PASS' : 'FAIL',
  nodeVersion: process.version,
  commands: results,
};
writeFileSync(resultPath, `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(logPath, log.join('\n'));

console.log(`CP0-R0-A1 command verification: ${summary.status}`);
console.log(relative(root, resultPath));
if (summary.status !== 'PASS') {
  process.exitCode = 1;
}
