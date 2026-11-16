import React from 'react';

export type WorkspaceTab = 'match' | 'nim' | 'photo' | 'chat';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onNewMatch: () => void;
}

const NAV_ITEMS: { id: WorkspaceTab; label: string }[] = [
  { id: 'match', label: 'Play Board' },
  { id: 'nim', label: 'Nim Strategy' },
  { id: 'photo', label: 'Photo Analyzer' },
  { id: 'chat', label: 'Strategy Chat' },
];

export const TopBar: React.FC<TopBarProps> = ({ activeTab, onSelectTab, onNewMatch }) => {
  return (
    <header className="w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-4">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('match');
          }}
          className="font-display text-xl font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
        >
          LineLimit 45
        </a>

        <nav
          aria-label="Primary workspace navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400 ${
                  isActive ? 'text-amber-400' : 'text-slate-300 hover:text-slate-50'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[17px] h-0.5 bg-amber-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onNewMatch}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors duration-150 hover:bg-amber-400 active:translate-y-px whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            New Match
          </button>
        </div>
      </div>

      {/* Mobile compact nav row */}
      <nav
        aria-label="Mobile workspace navigation"
        className="flex md:hidden items-center justify-between gap-2 border-t border-slate-800/80 px-4 py-2 overflow-x-auto"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-slate-800 text-amber-400'
                  : 'text-slate-300 hover:text-slate-50'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
