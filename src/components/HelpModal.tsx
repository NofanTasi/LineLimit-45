import React, { useEffect } from 'react';

export type PlayRule = 'adv' | 'coop';
export type GameMode = 'pvp' | 'pvbot' | 'botvp' | 'botvbot';

interface HelpModalProps {
  isOpen: boolean;
  rule: PlayRule;
  mode: GameMode;
  n: number;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  rule,
  mode,
  n,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sym = rule === 'coop' ? '&' : 'v';
  const modeLabel =
    mode === 'pvp'
      ? `P ${sym} P`
      : mode === 'pvbot'
        ? `P ${sym} BOT`
        : mode === 'botvp'
          ? `BOT ${sym} P`
          : `BOT ${sym} BOT`;

  const setupText =
    mode === 'pvp'
      ? rule === 'coop'
        ? 'Two human players alternate turns on the same device, cooperating as White (P1) and Black (P2).'
        : 'Two human players alternate turns on the same device as White (P1) and Black (P2).'
      : mode === 'pvbot'
        ? rule === 'coop'
          ? 'You play first as White (P1) and the cooperative Bot partners with you as Black.'
          : 'You play first as White (P1) against the Bot as Black.'
        : mode === 'botvp'
          ? rule === 'coop'
            ? 'The cooperative Bot opens as White and you partner as Black (P2).'
            : 'The Bot opens as White and you respond as Black (P2).'
          : rule === 'coop'
            ? 'Two cooperative Bots play together to try to fill the entire board. Use PAUSE, SPEED, UNDO, or HINTS to inspect.'
            : 'Two Bots battle automatically. Use PAUSE, SPEED, UNDO, or HINTS to step through and study lines.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="howto-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-mono"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto border-2 border-black bg-white p-5 text-black dark:border-white dark:bg-black dark:text-white"
      >
        <div className="flex items-center justify-between gap-2 border-b border-black pb-2 dark:border-white">
          <h2 id="howto-title" className="text-sm font-bold tracking-tight">
            HOW TO PLAY · {rule === 'coop' ? 'CO-OP' : 'ADVERSARIAL'} ({modeLabel})
          </h2>
          <span className="text-[11px] font-semibold tabular-nums text-neutral-600 dark:text-neutral-400">
            {n}×{n}
          </span>
        </div>

        <div className="mt-3 space-y-3 text-xs leading-relaxed text-neutral-800 dark:text-neutral-200">
          <div>
            <p className="font-bold text-black dark:text-white">THE 45° LINE RULE</p>
            <p className="mt-0.5">
              Players share {n * n} coins ({n} of each value 1–{n}). On your turn, place any
              remaining coin on an empty square. Every row, column, and both 45° diagonals must keep{' '}
              <strong>count(≤ v) ≤ v</strong> for every coin v on that line (e.g. at most one 1,
              two ≤ 2, three ≤ 3).
            </p>
          </div>

          <div>
            <p className="font-bold text-black dark:text-white">
              {rule === 'coop' ? 'CO-OP GOAL (DRAW CHALLENGE)' : 'ADVERSARIAL GOAL'}
            </p>
            {rule === 'coop' ? (
              <p className="mt-0.5">
                <strong>Team wins</strong> if you fill all {n * n} squares with zero violations
                (board flashes on victory). If any placement violates a line, the{' '}
                <strong>team loses</strong> immediately. Avoid creating dead <strong>KO</strong>{' '}
                squares!
              </p>
            ) : (
              <p className="mt-0.5">
                Force your opponent into a violation (or leave them with zero safe moves). A player
                who triggers a violation <strong>loses immediately</strong>, and the winner scores
                the <strong>maximum sum of coins ≤ any violated threshold v</strong> (counted once
                per square across violated lines).
              </p>
            )}
          </div>

          <div>
            <p className="font-bold text-black dark:text-white">CURRENT MODE ({modeLabel})</p>
            <p className="mt-0.5">{setupText}</p>
          </div>

          <div>
            <p className="font-bold text-black dark:text-white">HINTS</p>
            <p className="mt-0.5">
              <strong>HINTS</strong> shows each cell&apos;s <strong>minimum safe coin</strong> (or{' '}
              <strong>KO</strong> if dead) top-left, and <strong>OK</strong> /{' '}
              <strong>-pts</strong> for your selected coin bottom-right.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full border border-black bg-black py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 cursor-pointer"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};
