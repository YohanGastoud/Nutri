import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { AppData, Ingredient, Nutrients, Recipe } from './types'
import {
  entryNutrients,
  formatDateLabel,
  groupDayEntries,
  loadData,
  progressPct,
  rebuildIngredients,
  recipeNutrients,
  round0,
  round1,
  saveData,
  sumNutrients,
  todayISO,
  uid,
} from './storage'
import Catalog from './Catalog'
import Recipes from './Recipes'
import './index.css'

type Tab = 'journal' | 'ingredients' | 'recipes'
type NutrientKey = keyof Nutrients

const EMPTY_NUTRIENTS: Nutrients = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fiber: 0,
}

const GOAL_META: {
  key: NutrientKey
  label: string
  unit: string
  step: number
  format: (n: number) => string
}[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', step: 50, format: round0 },
  { key: 'protein', label: 'Protéines', unit: 'g', step: 5, format: round1 },
  { key: 'carbs', label: 'Glucides', unit: 'g', step: 10, format: round1 },
  { key: 'fiber', label: 'Fibres', unit: 'g', step: 1, format: round1 },
]

function shiftDate(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function GoalsProgress({
  totals,
  goals,
  onAdjust,
  onSet,
}: {
  totals: Nutrients
  goals: Nutrients
  onAdjust: (key: NutrientKey, delta: number) => void
  onSet: (key: NutrientKey, value: number) => void
}) {
  return (
    <div className="goals">
      {GOAL_META.map(({ key, label, unit, step, format }) => {
        const current = totals[key]
        const goal = goals[key]
        const pct = progressPct(current, goal)
        const over = goal > 0 && current > goal
        const remaining = Math.max(0, goal - current)
        return (
          <div key={key} className={`goal-row ${key}${over ? ' over' : ''}`}>
            <div className="goal-top">
              <span className="goal-label">{label}</span>
              <span className="goal-values">
                <strong>{format(current)}</strong>
                <span className="goal-sep">/</span>
                <span className="goal-target">
                  <button
                    type="button"
                    className="goal-step"
                    aria-label={`Diminuer objectif ${label}`}
                    onClick={() => onAdjust(key, -step)}
                  >
                    −
                  </button>
                  <input
                    className="goal-input"
                    type="number"
                    min="1"
                    step={step}
                    value={goal}
                    aria-label={`Objectif ${label}`}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (Number.isFinite(v) && v > 0) onSet(key, v)
                    }}
                  />
                  <button
                    type="button"
                    className="goal-step"
                    aria-label={`Augmenter objectif ${label}`}
                    onClick={() => onAdjust(key, step)}
                  >
                    +
                  </button>
                </span>
                <span className="unit">{unit}</span>
              </span>
            </div>
            <div
              className="goal-bar"
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${label} : ${Math.round(pct)} %`}
            >
              <div
                className="goal-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="goal-remaining">
              {over
                ? `+${format(current - goal)} ${unit} au-dessus`
                : remaining === 0
                  ? 'Objectif atteint'
                  : `Reste ${format(remaining)} ${unit}`}
              <span className="goal-pct">{Math.round(pct)} %</span>
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [tab, setTab] = useState<Tab>('journal')
  const [date, setDate] = useState(todayISO)

  const [ingredientId, setIngredientId] = useState('')
  const [quantity, setQuantity] = useState('100')
  const [portions, setPortions] = useState('1')

  const [editId, setEditId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formPortion, setFormPortion] = useState('100')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formNutrients, setFormNutrients] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fiber: '',
  })

  useEffect(() => {
    saveData(data)
  }, [data])

  useEffect(() => {
    if (!ingredientId && data.ingredients.length > 0) {
      setIngredientId(data.ingredients[0].id)
    }
  }, [data.ingredients, ingredientId])

  useEffect(() => {
    if (!formCategoryId && data.categories.length > 0) {
      setFormCategoryId(data.categories[0].id)
    }
  }, [data.categories, formCategoryId])

  const selectedIngredient = useMemo(
    () => data.ingredients.find((i) => i.id === ingredientId) ?? null,
    [data.ingredients, ingredientId],
  )

  const portionSize = selectedIngredient?.portionGrams ?? 100

  useEffect(() => {
    if (!selectedIngredient) return
    setPortions('1')
    setQuantity(String(selectedIngredient.portionGrams))
  }, [selectedIngredient?.id])

  const dayEntries = useMemo(
    () => data.entries.filter((e) => e.date === date),
    [data.entries, date],
  )

  const dayTotals = useMemo(() => {
    const nutrients = dayEntries
      .map((e) => entryNutrients(e, data.ingredients))
      .filter((n): n is Nutrients => n !== null)
    return sumNutrients(nutrients)
  }, [dayEntries, data.ingredients])

  const orderedIngredients = useMemo(
    () => rebuildIngredients(data.categories, data.ingredients),
    [data.categories, data.ingredients],
  )

  const dayBlocks = useMemo(
    () => groupDayEntries(dayEntries, data.recipes),
    [dayEntries, data.recipes],
  )

  function resetIngredientForm() {
    setEditId(null)
    setFormName('')
    setFormPortion('100')
    setFormCategoryId(data.categories[0]?.id ?? '')
    setFormNutrients({
      calories: '',
      protein: '',
      carbs: '',
      fiber: '',
    })
  }

  function startEdit(ing: Ingredient) {
    setEditId(ing.id)
    setFormName(ing.name)
    setFormPortion(String(ing.portionGrams))
    setFormCategoryId(ing.categoryId)
    setFormNutrients({
      calories: String(ing.per100g.calories),
      protein: String(ing.per100g.protein),
      carbs: String(ing.per100g.carbs),
      fiber: String(ing.per100g.fiber),
    })
    setTab('ingredients')
  }

  function syncFromPortions(value: string) {
    setPortions(value)
    const p = Number(value.replace(',', '.'))
    if (!Number.isFinite(p) || p <= 0 || portionSize <= 0) return
    const grams = Math.round(p * portionSize * 10) / 10
    setQuantity(String(grams))
  }

  function syncFromGrams(value: string) {
    setQuantity(value)
    const g = Number(value.replace(',', '.'))
    if (!Number.isFinite(g) || g <= 0 || portionSize <= 0) return
    const p = Math.round((g / portionSize) * 100) / 100
    setPortions(String(p))
  }

  function handleAddEntry(e: FormEvent) {
    e.preventDefault()
    const grams = Number(quantity.replace(',', '.'))
    if (!ingredientId || !Number.isFinite(grams) || grams <= 0) return

    setData((prev) => ({
      ...prev,
      entries: [
        ...prev.entries,
        {
          id: uid(),
          date,
          ingredientId,
          quantityGrams: grams,
        },
      ],
    }))
    setPortions('1')
    setQuantity(String(portionSize))
  }

  function removeEntry(id: string) {
    setData((prev) => ({
      ...prev,
      entries: prev.entries.filter((e) => e.id !== id),
    }))
  }

  function removeRecipeInstance(instanceId: string) {
    setData((prev) => ({
      ...prev,
      entries: prev.entries.filter((e) => e.recipeInstanceId !== instanceId),
    }))
  }

  function addRecipeToDay(recipe: Recipe) {
    const instanceId = uid()
    const newEntries = recipe.items
      .filter((item) =>
        data.ingredients.some((i) => i.id === item.ingredientId),
      )
      .map((item) => ({
        id: uid(),
        date,
        ingredientId: item.ingredientId,
        quantityGrams: item.quantityGrams,
        recipeId: recipe.id,
        recipeInstanceId: instanceId,
      }))
    if (newEntries.length === 0) return
    setData((prev) => ({
      ...prev,
      entries: [...prev.entries, ...newEntries],
    }))
  }

  function handleSaveIngredient(e: FormEvent) {
    e.preventDefault()
    const name = formName.trim()
    if (!name) return

    const per100g: Nutrients = {
      calories: Number(formNutrients.calories.replace(',', '.')) || 0,
      protein: Number(formNutrients.protein.replace(',', '.')) || 0,
      carbs: Number(formNutrients.carbs.replace(',', '.')) || 0,
      fiber: Number(formNutrients.fiber.replace(',', '.')) || 0,
    }
    const portionGrams =
      Number(formPortion.replace(',', '.')) > 0
        ? Number(formPortion.replace(',', '.'))
        : 100
    const categoryId =
      formCategoryId || data.categories[0]?.id || 'cat-general'

    if (editId) {
      setData((prev) => ({
        ...prev,
        ingredients: rebuildIngredients(
          prev.categories,
          prev.ingredients.map((ing) =>
            ing.id === editId
              ? { ...ing, name, per100g, portionGrams, categoryId }
              : ing,
          ),
        ),
      }))
    } else {
      const newId = uid()
      setData((prev) => ({
        ...prev,
        ingredients: rebuildIngredients(prev.categories, [
          ...prev.ingredients,
          { id: newId, name, per100g, portionGrams, categoryId },
        ]),
      }))
      setIngredientId(newId)
    }
    resetIngredientForm()
  }

  function removeIngredient(id: string) {
    const used = data.entries.some((e) => e.ingredientId === id)
    if (
      used &&
      !confirm(
        'Cet ingrédient est utilisé dans le journal. Le supprimer retirera aussi les entrées liées. Continuer ?',
      )
    ) {
      return
    }
    setData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((i) => i.id !== id),
      entries: prev.entries.filter((e) => e.ingredientId !== id),
      recipes: prev.recipes
        .map((r) => ({
          ...r,
          items: r.items.filter((it) => it.ingredientId !== id),
        }))
        .filter((r) => r.items.length > 0),
    }))
    if (ingredientId === id) setIngredientId('')
    if (editId === id) resetIngredientForm()
  }

  function adjustGoal(key: NutrientKey, delta: number) {
    setData((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [key]: Math.max(1, prev.goals[key] + delta),
      },
    }))
  }

  function setGoal(key: NutrientKey, value: number) {
    setData((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [key]: Math.max(1, value),
      },
    }))
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Nutri</h1>
          <p>Compte tes apports, jour après jour.</p>
        </div>
        <div className="date-nav">
          <button
            type="button"
            aria-label="Jour précédent"
            onClick={() => setDate((d) => shiftDate(d, -1))}
          >
            ‹
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date"
          />
          <button
            type="button"
            aria-label="Jour suivant"
            onClick={() => setDate((d) => shiftDate(d, 1))}
          >
            ›
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Sections">
        <button
          type="button"
          className={tab === 'journal' ? 'active' : ''}
          onClick={() => setTab('journal')}
        >
          Journal
        </button>
        <button
          type="button"
          className={tab === 'ingredients' ? 'active' : ''}
          onClick={() => setTab('ingredients')}
        >
          Ingrédients
        </button>
        <button
          type="button"
          className={tab === 'recipes' ? 'active' : ''}
          onClick={() => setTab('recipes')}
        >
          Recettes
        </button>
      </nav>

      {tab === 'journal' && (
        <>
          <section className="panel">
            <div className="section-head">
              <h2>{formatDateLabel(date)}</h2>
              <span className="badge">
                {dayEntries.length} aliment
                {dayEntries.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="hint">
              Progression vers ton objectif — ajuste avec − / + ou en tapant la valeur.
            </p>
            <GoalsProgress
              totals={dayTotals}
              goals={data.goals}
              onAdjust={adjustGoal}
              onSet={setGoal}
            />
          </section>

          <section className="panel">
            <h2>Ajouter</h2>
            <p className="hint">
              Ingrédient à la carte, ou une recette d’un coup.
            </p>

            {data.recipes.length > 0 && (
              <div className="recipe-quick">
                <p className="recipe-quick-label">Recettes rapides</p>
                <div className="recipe-chips">
                  {data.recipes.map((recipe) => {
                    const totals = recipeNutrients(recipe, data.ingredients)
                    return (
                      <button
                        key={recipe.id}
                        type="button"
                        className="recipe-chip"
                        onClick={() => addRecipeToDay(recipe)}
                      >
                        <span className="recipe-chip-name">{recipe.name}</span>
                        <span className="recipe-chip-meta">
                          {round0(totals.calories)} kcal · {recipe.items.length}{' '}
                          ingr.
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {orderedIngredients.length === 0 ? (
              <p className="empty">
                Aucun ingrédient pour l’instant.{' '}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setTab('ingredients')}
                >
                  En créer un
                </button>
              </p>
            ) : (
              <form className="form-row" onSubmit={handleAddEntry}>
                <div className="field field-wide">
                  <label htmlFor="ingredient">Ingrédient</label>
                  <select
                    id="ingredient"
                    value={ingredientId}
                    onChange={(e) => setIngredientId(e.target.value)}
                  >
                    {data.categories.map((cat) => {
                      const items = orderedIngredients.filter(
                        (i) => i.categoryId === cat.id,
                      )
                      if (items.length === 0) return null
                      return (
                        <optgroup key={cat.id} label={cat.name}>
                          {items.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name} ({round0(ing.portionGrams)} g / portion)
                            </option>
                          ))}
                        </optgroup>
                      )
                    })}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="portions">Portions</label>
                  <input
                    id="portions"
                    type="number"
                    min="0"
                    step="any"
                    value={portions}
                    onChange={(e) => syncFromPortions(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="quantity">Quantité (g)</label>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => syncFromGrams(e.target.value)}
                    required
                  />
                </div>
                <button className="btn btn-primary" type="submit">
                  Ajouter
                </button>
              </form>
            )}

            {dayEntries.length === 0 ? (
              <p className="empty">Rien encore aujourd’hui. Ajoute ton premier aliment.</p>
            ) : (
              <div className="day-blocks">
                {dayBlocks.map((block) => {
                  if (block.type === 'single') {
                    const entry = block.entry
                    const ing = data.ingredients.find(
                      (i) => i.id === entry.ingredientId,
                    )
                    const n =
                      entryNutrients(entry, data.ingredients) ?? EMPTY_NUTRIENTS
                    return (
                      <ul className="list" key={entry.id}>
                        <li>
                          <div className="item-main">
                            <p className="item-title">
                              {ing?.name ?? 'Ingrédient supprimé'}
                            </p>
                            <p className="item-meta">
                              {ing && ing.portionGrams > 0
                                ? (() => {
                                    const p =
                                      entry.quantityGrams / ing.portionGrams
                                    return `${round1(p)} portion${
                                      Math.abs(p - 1) < 0.05 ? '' : 's'
                                    } · `
                                  })()
                                : ''}
                              {round0(entry.quantityGrams)} g ·{' '}
                              {round0(n.calories)} kcal
                            </p>
                            <div className="macros">
                              <span>P {round1(n.protein)} g</span>
                              <span>G {round1(n.carbs)} g</span>
                              <span>F {round1(n.fiber)} g</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => removeEntry(entry.id)}
                          >
                            Retirer
                          </button>
                        </li>
                      </ul>
                    )
                  }

                  const totals = sumNutrients(
                    block.entries
                      .map((e) => entryNutrients(e, data.ingredients))
                      .filter((n): n is Nutrients => n !== null),
                  )
                  return (
                    <div className="recipe-block" key={block.instanceId}>
                      <div className="recipe-block-head">
                        <div>
                          <p className="item-title">{block.name}</p>
                          <p className="item-meta">
                            Recette · {round0(totals.calories)} kcal
                          </p>
                          <div className="macros">
                            <span>P {round1(totals.protein)} g</span>
                            <span>G {round1(totals.carbs)} g</span>
                            <span>F {round1(totals.fiber)} g</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => removeRecipeInstance(block.instanceId)}
                        >
                          Retirer
                        </button>
                      </div>
                      <ul className="list recipe-block-items">
                        {block.entries.map((entry) => {
                          const ing = data.ingredients.find(
                            (i) => i.id === entry.ingredientId,
                          )
                          const n =
                            entryNutrients(entry, data.ingredients) ??
                            EMPTY_NUTRIENTS
                          return (
                            <li key={entry.id}>
                              <div className="item-main">
                                <p className="item-title">
                                  {ing?.name ?? 'Ingrédient supprimé'}
                                </p>
                                <p className="item-meta">
                                  {round0(entry.quantityGrams)} g ·{' '}
                                  {round0(n.calories)} kcal
                                </p>
                              </div>
                              <button
                                type="button"
                                className="btn-danger"
                                onClick={() => removeEntry(entry.id)}
                              >
                                Retirer
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}

      {tab === 'recipes' && (
        <Recipes
          categories={data.categories}
          ingredients={data.ingredients}
          recipes={data.recipes}
          onChange={(recipes) => setData((prev) => ({ ...prev, recipes }))}
        />
      )}

      {tab === 'ingredients' && (
        <>
          <section className="panel">
            <h2>{editId ? 'Modifier un ingrédient' : 'Nouvel ingrédient'}</h2>
            <p className="hint">
              Valeurs pour 100 g, plus le poids d’une portion habituelle.
            </p>
            <form className="ingredient-form" onSubmit={handleSaveIngredient}>
              <div className="field name-field">
                <label htmlFor="name">Nom</label>
                <input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex. Yaourt grec"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="category">Catégorie</label>
                <select
                  id="category"
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  required
                >
                  {data.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="portion">Portion habituelle (g)</label>
                <input
                  id="portion"
                  type="number"
                  min="1"
                  step="1"
                  value={formPortion}
                  onChange={(e) => setFormPortion(e.target.value)}
                  required
                />
              </div>
              {(
                [
                  ['calories', 'kcal'],
                  ['protein', 'Prot. (g)'],
                  ['carbs', 'Gluc. (g)'],
                  ['fiber', 'Fibres (g)'],
                ] as const
              ).map(([key, label]) => (
                <div className="field" key={key}>
                  <label htmlFor={key}>{label}</label>
                  <input
                    id={key}
                    type="number"
                    min="0"
                    step="0.1"
                    value={formNutrients[key]}
                    onChange={(e) =>
                      setFormNutrients((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              ))}
              <div className="actions">
                <button className="btn btn-primary" type="submit">
                  {editId ? 'Enregistrer' : 'Ajouter'}
                </button>
                {editId && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={resetIngredientForm}
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </section>

          <Catalog
            categories={data.categories}
            ingredients={data.ingredients}
            editId={editId}
            onChange={({ categories, ingredients }) =>
              setData((prev) => ({ ...prev, categories, ingredients }))
            }
            onEdit={startEdit}
            onRemove={removeIngredient}
          />
        </>
      )}
    </div>
  )
}
