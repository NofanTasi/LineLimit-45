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
  violatedThreshold: number | null;
  thresholdCount: number;
  thresholdSum: number;
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
    label: `Col ${c + 1}`,
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

/**
 * Constructs an incremental n x n Latin square (1-based coin values 1..n)
 * from Duponcheel & Duponcheel ("Cyclic n x n Latin squares representing
 * solutions of (n,c)-coins problems for 0 <= c <= n") for any n >= 4.
 * Every incremental Latin square fills the entire n x n board with zero violations.
 */
export function getIncrementalLatinSquare(n: number): number[][] | null {
  if (n < 4) return null;

  if (n === 4) {
    // Non-cyclic witness L^4 (Appendix B, shifted +1 to coin values 1..4)
    return [
      [3, 1, 2, 4],
      [2, 4, 3, 1],
      [1, 3, 4, 2],
      [4, 2, 1, 3],
    ];
  }

  if (n === 6) {
    // Non-cyclic witness L^6 (Appendix B, shifted +1 to coin values 1..6)
    return [
      [2, 1, 3, 4, 6, 5],
      [4, 2, 5, 1, 3, 6],
      [5, 4, 6, 3, 2, 1],
      [1, 3, 2, 6, 5, 4],
      [3, 6, 1, 5, 4, 2],
      [6, 5, 4, 2, 1, 3],
    ];
  }

  let p: number[];
  const mod6 = n % 6;

  if (n === 8) {
    p = [0, 4, 1, 3, 6, 2, 7, 5];
  } else if (n === 9) {
    p = [0, 6, 3, 1, 8, 5, 2, 4, 7];
  } else if (n === 15) {
    p = [0, 3, 6, 9, 12, 8, 5, 2, 13, 1, 4, 7, 10, 14, 11];
  } else if (n === 21) {
    p = [0, 18, 15, 12, 9, 6, 3, 7, 4, 1, 14, 17, 10, 16, 2, 5, 11, 8, 20, 13, 19];
  } else if (mod6 === 1 || mod6 === 5) {
    // Family F_1: p_1(j) = (-2j) mod n
    p = Array.from({ length: n }, (_, j) => ((-2 * j) % n + n) % n);
  } else if (mod6 === 2 || mod6 === 4) {
    // Family F_2: n = 2m >= 10
    const m = n / 2;
    p = Array.from({ length: n }, (_, j) =>
      j < m ? (2 * j + m + 1) % n : (2 * (j - m) + m + 4) % n,
    );
  } else if (mod6 === 3) {
    // Family F_3: n = 3k >= 27
    const k = n / 3;
    p = Array.from({ length: n }, (_, j) => {
      const u = Math.floor(j / k);
      return (3 * j + 2 * k + 4 * u) % n;
    });
  } else {
    // Family F_4: n = 0 mod 6, n = 2m >= 12
    const m = n / 2;
    p = Array.from({ length: n }, (_, j) => {
      if (j === 0) return n - 2;
      if (j <= m - 3) return 2 * j + 2;
      if (j === m - 2) return 0;
      if (j <= n - 2) return 2 * (j - m + 1) + 1;
      return 2;
    });
  }

  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => ((i + p[j]) % n) + 1),
  );
}

const symmetryCache = new Map<number, number[][][]>();

/**
 * Returns the distinct dihedral (D4) spatial symmetries of the canonical
 * incremental Latin square L^n. All 8 symmetries preserve rows, columns,
 * sum-diagonals, and diff-diagonals, so every symmetry is also a valid
 * incremental Latin square.
 */
