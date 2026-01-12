'use client';

import { AutocompleteInput } from './AutocompleteInput';
import { normalize } from '@/lib/gts/text';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

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
    <Card className="relative z-30 space-y-3">
      <div>
        <div className="text-sm font-semibold">Your guess</div>
        <div className="text-xs opacity-70">Type the song title.</div>
      </div>

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
            <Button onClick={onSubmit} disabled={normalize(guess).length === 0} variant="primary">
              Submit
            </Button>

            <Button onClick={onGiveUp} variant="secondary">
              Give up
            </Button>

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
    </Card>
  );
}
