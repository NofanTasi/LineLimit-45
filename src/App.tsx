import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import {
  type BoardState,
  type MoveRecord,
  type PlayerId,
  type SafeMoveOption,
  chooseBotMove,
  cloneBoard,
  createEmptyBoard,
  evaluateBoard,
  formatCoord,
  getAllSafeAndLosingMoves,
  getRemainingCoins,
} from './game/engine';
import { TopBar, type WorkspaceTab } from './components/TopBar';
import { GameBoard } from './components/GameBoard';
import { CoinTray } from './components/CoinTray';
import { MatchPanel } from './components/MatchPanel';
import { NimLabPanel } from './components/NimLabPanel';
import { StrategyChatPanel } from './components/StrategyChatPanel';
import { PhotoAnalyzerPanel } from './components/PhotoAnalyzerPanel';
import {
  playPlaceSound,
  playSelectSound,
  playViolationSound,
  playWinSound,
} from './utils/sound';

interface HistorySnapshot {
  board: BoardState;
  currentPlayer: PlayerId;
  moves: MoveRecord[];
  lastBotNote: string | null;
}

export default function App() {
  const [n, setN] = useState<number>(4);
  const [mode, setMode] = useState<'pvp' | 'bot'>('pvp');
  const [board, setBoard] = useState<BoardState>(() => createEmptyBoard(4));
  const [currentPlayer, setCurrentPlayer] = useState<PlayerId>(1);
  const [selectedCoin, setSelectedCoin] = useState<number | null>(1);
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [showSafetyHints, setShowSafetyHints] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('match');
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);
  const [lastBotNote, setLastBotNote] = useState<string | null>(null);

  const evaluation = useMemo(() => evaluateBoard(board), [board]);
  const remainingCoins = useMemo(() => getRemainingCoins(board), [board]);
  const { safeMoves } = useMemo(() => getAllSafeAndLosingMoves(board), [board]);

  const winner: PlayerId | null = useMemo(() => {
    if (!evaluation.isGameOver || moves.length === 0) return null;
    const losingPlayer = moves[moves.length - 1].player;
    return losingPlayer === 1 ? 2 : 1;
  }, [evaluation.isGameOver, moves]);

  const loser: PlayerId | null = useMemo(() => {
    if (!evaluation.isGameOver || moves.length === 0) return null;
    return moves[moves.length - 1].player;
  }, [evaluation.isGameOver, moves]);

  const lastMoveCoord = useMemo(() => {
    if (moves.length === 0) return null;
    const last = moves[moves.length - 1];
    return { r: last.r, c: last.c };
  }, [moves]);

  // Keep selectedCoin valid if that denomination runs out
  useEffect(() => {
    if (selectedCoin !== null && (remainingCoins[selectedCoin] ?? 0) > 0) return;
    const nextAvail = Array.from({ length: n }, (_, i) => i + 1).find(
      (v) => (remainingCoins[v] ?? 0) > 0,
    );
    setSelectedCoin(nextAvail ?? null);
  }, [remainingCoins, selectedCoin, n]);

  const startNewGame = useCallback(
    (nextSize = n, nextMode = mode) => {
      setIsBotThinking(false);
      setN(nextSize);
      setMode(nextMode);
      setBoard(createEmptyBoard(nextSize));
      setCurrentPlayer(1);
      setSelectedCoin(1);
      setMoves([]);
      setHistory([]);
      setLastBotNote(null);
    },
    [n, mode],
  );

  const applyMove = useCallback(
    (r: number, c: number, value: number, player: PlayerId, botReason?: string) => {
      if (board[r][c] !== null) return;
      if ((remainingCoins[value] ?? 0) <= 0) return;

      const snapshot: HistorySnapshot = {
        board: cloneBoard(board),
        currentPlayer,
        moves: [...moves],
        lastBotNote,
      };

      const nextBoard = cloneBoard(board);
      const nextMoveIndex = moves.length + 1;
      nextBoard[r][c] = { value, placedBy: player, moveIndex: nextMoveIndex };

      const nextEval = evaluateBoard(nextBoard);
      const record: MoveRecord = {
        moveIndex: nextMoveIndex,
        player,
        r,
        c,
        coordLabel: formatCoord(r, c),
        value,
        causedLoss: nextEval.isGameOver,
        winningsIfLost: nextEval.totalWinnings,
      };

      setHistory((prev) => [...prev, snapshot]);
      setBoard(nextBoard);
      setMoves((prev) => [...prev, record]);
      setCurrentPlayer(player === 1 ? 2 : 1);
      if (botReason !== undefined) {
        setLastBotNote(botReason);
      }

      if (nextEval.isGameOver) {
        playViolationSound(muted);
        setTimeout(() => playWinSound(muted), 220);
      } else {
        playPlaceSound(value, muted);
      }
    },
    [board, currentPlayer, moves, remainingCoins, lastBotNote, muted],
  );

  const handleBoardClick = useCallback(
    (r: number, c: number) => {
      if (evaluation.isGameOver || evaluation.isBoardFull || isBotThinking) return;
      if (mode === 'bot' && currentPlayer === 2) return;
      if (selectedCoin === null) return;
      applyMove(r, c, selectedCoin, currentPlayer);
    },
    [
      evaluation.isGameOver,
      evaluation.isBoardFull,
      isBotThinking,
      mode,
      currentPlayer,
      selectedCoin,
      applyMove,
    ],
  );

  // Strategy Bot automated turn
  useEffect(() => {
    if (
      mode !== 'bot' ||
      currentPlayer !== 2 ||
      evaluation.isGameOver ||
      evaluation.isBoardFull
    ) {
      setIsBotThinking(false);
      return;
    }

    setIsBotThinking(true);
    const timer = setTimeout(() => {
      const botPick = chooseBotMove(board);
      setIsBotThinking(false);
      if (botPick) {
        applyMove(botPick.r, botPick.c, botPick.value, 2, botPick.reasoning);
      }
    }, 550);

    return () => clearTimeout(timer);
  }, [mode, currentPlayer, evaluation.isGameOver, evaluation.isBoardFull, board, applyMove]);

  // Keyboard shortcuts 1..n for quick coin selection
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      const num = Number(e.key);
      if (Number.isInteger(num) && num >= 1 && num <= n) {
        if ((remainingCoins[num] ?? 0) > 0) {
          setSelectedCoin(num);
          playSelectSound(muted);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [n, remainingCoins, muted]);

  function handleUndo() {
    if (history.length === 0 || isBotThinking) return;
    // In bot mode, step back to the most recent Player 1 decision when possible
    let steps = 1;
    if (mode === 'bot' && history.length >= 2 && currentPlayer === 1) {
      steps = 2;
    }
    const targetIdx = Math.max(0, history.length - steps);
    const snap = history[targetIdx];
    setBoard(snap.board);
    setCurrentPlayer(snap.currentPlayer);
    setMoves(snap.moves);
    setLastBotNote(snap.lastBotNote);
    setHistory(history.slice(0, targetIdx));
  }

  function loadPromptExample(secondCoinValue: 1 | 2) {
    setIsBotThinking(false);
    setN(4);
    setMode('pvp');
    const b = createEmptyBoard(4);
    b[0][0] = { value: 1, placedBy: 1, moveIndex: 1 };
    b[0][3] = { value: secondCoinValue, placedBy: 2, moveIndex: 2 };
    const ev = evaluateBoard(b);
    setBoard(b);
    setMoves([
      {
        moveIndex: 1,
        player: 1,
        r: 0,
        c: 0,
        coordLabel: 'A1',
        value: 1,
        causedLoss: false,
        winningsIfLost: 0,
      },
      {
        moveIndex: 2,
        player: 2,
        r: 0,
        c: 3,
        coordLabel: 'D1',
        value: secondCoinValue,
        causedLoss: ev.isGameOver,
        winningsIfLost: ev.totalWinnings,
      },
    ]);
    setCurrentPlayer(1);
    setHistory([]);
    setLastBotNote(null);
    setActiveTab('match');
    if (ev.isGameOver) {
      playViolationSound(muted);
    } else {
      playPlaceSound(secondCoinValue, muted);
    }
  }

  function handleLoadDetectedGrid(grid: number[][]) {
    const detectedN = grid.length;
    if (detectedN < 2 || detectedN > 6) return;
    setIsBotThinking(false);
    setN(detectedN);
    const b = createEmptyBoard(detectedN);
    const importedMoves: MoveRecord[] = [];
    let ply = 0;

    for (let r = 0; r < detectedN; r++) {
      for (let c = 0; c < detectedN; c++) {
        const val = grid[r][c];
        if (val >= 1 && val <= detectedN) {
          ply++;
          const p: PlayerId = ply % 2 === 1 ? 1 : 2;
          b[r][c] = { value: val, placedBy: p, moveIndex: ply };
          importedMoves.push({
            moveIndex: ply,
            player: p,
            r,
            c,
            coordLabel: formatCoord(r, c),
            value: val,
            causedLoss: false,
            winningsIfLost: 0,
          });
        }
      }
    }

    const ev = evaluateBoard(b);
    if (ev.isGameOver && importedMoves.length > 0) {
      const last = importedMoves[importedMoves.length - 1];
      last.causedLoss = true;
      last.winningsIfLost = ev.totalWinnings;
    }

    setBoard(b);
    setMoves(importedMoves);
    setCurrentPlayer(ply % 2 === 0 ? 1 : 2);
    setHistory([]);
    setLastBotNote(null);
    setActiveTab('match');
  }

  function handleApplySuggestedMove(move: SafeMoveOption) {
    if (evaluation.isGameOver || evaluation.isBoardFull || isBotThinking) return;
    if (mode === 'bot' && currentPlayer === 2) return;
    applyMove(move.r, move.c, move.value, currentPlayer);
  }

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: 'match', label: 'Match & Lines' },
    { id: 'nim', label: 'Nim Strategy' },
    { id: 'photo', label: 'Photo Analyzer' },
    { id: 'chat', label: 'Strategy Chat' },
  ];

  return (
    <div id="top" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewMatch={() => startNewGame(n, mode)}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Dominant Anchor: Board & Coin Controls (7 cols) */}
          <section aria-label="Game Board Arena" className="lg:col-span-7 flex flex-col">
            {/* Compact Arena Toolbar */}
            <div className="w-full max-w-[540px] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3">
              {/* Board Size Segmented Control */}
              <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800">
                {[2, 3, 4, 5, 6].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => startNewGame(size, mode)}
                    className={`rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                      n === size
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-slate-50'
                    }`}
                  >
                    {size}×{size}
                  </button>
                ))}
              </div>

              {/* Opponent Segmented Control */}
              <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => startNewGame(n, 'pvp')}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    mode === 'pvp'
                      ? 'bg-slate-800 text-slate-50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  2P Pass &amp; Play
                </button>
                <button
                  type="button"
                  onClick={() => startNewGame(n, 'bot')}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    mode === 'bot'
                      ? 'bg-slate-800 text-slate-50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  vs. Strategy Bot
                </button>
              </div>

              {/* Utility Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length === 0 || isBotThinking}
                  title="Undo last move"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Undo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSafetyHints((s) => !s)}
                  aria-pressed={showSafetyHints}
                  title="Toggle safe/losing cell indicators for the selected coin"
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    showSafetyHints
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {showSafetyHints ? (
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Safe Hints</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-slate-100 shrink-0"
                >
                  {muted ? (
                    <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <GameBoard
              board={board}
              selectedCoin={selectedCoin}
              remainingCountForSelected={selectedCoin ? remainingCoins[selectedCoin] ?? 0 : 0}
              evaluation={evaluation}
              showSafetyHints={showSafetyHints}
              disabled={isBotThinking || (mode === 'bot' && currentPlayer === 2)}
              lastMoveCoord={lastMoveCoord}
              onPlaceCoin={handleBoardClick}
            />

            <CoinTray
              n={n}
              remainingCoins={remainingCoins}
              selectedCoin={selectedCoin}
              disabled={
                evaluation.isGameOver ||
                evaluation.isBoardFull ||
                isBotThinking ||
                (mode === 'bot' && currentPlayer === 2)
              }
              onSelectCoin={(val) => {
                setSelectedCoin(val);
                playSelectSound(muted);
              }}
            />

            {/* Rules & Prompt Examples Bar */}
            <div className="w-full max-w-[540px] mx-auto mt-5 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h2 className="font-display text-sm font-bold text-slate-100">
                  45° Line Limit Rule
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadPromptExample(1)}
                    className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-[11px] text-rose-300 transition-colors hover:border-rose-500/50 whitespace-nowrap shrink-0"
                  >
                    Example: 1 . . 1 (Wins 2)
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPromptExample(2)}
                    className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-[11px] text-emerald-300 transition-colors hover:border-emerald-500/50 whitespace-nowrap shrink-0"
                  >
                    Example: 1 . . 2 (Safe)
                  </button>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                Players take turns placing one coin (<span className="font-mono">1…{n}</span>) on any
                empty square. You lose immediately if your move leaves any coin{' '}
                <span className="font-mono">v</span> on any row, column, or 45° diagonal where{' '}
                <span className="font-mono text-slate-100">count(coins ≤ v) &gt; v</span>. The
                opponent wins the sum of all such violating coins.
              </p>
            </div>
          </section>

          {/* Right Workspace Studio (5 cols) */}
          <aside aria-label="Analysis and Strategy Workspace" className="lg:col-span-5 flex flex-col gap-4">
            {/* Workspace Tab Bar */}
            <div
              role="tablist"
              aria-label="Workspace panels"
              className="grid grid-cols-4 gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1"
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors whitespace-nowrap truncate ${
                      isActive
                        ? 'bg-slate-800 text-amber-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'match' && (
              <MatchPanel
                n={n}
                mode={mode}
                currentPlayer={currentPlayer}
                isBotThinking={isBotThinking}
                evaluation={evaluation}
                winner={winner}
                loser={loser}
                moves={moves}
                safeMoveCount={safeMoves.length}
                lastBotNote={lastBotNote}
                onPlayAgain={() => startNewGame(n, mode)}
              />
            )}

            {activeTab === 'nim' && (
              <NimLabPanel
                board={board}
                n={n}
                isGameOver={evaluation.isGameOver}
                onApplySuggestedMove={handleApplySuggestedMove}
                onSwitchToSize={(size) => startNewGame(size, mode)}
              />
            )}

            {activeTab === 'photo' && (
              <PhotoAnalyzerPanel onLoadDetectedGrid={handleLoadDetectedGrid} />
            )}

            {activeTab === 'chat' && (
              <StrategyChatPanel
                board={board}
                currentPlayer={currentPlayer}
                moveCount={moves.length}
                safeMoveCount={safeMoves.length}
                evaluation={evaluation}
                winner={winner}
              />
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
