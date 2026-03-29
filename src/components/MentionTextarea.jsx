import React, { useRef, useState } from 'react';

/**
 * Textarea that detects @ and shows a dropdown of team members.
 * Props: value, onChange, members [{nombre, tipo}], ...rest (textarea props)
 * The final text is plain text (e.g. "Carlos López"), no special markup.
 */
export default function MentionTextarea({ value, onChange, members = [], ...rest }) {
  const [query, setQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const textareaRef = useRef(null);

  const filtered = query !== null
    ? members.filter(m => m.nombre.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  function handleChange(e) {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    onChange(e);

    // Find last @ before cursor
    const textBefore = val.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx !== -1) {
      const fragment = textBefore.slice(atIdx + 1);
      // Only open mention if no spaces in fragment (active mention)
      if (!fragment.includes(' ') || fragment.length === 0) {
        setMentionStart(atIdx);
        setQuery(fragment);
        setSelectedIdx(0);
        return;
      }
    }
    setMentionStart(null);
    setQuery('');
  }

  function insertMention(member) {
    if (mentionStart === null) return;
    const before = value.slice(0, mentionStart);
    const after = value.slice(mentionStart + 1 + query.length);
    const newVal = before + member.nombre + after;
    // Simulate synthetic event
    onChange({ target: { value: newVal } });
    setMentionStart(null);
    setQuery('');
    // Restore focus
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = before.length + member.nombre.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  function handleKeyDown(e) {
    if (mentionStart === null || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filtered[selectedIdx]) {
        e.preventDefault();
        insertMention(filtered[selectedIdx]);
      }
    } else if (e.key === 'Escape') {
      setMentionStart(null);
      setQuery('');
    }
  }

  const showDropdown = mentionStart !== null && filtered.length > 0;

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...rest}
      />
      {showDropdown && (
        <div className="absolute z-50 left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg w-56 overflow-hidden print:hidden">
          {filtered.map((m, i) => (
            <button
              key={m.nombre + i}
              type="button"
              onMouseDown={e => { e.preventDefault(); insertMention(m); }}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${i === selectedIdx ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              <span className="font-medium truncate">{m.nombre}</span>
              <span className="text-xs text-slate-400 shrink-0">{m.tipo === 'staff' ? 'Staff' : 'Jugador'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