export function getIncrementalLatinSymmetries(n: number): number[][][] {
  const cached = symmetryCache.get(n);
  if (cached) return cached;

  const base = getIncrementalLatinSquare(n);
  if (!base) return [];

  const transforms: ((r: number, c: number) => [number, number])[] = [
    (r, c) => [r, c],
    (r, c) => [c, n - 1 - r],
    (r, c) => [n - 1 - r, n - 1 - c],
    (r, c) => [n - 1 - c, r],
    (r, c) => [r, n - 1 - c],
    (r, c) => [n - 1 - r, c],
    (r, c) => [c, r],
    (r, c) => [n - 1 - c, n - 1 - r],
  ];

  const seen = new Set<string>();
  const results: number[][][] = [];
  for (const tf of transforms) {
    const sq = Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => {
        const [rr, cc] = tf(r, c);
        return base[rr][cc];
      }),
    );
    const sig = sq.map((row) => row.join(',')).join(';');
    if (!seen.has(sig)) {
      seen.add(sig);
      results.push(sq);
    }
  }
  symmetryCache.set(n, results);
  return results;
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

  const scoredCoinMap = new Map<string, number>();

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
    let maxViolatedThreshold: number | null = null;
    let maxViolatedCount = 0;

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
        if (maxViolatedThreshold === null || coin.value > maxViolatedThreshold) {
          maxViolatedThreshold = coin.value;
          maxViolatedCount = countLeq;
        }
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

    let thresholdSum = 0;
    if (maxViolatedThreshold !== null) {
      for (const coin of coins) {
        if (coin.value <= maxViolatedThreshold) {
          thresholdSum += coin.value;
          scoredCoinMap.set(`${coin.r},${coin.c}`, coin.value);
        }
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
      violatedThreshold: maxViolatedThreshold,
      thresholdCount: maxViolatedCount,
      thresholdSum,
    };

    occupiedLines.push(lineInfo);
    if (hasViolation) {
      violatingLines.push(lineInfo);
    }
  }

  const violatingCoins = Array.from(coinViolationMap.values());
  let totalWinnings = 0;
  for (const val of scoredCoinMap.values()) totalWinnings += val;

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
    let maxViolatedThreshold = -1;
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
      if (countLeq > va && va > maxViolatedThreshold) {
        maxViolatedThreshold = va;
      }
    }
    if (maxViolatedThreshold > 0) {
      for (let i = 0; i < coords.length; i++) {
        const a = coords[i];
        const va = grid[a.rr][a.cc];
        if (va <= maxViolatedThreshold) {
          seenViolations.set(a.rr * n + a.cc, va);
        }
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

/**
 * Fast lock-floor engine derived from Lemma B.1 of the paper:
 * A safe line sorted v_0 <= v_1 <= ... <= v_{r-1} (1-based) satisfies v_m >= m + 1.
 * Its zero-slack lock threshold z(L) = max({0} U {v_m : v_m = m + 1}).
 * Placing coin v on empty cell (r, c) is safe iff v > max(z(L) for L through (r, c)).
 */
interface FastEngineContext {
  n: number;
  stride: number;
  lineCount: number;
  cellLines: number[][];
  cellLineCount: number[];
  grid: Uint8Array;
  remaining: Int8Array;
  lineFreq: Int8Array;
  lineFloor: Uint8Array;
  emptyCount: number;
}

interface TopologyCache {
  lineCount: number;
  cellLines: number[][];
  cellLineCount: number[];
}

const topologyCache = new Map<number, TopologyCache>();

function getTopology(n: number): TopologyCache {
  const cached = topologyCache.get(n);
  if (cached) return cached;

  const cellLines: number[][] = Array.from({ length: n * n }, () => []);
  let lineIdx = 0;

  // Rows: 0 .. n-1
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) cellLines[r * n + c].push(lineIdx);
    lineIdx++;
  }
  // Cols: n .. 2n-1
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < n; r++) cellLines[r * n + c].push(lineIdx);
    lineIdx++;
  }
  // DiagDown (r - c = k), length >= 2
  for (let k = -(n - 2); k <= n - 2; k++) {
    for (let r = 0; r < n; r++) {
      const c = r - k;
      if (c >= 0 && c < n) cellLines[r * n + c].push(lineIdx);
    }
    lineIdx++;
  }
  // DiagUp (r + c = s), length >= 2
  for (let s = 1; s <= 2 * n - 3; s++) {
    for (let r = 0; r < n; r++) {
      const c = s - r;
      if (c >= 0 && c < n) cellLines[r * n + c].push(lineIdx);
    }
    lineIdx++;
  }

  const topo: TopologyCache = {
    lineCount: lineIdx,
    cellLines,
    cellLineCount: cellLines.map((ls) => ls.length),
  };
  topologyCache.set(n, topo);
  return topo;
}

function computeLineFloorFromFreq(
  lineFreq: Int8Array,
  lineIdx: number,
  stride: number,
  n: number,
): number {
  const base = lineIdx * stride;
  let cum = 0;
  let z = 0;
  for (let v = 1; v <= n; v++) {
    const f = lineFreq[base + v];
    cum += f;
    if (f > 0 && cum === v) z = v;
  }
  return z;
}

function createFastContext(board: BoardState): FastEngineContext | null {
  const n = board.length;
  const topo = getTopology(n);
  const stride = n + 1;
  const grid = new Uint8Array(n * n);
  const remaining = new Int8Array(stride);
  for (let v = 1; v <= n; v++) remaining[v] = n;

  const lineFreq = new Int8Array(topo.lineCount * stride);
  const lineFloor = new Uint8Array(topo.lineCount);
  let emptyCount = 0;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = board[r][c];
      const idx = r * n + c;
      if (cell) {
        const v = cell.value;
        grid[idx] = v;
        remaining[v]--;
        for (const l of topo.cellLines[idx]) {
          lineFreq[l * stride + v]++;
        }
      } else {
        emptyCount++;
      }
    }
  }

  for (let l = 0; l < topo.lineCount; l++) {
    const base = l * stride;
    let cum = 0;
    let z = 0;
    for (let v = 1; v <= n; v++) {
      const f = lineFreq[base + v];
      cum += f;
      if (f > 0 && cum > v) return null; // Board already has a violation
      if (f > 0 && cum === v) z = v;
    }
    lineFloor[l] = z;
  }

  return {
    n,
    stride,
    lineCount: topo.lineCount,
    cellLines: topo.cellLines,
    cellLineCount: topo.cellLineCount,
    grid,
    remaining,
    lineFreq,
    lineFloor,
    emptyCount,
  };
}

function getCellMinCoin(ctx: FastEngineContext, idx: number): number {
  const ls = ctx.cellLines[idx];
  let maxZ = 0;
  for (let i = 0; i < ls.length; i++) {
    const z = ctx.lineFloor[ls[i]];
    if (z > maxZ) maxZ = z;
  }
  return maxZ + 1;
}

function pushMove(ctx: FastEngineContext, idx: number, v: number, prevFloors: number[]): void {
  ctx.grid[idx] = v;
  ctx.remaining[v]--;
  ctx.emptyCount--;
  const ls = ctx.cellLines[idx];
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    prevFloors[i] = ctx.lineFloor[l];
    ctx.lineFreq[l * ctx.stride + v]++;
    ctx.lineFloor[l] = computeLineFloorFromFreq(ctx.lineFreq, l, ctx.stride, ctx.n);
  }
}

function popMove(ctx: FastEngineContext, idx: number, v: number, prevFloors: number[]): void {
  ctx.grid[idx] = 0;
  ctx.remaining[v]++;
  ctx.emptyCount++;
  const ls = ctx.cellLines[idx];
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    ctx.lineFreq[l * ctx.stride + v]--;
    ctx.lineFloor[l] = prevFloors[i];
  }
}

export interface CellHintInfo {
  minSafeCoin: number | null; // null means cell is dead (KO): no remaining coin is safe here
  selectedSafe: boolean | null; // null if no available coin is selected
  selectedWinnings: number;
}

