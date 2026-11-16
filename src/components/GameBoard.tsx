import React, { useMemo, useState } from 'react';
import {
  type BoardEvaluation,
  type BoardState,
  checkMoveSafety,
} from '../game/engine';

interface GameBoardProps {
  board: BoardState;
  selectedCoin: number | null;
  remainingCountForSelected: number;
  evaluation: BoardEvaluation;
  showSafetyHints: boolean;
  disabled: boolean;
  lastMoveCoord: { r: number; c: number } | null;
  onPlaceCoin: (r: number, c: number) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  board,
  selectedCoin,
  remainingCountForSelected,
  evaluation,
  showSafetyHints,
  disabled,
  lastMoveCoord,
  onPlaceCoin,
}) => {
  const n = board.length;
  const [hoverCell, setHoverCell] = useState<{ r: number; c: number } | null>(null);

  const violatingCoordSet = useMemo(() => {
    const set = new Set<string>();
    for (const vc of evaluation.violatingCoins) {
      set.add(`${vc.r},${vc.c}`);
    }
    return set;
  }, [evaluation.violatingCoins]);

  const violatingLineCoordSet = useMemo(() => {
    const set = new Set<string>();
    for (const line of evaluation.violatingLines) {
      for (const pt of line.cells) {
        set.add(`${pt.r},${pt.c}`);
      }
    }
    return set;
  }, [evaluation.violatingLines]);

  const cellSafetyMap = useMemo(() => {
    const map = new Map<string, { safe: boolean; winnings: number }>();
    if (
      !showSafetyHints ||
      !selectedCoin ||
      remainingCountForSelected <= 0 ||
      evaluation.isGameOver
    ) {
      return map;
    }
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (board[r][c] === null) {
          const res = checkMoveSafety(board, r, c, selectedCoin);
          map.set(`${r},${c}`, { safe: res.safe, winnings: res.totalWinningsIfLost });
        }
      }
    }
    return map;
  }, [board, n, selectedCoin, remainingCountForSelected, showSafetyHints, evaluation.isGameOver]);

  const canInteract =
    !disabled && !evaluation.isGameOver && selectedCoin !== null && remainingCountForSelected > 0;

  const coinFontSize =
    n <= 4 ? 'text-xl' : n <= 6 ? 'text-base' : n <= 9 ? 'text-sm' : 'text-[11px]';
  const coinCircleSize = n >= 10 ? 'h-[80%] w-[80%]' : 'h-[74%] w-[74%]';

  return (
    <div className="w-full select-none font-mono">
      {/* Classic B&W Grid (no cell names or axis labels) */}
      <div className="relative w-full aspect-square border-2 border-black bg-white">
        <div
          className="relative grid h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${n}, minmax(0, 1fr))`,
          }}
          onMouseLeave={() => setHoverCell(null)}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const key = `${r},${c}`;
              const isCheckerDark = (r + c) % 2 === 1;
              const isHovered = hoverCell?.r === r && hoverCell?.c === c;
              const isViolatingCoin = violatingCoordSet.has(key);
              const isOnViolatingLine = violatingLineCoordSet.has(key);
              const isLastMove = lastMoveCoord?.r === r && lastMoveCoord?.c === c;
              const safety = cellSafetyMap.get(key);

              let squareBg = isCheckerDark ? 'bg-neutral-100' : 'bg-white';
              if (isOnViolatingLine) {
                squareBg = isCheckerDark ? 'bg-neutral-300' : 'bg-neutral-200';
              }

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!canInteract || cell !== null}
                  onClick={() => canInteract && !cell && onPlaceCoin(r, c)}
                  onMouseEnter={() => setHoverCell({ r, c })}
                  aria-label={
                    cell
                      ? `Coin ${cell.value} placed by Player ${cell.placedBy}`
                      : `Empty cell`
                  }
                  className={`relative flex items-center justify-center min-h-0 min-w-0 border-r border-b border-black/35 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-black ${squareBg} ${
                    c === n - 1 ? 'border-r-0' : ''
                  } ${r === n - 1 ? 'border-b-0' : ''} ${
                    canInteract && !cell ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  {!cell && safety && (
                    <span
                      className={`pointer-events-none absolute bottom-0.5 right-0.5 px-0.5 font-semibold tabular-nums ${
                        n >= 9 ? 'text-[8px]' : 'text-[10px]'
                      } ${safety.safe ? 'text-black' : 'bg-black text-white'}`}
                    >
                      {safety.safe ? 'OK' : `-${safety.winnings}`}
                    </span>
                  )}

                  {/* Hover preview coin */}
                  {!cell && isHovered && canInteract && selectedCoin !== null && (
                    <div
                      aria-hidden="true"
                      className={`flex ${coinCircleSize} items-center justify-center rounded-full border border-dashed border-black bg-white/80 font-bold text-neutral-600 ${coinFontSize}`}
                    >
                      {selectedCoin}
                    </div>
                  )}

                  {/* Placed Monochrome Coin: P1 = White, P2 = Black, Over-capacity = Grayscale */}
                  {cell && (
                    <div
                      className={`relative flex ${coinCircleSize} items-center justify-center rounded-full border-2 border-black ${
                        isViolatingCoin
                          ? 'bg-neutral-600 text-white outline-2 outline-offset-1 outline-black'
                          : cell.placedBy === 1
                            ? 'bg-white text-black'
                            : 'bg-black text-white'
                      } ${
                        !isViolatingCoin && isLastMove
                          ? 'outline-1 outline-offset-1 outline-neutral-500'
                          : ''
                      }`}
                    >
                      <span className={`font-bold tabular-nums leading-none ${coinFontSize}`}>
                        {cell.value}
                      </span>

                      {n <= 8 || isViolatingCoin ? (
                        <span
                          className={`absolute -bottom-1 -right-1 border border-black px-0.5 font-bold leading-tight ${
                            n >= 9 ? 'text-[7px]' : 'text-[8px]'
                          } ${
                            isViolatingCoin
                              ? 'bg-neutral-600 text-white'
                              : cell.placedBy === 1
                                ? 'bg-white text-black'
                                : 'bg-black text-white'
                          }`}
                        >
                          {isViolatingCoin ? '!' : `P${cell.placedBy}`}
                        </span>
                      ) : null}
                    </div>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
};
