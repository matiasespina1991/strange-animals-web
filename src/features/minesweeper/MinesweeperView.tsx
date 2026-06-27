import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import type {MineCell} from './Minesweeper';
import type {MinesweeperDifficulty} from './config';
import checked from './assets/checked.png';
import dead from './assets/dead.png';
import digit0 from './assets/digit0.png';
import digit1 from './assets/digit1.png';
import digit2 from './assets/digit2.png';
import digit3 from './assets/digit3.png';
import digit4 from './assets/digit4.png';
import digit5 from './assets/digit5.png';
import digit6 from './assets/digit6.png';
import digit7 from './assets/digit7.png';
import digit8 from './assets/digit8.png';
import digit9 from './assets/digit9.png';
import digitMinus from './assets/digit-.png';
import empty from './assets/empty.png';
import flag from './assets/flag.png';
import mine from './assets/mine-ceil.png';
import mineDeath from './assets/mine-death.png';
import misFlagged from './assets/misflagged.png';
import ohh from './assets/ohh.png';
import open1 from './assets/open1.png';
import open2 from './assets/open2.png';
import open3 from './assets/open3.png';
import open4 from './assets/open4.png';
import open5 from './assets/open5.png';
import open6 from './assets/open6.png';
import open7 from './assets/open7.png';
import open8 from './assets/open8.png';
import question from './assets/question.png';
import smile from './assets/smile.png';
import win from './assets/win.png';
import './minesweeper.css';

const digits = [
  digit0,
  digit1,
  digit2,
  digit3,
  digit4,
  digit5,
  digit6,
  digit7,
  digit8,
  digit9,
];

type MinesweeperViewProperties = {
  cells: MineCell[];
  columns: number;
  difficulty: MinesweeperDifficulty;
  lastTouch: Date;
  mines: number;
  platform: 'mobile' | 'desktop';
  rows: number;
  sameTouchPosition: boolean;
  seconds: number;
  status: 'new' | 'started' | 'died' | 'won';
  onChangeCellState: (index: number) => void;
  onClose?: () => void;
  onOpenCell: (index: number) => void;
  onOpenCells: (index: number) => void;
  onOpeningCell: (index: number) => void;
  onOpeningCells: (index: number) => void;
  onReset: (difficulty?: MinesweeperDifficulty) => void;
};

type OpenBehavior = {
  index: number;
  behavior: 'single' | 'multi' | '';
};

