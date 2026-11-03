import { useEffect, useState } from 'react';
import type { Brand, Expression, MascotConfig } from '@reelmaker/shared';
import { Mascot as MascotView } from '@reelmaker/video';
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
const EXPRESSIONS: Expression[] = ['happy', 'thinking', 'surprised', 'wink', 'excited', 'laughing', 'shocked', 'sad'];

type Note = { ok: boolean; text: string } | null;

function RobotSettings({ mascot, set }: { mascot: MascotConfig; set: (p: Partial<MascotConfig>) => void }) {
  return (
    <>
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
    </>
  );
}

export function Mascot() {
  const [mascot, setMascot] = useState<MascotConfig | null>(null);
  const [brand, setBrand] = useState<Brand>(demoProps.brand);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState<Expression | null>(null);

  useEffect(() => {
    api.getMascot().then(setMascot, (e) => setNote({ ok: false, text: String(e.message ?? e) }));
    api.getBrand().then(setBrand, () => {});
  }, []);
  if (!mascot) return <p className="text-ink-soft">{note?.text ?? 'Loading…'}</p>;

  const kind = mascot.kind ?? 'robot';
  const fail = (e: unknown) => setNote({ ok: false, text: e instanceof ApiError ? e.message : String(e) });
  const set = (patch: Partial<MascotConfig>) => {
    setMascot({ ...mascot, ...patch });
    setNote(null);
  };
  async function save() {
    try {
      setMascot(await api.saveMascot(mascot!));
      setNote({ ok: true, text: 'Mascot saved. New renders use it.' });
    } catch (e) {
      fail(e);
    }
  }
  async function upload(ex: Expression, file: File) {
    setBusy(ex);
    setNote(null);
    try {
      // the upload saves on the server; keep the on-screen kind (it is saved with "Save mascot")
      const saved = await api.uploadCharacter(ex, file);
      setMascot({ ...saved, kind: mascot!.kind });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }
  async function remove(ex: Expression) {
    try {
      const saved = await api.deleteCharacter(ex);
      setMascot({ ...saved, kind: mascot!.kind });
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-10">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <h1 className="text-2xl font-bold">Mascot</h1>
        <fieldset>
          <legend className="label">Who appears in your reels</legend>
          <div className="flex gap-2">
            {(['robot', 'image'] as const).map((k) => (
              <label
                key={k}
                className={`btn cursor-pointer border ${kind === k ? 'border-ink bg-paper' : 'border-ink-faint text-ink-soft'}`}
              >
                <input type="radio" name="kind" className="sr-only" checked={kind === k} onChange={() => set({ kind: k })} />
                {k === 'robot' ? 'Robot' : 'My character'}
              </label>
            ))}
          </div>
        </fieldset>

        {kind === 'robot' ? (
          <RobotSettings mascot={mascot} set={set} />
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              Upload a PNG or WebP of yourself or any character, ideally with a <strong>transparent background</strong>{' '}
              (cut out with any background-remover). Only <strong>Happy</strong> is needed; other expressions use it until
              you add their own picture.
            </p>
            <p className="text-ink-soft">
              While the voice plays the picture bounces with it and tilts for each expression. The mouth does not move.
            </p>
            {!mascot.images?.happy ? (
              <p className="font-semibold text-sindoor">Add a Happy picture first, or reels will keep showing the robot.</p>
            ) : null}
          </div>
        )}

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

      <ul className="grid grid-cols-4 gap-3" aria-label="Expressions">
        {EXPRESSIONS.map((ex) => (
          <li key={ex} className="flex w-40 flex-col items-center gap-2 rounded-lg p-3" style={{ background: brand.bg }}>
            <MascotView config={mascot} expression={ex} open={0} width={130} html />
            <span className="text-sm capitalize text-ink-soft">{ex}</span>
            {kind === 'image' ? (
              <div className="flex flex-col items-center gap-1 text-xs">
                <label className="btn-quiet cursor-pointer px-2 py-1 text-xs">
                  {busy === ex ? 'Uploading…' : mascot.images?.[ex] ? 'Replace picture' : 'Add picture'}
                  <input
                    type="file"
                    accept="image/png,image/webp"
                    className="sr-only"
                    aria-label={`Picture for ${ex}`}
                    disabled={busy !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(ex, f);
                      e.target.value = '';
                    }}
                  />
                </label>
                {mascot.images?.[ex] ? (
                  <button className="text-ink-soft underline" onClick={() => remove(ex)}>
                    Remove
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
