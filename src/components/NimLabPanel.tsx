import React, { useMemo } from 'react';
import { Calculator, Compass, Layers, ShieldAlert } from 'lucide-react';
import { type BoardState, type SafeMoveOption, analyzePosition } from '../game/engine';

interface NimLabPanelProps {
  board: BoardState;
  n: number;
  isGameOver: boolean;
  onApplySuggestedMove: (move: SafeMoveOption) => void;
  onSwitchToSize: (size: number) => void;
}

export const NimLabPanel: React.FC<NimLabPanelProps> = ({
  board,
  n,
  isGameOver,
  onApplySuggestedMove,
  onSwitchToSize,
}) => {
  const analysis = useMemo(() => analyzePosition(board, 20000), [board]);

  const outcomeTitle =
    analysis.outcome === 'N'
      ? 'N-Position (Next Player Wins)'
      : analysis.outcome === 'P'
        ? 'P-Position (Previous Player Wins)'
        : analysis.outcome === 'DRAW'
          ? 'Terminal Draw State'
          : 'Deep Tree (Heuristic Evaluation)';

  return (
    <div className="flex flex-col gap-5">
      {/* Live Combinatorial Position Analyzer */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <Calculator className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-slate-50">
                {outcomeTitle}
              </h3>
              <p className="font-mono text-xs text-slate-400 tabular-nums">
                {analysis.confidence === 'EXACT' ? 'Exact Solver' : '2-Ply Tactical'} ·{' '}
                {analysis.nimber !== null ? `Nimber g(S) = ${analysis.nimber}` : 'Nimber N/A'} ·{' '}
                {analysis.safeMoveCount} safe / {analysis.losingMoveCount} losing
              </p>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-300">{analysis.explanation}</p>

        {!isGameOver && analysis.winningMoves.length > 0 && (
          <div className="mt-4 border-t border-slate-800 pt-3">
            <div className="mb-2 text-xs font-semibold text-slate-300">
              {analysis.confidence === 'EXACT'
                ? 'Optimal Winning Moves (Transition to Nimber 0)'
                : 'Top Safe Mobility-Restricting Candidates'}
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.winningMoves.slice(0, 6).map((m) => (
                <button
                  key={`${m.r}-${m.c}-${m.value}`}
                  type="button"
                  onClick={() => onApplySuggestedMove(m)}
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-mono text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 whitespace-nowrap shrink-0 tabular-nums"
                >
                  Place [{m.value}] at {m.coordLabel}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Answer to "Is there a Nim-style strategy to win?" */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-display text-sm font-bold text-slate-50">
            Is There a Nim-Style Winning Strategy?
          </h4>
          {n !== 2 && (
            <button
              type="button"
              onClick={() => onSwitchToSize(2)}
              className="text-xs font-medium text-amber-400 underline-offset-4 hover:underline whitespace-nowrap shrink-0"
            >
              Test Exact n=2 Board
            </button>
          )}
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-slate-300">
          <div className="rounded-lg bg-slate-950/70 p-3">
            <div className="flex items-center gap-2 font-semibold text-emerald-400 mb-1">
              <Compass className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>1. Impartial Safe-Play Reduction (Exact Nimbers Exist)</span>
            </div>
            <p>
              Both players share the exact same board and coin multiset. By restricting moves to{' '}
              <span className="text-slate-100 font-medium">safe placements</span>, the avoidance game
              becomes a finite acyclic normal-play impartial game: a player with zero safe moves is
              forced to trigger a violation and lose. Every position strictly belongs to{' '}
              <span className="font-mono text-slate-100">N</span> (next wins) or{' '}
              <span className="font-mono text-slate-100">P</span> (previous wins) with a well-defined
              Sprague-Grundy Nimber <span className="font-mono text-slate-100">g(S) = mex(g(S&apos;))</span>.
            </p>
          </div>

          <div className="rounded-lg bg-slate-950/70 p-3">
            <div className="flex items-center gap-2 font-semibold text-amber-400 mb-1">
              <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>2. Exact Nim Reduction for n = 2 (Player 1 Guaranteed Win)</span>
            </div>
            <p>
              On a <span className="font-mono text-slate-100">2×2</span> board, every pair of squares
              shares a 45° line. Thus at most one <span className="font-mono text-slate-100">1</span>{' '}
              can ever coexist safely, while any layout of{' '}
              <span className="font-mono text-slate-100">{'{1, 2, 2}'}</span> is always safe. That
              reduces <span className="font-mono text-slate-100">n=2</span> to a single 3-token Nim
              heap: Player 1 takes move 1, Player 2 takes move 2, Player 1 takes move 3, and Player 2
              is forced to place the final <span className="font-mono text-slate-100">1</span> and
              lose 2 points.
            </p>
          </div>

          <div className="rounded-lg bg-slate-950/70 p-3">
            <div className="flex items-center gap-2 font-semibold text-rose-400 mb-1">
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>3. Why Pure XOR Nim &amp; Blind Mirroring Break for n ≥ 3</span>
            </div>
            <p>
              Unlike classic multi-heap Nim, placing a coin simultaneously couples 4 lines (row, column,
              two 45° diagonals) and draws from one shared coin pool, so the board does not factor into
              independent XOR heaps. Moreover, on even <span className="font-mono text-slate-100">n</span>,
              180° point mirroring <span className="font-mono text-slate-100">(r, c) ↔ (n−1−r, n−1−c)</span>{' '}
              fails on the two main diagonals because mirrored diagonal cells share that diagonal (e.g.,
              two <span className="font-mono text-slate-100">1</span>s on A1 and D4 lose immediately).
              Instead, optimal play relies on <span className="text-slate-100 font-medium">line-capacity parity</span>{' '}
              and forcing saturated lines.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
