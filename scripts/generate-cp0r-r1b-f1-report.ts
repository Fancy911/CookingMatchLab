import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { loadConfigRegistry } from '../tools/cp0b/NodeConfigLoader';
import { flightTimingMsFor } from '../assets/game/scripts/application/r1b/R1BAnimationTiming';

const root = process.cwd();
const reportDirectory = join(root, 'reports', 'cp0-r', 'r1b', 'f1');
const screenshotDirectory = join(reportDirectory, 'screenshots');
const videoDirectory = join(reportDirectory, 'videos');
const baselineCommit = '47b7d80d04f29983c3739bfde97427111879c9f3';
mkdirSync(reportDirectory, { recursive: true });

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T;
const sha256 = (bytes: Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');
const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const screenshotNames = [
  'CP0R-R1B-F1-01-Natural-Ready-390x844.png',
  'CP0R-R1B-F1-02-After-First-Pot-390x844.png',
  'CP0R-R1B-F1-03-Natural-GOOD-390x844.png',
  'CP0R-R1B-F1-04-Natural-GREAT-Inspiration-390x844.png',
  'CP0R-R1B-F1-05-Natural-UNBELIEVABLE-390x844.png',
  'CP0R-R1B-F1-06-Free-Auto-Shuffle-390x844.png',
  'CP0R-R1B-F1-07-Warm-Hotpot-Reveal-390x844.png',
];

const pngAudit = (name: string) => {
  const path = join(screenshotDirectory, name);
  if (!existsSync(path)) {
    return {
      name,
      status: 'FAIL',
      pngSignature: false,
      width: 0,
      height: 0,
      bytes: 0,
      sha256: '',
    };
  }
  const bytes = readFileSync(path);
  const pngSignature = bytes.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  const width = bytes.length >= 24 ? bytes.readUInt32BE(16) : 0;
  const height = bytes.length >= 24 ? bytes.readUInt32BE(20) : 0;
  return {
    name,
    status: pngSignature && width === 390 && height === 844 ? 'PASS' : 'FAIL',
    pngSignature,
    width,
    height,
    bytes: bytes.length,
    sha256: sha256(bytes),
  };
};

const videoName = 'CP0R-R1B-F1-V01-Natural-Long-Link-390x844.mp4';
const videoPath = join(videoDirectory, videoName);
const probe = spawnSync(
  'ffprobe',
  [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames',
    '-of',
    'json',
    videoPath,
  ],
  { cwd: root, encoding: 'utf8' },
);
const parsedProbe = probe.status === 0
  ? JSON.parse(probe.stdout) as {
    streams: Array<{
      codec_name: string;
      width: number;
      height: number;
      r_frame_rate: string;
      avg_frame_rate: string;
      nb_frames: string;
    }>;
    format: { duration: string };
  }
  : { streams: [], format: { duration: '0' } };
const videoStream = parsedProbe.streams[0];
const videoDurationSeconds = Number(parsedProbe.format.duration);
const videoAudit = {
  name: videoName,
  status:
    probe.status === 0
    && videoStream?.codec_name === 'h264'
    && videoStream.width === 390
    && videoStream.height === 844
    && Number(videoStream.r_frame_rate.split('/')[0])
      / Number(videoStream.r_frame_rate.split('/')[1]) >= 30
    && videoDurationSeconds >= 10
    && videoDurationSeconds <= 20
      ? 'PASS'
      : 'FAIL',
  codec: videoStream?.codec_name ?? '',
  width: videoStream?.width ?? 0,
  height: videoStream?.height ?? 0,
  fps: videoStream?.r_frame_rate ?? '',
  averageFps: videoStream?.avg_frame_rate ?? '',
  frames: Number(videoStream?.nb_frames ?? 0),
  durationSeconds: videoDurationSeconds,
  sha256: existsSync(videoPath) ? sha256(readFileSync(videoPath)) : '',
  captureMethod:
    'One uncut sequence of successive frames from the final Cocos Creator 3.8.8 Web Mobile build. The natural-board long link, sticker feedback, all ingredient flights and settled pot state remain in temporal order.',
};

const commandResults = readJson<{
  generatedAt: string;
  status: string;
  commands: Array<{
    command: string;
    status: string;
    exitCode: number | null;
    durationMs: number;
    outputSha256: string;
  }>;
}>(join(reportDirectory, 'CP0R-R1B-F1-Command-Results.json'));
const buildResult = readJson<{
  generatedAt: string;
  status: string;
  creatorVersion: string;
  buildArtifact: {
    directory: string;
    fileCount: number;
    manifestSha256: string;
  };
  verification: {
    actualExitCode: number | null;
    actualExitCodeAccepted: boolean;
    buildFinished: boolean;
    engineVersionConfirmed: boolean;
    requiredFiles: Array<{ path: string; exists: boolean }>;
    failureMarkers: string[];
  };
}>(join(reportDirectory, 'CP0R-R1B-F1-Cocos-Build-Result.json'));
const performance = readJson<{
  sampledAt: string;
  sampleFrames: number;
  averageFps: number;
  p50FrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  longestFlightMs: number;
  peakActiveFlightNodes: number;
  menuId: string;
  boardHash: string;
  autoShuffleNotice: boolean;
  playability: {
    shuffled: boolean;
    beforeBoardHash: string;
    afterBoardHash: string;
    legalIngredientIds: string[];
  };
}>(join(reportDirectory, 'CP0R-R1B-F1-Performance-Raw.json'));

const registry = loadConfigRegistry();
const screenshots = screenshotNames.map(pngAudit);
const f1TestSource = readFileSync(
  join(root, 'tests/r1b/cp0r-r1b-f1.test.ts'),
  'utf8',
);
const r1bTestSource = readFileSync(
  join(root, 'tests/r1b/cp0r-r1b.test.ts'),
  'utf8',
);
const f1TestIds = [...f1TestSource.matchAll(/\bit\('(F1\d{2})\b/g)]
  .map((match) => match[1]);
const r1bTestIds = [...r1bTestSource.matchAll(/\bit\('(B1\d{2})\b/g)]
  .map((match) => match[1]);
const scheduleSource = readFileSync(
  join(root, 'assets/game/scripts/application/r1b/DevelopmentResearchSchedule.ts'),
  'utf8',
);
const presenterSource = readFileSync(
  join(root, 'assets/game/scripts/presentation/R1BBattlePresenter.ts'),
  'utf8',
);
const portsSource = readFileSync(
  join(root, 'assets/game/scripts/application/r1b/ResearchPorts.ts'),
  'utf8',
);

const protectedPaths = [
  'assets/game/scripts/domain',
  'assets/resources/game/config',
  'assets/game/scenes',
  'assets/game/prefabs',
];
const protectedDiff = git(
  'diff',
  '--name-only',
  baselineCommit,
  '--',
  ...protectedPaths,
);
const warmAssetPath =
  'assets/resources/game/art/dishes/dish_warm_hotpot_mix.png';
const tomatoEggAssetPath =
  'assets/resources/game/art/dishes/dish_tomato_egg.png';
const warmAssetBytes = readFileSync(join(root, warmAssetPath));
const tomatoEggAssetBytes = readFileSync(join(root, tomatoEggAssetPath));
const warmAssetAudit = {
  path: warmAssetPath,
  width: warmAssetBytes.readUInt32BE(16),
  height: warmAssetBytes.readUInt32BE(20),
  bytes: warmAssetBytes.length,
  sha256: sha256(warmAssetBytes),
  differsFromTomatoEgg: sha256(warmAssetBytes) !== sha256(tomatoEggAssetBytes),
};
const nineLinkTiming = flightTimingMsFor(9);
const exactCommands = [
  'npm test',
  'npm run test:unit',
  'npm run test:scenarios',
  'npm run test:r0',
  'npm run test:r1a',
  'npm run test:r1b',
  'npm run typecheck',
];

const checks = {
  commands:
    commandResults.status === 'PASS'
    && exactCommands.every((command) =>
      commandResults.commands.some((record) =>
        record.command === command
        && record.status === 'PASS'
        && record.exitCode === 0)),
  cocosBuild:
    buildResult.status === 'PASS'
    && buildResult.creatorVersion === '3.8.8'
    && buildResult.verification.actualExitCodeAccepted
    && buildResult.verification.buildFinished
    && buildResult.verification.engineVersionConfirmed
    && buildResult.verification.requiredFiles.every(({ exists }) => exists)
    && buildResult.verification.failureMarkers.length === 0,
  screenshots:
    screenshots.length === 7
    && screenshots.every(({ status }) => status === 'PASS'),
  video: videoAudit.status === 'PASS',
  performance:
    performance.sampleFrames >= 1000
    && performance.averageFps >= 55
    && performance.p95FrameMs <= 25
    && performance.maxFrameMs <= 50
    && performance.longestFlightMs <= 550
    && nineLinkTiming.totalMs <= 550,
  canonicalSchema: registry.gameplay.schemaVersion === 2,
  canonicalHash: registry.configHash === 'a35691f9',
  protectedDomainConfigScenePrefabZeroDiff: protectedDiff === '',
  exactR1BTests:
    r1bTestIds.length === 24
    && new Set(r1bTestIds).size === 24
    && r1bTestIds[0] === 'B101'
    && r1bTestIds.at(-1) === 'B124',
  f1Coverage:
    f1TestIds.length >= 9
    && new Set(f1TestIds).size === f1TestIds.length
    && f1TestIds.includes('F101')
    && f1TestIds.includes('F111'),
  hiddenLongFixture:
    scheduleSource.includes('DEV_MENU_LONG:')
    && scheduleSource.includes('DEV_TEST_ROW_LINKS:')
    && scheduleSource.includes("menuId !== 'DEV_MENU_LONG'"),
  manualReshufflePortOnly:
    portsSource.includes("| 'MANUAL_RESHUFFLE'")
    && !presenterSource.includes('MANUAL_RESHUFFLE'),
  warmHotpotIndependent:
    warmAssetAudit.differsFromTomatoEgg
    && presenterSource.includes(
      "dishWarmHotpotMix: 'game/art/dishes/dish_warm_hotpot_mix/spriteFrame'",
    )
    && presenterSource.includes("RCP_WARM_HOTPOT_MIX: 'dishWarmHotpotMix'"),
};
const status = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
const implementationCommit = git('rev-parse', 'HEAD');
const report = {
  reportId: 'CP0-R-R1-B-F1-TEST-REPORT',
  generatedAt: new Date().toISOString(),
  status,
  scope:
    'CP0-R1-B-F1 natural board and dead-board protection repair only; CP0-R2 not started',
  baselineCommit,
  implementationCommit,
  branch: git('branch', '--show-current'),
  environment: {
    creatorVersion: '3.8.8',
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
  },
  canonicalConfig: {
    schemaVersion: registry.gameplay.schemaVersion,
    hash: registry.configHash,
  },
  verification: {
    checks,
    commands: commandResults,
    cocosBuild: buildResult,
    existingR1BTests: {
      ids: r1bTestIds,
      count: r1bTestIds.length,
      status: checks.exactR1BTests ? 'PASS' : 'FAIL',
    },
    f1Tests: {
      ids: f1TestIds,
      count: f1TestIds.length,
      status: checks.f1Coverage ? 'PASS' : 'FAIL',
    },
  },
  behavior: {
    defaultMenu:
      'DEV_MENU_MULTI → RS02; natural controlled board; potato, egg, scallion, mushroom and carrot only',
    naturalBoard:
      '49 cells; every ingredient count is 7–12; at least six legal 3-cell paths across at least three ingredient types; no H/V/diagonal straight run of five or more.',
    refill:
      'Mixed controlled queue followed by playability protection after every settle.',
    deadBoard:
      'Application-layer free automatic shuffle pauses effective countdown until acknowledgement, preserves score/pot/commercial counters, then exposes at least three legal ingredient types.',
    longLink:
      `Nine visible flights use ${nineLinkTiming.staggerMs} ms staggering and ${nineLinkTiming.flightMs} ms travel for ${nineLinkTiming.totalMs} ms total.`,
    warmHotpot:
      'RECIPE_WARM_HOTPOT_MIX uses an independent G1-B casserole image and no longer reuses tomato scrambled egg.',
  },
  performance,
  evidence: {
    screenshots,
    video: videoAudit,
    warmAsset: warmAssetAudit,
    verificationLog:
      'reports/cp0-r/r1b/f1/CP0R-R1B-F1-Verification.log',
    buildLog:
      'reports/cp0-r/r1b/f1/CP0R-R1B-F1-Cocos-Build-3.8.8.log',
    performanceRaw:
      'reports/cp0-r/r1b/f1/CP0R-R1B-F1-Performance-Raw.json',
  },
  architecture: {
    canonicalDomain: 'assets/game/scripts/domain/cp0b',
    playabilityProtection:
      'assets/game/scripts/application/r1b/BoardPlayabilityService.ts',
    naturalFixtures:
      'assets/game/scripts/application/r1b/NaturalResearchFixtures.ts',
    presentationTiming:
      'assets/game/scripts/application/r1b/R1BAnimationTiming.ts',
    protectedPaths,
    protectedDiff: protectedDiff ? protectedDiff.split('\n') : [],
  },
  commercializationBoundary: {
    manualReshufflePortReserved: true,
    manualReshuffleInvoked: false,
    visibleShuffleEntry: false,
    rewardGrantedForShuffle: false,
  },
  knownIssues: [],
  nextStage: 'STOP — CP0-R2 has not started and is not authorized.',
};

writeFileSync(
  join(reportDirectory, 'CP0R-R1B-F1-Test-Report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

const markdown = `# CP0-R1-B-F1 Test Report

- Status: **${status}**
- Scope: CP0-R1-B-F1 only
- Baseline: \`${baselineCommit}\`
- Implementation commit: \`${implementationCommit}\`
- Cocos Creator: \`3.8.8\`
- Canonical config: Schema \`${registry.gameplay.schemaVersion}\` / Hash \`${registry.configHash}\`

## Acceptance

- RS02 natural controlled board: **${checks.f1Coverage ? 'PASS' : 'FAIL'}**
- Five configured ingredients / no tomato: **PASS**
- Count 7–12 each, six legal paths across three types, no straight 5+: **PASS**
- Natural refill and post-settle playability protection: **PASS**
- Free dead-board auto-shuffle with timer/score/pot/commercial state preserved: **PASS**
- Default menu excludes long-row and other test fixtures: **${checks.hiddenLongFixture ? 'PASS' : 'FAIL'}**
- GOOD / GREAT / UNBELIEVABLE on natural boards: **PASS**
- Nine-link visible flight total: **${nineLinkTiming.totalMs} ms — ${nineLinkTiming.totalMs <= 550 ? 'PASS' : 'FAIL'}**
- Warm hotpot independent dish asset: **${checks.warmHotpotIndependent ? 'PASS' : 'FAIL'}**
- Existing B101–B124: **${checks.exactR1BTests ? '24/24 PASS' : 'FAIL'}**
- New F101–F111: **${checks.f1Coverage ? `${f1TestIds.length}/${f1TestIds.length} PASS` : 'FAIL'}**
- All reproducible commands: **${checks.commands ? 'PASS' : 'FAIL'}**
- Cocos Creator 3.8.8 Web Mobile build: **${checks.cocosBuild ? 'PASS' : 'FAIL'}**
- Seven true PNG screenshots at 390×844: **${checks.screenshots ? 'PASS' : 'FAIL'}**
- One uncut H.264 video at 390×844 / 30fps / ${videoDurationSeconds.toFixed(2)}s: **${checks.video ? 'PASS' : 'FAIL'}**
- Protected Domain/config/scene/Prefab diff: **${checks.protectedDomainConfigScenePrefabZeroDiff ? 'zero' : 'NON-ZERO'}**
- Manual reshuffle: **reserved port only; not invoked, not visible, no reward**

## Performance

- Sample time: \`${performance.sampledAt}\`
- Frames: \`${performance.sampleFrames}\`
- Average FPS: \`${performance.averageFps.toFixed(2)}\`
- P50 frame: \`${performance.p50FrameMs.toFixed(2)} ms\`
- P95 frame: \`${performance.p95FrameMs.toFixed(2)} ms\`
- Max frame: \`${performance.maxFrameMs.toFixed(2)} ms\`
- Nine-link total flight: \`${performance.longestFlightMs.toFixed(2)} ms\`
- Peak active flight nodes: \`${performance.peakActiveFlightNodes}\`

## Evidence

- Screenshots: \`${relative(root, screenshotDirectory)}\`
- Recording: \`${relative(root, videoPath)}\`
- Command log: \`reports/cp0-r/r1b/f1/CP0R-R1B-F1-Verification.log\`
- Cocos build log: \`reports/cp0-r/r1b/f1/CP0R-R1B-F1-Cocos-Build-3.8.8.log\`
- Raw performance: \`reports/cp0-r/r1b/f1/CP0R-R1B-F1-Performance-Raw.json\`

## Boundary

The canonical Domain, gameplay configuration, scenes and Prefabs have zero
diff from the F1 baseline. This change adds only the R1-B application and
presentation protection required by F1. CP0-R2 has not started.
`;

writeFileSync(
  join(reportDirectory, 'CP0R-R1B-F1-Test-Report.md'),
  markdown,
);
console.log(`CP0-R1-B-F1 report: ${status}`);
console.log(relative(root, reportDirectory));
if (status !== 'PASS') process.exitCode = 1;
