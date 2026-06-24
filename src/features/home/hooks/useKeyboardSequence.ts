import {useEffect} from 'react';

type SequenceMap = Record<string, () => void>;

export function useKeyboardSequence(sequences: SequenceMap) {
  useEffect(() => {
    let typedSequence = '';
    const longestSequence = Math.max(
      ...Object.keys(sequences).map((sequence) => sequence.length),
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.length !== 1) {
        return;
      }

      typedSequence = `${typedSequence}${event.key.toLowerCase()}`.slice(
        -longestSequence,
      );

      for (const [sequence, handler] of Object.entries(sequences)) {
        if (typedSequence.endsWith(sequence)) {
          handler();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sequences]);
}
