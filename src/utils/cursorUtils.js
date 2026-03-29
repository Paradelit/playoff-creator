export const CURSOR_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];

export const getUserColor = (uid) => {
  if (!uid) return CURSOR_COLORS[0];
  const hash = [...uid].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
};
