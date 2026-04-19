import React from 'react';
import CategoryChip from '../library/CategoryChip';
import { EXERCISE_CATEGORIES, activeCategoryIds, toggleCategoryInTags } from '../../../utils/exerciseCategories';

export default function CategoryChipPicker({ tags, onChange }) {
  const active = activeCategoryIds(tags || []);

  function handleToggle(categoryId) {
    onChange(toggleCategoryInTags(tags || [], categoryId));
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {EXERCISE_CATEGORIES.map((cat) => (
        <CategoryChip
          key={cat.id}
          category={cat}
          active={active.has(cat.id)}
          onClick={() => handleToggle(cat.id)}
          size="sm"
        />
      ))}
    </div>
  );
}
