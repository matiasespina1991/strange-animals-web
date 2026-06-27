export type MinesweeperDifficulty = 'Beginner' | 'Intermediate' | 'Expert';

export const minesweeperConfig: Record<
  MinesweeperDifficulty,
  {
    rows: number;
    columns: number;
    mines: number;
  }
> = {
  Beginner: {
    rows: 9,
    columns: 9,
    mines: 10,
  },
  Intermediate: {
    rows: 16,
    columns: 16,
    mines: 40,
  },
  Expert: {
    rows: 16,
    columns: 30,
    mines: 99,
  },
};
