import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface FilterDropdownProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  categoryIcons?: { [key: string]: React.ReactNode };
  label?: string;
  placeholder?: string;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  categories,
  activeCategory,
  onCategoryChange,
  categoryIcons = {},
  label = "Filter by Category",
  placeholder = "Select category..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (category: string) => {
    onCategoryChange(category);
    setIsOpen(false);
  };

  const getDisplayContent = () => {
    if (activeCategory === 'All') return 'All Categories';
    const icon = categoryIcons[activeCategory];
    if (!icon) return activeCategory;
    return (
      <span className="inline-flex items-center gap-2">
        <span className="flex-shrink-0">{icon}</span>
        <span>{activeCategory}</span>
      </span>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-text-primary mb-2">
        {label}
      </label>
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-w-[200px] max-w-xs mx-auto flex items-center justify-between px-4 py-3 bg-surface-container border border-outline rounded-xl text-text-primary hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary transition-all"
      >
        <span className="flex items-center gap-2 flex-1 min-w-0">
          <span className="truncate font-medium">
            {getDisplayContent()}
          </span>
        </span>
        <ChevronDown 
          size={20} 
          className={`text-text-secondary transition-transform duration-200 flex-shrink-0 ml-2 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container border border-outline rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
          {categories.map((category) => {
            const icon = categoryIcons[category];
            const isSelected = category === activeCategory;
            
            return (
              <button
                key={category}
                onClick={() => handleSelect(category)}
                className={`w-full px-4 py-3 text-left hover:bg-surface-container-high transition-colors flex items-center justify-between border-b border-outline last:border-b-0 ${
                  isSelected ? 'bg-primary/5 text-primary' : 'text-text-primary'
                }`}
              >
                <span className="flex items-center gap-3 flex-1 min-w-0">
                  {icon && <span className="text-lg flex-shrink-0">{icon}</span>}
                  <span className="font-medium truncate">
                    {category === 'All' ? 'All Categories' : category}
                  </span>
                </span>
                {isSelected && (
                  <Check size={16} className="text-primary flex-shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FilterDropdown;