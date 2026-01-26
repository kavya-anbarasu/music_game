'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalize } from '@/lib/gts/text';
import { cn } from '@/lib/cn';

type AnchorRect = { left: number; top: number; width: number };

export function AutocompleteInput(props: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  minChars?: number;
}) {
  const { value, onChange, options, placeholder, disabled, minChars = 1 } = props;
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const suggestions = useMemo(() => {
    const q = normalize(value);
    if (!q || q.length < minChars) return [];
    return options.filter((opt) => normalize(opt).includes(q));
  }, [value, options, minChars]);

  useEffect(() => {
    if (!open) return;

    function update() {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setAnchor({ left: rect.left, top: rect.bottom + 8, width: rect.width });
    }

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (inputRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (suggestions.length === 0) setAnchor(null);
  }, [open, suggestions.length]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
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
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />

      {!disabled &&
        open &&
        suggestions.length > 0 &&
        anchor &&
        createPortal(
          <>
            <div
              ref={dropdownRef}
              className="fixed z-[70] max-h-72 overflow-auto rounded-xl border border-white/10 bg-zinc-950/95 backdrop-blur"
              style={{ left: anchor.left, top: anchor.top, width: anchor.width }}
            >
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
          </>,
          document.body
        )}
    </div>
  );
}
