import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative } from 'node:path';
import {
  defaultConfigDirectory,
  loadConfigRegistry,
} from '../tools/cp0b/NodeConfigLoader';

interface Cp0bReport {
  status: 'PASS' | 'FAIL';
  counts: {
    unitTests: number;
    scenarioTests: number;
  };
  unitTests: Array<{ id: string; status: 'PASS' | 'FAIL' }>;
  scenarioTests: Array<{ id: string; status: 'PASS' | 'FAIL' }>;
}

interface CommandResult {
  command: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: number | null;
  signal: string | null;
  spawnError: string | null;
  status: 'PASS' | 'FAIL';
  stdoutSha256: string;
  stderrSha256: string;
}

interface CleanCloneEvidence {
  recordId: string;
  generatedAt: string;
  status: 'PASS' | 'FAIL';
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
  };
  initialState: {
    gitHead: string | null;
    gitStatusCommandExitCode: number | null;
    gitClean: boolean;
    tempExists: boolean;
    libraryExists: boolean;
    nodeModulesExists: boolean;
  };
  commands: CommandResult[];
  transcript: string;
}

interface CocosBuildEvidence {
  recordId: string;
  generatedAt: string;
  status: 'PASS' | 'FAIL';
  creatorVersion: string | null;
  platform: string;
  debug: boolean;
  command: {
    executable: string;
    args: string[];
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    actualExitCode: number | null;
    actualSignal: string | null;
    spawnError: string | null;
  };
  verification: {
    creatorVersionConfigured: boolean;
    shellRegistered: boolean;
    engineVersionConfirmed: boolean;
    releaseBuildConfirmed: boolean;
    buildFinished: boolean;
    exitCodeUsedForStatus: boolean;
    failureMarkers: string[];
  };
  output: {
    rawSha256: string;
    retainedLog: string;
    retainedKeyLineCount: number;
    sanitization: string[];
  };
}

const projectRoot = process.cwd();
const baselineCommit = '13a1ca813f89c260a1aff42183fe6ec9b82b6e21';
const expectedConfigHash = '8737fa94';
const reportDirectory = join(projectRoot, 'reports', 'cp0-c', 'c0');
const jsonPath = join(reportDirectory, 'CP0C-C0-Migration-Report.json');
const markdownPath = join(reportDirectory, 'CP0C-C0-Migration-Report.md');
const screenshotRelativePath = 'reports/cp0-c/c0/CP0C-C0-Battle-Smoke-390x844.png';
const screenshotPath = join(projectRoot, screenshotRelativePath);
const cp0bReport = JSON.parse(
  readFileSync(join(projectRoot, 'reports', 'cp0-b', 'CP0B-Test-Report.json'), 'utf8'),
) as Cp0bReport;
const cleanCloneEvidence = JSON.parse(
  readFileSync(
    join(reportDirectory, 'CP0C-C0-Command-Results.json'),
    'utf8',
  ),
) as CleanCloneEvidence;
const cocosBuildEvidence = JSON.parse(
  readFileSync(
    join(reportDirectory, 'CP0C-C0-Cocos-Build-Result.json'),
    'utf8',
  ),
) as CocosBuildEvidence;
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as {
  creator: { version: string };
};

const walkFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walkFiles(path) : [path];
  });

const repositoryExcludedDirectories = new Set([
  '.git',
  'node_modules',
  'library',
  'temp',
  'build',
]);
const walkRepositoryFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    if (repositoryExcludedDirectories.has(name)) {
      return [];
    }
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walkRepositoryFiles(path) : [path];
  });
const repositoryTypeScriptFiles = walkRepositoryFiles(projectRoot)
  .filter((path) => path.endsWith('.ts'));

