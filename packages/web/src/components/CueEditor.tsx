import type { Anim, Block, BlockType, Cue, Expression } from '@reelmaker/shared';

export type WordOption = { i: number; caption: string; start?: number };

const TYPES: { value: BlockType; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'card', label: 'Card' },
  { value: 'bigNumber', label: 'Big number' },
  { value: 'list', label: 'List' },
  { value: 'sticker', label: 'Sticker (overlay)' },
  { value: 'expression', label: 'Mascot face' },
];
const ANIMS: { value: Anim; label: string }[] = [
  { value: 'pop', label: 'Pop' },
  { value: 'slide', label: 'Slide in' },
  { value: 'zoom', label: 'Zoom in' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'typewriter', label: 'Typewriter' },
];
const FACES: Expression[] = ['happy', 'thinking', 'surprised', 'wink', 'excited', 'laughing', 'shocked', 'sad'];
const MAX_ITEMS = 5;

/** A valid empty block of each type (used when the type changes). */
export function defaultBlock(type: BlockType): Block {
  switch (type) {
    case 'title':
      return { type, text: '' };
    case 'card':
      return { type, title: '' };
    case 'bigNumber':
      return { type, to: 0 };
    case 'sticker':
      return { type, text: '' };
    case 'list':
      return { type, items: [''] };
    case 'expression':
      return { type, expression: 'happy' };
  }
}

const wordLabel = (w: WordOption) => (w.start !== undefined ? `${w.caption} (${w.start.toFixed(1)} s)` : w.caption);

/** Optional string field: empty input removes the key (schema fields are optional, not ""). */
function withOptional<B extends Block, K extends keyof B>(block: B, key: K, value: string): B {
  const next = { ...block };
  if (value) (next as Record<string, unknown>)[key as string] = value;
  else delete (next as Record<string, unknown>)[key as string];
  return next;
}

function Field({ label, value, onChange, wide }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-ink-soft ${wide ? 'min-w-56 flex-1' : 'w-28'}`}>
      {label}
      <input className="field py-1.5 text-sm" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function BlockFields({ block, set }: { block: Block; set: (b: Block) => void }) {
  switch (block.type) {
    case 'title':
      return <Field wide label="Title text" value={block.text} onChange={(text) => set({ ...block, text })} />;
    case 'sticker':
      return <Field wide label="Sticker text" value={block.text} onChange={(text) => set({ ...block, text })} />;
    case 'card':
      return (
        <>
          <Field wide label="Card title" value={block.title} onChange={(title) => set({ ...block, title })} />
          <Field wide label="Card text" value={block.body ?? ''} onChange={(v) => set(withOptional(block, 'body', v))} />
          <Field label="Icon (emoji)" value={block.icon ?? ''} onChange={(v) => set(withOptional(block, 'icon', v))} />
        </>
      );
    case 'bigNumber':
      return (
        <>
          <Field label="Before" value={block.prefix ?? ''} onChange={(v) => set(withOptional(block, 'prefix', v))} />
          <label className="flex w-28 flex-col gap-1 text-xs text-ink-soft">
            Number
            <input
              type="number"
              className="field py-1.5 text-sm"
              aria-label="Number"
              value={block.to}
              onChange={(e) => set({ ...block, to: Number(e.target.value) || 0 })}
            />
          </label>
          <Field label="After" value={block.suffix ?? ''} onChange={(v) => set(withOptional(block, 'suffix', v))} />
        </>
      );
    case 'list':
      return (
        <div className="flex min-w-56 flex-1 flex-col gap-1">
          {block.items.map((item, k) => (
            <div key={k} className="flex gap-1">
              <input
                className="field py-1.5 text-sm"
                aria-label={`Item ${k + 1}`}
                value={item}
                onChange={(e) => set({ ...block, items: block.items.map((x, j) => (j === k ? e.target.value : x)) })}
              />
              <button
                className="btn-quiet px-2 py-1 text-xs"
                aria-label={`Remove item ${k + 1}`}
                disabled={block.items.length === 1}
                onClick={() => set({ ...block, items: block.items.filter((_, j) => j !== k) })}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="btn-quiet self-start px-2 py-1 text-xs"
            disabled={block.items.length >= MAX_ITEMS}
            onClick={() => set({ ...block, items: [...block.items, ''] })}
          >
            Add item
          </button>
        </div>
      );
    case 'expression':
      return (
        <label className="flex w-40 flex-col gap-1 text-xs text-ink-soft">
          Face
          <select
            className="field py-1.5 text-sm capitalize"
            aria-label="Face"
            value={block.expression}
            onChange={(e) => set({ ...block, expression: e.target.value as Expression })}
          >
            {FACES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
      );
  }
}

/** One cue: trigger word, optional end word, block type and its fields. */
export function CueEditor({
  cue,
  words,
  onChange,
  onDelete,
  onSeek,
}: {
  cue: Cue;
  words: WordOption[];
  onChange: (cue: Cue) => void;
  onDelete: () => void;
  onSeek: (cue: Cue) => void;
}) {
  const setAnim = (v: string) => {
    const { anim: _old, ...rest } = cue;
    onChange(v === '' ? rest : { ...rest, anim: v as Anim });
  };
  const setUntil = (v: string) => {
    const { untilWord: _old, ...rest } = cue;
    onChange(v === '' ? rest : { ...rest, untilWord: Number(v) });
  };
  return (
    <div className="flex flex-col gap-3 rounded-md bg-paper p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex w-44 flex-col gap-1 text-xs text-ink-soft">
          Starts at word
          <select
            className="field py-1.5 text-sm"
            aria-label="Starts at word"
            value={cue.atWord}
            onChange={(e) => onChange({ ...cue, atWord: Number(e.target.value) })}
          >
            {words.map((w) => (
              <option key={w.i} value={w.i}>
                {wordLabel(w)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-44 flex-col gap-1 text-xs text-ink-soft">
          Block type
          <select
            className="field py-1.5 text-sm"
            aria-label="Block type"
            value={cue.block.type}
            onChange={(e) => onChange({ ...cue, block: defaultBlock(e.target.value as BlockType) })}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {cue.block.type !== 'expression' ? (
          <label className="flex w-44 flex-col gap-1 text-xs text-ink-soft">
            Ends after word
            <select
              className="field py-1.5 text-sm"
              aria-label="Ends after word"
              value={cue.untilWord ?? ''}
              onChange={(e) => setUntil(e.target.value)}
            >
              <option value="">until replaced</option>
              {words
                .filter((w) => w.i >= cue.atWord)
                .map((w) => (
                  <option key={w.i} value={w.i}>
                    {wordLabel(w)}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        {cue.block.type !== 'expression' ? (
          <label className="flex w-36 flex-col gap-1 text-xs text-ink-soft">
            Entrance
            <select className="field py-1.5 text-sm" aria-label="Entrance" value={cue.anim ?? ''} onChange={(e) => setAnim(e.target.value)}>
              <option value="">Pop (default)</option>
              {ANIMS.filter((a) => a.value !== 'pop').map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="ml-auto flex gap-1">
          <button className="btn-quiet px-2 py-1 text-sm" onClick={() => onSeek(cue)}>
            Show in preview
          </button>
          <button className="btn-quiet px-2 py-1 text-sm" aria-label="Delete cue" onClick={onDelete}>
            ✕
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <BlockFields block={cue.block} set={(block) => onChange({ ...cue, block })} />
      </div>
    </div>
  );
}
