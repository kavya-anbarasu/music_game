'use client';

import { cn } from '@/lib/cn';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: 'sm' | 'md';
  }
) {
  const { className, variant = 'secondary', size = 'md', ...rest } = props;

  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-colors ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  const sizes = size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-2 text-sm sm:text-base';

  const variants =
    variant === 'primary'
      ? 'border-indigo-400/30 bg-indigo-500/20 hover:bg-indigo-500/30'
      : variant === 'ghost'
      ? 'border-transparent bg-transparent hover:bg-white/5'
      : 'border-white/10 bg-white/5 hover:bg-white/10';

  return <button className={cn(base, sizes, variants, className)} {...rest} />;
}

