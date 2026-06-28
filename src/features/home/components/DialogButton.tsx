import {type ComponentPropsWithoutRef} from 'react';
import {cn} from '@/lib/utils';

type DialogButtonProperties = ComponentPropsWithoutRef<'button'>;

export function DialogButton({
  children,
  className,
  type = 'button',
  ...properties
}: DialogButtonProperties) {
  return (
    <button
      className={cn(
        'flex min-h-6 min-w-20 items-center justify-center border border-[#d1d1d1cc] bg-black px-3 py-0.5 text-[0.75rem] uppercase leading-none tracking-[0.11em] text-white/90',
        'shadow-[1px_1px_0_0_rgba(255,255,255,0.62)] transition-[transform,box-shadow,background-color] duration-100 ease-out',
        'hover:translate-x-px hover:translate-y-px hover:shadow-[0_0_0_0_rgba(255,255,255,0)]',
        'active:translate-x-px active:translate-y-px active:shadow-[0_0_0_0_rgba(255,255,255,0)]',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white',
        className,
      )}
      type={type}
      {...properties}
    >
      {children}
    </button>
  );
}
