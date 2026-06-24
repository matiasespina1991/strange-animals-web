import * as React from 'react';
import {cn} from '@/lib/utils';

export function Card({className, ...props}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-black/35 backdrop-blur-xl',
        className,
      )}
      {...props}
    />
  );
}
