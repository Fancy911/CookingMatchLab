import type { ResolvedResearchMenu, ResearchSchedulePort } from './ResearchPorts';

const INGREDIENT_POOL: ResolvedResearchMenu['ingredientPool'] = [
  'ING_TOMATO',
  'ING_EGG',
  'ING_POTATO',
  'ING_CARROT',
  'ING_MUSHROOM',
  'ING_SCALLION',
];

const MENUS: Record<string, ResolvedResearchMenu> = {
  DEV_MENU_MULTI: {
    contentPackId: 'DEV_RESEARCH_PACK_V1',
    dailyMenuId: 'DEV_MENU_MULTI',
    scenarioId: 'RS02_MULTI_RECIPE',
    orderId: 'ORD_02',
    ingredientPool: INGREDIENT_POOL,
    recipePool: [
      'RCP_SCALLION_POTATO_CAKE',
      'RCP_GARDEN_MUSHROOM_SOUP',
    ],
    clueIds: ['CLUE_POTATO_CAKE', 'CLUE_GARDEN_SOUP'],
  },
  DEV_MENU_REPEAT: {
    contentPackId: 'DEV_RESEARCH_PACK_V1',
    dailyMenuId: 'DEV_MENU_REPEAT',
    scenarioId: 'RS01_TUTORIAL_REPEAT',
    orderId: 'ORD_01',
    ingredientPool: INGREDIENT_POOL,
    recipePool: ['RCP_TOMATO_EGG'],
    clueIds: ['CLUE_TOMATO_EGG_A', 'CLUE_TOMATO_EGG_B'],
  },
  DEV_MENU_LONG: {
    contentPackId: 'DEV_RESEARCH_PACK_V1',
    dailyMenuId: 'DEV_MENU_LONG',
    scenarioId: 'RS04_INSPIRATION',
    acceptanceFixtureId: 'LONG_LINKS',
    orderId: 'ORD_03',
    ingredientPool: INGREDIENT_POOL,
    recipePool: ['RCP_STAR_MUSHROOM_EGG_CUP', 'RCP_TOMATO_EGG'],
    clueIds: ['CLUE_STAR', 'CLUE_TOMATO_EGG_C'],
  },
  DEV_MENU_TIMEOUT_FIVE: {
    contentPackId: 'DEV_RESEARCH_PACK_V1',
    dailyMenuId: 'DEV_MENU_TIMEOUT_FIVE',
    scenarioId: 'RS05_TIMER_END',
    caseId: 'FIVE_UNITS_AUTO_FIRE',
    orderId: 'ORD_01',
    ingredientPool: INGREDIENT_POOL,
    recipePool: ['RCP_TOMATO_EGG'],
    clueIds: ['CLUE_TOMATO_EGG_A'],
  },
  DEV_MENU_TIMEOUT_THREE: {
    contentPackId: 'DEV_RESEARCH_PACK_V1',
    dailyMenuId: 'DEV_MENU_TIMEOUT_THREE',
    scenarioId: 'RS05_TIMER_END',
    caseId: 'THREE_UNITS_PARTIAL',
    orderId: 'ORD_01',
    ingredientPool: INGREDIENT_POOL,
    recipePool: ['RCP_TOMATO_EGG'],
    clueIds: ['CLUE_TOMATO_EGG_A'],
  },
};

const cloneMenu = (menu: ResolvedResearchMenu): ResolvedResearchMenu => ({
  ...menu,
  ingredientPool: [...menu.ingredientPool],
  recipePool: [...menu.recipePool],
  clueIds: [...menu.clueIds],
});

export class DevelopmentResearchSchedule implements ResearchSchedulePort {
  public resolveMenu(input: {
    nowEpochMs: number;
    forcedMenuId?: string;
  }): ResolvedResearchMenu {
    if (!Number.isFinite(input.nowEpochMs)) {
      throw new Error('Research schedule requires a finite epoch time');
    }
    const menuId = input.forcedMenuId ?? 'DEV_MENU_MULTI';
    const menu = MENUS[menuId];
    if (!menu) {
      throw new Error(`Unknown development research menu ${menuId}`);
    }
    return cloneMenu(menu);
  }

  public listMenuIds(): string[] {
    return Object.keys(MENUS);
  }
}
