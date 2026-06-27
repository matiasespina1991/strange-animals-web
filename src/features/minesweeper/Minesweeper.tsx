import {useEffect, useReducer, useState} from 'react';
import {MinesweeperView} from './MinesweeperView';
import {type MinesweeperDifficulty, minesweeperConfig} from './config';

type GameStatus = 'new' | 'started' | 'died' | 'won';
export type CellState =
  | 'cover'
  | 'flag'
  | 'unknown'
  | 'open'
  | 'die'
  | 'mine'
  | 'misflagged';

export type MineCell = {
  state: CellState;
  minesAround: number;
  opening: boolean;
};

type GameState = {
  difficulty: MinesweeperDifficulty;
  status: GameStatus;
  rows: number;
  columns: number;
  mines: number;
  cells: MineCell[];
};

type Action =
  | {type: 'CLEAR_MAP'; payload?: MinesweeperDifficulty}
  | {type: 'START_GAME'; payload: number}
  | {type: 'OPEN_CELL'; payload: number}
  | {type: 'CHANGE_CELL_STATE'; payload: number}
  | {type: 'GAME_OVER'; payload: number}
  | {type: 'WON'}
  | {type: 'OPENING_CELL'; payload: number}
  | {type: 'OPENING_CELLS'; payload: number};

type MinesweeperProperties = {
  defaultDifficulty?: MinesweeperDifficulty;
  embedded?: boolean;
  onClose?: () => void;
};

function getInitialState(
  difficulty: MinesweeperDifficulty = 'Beginner',
): GameState {
  return {
    difficulty,
    status: 'new',
    ...generateGameConfig(minesweeperConfig[difficulty]),
  };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'CLEAR_MAP': {
      return getInitialState(action.payload ?? state.difficulty);
    }

    case 'START_GAME': {
      return {
        ...state,
        ...insertMines(
          {...minesweeperConfig[state.difficulty], exclude: action.payload},
          state.cells,
        ),
        status: 'started',
      };
    }

    case 'OPEN_CELL': {
      const indexes = autoCells(state, action.payload);
      const cells = [...state.cells];

      for (const index of indexes) {
        cells[index] = {...cells[index], state: 'open'};
      }

      return {
        ...state,
        cells,
      };
    }

    case 'CHANGE_CELL_STATE': {
      const index = action.payload;
      const cells = [...state.cells];
      const cell = state.cells[index];
      let newState: CellState;

      switch (cell.state) {
        case 'cover': {
          newState = 'flag';
          break;
        }

        case 'flag': {
          newState = 'unknown';
          break;
        }

        case 'unknown': {
          newState = 'cover';
          break;
        }

        default: {
          return state;
        }
      }

      cells[index] = {...cell, state: newState};

      return {
        ...state,
        cells,
      };
    }

    case 'GAME_OVER': {
      const cells = state.cells.map((cell) => {
        if (cell.minesAround < 0 && cell.state !== 'flag') {
          return {...cell, state: 'mine' as const};
        }

        if (cell.state === 'flag' && cell.minesAround >= 0) {
          return {...cell, state: 'misflagged' as const};
        }

        return {...cell, opening: false};
      });

      cells[action.payload] = {...cells[action.payload], state: 'die'};

      return {
        ...state,
        status: 'died',
        cells,
      };
    }

    case 'WON': {
      const cells = state.cells.map((cell) => ({
        ...cell,
        state: cell.minesAround >= 0 ? ('open' as const) : ('flag' as const),
      }));

      return {
        ...state,
        status: 'won',
        cells,
      };
    }

    case 'OPENING_CELL': {
      const cells = state.cells.map((cell) => ({...cell, opening: false}));

      if (action.payload >= 0 && cells[action.payload]) {
        cells[action.payload] = {...cells[action.payload], opening: true};
      }

      return {
        ...state,
        cells,
      };
    }

    case 'OPENING_CELLS': {
      const indexes = getNearIndexes(action.payload, state.rows, state.columns);
      const cells = state.cells.map((cell) => ({...cell, opening: false}));

      for (const index of [...indexes, action.payload]) {
        cells[index] &&= {...cells[index], opening: true};
      }

      return {
        ...state,
        cells,
      };
    }
  }
}

