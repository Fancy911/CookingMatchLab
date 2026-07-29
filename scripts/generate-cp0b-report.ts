import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ScenarioId } from '../assets/game/scripts/domain/cp0b/types';
import {
  defaultConfigDirectory,
  loadConfigRegistry,
} from '../tools/cp0b/NodeConfigLoader';
import { PrototypeTestRunner } from '../tools/cp0b/PrototypeTestRunner';

interface VitestAssertion {
  title: string;
  status: string;
  duration: number;
  failureMessages: string[];
}

interface VitestJson {
  success: boolean;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  testResults: Array<{ assertionResults: VitestAssertion[] }>;
}

const projectRoot = process.cwd();
const reportDirectory = join(projectRoot, 'reports', 'cp0-b');
const jsonPath = join(reportDirectory, 'CP0B-Test-Report.json');
const markdownPath = join(reportDirectory, 'CP0B-Test-Report.md');
const screenshotRelativePath = 'reports/cp0-b/CP0B-01-Battle-Smoke-390x844.png';
const screenshotPath = join(projectRoot, screenshotRelativePath);
const baselineCommit = execFileSync('git', ['rev-parse', 'cp0-a-baseline^{commit}'], {
  cwd: projectRoot,
  encoding: 'utf8',
}).trim();
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as {
  creator: { version: string };
};

const runVitestJson = (target: string): VitestJson => {
  const result = spawnSync(
    process.execPath,
    [join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs'), 'run', target, '--reporter=json'],
    { cwd: projectRoot, encoding: 'utf8' },
  );
  if (!result.stdout.trim()) {
    throw new Error(`Vitest produced no JSON for ${target}: ${result.stderr}`);
  }
  return JSON.parse(result.stdout) as VitestJson;
};

const flattenAssertions = (result: VitestJson) =>
  result.testResults.flatMap((testResult) => testResult.assertionResults).map((assertion) => ({
    id: assertion.title.split(' ')[0],
    description: assertion.title.replace(/^[US]\d{2}\s*/, ''),
    status: assertion.status === 'passed' ? 'PASS' : 'FAIL',
    durationMs: Number(assertion.duration.toFixed(3)),
    firstDifference: assertion.failureMessages[0] ?? null,
  }));

const listTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? listTypeScriptFiles(path)
      : path.endsWith('.ts')
        ? [path]
        : [];
  });

