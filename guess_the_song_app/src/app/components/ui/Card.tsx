import { cn } from '@/lib/cn';
import type { PropsWithChildren } from 'react';

export function Card(props: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-white/[0.04] shadow-sm backdrop-blur',
        'p-4 sm:p-5',
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

