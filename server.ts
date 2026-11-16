import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const ALLOWED_CHAT_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-4-argon',
  'gemini-4-carbon',
  'gemini-3.1-flash-lite',
]);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

function formatGeminiError(err: unknown): { status: number; error: string } {
  const anyErr = err as { status?: number; message?: string };
  const message = anyErr?.message || 'Unexpected error calling Gemini API.';
  const status = typeof anyErr?.status === 'number' ? anyErr.status : 500;

  if (status === 403 || message.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      error: 'Permission denied by Gemini API. Please verify your API key in Settings > Secrets.',
    };
  }
  if (status === 429 || message.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      error: 'Quota exceeded (429). If using a paid model like gemini-4-argon or gemini-4-carbon, verify your billing-enabled API key in Settings > Secrets.',
    };
  }
  if (status === 404 || message.includes('NOT_FOUND')) {
    return {
      status: 404,
      error: `Requested Gemini model was not found: ${message}`,
    };
  }
  if (status === 400 || message.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      error: `Invalid request or API key: ${message}`,
    };
  }
  return { status: status >= 400 && status < 600 ? status : 500, error: message };
}

interface ChatInputMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface BoardContextPayload {
  n: number;
  currentPlayer: 1 | 2;
  moveCount: number;
  safeMoveCount: number;
  remainingCoins: Record<string, number>;
  grid: number[][];
  isGameOver: boolean;
  winner: 1 | 2 | null;
  totalWinnings: number;
}

