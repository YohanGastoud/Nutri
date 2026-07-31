export type Nutrients = {
  calories: number // kcal
  protein: number // g
  carbs: number // g
  fiber: number // g
}

export type Category = {
  id: string
  name: string
}

export type Ingredient = {
  id: string
  name: string
  /** Valeurs pour 100 g */
  per100g: Nutrients
  /** Poids d’une portion habituelle en grammes */
  portionGrams: number
  categoryId: string
}

export type RecipeItem = {
  ingredientId: string
  quantityGrams: number
}

export type Recipe = {
  id: string
  name: string
  items: RecipeItem[]
}

export type Entry = {
  id: string
  date: string // YYYY-MM-DD
  ingredientId: string
  quantityGrams: number
  /** Recette d’origine, si ajoutée via une recette */
  recipeId?: string
  /** Instance du jour (pour grouper / retirer le combo) */
  recipeInstanceId?: string
}

export type AppData = {
  categories: Category[]
  ingredients: Ingredient[]
  recipes: Recipe[]
  entries: Entry[]
  goals: Nutrients
}
