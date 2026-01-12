'use client';

import { AutocompleteInput } from './AutocompleteInput';
import { normalize } from '@/lib/gts/text';

export function GuessSection(props: {
  locked: boolean;
  guess: string;
  setGuess: (v: string) => void;
  submitted: string | null;
  isCorrect: boolean | null;
  onSubmit: () => void;
  onGiveUp: () => void;
  answerTitle: string;
  titleOptions: string[];
}) {
  const { locked, guess, setGuess, submitted, isCorrect, onSubmit, onGiveUp, answerTitle, titleOptions } =
    props;

  return (
    <section className="space-y-2 max-w-xl">
      <div className="font-semibold">Your guess</div>

      {!locked ? (
        <>
          <AutocompleteInput
            value={guess}
            onChange={(v) => {
              setGuess(v);
            }}
            options={titleOptions}
            placeholder="Type the song title…"
          />

          <div className="flex items-center gap-3">
            <button
              className="px-4 py-2 rounded border font-medium"
              onClick={onSubmit}
              disabled={normalize(guess).length === 0}
            >
              Submit
            </button>

            <button className="px-4 py-2 rounded border" onClick={onGiveUp}>
              Give up
            </button>

            {submitted !== null && isCorrect === true && <div className="text-sm font-semibold">✅ Correct!</div>}
            {submitted !== null && isCorrect === false && (
              <div className="text-sm">❌ Not quite — revealing more…</div>
            )}
          </div>
        </>
      ) : (
        <div className="text-sm space-y-1">
          <div>
            Answer: <b>{answerTitle}</b>
          </div>
        </div>
      )}
    </section>
  );
}