export function Minesweeper({
  defaultDifficulty = 'Beginner',
  embedded = false,
  onClose,
}: MinesweeperProperties) {
  const [state, dispatch] = useReducer(
    reducer,
    defaultDifficulty,
    getInitialState,
  );
  const seconds = useTimer(state.status);
  const [sameTouchPosition, setSameTouchPosition] = useState(false);
  const [lastTouch, setLastTouch] = useState<Date>(() => new Date());
  const [platform, setPlatform] = useState<'mobile' | 'desktop'>(() =>
    window.innerWidth <= 768 ? 'mobile' : 'desktop',
  );

  useEffect(() => {
    const handleResize = () => {
      setPlatform(window.innerWidth <= 768 ? 'mobile' : 'desktop');
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const handleTouchStart = () => {
      setSameTouchPosition(true);
      setLastTouch(new Date());
    };

    const handleTouchMove = () => {
      setSameTouchPosition(false);
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  useEffect(() => {
    if (state.status === 'started' && checkRemains(state) === 0) {
      dispatch({type: 'WON'});
    }
  }, [state]);

  const changeCellState = (index: number) => {
    const cell = state.cells[index];

    if (
      !cell ||
      cell.state === 'open' ||
      ['won', 'died'].includes(state.status)
    ) {
      return;
    }

    dispatch({type: 'CHANGE_CELL_STATE', payload: index});
  };

  const openCell = (index: number) => {
    if (!state.cells[index]) {
      return;
    }

    switch (state.status) {
      case 'new': {
        dispatch({type: 'START_GAME', payload: index});
        dispatch({type: 'OPEN_CELL', payload: index});
        break;
      }

      case 'started': {
        const cell = state.cells[index];

        if (['flag', 'open'].includes(cell.state)) {
          break;
        }

        if (cell.minesAround < 0) {
          dispatch({type: 'GAME_OVER', payload: index});
        } else {
          dispatch({type: 'OPEN_CELL', payload: index});
        }

        break;
      }

      case 'died':
      case 'won': {
        break;
      }
    }
  };

  const openCells = (index: number) => {
    const cell = state.cells[index];

    if (
      !cell ||
      cell.state !== 'open' ||
      cell.minesAround <= 0 ||
      state.status !== 'started'
    ) {
      return;
    }

    const indexes = getNearIndexes(index, state.rows, state.columns);
    const nearCells = indexes.map((cellIndex) => state.cells[cellIndex]);
    const flags = nearCells.filter((cell) => cell.state === 'flag').length;

    if (flags !== cell.minesAround) {
      return;
    }

    const mineIndex = indexes.find(
      (cellIndex) =>
        state.cells[cellIndex].minesAround < 0 &&
        state.cells[cellIndex].state !== 'flag',
    );

    if (mineIndex !== undefined) {
      dispatch({type: 'GAME_OVER', payload: mineIndex});
      return;
    }

    for (const cellIndex of indexes) {
      dispatch({type: 'OPEN_CELL', payload: cellIndex});
    }
  };

  const reset = (difficulty?: MinesweeperDifficulty) => {
    dispatch({type: 'CLEAR_MAP', payload: difficulty});
  };

  const openingCell = (index: number) => {
    if (['died', 'won'].includes(state.status)) {
      return;
    }

    dispatch({type: 'OPENING_CELL', payload: index});
  };

  const openingCells = (index: number) => {
    if (['died', 'won'].includes(state.status)) {
      return;
    }

    dispatch({type: 'OPENING_CELLS', payload: index});
  };

  const game = (
    <div className="minesweeper-scale">
      <MinesweeperView
        {...state}
        lastTouch={lastTouch}
        platform={platform}
        sameTouchPosition={sameTouchPosition}
        seconds={seconds}
        onChangeCellState={changeCellState}
        onClose={onClose}
        onOpenCell={openCell}
        onOpenCells={openCells}
        onOpeningCell={openingCell}
        onOpeningCells={openingCells}
        onReset={reset}
      />
    </div>
  );

  if (embedded) {
    return <div className="minesweeper-embedded">{game}</div>;
  }

  return <div className="minesweeper-shell">{game}</div>;
}

function generateGameConfig(config: {
  rows: number;
  columns: number;
  mines: number;
}) {
  return {
    rows: config.rows,
    columns: config.columns,
    mines: config.mines,
    cells: Array.from({length: config.rows * config.columns}, () => ({
      state: 'cover' as const,
      minesAround: 0,
      opening: false,
    })),
  };
}

function insertMines(
  config: {
    rows: number;
    columns: number;
    mines: number;
    exclude: number;
  },
  originCells: MineCell[],
) {
  const {rows, columns, mines, exclude} = config;
  const cells = originCells.map((cell) => ({...cell}));

  if (rows * columns !== cells.length) {
    throw new Error('rows and columns do not match cells');
  }

  const indexes = Array.from({length: rows * columns}, (_, index) => index);
  const chosenIndexes = sampleIndexes(
    indexes.filter((index) => index !== exclude),
    mines,
  );

  for (const chosen of chosenIndexes) {
    cells[chosen].minesAround = -10;

    for (const nearIndex of getNearIndexes(chosen, rows, columns)) {
      cells[nearIndex].minesAround += 1;
    }
  }

  return {
    rows,
    columns,
    cells,
    mines,
  };
}

function sampleIndexes(indexes: number[], amount: number) {
  const shuffled = [...indexes];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[nextIndex]] = [
      shuffled[nextIndex],
      shuffled[index],
    ];
  }

  return shuffled.slice(0, amount);
}

function autoCells(state: GameState, index: number) {
  const {rows, columns} = state;
  const cells = state.cells.map((cell) => ({
    ...cell,
    walked: false,
  }));

  const walkCells = (cellIndex: number): number[] => {
    const cell = cells[cellIndex];

    if (!cell || cell.walked || cell.minesAround < 0 || cell.state === 'flag') {
      return [];
    }

    cell.walked = true;

    if (cell.minesAround > 0) {
      return [cellIndex];
    }

    return [
      cellIndex,
      ...getNearIndexes(cellIndex, rows, columns).flatMap((nearIndex) =>
        walkCells(nearIndex),
      ),
    ];
  };

  return walkCells(index);
}

function getNearIndexes(index: number, rows: number, columns: number) {
  if (index < 0 || index >= rows * columns) {
    return [];
  }

  const row = Math.floor(index / columns);
  const column = index % columns;

  return [
    index - columns - 1,
    index - columns,
    index - columns + 1,
    index - 1,
    index + 1,
    index + columns - 1,
    index + columns,
    index + columns + 1,
  ].filter((_, arrayIndex) => {
    if (row === 0 && arrayIndex < 3) {
      return false;
    }

    if (row === rows - 1 && arrayIndex > 4) {
      return false;
    }

    if (column === 0 && [0, 3, 5].includes(arrayIndex)) {
      return false;
    }

    if (column === columns - 1 && [2, 4, 7].includes(arrayIndex)) {
      return false;
    }

    return true;
  });
}

function checkRemains(state: GameState) {
  return state.cells
    .filter((cell) => cell.state !== 'open')
    .filter((cell) => cell.minesAround >= 0).length;
}

function useTimer(status: GameStatus) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (status === 'new') {
      setSeconds(0);
      return;
    }

    if (status !== 'started') {
      return;
    }

    const timer = window.setInterval(() => {
      setSeconds((currentSeconds) => currentSeconds + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [status]);

  return seconds;
}
