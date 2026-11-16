import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type BoardState,
  type MoveRecord,
  type PlayerId,
  chooseBotMove,
  cloneBoard,
  countDeadCells,
  createEmptyBoard,
  evaluateBoard,
  formatCoord,
  getAllSafeAndLosingMoves,
  getRemainingCoins,
} from './game/engine';
import { GameBoard } from './components/GameBoard';
import { CoinTray } from './components/CoinTray';
import { Logo } from './components/Logo';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { usePWAUpdate } from './pwa/swManager';

interface HistorySnapshot {
  board: BoardState;
  currentPlayer: PlayerId;
  moves: MoveRecord[];
}

const BOARD_SIZES = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const BOT_SPEED_OPTIONS = [
  { label: '0.25s', ms: 250 },
  { label: '0.5s', ms: 500 },
  { label: '1s', ms: 1000 },
  { label: '1.5s', ms: 1500 },
  { label: '2s', ms: 2000 },
  { label: '3s', ms: 3000 },
];

type PlayRule = 'adv' | 'coop';
type GameMode = 'pvp' | 'pvbot' | 'botvp' | 'botvbot';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [n, setN] = useState<number>(4);
  const [rule, setRule] = useState<PlayRule>('adv');
  const [mode, setMode] = useState<GameMode>('pvp');
  const [board, setBoard] = useState<BoardState>(() => createEmptyBoard(4));
  const [currentPlayer, setCurrentPlayer] = useState<PlayerId>(1);
  const [selectedCoin, setSelectedCoin] = useState<number | null>(1);
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [showSafetyHints, setShowSafetyHints] = useState<boolean>(false);
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);
  const [botSpeedMs, setBotSpeedMs] = useState<number>(1000);
  const { needRefresh, isUpdating, checkAndUpdate } = usePWAUpdate();

  // Zoom state: 'fit' automatically fits the board + coin tray + status inside viewport
  const [zoomMode, setZoomMode] = useState<'fit' | 'manual'>('fit');
  const [manualZoom, setManualZoom] = useState<number>(1);
  const [fitZoom, setFitZoom] = useState<number>(1);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageHeight, setStageHeight] = useState<number>(620);

  const baseStageWidth = n <= 6 ? 480 : n <= 9 ? 540 : 620;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
    }
  }, [theme]);

  const evaluation = useMemo(() => evaluateBoard(board), [board]);
  const remainingCoins = useMemo(() => getRemainingCoins(board), [board]);
  const { safeMoves } = useMemo(() => getAllSafeAndLosingMoves(board), [board]);
  const deadCellCount = useMemo(
    () => (rule === 'coop' && !evaluation.isGameOver ? countDeadCells(board) : 0),
    [rule, evaluation.isGameOver, board],
  );

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

  // Measure viewport & unscaled stage to calculate exact fit zoom
  useEffect(() => {
    const viewportEl = viewportRef.current;
    const stageEl = stageRef.current;
    if (!viewportEl || !stageEl) return;

    const recalc = () => {
      const vw = Math.max(240, viewportEl.clientWidth - 24);
      const vh = Math.max(260, viewportEl.clientHeight - 20);
      const sh = stageEl.offsetHeight || 620;
      setStageHeight(sh);
      const scaleW = vw / baseStageWidth;
      const scaleH = vh / sh;
      const computed = Math.max(0.4, Math.min(1.4, Math.min(scaleW, scaleH)));
      setFitZoom(Number(computed.toFixed(3)));
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(viewportEl);
    ro.observe(stageEl);
    window.addEventListener('resize', recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recalc);
    };
  }, [n, baseStageWidth, evaluation.isGameOver, moves.length]);

  const effectiveZoom = zoomMode === 'fit' ? fitZoom : manualZoom;

  useEffect(() => {
    if (selectedCoin !== null && (remainingCoins[selectedCoin] ?? 0) > 0) return;
    const nextAvail = Array.from({ length: n }, (_, i) => i + 1).find(
      (v) => (remainingCoins[v] ?? 0) > 0,
    );
    setSelectedCoin(nextAvail ?? null);
  }, [remainingCoins, selectedCoin, n]);

  const startNewGame = useCallback(
    (nextSize = n, nextMode = mode, nextRule = rule) => {
      setIsBotThinking(false);
      setN(nextSize);
      setMode(nextMode);
      setRule(nextRule);
      setBoard(createEmptyBoard(nextSize));
      setCurrentPlayer(1);
      setSelectedCoin(1);
      setMoves([]);
      setHistory([]);
      if (nextMode === 'botvbot') {
        setIsAutoPlaying(true);
      }
    },
    [n, mode, rule],
  );

  const applyMove = useCallback(
    (r: number, c: number, value: number, player: PlayerId) => {
      if (board[r][c] !== null) return;
      if ((remainingCoins[value] ?? 0) <= 0) return;

      const snapshot: HistorySnapshot = {
        board: cloneBoard(board),
        currentPlayer,
        moves: [...moves],
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
    },
    [board, currentPlayer, moves, remainingCoins],
  );

  const isHumanTurn =
    mode === 'pvp' ||
    (mode === 'pvbot' && currentPlayer === 1) ||
    (mode === 'botvp' && currentPlayer === 2);

  const handleBoardClick = useCallback(
    (r: number, c: number) => {
      if (evaluation.isGameOver || evaluation.isBoardFull || isBotThinking) return;
      if (!isHumanTurn) return;
      if (selectedCoin === null) return;
      applyMove(r, c, selectedCoin, currentPlayer);
    },
    [
      evaluation.isGameOver,
      evaluation.isBoardFull,
      isBotThinking,
      isHumanTurn,
      selectedCoin,
      currentPlayer,
      applyMove,
    ],
  );

  useEffect(() => {
    if (evaluation.isGameOver || evaluation.isBoardFull) {
      setIsBotThinking(false);
      return;
    }

    const isBotTurn =
      (mode === 'pvbot' && currentPlayer === 2) ||
      (mode === 'botvp' && currentPlayer === 1) ||
      (mode === 'botvbot' && isAutoPlaying);

    if (!isBotTurn) {
      setIsBotThinking(false);
      return;
    }

    if (mode !== 'botvbot') {
      setIsBotThinking(true);
    }
    const delayMs = mode === 'botvbot' ? botSpeedMs : 450;

    const timer = setTimeout(() => {
      const botPick = chooseBotMove(board, { rule, varyPlay: true });
      setIsBotThinking(false);
      if (botPick) {
        applyMove(botPick.r, botPick.c, botPick.value, currentPlayer);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [
    mode,
    rule,
    currentPlayer,
    isAutoPlaying,
    botSpeedMs,
    evaluation.isGameOver,
    evaluation.isBoardFull,
    board,
    applyMove,
  ]);

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
      const num = e.key === '0' ? 10 : Number(e.key);
      if (Number.isInteger(num) && num >= 1 && num <= n) {
        if ((remainingCoins[num] ?? 0) > 0) {
          setSelectedCoin(num);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [n, remainingCoins]);

  const canUndo =
    history.length > 0 &&
    !isBotThinking &&
    !(mode === 'botvp' && currentPlayer === 2 && history.length < 2);

  function handleUndo() {
    if (!canUndo) return;
    if (mode === 'botvbot') {
      setIsAutoPlaying(false);
    }
    let steps = 1;
    if (mode === 'pvbot' && history.length >= 2 && currentPlayer === 1) {
      steps = 2;
    } else if (mode === 'botvp' && history.length >= 2 && currentPlayer === 2) {
      steps = 2;
    }
    const targetIdx = Math.max(0, history.length - steps);
    const snap = history[targetIdx];
    setBoard(snap.board);
    setCurrentPlayer(snap.currentPlayer);
    setMoves(snap.moves);
    setHistory(history.slice(0, targetIdx));
  }

  function stepZoom(delta: number) {
    const base = zoomMode === 'fit' ? fitZoom : manualZoom;
    const next = Math.max(0.4, Math.min(1.6, Math.round((base + delta) * 10) / 10));
    setZoomMode('manual');
    setManualZoom(next);
  }

  const playerText = (p: PlayerId) => {
    if (mode === 'botvbot') return p === 1 ? 'BOT 1 (WHITE)' : 'BOT 2 (BLACK)';
    if (mode === 'pvbot') return p === 1 ? 'P1 (WHITE)' : 'BOT (BLACK)';
    if (mode === 'botvp') return p === 1 ? 'BOT (WHITE)' : 'P2 (BLACK)';
    return p === 1 ? 'P1 (WHITE)' : 'P2 (BLACK)';
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-white text-black dark:bg-black dark:text-white font-mono flex flex-col">
      {/* Minimal Header */}
      <header className="shrink-0 border-b border-black bg-white dark:border-white dark:bg-black px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 shrink-0">
          <Logo className="h-7 w-7 shrink-0" />
          <span className="text-sm font-bold tracking-tight whitespace-nowrap shrink-0">
            LINELIMIT 45
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Zoom Controls */}
          <div className="flex items-center border border-black dark:border-white">
            <button
              type="button"
              onClick={() => stepZoom(-0.1)}
              aria-label="Zoom out"
              className="px-2 py-1 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-900 border-r border-black dark:border-white whitespace-nowrap shrink-0"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => setZoomMode('fit')}
              title="Fit game to screen"
              className={`px-2.5 py-1 text-[11px] font-semibold tabular-nums whitespace-nowrap shrink-0 border-r border-black dark:border-white ${
                zoomMode === 'fit'
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-white text-black hover:bg-neutral-100 dark:bg-black dark:text-white dark:hover:bg-neutral-900'
              }`}
            >
              FIT {Math.round(effectiveZoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => stepZoom(0.1)}
              aria-label="Zoom in"
              className="px-2 py-1 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-900 whitespace-nowrap shrink-0"
            >
              +
            </button>
          </div>

          <PWAInstallButton />

          <button
            type="button"
            disabled={isUpdating}
            onClick={() => void checkAndUpdate()}
            title="Check for the latest version and reload"
            className={`border border-black dark:border-white px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 disabled:opacity-50 ${
              needRefresh
                ? 'bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200'
                : 'bg-white text-black hover:bg-neutral-100 dark:bg-black dark:text-white dark:hover:bg-neutral-900'
            }`}
          >
            {isUpdating ? 'UPDATING…' : needRefresh ? 'UPDATE •' : 'UPDATE'}
          </button>

          <button
            type="button"
            onClick={() => startNewGame(n, mode)}
            className="border border-black bg-black px-3 py-1 text-xs font-semibold text-white hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 whitespace-nowrap shrink-0"
          >
            NEW
          </button>
        </div>
      </header>

      {/* Minimal Controls Strip */}
      <div className="shrink-0 border-b border-black/20 bg-neutral-50 dark:border-white/25 dark:bg-neutral-950 px-4 py-2 flex flex-wrap items-center justify-center gap-3 text-[11px]">
        {/* Size list selector (4 to 12) */}
        <label className="flex items-center gap-1.5 border border-black bg-white dark:border-white dark:bg-black px-2 py-1">
          <span className="font-semibold text-neutral-600 dark:text-neutral-400">SIZE</span>
          <select
            aria-label="Board size"
            value={n}
            onChange={(e) => startNewGame(Number(e.target.value), mode)}
            className="bg-transparent font-bold tabular-nums text-black dark:text-white focus:outline-none cursor-pointer"
          >
            {BOARD_SIZES.map((size) => (
              <option
                key={size}
                value={size}
                className="bg-white text-black dark:bg-black dark:text-white"
              >
                {size}×{size}
              </option>
            ))}
          </select>
        </label>

        {/* Play rule selector: Adversarial (v) vs Cooperative (&) */}
        <div
          role="group"
          aria-label="Play rule"
          className="flex items-center border border-black bg-white dark:border-white dark:bg-black"
        >
          <button
            type="button"
            title="Adversarial: force opponent to violate"
            aria-pressed={rule === 'adv'}
            onClick={() => startNewGame(n, mode, 'adv')}
            className={`px-2.5 py-1 font-semibold border-r border-black/30 dark:border-white/30 whitespace-nowrap shrink-0 ${
              rule === 'adv'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-black hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-900'
            }`}
          >
            ADV
          </button>
          <button
            type="button"
            title="Co-op: work together to fill the board"
            aria-pressed={rule === 'coop'}
            onClick={() => startNewGame(n, mode, 'coop')}
            className={`px-2.5 py-1 font-semibold whitespace-nowrap shrink-0 ${
              rule === 'coop'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-black hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-900'
            }`}
          >
            CO-OP
          </button>
        </div>

        {/* Opponent mode selector */}
        <div className="flex items-center border border-black bg-white dark:border-white dark:bg-black">
          <button
            type="button"
            onClick={() => startNewGame(n, 'pvp', rule)}
            className={`px-2.5 py-1 font-semibold border-r border-black/30 dark:border-white/30 whitespace-nowrap shrink-0 ${
              mode === 'pvp'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-black hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-900'
            }`}
          >
            P {rule === 'coop' ? '&' : 'v'} P
          </button>
          <button
            type="button"
            onClick={() => startNewGame(n, 'pvbot', rule)}
            className={`px-2.5 py-1 font-semibold border-r border-black/30 dark:border-white/30 whitespace-nowrap shrink-0 ${
              mode === 'pvbot'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-black hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-900'
            }`}
          >
            P {rule === 'coop' ? '&' : 'v'} BOT
          </button>
          <button
            type="button"
            onClick={() => startNewGame(n, 'botvp', rule)}
            className={`px-2.5 py-1 font-semibold border-r border-black/30 dark:border-white/30 whitespace-nowrap shrink-0 ${
              mode === 'botvp'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-black hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-900'
            }`}
          >
            BOT {rule === 'coop' ? '&' : 'v'} P
          </button>
          <button
            type="button"
            onClick={() => startNewGame(n, 'botvbot', rule)}
            className={`px-2.5 py-1 font-semibold whitespace-nowrap shrink-0 ${
              mode === 'botvbot'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-black hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-900'
            }`}
          >
            BOT {rule === 'coop' ? '&' : 'v'} BOT
          </button>
        </div>

        {/* Bot vs Bot Play/Pause & Speed */}
        {mode === 'botvbot' && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={evaluation.isGameOver || evaluation.isBoardFull}
              onClick={() => setIsAutoPlaying((p) => !p)}
              aria-pressed={isAutoPlaying}
              className={`border border-black dark:border-white px-2.5 py-1 font-semibold whitespace-nowrap shrink-0 disabled:opacity-35 disabled:cursor-not-allowed ${
                isAutoPlaying
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-white text-black hover:bg-neutral-100 dark:bg-black dark:text-white dark:hover:bg-neutral-900'
              }`}
            >
              {isAutoPlaying ? 'PAUSE' : 'PLAY'}
            </button>

            <label className="flex items-center gap-1.5 border border-black bg-white dark:border-white dark:bg-black px-2 py-1">
              <span className="font-semibold text-neutral-600 dark:text-neutral-400">SPEED</span>
              <select
                aria-label="Bot move speed"
                value={botSpeedMs}
                onChange={(e) => setBotSpeedMs(Number(e.target.value))}
                className="bg-transparent font-bold tabular-nums text-black dark:text-white focus:outline-none cursor-pointer"
              >
                {BOT_SPEED_OPTIONS.map((opt) => (
                  <option
                    key={opt.ms}
                    value={opt.ms}
                    className="bg-white text-black dark:bg-black dark:text-white"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* Light (black on white) / Dark (white on black) mode selector */}
        <div
          role="group"
          aria-label="Display theme"
          className="flex items-center border border-black bg-white dark:border-white dark:bg-black"
        >
          <button
            type="button"
            title="Light mode (black on white)"
            aria-pressed={theme === 'light'}
            onClick={() => setTheme('light')}
            className={`px-2.5 py-1 font-semibold border-r border-black/30 dark:border-white/30 whitespace-nowrap shrink-0 ${
              theme === 'light'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-black hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-900'
            }`}
          >
            LIGHT
          </button>
          <button
            type="button"
            title="Dark mode (white on black)"
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme('dark')}
            className={`px-2.5 py-1 font-semibold whitespace-nowrap shrink-0 ${
              theme === 'dark'
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'text-black hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-900'
            }`}
          >
            DARK
          </button>
        </div>

        {/* Utility buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="border border-black bg-white text-black px-2.5 py-1 font-semibold hover:bg-neutral-100 dark:border-white dark:bg-black dark:text-white dark:hover:bg-neutral-900 disabled:opacity-35 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            UNDO
          </button>
          <button
            type="button"
            onClick={() => setShowSafetyHints((s) => !s)}
            aria-pressed={showSafetyHints}
            className={`border border-black dark:border-white px-2.5 py-1 font-semibold whitespace-nowrap shrink-0 ${
              showSafetyHints
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-white text-black hover:bg-neutral-100 dark:bg-black dark:text-white dark:hover:bg-neutral-900'
            }`}
          >
            HINTS
          </button>
        </div>
      </div>

      {/* Zoomable Main Game Stage */}
      <main
        ref={viewportRef}
        className="flex-1 overflow-auto flex items-start justify-center p-3"
      >
        <div
          style={{
            width: `${baseStageWidth * effectiveZoom}px`,
            height: `${stageHeight * effectiveZoom}px`,
          }}
          className="relative shrink-0"
        >
          <div
            ref={stageRef}
            style={{
              width: `${baseStageWidth}px`,
              transform: `scale(${effectiveZoom})`,
              transformOrigin: 'top left',
            }}
            className="flex flex-col"
          >
            {/* Status Line */}
            <div className="mb-2.5 flex items-center justify-between gap-2 border border-black dark:border-white px-3 py-2 text-xs">
              {evaluation.isGameOver && winner !== null && loser !== null ? (
                <>
                  <span className="font-bold">
                    {rule === 'coop'
                      ? `TEAM LOST — ${playerText(loser)} VIOLATED (${evaluation.totalWinnings} PTS)`
                      : `${playerText(winner)} WINS ${evaluation.totalWinnings} PTS (${playerText(loser)} VIOLATED)`}
                  </span>
                  <button
                    type="button"
                    onClick={() => startNewGame(n, mode, rule)}
                    className="border border-black bg-black px-2.5 py-0.5 text-[11px] font-bold text-white hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 whitespace-nowrap shrink-0"
                  >
                    AGAIN
                  </button>
                </>
              ) : evaluation.isBoardFull ? (
                <>
                  <span className="font-bold">
                    {rule === 'coop' ? 'BOARD FULL — TEAM WINS!' : 'BOARD FULL — DRAW'}
                  </span>
                  <button
                    type="button"
                    onClick={() => startNewGame(n, mode, rule)}
                    className="border border-black bg-black px-2.5 py-0.5 text-[11px] font-bold text-white dark:border-white dark:bg-white dark:text-black whitespace-nowrap shrink-0"
                  >
                    AGAIN
                  </button>
                </>
              ) : (
                <>
                  <span className="font-bold">
                    {isBotThinking
                      ? 'BOT THINKING…'
                      : mode === 'botvbot' && !isAutoPlaying
                        ? `PAUSED · ${playerText(currentPlayer)}`
                        : `TURN: ${playerText(currentPlayer)}`}
                  </span>
                  <span className="text-neutral-600 dark:text-neutral-400 tabular-nums">
                    PLY {moves.length + 1} · {safeMoves.length} SAFE
                    {rule === 'coop' && deadCellCount > 0 ? ` · ${deadCellCount} KO` : ''}
                  </span>
                </>
              )}
            </div>

            {/* Game Board */}
            <GameBoard
              board={board}
              selectedCoin={selectedCoin}
              remainingCountForSelected={selectedCoin ? remainingCoins[selectedCoin] ?? 0 : 0}
              evaluation={evaluation}
              showSafetyHints={showSafetyHints}
              disabled={isBotThinking || !isHumanTurn}
              lastMoveCoord={lastMoveCoord}
              onPlaceCoin={handleBoardClick}
            />

            {/* Coin Selection Tray */}
            <CoinTray
              n={n}
              remainingCoins={remainingCoins}
              selectedCoin={selectedCoin}
              disabled={
                evaluation.isGameOver ||
                evaluation.isBoardFull ||
                isBotThinking ||
                (mode === 'botvbot' ? isAutoPlaying : !isHumanTurn)
              }
              onSelectCoin={(val) => setSelectedCoin(val)}
            />

            {/* Violation Proof or Two-Line Rule */}
            {evaluation.isGameOver ? (
              <div className="mt-3 border border-black bg-neutral-100 dark:border-white dark:bg-neutral-950 px-3 py-2 text-[11px] space-y-1">
                {evaluation.violatingCoins.map((vc) => (
                  <div key={`${vc.r},${vc.c}`} className="flex justify-between gap-2 tabular-nums">
                    <span className="font-bold">COIN [{vc.value}]</span>
                    <span className="text-neutral-700 dark:text-neutral-300">
                      {vc.lines
                        .map((l) => `${l.lineLabel}: ${l.countLeq} ≤ ${vc.value}`)
                        .join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            ) : rule === 'coop' ? (
              <p className="mt-3 text-[11px] leading-snug text-neutral-600 dark:text-neutral-400 text-center">
                Co-op: team wins by filling the board with count(≤ v) ≤ v on all 45° lines.
                <br />
                Team loses if any coin violates; keep every cell alive (0 KO).
              </p>
            ) : (
              <p className="mt-3 text-[11px] leading-snug text-neutral-600 dark:text-neutral-400 text-center">
                Lose if any 45° line has a coin v with count(≤ v) &gt; v.
                <br />
                Winner scores sum of violating coins.
              </p>
            )}

            <p className="mt-2 text-center text-[10px] tracking-wide text-neutral-500 dark:text-neutral-400 tabular-nums">
              Version v{__APP_VERSION__}
            </p>
          </div>
        </div>
      </main>
      <OfflineIndicator />
    </div>
  );
}
