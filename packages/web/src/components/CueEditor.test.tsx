// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cue } from '@reelmaker/shared';
import { CueEditor, defaultBlock, type WordOption } from './CueEditor.tsx';

afterEach(cleanup);

const words: WordOption[] = [
  { i: 0, caption: 'AI', start: 0.2 },
  { i: 1, caption: 'se', start: 0.6 },
  { i: 2, caption: 'video', start: 0.9 },
  { i: 3, caption: '3', start: 1.5 },
];
const title: Cue = { id: 'c1', atWord: 0, block: { type: 'title', text: 'AI se video' } };

function setup(cue: Cue = title) {
  const onChange = vi.fn();
  const onDelete = vi.fn();
  const onSeek = vi.fn();
  render(<CueEditor cue={cue} words={words} onChange={onChange} onDelete={onDelete} onSeek={onSeek} />);
  return { onChange, onDelete, onSeek };
}

describe('CueEditor', () => {
  it('CueEditor switching block type resets fields to valid defaults', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText('Block type'), { target: { value: 'bigNumber' } });
    expect(onChange).toHaveBeenCalledWith({ id: 'c1', atWord: 0, block: { type: 'bigNumber', to: 0 } });
  });

  it('every default block is valid for its type', () => {
    expect(defaultBlock('title')).toEqual({ type: 'title', text: '' });
    expect(defaultBlock('card')).toEqual({ type: 'card', title: '' });
    expect(defaultBlock('sticker')).toEqual({ type: 'sticker', text: '' });
    expect(defaultBlock('list')).toEqual({ type: 'list', items: [''] });
    expect(defaultBlock('expression')).toEqual({ type: 'expression', expression: 'happy' });
  });

  it('picks the trigger word from caption words with times', () => {
    const { onChange } = setup();
    const picker = screen.getByLabelText('Starts at word') as HTMLSelectElement;
    expect([...picker.options].map((o) => o.text)[3]).toBe('3 (1.5 s)');
    fireEvent.change(picker, { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith({ ...title, atWord: 3 });
  });

  it('edits block fields and optional end word', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText('Title text'), { target: { value: 'Naya title' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...title, block: { type: 'title', text: 'Naya title' } });
    fireEvent.change(screen.getByLabelText('Ends after word'), { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...title, untilWord: 2 });
    cleanup();
    const withEnd = setup({ ...title, untilWord: 2 });
    fireEvent.change(screen.getByLabelText('Ends after word'), { target: { value: '' } });
    expect(withEnd.onChange).toHaveBeenLastCalledWith(title); // no untilWord key at all
  });

  it('bigNumber edits the number as a number', () => {
    const { onChange } = setup({ id: 'c2', atWord: 3, block: { type: 'bigNumber', to: 3, suffix: ' tips' } });
    fireEvent.change(screen.getByLabelText('Number'), { target: { value: '90' } });
    expect(onChange).toHaveBeenLastCalledWith({ id: 'c2', atWord: 3, block: { type: 'bigNumber', to: 90, suffix: ' tips' } });
  });

  it('list items can be added up to 5', () => {
    const cue: Cue = { id: 'c3', atWord: 1, block: { type: 'list', items: ['a', 'b', 'c', 'd'] } };
    const { onChange } = setup(cue);
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...cue, block: { type: 'list', items: ['a', 'b', 'c', 'd', ''] } });
    cleanup();
    setup({ ...cue, block: { type: 'list', items: ['a', 'b', 'c', 'd', 'e'] } });
    expect((screen.getByRole('button', { name: 'Add item' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('jumps the preview to the cue and deletes it', () => {
    const { onSeek, onDelete } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Show in preview' }));
    expect(onSeek).toHaveBeenCalledWith(title);
    fireEvent.click(screen.getByRole('button', { name: 'Delete cue' }));
    expect(onDelete).toHaveBeenCalled();
  });
});
