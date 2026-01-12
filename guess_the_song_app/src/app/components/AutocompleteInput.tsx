'use client';

import { useMemo, useState } from 'react';
import { normalize } from '@/lib/gts/text';
import { cn } from '@/lib/cn';

export function AutocompleteInput(props: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  minChars?: number;
}) {
  const { value, onChange, options, placeholder, disabled, minChars = 2 } = props;
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = normalize(value);
    if (!q || q.length < minChars) return [];
    return options.filter((opt) => normalize(opt).includes(q)).slice(0, 8);
  }, [value, options, minChars]);

  return (
    <div className="relative">
      <input
        className={cn(
          'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm sm:text-base',
          'placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/40'
        )}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />

      {!disabled && open && suggestions.length > 0 && (
        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-950/95 backdrop-blur">
          {suggestions.map((sug) => (
            <button
              key={sug}
              type="button"
              className="block w-full text-left px-3 py-2 text-sm hover:bg-white/10"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(sug);
                setOpen(false);
              }}
            >
              {sug}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
