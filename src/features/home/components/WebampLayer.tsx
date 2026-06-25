import {useRef} from 'react';
import {useWebamp} from '../hooks/useWebamp';

export function useWebampLayer() {
  const layerReference = useRef<HTMLDivElement>(null);
  const {applySkin, openWebamp} = useWebamp(layerReference);

  return {
    layer: (
      <div
        ref={layerReference}
        aria-hidden="true"
        data-webamp-layer
        className="pointer-events-none fixed left-4 top-[calc(50%-4rem)] z-[5] hidden h-[464px] w-[460px] -translate-y-1/2 sm:left-7"
      />
    ),
    applySkin,
    openWebamp,
  };
}
