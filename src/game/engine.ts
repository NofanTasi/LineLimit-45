export type PlayerId = 1 | 2;

export interface PlacedCoin {
  value: number;
  placedBy: PlayerId;
  moveIndex: number;
}

export type BoardCell = PlacedCoin | null;
export type BoardState = BoardCell[][];

export type LineKind = 'row' | 'col' | 'diagDown' | 'diagUp';

export interface BoardCoord {
  r: number;
  c: number;
}

export interface BoardLine {
  id: string;
  label: string;
  kind: LineKind;
  cells: BoardCoord[];
}

export interface ViolatingCoinDetail {
  r: number;
  c: number;
  value: number;
  placedBy: PlayerId;
  lines: {
    lineId: string;
    lineLabel: string;
    countLeq: number;
  }[];
}

export interface LineRiskInfo {
  lineId: string;
  lineLabel: string;
  kind: LineKind;
  cells: BoardCoord[];
  coins: { r: number; c: number; value: number }[];
  hasViolation: boolean;
  tightestMargin: number; // min(coin.value - countLeq); 0 = on edge, <0 = violated
  tightestValue: number | null;
}

export interface BoardEvaluation {
  isGameOver: boolean;
  violatingCoins: ViolatingCoinDetail[];
  violatingLines: LineRiskInfo[];
  occupiedLines: LineRiskInfo[];
  totalWinnings: number;
  isBoardFull: boolean;
}

export interface MoveRecord {
  moveIndex: number;
  player: PlayerId;
  r: number;
  c: number;
  coordLabel: string;
  value: number;
  causedLoss: boolean;
  winningsIfLost: number;
}

export interface SafeMoveOption {
  r: number;
  c: number;
  value: number;
  coordLabel: string;
  minMarginAfter: number;
}

export interface PositionAnalysis {
  safeMoveCount: number;
  losingMoveCount: number;
  totalLegalMoves: number;
  outcome: 'N' | 'P' | 'DRAW' | 'UNKNOWN';
  nimber: number | null;
  confidence: 'EXACT' | 'HEURISTIC';
  winningMoves: SafeMoveOption[];
  explanation: string;
  nodesSearched: number;
}

export function createEmptyBoard(n: number): BoardState {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => null));
}

export function cloneBoard(board: BoardState): BoardState {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function formatCoord(r: number, c: number): string {
  const colChar = String.fromCharCode(65 + c);
  return `${colChar}${r + 1}`;
}

export function getAllLines(n: number): BoardLine[] {
  const lines: BoardLine[] = [];

  // Rows (0 deg)
  for (let r = 0; r < n; r++) {
    const cells: BoardCoord[] = [];
    for (let c = 0; c < n; c++) cells.push({ r, c });
    lines.push({ id: `row-${r}`, label: `Row ${r + 1}`, kind: 'row', cells });
  }

  // Columns (90 deg)
  for (let c = 0; c < n; c++) {
    const cells: BoardCoord[] = [];
    for (let r = 0; r < n; r++) cells.push({ r, c });
    lines.push({
      id: `col-${c}`,
      label: `Col ${c + 1}`,
      kind: 'col',
      cells,
    });
  }

  // Down-right diagonals (-45 deg): r - c = k
  for (let k = -(n - 2); k <= n - 2; k++) {
    const cells: BoardCoord[] = [];
    for (let r = 0; r < n; r++) {
      const c = r - k;
      if (c >= 0 && c < n) cells.push({ r, c });
    }
    if (cells.length >= 2) {
      lines.push({
        id: `diagDown-${k}`,
        label: `Diag \\`,
        kind: 'diagDown',
        cells,
      });
    }
  }

  // Up-right diagonals (+45 deg): r + c = s
  for (let s = 1; s <= 2 * n - 3; s++) {
    const cells: BoardCoord[] = [];
    for (let r = 0; r < n; r++) {
      const c = s - r;
      if (c >= 0 && c < n) cells.push({ r, c });
    }
    if (cells.length >= 2) {
      lines.push({
        id: `diagUp-${s}`,
        label: `Diag /`,
        kind: 'diagUp',
        cells,
      });
    }
  }

  return lines;
}

export function getLinesThroughCell(n: number, r: number, c: number): BoardLine[] {
  const lines: BoardLine[] = [];

  const rowCells: BoardCoord[] = [];
  for (let cc = 0; cc < n; cc++) rowCells.push({ r, c: cc });
  lines.push({ id: `row-${r}`, label: `Row ${r + 1}`, kind: 'row', cells: rowCells });

  const colCells: BoardCoord[] = [];
  for (let rr = 0; rr < n; rr++) colCells.push({ r: rr, c });
  lines.push({
    id: `col-${c}`,
    label: `Col ${String.fromCharCode(65 + c)}`,
    kind: 'col',
    cells: colCells,
  });

  const k = r - c;
  const d1Cells: BoardCoord[] = [];
  for (let rr = 0; rr < n; rr++) {
    const cc = rr - k;
    if (cc >= 0 && cc < n) d1Cells.push({ r: rr, c: cc });
  }
  if (d1Cells.length >= 2) {
    lines.push({
      id: `diagDown-${k}`,
      label: `Diag \\`,
      kind: 'diagDown',
      cells: d1Cells,
    });
  }

  const s = r + c;
  const d2Cells: BoardCoord[] = [];
  for (let rr = 0; rr < n; rr++) {
    const cc = s - rr;
    if (cc >= 0 && cc < n) d2Cells.push({ r: rr, c: cc });
  }
  if (d2Cells.length >= 2) {
    lines.push({
      id: `diagUp-${s}`,
      label: `Diag /`,
      kind: 'diagUp',
      cells: d2Cells,
    });
  }

  return lines;
}

export function getRemainingCoins(board: BoardState): Record<number, number> {
  const n = board.length;
  const counts: Record<number, number> = {};
  for (let v = 1; v <= n; v++) counts[v] = n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = board[r][c];
      if (cell) {
        counts[cell.value] = Math.max(0, (counts[cell.value] ?? n) - 1);
      }
    }
  }
  return counts;
}