const runtimeSourceFiles = [
  join(projectRoot, 'assets', 'game', 'scripts', 'domain', 'cp0b'),
  join(projectRoot, 'assets', 'game', 'scripts', 'application', 'cp0c'),
].flatMap(listTypeScriptFiles);
const forbiddenAudit = {
  ccImports: runtimeSourceFiles.flatMap((path) => {
    const text = readFileSync(path, 'utf8');
    return /from\s+['"]cc['"]|require\(['"]cc['"]\)/.test(text)
      ? [relative(projectRoot, path)]
      : [];
  }),
  directMathRandom: runtimeSourceFiles.flatMap((path) => {
    const text = readFileSync(path, 'utf8');
    return text.includes('Math.random(') ? [relative(projectRoot, path)] : [];
  }),
};

const protectedPaths = [
  'assets/game/scenes',
  'assets/game/prefabs',
  'assets/resources/game/art',
];
const protectedDiff = execFileSync(
  'git',
  ['diff', '--name-only', baselineCommit, '--', ...protectedPaths],
  { cwd: projectRoot, encoding: 'utf8' },
).trim().split('\n').filter(Boolean);
const screenshotBytes = existsSync(screenshotPath) ? readFileSync(screenshotPath) : undefined;
const screenshotAudit = screenshotBytes
  && screenshotBytes.subarray(1, 4).toString('ascii') === 'PNG'
  ? {
      path: screenshotRelativePath,
      format: 'PNG',
      width: screenshotBytes.readUInt32BE(16),
      height: screenshotBytes.readUInt32BE(20),
      source: 'Cocos Creator 3.8.8 web-mobile runtime',
    }
  : {
      path: screenshotRelativePath,
      format: null,
      width: 0,
      height: 0,
      source: null,
    };
const screenshotPassed = screenshotAudit.format === 'PNG'
  && screenshotAudit.width === 390
  && screenshotAudit.height === 844;

const unitVitest = runVitestJson('tests/unit');
const scenarioVitest = runVitestJson('tests/scenarios');
const unitTests = flattenAssertions(unitVitest);
const scenarioTests = flattenAssertions(scenarioVitest);
const registry = loadConfigRegistry(defaultConfigDirectory());
const runner = new PrototypeTestRunner(registry, packageJson.creator.version, baselineCommit);
const scenarioIds: ScenarioId[] = [
  'O1_TUTORIAL_001',
  'O2_STANDARD',
  'O2_BLACK',
  'O3_STANDARD',
  'O3_INSPIRATION',
];
const scenarioRuns = scenarioIds.map((id) => runner.run(id));
const delayedAssets = [
  '香葱棋盘/锅中/提示素材',
  '番茄炒蛋之外的5道料理成品素材',
  '灵感、特色、珍稀与黑暗揭晓演出素材',
  '完整粒子、音效与背景音乐',
];
const passed = unitVitest.success
  && scenarioVitest.success
  && unitTests.length === 24
  && scenarioTests.length === 9
  && scenarioRuns.every((run) => run.status === 'PASS')
  && forbiddenAudit.ccImports.length === 0
  && forbiddenAudit.directMathRandom.length === 0
  && protectedDiff.length === 0
  && screenshotPassed;

const report = {
  reportId: 'CP0-B',
  generatedAt: new Date().toISOString(),
  status: passed ? 'PASS' : 'FAIL',
  environment: {
    cocosCreatorVersion: packageJson.creator.version,
    nodeVersion: process.version,
    gitBaselineCommit: baselineCommit,
    configSchemaVersion: registry.gameplay.schemaVersion,
    configHash: registry.configHash,
  },
  deterministicRuntime: {
    gameplayRngAlgorithm: 'xorshift32-v1',
    shuffleAlgorithm: registry.gameplay.shuffle.algorithm,
    fixedScenarioRefill: 'COLUMN_QUEUE (PRNG not used)',
  },
  counts: {
    ingredients: registry.ingredients.length,
    recipes: registry.recipes.length,
    orders: registry.orders.length,
    scenarios: registry.scenarios.length,
    unitTests: unitTests.length,
    scenarioTests: scenarioTests.length,
  },
  unitTests,
  scenarioTests,
  scenarioRuns,
  audits: {
    forbiddenImportsAndRandom: forbiddenAudit,
    cp0aProtectedDiff: {
      baselineCommit,
      paths: protectedPaths,
      changedFiles: protectedDiff,
      status: protectedDiff.length === 0 ? 'PASS' : 'FAIL',
    },
    smokeScreenshot: {
      ...screenshotAudit,
      status: screenshotPassed ? 'PASS' : 'FAIL',
    },
  },
  deferredByStage: delayedAssets,
  firstDifference: passed
    ? null
    : unitTests.find((test) => test.status === 'FAIL')?.firstDifference
      ?? scenarioTests.find((test) => test.status === 'FAIL')?.firstDifference
      ?? scenarioRuns.find((run) => run.status === 'FAIL')?.firstDifference
      ?? 'Static audit failed',
};

const markdownRows = (
  tests: Array<{ id: string; description: string; status: string; durationMs: number; firstDifference: string | null }>,
) => tests.map((test) =>
  `| ${test.id} | ${test.description} | ${test.status} | ${test.durationMs} ms | ${test.firstDifference ?? '—'} |`,
).join('\n');

const runRows = scenarioRuns.map((run) =>
  `| ${run.scenarioId} | ${run.status} | ${run.firstDifference ?? '—'} | ${run.fireResults.map((fire) => fire.recipeId).join(' → ')} | ${run.finalSnapshot.remainingSteps} | \`${run.finalSnapshot.boardHash}\` | \`${run.finalSnapshotHash}\` |`,
).join('\n');

const markdown = `# CP0-B 测试报告

- 总状态：**${report.status}**
- Cocos Creator：\`${packageJson.creator.version}\`
- Node：\`${process.version}\`
- Git 基线：\`${baselineCommit}\`
- 配置 schemaVersion：\`${registry.gameplay.schemaVersion}\`
- 稳定 configHash：\`${registry.configHash}\`
- 固定场景补盘：逐列固定队列，不使用 PRNG
- 普通确定性 RNG：\`xorshift32-v1\`
- 洗牌算法：\`${registry.gameplay.shuffle.algorithm}\`

## 单元测试（U01～U24）

| 编号 | 验证意图 | 结果 | 耗时 | 首个差异 |
| --- | --- | --- | ---: | --- |
${markdownRows(unitTests)}

## 场景测试（S01～S09）

| 编号 | 验证意图 | 结果 | 耗时 | 首个差异 |
| --- | --- | --- | ---: | --- |
${markdownRows(scenarioTests)}

## 固定场景确定性运行摘要

| 场景 | 结果 | 首个差异 | 料理序列 | 最终剩余步数 | boardHash | snapshotHash |
| --- | --- | --- | --- | ---: | --- | --- |
${runRows}

每个动作的 \`status\`、\`firstDifference\`、前后步数、锅中单位、投料位、处理标签、队列位置、棋盘 hash 和快照 hash 均保存在同目录 JSON 报告的 \`scenarioRuns[].actions\` 中；面向人的坐标已转换为 \`r1c1\` 格式。只有全部动作与 \`expectedFinalResult\` 一致，场景和总报告才会标记为 PASS。

## 静态审计

- CP0-B 规则层导入 \`cc\`：${forbiddenAudit.ccImports.length === 0 ? '无' : forbiddenAudit.ccImports.join(', ')}
- 玩法代码直接调用 \`Math.random()\`：${forbiddenAudit.directMathRandom.length === 0 ? '无' : forbiddenAudit.directMathRandom.join(', ')}
- 相对 CP0-A 基线，场景/Prefab/美术目录变更：${protectedDiff.length === 0 ? '无' : protectedDiff.join(', ')}
- Cocos 冒烟截图：\`${screenshotRelativePath}\`，${screenshotAudit.width}×${screenshotAudit.height} ${screenshotAudit.format ?? '未知格式'}，${screenshotPassed ? 'PASS' : 'FAIL'}

## 按阶段计划延后（不计为 CP0-B 失败）

${delayedAssets.map((item) => `- ${item}`).join('\n')}

## 首个差异

${report.firstDifference === null ? '无。' : String(report.firstDifference)}
`;

mkdirSync(reportDirectory, { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownPath, markdown);

if (!passed) {
  process.exitCode = 1;
}

console.log(`CP0-B report: ${report.status}`);
console.log(relative(projectRoot, jsonPath));
console.log(relative(projectRoot, markdownPath));
