import React from 'react';

const VARIANT_CLASSES = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  accent: 'bg-gradient-to-r from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600 text-white',
  ghost: 'bg-blue-800 hover:bg-blue-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

const SIZE_CLASSES = {
  desktop: 'h-9 px-3 text-xs gap-1.5',
  mobile: 'w-full px-4 py-3 text-sm gap-2',
};

export default function ToolbarButton({
  variant = 'ghost',
  size = 'desktop',
  icon: Icon,
  iconSize,
  label,
  onClick,
  disabled = false,
  title,
  className = '',
  children,
}) {
  const computedIconSize = iconSize ?? (size === 'mobile' ? 16 : 14);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center font-bold rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {Icon && <Icon size={computedIconSize} />}
      {label && <span>{label}</span>}
      {children}
    </button>
  );
}