export function MinesweeperView({
  cells,
  columns,
  difficulty,
  lastTouch,
  mines,
  platform,
  rows,
  sameTouchPosition,
  seconds,
  status,
  onChangeCellState,
  onClose,
  onOpenCell,
  onOpenCells,
  onOpeningCell,
  onOpeningCells,
  onReset,
}: MinesweeperViewProperties) {
  const face = useRef<HTMLButtonElement>(null);
  const dropDown = useRef<HTMLDivElement>(null);
  const topBar = useRef<HTMLDivElement>(null);
  const [mouseDownContent, setMouseDownContent] = useState(false);
  const [openOption, setOpenOption] = useState<'Game' | 'Help' | ''>('');
  const [openBehavior, setOpenBehavior] = useState<OpenBehavior>({
    index: -1,
    behavior: '',
  });
  const boardStyle: CSSProperties &
    Record<'--mine-rows' | '--mine-columns', number> = {
    '--mine-rows': rows,
    '--mine-columns': columns,
  };

  const remainMines = () =>
    mines -
    cells.filter((cell) => cell.state === 'flag' || cell.state === 'misflagged')
      .length;

  const statusFace = () => {
    if (mouseDownContent) {
      return <img alt="ohh" src={ohh} />;
    }

    switch (status) {
      case 'died': {
        return <img alt="dead" src={dead} />;
      }

      case 'won': {
        return <img alt="win" src={win} />;
      }

      default: {
        return <img alt="smile" src={smile} />;
      }
    }
  };

  const handleMouseDownContent = (event: MouseEvent<HTMLElement>) => {
    if (
      event.button !== 0 ||
      face.current?.contains(event.target as Node) ||
      status === 'won' ||
      status === 'died'
    ) {
      return;
    }

    setMouseDownContent(true);
  };

  const handleMouseDownCells = (
    event: MouseEvent<HTMLDivElement>,
    index: number,
  ) => {
    if (event.button === 2 && event.buttons === 2 && index !== -1) {
      onChangeCellState(index);
      return;
    }

    if (event.button === 0 && event.buttons === 1) {
      setOpenBehavior({index, behavior: 'single'});
      return;
    }

    if (event.buttons === 3) {
      setOpenBehavior({index, behavior: 'multi'});
    }
  };

  const handleMouseOverCells = (index: number) => {
    setOpenBehavior({
      index,
      behavior: openBehavior.behavior,
    });
  };

  const handleMouseUpCells = () => {
    const {behavior, index} = openBehavior;

    if (index === -1) {
      return;
    }

    if (behavior === 'single') {
      onOpenCell(index);
      return;
    }

    if (behavior === 'multi') {
      onOpenCells(index);
    }
  };

  const hoverOption = (option: 'Game' | 'Help') => {
    if (openOption) {
      setOpenOption(option);
    }
  };

  const handleTouchEndCells = (event: React.TouchEvent<HTMLDivElement>) => {
    const cellElement = (event.target as HTMLElement).closest('.mine__cell');
    const index = Array.from(event.currentTarget.children).indexOf(
      cellElement as Element,
    );

    if (index === -1 || !sameTouchPosition) {
      return;
    }

    if (Date.now() - lastTouch.getTime() < 150) {
      if (cells[index].state === 'open') {
        onOpenCells(index);
      } else {
        onOpenCell(index);
      }

      return;
    }

    onChangeCellState(index);
  };

  useEffect(() => {
    const {behavior, index} = openBehavior;

    switch (behavior) {
      case 'single': {
        onOpeningCell(index);
        break;
      }

      case 'multi': {
        onOpeningCells(index);
        break;
      }

      default: {
        onOpeningCell(-1);
      }
    }
  }, [openBehavior, onOpeningCell, onOpeningCells]);

  useEffect(() => {
    const handleMouseUp = (event: globalThis.MouseEvent) => {
      setOpenBehavior({index: -1, behavior: ''});
      setMouseDownContent(false);

      if (!dropDown.current?.contains(event.target as Node)) {
        setOpenOption('');
      }
    };

    const handleTouchEndDropdown = (event: TouchEvent) => {
      if (
        !dropDown.current?.contains(event.target as Node) &&
        !topBar.current?.contains(event.target as Node)
      ) {
        setOpenOption('');
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleTouchEndDropdown);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleTouchEndDropdown);
    };
  }, []);

  return (
    <div
      className={`mine mine--${platform}`}
      style={boardStyle}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      <div className="mine__drop-downs" ref={dropDown}>
        <GameMenu
          difficulty={difficulty}
          open={openOption === 'Game'}
          onClose={onClose}
          onReset={onReset}
        />
        <HelpMenu open={openOption === 'Help'} />
      </div>

      <div className="mine__top-bar" ref={topBar}>
        <button
          className="mine__top-bar__text"
          type="button"
          onMouseDown={() => {
            setOpenOption('Game');
          }}
          onMouseOver={() => {
            hoverOption('Game');
          }}
          onTouchStart={() => {
            setOpenOption(openOption ? '' : 'Game');
          }}
        >
          Game
        </button>
        <button
          className="mine__top-bar__text"
          type="button"
          onMouseDown={() => {
            setOpenOption('Help');
          }}
          onMouseOver={() => {
            hoverOption('Help');
          }}
          onTouchStart={() => {
            setOpenOption(openOption ? '' : 'Help');
          }}
        >
          Help
        </button>
      </div>

      <section className="mine__content" onMouseDown={handleMouseDownContent}>
        <div className="mine__score-bar">
          <div className="mine__digits__outer">
            {renderDigits(remainMines())}
          </div>
          <div className="mine__face__outer">
            <button
              ref={face}
              className="mine__face"
              type="button"
              onClick={() => {
                onReset();
              }}
            >
              {statusFace()}
              <img alt="smile" src={smile} />
            </button>
          </div>
          <div className="mine__digits__outer">{renderDigits(seconds)}</div>
        </div>

        <div
          className="mine__content__inner"
          onMouseUp={handleMouseUpCells}
          onTouchEnd={handleTouchEndCells}
        >
          <Cells
            cells={cells}
            onMouseDown={handleMouseDownCells}
            onMouseEnter={handleMouseOverCells}
          />
        </div>
      </section>
    </div>
  );
}

function GameMenu({
  difficulty,
  open,
  onClose,
  onReset,
}: {
  difficulty: MinesweeperDifficulty;
  open: boolean;
  onClose?: () => void;
  onReset: (difficulty?: MinesweeperDifficulty) => void;
}) {
  return (
    <div
      className="mine__drop-down"
      style={{visibility: open ? 'visible' : 'hidden'}}
    >
      <div className="mine__drop-down__title">Game</div>
      <div className="mine__drop-down__menu">
        <MenuRow
          hotKey="F2"
          label="New"
          onSelect={() => {
            onReset();
          }}
        />
        <MenuSeparator />
        {(['Beginner', 'Intermediate', 'Expert'] as const).map((option) => (
          <MenuRow
            key={option}
            checked={difficulty === option}
            label={option}
            onSelect={() => {
              onReset(option);
            }}
          />
        ))}
        <MenuRow label="Custom..." />
        <MenuSeparator />
        <MenuRow checked label="Marks (?)" />
        <MenuRow checked label="Color" />
        <MenuRow label="Sound" />
        <MenuSeparator />
        <MenuRow label="Best Times..." />
        <MenuSeparator />
        <MenuRow label="Exit" onSelect={onClose} />
      </div>
    </div>
  );
}

