import {useCallback, useState} from 'react';

export type ScorePop = {
  id: number;
  points: number;
  x: number;
  y: number;
};

type ScorePopLayerProperties = {
  pops: ScorePop[];
  onDone: (id: number) => void;
};

export function useScorePops() {
  const [pops, setPops] = useState<ScorePop[]>([]);

  const addPop = useCallback(
    (points: number, position: {x: number; y: number}) => {
      setPops((current) => [
        ...current,
        {
          id: Date.now() + Math.random(),
          points,
          x: position.x,
          y: position.y,
        },
      ]);
    },
    [],
  );

  const removePop = useCallback((id: number) => {
    setPops((current) => current.filter((pop) => pop.id !== id));
  }, []);

  return {addPop, pops, removePop};
}

export function ScorePopLayer({onDone, pops}: ScorePopLayerProperties) {
  return (
    <>
      {pops.map((pop) => (
        <div
          key={pop.id}
          className="pointer-events-none fixed z-50 animate-[score-pop_900ms_ease-out_forwards] font-mono text-[1.3rem] font-normal leading-none text-[#ffd800]"
          style={{left: pop.x, top: pop.y, transform: 'translate(-50%, -50%)'}}
          onAnimationEnd={() => {
            onDone(pop.id);
          }}
        >
          +{pop.points}
        </div>
      ))}
    </>
  );
}
