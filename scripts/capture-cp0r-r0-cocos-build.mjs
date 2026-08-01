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
const outputDirectory = join(root, 'reports', 'cp0-r', 'r0', 'a1');
const resultPath = join(outputDirectory, 'CP0R-R0-A1-Cocos-Build-Result.json');
const logPath = join(outputDirectory, 'CP0R-R0-A1-Cocos-Build-3.8.8.log');
const outputName = 'cp0r-r0-a1-web-mobile';
const buildDirectory = join(root, 'build', outputName);
const creatorBinary = process.env.COCOS_CREATOR_BIN
  ?? '/Applications/CocosCreator.app/Contents/MacOS/CocosCreator';
const buildArgument =
  `platform=web-mobile;debug=false;buildPath=project://build;outputName=${outputName}`;

const listFiles = (directory) => readdirSync(directory)
  .flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });

mkdirSync(outputDirectory, { recursive: true });
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
  /Arguments:|project: <PROJECT_ROOT>|Version information looks good|Register CP0ABattleShell|engineVersion="3\.8\.8"|Build Assets success|build Task \(cp0r-r0-a1-web-mobile\) Finished/.test(line));
const failureMarkers = [
  'Missing class',
  'missing or invalid',
  'Build failed',
  'build project failure',
  'Error: Build',
].filter((marker) => raw.includes(marker));

const artifactDirectoryExists = existsSync(buildDirectory);
const artifactFiles = artifactDirectoryExists ? listFiles(buildDirectory).sort() : [];
const entryPath = join(buildDirectory, 'index.html');
const entryFileExists = existsSync(entryPath);
const requiredFiles = [
  'application.js',
  'index.html',
  'index.js',
  'src/settings.json',
].map((path) => ({
  path,
  exists: existsSync(join(buildDirectory, path)),
}));
const artifactManifest = artifactFiles.map((path) => {
  const bytes = readFileSync(path);
  return {
    path: relative(buildDirectory, path),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
});
const artifactManifestSha256 = createHash('sha256')
  .update(JSON.stringify(artifactManifest))
  .digest('hex');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const actualExitCode = result.status;
const actualExitCodeAccepted = actualExitCode === 0 || actualExitCode === 36;
const verification = {
  creatorVersionConfigured: packageJson.creator?.version === '3.8.8',
  shellRegistered: raw.includes('Register CP0ABattleShell'),
  engineVersionConfirmed: raw.includes('engineVersion="3.8.8"'),
  buildFinished: new RegExp(`build Task \\(${outputName}\\) Finished`).test(raw),
  actualExitCode,
  actualSignal: result.signal,
  actualExitCodeAccepted,
  artifactDirectoryExists,
  entryFileExists,
  artifactFileCount: artifactFiles.length,
  requiredFiles,
  artifactManifestSha256,
  failureMarkers,
};
const passed = verification.creatorVersionConfigured
  && verification.shellRegistered
  && verification.engineVersionConfirmed
  && verification.buildFinished
  && verification.actualExitCodeAccepted
  && verification.artifactDirectoryExists
  && verification.entryFileExists
  && verification.artifactFileCount > 0
  && verification.requiredFiles.every((item) => item.exists)
  && failureMarkers.length === 0;
const record = {
  reportId: 'CP0-R-R0-A1-COCOS-BUILD',
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
    entryFile: `build/${outputName}/index.html`,
    fileCount: artifactFiles.length,
    requiredFiles,
    manifestSha256: artifactManifestSha256,
  },
  verification,
  exitCode36Rationale: actualExitCode === 36
    ? 'Cocos/Electron returned 36 after emitting Build Assets success and the named build-finished marker. PASS additionally requires a fresh artifact directory, index.html, all required key files, a non-empty manifest, confirmed engine 3.8.8, and zero failure markers.'
    : 'The process returned zero; artifact and marker checks are still required.',
  rawOutputSha256: createHash('sha256').update(raw).digest('hex'),
  retainedLog: relative(root, logPath),
};

writeFileSync(resultPath, `${JSON.stringify(record, null, 2)}\n`);
writeFileSync(logPath, [
  '# CP0-R0-A1 Cocos Creator build evidence',
  `generatedAt=${record.generatedAt}`,
  `creatorVersion=${record.creatorVersion}`,
  `platform=${record.platform}`,
  `debug=${record.debug}`,
  `actualExitCode=${verification.actualExitCode ?? 'null'}`,
  `actualSignal=${verification.actualSignal ?? 'none'}`,
  `actualExitCodeAccepted=${verification.actualExitCodeAccepted}`,
  `buildFinished=${verification.buildFinished}`,
  `artifactDirectoryExists=${verification.artifactDirectoryExists}`,
  `entryFileExists=${verification.entryFileExists}`,
  `artifactFileCount=${verification.artifactFileCount}`,
  `artifactManifestSha256=${verification.artifactManifestSha256}`,
  `requiredFiles=${requiredFiles.map((item) => `${item.path}:${item.exists}`).join(',')}`,
  `failureMarkers=${failureMarkers.length ? failureMarkers.join(',') : 'none'}`,
  `status=${record.status}`,
  `rawOutputSha256=${record.rawOutputSha256}`,
  '',
  '# Exit-code decision',
  record.exitCode36Rationale,
  '',
  '# Sanitized key build lines',
  ...keyLines,
  '',
].join('\n'));
console.log(`CP0-R0-A1 Cocos build evidence: ${record.status}`);
console.log(relative(root, resultPath));
if (!passed) {
  process.exitCode = 1;
}