export function evaluateBoard(board: BoardState): BoardEvaluation {
  const n = board.length;
  const lines = getAllLines(n);
  const coinViolationMap = new Map<string, ViolatingCoinDetail>();
  const violatingLines: LineRiskInfo[] = [];
  const occupiedLines: LineRiskInfo[] = [];

  let emptyCells = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!board[r][c]) emptyCells++;
    }
  }

  for (const line of lines) {
    const coins: { r: number; c: number; value: number; placedBy: PlayerId }[] = [];
    for (const pt of line.cells) {
      const cell = board[pt.r][pt.c];
      if (cell) {
        coins.push({ r: pt.r, c: pt.c, value: cell.value, placedBy: cell.placedBy });
      }
    }
    if (coins.length === 0) continue;

    let hasViolation = false;
    let tightestMargin = Infinity;
    let tightestValue: number | null = null;

    for (const coin of coins) {
      let countLeq = 0;
      for (const other of coins) {
        if (other.value <= coin.value) countLeq++;
      }
      const margin = coin.value - countLeq;
      if (margin < tightestMargin) {
        tightestMargin = margin;
        tightestValue = coin.value;
      }
      if (countLeq > coin.value) {
        hasViolation = true;
        const key = `${coin.r},${coin.c}`;
        let detail = coinViolationMap.get(key);
        if (!detail) {
          detail = {
            r: coin.r,
            c: coin.c,
            value: coin.value,
            placedBy: coin.placedBy,
            lines: [],
          };
          coinViolationMap.set(key, detail);
        }
        detail.lines.push({
          lineId: line.id,
          lineLabel: line.label,
          countLeq,
        });
      }
    }

    const lineInfo: LineRiskInfo = {
      lineId: line.id,
      lineLabel: line.label,
      kind: line.kind,
      cells: line.cells,
      coins: coins.map(({ r, c, value }) => ({ r, c, value })),
      hasViolation,
      tightestMargin,
      tightestValue,
    };

    occupiedLines.push(lineInfo);
    if (hasViolation) {
      violatingLines.push(lineInfo);
    }
  }

  const violatingCoins = Array.from(coinViolationMap.values());
  const totalWinnings = violatingCoins.reduce((sum, c) => sum + c.value, 0);

  occupiedLines.sort((a, b) => a.tightestMargin - b.tightestMargin);

  return {
    isGameOver: violatingCoins.length > 0,
    violatingCoins,
    violatingLines,
    occupiedLines,
    totalWinnings,
    isBoardFull: emptyCells === 0,
  };
}

