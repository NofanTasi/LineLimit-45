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
  const cols = Math.min(n, 6);

  return (
    <div className="w-full mt-3 font-mono">
      <div className="flex items-center justify-between mb-1.5 text-[11px] text-neutral-600">
        <span>COINS (1–{n})</span>
        <span className="tabular-nums">
          {Object.values(remainingCoins).reduce((a, b) => a + b, 0)}/{n * n} LEFT
        </span>
      </div>

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
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
              className={`flex flex-col items-center justify-center border py-1.5 px-1 transition-colors min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                isEmpty
                  ? 'border-neutral-300 bg-neutral-100 text-neutral-400 cursor-not-allowed'
                  : isSelected
                    ? 'border-2 border-black bg-black text-white cursor-pointer'
                    : 'border-black bg-white text-black hover:bg-neutral-100 cursor-pointer'
              }`}
            >
              <span className="text-sm font-bold tabular-nums leading-none">[{val}]</span>
              <span
                className={`mt-1 text-[10px] tabular-nums whitespace-nowrap ${
                  isSelected ? 'text-neutral-200' : 'text-neutral-600'
                }`}
              >
                ×{count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
