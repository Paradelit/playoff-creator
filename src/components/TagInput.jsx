import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

export default function TagInput({ tags = [], onChange, suggestions = [], placeholder = 'Añadir etiqueta...' }) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const normalizedTags = tags.map((t) => t.toLowerCase());

  const filtered = input.trim()
    ? suggestions.filter(
        (s) => s.toLowerCase().includes(input.toLowerCase()) && !normalizedTags.includes(s.toLowerCase()),
      )
    : suggestions.filter((s) => !normalizedTags.includes(s.toLowerCase()));

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function addTag(value) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (normalizedTags.includes(trimmed.toLowerCase())) return;
    onChange([...tags, trimmed]);
    setInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function removeTag(index) {
    onChange(tags.filter((_, i) => i !== index));
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex flex-wrap gap-1.5 items-center border border-slate-300 rounded-xl px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-400 min-h-[42px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
              className="text-blue-400 hover:text-blue-700 transition-colors"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] text-sm outline-none bg-transparent py-0.5"
        />
      </div>

      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
          {filtered.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(suggestion)}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