function inspectCellLinesNumeric(
  grid: number[][],
  n: number,
  r: number,
  c: number,
): { safe: boolean; totalWinningsIfLost: number; minMarginAfter: number } {
  const seenViolations = new Map<number, number>();
  let minMarginAfter = Infinity;

  const inspectLine = (coords: { rr: number; cc: number }[]) => {
    if (coords.length === 0) return;
    for (let i = 0; i < coords.length; i++) {
      const a = coords[i];
      const va = grid[a.rr][a.cc];
      let countLeq = 0;
      for (let j = 0; j < coords.length; j++) {
        const b = coords[j];
        if (grid[b.rr][b.cc] <= va) countLeq++;
      }
      const margin = va - countLeq;
      if (margin < minMarginAfter) minMarginAfter = margin;
      if (countLeq > va) {
        seenViolations.set(a.rr * n + a.cc, va);
      }
    }
  };

  // Row r
  const rowCoins: { rr: number; cc: number }[] = [];
  for (let cc = 0; cc < n; cc++) if (grid[r][cc] > 0) rowCoins.push({ rr: r, cc });
  inspectLine(rowCoins);

  // Col c
  const colCoins: { rr: number; cc: number }[] = [];
  for (let rr = 0; rr < n; rr++) if (grid[rr][c] > 0) colCoins.push({ rr, cc: c });
  inspectLine(colCoins);

  // Diag down (r - c)
  const k = r - c;
  const d1Coins: { rr: number; cc: number }[] = [];
  for (let rr = 0; rr < n; rr++) {
    const cc = rr - k;
    if (cc >= 0 && cc < n && grid[rr][cc] > 0) d1Coins.push({ rr, cc });
  }
  if (d1Coins.length > 1) inspectLine(d1Coins);

  // Diag up (r + c)
  const s = r + c;
  const d2Coins: { rr: number; cc: number }[] = [];
  for (let rr = 0; rr < n; rr++) {
    const cc = s - rr;
    if (cc >= 0 && cc < n && grid[rr][cc] > 0) d2Coins.push({ rr, cc });
  }
  if (d2Coins.length > 1) inspectLine(d2Coins);

  let totalWinningsIfLost = 0;
  for (const val of seenViolations.values()) totalWinningsIfLost += val;

  return {
    safe: seenViolations.size === 0,
    totalWinningsIfLost,
    minMarginAfter: minMarginAfter === Infinity ? grid[r][c] - 1 : minMarginAfter,
  };
}

export function checkMoveSafety(
  board: BoardState,
  r: number,
  c: number,
  value: number,
): { safe: boolean; totalWinningsIfLost: number; minMarginAfter: number } {
  const n = board.length;
  const grid = board.map((row) => row.map((cell) => (cell ? cell.value : 0)));
  grid[r][c] = value;
  return inspectCellLinesNumeric(grid, n, r, c);
}

export function getAllSafeAndLosingMoves(board: BoardState): {
  safeMoves: SafeMoveOption[];
  losingMoves: { r: number; c: number; value: number; coordLabel: string; lossWinnings: number }[];
} {
  const n = board.length;
  const remaining = getRemainingCoins(board);
  const grid = board.map((row) => row.map((cell) => (cell ? cell.value : 0)));
  const safeMoves: SafeMoveOption[] = [];
  const losingMoves: {
    r: number;
    c: number;
    value: number;
    coordLabel: string;
    lossWinnings: number;
  }[] = [];

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] !== 0) continue;
      const coordLabel = formatCoord(r, c);
      for (let v = 1; v <= n; v++) {
        if ((remaining[v] ?? 0) <= 0) continue;
        grid[r][c] = v;
        const check = inspectCellLinesNumeric(grid, n, r, c);
        grid[r][c] = 0;
        if (check.safe) {
          safeMoves.push({ r, c, value: v, coordLabel, minMarginAfter: check.minMarginAfter });
        } else {
          losingMoves.push({
            r,
            c,
            value: v,
            coordLabel,
            lossWinnings: check.totalWinningsIfLost,
          });
        }
      }
    }
  }

  return { safeMoves, losingMoves };
}

// Fast numeric board encoding for solver memoization (ignores placedBy since game is impartial)
function encodeNumericBoard(grid: number[][], remaining: number[]): string {
  return grid.map((row) => row.join(',')).join(';') + '|' + remaining.slice(1).join(',');
}

