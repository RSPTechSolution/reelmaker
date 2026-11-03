import { useEffect, useState } from 'react';
import type { Brand, Expression, MascotConfig } from '@reelmaker/shared';
import { Mascot as MascotSvg } from '@reelmaker/video';
import { api, ApiError } from '../api.ts';
import { demoProps } from '../demo.ts';

const COLORS: { key: 'body' | 'face' | 'accent'; label: string }[] = [
  { key: 'body', label: 'Body' },
  { key: 'face', label: 'Eyes and mouth' },
  { key: 'accent', label: 'Details (antenna tip, glasses, cap)' },
];
const SIGNATURES: { value: MascotConfig['signature']; label: string }[] = [
  { value: 'antenna', label: 'Antenna' },
  { value: 'glasses', label: 'Glasses' },
  { value: 'cap', label: 'Cap' },
];
const EXPRESSIONS: Expression[] = ['happy', 'thinking', 'surprised', 'wink'];

export function Mascot() {
  const [mascot, setMascot] = useState<MascotConfig | null>(null);
  const [brand, setBrand] = useState<Brand>(demoProps.brand);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.getMascot().then(setMascot, (e) => setNote({ ok: false, text: String(e.message ?? e) }));
    api.getBrand().then(setBrand, () => {});
  }, []);
  if (!mascot) return <p className="text-ink-soft">{note?.text ?? 'Loading…'}</p>;

  const set = (patch: Partial<MascotConfig>) => {
    setMascot({ ...mascot, ...patch });
    setNote(null);
  };
  async function save() {
    try {
      setMascot(await api.saveMascot(mascot!));
      setNote({ ok: true, text: 'Mascot saved. New renders use it.' });
    } catch (e) {
      setNote({ ok: false, text: e instanceof ApiError ? e.message : String(e) });
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-10">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <h1 className="text-2xl font-bold">Mascot</h1>
        <fieldset className="flex flex-col gap-3">
          <legend className="label">Colours</legend>
          {COLORS.map((c) => (
            <label key={c.key} className="flex items-center gap-3 text-sm">
              <input
                type="color"
                value={mascot[c.key]}
                onChange={(e) => set({ [c.key]: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border border-ink-faint bg-paper"
              />
              {c.label}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend className="label">Signature look</legend>
          <div className="flex gap-2">
            {SIGNATURES.map((s) => (
              <label
                key={s.value}
                className={`btn cursor-pointer border ${mascot.signature === s.value ? 'border-ink bg-paper' : 'border-ink-faint text-ink-soft'}`}
              >
                <input
                  type="radio"
                  name="signature"
                  className="sr-only"
                  checked={mascot.signature === s.value}
                  onChange={() => set({ signature: s.value })}
                />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-4">
          <button className="btn-primary" onClick={save}>
            Save mascot
          </button>
          {note ? (
            <span role="status" className={`text-sm ${note.ok ? 'text-leaf' : 'font-semibold text-sindoor'}`}>
              {note.text}
            </span>
          ) : null}
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-4" aria-label="Expressions">
        {EXPRESSIONS.map((ex) => (
          <li key={ex} className="flex flex-col items-center rounded-lg p-4" style={{ background: brand.bg }}>
            <MascotSvg config={mascot} expression={ex} open={0} width={180} />
            <span className="mt-2 text-sm capitalize text-ink-soft">{ex}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
