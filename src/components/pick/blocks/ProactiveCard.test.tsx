/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProactiveCard from './ProactiveCard';
import type { ProactiveMessage } from '../../../services/aiClient';

const BASE_MSG: ProactiveMessage = {
  kind: 'convocatoria_urgent',
  text: 'Mañana hay partido vs Hispano. La convocatoria aún no está mandada.',
  severity: 'high',
  suggestedPrompt: 'Prepara la convocatoria del partido del sábado',
};

describe('ProactiveCard', () => {
  it('renders text + accept CTA + dismiss button', () => {
    render(<ProactiveCard message={BASE_MSG} onAccept={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText(/Mañana hay partido/)).toBeInTheDocument();
    expect(screen.getByText('Sí, hagámoslo')).toBeInTheDocument();
    expect(screen.getByText('Ahora no')).toBeInTheDocument();
  });

  it('fires onAccept with the suggestedPrompt when CTA clicked', () => {
    const onAccept = vi.fn();
    render(<ProactiveCard message={BASE_MSG} onAccept={onAccept} onDismiss={() => {}} />);
    fireEvent.click(screen.getByText('Sí, hagámoslo'));
    expect(onAccept).toHaveBeenCalledWith('Prepara la convocatoria del partido del sábado');
  });

  it('fires onDismiss with the kind when "Ahora no" clicked', () => {
    const onDismiss = vi.fn();
    render(<ProactiveCard message={BASE_MSG} onAccept={() => {}} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Ahora no'));
    expect(onDismiss).toHaveBeenCalledWith('convocatoria_urgent');
  });

  it('omits accept CTA when suggestedPrompt is missing', () => {
    const msg: ProactiveMessage = { ...BASE_MSG, suggestedPrompt: undefined };
    render(<ProactiveCard message={msg} onAccept={() => {}} onDismiss={() => {}} />);
    expect(screen.queryByText('Sí, hagámoslo')).not.toBeInTheDocument();
    expect(screen.getByText('Ahora no')).toBeInTheDocument();
  });

  it('applies high-severity style for severity:high', () => {
    const { container } = render(<ProactiveCard message={BASE_MSG} onAccept={() => {}} onDismiss={() => {}} />);
    expect(container.querySelector('.bg-amber-50\\/80')).toBeTruthy();
  });

  it('applies info style for severity:info', () => {
    const msg: ProactiveMessage = { ...BASE_MSG, severity: 'info' };
    const { container } = render(<ProactiveCard message={msg} onAccept={() => {}} onDismiss={() => {}} />);
    expect(container.querySelector('.bg-slate-50')).toBeTruthy();
  });
});