function hasViolationNumeric(grid: number[][], n: number): boolean {
  // Check rows
  for (let r = 0; r < n; r++) {
    const vals: number[] = [];
    for (let c = 0; c < n; c++) {
      if (grid[r][c] > 0) vals.push(grid[r][c]);
    }
    if (vals.length > 1 && lineViolates(vals)) return true;
  }
  // Check cols
  for (let c = 0; c < n; c++) {
    const vals: number[] = [];
    for (let r = 0; r < n; r++) {
      if (grid[r][c] > 0) vals.push(grid[r][c]);
    }
    if (vals.length > 1 && lineViolates(vals)) return true;
  }
  // Down-right diagonals
  for (let k = -(n - 2); k <= n - 2; k++) {
    const vals: number[] = [];
    for (let r = 0; r < n; r++) {
      const c = r - k;
      if (c >= 0 && c < n && grid[r][c] > 0) vals.push(grid[r][c]);
    }
    if (vals.length > 1 && lineViolates(vals)) return true;
  }
  // Up-right diagonals
  for (let s = 1; s <= 2 * n - 3; s++) {
    const vals: number[] = [];
    for (let r = 0; r < n; r++) {
      const c = s - r;
      if (c >= 0 && c < n && grid[r][c] > 0) vals.push(grid[r][c]);
    }
    if (vals.length > 1 && lineViolates(vals)) return true;
  }
  return false;
}

function lineViolates(vals: number[]): boolean {
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    let count = 0;
    for (let j = 0; j < vals.length; j++) {
      if (vals[j] <= v) count++;
    }
    if (count > v) return true;
  }
  return false;
}

function cellLinesViolate(grid: number[][], n: number, r: number, c: number): boolean {
  // Row r
  const rowVals: number[] = [];
  for (let cc = 0; cc < n; cc++) if (grid[r][cc] > 0) rowVals.push(grid[r][cc]);
  if (rowVals.length > 1 && lineViolates(rowVals)) return true;

  // Col c
  const colVals: number[] = [];
  for (let rr = 0; rr < n; rr++) if (grid[rr][c] > 0) colVals.push(grid[rr][c]);
  if (colVals.length > 1 && lineViolates(colVals)) return true;

  // Diag down (r - c)
  const k = r - c;
  const d1Vals: number[] = [];
  for (let rr = 0; rr < n; rr++) {
    const cc = rr - k;
    if (cc >= 0 && cc < n && grid[rr][cc] > 0) d1Vals.push(grid[rr][cc]);
  }
  if (d1Vals.length > 1 && lineViolates(d1Vals)) return true;

  // Diag up (r + c)
  const s = r + c;
  const d2Vals: number[] = [];
  for (let rr = 0; rr < n; rr++) {
    const cc = s - rr;
    if (cc >= 0 && cc < n && grid[rr][cc] > 0) d2Vals.push(grid[rr][cc]);
  }
  if (d2Vals.length > 1 && lineViolates(d2Vals)) return true;

  return false;
}

