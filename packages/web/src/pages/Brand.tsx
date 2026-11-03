import { useEffect, useMemo, useState } from 'react';
import type { Brand as BrandT, MascotConfig } from '@reelmaker/shared';
import { api, ApiError } from '../api.ts';
import { Preview } from '../components/Preview.tsx';
import { demoProps } from '../demo.ts';

const COLORS: { key: keyof BrandT; label: string }[] = [
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Cards' },
  { key: 'text', label: 'Text' },
  { key: 'accent', label: 'Accent (keywords, numbers)' },
  { key: 'accent2', label: 'Second accent (stickers, bullets)' },
];
// Google fonts that read well for Roman Hinglish at reel sizes.
const FONTS = ['Baloo 2', 'Poppins', 'Mukta', 'Hind', 'Rajdhani', 'Teko', 'Montserrat', 'Kalam'];

export function Brand() {
  const [brand, setBrand] = useState<BrandT | null>(null);
  const [mascot, setMascot] = useState<MascotConfig>(demoProps.mascot);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.getBrand().then(setBrand, (e) => setNote({ ok: false, text: String(e.message ?? e) }));
    api.getMascot().then(setMascot, () => {});
  }, []);
  const props = useMemo(() => (brand ? { ...demoProps, brand, mascot } : null), [brand, mascot]);
  if (!brand || !props) return <p className="text-ink-soft">{note?.text ?? 'Loading…'}</p>;

  const set = <K extends keyof BrandT>(k: K, v: BrandT[K]) => {
    setBrand({ ...brand, [k]: v });
    setNote(null);
  };
  async function save() {
    try {
      setBrand(await api.saveBrand(brand!));
      setNote({ ok: true, text: 'Brand saved. New renders use it.' });
    } catch (e) {
      setNote({ ok: false, text: e instanceof ApiError ? e.message : String(e) });
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-10">
      <div className="flex w-full max-w-md flex-col gap-5">
        <h1 className="text-2xl font-bold">Brand</h1>
        <fieldset className="flex flex-col gap-3">
          <legend className="label">Colours</legend>
          {COLORS.map((c) => (
            <div key={c.key} className="flex items-center gap-3">
              <input
                type="color"
                aria-label={c.label}
                value={brand[c.key] as string}
                onChange={(e) => set(c.key, e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-ink-faint bg-paper"
              />
              <input
                className="field w-28 font-mono text-sm"
                value={brand[c.key] as string}
                onChange={(e) => set(c.key, e.target.value)}
                aria-label={`${c.label} hex`}
              />
              <span className="text-sm">{c.label}</span>
            </div>
          ))}
        </fieldset>
        <div>
          <label htmlFor="font" className="label">
            Font (any Google font name)
          </label>
          <input id="font" list="fonts" className="field" value={brand.font} onChange={(e) => set('font', e.target.value)} />
          <datalist id="fonts">
            {FONTS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="radius" className="label">
            Card corners: {brand.radius}px
          </label>
          <input
            id="radius"
            type="range"
            min={0}
            max={64}
            value={brand.radius}
            onChange={(e) => set('radius', Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor="handle" className="label">
            Handle on the end card
          </label>
          <input id="handle" className="field" value={brand.handle} onChange={(e) => set('handle', e.target.value)} />
        </div>
        <div className="flex items-center gap-4">
          <button className="btn-primary" onClick={save}>
            Save brand
          </button>
          {note ? (
            <span role="status" className={`text-sm ${note.ok ? 'text-leaf' : 'font-semibold text-sindoor'}`}>
              {note.text}
            </span>
          ) : null}
        </div>
      </div>
      <div className="sticky top-8">
        <Preview props={props} />
      </div>
    </div>
  );
}
