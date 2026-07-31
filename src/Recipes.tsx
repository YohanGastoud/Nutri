import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { Category, Ingredient, Recipe, RecipeItem } from './types'
import {
  rebuildIngredients,
  recipeNutrients,
  round0,
  round1,
  uid,
} from './storage'

type DraftItem = {
  key: string
  ingredientId: string
  portions: string
  grams: string
}

type Props = {
  categories: Category[]
  ingredients: Ingredient[]
  recipes: Recipe[]
  onChange: (recipes: Recipe[]) => void
}

function portionOf(ing: Ingredient | undefined): number {
  return ing?.portionGrams && ing.portionGrams > 0 ? ing.portionGrams : 100
}

function emptyDraft(ingredients: Ingredient[]): DraftItem {
  const first = ingredients[0]
  const size = portionOf(first)
  return {
    key: uid(),
    ingredientId: first?.id ?? '',
    portions: '1',
    grams: String(size),
  }
}

export default function Recipes({
  categories,
  ingredients,
  recipes,
  onChange,
}: Props) {
  const ordered = useMemo(
    () => rebuildIngredients(categories, ingredients),
    [categories, ingredients],
  )

  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [draftItems, setDraftItems] = useState<DraftItem[]>(() => [
    emptyDraft(ordered),
  ])

  useEffect(() => {
    if (ordered.length === 0) return
    setDraftItems((prev) =>
      prev.map((item) =>
        ordered.some((i) => i.id === item.ingredientId)
          ? item
          : {
              ...item,
              ingredientId: ordered[0].id,
              portions: '1',
              grams: String(ordered[0].portionGrams),
            },
      ),
    )
  }, [ordered])

  function resetForm() {
    setEditId(null)
    setName('')
    setDraftItems([emptyDraft(ordered)])
  }

  function startEdit(recipe: Recipe) {
    setEditId(recipe.id)
    setName(recipe.name)
    setDraftItems(
      recipe.items.map((it) => {
        const ing = ingredients.find((i) => i.id === it.ingredientId)
        const size = portionOf(ing)
        const portions =
          size > 0
            ? String(Math.round((it.quantityGrams / size) * 100) / 100)
            : '1'
        return {
          key: uid(),
          ingredientId: it.ingredientId,
          portions,
          grams: String(it.quantityGrams),
        }
      }),
    )
  }

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setDraftItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    )
  }

  function changeIngredient(key: string, ingredientId: string) {
    const ing = ingredients.find((i) => i.id === ingredientId)
    const size = portionOf(ing)
    updateItem(key, {
      ingredientId,
      portions: '1',
      grams: String(size),
    })
  }

  function changePortions(key: string, value: string) {
    const item = draftItems.find((i) => i.key === key)
    if (!item) return
    const ing = ingredients.find((i) => i.id === item.ingredientId)
    const size = portionOf(ing)
    const p = Number(value.replace(',', '.'))
    const patch: Partial<DraftItem> = { portions: value }
    if (Number.isFinite(p) && p > 0 && size > 0) {
      patch.grams = String(Math.round(p * size * 10) / 10)
    }
    updateItem(key, patch)
  }

  function changeGrams(key: string, value: string) {
    const item = draftItems.find((i) => i.key === key)
    if (!item) return
    const ing = ingredients.find((i) => i.id === item.ingredientId)
    const size = portionOf(ing)
    const g = Number(value.replace(',', '.'))
    const patch: Partial<DraftItem> = { grams: value }
    if (Number.isFinite(g) && g > 0 && size > 0) {
      patch.portions = String(Math.round((g / size) * 100) / 100)
    }
    updateItem(key, patch)
  }

  function handleSave(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const items: RecipeItem[] = []
    for (const draft of draftItems) {
      const grams = Number(draft.grams.replace(',', '.'))
      if (!draft.ingredientId || !Number.isFinite(grams) || grams <= 0) continue
      items.push({ ingredientId: draft.ingredientId, quantityGrams: grams })
    }
    if (items.length === 0) return

    if (editId) {
      onChange(
        recipes.map((r) =>
          r.id === editId ? { ...r, name: trimmed, items } : r,
        ),
      )
    } else {
      onChange([...recipes, { id: uid(), name: trimmed, items }])
    }
    resetForm()
  }

  function removeRecipe(id: string) {
    if (!confirm('Supprimer cette recette ?')) return
    onChange(recipes.filter((r) => r.id !== id))
    if (editId === id) resetForm()
  }

  if (ordered.length === 0) {
    return (
      <section className="panel">
        <h2>Recettes</h2>
        <p className="empty">
          Ajoute d’abord des ingrédients pour composer une recette.
        </p>
      </section>
    )
  }

  return (
    <>
      <section className="panel">
        <h2>{editId ? 'Modifier une recette' : 'Nouvelle recette'}</h2>
        <p className="hint">
          Assemble un combo (ex. skyr + banane) pour l’ajouter d’un coup au journal.
        </p>
        <form className="recipe-form" onSubmit={handleSave}>
          <div className="field name-field">
            <label htmlFor="recipe-name">Nom</label>
            <input
              id="recipe-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Petit-déj skyr + banane"
              required
            />
          </div>

          <div className="recipe-items">
            {draftItems.map((item) => (
              <div key={item.key} className="recipe-item-row">
                <div className="field field-wide">
                  <label>Ingrédient</label>
                  <select
                    value={item.ingredientId}
                    onChange={(e) => changeIngredient(item.key, e.target.value)}
                  >
                    {categories.map((cat) => {
                      const items = ordered.filter((i) => i.categoryId === cat.id)
                      if (items.length === 0) return null
                      return (
                        <optgroup key={cat.id} label={cat.name}>
                          {items.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name}
                            </option>
                          ))}
                        </optgroup>
                      )
                    })}
                  </select>
                </div>
                <div className="field">
                  <label>Portions</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={item.portions}
                    onChange={(e) => changePortions(item.key, e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Grammes</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={item.grams}
                    onChange={(e) => changeGrams(item.key, e.target.value)}
                    required
                  />
                </div>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={draftItems.length <= 1}
                  onClick={() =>
                    setDraftItems((prev) => prev.filter((i) => i.key !== item.key))
                  }
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>

          <div className="recipe-form-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setDraftItems((prev) => [...prev, emptyDraft(ordered)])}
            >
              + Ingrédient
            </button>
            <div className="actions">
              <button className="btn btn-primary" type="submit">
                {editId ? 'Enregistrer' : 'Créer la recette'}
              </button>
              {editId && (
                <button type="button" className="btn-ghost" onClick={resetForm}>
                  Annuler
                </button>
              )}
            </div>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Mes recettes</h2>
          <span className="badge">
            {recipes.length} recette{recipes.length === 1 ? '' : 's'}
          </span>
        </div>
        {recipes.length === 0 ? (
          <p className="empty">Aucune recette pour l’instant.</p>
        ) : (
          <ul className="list recipe-list">
            {recipes.map((recipe) => {
              const totals = recipeNutrients(recipe, ingredients)
              return (
                <li key={recipe.id} className={editId === recipe.id ? 'editing' : ''}>
                  <div className="item-main">
                    <p className="item-title">{recipe.name}</p>
                    <p className="item-meta">
                      {recipe.items.length} ingrédient
                      {recipe.items.length === 1 ? '' : 's'} ·{' '}
                      {round0(totals.calories)} kcal
                    </p>
                    <ul className="recipe-breakdown">
                      {recipe.items.map((it, idx) => {
                        const ing = ingredients.find((i) => i.id === it.ingredientId)
                        return (
                          <li key={`${it.ingredientId}-${idx}`}>
                            {ing?.name ?? 'Ingrédient manquant'} ·{' '}
                            {round0(it.quantityGrams)} g
                          </li>
                        )
                      })}
                    </ul>
                    <div className="macros">
                      <span>P {round1(totals.protein)} g</span>
                      <span>G {round1(totals.carbs)} g</span>
                      <span>F {round1(totals.fiber)} g</span>
                    </div>
                  </div>
                  <div className="item-actions">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => startEdit(recipe)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => removeRecipe(recipe.id)}
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
