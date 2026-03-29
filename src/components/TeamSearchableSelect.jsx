import React, { useState, useRef, useEffect } from 'react';
import { Star, X } from 'lucide-react';

const TeamSearchableSelect = ({ teams, selectedTeam, onSelectTeam }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFocus = () => {
    setSearchTerm(selectedTeam || '');
    setIsOpen(true);
  };

  const filteredTeams = teams.filter(team =>
    team.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative w-full sm:w-64">
      <div className="flex items-center gap-2 bg-blue-800/50 p-2 rounded-lg border border-blue-700 cursor-text" onClick={() => setIsOpen(true)}>
        <Star size={18} className="text-fuchsia-300 shrink-0" />
        <input
          type="text"
          value={isOpen ? searchTerm : (selectedTeam || '')}
          onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
          onFocus={handleFocus}
          placeholder="Buscar o destacar equipo..."
          className="bg-transparent text-sm text-white font-medium focus:outline-none w-full placeholder-blue-300"
        />
        {selectedTeam && (
          <button
            onClick={(e) => { e.stopPropagation(); onSelectTeam(''); setSearchTerm(''); }}
            className="text-blue-300 hover:text-white p-1 shrink-0"
            title="Quitar equipo destacado"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto text-sm text-slate-800 py-1">
          {filteredTeams.length > 0 ? (
            filteredTeams.map((team, idx) => (
              <li
                key={`search-team-${idx}`}
                className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${selectedTeam === team ? 'bg-blue-100 font-bold text-blue-900' : ''}`}
                onClick={() => { onSelectTeam(team); setIsOpen(false); }}
              >
                {team}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-slate-400 italic">No se encontraron equipos...</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default TeamSearchableSelect;
