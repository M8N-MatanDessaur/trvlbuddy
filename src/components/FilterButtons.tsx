import React from 'react';

interface FilterButtonsProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  categoryIcons?: { [key: string]: string };
}

const FilterButtons: React.FC<FilterButtonsProps> = ({
  categories,
  activeCategory,
  onCategoryChange,
  categoryIcons = {}
}) => {
  return (
    <div className="flex flex-wrap justify-center gap-2 mb-8">
      {categories.map(category => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`filter-btn ${activeCategory === category ? 'active' : ''}`}
        >
          {categoryIcons[category] && (
            <span className="mr-2">{categoryIcons[category]}</span>
          )}
          {category}
        </button>
      ))}
    </div>
  );
};

export default FilterButtons;