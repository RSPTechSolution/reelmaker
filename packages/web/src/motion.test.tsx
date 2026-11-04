// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Reveal } from './motion.tsx';

type Entry = { isIntersecting: boolean };
let observers: { cb: (e: Entry[]) => void; disconnect: () => void; el?: Element }[] = [];

class FakeIO {
  cb: (e: Entry[]) => void;
  disconnected = false;
  el?: Element;
  constructor(cb: (e: Entry[]) => void) {
    this.cb = cb;
    observers.push(this as never);
  }
  observe(el: Element) {
    this.el = el;
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

afterEach(() => {
  cleanup();
  observers = [];
  vi.unstubAllGlobals();
});

describe('Reveal', () => {
  it('arms after mount, then shows when it scrolls into view', () => {
    vi.stubGlobal('IntersectionObserver', FakeIO);
    render(
      <Reveal index={2}>
        <p>Hello</p>
      </Reveal>,
    );
    const box = screen.getByText('Hello').parentElement!;
    expect(box.dataset.reveal).toBe('armed');
    expect(box.style.getPropertyValue('--reveal-delay')).toBe('160ms');
    act(() => observers[0].cb([{ isIntersecting: true }]));
    expect(box.dataset.reveal).toBe('shown');
  });

  it('stays visible when IntersectionObserver is missing', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(
      <Reveal>
        <p>Always</p>
      </Reveal>,
    );
    expect(screen.getByText('Always').parentElement!.dataset.reveal).toBe('shown');
  });

  it('stops observing once shown and on unmount', () => {
    vi.stubGlobal('IntersectionObserver', FakeIO);
    const { unmount } = render(
      <Reveal>
        <p>Once</p>
      </Reveal>,
    );
    const io = observers[0] as unknown as FakeIO;
    act(() => io.cb([{ isIntersecting: true }]));
    expect(io.disconnected).toBe(true);
    unmount();
  });
});
