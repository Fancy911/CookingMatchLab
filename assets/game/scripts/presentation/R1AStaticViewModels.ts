export type R1AStateId = 'READY' | 'POT_REVIEW' | 'QUICK_REVEAL_REPEAT';

export type R1AIngredientId =
  | 'tomato'
  | 'egg'
  | 'potato'
  | 'carrot'
  | 'mushroom'
  | 'scallion';

export interface R1ASlotView {
  ingredientId?: R1AIngredientId;
  units?: 1;
}

export interface R1AViewModel {
  id: R1AStateId;
  timer: string;
  score: string;
  combo?: string;
  goodSticker: boolean;
  potIngredients: R1AIngredientId[];
  slots: R1ASlotView[];
  fireEnabled: boolean;
  quickReveal: boolean;
}

export const R1A_BOARD: R1AIngredientId[][] = [
  ['tomato', 'egg', 'potato', 'carrot', 'mushroom', 'tomato', 'scallion'],
  ['egg', 'tomato', 'egg', 'mushroom', 'carrot', 'potato', 'tomato'],
  ['potato', 'egg', 'tomato', 'tomato', 'egg', 'scallion', 'mushroom'],
  ['carrot', 'mushroom', 'egg', 'tomato', 'potato', 'tomato', 'egg'],
  ['tomato', 'potato', 'scallion', 'egg', 'tomato', 'mushroom', 'carrot'],
  ['mushroom', 'tomato', 'carrot', 'potato', 'egg', 'tomato', 'scallion'],
  ['egg', 'carrot', 'tomato', 'mushroom', 'potato', 'egg', 'tomato'],
];

const EMPTY_SLOTS: R1ASlotView[] = Array.from({ length: 6 }, () => ({}));
const REVIEW_SLOTS: R1ASlotView[] = [
  { ingredientId: 'tomato', units: 1 },
  { ingredientId: 'egg', units: 1 },
  { ingredientId: 'tomato', units: 1 },
  { ingredientId: 'egg', units: 1 },
  { ingredientId: 'scallion', units: 1 },
  {},
];

export const R1A_VIEW_MODELS: Record<R1AStateId, R1AViewModel> = {
  READY: {
    id: 'READY',
    timer: '01:30',
    score: '0',
    goodSticker: false,
    potIngredients: [],
    slots: EMPTY_SLOTS,
    fireEnabled: false,
    quickReveal: false,
  },
  POT_REVIEW: {
    id: 'POT_REVIEW',
    timer: '01:08',
    score: '12,480',
    combo: 'COMBO ×1.5',
    goodSticker: true,
    potIngredients: ['tomato', 'egg', 'scallion'],
    slots: REVIEW_SLOTS,
    fireEnabled: true,
    quickReveal: false,
  },
  QUICK_REVEAL_REPEAT: {
    id: 'QUICK_REVEAL_REPEAT',
    timer: '01:08',
    score: '12,480',
    combo: 'COMBO ×1.5',
    goodSticker: false,
    potIngredients: ['tomato', 'egg', 'scallion'],
    slots: REVIEW_SLOTS,
    fireEnabled: true,
    quickReveal: true,
  },
};

export const R1A_QUERY_STATE: Record<string, R1AStateId> = {
  ready: 'READY',
  pot: 'POT_REVIEW',
  reveal: 'QUICK_REVEAL_REPEAT',
};