export function getBoardCellHints(
  board: BoardState,
  selectedCoin: number | null,
): Map<string, CellHintInfo> {
  const map = new Map<string, CellHintInfo>();
  const ctx = createFastContext(board);
  if (!ctx) return map;

  const n = ctx.n;
  const hasSelected =
    selectedCoin !== null &&
    selectedCoin >= 1 &&
    selectedCoin <= n &&
    ctx.remaining[selectedCoin] > 0;

  let baseGrid: number[][] | null = null;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const idx = r * n + c;
      if (ctx.grid[idx] !== 0) continue;

      const floor = getCellMinCoin(ctx, idx);
      let minSafeCoin: number | null = null;
      for (let v = floor; v <= n; v++) {
        if (ctx.remaining[v] > 0) {
          minSafeCoin = v;
          break;
        }
      }

      let selectedSafe: boolean | null = null;
      let selectedWinnings = 0;

      if (hasSelected && selectedCoin !== null) {
        if (selectedCoin >= floor) {
          selectedSafe = true;
        } else {
          selectedSafe = false;
          if (!baseGrid) {
            baseGrid = board.map((row) => row.map((cell) => (cell ? cell.value : 0)));
          }
          baseGrid[r][c] = selectedCoin;
          selectedWinnings = inspectCellLinesNumeric(baseGrid, n, r, c).totalWinningsIfLost;
          baseGrid[r][c] = 0;
        }
      }

      map.set(`${r},${c}`, {
        minSafeCoin,
        selectedSafe,
        selectedWinnings,
      });
    }
  }

  return map;
}

export function countDeadCells(board: BoardState): number {
  const ctx = createFastContext(board);
  if (!ctx) return 0;
  let maxRem = 0;
  for (let v = ctx.n; v >= 1; v--) {
    if (ctx.remaining[v] > 0) {
      maxRem = v;
      break;
    }
  }
  let dead = 0;
  for (let idx = 0; idx < ctx.n * ctx.n; idx++) {
    if (ctx.grid[idx] !== 0) continue;
    if (getCellMinCoin(ctx, idx) > maxRem) dead++;
  }
  return dead;
}

/**
 * Counts exact total distinct safe moves (cell, v) in O(n^2) using the lock-floor theorem.
 */
function countTotalSafeMovesFast(ctx: FastEngineContext): number {
  const { n, remaining, grid } = ctx;
  // availGeq[f] = number of distinct coin values v >= f with remaining[v] > 0
  const availGeq = new Uint8Array(n + 2);
  let running = 0;
  for (let v = n; v >= 1; v--) {
    if (remaining[v] > 0) running++;
    availGeq[v] = running;
  }
  availGeq[n + 1] = 0;

  let total = 0;
  for (let idx = 0; idx < n * n; idx++) {
    if (grid[idx] !== 0) continue;
    total += availGeq[getCellMinCoin(ctx, idx)];
  }
  return total;
}

function encodeFastGrid(grid: Uint8Array): string {
  let s = '';
  for (let i = 0; i < grid.length; i++) {
    s += String.fromCharCode(48 + grid[i]);
  }
  return s;
}