export function analyzePosition(board: BoardState, nodeBudget = 22000): PositionAnalysis {
  const n = board.length;
  const evalNow = evaluateBoard(board);
  const { safeMoves, losingMoves } = getAllSafeAndLosingMoves(board);

  if (evalNow.isGameOver) {
    return {
      safeMoveCount: 0,
      losingMoveCount: losingMoves.length,
      totalLegalMoves: safeMoves.length + losingMoves.length,
      outcome: 'P',
      nimber: 0,
      confidence: 'EXACT',
      winningMoves: [],
      explanation: 'A 45° line violation has already occurred.',
      nodesSearched: 1,
    };
  }

  if (evalNow.isBoardFull) {
    return {
      safeMoveCount: 0,
      losingMoveCount: 0,
      totalLegalMoves: 0,
      outcome: 'DRAW',
      nimber: 0,
      confidence: 'EXACT',
      winningMoves: [],
      explanation: 'Board is completely filled without any line violation.',
      nodesSearched: 1,
    };
  }

  if (safeMoves.length === 0) {
    return {
      safeMoveCount: 0,
      losingMoveCount: losingMoves.length,
      totalLegalMoves: losingMoves.length,
      outcome: 'P',
      nimber: 0,
      confidence: 'EXACT',
      winningMoves: [],
      explanation:
        'Zero safe moves remain (P-position). Any coin placed by the current player triggers a violation and loses.',
      nodesSearched: 1,
    };
  }

  const grid = board.map((row) => row.map((cell) => (cell ? cell.value : 0)));
  const remObj = getRemainingCoins(board);
  const remaining = Array.from({ length: n + 1 }, (_, i) => (i === 0 ? 0 : remObj[i] ?? 0));

  let emptyCount = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] === 0) emptyCount++;
    }
  }

  // Exact Nimber / P-N search if small enough
  let nodes = 0;
  let budgetExhausted = false;
  const nimberMemo = new Map<string, number>();

  function computeNimber(emptiesLeft: number): number {
    if (emptiesLeft === 0) return 0; // Full board = terminal 0
    if (nodes >= nodeBudget) {
      budgetExhausted = true;
      return -1;
    }
    const key = encodeNumericBoard(grid, remaining);
    const cached = nimberMemo.get(key);
    if (cached !== undefined) return cached;

    nodes++;
    const childNimbers = new Set<number>();

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (grid[r][c] !== 0) continue;
        for (let v = 1; v <= n; v++) {
          if (remaining[v] <= 0) continue;
          grid[r][c] = v;
          remaining[v]--;
          if (!cellLinesViolate(grid, n, r, c)) {
            const g = computeNimber(emptiesLeft - 1);
            if (g === -1) {
              grid[r][c] = 0;
              remaining[v]++;
              return -1;
            }
            childNimbers.add(g);
          }
          grid[r][c] = 0;
          remaining[v]++;
        }
      }
    }

    let mex = 0;
    while (childNimbers.has(mex)) mex++;
    nimberMemo.set(key, mex);
    return mex;
  }

  // Try exact Sprague-Grundy computation for n=2 or endgames (<= 8 empty cells)
  const canTryExactNimber = n === 2 || emptyCount <= 7;
  if (canTryExactNimber && !hasViolationNumeric(grid, n)) {
    const winningMoves: SafeMoveOption[] = [];
    const childNimbers = new Set<number>();
    let aborted = false;

    for (const move of safeMoves) {
      grid[move.r][move.c] = move.value;
      remaining[move.value]--;
      const childG = computeNimber(emptyCount - 1);
      grid[move.r][move.c] = 0;
      remaining[move.value]++;
      if (childG === -1 || budgetExhausted) {
        aborted = true;
        break;
      }
      childNimbers.add(childG);
      if (childG === 0) {
        winningMoves.push(move);
      }
    }

    if (!aborted) {
      let mex = 0;
      while (childNimbers.has(mex)) mex++;
      const outcome: 'N' | 'P' = mex > 0 ? 'N' : 'P';
      return {
        safeMoveCount: safeMoves.length,
        losingMoveCount: losingMoves.length,
        totalLegalMoves: safeMoves.length + losingMoves.length,
        outcome,
        nimber: mex,
        confidence: 'EXACT',
        winningMoves,
        explanation:
          outcome === 'N'
            ? `Exact N-position (Sprague-Grundy Nimber = ${mex}). ${winningMoves.length} winning move(s) transition to a P-position (Nimber 0).`
            : `Exact P-position (Sprague-Grundy Nimber = 0). With optimal play by the opponent, every safe move leads to an N-position.`,
        nodesSearched: nodes,
      };
    }
  }

  // Fallback for deeper boards: 2-ply trap & safe-mobility heuristic
  const rankedMoves: { move: SafeMoveOption; oppSafeCount: number; score: number }[] = [];
  const sampleMoves = safeMoves.slice(0, 64);

  for (const move of sampleMoves) {
    grid[move.r][move.c] = move.value;
    remaining[move.value]--;
    let oppSafe = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (grid[r][c] !== 0) continue;
        for (let v = 1; v <= n; v++) {
          if (remaining[v] <= 0) continue;
          grid[r][c] = v;
          if (!cellLinesViolate(grid, n, r, c)) oppSafe++;
          grid[r][c] = 0;
        }
      }
    }
    grid[move.r][move.c] = 0;
    remaining[move.value]++;
    nodes++;

    // Immediate trap if oppSafe === 0!
    const score = oppSafe === 0 ? 100000 : -oppSafe + move.minMarginAfter * 0.25;
    rankedMoves.push({ move, oppSafeCount: oppSafe, score });
  }

  rankedMoves.sort((a, b) => b.score - a.score);
  const immediateWins = rankedMoves.filter((m) => m.oppSafeCount === 0).map((m) => m.move);

  if (immediateWins.length > 0) {
    return {
      safeMoveCount: safeMoves.length,
      losingMoveCount: losingMoves.length,
      totalLegalMoves: safeMoves.length + losingMoves.length,
      outcome: 'N',
      nimber: null,
      confidence: 'EXACT',
      winningMoves: immediateWins,
      explanation: `Winning 1-move trap detected! ${immediateWins.length} safe move(s) leave the opponent with 0 safe responses.`,
      nodesSearched: nodes,
    };
  }

  return {
    safeMoveCount: safeMoves.length,
    losingMoveCount: losingMoves.length,
    totalLegalMoves: safeMoves.length + losingMoves.length,
    outcome: 'UNKNOWN',
    nimber: null,
    confidence: 'HEURISTIC',
    winningMoves: rankedMoves.slice(0, 3).map((m) => m.move),
    explanation: `${safeMoves.length} safe moves available (${losingMoves.length} losing placements avoided). Best tactical candidates minimize opponent safe mobility.`,
    nodesSearched: nodes,
  };
}

