/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfirmChoiceBlock from './ConfirmChoiceBlock';
import type { AmbiguityCandidate } from '../../../services/contentBlocks';

const CANDIDATES: AmbiguityCandidate[] = [
  { id: 's1', label: 'Sábado vs Hispano', kind: 'session' },
  { id: 's2', label: 'Domingo vs Olímpico', kind: 'session' },
];

describe('ConfirmChoiceBlock', () => {
  it('renders the prompt + a button per candidate', () => {
    render(
      <ConfirmChoiceBlock prompt="¿De qué partido?" candidates={CANDIDATES} intent="convocatoria" onPick={() => {}} />,
    );
    expect(screen.getByText('¿De qué partido?')).toBeInTheDocument();
    expect(screen.getByText('Sábado vs Hispano')).toBeInTheDocument();
    expect(screen.getByText('Domingo vs Olímpico')).toBeInTheDocument();
  });

  it('fires onPick with the chosen candidate + original intent', () => {
    const onPick = vi.fn();
    render(
      <ConfirmChoiceBlock
        prompt="¿De qué partido?"
        candidates={CANDIDATES}
        intent="mándame la convocatoria del partido"
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByText('Sábado vs Hispano'));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(CANDIDATES[0], 'mándame la convocatoria del partido');
  });

  it('renders just the prompt when no candidates (e.g. "este jugador" without screen)', () => {
    render(
      <ConfirmChoiceBlock
        prompt="¿De qué jugador hablas? Dime equipo y dorsal."
        candidates={[]}
        intent="cómo está este jugador"
        onPick={() => {}}
      />,
    );
    expect(screen.getByText(/De qué jugador/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
