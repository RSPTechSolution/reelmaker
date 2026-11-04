import { Reveal } from '../motion.tsx';

const STEPS = [
  { title: 'Script', body: 'The agent writes Hinglish lines with a hook and a mood for each.' },
  { title: 'Voice', body: 'Every line is read aloud at the pace its mood asks for.' },
  { title: 'Captions', body: 'Each caption word is timed to the moment it is spoken.' },
  { title: 'Scenes', body: 'Cards, numbers and faces land on the word that triggers them.' },
  { title: 'Review', body: 'Nine frames at a glance. Ask the agent for fixes.' },
  { title: 'Render', body: 'A 1080×1920 MP4 and a cover image, ready to post.' },
];

function Steps() {
  return (
    <Reveal>
      <ol className="relative grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-3 xl:grid-cols-6">
        <div aria-hidden className="step-connector absolute left-4 right-4 top-4 hidden h-0.5 bg-marigold xl:block" />
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative flex flex-col gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">
              {i + 1}
            </span>
            <span className="font-semibold">{s.title}</span>
            <span className="text-sm text-ink-soft">{s.body}</span>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

/** The six steps every reel goes through. Open and prominent until the first reel exists. */
export function HowItWorks({ collapsed }: { collapsed: boolean }) {
  if (!collapsed) {
    return (
      <section aria-labelledby="how" className="flex flex-col gap-5">
        <h2 id="how" className="text-lg font-bold">
          How a reel gets made
        </h2>
        <Steps />
      </section>
    );
  }
  return (
    <details className="group rounded-lg bg-paper px-5 py-3">
      <summary className="cursor-pointer select-none font-semibold">How a reel gets made (6 steps)</summary>
      <div className="pt-5">
        <Steps />
      </div>
    </details>
  );
}
