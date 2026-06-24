import {useRef} from 'react';
import {useTadeGameAudio} from '../hooks/useTadeGameAudio';
import {useTadeGameLoop} from '../hooks/useTadeGameLoop';
import {BasketballHoop} from './BasketballHoop';
import {GameHud} from './GameHud';
import {ScorePopLayer, useScorePops} from './ScorePopLayer';
import {SoundToggle} from './SoundToggle';
import {TadeVideoBackground} from './TadeVideoBackground';

export function TadeGame() {
  const canvasReference = useRef<HTMLCanvasElement>(null);
  const hoopReference = useRef<HTMLImageElement>(null);
  const {addPop, pops, removePop} = useScorePops();
  useTadeGameAudio();
  useTadeGameLoop({canvasReference, hoopReference, onScorePop: addPop});

  return (
    <>
      <TadeVideoBackground />
      <canvas
        ref={canvasReference}
        className="pointer-events-none fixed inset-0 z-10 size-full"
      />
      <BasketballHoop hoopReference={hoopReference} />
      <GameHud />
      <SoundToggle />
      <ScorePopLayer pops={pops} onDone={removePop} />
    </>
  );
}
