import * as React from 'react';
import {cn} from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({className, ...props}, reference) => (
    <input
      ref={reference}
      className={cn(
        'w-full min-w-0 rounded-lg border border-white/20 bg-white/5 px-4 py-3 font-mono text-white outline-none transition-colors focus:border-white/70',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
