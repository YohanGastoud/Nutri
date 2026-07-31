export type Nutrients = {
  calories: number // kcal
  protein: number // g
  carbs: number // g
  fiber: number // g
}

export type Ingredient = {
  id: string
  name: string
  /** Valeurs pour 100 g */
  per100g: Nutrients
  /** Poids d’une portion habituelle en grammes */
  portionGrams: number
}

export type Entry = {
  id: string
  date: string // YYYY-MM-DD
  ingredientId: string
  quantityGrams: number
}

export type AppData = {
  ingredients: Ingredient[]
  entries: Entry[]
  goals: Nutrients
}
