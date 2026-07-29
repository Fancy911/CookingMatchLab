import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

const projectRoot = process.cwd();
const reportDirectory = join(projectRoot, 'reports', 'cp0-c', 'c0');
const resultPath = join(reportDirectory, 'CP0C-C0-Cocos-Build-Result.json');
const logPath = join(reportDirectory, 'CP0C-C0-Cocos-Build-3.8.8.log');
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const creatorBinary = process.env.COCOS_CREATOR_BIN
  ?? '/Applications/CocosCreator.app/Contents/MacOS/CocosCreator';
const buildArgument = 'platform=web-mobile;debug=false;buildPath=project://build;outputName=cp0c-c0-web-mobile';
const args = ['--project', projectRoot, '--build', buildArgument];
const startedAt = new Date();
const started = performance.now();
const result = spawnSync(creatorBinary, args, {
  cwd: projectRoot,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const finishedAt = new Date();
const rawOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`.replace(/\r\n?/g, '\n');
const sanitizedOutput = rawOutput.replaceAll(projectRoot, '<PROJECT_ROOT>');
const homeDirectory = process.env.HOME;
const fullySanitizedOutput = homeDirectory
  ? sanitizedOutput.replaceAll(homeDirectory, '<USER_HOME>')
  : sanitizedOutput;
const lines = fullySanitizedOutput.split('\n');
const keyLines = lines.filter((line) =>
  /Arguments:|project: <PROJECT_ROOT>|build: platform=web-mobile|Version information looks good|Register CP0ABattleShell|engineVersion="3\.8\.8"|run build task .* success|Build Assets success|build Task \(cp0c-c0-web-mobile\) Finished/.test(line));
const failureMarkers = [
  'Missing class',
  'missing or invalid',
  'Build failed',
  'build project failure',
].filter((marker) => rawOutput.includes(marker));
const markers = {
  creatorVersionConfigured: packageJson.creator?.version === '3.8.8',
  shellRegistered: rawOutput.includes('Register CP0ABattleShell'),
  engineVersionConfirmed: rawOutput.includes('engineVersion="3.8.8"'),
  releaseBuildConfirmed: rawOutput.includes('debug=false'),
  buildFinished: /build Task \(cp0c-c0-web-mobile\) Finished/.test(rawOutput),
};
const passed = Object.values(markers).every(Boolean) && failureMarkers.length === 0;
const record = {
  recordId: 'CP0-C-C0-COCOS-BUILD',
  generatedAt: finishedAt.toISOString(),
  status: passed ? 'PASS' : 'FAIL',
  creatorVersion: packageJson.creator?.version ?? null,
  platform: 'web-mobile',
  debug: false,
  command: {
    executable: creatorBinary,
    args: ['--project', '<PROJECT_ROOT>', '--build', buildArgument],
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: Math.round(performance.now() - started),
    actualExitCode: result.status,
    actualSignal: result.signal,
    spawnError: result.error?.message ?? null,
  },
  verification: {
    ...markers,
    exitCodeUsedForStatus: false,
    failureMarkers,
  },
  output: {
    rawSha256: createHash('sha256').update(rawOutput).digest('hex'),
    retainedLog: relative(projectRoot, logPath),
    retainedKeyLineCount: keyLines.length,
    sanitization: ['project root', 'user home'],
  },
};
const retainedLog = [
  '# CP0-C-C0 Cocos Creator build evidence',
  `generatedAt=${record.generatedAt}`,
  `creatorVersion=${record.creatorVersion}`,
  `platform=${record.platform}`,
  `debug=${record.debug}`,
  `actualExitCode=${record.command.actualExitCode ?? 'null'}`,
  `actualSignal=${record.command.actualSignal ?? 'none'}`,
  `status=${record.status}`,
  `rawOutputSha256=${record.output.rawSha256}`,
  `failureMarkers=${failureMarkers.length === 0 ? 'none' : failureMarkers.join(',')}`,
  '',
  '# Sanitized key build lines',
  ...keyLines,
  '',
].join('\n');

mkdirSync(reportDirectory, { recursive: true });
writeFileSync(resultPath, `${JSON.stringify(record, null, 2)}\n`);
writeFileSync(logPath, retainedLog);

console.log(`CP0-C-C0 Cocos build evidence: ${record.status}`);
console.log(relative(projectRoot, resultPath));
console.log(relative(projectRoot, logPath));

if (!passed) {
  process.exitCode = 1;
}
