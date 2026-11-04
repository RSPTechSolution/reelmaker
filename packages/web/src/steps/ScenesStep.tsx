import { useEffect, useMemo, useState } from 'react';
import { splitWords, type Cue, type Reel } from '@reelmaker/shared';
import { cueStartFrame } from '@reelmaker/video';
import { api, ApiError, type ReelDetail } from '../api.ts';
import { AgentChat } from '../components/AgentChat.tsx';
import { CueEditor, type WordOption } from '../components/CueEditor.tsx';

function nextCueId(cues: Cue[]): string {
  const max = cues.reduce((m, c) => Math.max(m, Number(/^c(\d+)$/.exec(c.id)?.[1] ?? 0)), 0);
  return `c${max + 1}`;
}

/** Plan scenes: the agent proposes cues; each cue is editable; Save writes them to the reel. */
export function ScenesStep({
  detail,
  onChanged,
  seek,
}: {
  detail: ReelDetail;
  onChanged: () => void;
  seek: (frame: number) => void;
}) {
  const { reel, words = [] } = detail;
  const [cues, setCues] = useState<Cue[]>(reel.cues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setCues(reel.cues), [reel.cues]);

  // caption words with their spoken time when captions are synced, else just the words
  const options: WordOption[] = useMemo(
    () =>
      words.length
        ? words.map((w) => ({ i: w.i, caption: w.caption, start: w.start }))
        : reel.lines.flatMap((l) => splitWords(l.caption)).map((caption, i) => ({ i, caption })),
    [words, reel.lines],
  );
  const sorted = [...cues].sort((a, b) => a.atWord - b.atWord);
  const dirty = JSON.stringify(cues) !== JSON.stringify(reel.cues);

  const replace = (id: string, next: Cue) => setCues(cues.map((c) => (c.id === id ? next : c)));
  const add = () => {
    const last = sorted.at(-1)?.atWord ?? 0;
    const atWord = Math.min(options.length - 1, sorted.length ? last + 1 : 0);
    setCues([...cues, { id: nextCueId(cues), atWord: Math.max(0, atWord), block: { type: 'card', title: '' } }]);
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.saveReel({ ...reel, cues } satisfies Reel);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? [e.message, ...(e.issues ?? []).map((i) => i.message)].join(' — ') : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {!reel.lines.length ? <p className="text-ink-soft">Write the script first: scenes are triggered by its words.</p> : null}
      <AgentChat
        reelId={reel.id}
        mode="scenes"
        placeholder={cues.length ? 'e.g. har tip pe card daalo, numbers bade dikhao' : 'Optional: anything the scenes must show'}
        onDone={onChanged}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">
          {cues.length} {cues.length === 1 ? 'cue' : 'cues'}
          {words.length ? '' : ' (sync captions to see word times)'}
        </p>
        <div className="flex items-center gap-3">
          {dirty ? <span className="text-sm text-ink-soft">Unsaved changes</span> : null}
          <button className="btn-quiet" onClick={add} disabled={!options.length}>
            Add cue
          </button>
          <button className="btn-primary" onClick={save} disabled={!dirty || saving}>
            Save scenes
          </button>
        </div>
      </div>
      {error ? <p className="text-sm font-semibold text-sindoor">{error}</p> : null}
      <ol className="flex flex-col gap-2">
        {sorted.map((cue) => (
          <li key={cue.id}>
            <CueEditor
              cue={cue}
              words={options}
              onChange={(next) => replace(cue.id, next)}
              onDelete={() => setCues(cues.filter((c) => c.id !== cue.id))}
              onSeek={(c) => seek(cueStartFrame(c, words) + 8)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
