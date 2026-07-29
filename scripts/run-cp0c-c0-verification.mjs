import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

const projectRoot = process.cwd();
const reportDirectory = join(projectRoot, 'reports', 'cp0-c', 'c0');
const resultPath = join(reportDirectory, 'CP0C-C0-Command-Results.json');
const transcriptPath = join(reportDirectory, 'CP0C-C0-Clean-Clone-Verification.log');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const git = (...args) => spawnSync('git', args, {
  cwd: projectRoot,
  encoding: 'utf8',
});

const initialStatus = git('status', '--porcelain');
const initialHead = git('rev-parse', 'HEAD');
const initialState = {
  gitHead: initialHead.status === 0 ? initialHead.stdout.trim() : null,
  gitStatusCommandExitCode: initialStatus.status,
  gitClean: initialStatus.status === 0 && initialStatus.stdout.trim().length === 0,
  tempExists: existsSync(join(projectRoot, 'temp')),
  libraryExists: existsSync(join(projectRoot, 'library')),
  nodeModulesExists: existsSync(join(projectRoot, 'node_modules')),
};

const commandDefinitions = [
  { command: 'npm ci', args: ['ci'] },
  { command: 'npm test', args: ['test'] },
  { command: 'npm run test:unit', args: ['run', 'test:unit'] },
  { command: 'npm run test:scenarios', args: ['run', 'test:scenarios'] },
  { command: 'npm run typecheck', args: ['run', 'typecheck'] },
];
const transcriptParts = [
  '# CP0-C-C0 clean clone verification',
  `generatedAt=${new Date().toISOString()}`,
  `nodeVersion=${process.version}`,
  `platform=${process.platform}`,
  `arch=${process.arch}`,
  `initialGitHead=${initialState.gitHead ?? 'UNAVAILABLE'}`,
  `initialGitClean=${initialState.gitClean}`,
  `initialTempExists=${initialState.tempExists}`,
  `initialLibraryExists=${initialState.libraryExists}`,
  `initialNodeModulesExists=${initialState.nodeModulesExists}`,
  '',
];
const commandResults = [];

for (const definition of commandDefinitions) {
  const startedAt = new Date();
  const started = performance.now();
  const result = spawnSync('npm', definition.args, {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const finishedAt = new Date();
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const combinedOutput = `${stdout}${stderr}`;
  const entry = {
    command: definition.command,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: Math.round(performance.now() - started),
    exitCode: result.status,
    signal: result.signal,
    spawnError: result.error?.message ?? null,
    status: result.status === 0 && !result.error ? 'PASS' : 'FAIL',
    stdoutSha256: sha256(stdout),
    stderrSha256: sha256(stderr),
  };
  commandResults.push(entry);
  transcriptParts.push(
    `## ${definition.command}`,
    `startedAt=${entry.startedAt}`,
    `finishedAt=${entry.finishedAt}`,
    `durationMs=${entry.durationMs}`,
    `exitCode=${entry.exitCode ?? 'null'}`,
    `signal=${entry.signal ?? 'none'}`,
    `status=${entry.status}`,
    `stdoutSha256=${entry.stdoutSha256}`,
    `stderrSha256=${entry.stderrSha256}`,
    '',
    combinedOutput.trimEnd(),
    '',
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
}

const passed = initialState.gitClean
  && !initialState.tempExists
  && !initialState.libraryExists
  && !initialState.nodeModulesExists
  && commandResults.every((result) => result.status === 'PASS');
const record = {
  recordId: 'CP0-C-C0-CLEAN-CLONE-VERIFICATION',
  generatedAt: new Date().toISOString(),
  status: passed ? 'PASS' : 'FAIL',
  environment: {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  },
  initialState,
  commands: commandResults,
  transcript: relative(projectRoot, transcriptPath),
};

mkdirSync(reportDirectory, { recursive: true });
writeFileSync(resultPath, `${JSON.stringify(record, null, 2)}\n`);
writeFileSync(transcriptPath, `${transcriptParts.join('\n').trimEnd()}\n`);

console.log(`CP0-C-C0 clean clone verification: ${record.status}`);
console.log(relative(projectRoot, resultPath));
console.log(relative(projectRoot, transcriptPath));

if (!passed) {
  process.exitCode = 1;
}
