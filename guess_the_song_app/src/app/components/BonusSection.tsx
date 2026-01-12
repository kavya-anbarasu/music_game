'use client';

import type { HintKey, OptionPools, SongProgress } from '@/lib/gts/types';
import { normalize } from '@/lib/gts/text';
import { AutocompleteInput } from './AutocompleteInput';

export function BonusSection(props: {
  showBonus: boolean;
  bonusKeys: HintKey[];
  progress: SongProgress;
  bonusInput: Partial<Record<HintKey, string>>;
  setBonusInput: (updater: (p: Partial<Record<HintKey, string>>) => Partial<Record<HintKey, string>>) => void;
  optionPools: OptionPools;
  answerAlbum: string;
  answerSingers: string;
  answerKey: string;
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
    answerAlbum,
    answerSingers,
    answerKey,
    onSubmitBonus,
    onPassBonus,
  } = props;

  if (!showBonus || bonusKeys.length === 0) return null;

  return (
    <section className="space-y-3 max-w-xl">
      <div className="font-semibold">Bonus questions (only for hints you didn’t flip)</div>

      {bonusKeys.map((k) => {
        const label = k === 'album' ? 'Album' : k === 'singers' ? 'Singer' : 'Key';
        const prev = progress.bonus?.[k];
        const disabled = !!prev;

        const options = k === 'album' ? optionPools.albums : k === 'key' ? optionPools.keys : optionPools.singers;
        const placeholder = k === 'singers' ? 'Pick a singer…' : `Pick ${label.toLowerCase()}…`;

        return (
          <div key={k} className="rounded border p-3 space-y-2">
            <div className="text-sm font-semibold">
              {k === 'singers' ? 'Bonus: Who is a singer on this track?' : `Bonus: What is the ${label.toLowerCase()}?`}
            </div>

            <AutocompleteInput
              value={bonusInput[k] ?? ''}
              onChange={(v) => setBonusInput((p) => ({ ...p, [k]: v }))}
              options={options}
              placeholder={placeholder}
              disabled={disabled}
            />

            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded border"
                onClick={() => onSubmitBonus(k)}
                disabled={disabled || normalize(bonusInput[k] ?? '').length === 0}
              >
                Submit
              </button>

              <button className="px-3 py-2 rounded border" onClick={() => onPassBonus(k)} disabled={disabled}>
                Pass
              </button>
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
                    <b>{k === 'album' ? answerAlbum : k === 'key' ? answerKey : answerSingers}</b>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
