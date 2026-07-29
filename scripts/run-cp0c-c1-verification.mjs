import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outputDirectory = join(root, 'reports', 'cp0-c', 'c1');
const resultPath = join(outputDirectory, 'CP0C-C1-Command-Results.json');
const logPath = join(outputDirectory, 'CP0C-C1-Verification.log');
const commands = [
  ['npm test', ['npm', ['test']]],
  ['npm run test:unit', ['npm', ['run', 'test:unit']]],
  ['npm run test:scenarios', ['npm', ['run', 'test:scenarios']]],
  ['npm run test:c1', ['npm', ['run', 'test:c1']]],
  ['npm run typecheck', ['npm', ['run', 'typecheck']]],
];

const results = [];
const logs = [];
for (const [label, [executable, args]] of commands) {
  const started = performance.now();
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  results.push({
    command: label,
    exitCode: result.status,
    signal: result.signal,
    durationMs: Math.round(performance.now() - started),
    status: result.status === 0 ? 'PASS' : 'FAIL',
  });
  logs.push(`$ ${label}`, output.trim(), '');
}

const sourceFiles = [
  ...['domain', 'application'].flatMap((layer) => {
    const directory = join(root, 'assets', 'game', 'scripts', layer);
    return spawnSync('find', [directory, '-name', '*.ts', '-type', 'f'], {
      encoding: 'utf8',
    }).stdout.trim().split('\n').filter(Boolean);
  }),
];
const sourceText = sourceFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const gameplayFiles = spawnSync(
  'find',
  [join(root, 'assets', 'game', 'scripts'), '-name', '*.ts', '-type', 'f'],
  { encoding: 'utf8' },
).stdout.trim().split('\n').filter(Boolean);
const gameplayText = gameplayFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const staticAudit = {
  domainApplicationNoCocos: !/from ['"]cc['"]/.test(sourceText),
  domainApplicationNoNodeBuiltins: !/from ['"]node:/.test(sourceText),
  gameplayNoMathRandom: !/\bMath\.random\s*\(/.test(gameplayText),
  noStaticStateSwitch: !/[?&]state=|DIGIT_1|DIGIT_2|DIGIT_3/.test(gameplayText),
  singleBoardController: gameplayFiles.filter((file) =>
    file.endsWith('/BattleBoardController.ts')).length === 1,
};
const staticStatus = Object.values(staticAudit).every(Boolean);
results.push({
  command: 'C1 static architecture audit',
  exitCode: staticStatus ? 0 : 1,
  signal: null,
  durationMs: 0,
  status: staticStatus ? 'PASS' : 'FAIL',
  details: staticAudit,
});

const status = results.every((result) => result.status === 'PASS') ? 'PASS' : 'FAIL';
const record = {
  reportId: 'CP0-C-C1-COMMANDS',
  generatedAt: new Date().toISOString(),
  status,
  nodeVersion: process.version,
  configHash: '8737fa94',
  results,
};
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(resultPath, `${JSON.stringify(record, null, 2)}\n`);
while (logs.at(-1) === '') {
  logs.pop();
}
writeFileSync(logPath, `${logs.join('\n')}\n`);
console.log(`CP0-C-C1 command verification: ${status}`);
console.log(resultPath);
if (status !== 'PASS') {
  process.exitCode = 1;
}
