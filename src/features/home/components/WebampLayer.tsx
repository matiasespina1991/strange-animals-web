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
        className="pointer-events-none fixed left-[18vw] top-1/2 z-[5] hidden h-[760px] w-[460px] -translate-y-1/2"
      />
    ),
    applySkin,
    openWebamp,
  };
}
