import * as React from 'react';
import {cn} from '@/lib/utils';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({className, type = 'button', ...props}, reference) => (
    <button
      ref={reference}
      type={type}
      className={cn(
        'inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-5 font-bold text-black transition-opacity disabled:cursor-progress disabled:opacity-60',
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