function buildSystemInstruction(boardContext?: BoardContextPayload): string {
  const base = `You are a Combinatorial Game Theory & Strategy Tutor for the 2-player board game "LineLimit 45".

EXACT GAME RULES:
- Played on an n x n square board with a shared pool of n^2 coins: n coins valued 1, n valued 2, ..., n valued n.
- Players alternate placing any remaining coin onto any empty square.
- LOSS CONDITION: A player LOSES immediately upon placing a coin if, on ANY 45-degree line (any row, any column, any down-right diagonal r-c=k, or any up-right diagonal r+c=k), there exists at least one coin (of value v) for which the number of coins on that line with value <= v is STRICTLY GREATER than v.
  - Note: Placing a smaller coin (e.g. a 1) can cause an already-placed larger coin (e.g. two 2s on that line) to violate!
  - Example (n=4): Row "1 . . 1" -> both 1s have count(<=1)=2 > 1, so the mover loses and the opponent wins 1 + 1 = 2 points.
  - Example (n=4): Row "1 . . 2" -> for 1, count(<=1)=1 <= 1; for 2, count(<=2)=2 <= 2. Safe!
- SCORING: The winner wins the total value of all coins on the board that satisfy the violation condition.

MATHEMATICAL & NIM-STYLE STRATEGY FACTS:
1. Safe-Play Equivalence to Normal-Play Impartial Games: Because both players share the same board and coin pool, restricting legal moves to safe placements turns LineLimit 45 into an impartial finite DAG game. Every safe state is strictly an N-position (next player wins) or P-position (previous player wins), with an exact Sprague-Grundy Nimber g(S) = mex{g(S')}.
2. Why Classic XOR Nim Sum Does Not Directly Apply for n >= 3: Placing a coin couples 4 lines simultaneously (row, col, 2 diagonals) AND consumes a global coin from the shared multiset {1^n, ..., n^n}, so lines are not independent Nim heaps.
3. Exact Solution for n = 2: Every pair of squares on a 2x2 board shares a 45-degree line. Thus at most ONE '1' can ever be safely placed, while both '2's can always be safely placed alongside one '1'. Any 3 coins from {1, 2, 2} are safe in any layout, and the 4th move (the second '1') always loses. Therefore n=2 reduces to a 1-heap Nim / parity game of 3 safe moves — Player 1 ALWAYS has a guaranteed win (winning 2 points).
4. Mirror Symmetry Pitfall: On even n, 180-degree point mirroring (r,c) -> (n-1-r, n-1-c) keeps rows and columns disjoint, EXCEPT cells on the main diagonal (r=c) and anti-diagonal (r+c=n-1) share those diagonals with their own mirror! So blindly mirroring a '1' on a main diagonal loses immediately.
5. Endgame & Trap Creation: Players win by forcing the opponent into a position with zero safe moves, or playing into lines with tight "capacity" (a line with k coins <= k is saturated for values <= k).

Be concise, mathematically accurate, and insightful. Use clean markdown formatting.`;

  if (!boardContext) return base;

  const gridText = boardContext.grid
    .map((row) => row.map((v) => (v === 0 ? '.' : String(v))).join(' '))
    .join('\n');

  const poolText = Object.entries(boardContext.remainingCoins)
    .map(([val, cnt]) => `${val}:x${cnt}`)
    .join(', ');

  return `${base}

LIVE BOARD STATE RIGHT NOW:
- Board size: ${boardContext.n}x${boardContext.n}
- Turn: Player ${boardContext.currentPlayer} (Moves played: ${boardContext.moveCount})
- Remaining coins in shared pool: ${poolText}
- Safe moves currently available: ${boardContext.safeMoveCount}
- Status: ${boardContext.isGameOver ? `Game Over! Player ${boardContext.winner} won ${boardContext.totalWinnings} pts.` : 'In Progress'}
- Current Grid ('.' = empty):
${gridText}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { messages, model = 'gemini-4-hydrogen', boardContext } = req.body as {
        messages?: ChatInputMessage[];
        model?: string;
        boardContext?: BoardContextPayload;
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Messages array is required.' });
        return;
      }

      const selectedModel = ALLOWED_CHAT_MODELS.has(model) ? model : 'gemini-4-hydrogen';
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg || lastMsg.role !== 'user' || !lastMsg.text.trim()) {
        res.status(400).json({ error: 'The latest message must be a non-empty user message.' });
        return;
      }

      // Ensure history starts with a user turn for Gemini Chat API
      const priorMessages = messages.slice(0, -1);
      const firstUserIdx = priorMessages.findIndex((m) => m.role === 'user');
      const validPrior = firstUserIdx >= 0 ? priorMessages.slice(firstUserIdx) : [];

      const history = validPrior.map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.text }],
      }));

      const ai = getGeminiClient();
      const response = await withRetry(async () => {
        const chat = ai.chats.create({
          model: selectedModel,
          history,
          config: {
            systemInstruction: buildSystemInstruction(boardContext),
          },
        });
        return chat.sendMessage({ message: lastMsg.text });
      });

      res.json({
        reply: response.text ?? 'No response generated.',
        model: selectedModel,
      });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.error });
    }
  });

  app.post('/api/analyze-image', async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType, prompt } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        prompt?: string;
      };

      if (!imageBase64 || !mimeType) {
        res.status(400).json({ error: 'imageBase64 and mimeType are required.' });
        return;
      }

      const ai = getGeminiClient();
      const analysisPrompt = `Analyze this uploaded image in the context of the 2-player combinatorial board game "LineLimit 45".
Rules of LineLimit 45:
- Played on an n x n square grid (typically 2x2 up to 6x6) with coins numbered 1 through n.
- A player loses if on any 45-degree line (row, column, or either diagonal direction), any coin of value v has strictly more than v coins on that line with value <= v.
- The winner wins the sum of values of all violating coins.

Tasks:
1. Detect whether the image shows a square n x n board with numbered coins/tokens (2 <= n <= 6). If so, extract the exact n x n grid using 0 for empty cells and the integer coin value (1..n) for occupied cells. If no grid is visible, set boardSize to 0 and grid to [].
2. Summarize what is visible in the photo.
3. Evaluate the extracted board against the 45-degree line rule (identify any violating coins and offending lines, or confirm the position is currently safe).
4. Provide concise Nim / combinatorial strategic advice for the next player.
${prompt ? `\nAdditional user question: ${prompt}` : ''}`;

      const imagePart = {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      };

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-argon',
          contents: {
            parts: [imagePart, { text: analysisPrompt }],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                boardSize: {
                  type: Type.INTEGER,
                  description: 'Detected square grid dimension n (2..6), or 0 if no valid board is detected.',
                },
                grid: {
                  type: Type.ARRAY,
                  description: 'n x n matrix of integers (0 = empty, 1..n = coin value). Empty array if boardSize is 0.',
                  items: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                  },
                },
                summary: {
                  type: Type.STRING,
                  description: 'Clear description of what was observed in the uploaded photo.',
                },
                ruleCheck: {
                  type: Type.STRING,
                  description: 'Evaluation of rows, columns, and 45-degree diagonals under the count(<=v) > v rule.',
                },
                strategicAdvice: {
                  type: Type.STRING,
                  description: 'Actionable tactical and Nim-theory advice for the next player.',
                },
              },
              required: ['boardSize', 'grid', 'summary', 'ruleCheck', 'strategicAdvice'],
            },
          },
        }),
      );

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (err: unknown) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.error });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LineLimit 45 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
