import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import {
  type BoardEvaluation,
  type BoardState,
  checkMoveSafety,
  formatCoord,
  getLinesThroughCell,
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

  const hoverLineCells = useMemo(() => {
    if (!hoverCell || evaluation.isGameOver) return new Set<string>();
    const set = new Set<string>();
    for (const line of getLinesThroughCell(n, hoverCell.r, hoverCell.c)) {
      for (const pt of line.cells) {
        set.add(`${pt.r},${pt.c}`);
      }
    }
    return set;
  }, [hoverCell, n, evaluation.isGameOver]);

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
    if (!showSafetyHints || !selectedCoin || remainingCountForSelected <= 0 || evaluation.isGameOver) {
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

  // Compute SVG overlay lines for violating 45° lines
  const svgLines = useMemo(() => {
    return evaluation.violatingLines.map((line) => {
      const first = line.cells[0];
      const last = line.cells[line.cells.length - 1];
      return {
        id: line.lineId,
        x1: ((first.c + 0.5) / n) * 100,
        y1: ((first.r + 0.5) / n) * 100,
        x2: ((last.c + 0.5) / n) * 100,
        y2: ((last.r + 0.5) / n) * 100,
      };
    });
  }, [evaluation.violatingLines, n]);

  const colLabels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
  const rowLabels = Array.from({ length: n }, (_, i) => String(i + 1));

  // Scale coin typography cleanly across n=2..6
  const coinFontSize =
    n <= 3 ? 'text-2xl sm:text-3xl' : n === 4 ? 'text-xl sm:text-2xl' : n === 5 ? 'text-lg sm:text-xl' : 'text-base sm:text-lg';

  return (
    <div className="w-full max-w-[540px] mx-auto select-none">
      {/* Column axis labels */}
      <div
        className="grid gap-1.5 pl-7 pr-2 pb-1.5"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {colLabels.map((lbl) => (
          <div
            key={lbl}
            className="text-center font-mono text-xs font-medium text-slate-400 tabular-nums"
          >
            {lbl}
          </div>
        ))}
      </div>

      <div className="flex items-stretch gap-2">
        {/* Row axis labels */}
        <div
          className="grid gap-1.5 py-2 w-5 shrink-0"
          style={{ gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {rowLabels.map((lbl) => (
            <div
              key={lbl}
              className="flex items-center justify-end font-mono text-xs font-medium text-slate-400 tabular-nums"
            >
              {lbl}
            </div>
          ))}
        </div>

        {/* Main square board surface */}
        <div className="relative flex-1 aspect-square rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">
          <div
            className="relative grid h-full w-full gap-1.5 rounded-lg overflow-hidden"
            style={{
              gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${n}, minmax(0, 1fr))`,
            }}
            onMouseLeave={() => setHoverCell(null)}
          >
            {board.map((row, r) =>
              row.map((cell, c) => {
                const key = `${r},${c}`;
                const isDarkSquare = (r + c) % 2 === 1;
                const isHovered = hoverCell?.r === r && hoverCell?.c === c;
                const isOnHoverRay = hoverLineCells.has(key);
                const isViolatingCoin = violatingCoordSet.has(key);
                const isOnViolatingLine = violatingLineCoordSet.has(key);
                const isLastMove = lastMoveCoord?.r === r && lastMoveCoord?.c === c;
                const safety = cellSafetyMap.get(key);
                const coord = formatCoord(r, c);

                let squareBg = isDarkSquare ? 'bg-slate-200/95' : 'bg-slate-50';
                if (isOnViolatingLine) {
                  squareBg = isDarkSquare ? 'bg-rose-100' : 'bg-rose-50';
                } else if (isHovered && canInteract && !cell) {
                  squareBg = 'bg-amber-100';
                } else if (isOnHoverRay && !cell) {
                  squareBg = isDarkSquare ? 'bg-amber-50/90' : 'bg-amber-50';
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
                        ? `Square ${coord}, coin ${cell.value} placed by Player ${cell.placedBy}`
                        : `Empty square ${coord}`
                    }
                    className={`group relative flex items-center justify-center rounded-md transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-500 min-h-[44px] min-w-[44px] ${squareBg} ${
                      canInteract && !cell
                        ? 'cursor-pointer hover:scale-[1.015]'
                        : 'cursor-default'
                    }`}
                  >
                    {/* Coordinate micro-label on empty cells */}
                    {!cell && (
                      <span className="pointer-events-none absolute top-1 left-1.5 font-mono text-[10px] font-medium text-slate-400 opacity-75">
                        {coord}
                      </span>
                    )}

                    {/* Safety hint affordance (icon + text/color, never hue-only) */}
                    {!cell && safety && (
                      <span
                        className={`pointer-events-none absolute bottom-1 right-1 flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[10px] font-semibold ${
                          safety.safe
                            ? 'bg-emerald-600/15 text-emerald-800'
                            : 'bg-rose-600/15 text-rose-800'
                        }`}
                      >
                        {safety.safe ? (
                          <Check className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <>
                            <X className="h-3 w-3" aria-hidden="true" />
                            <span>-{safety.winnings}</span>
                          </>
                        )}
                      </span>
                    )}

                    {/* Hover ghost preview of selected coin */}
                    {!cell && isHovered && canInteract && selectedCoin !== null && (
                      <div
                        aria-hidden="true"
                        className="flex h-[68%] w-[68%] items-center justify-center rounded-full border-2 border-dashed border-slate-500/60 bg-white/70 font-mono text-lg font-bold text-slate-600"
                      >
                        {selectedCoin}
                      </div>
                    )}

                    {/* Placed Coin */}
                    {cell && (
                      <div
                        className={`relative flex h-[76%] w-[76%] items-center justify-center rounded-full shadow-md transition-transform duration-150 ${
                          isViolatingCoin
                            ? 'bg-rose-600 text-white ring-4 ring-rose-500/45 border-2 border-rose-200'
                            : cell.placedBy === 1
                              ? 'bg-slate-900 text-emerald-300 border-[3px] border-emerald-500'
                              : 'bg-slate-900 text-amber-300 border-[3px] border-amber-500'
                        } ${isLastMove && !isViolatingCoin ? 'ring-2 ring-slate-900/30 ring-offset-2 ring-offset-slate-100' : ''}`}
                      >
                        <span className={`font-mono font-bold tabular-nums leading-none ${coinFontSize}`}>
                          {cell.value}
                        </span>

                        {/* Non-hue player attribution tag */}
                        <span
                          className={`absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-sm px-0.5 font-mono text-[9px] font-bold leading-none ${
                            isViolatingCoin
                              ? 'bg-rose-950 text-rose-100'
                              : cell.placedBy === 1
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-500 text-slate-950'
                          }`}
                        >
                          {isViolatingCoin ? '!' : `P${cell.placedBy}`}
                        </span>

                        {isViolatingCoin && (
                          <AlertTriangle
                            className="absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full bg-rose-950 p-0.5 text-rose-200"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    )}
                  </button>
                );
              }),
            )}

            {/* SVG 45-degree violation ray overlay */}
            {svgLines.length > 0 && (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                {svgLines.map((line) => (
                  <line
                    key={line.id}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke="rgba(220, 38, 38, 0.55)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                ))}
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
