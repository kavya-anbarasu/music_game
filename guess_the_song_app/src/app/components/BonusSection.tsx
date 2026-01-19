'use client';

import type { HintKey, OptionPools, SongProgress } from '@/lib/gts/types';
import { normalize } from '@/lib/gts/text';
import { AutocompleteInput } from './AutocompleteInput';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

export function BonusSection(props: {
  showBonus: boolean;
  bonusKeys: HintKey[];
  progress: SongProgress;
  bonusInput: Partial<Record<HintKey, string>>;
  setBonusInput: (updater: (p: Partial<Record<HintKey, string>>) => Partial<Record<HintKey, string>>) => void;
  optionPools: OptionPools;
  labels: Record<HintKey, string>;
  values: Record<HintKey, string>;
  onSubmitBonus: (k: HintKey) => void;
  onPassBonus: (k: HintKey) => void;
}) {
  const {
    showBonus,
    bonusKeys,
    progress,
    bonusInput,
    setBonusInput,
    optionPools,
    labels,
    values,
    onSubmitBonus,
    onPassBonus,
  } = props;

  if (!showBonus || bonusKeys.length === 0) return null;

  return (
    <Card className="relative z-30 space-y-3">
      <div>
        <div className="text-sm font-semibold">Bonus</div>
        <div className="text-xs opacity-70">Extra points for hints you didn’t flip.</div>
      </div>

      {bonusKeys.map((k) => {
        const label = labels[k];
        const prev = progress.bonus?.[k];
        const disabled = !!prev;

        const options =
          k === 'album'
            ? optionPools.albums
            : k === 'movie'
            ? optionPools.movies
            : k === 'music_director'
            ? optionPools.musicDirectors
            : k === 'hero'
            ? optionPools.heroes
            : k === 'heroine'
            ? optionPools.heroines
            : k === 'key'
            ? optionPools.keys
            : optionPools.singers;

        const placeholder = k === 'singers' ? `Pick ${label.toLowerCase()}…` : `Pick ${label.toLowerCase()}…`;

        return (
          <div key={k} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
            <div className="text-sm font-semibold">
              {k === 'singers'
                ? `Bonus: Name one ${label.toLowerCase()} on this track.`
                : `Bonus: What is the ${label.toLowerCase()}?`}
            </div>

            <AutocompleteInput
              value={bonusInput[k] ?? ''}
              onChange={(v) => setBonusInput((p) => ({ ...p, [k]: v }))}
              options={options}
              placeholder={placeholder}
              disabled={disabled}
              minChars={k === 'key' ? 1 : 2}
            />

            <div className="flex gap-2">
              <Button
                onClick={() => onSubmitBonus(k)}
                disabled={disabled || normalize(bonusInput[k] ?? '').length === 0}
                variant="primary"
                size="sm"
              >
                Submit
              </Button>

              <Button onClick={() => onPassBonus(k)} disabled={disabled} size="sm">
                Pass
              </Button>
            </div>

            {prev && (
              <div className="text-sm space-y-1">
                {prev.passed ? (
                  <div className="opacity-80">⏭️ Passed.</div>
                ) : (
                  <div>
                    {prev.correct ? '✅ Correct' : '❌ Not quite'} — you answered:{' '}
                    <span className="font-mono">{prev.answer}</span>
                  </div>
                )}

                {(prev.passed || !prev.correct) && (
                  <div className="opacity-90">
                    Correct answer:{' '}
                    <b>{values[k]}</b>
                  </div>
                )}

                {prev.correct && k === 'singers' && (
                  <div className="opacity-90">
                    All singers:{' '}
                    <b>{values[k]}</b>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}
