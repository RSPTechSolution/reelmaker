// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Reel } from '@reelmaker/shared';
import { ScriptStep } from './ScriptStep.tsx';

const here = path.dirname(fileURLToPath(import.meta.url));
const example = (): Reel =>
  JSON.parse(readFileSync(path.join(here, '..', '..', '..', 'shared', 'fixtures', 'example-reel.json'), 'utf8'));

afterEach(cleanup);

const saveButton = () => screen.getByRole('button', { name: 'Save script' }) as HTMLButtonElement;
const spokenOf = (n: number) => screen.getByLabelText(`Line ${n} spoken (Devanagari)`) as HTMLInputElement;
const captionOf = (n: number) => screen.getByLabelText(`Line ${n} caption (Roman)`) as HTMLInputElement;

describe('ScriptStep', () => {
  it('ScriptStep flags word-count mismatch and disables Save', () => {
    render(<ScriptStep reel={example()} onSave={vi.fn()} />);
    fireEvent.change(spokenOf(1), { target: { value: 'एआई से' } });
    expect(saveButton().disabled).toBe(true);
    const row = spokenOf(1).closest('li')!;
    expect(row.textContent).toContain('8 words vs 2');
    expect(row.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('status').textContent).toMatch(/1 line needs the same number of words/);
  });

  it('Save is disabled until something changes, then saves the edited reel', async () => {
    const onSave = vi.fn(async (r: Reel) => r);
    render(<ScriptStep reel={example()} onSave={onSave} />);
    expect(saveButton().disabled).toBe(true);
    fireEvent.change(captionOf(2), { target: { value: 'Bas 3 aasaan steps follow karo' } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].lines[1].caption).toBe('Bas 3 aasaan steps follow karo');
  });

  it('adds, moves and removes lines with fresh unique ids', () => {
    const onSave = vi.fn(async (r: Reel) => r);
    render(<ScriptStep reel={example()} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    fireEvent.change(captionOf(7), { target: { value: 'Naya line' } });
    fireEvent.change(spokenOf(7), { target: { value: 'नया लाइन' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move line 7 up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove line 1' }));
    fireEvent.click(saveButton());
    const lines = onSave.mock.calls[0][0].lines;
    expect(lines).toHaveLength(6);
    expect(lines[4]).toEqual({ id: 'l7', caption: 'Naya line', spoken: 'नया लाइन' });
    expect(new Set(lines.map((l: { id: string }) => l.id)).size).toBe(6);
  });

  it('shows the estimated duration at 2.3 words per second', () => {
    render(<ScriptStep reel={example()} onSave={vi.fn()} />);
    // example has 40 words → 40 / 2.3 ≈ 17 s
    expect(screen.getByText(/40 words, about 17 s/)).toBeTruthy();
  });
});
