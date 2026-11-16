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

  return (
    <div className="w-full max-w-[540px] mx-auto mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-300">
          Shared Coin Pool — Select a denomination (keys 1–{n})
        </span>
        <span className="font-mono text-xs text-slate-400 tabular-nums">
          {Object.values(remainingCoins).reduce((a, b) => a + b, 0)} / {n * n} left
        </span>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {values.map((val) => {
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
              className={`flex flex-col items-center justify-center rounded-lg border px-2 py-2.5 transition-all duration-150 min-h-[64px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                isEmpty
                  ? 'border-slate-800 bg-slate-900/40 text-slate-600 cursor-not-allowed opacity-50'
                  : isSelected
                    ? 'border-amber-400 bg-amber-500/15 text-amber-200 shadow-sm -translate-y-0.5'
                    : 'border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500 hover:bg-slate-800/80 cursor-pointer'
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-base font-bold tabular-nums ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500 text-slate-950'
                    : isEmpty
                      ? 'border-slate-700 bg-slate-800 text-slate-500'
                      : 'border-slate-500 bg-slate-950 text-slate-100'
                }`}
              >
                {val}
              </div>
              <span className="mt-1.5 font-mono text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                ×{count} left
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
