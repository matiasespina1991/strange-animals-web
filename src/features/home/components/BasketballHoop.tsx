import {useMediaAssets} from '@/media/react/MediaProvider';
import {useTadeGameStore} from '@/store/tade-game-store';

type BasketballHoopProperties = {
  hoopReference: React.RefObject<HTMLImageElement>;
};

export function BasketballHoop({hoopReference}: BasketballHoopProperties) {
  const assets = useMediaAssets();
  const active = useTadeGameStore((state) => state.active);

  return (
    <img
      ref={hoopReference}
      alt=""
      aria-hidden="true"
      className={[
        'pointer-events-none fixed left-14 top-1/2 z-20 h-auto w-[17rem] -translate-x-[14%] -translate-y-1/2 select-none transition-opacity duration-[1600ms] ease-out',
        active ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
      src={assets.images.basketballHoop}
    />
  );
}
