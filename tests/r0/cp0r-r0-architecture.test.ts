import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_CONFIG_HASH,
  loadCanonicalConfig,
} from '../../assets/game/scripts/infrastructure/JsonConfigAdapter';

const root = process.cwd();
const source = (path: string): string => readFileSync(join(root, path), 'utf8');
const domainCore = source('assets/game/scripts/domain/cp0b/core.ts');
const domainTypes = source('assets/game/scripts/domain/cp0b/types.ts');
const registryPath = 'assets/game/scripts/application/cp0c/ConfigRegistry.ts';
const registrySource = source(registryPath);
const loaderSource = source('assets/game/scripts/infrastructure/CocosJsonConfigLoader.ts');
const shellSource = source('assets/game/scripts/presentation/CP0ABattleShell.ts');

const count = (text: string, expression: RegExp): number =>
  [...text.matchAll(expression)].length;

const typescriptFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? typescriptFiles(path)
      : path.endsWith('.ts')
        ? [path]
        : [];
  });

describe('CP0-R0-A1 canonical architecture', () => {
  it('A001 Domain only contains one PotModel', () => {
    expect(count(domainCore, /export class PotModel\b/g)).toBe(1);
    expect(count(domainCore, /class \w*PotModel\b/g)).toBe(1);
  });

  it('A002 Domain only contains one RecipeResolver', () => {
    expect(count(domainCore, /export class RecipeResolver\b/g)).toBe(1);
    expect(count(domainCore, /class \w*RecipeResolver\b/g)).toBe(1);
  });

  it('A003 Domain only contains one StarCalculator', () => {
    expect(count(domainCore, /export class StarCalculator\b/g)).toBe(1);
    expect(count(domainCore, /class \w*StarCalculator\b/g)).toBe(1);
  });

  it('A004 prefixed parallel rule classes do not exist', () => {
    const forbiddenClassNames = ['R0PotModel', 'R0RecipeResolver', 'R0StarCalculator'];
    forbiddenClassNames.forEach((name) => expect(domainCore).not.toContain(name));
  });

  it('A005 only one ConfigRegistry exists and the prefixed file is deleted', () => {
    const applicationFiles = typescriptFiles(join(
      root,
      'assets/game/scripts/application',
    ));
    const registryDeclarations = applicationFiles.reduce(
      (total, path) => total + count(readFileSync(path, 'utf8'), /export class ConfigRegistry\b/g),
      0,
    );
    expect(registryDeclarations).toBe(1);
    expect(existsSync(join(
      root,
      'assets/game/scripts/application/cp0c/R0ConfigRegistry.ts',
    ))).toBe(false);
    expect(registrySource).toContain('schemaVersion must be 2');
  });

  it('A006 canonical types have no parallel prefixed synonyms', () => {
    const forbiddenTypeNames = [
      'R0GameplayConfig',
      'R0RecipeConfig',
      'R0OrderConfig',
      'R0ScenarioConfig',
      'R0ThrowRecord',
      'R0CookResult',
    ];
    forbiddenTypeNames.forEach((name) => expect(domainTypes).not.toContain(name));
    [
      'GameplayConfig',
      'RecipeConfig',
      'OrderConfig',
      'ScenarioConfig',
      'ThrowRecord',
      'CookResult',
    ].forEach((name) => expect(domainTypes).toContain(`interface ${name}`));
  });

  it('A007 canonical resource loader accepts schemaVersion 2 and verifies the hash', async () => {
    const resourceRoot = join(root, 'assets/resources');
    const registry = await loadCanonicalConfig(async (resourcePath) =>
      JSON.parse(readFileSync(join(resourceRoot, `${resourcePath}.json`), 'utf8')) as unknown);
    expect(registry.gameplay.schemaVersion).toBe(2);
    expect(registry.configHash).toBe(EXPECTED_CONFIG_HASH);
    expect(EXPECTED_CONFIG_HASH).toBe('a35691f9');
    expect(loaderSource).toContain('return loadCanonicalConfig(loadJson)');
    expect(loaderSource).not.toContain(
      "throw new Error('CP0-R0规则迁移中，视觉接入待R1')",
    );
  });

  it('A008 authorized R1-A shell follows successful canonical loading', () => {
    expect(shellSource).toContain('new CocosJsonConfigLoader().load()');
    expect(shellSource).toContain("registry.configHash !== 'a35691f9'");
    expect(shellSource).toContain('this.buildVisualShell()');
    expect(shellSource).toContain('this.renderState(this.state)');
    expect(shellSource).not.toContain('PrototypeSession');
    expect(shellSource).not.toContain('BattleBoardController');
    expect(shellSource).toContain("this.bootstrap().catch");
    expect(shellSource).toContain('R1-A 配置加载失败');
  });
});
