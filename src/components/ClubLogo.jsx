import React, { useState } from 'react';

/**
 * Muestra el logo del club.
 * Prioridad: profile.logoClub → /logo-club.png → placeholder texto
 */
export default function ClubLogo({ logoUrl, className = 'w-20 h-20', placeholderText = '[Logo]' }) {
  const [failed, setFailed] = useState(false);
  const src = logoUrl || '/logo-club.png';

  if (failed) {
    return (
      <div className={`${className} border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 font-sans`}>
        {placeholderText}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Logo"
      className={`${className} object-contain`}
      onError={() => setFailed(true)}
    />
  );
}
