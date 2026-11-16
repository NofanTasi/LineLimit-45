import React from 'react';
import { AlertTriangle, Bot, CheckCircle2, Trophy, User } from 'lucide-react';
import {
  type BoardEvaluation,
  type MoveRecord,
  type PlayerId,
  formatCoord,
} from '../game/engine';

interface MatchPanelProps {
  n: number;
  mode: 'pvp' | 'bot';
  currentPlayer: PlayerId;
  isBotThinking: boolean;
  evaluation: BoardEvaluation;
  winner: PlayerId | null;
  loser: PlayerId | null;
  moves: MoveRecord[];
  safeMoveCount: number;
  lastBotNote: string | null;
  onPlayAgain: () => void;
}

export const MatchPanel: React.FC<MatchPanelProps> = ({
  n,
  mode,
  currentPlayer,
  isBotThinking,
  evaluation,
  winner,
  loser,
  moves,
  safeMoveCount,
  lastBotNote,
  onPlayAgain,
}) => {
  const playerLabel = (p: PlayerId) => {
    if (mode === 'bot' && p === 2) return 'Strategy Bot (P2)';
    return `Player ${p}`;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Turn / Outcome Header */}
      {evaluation.isGameOver && winner !== null && loser !== null ? (
        <div className="rounded-xl border border-rose-500/40 bg-slate-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                <Trophy className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-50">
                  {playerLabel(winner)} Wins · {evaluation.totalWinnings} Points
                </h3>
                <p className="text-xs text-slate-300">
                  {playerLabel(loser)} placed a coin creating a 45° line violation.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onPlayAgain}
              className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              Play Again
            </button>
          </div>

          <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
            <div className="text-xs font-semibold text-slate-300">
              Violating Coins Counted ({evaluation.violatingCoins.length})
            </div>
            {evaluation.violatingCoins.map((vc) => (
              <div
                key={`${vc.r},${vc.c}`}
                className="flex items-start justify-between gap-2 rounded-lg bg-slate-950/70 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 text-slate-200">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden="true" />
                  <span className="font-mono font-semibold tabular-nums">
                    Coin [{vc.value}] at {formatCoord(vc.r, vc.c)}
                  </span>
                </div>
                <div className="text-right font-mono text-[11px] text-rose-300 tabular-nums">
                  {vc.lines
                    .map((l) => `${l.lineLabel}: ${l.countLeq} ≤ ${vc.value} (> ${vc.value})`)
                    .join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : evaluation.isBoardFull ? (
        <div className="rounded-xl border border-emerald-500/40 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              <div>
                <h3 className="font-display text-base font-bold text-slate-50">
                  Board Filled Without Violation — Draw
                </h3>
                <p className="text-xs text-slate-300">
                  All {n * n} coins placed safely across every 45° line.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onPlayAgain}
              className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 whitespace-nowrap shrink-0"
            >
              Play Again
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  currentPlayer === 1
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                {mode === 'bot' && currentPlayer === 2 ? (
                  <Bot className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <User className="h-5 w-5" aria-hidden="true" />
                )}
              </div>
              <div>
                <div className="font-display text-base font-bold text-slate-50">
                  {isBotThinking ? 'Strategy Bot is calculating…' : `${playerLabel(currentPlayer)}'s Turn`}
                </div>
                <div className="text-xs text-slate-400 tabular-nums">
                  Move {moves.length + 1} · {safeMoveCount} safe{' '}
                  {safeMoveCount === 1 ? 'placement' : 'placements'} available
                </div>
              </div>
            </div>
          </div>

          {safeMoveCount === 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
              <span>
                No safe moves remain! Any placement will trigger a 45° line violation.
              </span>
            </div>
          )}

          {lastBotNote && mode === 'bot' && (
            <p className="mt-3 border-t border-slate-800 pt-2.5 text-xs text-slate-300">
              Bot last move: {lastBotNote}
            </p>
          )}
        </div>
      )}

      {/* Live 45° Line Pressure */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display text-sm font-semibold text-slate-100">
            Active 45° Line Margins
          </h4>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {evaluation.occupiedLines.length} occupied
          </span>
        </div>

        {evaluation.occupiedLines.length === 0 ? (
          <p className="text-xs text-slate-400">
            Place a coin to inspect row, column, and 45° diagonal capacity margins.
          </p>
        ) : (
          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
            {evaluation.occupiedLines.slice(0, 12).map((line) => {
              const isDanger = line.hasViolation;
              const isTight = !isDanger && line.tightestMargin === 0;
              return (
                <div
                  key={line.lineId}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/60 px-3 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-medium text-slate-200 whitespace-nowrap">
                      {line.lineLabel}
                    </span>
                    <span className="font-mono text-slate-400 truncate tabular-nums">
                      [{line.coins.map((c) => c.value).join(', ')}]
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[11px] font-semibold whitespace-nowrap shrink-0 tabular-nums ${
                      isDanger
                        ? 'text-rose-400'
                        : isTight
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    {isDanger
                      ? 'VIOLATED'
                      : isTight
                        ? 'AT LIMIT (0)'
                        : `MARGIN +${line.tightestMargin}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Move History */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display text-sm font-semibold text-slate-100">Move Log</h4>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {moves.length} {moves.length === 1 ? 'ply' : 'plies'}
          </span>
        </div>

        {moves.length === 0 ? (
          <p className="text-xs text-slate-400">
            No coins placed yet. Choose a coin below the board and click any square.
          </p>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
            {[...moves].reverse().map((m) => (
              <div
                key={m.moveIndex}
                className="flex items-center justify-between rounded-md px-2.5 py-1 text-xs hover:bg-slate-800/60"
              >
                <div className="flex items-center gap-2 font-mono tabular-nums">
                  <span className="text-slate-500 w-6">#{m.moveIndex}</span>
                  <span className={m.player === 1 ? 'text-emerald-400' : 'text-amber-400'}>
                    P{m.player}
                  </span>
                  <span className="text-slate-200">
                    placed [{m.value}] at {m.coordLabel}
                  </span>
                </div>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    m.causedLoss ? 'text-rose-400 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {m.causedLoss ? `Lost (${m.winningsIfLost} pts)` : 'Safe'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