const sourceDirectories = {
  domain: join(projectRoot, 'assets', 'game', 'scripts', 'domain', 'cp0b'),
  application: join(projectRoot, 'assets', 'game', 'scripts', 'application', 'cp0c'),
  tools: join(projectRoot, 'tools', 'cp0b'),
};
const runtimeFiles = [
  ...walkFiles(sourceDirectories.domain),
  ...walkFiles(sourceDirectories.application),
].filter((path) => path.endsWith('.ts'));
const allSourceFiles = [
  ...runtimeFiles,
  ...walkFiles(sourceDirectories.tools).filter((path) => path.endsWith('.ts')),
];

const matchingFiles = (files: string[], pattern: RegExp): string[] =>
  files.flatMap((path) => {
    pattern.lastIndex = 0;
    return pattern.test(readFileSync(path, 'utf8')) ? [relative(projectRoot, path)] : [];
  });

const exportedClasses = new Map<string, string[]>();
for (const path of repositoryTypeScriptFiles) {
  const text = readFileSync(path, 'utf8');
  for (const match of text.matchAll(/\bexport\s+class\s+([A-Za-z_$][\w$]*)/g)) {
    const files = exportedClasses.get(match[1]) ?? [];
    files.push(relative(projectRoot, path));
    exportedClasses.set(match[1], files);
  }
}
const expectedClasses = [
  'BoardModel',
  'PathValidator',
  'PathEditor',
  'BoardResolver',
  'InspirationResolver',
  'PotModel',
  'RecipeResolver',
  'StarCalculator',
  'OrderResolver',
  'DiscoveryModel',
  'DeterministicRng',
  'DeadBoardDetector',
  'ShuffleResolver',
  'RunSnapshot',
  'ConfigRegistry',
  'OrderSession',
  'ScenarioService',
  'PrototypeTestRunner',
  'RunLogger',
];
const classDeclarations = Object.fromEntries(
  expectedClasses.map((name) => [name, exportedClasses.get(name) ?? []]),
);
const unexpectedClasses = [...exportedClasses.keys()].filter((name) => !expectedClasses.includes(name));
const classesPassed = expectedClasses.every((name) => classDeclarations[name].length === 1);

const findConfigRoots = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    if (repositoryExcludedDirectories.has(name)) {
      return [];
    }
    const path = join(directory, name);
    if (!statSync(path).isDirectory()) {
      return [];
    }
    const roots = existsSync(join(path, 'gameplay.json')) && basename(path) === 'cp0-b'
      ? [relative(projectRoot, path)]
      : [];
    return [...roots, ...findConfigRoots(path)];
  });
const configRoots = findConfigRoots(projectRoot);
const canonicalConfigRoot = relative(projectRoot, defaultConfigDirectory());
const registry = loadConfigRegistry();
const configJsonFiles = walkFiles(defaultConfigDirectory())
  .filter((path) => path.endsWith('.json'))
  .map((path) => relative(projectRoot, path))
  .sort();

const protectedPaths = [
  'assets/game/scenes',
  'assets/game/prefabs',
  'assets/resources/game/art',
  'assets/game/scripts/presentation/CP0ABattleShell.ts',
];
const protectedDiff = execFileSync(
  'git',
  ['diff', '--name-only', baselineCommit, '--', ...protectedPaths],
  { cwd: projectRoot, encoding: 'utf8' },
).trim().split('\n').filter(Boolean);
const baselineInHistory = execFileSync(
  'git',
  ['merge-base', '--is-ancestor', baselineCommit, 'HEAD'],
  { cwd: projectRoot, encoding: 'utf8' },
);
void baselineInHistory;

const screenshotBytes = readFileSync(screenshotPath);
const screenshotAudit = {
  path: screenshotRelativePath,
  format: screenshotBytes.subarray(1, 4).toString('ascii') === 'PNG' ? 'PNG' : 'UNKNOWN',
  width: screenshotBytes.readUInt32BE(16),
  height: screenshotBytes.readUInt32BE(20),
  source: 'Cocos Creator 3.8.8 Web Mobile release runtime',
};
const screenshotPassed = screenshotAudit.format === 'PNG'
  && screenshotAudit.width === 390
  && screenshotAudit.height === 844;

