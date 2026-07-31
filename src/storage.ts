import type { AppData, Category, Entry, Ingredient, Nutrients } from './types'

const STORAGE_KEY = 'nutri-tracker-v1'

export const DEFAULT_GOALS: Nutrients = {
  calories: 2000,
  protein: 120,
  carbs: 250,
  fiber: 30,
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-feculents', name: 'Féculents' },
  { id: 'cat-proteines', name: 'Protéines' },
  { id: 'cat-fruits', name: 'Fruits' },
]

const DEFAULT_INGREDIENTS: Ingredient[] = [
  {
    id: 'demo-riz',
    name: 'Riz blanc cuit',
    per100g: { calories: 130, protein: 2.7, carbs: 28, fiber: 0.4 },
    portionGrams: 150,
    categoryId: 'cat-feculents',
  },
  {
    id: 'demo-avoine',
    name: 'Flocons d’avoine',
    per100g: { calories: 389, protein: 17, carbs: 66, fiber: 10 },
    portionGrams: 40,
    categoryId: 'cat-feculents',
  },
  {
    id: 'demo-poulet',
    name: 'Poulet grillé',
    per100g: { calories: 165, protein: 31, carbs: 0, fiber: 0 },
    portionGrams: 150,
    categoryId: 'cat-proteines',
  },
  {
    id: 'demo-oeuf',
    name: 'Œuf entier',
    per100g: { calories: 155, protein: 13, carbs: 1.1, fiber: 0 },
    portionGrams: 60,
    categoryId: 'cat-proteines',
  },
  {
    id: 'demo-banane',
    name: 'Banane',
    per100g: { calories: 89, protein: 1.1, carbs: 23, fiber: 2.6 },
    portionGrams: 120,
    categoryId: 'cat-fruits',
  },
]

function emptyData(): AppData {
  return {
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    ingredients: DEFAULT_INGREDIENTS.map((i) => ({ ...i })),
    entries: [],
    goals: { ...DEFAULT_GOALS },
  }
}

function readAmount(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function normalizeNutrients(
  raw: Partial<Nutrients> | undefined,
): Nutrients {
  return {
    calories: readAmount(raw?.calories),
    protein: readAmount(raw?.protein),
    carbs: readAmount(raw?.carbs),
    fiber: readAmount(raw?.fiber),
  }
}

function normalizeGoals(raw: unknown): Nutrients {
  const g = (raw ?? {}) as Partial<Nutrients>
  return {
    calories: readAmount(g.calories, DEFAULT_GOALS.calories) || DEFAULT_GOALS.calories,
    protein: readAmount(g.protein, DEFAULT_GOALS.protein) || DEFAULT_GOALS.protein,
    carbs: readAmount(g.carbs, DEFAULT_GOALS.carbs) || DEFAULT_GOALS.carbs,
    fiber: readAmount(g.fiber, DEFAULT_GOALS.fiber) || DEFAULT_GOALS.fiber,
  }
}

function normalizePortionGrams(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 100
}

function normalizeCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ id: 'cat-general', name: 'Général' }]
  }
  return raw
    .map((c) => {
      const cat = c as Partial<Category>
      if (!cat.id || !cat.name?.trim()) return null
      return { id: String(cat.id), name: String(cat.name).trim() }
    })
    .filter((c): c is Category => c !== null)
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyData()
    const parsed = JSON.parse(raw) as Partial<AppData>
    if (!parsed.ingredients || !parsed.entries) return emptyData()

    const categories = normalizeCategories(parsed.categories)
    const fallbackCategoryId = categories[0].id

    return {
      categories,
      ingredients: parsed.ingredients.map((ing) => {
        const categoryId =
          typeof (ing as Ingredient).categoryId === 'string' &&
          categories.some((c) => c.id === (ing as Ingredient).categoryId)
            ? (ing as Ingredient).categoryId
            : fallbackCategoryId
        return {
          ...ing,
          per100g: normalizeNutrients(ing.per100g),
          portionGrams: normalizePortionGrams(
            (ing as Ingredient).portionGrams,
          ),
          categoryId,
        }
      }),
      entries: parsed.entries,
      goals: normalizeGoals(parsed.goals),
    }
  } catch {
    return emptyData()
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function uid(): string {
  return crypto.randomUUID()
}

export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  const f = grams / 100
  return {
    calories: per100g.calories * f,
    protein: per100g.protein * f,
    carbs: per100g.carbs * f,
    fiber: per100g.fiber * f,
  }
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(
    (acc, n) => ({
      calories: acc.calories + n.calories,
      protein: acc.protein + n.protein,
      carbs: acc.carbs + n.carbs,
      fiber: acc.fiber + n.fiber,
    }),
    { calories: 0, protein: 0, carbs: 0, fiber: 0 },
  )
}

export function entryNutrients(
  entry: Entry,
  ingredients: Ingredient[],
): Nutrients | null {
  const ing = ingredients.find((i) => i.id === entry.ingredientId)
  if (!ing) return null
  return scaleNutrients(ing.per100g, entry.quantityGrams)
}

export function round1(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString('fr-FR')
}

export function round0(n: number): string {
  return Math.round(n).toLocaleString('fr-FR')
}

export function progressPct(current: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(100, (current / goal) * 100)
}

/** Rebuild ingredients respecting category order and intra-category order. */
export function rebuildIngredients(
  categories: Category[],
  ingredients: Ingredient[],
): Ingredient[] {
  const result: Ingredient[] = []
  const used = new Set<string>()
  for (const cat of categories) {
    for (const ing of ingredients) {
      if (ing.categoryId === cat.id && !used.has(ing.id)) {
        result.push(ing)
        used.add(ing.id)
      }
    }
  }
  for (const ing of ingredients) {
    if (!used.has(ing.id)) result.push(ing)
  }
  return result
}
