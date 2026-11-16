import React, { useEffect, useMemo, useState } from 'react';
import {
  type BoardEvaluation,
  type BoardState,
  type CellHintInfo,
  getBoardCellHints,
} from '../game/engine';

interface GameBoardProps {
  board: BoardState;
  selectedCoin: number | null;
  remainingCountForSelected: number;
  evaluation: BoardEvaluation;
  isTeamWin?: boolean;
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
  isTeamWin = false,
  showSafetyHints,
  disabled,
  lastMoveCoord,
  onPlaceCoin,
}) => {
  const n = board.length;
  const [hoverCell, setHoverCell] = useState<{ r: number; c: number } | null>(null);
  const [flashInverted, setFlashInverted] = useState<boolean>(false);

  useEffect(() => {
    if (!evaluation.isGameOver && !isTeamWin) {
      setFlashInverted(false);
      return;
    }

    if (evaluation.isGameOver) {
      // Flash offending lines black <-> white 3 times, then settle inverted
      setFlashInverted(true);
      const timers = [
        window.setTimeout(() => setFlashInverted(false), 180),
        window.setTimeout(() => setFlashInverted(true), 340),
        window.setTimeout(() => setFlashInverted(false), 520),
        window.setTimeout(() => setFlashInverted(true), 680),
        window.setTimeout(() => setFlashInverted(false), 860),
        window.setTimeout(() => setFlashInverted(true), 1020),
      ];

      return () => {
        timers.forEach((id) => window.clearTimeout(id));
      };
    }

    // Team win in Co-op: flash the full board black <-> white 3 times, then settle normal
    setFlashInverted(true);
    const timers = [
      window.setTimeout(() => setFlashInverted(false), 180),
      window.setTimeout(() => setFlashInverted(true), 340),
      window.setTimeout(() => setFlashInverted(false), 520),
      window.setTimeout(() => setFlashInverted(true), 680),
      window.setTimeout(() => setFlashInverted(false), 860),
    ];

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [evaluation.isGameOver, isTeamWin]);

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
    if (!showSafetyHints || evaluation.isGameOver) {
      return new Map<string, CellHintInfo>();
    }
    const activeCoin =
      selectedCoin !== null && remainingCountForSelected > 0 ? selectedCoin : null;
    return getBoardCellHints(board, activeCoin);
  }, [board, selectedCoin, remainingCountForSelected, showSafetyHints, evaluation.isGameOver]);

  const canInteract =
    !disabled && !evaluation.isGameOver && selectedCoin !== null && remainingCountForSelected > 0;

  const coinFontSize =
    n <= 4 ? 'text-xl' : n <= 6 ? 'text-base' : n <= 9 ? 'text-sm' : 'text-[11px]';
  const coinCircleSize = n >= 10 ? 'h-[80%] w-[80%]' : 'h-[74%] w-[74%]';

  return (
    <div className="w-full select-none font-mono">
      {/* Classic B&W Grid (supports light & dark modes) */}
      <div className="relative w-full aspect-square border-2 border-black bg-white dark:border-white dark:bg-black">
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
              const isInvertedLineCell = flashInverted && (isTeamWin || isOnViolatingLine);
              const isLastMove = lastMoveCoord?.r === r && lastMoveCoord?.c === c;
              const safety = cellSafetyMap.get(key);

              let squareBg = isCheckerDark
                ? 'bg-neutral-100 dark:bg-neutral-900'
                : 'bg-white dark:bg-black';
              let squareBorder = 'border-black/35 dark:border-white/35';
              if (isInvertedLineCell) {
                squareBg = isCheckerDark
                  ? 'bg-neutral-900 dark:bg-neutral-100'
                  : 'bg-black dark:bg-white';
                squareBorder = 'border-white/35 dark:border-black/35';
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
                  className={`relative flex items-center justify-center min-h-0 min-w-0 border-r border-b ${squareBorder} focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-black dark:focus-visible:outline-white ${squareBg} ${
                    c === n - 1 ? 'border-r-0' : ''
                  } ${r === n - 1 ? 'border-b-0' : ''} ${
                    canInteract && !cell ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  {!cell && safety && (
                    <>
                      <span
                        className={`pointer-events-none absolute top-0.5 left-0.5 px-0.5 font-semibold leading-none tabular-nums ${
                          n >= 9 ? 'text-[8px]' : 'text-[10px]'
                        } ${
                          safety.minSafeCoin === null
                            ? 'bg-neutral-600 text-white'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {safety.minSafeCoin === null ? 'KO' : safety.minSafeCoin}
                      </span>

                      {safety.selectedSafe !== null && (
                        <span
                          className={`pointer-events-none absolute bottom-0.5 right-0.5 px-0.5 font-semibold leading-none tabular-nums ${
                            n >= 9 ? 'text-[8px]' : 'text-[10px]'
                          } ${
                            safety.selectedSafe
                              ? 'text-black dark:text-white'
                              : 'bg-black text-white dark:bg-white dark:text-black'
                          }`}
                        >
                          {safety.selectedSafe ? 'OK' : `-${safety.selectedWinnings}`}
                        </span>
                      )}
                    </>
                  )}

                  {/* Hover preview coin */}
                  {!cell && isHovered && canInteract && selectedCoin !== null && (
                    <div
                      aria-hidden="true"
                      className={`flex ${coinCircleSize} items-center justify-center rounded-full border border-dashed border-black bg-white/80 font-bold text-neutral-600 dark:border-white dark:bg-black/80 dark:text-neutral-300 ${coinFontSize}`}
                    >
                      {selectedCoin}
                    </div>
                  )}

                  {/* Placed Monochrome Coin: P1 = White, P2 = Black */}
                  {cell && (
                    <div
                      className={`relative flex ${coinCircleSize} items-center justify-center rounded-full border-2 ${
                        isInvertedLineCell
                          ? 'border-white dark:border-black'
                          : 'border-black dark:border-white'
                      } ${
                        cell.placedBy === 1 ? 'bg-white text-black' : 'bg-black text-white'
                      } ${
                        isViolatingCoin
                          ? isInvertedLineCell
                            ? 'outline-2 outline-offset-1 outline-white dark:outline-black'
                            : 'outline-2 outline-offset-1 outline-black dark:outline-white'
                          : isLastMove
                            ? 'outline-1 outline-offset-1 outline-neutral-500'
                            : ''
                      }`}
                    >
                      <span className={`font-bold tabular-nums leading-none ${coinFontSize}`}>
                        {cell.value}
                      </span>

                      {n <= 8 || isViolatingCoin ? (
                        <span
                          className={`absolute -bottom-1 -right-1 border px-0.5 font-bold leading-tight ${
                            n >= 9 ? 'text-[7px]' : 'text-[8px]'
                          } ${
                            isInvertedLineCell
                              ? 'border-white dark:border-black'
                              : 'border-black dark:border-white'
                          } ${
                            cell.placedBy === 1 ? 'bg-white text-black' : 'bg-black text-white'
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
