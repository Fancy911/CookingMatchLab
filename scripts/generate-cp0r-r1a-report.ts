import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { loadConfigRegistry } from '../tools/cp0b/NodeConfigLoader';
import { R1A_VIEW_MODELS } from '../assets/game/scripts/presentation/R1AStaticViewModels';

const root = process.cwd();
const reportDirectory = join(root, 'reports', 'cp0-r', 'r1a');
mkdirSync(reportDirectory, { recursive: true });
const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T;
const sha256 = (bytes: Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');
const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const pngAudit = (name: string) => {
  const path = join(reportDirectory, name);
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

const videoPath = join(
  reportDirectory,
  'CP0R-R1A-V01-Static-States-390x844.mp4',
);
const probe = spawnSync(
  'ffprobe',
  [
    '-v', 'error',
    '-show_entries',
    'format=duration:stream=codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames',
    '-of', 'json',
    videoPath,
  ],
  { cwd: root, encoding: 'utf8' },
);
const videoProbe = probe.status === 0
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
const videoStream = videoProbe.streams[0];
const videoDuration = Number(videoProbe.format.duration);
const videoAudit = {
  name: 'CP0R-R1A-V01-Static-States-390x844.mp4',
  status: probe.status === 0
    && videoStream?.width === 390
    && videoStream?.height === 844
    && videoDuration >= 10
    && videoDuration <= 20
      ? 'PASS'
      : 'FAIL',
  codec: videoStream?.codec_name ?? '',
  width: videoStream?.width ?? 0,
  height: videoStream?.height ?? 0,
  fps: videoStream?.avg_frame_rate ?? '',
  frames: Number(videoStream?.nb_frames ?? 0),
  durationSeconds: videoDuration,
  sha256: existsSync(videoPath) ? sha256(readFileSync(videoPath)) : '',
  captureMethod:
    '180 consecutive screenshots captured from one live Cocos instance while hidden keys 1/2/3 switched READY, POT_REVIEW and QUICK_REVEAL_REPEAT; encoded at 15 fps without visible debug controls or cursor.',
};

const commandResults = readJson<{
  status: string;
  commands: Array<{ command: string; status: string; exitCode: number | null }>;
}>(join(reportDirectory, 'CP0R-R1A-Command-Results.json'));
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
}>(join(reportDirectory, 'CP0R-R1A-Cocos-Build-Result.json'));
const registry = loadConfigRegistry();
const screenshots = [
  pngAudit('CP0R-R1A-01-Ready-390x844.png'),
  pngAudit('CP0R-R1A-02-Pot-Review-390x844.png'),
  pngAudit('CP0R-R1A-03-Quick-Reveal-Repeat-390x844.png'),
];
const protectedPaths = [
  'assets/game/scripts/domain',
  'assets/game/scripts/application/cp0c',
  'assets/game/scripts/infrastructure/JsonConfigAdapter.ts',
  'assets/game/scripts/infrastructure/CocosJsonConfigLoader.ts',
  'assets/resources/game/config',
];
const protectedDiff = git(
  'diff',
  '--name-only',
  'cp0-r1a-baseline',
  '--',
  ...protectedPaths,
);
const assets = [
  imageAudit('assets/resources/game/art/ingredients/ingredient_scallion.png'),
  imageAudit('assets/resources/game/art/pot/pot_scallion.png'),
];
const checks = {
  commands: commandResults.status === 'PASS',
  cocosBuild: buildResult.status === 'PASS',
  screenshots: screenshots.every(({ status }) => status === 'PASS'),
  video: videoAudit.status === 'PASS',
  canonicalSchema: registry.gameplay.schemaVersion === 2,
  canonicalHash: registry.configHash === 'a35691f9',
  protectedTreeZeroDiff: protectedDiff === '',
  states: Object.keys(R1A_VIEW_MODELS).join(',') ===
    'READY,POT_REVIEW,QUICK_REVEAL_REPEAT',
  sixSlots:
    R1A_VIEW_MODELS.READY.slots.length === 6
    && R1A_VIEW_MODELS.POT_REVIEW.slots.length === 6,
  fiveFilledSlots:
    R1A_VIEW_MODELS.POT_REVIEW.slots.filter(({ ingredientId }) => ingredientId)
      .length === 5,
};
const status = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
const report = {
  reportId: 'CP0-R-R1-A-TEST-REPORT',
  generatedAt: new Date().toISOString(),
  status,
  scope: 'CP0-R1-A static visual shell only',
  startCommit: 'a2e662883d73062b57e05a8d311543c06ab24762',
  baselineTag: 'cp0-r1a-baseline',
  completionImplementationCommit: git('rev-parse', 'HEAD'),
  branch: git('branch', '--show-current'),
  creatorVersion: '3.8.8',
  canonicalConfig: {
    schemaVersion: registry.gameplay.schemaVersion,
    hash: registry.configHash,
  },
  states: R1A_VIEW_MODELS,
  layoutBasis: {
    designResolution: '390×844',
    safeAreaStrategy:
      'FIXED_WIDTH 390×844 SafeAreaRoot; critical HUD starts at y=46, side content uses at least 14 px logical inset.',
    bounds: {
      pause: [14, 46, 44, 44],
      timer: [72, 46, 112, 50],
      score: [196, 46, 178, 50],
      clue: [16, 104, 358, 66],
      board: [13, 178, 364, 364],
      pot: [48, 548, 294, 144],
      slots: [14, 700, 260, 110],
      fire: [286, 712, 88, 88],
    },
  },
  evidence: {
    screenshots,
    video: videoAudit,
    commands: commandResults,
    cocosBuild: buildResult,
  },
  generatedAssets: {
    tool: 'OpenAI imagegen (model identifier not exposed by the tool)',
    assets,
    prompts: [
      'G1-B jelly-toy kitchen board icon: three plump scallion stalks, unified upper-left light, isolated chroma background.',
      'G1-B jelly-toy kitchen pot module: three chunky green-and-ivory scallion segments, unified upper-left light, isolated chroma background.',
    ],
    processing:
      'Chroma key removed with the imagegen skill helper using soft matte and despill; final PNGs were imported and inspected in the real Cocos build.',
  },
  checks,
  protectedPaths,
  protectedDiff: protectedDiff ? protectedDiff.split('\n') : [],
  knownTemporaryItems: [
    'All three states are static acceptance ViewModels.',
    'No playable Domain session, countdown, touch linking, audio, or multi-pot flow is connected.',
    'CP0-R1-B has not started.',
  ],
};
writeFileSync(
  join(reportDirectory, 'CP0R-R1A-Test-Report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

const commandRows = commandResults.commands
  .map(({ command, status: commandStatus, exitCode }) =>
    `| \`${command}\` | ${commandStatus} | ${exitCode} |`)
  .join('\n');
const screenshotRows = screenshots
  .map((item) =>
    `| ${item.name} | ${item.width}×${item.height} | ${item.pngSignature} | ${item.status} | \`${item.sha256}\` |`)
  .join('\n');
const assetRows = assets
  .map((item) =>
    `| ${item.path} | ${item.width}×${item.height} | \`${item.sha256}\` |`)
  .join('\n');
const markdown = `# CP0-R1-A Test Report

- Status: **${status}**
- Scope: CP0-R1-A static visual shell only
- Cocos Creator: **3.8.8**
- Start commit: \`${report.startCommit}\`
- Baseline tag: \`${report.baselineTag}\`
- Completion implementation commit: \`${report.completionImplementationCommit}\`
- Canonical config: schema \`${registry.gameplay.schemaVersion}\`, hash \`${registry.configHash}\`
- Protected Domain/config diff: **${protectedDiff ? 'FAIL' : 'zero'}**

## Delivered states

- READY: 01:30, score 0, clue 2/2/1, empty pot, six empty slots, disabled fire.
- POT_REVIEW: 01:08, score 12,480, COMBO ×1.5, GOOD, five one-unit slots, tomato/egg/scallion pot, enabled fire.
- QUICK_REVEAL_REPEAT: dimmed kitchen, normal tomato-egg dish, three stars, +1,100, cumulative ×2 and one next clue.

Hidden keyboard keys 1/2/3 and query values \`ready\`, \`pot\`, \`reveal\` are the only state-switching entry points. There are no visible debug controls and no gameplay input.

## Alignment basis

The scene uses a 390×844 \`SafeAreaRoot\` under Cocos \`FIXED_WIDTH\`. Critical HUD begins at y=46; horizontal content retains at least 14 px logical inset. The board frame and programmatic 7×7 matrix share the screen center. The six-slot board is one fixed 2×3 local grid, and the pot uses back → ingredient → front layering.

## Commands

| Command | Status | Exit |
|---|---:|---:|
${commandRows}

## Screenshots

| File | Size | PNG signature | Status | SHA-256 |
|---|---:|---:|---:|---|
${screenshotRows}

## Video

- File: \`${videoAudit.name}\`
- Audit: **${videoAudit.status}**
- Size: ${videoAudit.width}×${videoAudit.height}
- Duration: ${videoAudit.durationSeconds.toFixed(3)} s
- Codec/FPS/frames: ${videoAudit.codec}, ${videoAudit.fps}, ${videoAudit.frames}
- SHA-256: \`${videoAudit.sha256}\`
- Capture: ${videoAudit.captureMethod}

## Cocos build

- Status: **${buildResult.status}**
- Engine confirmed: ${buildResult.verification.engineVersionConfirmed}
- Named build-finished marker: ${buildResult.verification.buildFinished}
- Actual exit code: ${buildResult.verification.actualExitCode}
- Artifact: \`${buildResult.buildArtifact.directory}\`, ${buildResult.buildArtifact.fileCount} files
- Manifest SHA-256: \`${buildResult.buildArtifact.manifestSha256}\`
- Failure markers: ${buildResult.verification.failureMarkers.length ? buildResult.verification.failureMarkers.join(', ') : 'none'}

## Generated asset list

| Asset | Size | SHA-256 |
|---|---:|---|
${assetRows}

Both modular scallion assets were generated with OpenAI imagegen in the existing G1-B jelly-toy style. The tool did not expose a model identifier. Chroma-key removal used soft matte and despill; transparent edges were inspected in the real Cocos 3.8.8 build.

## Temporary boundaries

- All three states remain static acceptance ViewModels.
- No playable Domain session, countdown, touch linking, audio, or multi-pot flow is connected.
- CP0-R1-B has not started.
`;
writeFileSync(
  join(reportDirectory, 'CP0R-R1A-Test-Report.md'),
  markdown,
);
console.log(`CP0-R1-A report: ${status}`);
if (status !== 'PASS') process.exitCode = 1;
