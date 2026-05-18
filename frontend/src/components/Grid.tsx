import { CellState, GRID_SIZE } from '../types';

const COL_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface GridProps {
  grid: CellState[][];
  previewCells?: [number, number][];
  previewValid?: boolean;
  votedCell?: [number, number] | null;
  onCellClick?: (row: number, col: number) => void;
  onCellHover?: (row: number, col: number) => void;
  onMouseLeave?: () => void;
  disabled?: boolean;
  size?: number;
}

export function Grid({
  grid,
  previewCells = [],
  previewValid = true,
  votedCell,
  onCellClick,
  onCellHover,
  onMouseLeave,
  disabled = false,
  size = 36,
}: GridProps) {
  const labelSize = Math.round(size * 0.6);

  function cellClass(r: number, c: number): string {
    const isPreview = previewCells.some(([pr, pc]) => pr === r && pc === c);
    if (isPreview) return previewValid ? 'grid-cell cell-preview-ok' : 'grid-cell cell-preview-bad';
    if (votedCell && votedCell[0] === r && votedCell[1] === c) return 'grid-cell cell-voted';
    const cell = grid[r]?.[c] ?? 'empty';
    return `grid-cell cell-${cell}`;
  }

  function cellContent(r: number, c: number): string {
    const cell = grid[r]?.[c] ?? 'empty';
    if (cell === 'hit') return '💥';
    if (cell === 'miss') return '·';
    return '';
  }

  return (
    <div className="grid-wrap" onMouseLeave={onMouseLeave}>
      {/* Header row with column labels */}
      <div className="grid-row">
        <div style={{ width: labelSize, height: labelSize, background: '#0f172a' }} />
        {COL_LABELS.map(label => (
          <div
            key={label}
            className="grid-cell cell-label"
            style={{ width: size, height: labelSize }}
          >
            {label}
          </div>
        ))}
      </div>

      {Array.from({ length: GRID_SIZE }, (_, r) => (
        <div key={r} className="grid-row">
          <div
            className="grid-cell cell-label"
            style={{ width: labelSize, height: size }}
          >
            {ROW_LABELS[r]}
          </div>
          {Array.from({ length: GRID_SIZE }, (_, c) => (
            <div
              key={c}
              className={cellClass(r, c)}
              style={{ width: size, height: size }}
              onClick={() => !disabled && onCellClick?.(r, c)}
              onMouseEnter={() => !disabled && onCellHover?.(r, c)}
              onTouchStart={() => !disabled && onCellHover?.(r, c)}
            >
              {cellContent(r, c)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