export function chooseBotMove(
  board: BoardState,
): { r: number; c: number; value: number; reasoning: string } | null {
  const { safeMoves, losingMoves } = getAllSafeAndLosingMoves(board);

  // If forced to lose, minimize the opponent's winnings!
  if (safeMoves.length === 0) {
    if (losingMoves.length === 0) return null;
    const sorted = [...losingMoves].sort((a, b) => a.lossWinnings - b.lossWinnings);
    const best = sorted[0];
    return {
      r: best.r,
      c: best.c,
      value: best.value,
      reasoning: `No safe moves remain; selected [${best.value}] at ${best.coordLabel} to minimize loss (${best.lossWinnings} pts).`,
    };
  }

  const analysis = analyzePosition(board, 18000);
  if (analysis.winningMoves.length > 0) {
    const pick = analysis.winningMoves[0];
    return {
      r: pick.r,
      c: pick.c,
      value: pick.value,
      reasoning:
        analysis.confidence === 'EXACT'
          ? `Optimal Nim move: [${pick.value}] at ${pick.coordLabel} forces a P-position.`
          : `High-pressure move: [${pick.value}] at ${pick.coordLabel} sharply restricts safe replies.`,
    };
  }

  // Otherwise pick the safe move that restricts opponent mobility most while preserving larger coins
  const n = board.length;
  const grid = board.map((row) => row.map((cell) => (cell ? cell.value : 0)));
  const remObj = getRemainingCoins(board);
  const remaining = Array.from({ length: n + 1 }, (_, i) => (i === 0 ? 0 : remObj[i] ?? 0));

  let bestMove = safeMoves[0];
  let bestScore = -Infinity;

  // Evaluate up to 48 candidate moves evenly sampled if huge
  const step = Math.max(1, Math.floor(safeMoves.length / 48));
  for (let i = 0; i < safeMoves.length; i += step) {
    const m = safeMoves[i];
    grid[m.r][m.c] = m.value;
    remaining[m.value]--;
    let oppSafe = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (grid[r][c] !== 0) continue;
        for (let v = 1; v <= n; v++) {
          if (remaining[v] <= 0) continue;
          grid[r][c] = v;
          if (!cellLinesViolate(grid, n, r, c)) oppSafe++;
          grid[r][c] = 0;
        }
      }
    }
    grid[m.r][m.c] = 0;
    remaining[m.value]++;

    // Odd safe replies remaining can be subtly favorable when parity matters; restricting oppSafe is key
    const centerDist = Math.abs(m.r - (n - 1) / 2) + Math.abs(m.c - (n - 1) / 2);
    const score = (oppSafe === 0 ? 10000 : -oppSafe) + m.value * 0.15 - centerDist * 0.1;
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  return {
    r: bestMove.r,
    c: bestMove.c,
    value: bestMove.value,
    reasoning: `Placed [${bestMove.value}] at ${bestMove.coordLabel} to tighten 45° line capacity.`,
  };
}
