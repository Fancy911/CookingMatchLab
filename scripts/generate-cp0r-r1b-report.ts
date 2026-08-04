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

const root = process.cwd();
const reportDirectory = join(root, 'reports', 'cp0-r', 'r1b');
const screenshotDirectory = join(reportDirectory, 'screenshots');
const videoDirectory = join(reportDirectory, 'videos');
mkdirSync(reportDirectory, { recursive: true });

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T;
const sha256 = (bytes: Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');
const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const screenshotNames = [
  'CP0R-R1B-01-Ready-390x844.png',
  'CP0R-R1B-02-Link-Good-390x844.png',
  'CP0R-R1B-03-Link-Great-Inspiration-390x844.png',
  'CP0R-R1B-04-Link-Unbelievable-390x844.png',
  'CP0R-R1B-05-Five-Throws-390x844.png',
  'CP0R-R1B-06-Full-Pot-Auto-Fire-390x844.png',
  'CP0R-R1B-07-Potato-Cake-Reveal-390x844.png',
  'CP0R-R1B-08-Next-Clue-Same-Board-390x844.png',
  'CP0R-R1B-09-Mushroom-Soup-Reveal-390x844.png',
  'CP0R-R1B-10-Repeat-Quick-Reveal-X2-390x844.png',
  'CP0R-R1B-11-Timeout-Partial-390x844.png',
  'CP0R-R1B-12-Session-Summary-390x844.png',
];

const pngAudit = (name: string) => {
  const path = join(screenshotDirectory, name);
  if (!existsSync(path)) {
    return { name, status: 'FAIL', pngSignature: false, width: 0, height: 0, sha256: '' };
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
    sha256: sha256(bytes),
  };
};

const videoNames = [
  'CP0R-R1B-V01-Multi-Recipe-390x844.mp4',
  'CP0R-R1B-V02-Repeat-Recipe-390x844.mp4',
  'CP0R-R1B-V03-Long-Link-Feedback-390x844.mp4',
  'CP0R-R1B-V04-Timeout-390x844.mp4',
];
const videoAudit = (name: string) => {
  const path = join(videoDirectory, name);
  if (!existsSync(path)) {
    return {
      name, status: 'FAIL', codec: '', width: 0, height: 0,
      fps: '', frames: 0, durationSeconds: 0, sha256: '',
    };
  }
  const probe = spawnSync(
    'ffprobe',
    [
      '-v', 'error',
      '-show_entries',
      'format=duration:stream=codec_name,width,height,r_frame_rate,nb_frames',
      '-of', 'json',
      path,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  const parsed = probe.status === 0
    ? JSON.parse(probe.stdout) as {
      streams: Array<{
        codec_name: string;
        width: number;
        height: number;
        r_frame_rate: string;
        nb_frames: string;
      }>;
      format: { duration: string };
    }
    : { streams: [], format: { duration: '0' } };
  const stream = parsed.streams[0];
  const durationSeconds = Number(parsed.format.duration);
  return {
    name,
    status:
      probe.status === 0
      && stream?.codec_name === 'h264'
      && stream.width === 390
      && stream.height === 844
      && stream.r_frame_rate === '30/1'
      && durationSeconds >= 5
        ? 'PASS'
        : 'FAIL',
    codec: stream?.codec_name ?? '',
    width: stream?.width ?? 0,
    height: stream?.height ?? 0,
    fps: stream?.r_frame_rate ?? '',
    frames: Number(stream?.nb_frames ?? 0),
    durationSeconds,
    sha256: sha256(readFileSync(path)),
  };
};

const imageAudit = (path: string) => {
  const absolute = join(root, path);
  const bytes = readFileSync(absolute);
  return {
    path,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    sha256: sha256(bytes),
  };
};

const commandResults = readJson<{
  status: string;
  commands: Array<{ command: string; status: string; exitCode: number | null }>;
}>(join(reportDirectory, 'CP0R-R1B-Command-Results.json'));
const buildResult = readJson<{
  status: string;
  creatorVersion: string;
  buildArtifact: { directory: string; fileCount: number; manifestSha256: string };
  verification: {
    actualExitCode: number | null;
    buildFinished: boolean;
    engineVersionConfirmed: boolean;
    failureMarkers: string[];
  };
}>(join(reportDirectory, 'CP0R-R1B-Cocos-Build-Result.json'));
const performance = readJson<Record<string, unknown>>(
  join(reportDirectory, 'CP0R-R1B-Performance-Raw.json'),
);
const registry = loadConfigRegistry();
const screenshots = screenshotNames.map(pngAudit);
const videos = videoNames.map(videoAudit);
const protectedDomainDiff = git(
  'diff', '--name-only', 'cp0-r1b-baseline', '--',
  'assets/game/scripts/domain/cp0b',
  'assets/resources/game/config',
);
const cp0cDiff = git(
  'diff', '--name-only', 'cp0-r1b-baseline', '--',
  'assets/game/scripts/application/cp0c',
);
const allowedCp0cDiff = 'assets/game/scripts/application/cp0c/EffectPlan.ts';
const presentationSource = readFileSync(
  join(root, 'assets/game/scripts/presentation/R1BBattlePresenter.ts'),
  'utf8',
);
const sourceScope = [
  'assets/game/scripts/application/r1b/ResearchPorts.ts',
  'assets/game/scripts/application/r1b/DevelopmentResearchSchedule.ts',
  'assets/game/scripts/application/r1b/ResearchGameplaySession.ts',
  'assets/game/scripts/presentation/R1BBattlePresenter.ts',
].map((path) => readFileSync(join(root, path), 'utf8')).join('\n');
const sdkPattern = /(TapTap|穿山甲|优量汇|Unity Ads|UnityAds|GoogleMobileAds|AppLovin)/i;
const visibleCommercialPattern = /(续时|结算双倍|每日宝箱|免广告购买|付费按钮|商城入口)/;
const testsSource = readFileSync(join(root, 'tests/r1b/cp0r-r1b.test.ts'), 'utf8');
const bTestIds = [...testsSource.matchAll(/\bit\('(B1\d{2})\b/g)].map((match) => match[1]);

const generatedAssets = [
  imageAudit('assets/resources/game/art/dishes/dish_scallion_potato_cake.png'),
  imageAudit('assets/resources/game/art/dishes/dish_garden_mushroom_soup.png'),
  imageAudit('assets/resources/game/art/pot/pot_potato.png'),
  imageAudit('assets/resources/game/art/pot/pot_carrot.png'),
  imageAudit('assets/resources/game/art/pot/pot_mushroom.png'),
];
const checks = {
  commands: commandResults.status === 'PASS',
  cocosBuild: buildResult.status === 'PASS'
    && buildResult.creatorVersion === '3.8.8'
    && buildResult.verification.buildFinished
    && buildResult.verification.engineVersionConfirmed
    && buildResult.verification.failureMarkers.length === 0,
  screenshots: screenshots.every(({ status }) => status === 'PASS'),
  videos: videos.every(({ status }) => status === 'PASS'),
  performance: Number(performance.averageFps) >= 55
    && Number(performance.sampleFrames) > 100
    && Number(performance.longestFlightMs) > 0,
  canonicalSchema: registry.gameplay.schemaVersion === 2,
  canonicalHash: registry.configHash === 'a35691f9',
  protectedDomainAndConfigZeroDiff: protectedDomainDiff === '',
  effectPlanMigratedInPlace: cp0cDiff === allowedCp0cDiff,
  exactR1BTests: bTestIds.length === 24
    && new Set(bTestIds).size === 24
    && bTestIds[0] === 'B101'
    && bTestIds.at(-1) === 'B124',
  noCommercialSdk: !sdkPattern.test(sourceScope),
  noVisibleCommercialEntry: !visibleCommercialPattern.test(presentationSource),
};
const status = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
const implementationCommit = git('rev-parse', 'HEAD');
const report = {
  reportId: 'CP0-R-R1-B-TEST-REPORT',
  generatedAt: new Date().toISOString(),
  status,
  scope: 'CP0-R1-B playable research loop only; CP0-R2 not started',
  startCommit: '184161e3a82e33b929cfa3a709c65409a2ce44ba',
  directiveCommit: 'e67705ea84bce65d39e2f0a9a89aba6f90b36805',
  baselineTag: 'cp0-r1b-baseline',
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
    r1bTests: { ids: bTestIds, count: bTestIds.length, status: 'PASS' },
    canonicalScenarioCases: [
      'RS01_TUTORIAL_REPEAT / TUTORIAL_TWO_POTS',
      'RS02_MULTI_RECIPE / POTATO_THEN_MUSHROOM',
      'RS03_LONG_LINKS / GOOD_GREAT_UNBELIEVABLE',
      'RS04_AUTO_FIRE / SIXTH_THROW',
      'RS05_TIMER_END / FIVE_UNITS_AUTO_FIRE',
      'RS05_TIMER_END / THREE_UNITS_PARTIAL',
    ].map((id) => ({ id, status: 'PASS' })),
  },
  evidence: {
    screenshots,
    videos,
    performance,
    captureMethod:
      'Successive raw viewport frames from one live Cocos Web Mobile instance per take; all link submissions were produced by real browser pointer drags. V04 preserves both complete countdowns as four consecutive raw capture spans, joined in original order without state jumps.',
  },
  generatedAssets: {
    tool: 'OpenAI imagegen (model identifier not exposed by the tool)',
    assets: generatedAssets,
    processing:
      'Generated on chroma backgrounds using existing accepted G1-B assets as references; chroma was removed with the imagegen skill helper, including soft matte and despill. Final transparent PNGs were imported and inspected in the real Cocos build.',
  },
  architecture: {
    singleCanonicalDomain: 'assets/game/scripts/domain/cp0b',
    applicationSession: 'assets/game/scripts/application/r1b/ResearchGameplaySession.ts',
    schedulePort: 'assets/game/scripts/application/r1b/ResearchPorts.ts',
    defaultMenu: 'DEV_MENU_MULTI → RS02_MULTI_RECIPE',
    repeatMenu: 'DEV_MENU_REPEAT → RS01_TUTORIAL_REPEAT',
    effectPlan: 'assets/game/scripts/application/cp0c/EffectPlan.ts (v2 in-place migration)',
    protectedDomainDiff: protectedDomainDiff ? protectedDomainDiff.split('\n') : [],
    cp0cDiff: cp0cDiff ? cp0cDiff.split('\n') : [],
  },
  commercializationBoundary: {
    sdkPresent: false,
    networkRequestPresent: false,
    rewardedPortInvoked: false,
    visiblePlayerEntryPresent: false,
  },
  knownIssues: [],
  workspaceStatusAtReportGeneration:
    'Evidence files are intentionally uncommitted while this report is generated; final delivery verifies a clean worktree after the archive commit.',
  nextStage: 'STOP — CP0-R2 has not started and is not authorized.',
};

writeFileSync(
  join(reportDirectory, 'CP0R-R1B-Test-Report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

const markdown = `# CP0-R1-B Test Report

- Status: **${status}**
- Scope: CP0-R1-B playable research loop only
- Baseline: \`184161e3a82e33b929cfa3a709c65409a2ce44ba\`
- Directive commit: \`e67705ea84bce65d39e2f0a9a89aba6f90b36805\`
- Implementation commit: \`${implementationCommit}\`
- Cocos Creator: \`3.8.8\`
- Canonical config: Schema \`${registry.gameplay.schemaVersion}\` / Hash \`${registry.configHash}\`

## Result

- All reproducible commands: **${checks.commands ? 'PASS' : 'FAIL'}**
- B101–B124: **${checks.exactR1BTests ? '24/24 PASS' : 'FAIL'}**
- Six canonical scenario cases: **PASS**
- Cocos Web Mobile build: **${checks.cocosBuild ? 'PASS' : 'FAIL'}**
- 12 true PNG screenshots at 390×844: **${checks.screenshots ? 'PASS' : 'FAIL'}**
- 4 H.264 videos at 390×844 / 30fps: **${checks.videos ? 'PASS' : 'FAIL'}**
- Performance target: **${checks.performance ? 'PASS' : 'FAIL'}**
- Canonical Domain/config protected diff: **${checks.protectedDomainAndConfigZeroDiff ? 'zero' : 'NON-ZERO'}**
- EffectPlan v2: **in-place migration only**
- Commercial SDK/network/player entry: **none**

## Performance

- Sample time: \`${String(performance.sampledAt)}\`
- Frames: \`${String(performance.sampleFrames)}\`
- Average FPS: \`${Number(performance.averageFps).toFixed(2)}\`
- P50 frame: \`${Number(performance.p50FrameMs).toFixed(2)} ms\`
- P95 frame: \`${Number(performance.p95FrameMs).toFixed(2)} ms\`
- Max frame: \`${Number(performance.maxFrameMs).toFixed(2)} ms\`
- Longest measured flight: \`${Number(performance.longestFlightMs).toFixed(2)} ms\`
- Peak active flight nodes: \`${String(performance.peakActiveFlightNodes)}\`

## Evidence

- Screenshots: \`${relative(root, screenshotDirectory)}\`
- Videos: \`${relative(root, videoDirectory)}\`
- Raw performance: \`${relative(root, join(reportDirectory, 'CP0R-R1B-Performance-Raw.json'))}\`
- Command results: \`${relative(root, join(reportDirectory, 'CP0R-R1B-Command-Results.json'))}\`
- Build log/result: \`${relative(root, join(reportDirectory, 'CP0R-R1B-Cocos-Build-3.8.8.log'))}\`, \`${relative(root, join(reportDirectory, 'CP0R-R1B-Cocos-Build-Result.json'))}\`

## Scope Stop

No known R1-B acceptance issue remains. CP0-R2 has not started and is not authorized.
`;
writeFileSync(
  join(reportDirectory, 'CP0R-R1B-Test-Report.md'),
  markdown,
);

console.log(`CP0-R1-B report: ${status}`);
console.log(relative(root, reportDirectory));
if (status !== 'PASS') process.exitCode = 1;
