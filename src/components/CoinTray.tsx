import React from 'react';

interface CoinTrayProps {
  n: number;
  remainingCoins: Record<number, number>;
  selectedCoin: number | null;
  disabled: boolean;
  onSelectCoin: (value: number) => void;
}

export const CoinTray: React.FC<CoinTrayProps> = ({
  n,
  remainingCoins,
  selectedCoin,
  disabled,
  onSelectCoin,
}) => {
  const values = Array.from({ length: n }, (_, i) => i + 1);
  const rows: number[][] =
    n <= 6 ? [values] : [values.slice(0, Math.floor(n / 2)), values.slice(Math.floor(n / 2))];
  const maxCols = Math.max(...rows.map((r) => r.length));
  const buttonWidth = `calc((100% - ${(maxCols - 1) * 6}px) / ${maxCols})`;

  return (
    <div className="w-full mt-3 font-mono">
      <div className="flex items-center justify-between mb-1.5 text-[11px] text-neutral-600 dark:text-neutral-400">
        <span title="Shared pool of coins (keyboard shortcut: 1–9, 0 for 10)">COINS (1–{n})</span>
        <span className="tabular-nums" title="Remaining coins left in the shared pool">
          {Object.values(remainingCoins).reduce((a, b) => a + b, 0)}/{n * n} LEFT
        </span>
      </div>

      <div className="flex flex-col items-center gap-[6px]">
        {rows.map((rowValues, rowIdx) => (
          <div key={rowIdx} className="flex w-full items-center justify-center gap-[6px]">
            {rowValues.map((val) => {
              const count = remainingCoins[val] ?? 0;
              const isSelected = selectedCoin === val && count > 0;
              const isEmpty = count === 0;

              return (
                <button
                  key={val}
                  type="button"
                  disabled={disabled || isEmpty}
                  onClick={() => onSelectCoin(val)}
                  aria-pressed={isSelected}
                  title={
                    isEmpty
                      ? `No [${val}] coins left`
                      : `Select coin [${val}] (${count} remaining)`
                  }
                  style={{ width: buttonWidth }}
                  className={`flex items-center justify-center border py-2 px-1 transition-colors min-h-[38px] shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-white ${
                    isEmpty
                      ? 'border-neutral-300 bg-neutral-100 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-600 cursor-not-allowed'
                      : isSelected
                        ? 'border-2 border-black bg-black text-white dark:border-white dark:bg-white dark:text-black cursor-pointer'
                        : 'border-black bg-white text-black hover:bg-neutral-100 dark:border-white dark:bg-black dark:text-white dark:hover:bg-neutral-900 cursor-pointer'
                  }`}
                >
                  <span className="text-sm font-bold tabular-nums leading-none whitespace-nowrap">
                    [{val}] x{count}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