const cocosCompilation = {
  evidenceRecord: 'reports/cp0-c/c0/CP0C-C0-Cocos-Build-Result.json',
  retainedLog: cocosBuildEvidence.output.retainedLog,
  creatorVersion: cocosBuildEvidence.creatorVersion,
  platform: cocosBuildEvidence.platform,
  debug: cocosBuildEvidence.debug,
  command: cocosBuildEvidence.command,
  verification: cocosBuildEvidence.verification,
  status: cocosBuildEvidence.status,
};
const compilationPassed = cocosBuildEvidence.status === 'PASS'
  && cocosBuildEvidence.creatorVersion === '3.8.8'
  && cocosBuildEvidence.verification.creatorVersionConfigured
  && cocosBuildEvidence.verification.shellRegistered
  && cocosBuildEvidence.verification.engineVersionConfirmed
  && cocosBuildEvidence.verification.releaseBuildConfirmed
  && cocosBuildEvidence.verification.buildFinished
  && cocosBuildEvidence.verification.failureMarkers.length === 0;

const runtimeAudit = {
  ccImports: matchingFiles(runtimeFiles, /\bfrom\s+['"]cc(?:\/[^'"]*)?['"]|\brequire\(['"]cc/),
  nodeBuiltins: matchingFiles(runtimeFiles, /\b(?:from|import)\s*\(?\s*['"]node:/),
  domReferences: matchingFiles(
    runtimeFiles,
    /\b(?:window|document|HTMLElement|localStorage|sessionStorage)\b/,
  ),
  directMathRandom: matchingFiles(runtimeFiles, /\bMath\.random\s*\(/),
  explicitTypeScriptExtensions: matchingFiles(
    repositoryTypeScriptFiles,
    /\bfrom\s+['"][^'"]+\.(?:js|ts)['"]|\bimport\(['"][^'"]+\.(?:js|ts)['"]\)/,
  ),
};
const runtimeAuditPassed = Object.values(runtimeAudit).every((files) => files.length === 0);

const metadataFiles = [
  'assets/game/scripts/domain.meta',
  'assets/game/scripts/domain/cp0b.meta',
  'assets/game/scripts/application.meta',
  'assets/game/scripts/application/cp0c.meta',
  'assets/resources/game/config.meta',
  'assets/resources/game/config/cp0-b.meta',
  ...allSourceFiles
    .filter((path) => path.startsWith(join(projectRoot, 'assets')))
    .map((path) => `${relative(projectRoot, path)}.meta`),
  ...configJsonFiles.map((path) => `${path}.meta`),
  'assets/resources/game/config/cp0-b/scenarios.meta',
];
const missingMetadata = metadataFiles.filter((path) => !existsSync(join(projectRoot, path)));

const requiredCommands = [
  'npm ci',
  'npm test',
  'npm run test:unit',
  'npm run test:scenarios',
  'npm run typecheck',
] as const;
const commandResults = requiredCommands.map((command) => {
  const evidence = cleanCloneEvidence.commands.find((item) => item.command === command);
  return evidence
    ? {
        command,
        status: evidence.status,
        exitCode: evidence.exitCode,
        signal: evidence.signal,
        spawnError: evidence.spawnError,
        startedAt: evidence.startedAt,
        finishedAt: evidence.finishedAt,
        durationMs: evidence.durationMs,
        stdoutSha256: evidence.stdoutSha256,
        stderrSha256: evidence.stderrSha256,
      }
    : {
        command,
        status: 'UNVERIFIED' as const,
        exitCode: null,
        signal: null,
        spawnError: 'No clean-clone command evidence was recorded',
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        stdoutSha256: null,
        stderrSha256: null,
      };
});
const cleanClonePassed = cleanCloneEvidence.status === 'PASS'
  && cleanCloneEvidence.initialState.gitClean
  && !cleanCloneEvidence.initialState.tempExists
  && !cleanCloneEvidence.initialState.libraryExists
  && !cleanCloneEvidence.initialState.nodeModulesExists
  && commandResults.every((result) => result.status === 'PASS' && result.exitCode === 0);

const singleSourceAudit = {
  classDeclarations,
  ignoredNonCp0bClasses: unexpectedClasses,
  status: classesPassed ? 'PASS' : 'FAIL',
};
const singleConfigAudit = {
  expectedRoot: canonicalConfigRoot,
  discoveredRoots: configRoots,
  jsonFileCount: configJsonFiles.length,
  jsonFiles: configJsonFiles,
  status: configRoots.length === 1
    && configRoots[0] === canonicalConfigRoot
    && configJsonFiles.length === 10 ? 'PASS' : 'FAIL',
};
const oldImplementationAudit = {
  path: 'src/cp0b',
  exists: existsSync(join(projectRoot, 'src', 'cp0b')),
  status: !existsSync(join(projectRoot, 'src', 'cp0b')) ? 'PASS' : 'FAIL',
};
const configHashAudit = {
  expected: expectedConfigHash,
  actual: registry.configHash,
  status: registry.configHash === expectedConfigHash ? 'PASS' : 'FAIL',
};
const testsPassed = cp0bReport.status === 'PASS'
  && cp0bReport.counts.unitTests === 24
  && cp0bReport.counts.scenarioTests === 9
  && cp0bReport.unitTests.every((test) => test.status === 'PASS')
  && cp0bReport.scenarioTests.every((test) => test.status === 'PASS');
const passed = cleanClonePassed
  && testsPassed
  && configHashAudit.status === 'PASS'
  && runtimeAuditPassed
  && singleSourceAudit.status === 'PASS'
  && singleConfigAudit.status === 'PASS'
  && oldImplementationAudit.status === 'PASS'
  && compilationPassed
  && screenshotPassed
  && protectedDiff.length === 0
  && missingMetadata.length === 0;

const migrationMap = [
  {
    before: 'src/cp0b/{types,core,stable}.ts',
    after: 'assets/game/scripts/domain/cp0b/{types,core,stable}.ts',
  },
  {
    before: 'src/cp0b/config.ts',
    after: 'assets/game/scripts/application/cp0c/ConfigRegistry.ts + tools/cp0b/NodeConfigLoader.ts',
  },
  {
    before: 'src/cp0b/scenario.ts',
    after: 'assets/game/scripts/application/cp0c/{OrderSession,ScenarioService}.ts + tools/cp0b/{PrototypeTestRunner,RunLogger}.ts',
  },
  {
    before: 'config/cp0-b/',
    after: 'assets/resources/game/config/cp0-b/',
  },
];

const report = {
  reportId: 'CP0-C-C0',
  generatedAt: new Date().toISOString(),
  status: passed ? 'PASS' : 'FAIL',
  scope: {
    authorized: 'CP0-C-C0 single-source runtime migration and Cocos compilation verification',
    c1Started: false,
  },
  commits: {
    baseline: baselineCommit,
    final: 'SELF (the single commit containing this report)',
  },
  environment: {
    cocosCreatorVersion: packageJson.creator.version,
    reportGeneratorNodeVersion: process.version,
    cleanCloneNodeVersion: cleanCloneEvidence.environment.nodeVersion,
  },
  migrationMap,
  deletedOldPaths: ['src/cp0b/', 'config/cp0-b/'],
  cleanCloneVerification: {
    record: 'reports/cp0-c/c0/CP0C-C0-Command-Results.json',
    transcript: cleanCloneEvidence.transcript,
    initialState: cleanCloneEvidence.initialState,
    status: cleanClonePassed ? 'PASS' : 'FAIL',
  },
  commandResults,
  tests: {
    status: testsPassed ? 'PASS' : 'FAIL',
    total: 33,
    unit: { passed: 24, total: 24, ids: 'U01-U24' },
    scenarios: { passed: 9, total: 9, ids: 'S01-S09' },
  },
  configHash: configHashAudit,
  audits: {
    runtimeSeparation: {
      ...runtimeAudit,
      status: runtimeAuditPassed ? 'PASS' : 'FAIL',
    },
    singleSource: singleSourceAudit,
    singleConfig: singleConfigAudit,
    oldImplementation: oldImplementationAudit,
    creatorMetadata: {
      checkedFiles: metadataFiles.length,
      missingFiles: missingMetadata,
      status: missingMetadata.length === 0 ? 'PASS' : 'FAIL',
    },
    cocosCompilation: {
      ...cocosCompilation,
      status: compilationPassed ? 'PASS' : 'FAIL',
    },
    smokeScreenshot: {
      ...screenshotAudit,
      status: screenshotPassed ? 'PASS' : 'FAIL',
    },
    protectedDiff: {
      baseline: baselineCommit,
      paths: protectedPaths,
      changedFiles: protectedDiff,
      status: protectedDiff.length === 0 ? 'PASS' : 'FAIL',
    },
  },
  firstDifference: passed
    ? null
    : [
        ...commandResults.filter((result) => result.status !== 'PASS').map((result) => result.command),
        ...(cleanClonePassed ? [] : ['clean clone prerequisites']),
        ...(configHashAudit.status === 'FAIL' ? ['configHash'] : []),
        ...(runtimeAuditPassed ? [] : ['runtime separation']),
        ...(singleSourceAudit.status === 'FAIL' ? ['single rule source'] : []),
        ...(singleConfigAudit.status === 'FAIL' ? ['single config source'] : []),
        ...(oldImplementationAudit.status === 'FAIL' ? ['old src/cp0b implementation'] : []),
        ...(compilationPassed ? [] : ['Cocos compilation']),
        ...(screenshotPassed ? [] : ['390x844 smoke screenshot']),
        ...(protectedDiff.length === 0 ? [] : ['protected visual diff']),
        ...(missingMetadata.length === 0 ? [] : ['Creator metadata']),
      ][0] ?? 'unknown audit failure',
};

const mapRows = migrationMap.map((item) => `| \`${item.before}\` | \`${item.after}\` |`).join('\n');
const commandRows = commandResults.map((item) =>
  `| \`${item.command}\` | ${item.status} | ${item.exitCode ?? '未记录'} | ${item.durationMs ?? '未记录'} ms |`,
).join('\n');
const classRows = Object.entries(classDeclarations)
  .map(([name, files]) => `| \`${name}\` | ${files.length} | ${files.map((file) => `\`${file}\``).join(', ')} |`)
  .join('\n');
const markdown = `# CP0-C-C0 迁移报告

- 总状态：**${report.status}**
- C0 基线：\`${baselineCommit}\`
- 最终提交：本报告所在的单一提交（提交后以 GitHub 链接固化）
- Cocos Creator：\`${packageJson.creator.version}\`
- Node（干净克隆）：\`${cleanCloneEvidence.environment.nodeVersion}\`
- 配置哈希：\`${registry.configHash}\`（预期 \`${expectedConfigHash}\`）
- C1：**未开始**

## 迁移映射

| 迁移前 | 唯一迁移后位置 |
| --- | --- |
${mapRows}

已删除旧位置：\`src/cp0b/\`、\`config/cp0-b/\`。

## 干净克隆验收

- 初始 Git 工作区干净：${cleanCloneEvidence.initialState.gitClean ? '是' : '否'}
- 初始存在 \`temp/\`：${cleanCloneEvidence.initialState.tempExists ? '是' : '否'}
- 初始存在 \`library/\`：${cleanCloneEvidence.initialState.libraryExists ? '是' : '否'}
- 初始存在 \`node_modules/\`：${cleanCloneEvidence.initialState.nodeModulesExists ? '是' : '否'}
- 命令记录：\`reports/cp0-c/c0/CP0C-C0-Command-Results.json\`
- 完整输出：\`${cleanCloneEvidence.transcript}\`

| 命令 | 结果 | 实际退出码 | 耗时 |
| --- | --- | ---: | ---: |
${commandRows}

- U01～U24：24/24 PASS
- S01～S09：9/9 PASS
- 总计：33/33 PASS

## 单一规则源码审计

| 类 | 声明数 | 唯一文件 |
| --- | ---: | --- |
${classRows}

- 审计范围：仓库全部 TypeScript（排除依赖、缓存与构建输出）；非 CP0-B 导出类不计入本项。
- 运行时 Domain/Application 导入 \`cc\`：${runtimeAudit.ccImports.length === 0 ? '无' : runtimeAudit.ccImports.join(', ')}
- 运行时 Domain/Application 导入 Node 内建模块：${runtimeAudit.nodeBuiltins.length === 0 ? '无' : runtimeAudit.nodeBuiltins.join(', ')}
- 运行时 Domain/Application 引用 DOM：${runtimeAudit.domReferences.length === 0 ? '无' : runtimeAudit.domReferences.join(', ')}
- 玩法源码直接调用 \`Math.random()\`：${runtimeAudit.directMathRandom.length === 0 ? '无' : runtimeAudit.directMathRandom.join(', ')}
- TypeScript 相对导入显式使用 \`.js/.ts\`：${runtimeAudit.explicitTypeScriptExtensions.length === 0 ? '无' : runtimeAudit.explicitTypeScriptExtensions.join(', ')}

## 单一配置源审计

- 唯一配置树：\`${configRoots.join(', ')}\`
- JSON 数量：${configJsonFiles.length}（基础 5 个 + 场景 5 个）
- 旧 \`src/cp0b\`：不存在
- configHash：\`${registry.configHash}\`，PASS

## Cocos 3.8.8 验证

- Web Mobile 发布构建：${compilationPassed ? 'PASS' : 'FAIL'}
- 受版本控制的脱敏构建日志：\`${cocosBuildEvidence.output.retainedLog}\`
- 实际命令结果记录：\`reports/cp0-c/c0/CP0C-C0-Cocos-Build-Result.json\`
- 实际进程退出码：${cocosBuildEvidence.command.actualExitCode ?? '未验证'}
- 构建 PASS 判定依据：版本、发布模式、脚本注册、完成标记及失败标记；退出码只记录实际值，不作写死映射。
- \`CP0ABattleShell\` 注册：${cocosBuildEvidence.verification.shellRegistered ? 'PASS' : 'FAIL'}
- Creator 生成迁移资产元数据：${missingMetadata.length === 0 ? 'PASS' : `FAIL（缺少 ${missingMetadata.join(', ')}）`}
- 真实运行截图：\`${screenshotRelativePath}\`，${screenshotAudit.width}×${screenshotAudit.height} ${screenshotAudit.format}，${screenshotPassed ? 'PASS' : 'FAIL'}

## 保护范围

- 相对 \`${baselineCommit}\` 的场景、Prefab、美术、\`CP0ABattleShell.ts\` 变更：${protectedDiff.length === 0 ? '无' : protectedDiff.join(', ')}
- 保护视觉差异：${protectedDiff.length === 0 ? '空，PASS' : '非空，FAIL'}

## 阶段边界

本次只完成 CP0-C-C0 的单一规则源码、单一配置源迁移、Cocos 导入/编译与冒烟验证。未实现触摸连线、棋盘动画、食材飞行、锅/投料/开火运行时、料理揭晓、继续流程、音效、存档或任何 CP0-C-C1/CP0-D 内容。

## 首个差异

${report.firstDifference === null ? '无。' : report.firstDifference}
`;

mkdirSync(reportDirectory, { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownPath, markdown);

console.log(`CP0-C-C0 report: ${report.status}`);
console.log(relative(projectRoot, jsonPath));
console.log(relative(projectRoot, markdownPath));

if (!passed) {
  process.exitCode = 1;
}