function HelpMenu({open}: {open: boolean}) {
  return (
    <div
      className="mine__drop-down"
      style={{visibility: open ? 'visible' : 'hidden'}}
    >
      <div className="mine__drop-down__title">Help</div>
      <div className="mine__drop-down__menu">
        <MenuRow hotKey="F1" label="Contents" />
        <MenuRow label="Search for Help on..." />
        <MenuRow label="Using Help" />
        <MenuSeparator />
        <MenuRow label="About Minesweeper..." />
        <a
          className="mine__drop-down__link"
          href="https://github.com/ShizukuIchi/minesweeper"
          rel="noreferrer"
          target="_blank"
        >
          <span />
          <span>Github</span>
          <span />
          <span />
        </a>
      </div>
    </div>
  );
}

function MenuRow({
  checked: checkedState = false,
  hotKey = '',
  label,
  onSelect,
}: {
  checked?: boolean;
  hotKey?: string;
  label: string;
  onSelect?: () => void;
}) {
  return (
    <button
      className="mine__drop-down__row"
      type="button"
      onMouseUp={onSelect}
      onTouchStart={onSelect}
    >
      <span className="mine__drop-down__check">
        {checkedState && <img alt="checked" src={checked} />}
      </span>
      <span className="mine__drop-down__text">{label}</span>
      <span className="mine__drop-down__hot-key">{hotKey}</span>
      <span className="mine__drop-down__arrow" />
    </button>
  );
}

function MenuSeparator() {
  return <div className="mine__drop-down__separator" />;
}

function renderDigits(number: number) {
  let numberText: string;

  if (number < 0) {
    const positiveNumber = -number % 100;
    numberText =
      positiveNumber === 0
        ? '00'
        : positiveNumber < 10
          ? `0${positiveNumber}`
          : String(positiveNumber);

    return (
      <>
        <img alt="-" src={digitMinus} />
        {numberText.split('').map((digit, index) => (
          <img
            key={`${digit}-${index}`}
            alt={digit}
            src={digits[Number(digit)]}
          />
        ))}
      </>
    );
  }

  numberText = number < 999 ? String(number) : '999';

  if (number < 10) {
    numberText = `00${numberText}`;
  } else if (number < 100) {
    numberText = `0${numberText}`;
  }

  return numberText
    .split('')
    .map((digit, index) => (
      <img key={`${digit}-${index}`} alt={digit} src={digits[Number(digit)]} />
    ));
}

function Cells({
  cells,
  onMouseDown,
  onMouseEnter,
}: {
  cells: MineCell[];
  onMouseDown: (event: MouseEvent<HTMLDivElement>, index: number) => void;
  onMouseEnter: (index: number) => void;
}) {
  return cells.map((cell, index) => (
    <div
      key={index}
      className="mine__cell"
      onMouseDown={(event) => {
        onMouseDown(event, index);
      }}
      onMouseEnter={() => {
        onMouseEnter(index);
      }}
    >
      {renderCellContent(cell)}
    </div>
  ));
}

function renderCellContent(cell: MineCell) {
  const {state, minesAround, opening} = cell;

  switch (state) {
    case 'open': {
      return <MinesAround mines={minesAround} />;
    }

    case 'flag': {
      return <Flag />;
    }

    case 'misflagged': {
      return <MisFlagged />;
    }

    case 'mine': {
      return <Mine />;
    }

    case 'die': {
      return <Die />;
    }

    case 'unknown': {
      return opening ? <QuestionOpen /> : <Question />;
    }

    default: {
      return opening ? <CellBackgroundOpen /> : <CellBackgroundCover />;
    }
  }
}

function getTextImage(index: number) {
  return [empty, open1, open2, open3, open4, open5, open6, open7, open8][index];
}

function Die() {
  return (
    <>
      <CellBackgroundOpen />
      <img alt="death" src={mineDeath} />
    </>
  );
}

function MisFlagged() {
  return (
    <>
      <CellBackgroundOpen />
      <img alt="misFlagged" src={misFlagged} />
    </>
  );
}

function Flag() {
  return (
    <>
      <CellBackgroundCover />
      <img alt="flag" src={flag} />
    </>
  );
}

function MinesAround({mines}: {mines: number}) {
  return (
    <>
      <CellBackgroundOpen />
      <img alt="mines-around" src={getTextImage(mines)} />
    </>
  );
}

function Question() {
  return (
    <>
      <CellBackgroundCover />
      <img alt="question" src={question} />
    </>
  );
}

function QuestionOpen() {
  return (
    <>
      <CellBackgroundOpen />
      <img alt="question" src={question} />
    </>
  );
}

function Mine() {
  return (
    <>
      <CellBackgroundOpen />
      <img alt="mine" src={mine} />
    </>
  );
}

function CellBackgroundCover() {
  return <div className="mine__cell-background mine__cell-background--cover" />;
}

function CellBackgroundOpen() {
  return <div className="mine__cell-background mine__cell-background--open" />;
}
