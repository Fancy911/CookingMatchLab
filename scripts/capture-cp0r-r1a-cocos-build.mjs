import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const variant = process.env.R1A_VARIANT ?? 'base';
const isVisualFix = variant === 'visual-fix';
const reportDirectory = join(
  root,
  'reports',
  'cp0-r',
  'r1a',
  ...(isVisualFix ? ['visual-fix'] : []),
);
const outputName = isVisualFix
  ? 'cp0r-r1a-visual-fix-web-mobile'
  : 'cp0r-r1a-web-mobile';
const buildDirectory = join(root, 'build', outputName);
const evidencePrefix = isVisualFix ? 'CP0R-R1A-FIX' : 'CP0R-R1A';
const resultPath = join(reportDirectory, `${evidencePrefix}-Cocos-Build-Result.json`);
const logPath = join(reportDirectory, `${evidencePrefix}-Cocos-Build-3.8.8.log`);
const creatorBinary = process.env.COCOS_CREATOR_BIN
  ?? '/Applications/CocosCreator.app/Contents/MacOS/CocosCreator';
const buildArgument =
  `platform=web-mobile;debug=false;buildPath=project://build;outputName=${outputName}`;

const listFiles = (directory) => readdirSync(directory).flatMap((entry) => {
  const path = join(directory, entry);
  return statSync(path).isDirectory() ? listFiles(path) : [path];
});

mkdirSync(reportDirectory, { recursive: true });
rmSync(buildDirectory, { recursive: true, force: true });
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
  /Arguments:|project: <PROJECT_ROOT>|Version information looks good|Register CP0ABattleShell|engineVersion="3\.8\.8"|Build Assets success/.test(line)
  || line.includes(`build Task (${outputName}) Finished`));
const failureMarkers = [
  'Missing class',
  'missing or invalid',
  'Build failed',
  'build project failure',
  'Error: Build',
].filter((marker) => raw.includes(marker));
const artifactExists = existsSync(buildDirectory);
const artifactFiles = artifactExists ? listFiles(buildDirectory).sort() : [];
const requiredFiles = [
  'application.js',
  'index.html',
  'index.js',
  'src/settings.json',
].map((path) => ({ path, exists: existsSync(join(buildDirectory, path)) }));
const manifest = artifactFiles.map((path) => {
  const bytes = readFileSync(path);
  return {
    path: relative(buildDirectory, path),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
});
const manifestSha256 = createHash('sha256')
  .update(JSON.stringify(manifest))
  .digest('hex');
const actualExitCodeAccepted = result.status === 0 || result.status === 36;
const verification = {
  actualExitCode: result.status,
  actualSignal: result.signal,
  actualExitCodeAccepted,
  creatorVersionConfigured: JSON.parse(
    readFileSync(join(root, 'package.json'), 'utf8'),
  ).creator?.version === '3.8.8',
  shellRegistered: raw.includes('Register CP0ABattleShell'),
  engineVersionConfirmed: raw.includes('engineVersion="3.8.8"'),
  buildFinished: new RegExp(`build Task \\(${outputName}\\) Finished`).test(raw),
  artifactExists,
  artifactFileCount: artifactFiles.length,
  requiredFiles,
  manifestSha256,
  failureMarkers,
};
const passed = verification.creatorVersionConfigured
  && verification.shellRegistered
  && verification.engineVersionConfirmed
  && verification.buildFinished
  && verification.actualExitCodeAccepted
  && verification.artifactExists
  && verification.artifactFileCount > 0
  && requiredFiles.every((item) => item.exists)
  && failureMarkers.length === 0;
const record = {
  reportId: isVisualFix
    ? 'CP0-R-R1-A-VISUAL-FIX-COCOS-BUILD'
    : 'CP0-R-R1-A-COCOS-BUILD',
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
  buildArtifact: {
    directory: `build/${outputName}`,
    fileCount: artifactFiles.length,
    manifestSha256,
  },
  verification,
  rawOutputSha256: createHash('sha256').update(raw).digest('hex'),
  retainedLog: relative(root, logPath),
};
writeFileSync(resultPath, `${JSON.stringify(record, null, 2)}\n`);
writeFileSync(logPath, [
  `# CP0-R1-A${isVisualFix ? ' Visual Fix' : ''} Cocos Creator build evidence`,
  `generatedAt=${record.generatedAt}`,
  'creatorVersion=3.8.8',
  'platform=web-mobile',
  `actualExitCode=${result.status ?? 'null'}`,
  `actualSignal=${result.signal ?? 'none'}`,
  `actualExitCodeAccepted=${actualExitCodeAccepted}`,
  `buildFinished=${verification.buildFinished}`,
  `artifactExists=${artifactExists}`,
  `artifactFileCount=${artifactFiles.length}`,
  `artifactManifestSha256=${manifestSha256}`,
  `requiredFiles=${requiredFiles.map((item) => `${item.path}:${item.exists}`).join(',')}`,
  `failureMarkers=${failureMarkers.length ? failureMarkers.join(',') : 'none'}`,
  `status=${record.status}`,
  `rawOutputSha256=${record.rawOutputSha256}`,
  '',
  '# Sanitized key build lines',
  ...keyLines,
  '',
].join('\n'));
console.log(`CP0-R1-A${isVisualFix ? ' Visual Fix' : ''} Cocos build evidence: ${record.status}`);
console.log(relative(root, resultPath));
if (!passed) process.exitCode = 1;
