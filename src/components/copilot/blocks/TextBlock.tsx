import React from 'react';

export default function TextBlock({ markdown }: { markdown: string }) {
  return <p className="whitespace-pre-wrap text-sm leading-relaxed">{markdown}</p>;
}
