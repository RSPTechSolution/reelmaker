// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { JobBar } from './JobBar.tsx';

afterEach(cleanup);

describe('JobBar', () => {
  it('shows progress with a shimmer while running', () => {
    render(<JobBar job={{ status: 'running', progress: 0.4, logs: [], message: 'voice line 2/6' }} running="Making the voice" done="Voice ready" />);
    expect(screen.getByRole('status').textContent).toContain('Making the voice');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40');
    expect(document.querySelector('.job-shimmer')).not.toBeNull();
  });

  it('confirms completion with the done message', () => {
    render(<JobBar job={{ status: 'done', progress: 1, logs: [] }} running="Making the voice" done="Voice ready" />);
    expect(screen.getByRole('status').textContent).toBe('✓ Voice ready');
  });

  it('shows nothing when done without a done message, and errors as alerts', () => {
    const { container } = render(<JobBar job={{ status: 'done', progress: 1, logs: [] }} running="x" />);
    expect(container.textContent).toBe('');
    cleanup();
    render(<JobBar job={{ status: 'error', progress: 0, logs: [], error: 'voice is stale' }} running="x" />);
    expect(screen.getByRole('alert').textContent).toBe('voice is stale');
  });
});
