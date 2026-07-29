import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const outputDirectory = join(root, 'reports', 'cp0-c', 'c1');
const resultPath = join(outputDirectory, 'CP0C-C1-Cocos-Build-Result.json');
const logPath = join(outputDirectory, 'CP0C-C1-Cocos-Build-3.8.8.log');
const creatorBinary = process.env.COCOS_CREATOR_BIN
  ?? '/Applications/CocosCreator.app/Contents/MacOS/CocosCreator';
const buildArgument =
  'platform=web-mobile;debug=false;buildPath=project://build;outputName=cp0c-c1-web-mobile';
const startedAt = new Date();
const started = performance.now();
const result = spawnSync(
  creatorBinary,
  ['--project', root, '--build', buildArgument],
  { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
const finishedAt = new Date();
const raw = `${result.stdout ?? ''}${result.stderr ?? ''}`.replace(/\r\n?/g, '\n');
const sanitized = raw
  .replaceAll(root, '<PROJECT_ROOT>')
  .replaceAll(process.env.HOME ?? '<NO_HOME>', '<USER_HOME>');
const keyLines = sanitized.split('\n').filter((line) =>
  /Arguments:|project: <PROJECT_ROOT>|Version information looks good|Register CP0ABattleShell|engineVersion="3\.8\.8"|Build Assets success|build Task \(cp0c-c1-web-mobile\) Finished/.test(line));
const failureMarkers = [
  'Missing class',
  'missing or invalid',
  'Build failed',
  'build project failure',
].filter((marker) => raw.includes(marker));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const verification = {
  creatorVersionConfigured: packageJson.creator?.version === '3.8.8',
  shellRegistered: raw.includes('Register CP0ABattleShell'),
  engineVersionConfirmed: raw.includes('engineVersion="3.8.8"'),
  buildFinished: /build Task \(cp0c-c1-web-mobile\) Finished/.test(raw),
  actualExitCode: result.status,
  actualSignal: result.signal,
  failureMarkers,
};
const passed = verification.creatorVersionConfigured
  && verification.shellRegistered
  && verification.engineVersionConfirmed
  && verification.buildFinished
  && failureMarkers.length === 0;
const record = {
  reportId: 'CP0-C-C1-COCOS-BUILD',
  generatedAt: finishedAt.toISOString(),
  status: passed ? 'PASS' : 'FAIL',
  creatorVersion: '3.8.8',
  platform: 'web-mobile',
  debug: false,
  command: {
    executable: creatorBinary,
    args: ['--project', '<PROJECT_ROOT>', '--build', buildArgument],
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: Math.round(performance.now() - started),
  },
  verification,
  rawOutputSha256: createHash('sha256').update(raw).digest('hex'),
  retainedLog: relative(root, logPath),
};
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(resultPath, `${JSON.stringify(record, null, 2)}\n`);
writeFileSync(logPath, [
  '# CP0-C-C1 Cocos Creator build evidence',
  `generatedAt=${record.generatedAt}`,
  `creatorVersion=${record.creatorVersion}`,
  `platform=${record.platform}`,
  `debug=${record.debug}`,
  `actualExitCode=${verification.actualExitCode ?? 'null'}`,
  `actualSignal=${verification.actualSignal ?? 'none'}`,
  `status=${record.status}`,
  `rawOutputSha256=${record.rawOutputSha256}`,
  `failureMarkers=${failureMarkers.length ? failureMarkers.join(',') : 'none'}`,
  '',
  '# Sanitized key build lines',
  ...keyLines,
  '',
].join('\n'));
console.log(`CP0-C-C1 Cocos build evidence: ${record.status}`);
console.log(relative(root, resultPath));
if (!passed) {
  process.exitCode = 1;
}
