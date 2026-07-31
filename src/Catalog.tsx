import type { DragEvent, FormEvent } from 'react'
import { useState } from 'react'
import type { Category, Ingredient } from './types'
import { rebuildIngredients, round0, round1, scaleNutrients, uid } from './storage'

type Props = {
  categories: Category[]
  ingredients: Ingredient[]
  editId: string | null
  onChange: (next: {
    categories: Category[]
    ingredients: Ingredient[]
  }) => void
  onEdit: (ing: Ingredient) => void
  onRemove: (id: string) => void
}

export default function Catalog({
  categories,
  ingredients,
  editId,
  onChange,
  onEdit,
  onRemove,
}: Props) {
  const [newCategoryName, setNewCategoryName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)

  function update(
    nextCategories: Category[],
    nextIngredients: Ingredient[],
  ) {
    onChange({
      categories: nextCategories,
      ingredients: rebuildIngredients(nextCategories, nextIngredients),
    })
  }

  function handleAddCategory(e: FormEvent) {
    e.preventDefault()
    const name = newCategoryName.trim()
    if (!name) return
    update([...categories, { id: uid(), name }], ingredients)
    setNewCategoryName('')
  }

  function startRename(cat: Category) {
    setRenamingId(cat.id)
    setRenameValue(cat.name)
  }

  function commitRename() {
    if (!renamingId) return
    const name = renameValue.trim()
    if (!name) {
      setRenamingId(null)
      return
    }
    update(
      categories.map((c) => (c.id === renamingId ? { ...c, name } : c)),
      ingredients,
    )
    setRenamingId(null)
  }

  function removeCategory(id: string) {
    if (categories.length <= 1) {
      alert('Il faut au moins une catégorie.')
      return
    }
    const fallback = categories.find((c) => c.id !== id)!.id
    const hasItems = ingredients.some((i) => i.categoryId === id)
    if (
      hasItems &&
      !confirm(
        'Les ingrédients de cette catégorie seront déplacés vers une autre. Continuer ?',
      )
    ) {
      return
    }
    update(
      categories.filter((c) => c.id !== id),
      ingredients.map((ing) =>
        ing.categoryId === id ? { ...ing, categoryId: fallback } : ing,
      ),
    )
  }

  function moveIngredient(
    ingredientId: string,
    toCategoryId: string,
    toIndex: number,
  ) {
    const item = ingredients.find((i) => i.id === ingredientId)
    if (!item) return
    const fromCategoryId = item.categoryId
    const fromIndexInCat = ingredients
      .filter((i) => i.categoryId === fromCategoryId)
      .findIndex((i) => i.id === ingredientId)

    const without = ingredients.filter((i) => i.id !== ingredientId)
    const moved: Ingredient = { ...item, categoryId: toCategoryId }
    const next: Ingredient[] = []

    for (const cat of categories) {
      const group = without.filter((i) => i.categoryId === cat.id)
      if (cat.id === toCategoryId) {
        let idx = toIndex
        if (fromCategoryId === toCategoryId && fromIndexInCat < toIndex) {
          idx = toIndex - 1
        }
        idx = Math.max(0, Math.min(idx, group.length))
        group.splice(idx, 0, moved)
      }
      next.push(...group)
    }

    for (const ing of without) {
      if (!categories.some((c) => c.id === ing.categoryId)) next.push(ing)
    }

    update(categories, next)
  }

  function onDragStart(e: DragEvent, id: string) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  function onDragEnd() {
    setDragId(null)
    setOverKey(null)
  }

  function dropOn(categoryId: string, index: number) {
    if (!dragId) return
    moveIngredient(dragId, categoryId, index)
    setDragId(null)
    setOverKey(null)
  }

  return (
    <>
      <section className="panel">
        <div className="section-head">
          <h2>Catégories</h2>
        </div>
        <p className="hint">Organise ton catalogue, puis glisse les ingrédients.</p>
        <form className="category-form" onSubmit={handleAddCategory}>
          <div className="field name-field">
            <label htmlFor="new-category">Nouvelle catégorie</label>
            <input
              id="new-category"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Ex. Laitages"
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Ajouter
          </button>
        </form>
        <ul className="category-chips">
          {categories.map((cat) => (
            <li key={cat.id}>
              {renamingId === cat.id ? (
                <input
                  className="rename-input"
                  value={renameValue}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitRename()
                    }
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                />
              ) : (
                <>
                  <span>{cat.name}</span>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => startRename(cat)}
                  >
                    Renommer
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => removeCategory(cat.id)}
                  >
                    Supprimer
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Catalogue</h2>
          <span className="badge">
            {ingredients.length} ingrédient
            {ingredients.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="hint">Glisse-dépose pour réordonner ou changer de catégorie.</p>

        {ingredients.length === 0 && categories.length === 0 ? (
          <p className="empty">Ton catalogue est vide.</p>
        ) : (
          <div className="catalog-groups">
            {categories.map((cat) => {
              const items = ingredients.filter((i) => i.categoryId === cat.id)
              return (
                <div
                  key={cat.id}
                  className={`catalog-group${overKey === `${cat.id}:end` ? ' drop-target' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setOverKey(`${cat.id}:end`)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    dropOn(cat.id, items.length)
                  }}
                >
                  <div className="catalog-group-head">
                    <h3>{cat.name}</h3>
                    <span className="badge">
                      {items.length}
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <p className="empty drop-hint">Dépose un ingrédient ici</p>
                  ) : (
                    <ul className="list">
                      {items.map((ing, index) => {
                        const preview = scaleNutrients(ing.per100g, 100)
                        const key = `${cat.id}:${index}`
                        return (
                          <li
                            key={ing.id}
                            className={[
                              editId === ing.id ? 'editing' : '',
                              dragId === ing.id ? 'dragging' : '',
                              overKey === key ? 'drag-over' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            draggable
                            onDragStart={(e) => onDragStart(e, ing.id)}
                            onDragEnd={onDragEnd}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setOverKey(key)
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              dropOn(cat.id, index)
                            }}
                          >
                            <span className="drag-handle" aria-hidden="true">
                              ⋮⋮
                            </span>
                            <div className="item-main">
                              <p className="item-title">{ing.name}</p>
                              <p className="item-meta">
                                portion {round0(ing.portionGrams)} g · pour 100 g ·{' '}
                                {round0(preview.calories)} kcal
                              </p>
                              <div className="macros">
                                <span>P {round1(preview.protein)} g</span>
                                <span>G {round1(preview.carbs)} g</span>
                                <span>F {round1(preview.fiber)} g</span>
                              </div>
                            </div>
                            <div className="item-actions">
                              <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => onEdit(ing)}
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                className="btn-danger"
                                onClick={() => onRemove(ing.id)}
                              >
                                Supprimer
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

