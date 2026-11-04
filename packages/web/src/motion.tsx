import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** True once the element has entered the viewport (immediately if IntersectionObserver is missing). */
export function useInView(ref: RefObject<Element | null>, opts: { once?: boolean; rootMargin?: string } = {}): boolean {
  const { once = true, rootMargin = '0px 0px -8% 0px' } = opts;
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect(); // stays true: nothing more to watch
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, once, rootMargin]);
  return inView;
}

const STAGGER_MS = 80;

/**
 * Fades and slides its content up when it scrolls into view. Content is visible until JS has
 * mounted ("armed" is set by the effect, never in markup), so a failed script never hides it.
 * prefers-reduced-motion is handled in CSS (no movement, instant).
 */
export function Reveal({ children, index = 0, className = '' }: { children: ReactNode; index?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const inView = useInView(ref);
  useEffect(() => setArmed(true), []);
  const state = !armed || inView || typeof IntersectionObserver === 'undefined' ? 'shown' : 'armed';
  return (
    <div
      ref={ref}
      data-reveal={state}
      className={`reveal ${className}`}
      style={{ '--reveal-delay': `${index * STAGGER_MS}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
