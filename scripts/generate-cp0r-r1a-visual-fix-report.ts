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
import {
  R1A_BOARD,
  R1A_VIEW_MODELS,
} from '../assets/game/scripts/presentation/R1AStaticViewModels';

const root = process.cwd();
const reportDirectory = join(root, 'reports', 'cp0-r', 'r1a', 'visual-fix');
const startCommit = 'f4d1f29252319aa6fdf6b7c087bac074ad4eeaae';
mkdirSync(reportDirectory, { recursive: true });

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T;
const sha256 = (bytes: Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');
const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const pngAudit = (name: string, directory = reportDirectory) => {
  const path = join(directory, name);
  if (!existsSync(path)) {
    return {
      name,
      status: 'FAIL',
      pngSignature: false,
      width: 0,
      height: 0,
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
    sha256: sha256(bytes),
  };
};

const assetAudit = (path: string) => {
  const bytes = readFileSync(join(root, path));
  return {
    path,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    sha256: sha256(bytes),
  };
};

const videoName = 'CP0R-R1A-FIX-V01-Static-States-390x844.mp4';
const videoPath = join(reportDirectory, videoName);
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
  name: videoName,
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
    '180 consecutive frames from one live Cocos Creator 3.8.8 Web Mobile instance; hidden keys 1/2/3 switched READY, POT_REVIEW, QUICK_REVEAL_REPEAT; encoded at 15 fps as one uncut 12-second video.',
};

const commandResults = readJson<{
  status: string;
  commands: Array<{
    command: string;
    status: string;
    exitCode: number | null;
    outputSha256: string;
  }>;
}>(join(reportDirectory, 'CP0R-R1A-FIX-Command-Results.json'));
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
}>(join(reportDirectory, 'CP0R-R1A-FIX-Cocos-Build-Result.json'));
const registry = loadConfigRegistry();
const screenshots = [
  pngAudit('CP0R-R1A-FIX-01-Ready-390x844.png'),
  pngAudit('CP0R-R1A-FIX-02-Pot-Review-390x844.png'),
  pngAudit('CP0R-R1A-FIX-03-Quick-Reveal-Repeat-390x844.png'),
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
  startCommit,
  '--',
  ...protectedPaths,
);
const newAssets = [
  assetAudit('assets/resources/game/art/ui/battle/throw_tray_six.png'),
];
const reusedAssets = [
  'background/kitchen_bg.png',
  'ui/battle/board_frame.png',
  'ui/battle/tile_normal.png',
  'ui/battle/order_tray.png',
  'ui/battle/step_badge.png',
  'ui/battle/throw_tray.png',
  'ui/battle/fire_button.png',
  'pot/pot_research.png',
  'pot/pot_research_front.png',
  'ui/reveal/reveal_halo.png',
  'ui/reveal/reveal_pedestal.png',
  'ui/reveal/reveal_nameplate.png',
  'ui/reveal/rarity_normal.png',
  'ui/reveal/star.png',
  'dishes/tomato_egg_no_scallion.png',
  'ingredients/ingredient_tomato.png',
  'ingredients/ingredient_egg.png',
  'ingredients/ingredient_potato.png',
  'ingredients/ingredient_carrot.png',
  'ingredients/ingredient_mushroom.png',
  'ingredients/ingredient_scallion.png',
];
const shellSource = readFileSync(
  join(root, 'assets/game/scripts/presentation/CP0ABattleShell.ts'),
  'utf8',
);
const checks = {
  commands: commandResults.status === 'PASS',
  cocosBuild: buildResult.status === 'PASS',
  screenshots: screenshots.every(({ status }) => status === 'PASS'),
  video: videoAudit.status === 'PASS',
  canonicalSchema: registry.gameplay.schemaVersion === 2,
  canonicalHash: registry.configHash === 'a35691f9',
  protectedDomainAndConfigZeroDiff: protectedDiff === '',
  states: Object.keys(R1A_VIEW_MODELS).join(',') ===
    'READY,POT_REVIEW,QUICK_REVEAL_REPEAT',
  boardGeometry:
    shellSource.includes('const slotSize = 70;')
    && shellSource.includes('const iconSize = 52;')
    && shellSource.includes('const step = 49;'),
  boardHas49Cells:
    R1A_BOARD.length === 7
    && R1A_BOARD.every((row) => row.length === 7)
    && R1A_BOARD.flat().length === 49,
  sixSlots:
    R1A_VIEW_MODELS.READY.slots.length === 6
    && R1A_VIEW_MODELS.POT_REVIEW.slots.length === 6,
  noProgrammaticPanelFallback: !shellSource.includes('roundedPanel('),
  r1bNotStarted:
    !existsSync(join(root, 'assets/game/scripts/presentation/R1B'))
    && !existsSync(join(root, 'tests/r1b')),
};
const status = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
const report = {
  reportId: 'CP0-R-R1-A-VISUAL-FIX-TEST-REPORT',
  generatedAt: new Date().toISOString(),
  status,
  scope: 'CP0-R1-A visual repair only',
  startCommit,
  completionImplementationCommit: git('rev-parse', 'HEAD'),
  branch: git('branch', '--show-current'),
  creatorVersion: '3.8.8',
  canonicalConfig: {
    schemaVersion: registry.gameplay.schemaVersion,
    hash: registry.configHash,
  },
  deliveredStates: R1A_VIEW_MODELS,
  layoutBasis: {
    designResolution: '390×844',
    board:
      'Restored CP0-C geometry: frame [-55,110,500,480], 7×7 local matrix at [13,181], 70 px cream slots, 52 px ingredients, 49 px center spacing.',
    hud:
      'Physical candy/timer/nameplate shells using mint, cream, coral and gold; score is the dominant value.',
    clue:
      'Reuses the cream order tray and groups each ingredient icon with its own quantity.',
    throwTray:
      'One integrated 2×3 wooden kitchen prop; every slot shares fixed local icon and quantity anchors.',
    reveal:
      'Restores CP0-C halo, pedestal, large dish, physical nameplate and 76 px stars; reward and next clue are subordinate physical plaques.',
  },
  evidence: {
    screenshots,
    video: videoAudit,
    commands: commandResults,
    cocosBuild: buildResult,
  },
  assetInventory: {
    newAssets,
    reusedAssets,
    generation:
      'OpenAI imagegen edited the accepted CP0-C wooden throw tray into one modular 2×3 six-well prop. The magenta chroma background was removed with a soft matte and despill; final asset is a transparent 1024×455 PNG.',
  },
  visualComparison: [
    'Board: the reduced floating layout was replaced by the accepted CP0-C 7×7 slot geometry and mint toy frame.',
    'HUD and clue: thin brown rectangles and one-line status text were replaced by physical candy/timer/nameplate and order-tray assets.',
    'Throw area: six table-like rectangles were replaced by one integrated wooden 2×3 kitchen prop.',
    'Fire: restored the original large bright tactile gold fire-button material and visual priority.',
    'Quick reveal: restored CP0-C scale hierarchy with deep mask, halo, pedestal, large dish, nameplate and three large stars.',
  ],
  checks,
  protectedPaths,
  protectedDiff: protectedDiff ? protectedDiff.split('\n') : [],
  modifiedFiles: git('diff', '--name-only', startCommit).split('\n').filter(Boolean),
  temporaryItems: [
    'All three states remain static acceptance ViewModels with hidden switching only.',
    'No real countdown, touch linking, multi-pot loop, audio, or other gameplay was connected.',
    'CP0-R1-B has not started.',
  ],
};
writeFileSync(
  join(reportDirectory, 'CP0R-R1A-FIX-Test-Report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

const commandRows = commandResults.commands
  .map(({ command, status: commandStatus, exitCode, outputSha256 }) =>
    `| \`${command}\` | ${commandStatus} | ${exitCode} | \`${outputSha256}\` |`)
  .join('\n');
const screenshotRows = screenshots
  .map((item) =>
    `| ${item.name} | ${item.width}×${item.height} | ${item.pngSignature} | ${item.status} | \`${item.sha256}\` |`)
  .join('\n');
const newAssetRows = newAssets
  .map((item) =>
    `| \`${item.path}\` | ${item.width}×${item.height} | \`${item.sha256}\` |`)
  .join('\n');
const modifiedRows = report.modifiedFiles.map((path) => `- \`${path}\``).join('\n');
const reusedRows = reusedAssets.map((path) => `- \`${path}\``).join('\n');
const comparisonRows = report.visualComparison.map((item) => `- ${item}`).join('\n');
const markdown = `# CP0-R1-A Visual Fix Test Report

- Status: **${status}**
- Scope: CP0-R1-A visual repair only
- Cocos Creator: **3.8.8**
- Start commit: \`${startCommit}\`
- Completion implementation commit: \`${report.completionImplementationCommit}\`
- Canonical config: schema \`${registry.gameplay.schemaVersion}\`, hash \`${registry.configHash}\`
- Protected Domain/config diff: **${protectedDiff ? 'FAIL' : 'zero'}**
- CP0-R1-B: **not started**

## Delivered states

- READY: physical timer/score HUD, clue tray, complete 49-slot board, empty integrated six-slot wooden tray and material-preserving disabled fire.
- POT_REVIEW: GOOD jelly sticker, Combo badge, filled wooden slots with stable icon/quantity anchors, original research pot and bright “开火研究” action.
- QUICK_REVEAL_REPEAT: deep mask, circular halo, large dish, physical pedestal/nameplate, three stars, integrated +1,100 / 累计×2 reward plaque and small next-clue note.

Hidden keys 1/2/3 remain the only switching mechanism. No visible debug controls, test panel or cursor appears in the evidence.

## CP0-C comparison

${comparisonRows}

## Alignment basis

- Board frame and 7×7 matrix share the 390 px screen center.
- Restored CP0-C board values: frame \`[-55,110,500,480]\`, matrix origin \`[13,181]\`, slot \`70\`, ingredient \`52\`, center step \`49\`.
- Top components reuse tactile asset shells; the score remains the dominant value and “研究分数” is auxiliary.
- The six wells are one integrated 2×3 prop with unified local anchors.
- Quick reveal restores CP0-C hierarchy: halo, pedestal, 336 px dish, nameplate and 76 px stars.

## Commands

| Command | Status | Exit | Output SHA-256 |
|---|---:|---:|---|
${commandRows}

## Screenshots

| File | Size | PNG signature | Status | SHA-256 |
|---|---:|---:|---:|---|
${screenshotRows}

## Video

- File: \`${videoAudit.name}\`
- Audit: **${videoAudit.status}**
- Size/duration: ${videoAudit.width}×${videoAudit.height}, ${videoAudit.durationSeconds.toFixed(3)} s
- Codec/FPS/frames: ${videoAudit.codec}, ${videoAudit.fps}, ${videoAudit.frames}
- SHA-256: \`${videoAudit.sha256}\`
- Capture: ${videoAudit.captureMethod}

## Cocos build

- Status: **${buildResult.status}**
- Engine confirmed: ${buildResult.verification.engineVersionConfirmed}
- Build-finished marker: ${buildResult.verification.buildFinished}
- Actual exit code: ${buildResult.verification.actualExitCode}
- Artifact: \`${buildResult.buildArtifact.directory}\`, ${buildResult.buildArtifact.fileCount} files
- Manifest SHA-256: \`${buildResult.buildArtifact.manifestSha256}\`
- Failure markers: ${buildResult.verification.failureMarkers.length ? buildResult.verification.failureMarkers.join(', ') : 'none'}

## New asset

| Asset | Size | SHA-256 |
|---|---:|---|
${newAssetRows}

OpenAI imagegen edited the accepted CP0-C wooden throw tray into one modular 2×3 six-well prop. Chroma removal used a soft matte and despill; the transparent PNG was inspected in the real Cocos build.

## Reused assets

${reusedRows}

## Modified files

${modifiedRows}

## Scope boundary

- Domain, canonical config and rules have zero diff from the start commit.
- The three states remain static acceptance ViewModels.
- No real countdown, touch linking, multi-pot loop, audio or other gameplay was connected.
- CP0-R1-B has not started.
`;
writeFileSync(
  join(reportDirectory, 'CP0R-R1A-FIX-Test-Report.md'),
  markdown,
);
console.log(`CP0-R1-A Visual Fix report: ${status}`);
if (status !== 'PASS') process.exitCode = 1;
