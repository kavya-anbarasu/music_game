'use client';

import { cn } from '@/lib/cn';
import type { InputHTMLAttributes } from 'react';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm sm:text-base',
        'placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
        className
      )}
      {...rest}
    />
  );
}