export function getAllSafeAndLosingMoves(board: BoardState): {
  safeMoves: SafeMoveOption[];
  losingMoves: { r: number; c: number; value: number; coordLabel: string; lossWinnings: number }[];
} {
  const n = board.length;
  const remaining = getRemainingCoins(board);
  const ctx = createFastContext(board);
  const safeMoves: SafeMoveOption[] = [];
  const losingMoves: {
    r: number;
    c: number;
    value: number;
    coordLabel: string;
    lossWinnings: number;
  }[] = [];

  if (ctx) {
    // Fast exact O(1) floor check per (cell, v) when board is currently safe
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const idx = r * n + c;
        if (ctx.grid[idx] !== 0) continue;
        const coordLabel = formatCoord(r, c);
        const minCoin = getCellMinCoin(ctx, idx);
        const ls = ctx.cellLines[idx];

        for (let v = 1; v <= n; v++) {
          if (ctx.remaining[v] <= 0) continue;
          if (v >= minCoin) {
            // Compute minMarginAfter in O(n) across the 2..4 lines
            let minMargin = v - 1;
            for (let li = 0; li < ls.length; li++) {
              const base = ls[li] * ctx.stride;
              let cum = 0;
              for (let w = 1; w <= n; w++) {
                const freq = ctx.lineFreq[base + w] + (w === v ? 1 : 0);
                cum += freq;
                if (freq > 0) {
                  const margin = w - cum;
                  if (margin < minMargin) minMargin = margin;
                }
              }
            }
            safeMoves.push({ r, c, value: v, coordLabel, minMarginAfter: minMargin });
          } else {
            // Violating move: inspect exact winnings penalty
            const grid = board.map((row) => row.map((cell) => (cell ? cell.value : 0)));
            grid[r][c] = v;
            const check = inspectCellLinesNumeric(grid, n, r, c);
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

  // Fallback when board already has a violation
  const grid = board.map((row) => row.map((cell) => (cell ? cell.value : 0)));
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

/**
 * Paper-grounded leaf evaluation from the perspective of `sideToMove`:
 * - Exact dead squares: cells whose lock floor F(r,c) > maxRemainingCoin.
 * - Sublevel deficit (Lemma B.1 + Theorem 1.2): R_{<=k} > S_{<=k} proves no full-board draw exists.
 * - Playable-square parity & trap pressure: odd playable slots favor the player to move when
 *   squares decouple; low opponent safe mobility creates forcing bottlenecks.
 */
function evaluateLeafForSideToMove(ctx: FastEngineContext): number {
  const { n, remaining, grid } = ctx;
  const totalSafe = countTotalSafeMovesFast(ctx);
  if (totalSafe === 0) return -90000;

  let maxRem = 0;
  let totalCoinsLeft = 0;
  const remLeq = new Int16Array(n + 1);
  for (let v = 1; v <= n; v++) {
    totalCoinsLeft += remaining[v];
    remLeq[v] = totalCoinsLeft;
    if (remaining[v] > 0) maxRem = v;
  }

  // Count empty cells at each lock floor F(r, c)
  const floorBuckets = new Int16Array(n + 2);
  let deadCells = 0;
  let playableCells = 0;
  let tightnessSum = 0;

  for (let idx = 0; idx < n * n; idx++) {
    if (grid[idx] !== 0) continue;
    const f = getCellMinCoin(ctx, idx);
    floorBuckets[f]++;
    if (f > maxRem) {
      deadCells++;
    } else {
      playableCells++;
      tightnessSum += f - 1;
    }
  }

  // Compute max sublevel deficit max_k (R_{<=k} - S_{<=k})
  let slotsLeq = 0;
  let maxDeficit = 0;
  let criticalTightness = 0;
  for (let k = 1; k <= n; k++) {
    slotsLeq += floorBuckets[k];
    const diff = remLeq[k] - slotsLeq;
    if (diff > maxDeficit) maxDeficit = diff;
    if (remLeq[k] > 0 && slotsLeq >= remLeq[k]) {
      const slack = slotsLeq - remLeq[k];
      if (slack <= 2) criticalTightness += 3 - slack;
    }
  }

  // Effective upper bound on remaining safe plies
  const effectivePlayable = Math.min(playableCells, totalCoinsLeft - maxDeficit);
  const parityBonus = effectivePlayable > 0 ? (effectivePlayable % 2 === 1 ? 18 : -14) : -40;

  // Favor high mobility + small parity/structural control for sideToMove
  return (
    Math.min(totalSafe, 250) * 1.4 +
    parityBonus +
    criticalTightness * 2.5 -
    deadCells * 0.5 +
    tightnessSum * 0.15
  );
}

const WIN_SCORE = 100000;
const WIN_THRESHOLD = 90000;

const enum TTFlag {
  EXACT = 0,
  LOWER = 1,
  UPPER = 2,
}

interface TTEntry {
  depth: number;
  flag: TTFlag;
  score: number;
  bestIdx: number;
  bestVal: number;
}

interface SearchCandidate {
  idx: number;
  r: number;
  c: number;
  value: number;
  oppSafe: number;
  score: number;
  minMargin: number;
}

function generateOrderedCandidates(
  ctx: FastEngineContext,
  latinTemplates: number[][][],
  preferLatinBonus: boolean,
  jitterScale = 0,
): SearchCandidate[] {
  const { n, grid, remaining } = ctx;
  const candidates: SearchCandidate[] = [];
  const prevFloors = [0, 0, 0, 0];
  const center = (n - 1) / 2;

  // Check which D4 symmetries of L^n are still completely consistent with current board
  const compatibleTemplates = preferLatinBonus
    ? latinTemplates.filter((tpl) => {
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            const g = grid[r * n + c];
            if (g !== 0 && tpl[r][c] !== g) return false;
          }
        }
        return true;
      })
    : [];

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const idx = r * n + c;
      if (grid[idx] !== 0) continue;
      const minCoin = getCellMinCoin(ctx, idx);
      const ls = ctx.cellLines[idx];
      const lineWeight = ls.length; // 4 lines in interior, 3 on edges/main diags
      const centerDist = Math.abs(r - center) + Math.abs(c - center);

      for (let v = 1; v <= n; v++) {
        if (remaining[v] <= 0 || v < minCoin) continue;

        pushMove(ctx, idx, v, prevFloors);
        const oppSafe = countTotalSafeMovesFast(ctx);
        popMove(ctx, idx, v, prevFloors);

        // Quick heuristic ordering score
        let orderScore = oppSafe === 0 ? WIN_SCORE : -oppSafe * 4;
        orderScore += lineWeight * 3 - centerDist * 0.5;
        // Slightly prefer spending smaller coins when they tightly lock lines
        if (v === minCoin) orderScore += 4;
        if (v <= 2) orderScore += 3;

        if (compatibleTemplates.length > 0) {
          for (let t = 0; t < compatibleTemplates.length; t++) {
            if (compatibleTemplates[t][r][c] === v) {
              orderScore += 6;
              break;
            }
          }
        }

        if (jitterScale > 0 && oppSafe > 0) {
          orderScore += (Math.random() - 0.5) * jitterScale;
        }

        candidates.push({
          idx,
          r,
          c,
          value: v,
          oppSafe,
          score: orderScore,
          minMargin: v - minCoin,
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function pickWeightedDiverseCandidate(
  scored: { cand: SearchCandidate; score: number }[],
  bestScore: number,
): SearchCandidate {
  if (scored.length === 1) return scored[0].cand;

  if (bestScore > WIN_THRESHOLD) {
    const winners = scored.filter((e) => e.score > WIN_THRESHOLD && bestScore - e.score <= 2);
    if (winners.length > 0) {
      return winners[Math.floor(Math.random() * winners.length)].cand;
    }
  }

  const nonLosing = scored.filter((e) => e.score > -WIN_THRESHOLD);
  const poolSource = nonLosing.length > 0 ? nonLosing : scored;
  const band = bestScore - 14;
  const bandCandidates = poolSource
    .filter((e) => e.score >= band)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (bandCandidates.length <= 1) return scored[0].cand;

  let totalWeight = 0;
  const weights = bandCandidates.map((e) => {
    const w = Math.exp((e.score - bestScore) / 5);
    totalWeight += w;
    return w;
  });

  let r = Math.random() * totalWeight;
  for (let i = 0; i < bandCandidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return bandCandidates[i].cand;
  }
  return bandCandidates[0].cand;
}

function runIterativeAlphaBeta(
  ctx: FastEngineContext,
  timeBudgetMs: number,
  nodeBudget: number,
  maxBeamWidth: number,
  varyPlay = false,
): {
  bestCandidate: SearchCandidate | null;
  topWinningCandidates: SearchCandidate[];
  outcome: 'N' | 'P' | 'DRAW' | 'UNKNOWN';
  exact: boolean;
  nodes: number;
} {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const latinTemplates = getIncrementalLatinSymmetries(ctx.n);
  const pliesPlayed = ctx.n * ctx.n - ctx.emptyCount;
  const jitterScale = varyPlay ? (pliesPlayed < 6 ? 7.5 : 3.5) : 0;
  const rootCandidates = generateOrderedCandidates(ctx, latinTemplates, true, jitterScale);

  if (rootCandidates.length === 0) {
    return {
      bestCandidate: null,
      topWinningCandidates: [],
      outcome: ctx.emptyCount === 0 ? 'DRAW' : 'P',
      exact: true,
      nodes: 1,
    };
  }

  // Immediate 1-move win check across ALL safe moves (zero blind spots!)
  const instantWins = rootCandidates.filter((m) => m.oppSafe === 0);
  if (instantWins.length > 0) {
    return {
      bestCandidate: instantWins[0],
      topWinningCandidates: instantWins,
      outcome: 'N',
      exact: true,
      nodes: rootCandidates.length,
    };
  }

  const tt = new Map<string, TTEntry>();
  let nodes = rootCandidates.length;
  let aborted = false;
  let anyPruned = false;

  const isBudgetExceeded = () => {
    if (nodes >= nodeBudget) return true;
    if ((nodes & 127) === 0) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - start >= timeBudgetMs) return true;
    }
    return false;
  };

  function negamax(depth: number, ply: number, alpha: number, beta: number): number {
    if (ctx.emptyCount === 0) return 0; // Full board = Draw
    if (isBudgetExceeded()) {
      aborted = true;
      return 0;
    }

    const key = encodeFastGrid(ctx.grid);
    const cached = tt.get(key);
    if (cached && cached.depth >= depth) {
      let ttScore = cached.score;
      if (ttScore > WIN_THRESHOLD) ttScore -= ply;
      else if (ttScore < -WIN_THRESHOLD) ttScore += ply;

      if (cached.flag === TTFlag.EXACT) return ttScore;
      if (cached.flag === TTFlag.LOWER) alpha = Math.max(alpha, ttScore);
      else if (cached.flag === TTFlag.UPPER) beta = Math.min(beta, ttScore);
      if (alpha >= beta) return ttScore;
    }

    nodes++;

    // Generate all safe moves using fast O(1) cell floor
    const { n, grid, remaining } = ctx;
    const moves: { idx: number; v: number; order: number }[] = [];
    for (let idx = 0; idx < n * n; idx++) {
      if (grid[idx] !== 0) continue;
      const minCoin = getCellMinCoin(ctx, idx);
      const isTT = cached && cached.bestIdx === idx;
      for (let v = minCoin; v <= n; v++) {
        if (remaining[v] <= 0) continue;
        let order = (isTT && cached!.bestVal === v ? 1000 : 0) + (v === minCoin ? 6 : 0) + ctx.cellLineCount[idx];
        if (v <= 2) order += 2;
        moves.push({ idx, v, order });
      }
    }

    if (moves.length === 0) {
      return -WIN_SCORE + ply;
    }

    if (depth <= 0) {
      return evaluateLeafForSideToMove(ctx);
    }

    moves.sort((a, b) => b.order - a.order);
    const limit = moves.length > maxBeamWidth ? maxBeamWidth : moves.length;
    if (limit < moves.length) anyPruned = true;

    const origAlpha = alpha;
    let bestScore = -Infinity;
    let bestIdx = moves[0].idx;
    let bestVal = moves[0].v;
    const prevFloors = [0, 0, 0, 0];

    for (let i = 0; i < limit; i++) {
      const m = moves[i];
      pushMove(ctx, m.idx, m.v, prevFloors);
      const score = -negamax(depth - 1, ply + 1, -beta, -alpha);
      popMove(ctx, m.idx, m.v, prevFloors);

      if (aborted) return 0;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = m.idx;
        bestVal = m.v;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }

    let storeScore = bestScore;
    if (storeScore > WIN_THRESHOLD) storeScore += ply;
    else if (storeScore < -WIN_THRESHOLD) storeScore -= ply;

    const flag =
      bestScore <= origAlpha
        ? TTFlag.UPPER
        : bestScore >= beta
          ? TTFlag.LOWER
          : TTFlag.EXACT;

    if (tt.size < 120000) {
      tt.set(key, { depth, flag, score: storeScore, bestIdx, bestVal });
    }

    return bestScore;
  }

  let bestMove = rootCandidates[0];
  let bestRootScore = -Infinity;
  let lastCompletedWinning: SearchCandidate[] = [];
  let lastCompletedScored: { cand: SearchCandidate; score: number }[] = [];
  let completedExact = false;

  const maxDepth = Math.min(ctx.emptyCount, 24);
  const rootLimit =
    rootCandidates.length > maxBeamWidth * 2 ? maxBeamWidth * 2 : rootCandidates.length;
  if (rootLimit < rootCandidates.length) anyPruned = true;

  for (let depth = 1; depth <= maxDepth; depth++) {
    aborted = false;
    anyPruned = rootLimit < rootCandidates.length;

    let iterBest = rootCandidates[0];
    let iterBestScore = -Infinity;
    const iterWinners: SearchCandidate[] = [];
    const iterScored: { cand: SearchCandidate; score: number }[] = [];
    const prevFloors = [0, 0, 0, 0];
    let alpha = -WIN_SCORE - 100;
    const beta = WIN_SCORE + 100;

    // Order root candidates: keep previous best move first
    const orderedRoot = rootCandidates.slice(0, rootLimit);
    if (bestMove) {
      const idxIn = orderedRoot.indexOf(bestMove);
      if (idxIn > 0) {
        orderedRoot.splice(idxIn, 1);
        orderedRoot.unshift(bestMove);
      }
    }

    for (let i = 0; i < orderedRoot.length; i++) {
      const cand = orderedRoot[i];
      pushMove(ctx, cand.idx, cand.value, prevFloors);
      const score = -negamax(depth - 1, 1, -beta, -alpha);
      popMove(ctx, cand.idx, cand.value, prevFloors);

      if (aborted) break;

      iterScored.push({ cand, score });
      if (score > WIN_THRESHOLD) {
        iterWinners.push(cand);
      }
      if (score > iterBestScore) {
        iterBestScore = score;
        iterBest = cand;
      }
      if (score > alpha && !varyPlay) {
        alpha = score;
      }
      // In deterministic/exact analysis, break immediately if a full-depth forced win is proven
      if (!varyPlay && depth >= ctx.emptyCount && score > WIN_THRESHOLD) {
        break;
      }
    }

    if (aborted) break;

    bestMove = iterBest;
    bestRootScore = iterBestScore;
    lastCompletedWinning = iterWinners;
    lastCompletedScored = iterScored;

    if (!anyPruned && depth >= ctx.emptyCount) {
      completedExact = true;
      break;
    }
    if (!anyPruned && !varyPlay && iterBestScore > WIN_THRESHOLD) {
      completedExact = true;
      break;
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - start >= timeBudgetMs * 0.7) break;
  }

  if (varyPlay && lastCompletedScored.length > 1) {
    bestMove = pickWeightedDiverseCandidate(lastCompletedScored, bestRootScore);
  }

  let outcome: 'N' | 'P' | 'DRAW' | 'UNKNOWN' = 'UNKNOWN';
  if (bestRootScore > WIN_THRESHOLD) {
    outcome = 'N';
  } else if (completedExact) {
    outcome = bestRootScore < -WIN_THRESHOLD ? 'P' : 'DRAW';
  }

  return {
    bestCandidate: bestMove,
    topWinningCandidates:
      lastCompletedWinning.length > 0 ? lastCompletedWinning : bestMove ? [bestMove] : [],
    outcome,
    exact: completedExact || outcome === 'N',
    nodes,
  };
}

export function analyzePosition(board: BoardState, nodeBudget = 24000): PositionAnalysis {
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

  const ctx = createFastContext(board);
  if (!ctx) {
    return {
      safeMoveCount: 0,
      losingMoveCount: losingMoves.length,
      totalLegalMoves: losingMoves.length,
      outcome: 'P',
      nimber: 0,
      confidence: 'EXACT',
      winningMoves: [],
      explanation: 'A 45° line violation has already occurred.',
      nodesSearched: 1,
    };
  }

  // Exact Sprague-Grundy nimber computation for small endgames (<= 7 empty cells)
  if (ctx.emptyCount <= 7) {
    let nodes = 0;
    let budgetExhausted = false;
    const nimberMemo = new Map<string, number>();

    function computeNimber(emptiesLeft: number): number {
      if (emptiesLeft === 0) return 0;
      if (nodes >= nodeBudget) {
        budgetExhausted = true;
        return -1;
      }
      const key = encodeFastGrid(ctx!.grid);
      const cached = nimberMemo.get(key);
      if (cached !== undefined) return cached;

      nodes++;
      const childNimbers = new Set<number>();
      const prevFloors = [0, 0, 0, 0];

      for (let idx = 0; idx < n * n; idx++) {
        if (ctx!.grid[idx] !== 0) continue;
        const minCoin = getCellMinCoin(ctx!, idx);
        for (let v = minCoin; v <= n; v++) {
          if (ctx!.remaining[v] <= 0) continue;
          pushMove(ctx!, idx, v, prevFloors);
          const g = computeNimber(emptiesLeft - 1);
          popMove(ctx!, idx, v, prevFloors);
          if (g === -1) return -1;
          childNimbers.add(g);
        }
      }

      let mex = 0;
      while (childNimbers.has(mex)) mex++;
      nimberMemo.set(key, mex);
      return mex;
    }

    const winningMoves: SafeMoveOption[] = [];
    const childNimbers = new Set<number>();
    const prevFloors = [0, 0, 0, 0];
    let aborted = false;

    for (const move of safeMoves) {
      const idx = move.r * n + move.c;
      pushMove(ctx, idx, move.value, prevFloors);
      const childG = computeNimber(ctx.emptyCount);
      popMove(ctx, idx, move.value, prevFloors);
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

  // Iterative deepening alpha-beta solver for deeper positions
  const search = runIterativeAlphaBeta(ctx, 45, nodeBudget, 42);
  const toOption = (c: SearchCandidate): SafeMoveOption => ({
    r: c.r,
    c: c.c,
    value: c.value,
    coordLabel: formatCoord(c.r, c.c),
    minMarginAfter: c.minMargin,
  });

  if (search.outcome === 'N') {
    const winners = search.topWinningCandidates.map(toOption);
    return {
      safeMoveCount: safeMoves.length,
      losingMoveCount: losingMoves.length,
      totalLegalMoves: safeMoves.length + losingMoves.length,
      outcome: 'N',
      nimber: null,
      confidence: 'EXACT',
      winningMoves: winners,
      explanation: `Forced winning sequence found (${winners.length} winning candidate(s)).`,
      nodesSearched: search.nodes,
    };
  }

  if (search.exact && (search.outcome === 'P' || search.outcome === 'DRAW')) {
    return {
      safeMoveCount: safeMoves.length,
      losingMoveCount: losingMoves.length,
      totalLegalMoves: safeMoves.length + losingMoves.length,
      outcome: search.outcome,
      nimber: search.outcome === 'P' ? 0 : null,
      confidence: 'EXACT',
      winningMoves: search.bestCandidate ? [toOption(search.bestCandidate)] : [],
      explanation:
        search.outcome === 'P'
          ? 'Exact P-position: optimal defense refutes all safe moves.'
          : 'Exact Draw-position with optimal play on both sides.',
      nodesSearched: search.nodes,
    };
  }

  const latinTemplates = getIncrementalLatinSymmetries(n);
  const candidates = generateOrderedCandidates(ctx, latinTemplates, true).slice(0, 3).map(toOption);
  return {
    safeMoveCount: safeMoves.length,
    losingMoveCount: losingMoves.length,
    totalLegalMoves: safeMoves.length + losingMoves.length,
    outcome: 'UNKNOWN',
    nimber: null,
    confidence: 'HEURISTIC',
    winningMoves: candidates,
    explanation: `${safeMoves.length} safe moves available (${losingMoves.length} losing placements avoided). Candidates prioritize capacity-squeeze and line-floor pressure.`,
    nodesSearched: search.nodes,
  };
}

interface CoopHealth {
  deadCells: number;
  maxDeficit: number;
  minHeadroom: number;
  totalSafe: number;
}

function evaluateCoopHealth(ctx: FastEngineContext): CoopHealth {
  const { n, remaining, grid } = ctx;
  let maxRem = 0;
  let totalCoinsLeft = 0;
  const remLeq = new Int16Array(n + 1);
  for (let v = 1; v <= n; v++) {
    totalCoinsLeft += remaining[v];
    remLeq[v] = totalCoinsLeft;
    if (remaining[v] > 0) maxRem = v;
  }

  const floorBuckets = new Int16Array(n + 2);
  let deadCells = 0;
  for (let idx = 0; idx < n * n; idx++) {
    if (grid[idx] !== 0) continue;
    const f = getCellMinCoin(ctx, idx);
    floorBuckets[f]++;
    if (f > maxRem) deadCells++;
  }

  let slotsLeq = 0;
  let maxDeficit = 0;
  let minHeadroom = Infinity;
  for (let k = 1; k <= n; k++) {
    slotsLeq += floorBuckets[k];
    const diff = remLeq[k] - slotsLeq;
    if (diff > maxDeficit) maxDeficit = diff;
    if (remLeq[k] > 0) {
      const headroom = slotsLeq - remLeq[k];
      if (headroom < minHeadroom) minHeadroom = headroom;
    }
  }

  return {
    deadCells,
    maxDeficit,
    minHeadroom: minHeadroom === Infinity ? 0 : minHeadroom,
    totalSafe: countTotalSafeMovesFast(ctx),
  };
}

function canCompleteCoopBoard(
  ctx: FastEngineContext,
  nodeLimit: number,
  deadlineMs: number,
  varyOrder: boolean,
): boolean {
  let nodes = 0;

  function dfs(): boolean {
    if (ctx.emptyCount === 0) return true;
    if (nodes >= nodeLimit) return false;
    if ((nodes & 63) === 0) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now >= deadlineMs) return false;
    }
    nodes++;

    const { n, grid, remaining } = ctx;
    let maxRem = 0;
    let totalRem = 0;
    const remLeq = new Int16Array(n + 1);
    for (let v = 1; v <= n; v++) {
      totalRem += remaining[v];
      remLeq[v] = totalRem;
      if (remaining[v] > 0) maxRem = v;
    }

    const floorBuckets = new Int16Array(n + 2);
    let mrvIdx = -1;
    let mrvCount = Infinity;
    let mrvFloor = 1;

    for (let idx = 0; idx < n * n; idx++) {
      if (grid[idx] !== 0) continue;
      const floor = getCellMinCoin(ctx, idx);
      floorBuckets[floor]++;
      if (floor > maxRem) return false; // Dead cell => impossible to fill

      let avail = 0;
      for (let v = floor; v <= n; v++) {
        if (remaining[v] > 0) avail++;
      }
      if (avail === 0) return false;
      if (avail < mrvCount) {
        mrvCount = avail;
        mrvIdx = idx;
        mrvFloor = floor;
      }
    }

    let slotsLeq = 0;
    for (let k = 1; k <= n; k++) {
      slotsLeq += floorBuckets[k];
      if (remLeq[k] > slotsLeq) return false; // Sublevel deficit => impossible
    }

    if (mrvIdx === -1) return false;

    const r = Math.floor(mrvIdx / n);
    const c = mrvIdx % n;
    const vals: { v: number; order: number }[] = [];

    for (let v = mrvFloor; v <= n; v++) {
      if (remaining[v] <= 0) continue;
      // Prefer values not already present in row r or col c (Latin-square preservation)
      const rowDup = ctx.lineFreq[r * ctx.stride + v] > 0;
      const colDup = ctx.lineFreq[(n + c) * ctx.stride + v] > 0;
      let order = (rowDup ? -20 : 0) + (colDup ? -20 : 0) - v * 0.1;
      if (varyOrder) order += (Math.random() - 0.5) * 3;
      vals.push({ v, order });
    }
    vals.sort((a, b) => b.order - a.order);

    const prevFloors = [0, 0, 0, 0];
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i].v;
      pushMove(ctx, mrvIdx, v, prevFloors);
      const ok = dfs();
      popMove(ctx, mrvIdx, v, prevFloors);
      if (ok) return true;
    }

    return false;
  }

  return dfs();
}

function chooseCoopBotMove(
  ctx: FastEngineContext,
  varyPlay: boolean,
): { r: number; c: number; value: number; reasoning: string } | null {
  const { n, grid, remaining, stride } = ctx;
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const prevFloors = [0, 0, 0, 0];
  const latinTemplates = getIncrementalLatinSymmetries(n);

  const compatibleTemplates = latinTemplates.filter((tpl) => {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const g = grid[r * n + c];
        if (g !== 0 && tpl[r][c] !== g) return false;
      }
    }
    return true;
  });

  interface CoopCandidate {
    idx: number;
    r: number;
    c: number;
    value: number;
    health: CoopHealth;
    score: number;
    provenCompletable: boolean;
  }

  const candidates: CoopCandidate[] = [];

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const idx = r * n + c;
      if (grid[idx] !== 0) continue;
      const minCoin = getCellMinCoin(ctx, idx);

      for (let v = minCoin; v <= n; v++) {
        if (remaining[v] <= 0) continue;

        const rowDup = ctx.lineFreq[r * stride + v] > 0;
        const colDup = ctx.lineFreq[(n + c) * stride + v] > 0;

        pushMove(ctx, idx, v, prevFloors);
        const health = evaluateCoopHealth(ctx);
        const emptiesAfter = ctx.emptyCount;
        popMove(ctx, idx, v, prevFloors);

        let score = 0;
        if (emptiesAfter === 0) {
          // Immediate cooperative victory (full board!)
          score = 1_000_000;
        } else if (health.totalSafe === 0) {
          // Immediate team loss
          score = -900_000;
        } else {
          if (health.deadCells > 0) score -= 50_000 + health.deadCells * 4000;
          if (health.maxDeficit > 0) score -= 40_000 + health.maxDeficit * 3500;

          // Strong preference for Latin-like unique values per row and column
          if (rowDup) score -= 35;
          if (colDup) score -= 35;

          // Maximize small-coin headroom & keep safe mobility healthy
          score += Math.min(health.minHeadroom, 8) * 10;
          score += Math.min(health.totalSafe, 250) * 0.25;

          // Gentle nudge to avoid crowding low floors, while relieving tight small-coin supply
          if (v === minCoin && health.minHeadroom >= 2) score += 2;
          if (compatibleTemplates.length > 0) {
            for (let t = 0; t < compatibleTemplates.length; t++) {
              if (compatibleTemplates[t][r][c] === v) {
                score += 6;
                break;
              }
            }
          }
        }

        if (varyPlay && emptiesAfter > 0 && health.deadCells === 0 && health.maxDeficit === 0) {
          score += (Math.random() - 0.5) * 14;
        }

        candidates.push({
          idx,
          r,
          c,
          value: v,
          health,
          score,
          provenCompletable: emptiesAfter === 0,
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);

  // In late/medium cooperative states (<= 22 empty cells), verify full-board completion with MRV DFS
  if (ctx.emptyCount <= 22) {
    const checkCount = Math.min(candidates.length, 24);
    const totalDeadline = start + 85;
    for (let i = 0; i < checkCount; i++) {
      const cand = candidates[i];
      if (cand.provenCompletable) continue;
      if (cand.health.deadCells > 0 || cand.health.maxDeficit > 0 || cand.health.totalSafe === 0) {
        continue;
      }
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now >= totalDeadline) break;

      pushMove(ctx, cand.idx, cand.value, prevFloors);
      const ok = canCompleteCoopBoard(ctx, 4000, Math.min(totalDeadline, now + 22), varyPlay);
      popMove(ctx, cand.idx, cand.value, prevFloors);

      if (ok) {
        cand.provenCompletable = true;
        cand.score += 500_000;
      }
    }
    candidates.sort((a, b) => b.score - a.score);
  }

  let pick = candidates[0];
  if (varyPlay && candidates.length > 1) {
    const topScore = candidates[0].score;
    const band = topScore >= 400_000 ? 50 : 12;
    const pool = candidates.filter((c) => topScore - c.score <= band).slice(0, 8);
    if (pool.length > 1) {
      pick = pool[Math.floor(Math.random() * pool.length)];
    }
  }

  return {
    r: pick.r,
    c: pick.c,
    value: pick.value,
    reasoning: pick.provenCompletable
      ? `Placed [${pick.value}] on a verified full-board completion path.`
      : `Placed [${pick.value}] preserving 0 KO squares and sublevel headroom.`,
  };
}

export function chooseBotMove(
  board: BoardState,
  options?: { rule?: 'adv' | 'coop'; varyTies?: boolean; varyPlay?: boolean },
): { r: number; c: number; value: number; reasoning: string } | null {
  const { safeMoves, losingMoves } = getAllSafeAndLosingMoves(board);

  // If forced to lose, minimize the opponent's/team's penalty!
  if (safeMoves.length === 0) {
    if (losingMoves.length === 0) return null;
    const sorted = [...losingMoves].sort((a, b) => a.lossWinnings - b.lossWinnings);
    const best = sorted[0];
    return {
      r: best.r,
      c: best.c,
      value: best.value,
      reasoning: `No safe moves remain; selected [${best.value}] to minimize loss (${best.lossWinnings} pts).`,
    };
  }

  const ctx = createFastContext(board);
  if (!ctx) {
    const pick = safeMoves[0];
    return {
      r: pick.r,
      c: pick.c,
      value: pick.value,
      reasoning: `Selected [${pick.value}].`,
    };
  }

  const varyPlay = options?.varyPlay ?? options?.varyTies ?? true;

  if (options?.rule === 'coop') {
    const coopPick = chooseCoopBotMove(ctx, varyPlay);
    if (coopPick) return coopPick;
  }

  // Adversarial iterative deepening alpha-beta with diverse play sampling
  const search = runIterativeAlphaBeta(ctx, 95, 60000, 36, varyPlay);
  const pick = search.bestCandidate;

  if (pick) {
    return {
      r: pick.r,
      c: pick.c,
      value: pick.value,
      reasoning:
        search.outcome === 'N'
          ? `Forced winning line found with [${pick.value}].`
          : `Placed [${pick.value}] using line-floor squeeze & incremental Latin compatibility.`,
    };
  }

  const fallback = safeMoves[0];
  return {
    r: fallback.r,
    c: fallback.c,
    value: fallback.value,
    reasoning: `Placed [${fallback.value}].`,
  };
}
