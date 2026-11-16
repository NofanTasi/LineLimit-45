import React, { useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { type BoardEvaluation, type BoardState, type PlayerId, getRemainingCoins } from '../game/engine';

export type ChatModelId =
  | 'gemini-4-hydrogen'
  | 'gemini-4-argon'
  | 'gemini-4-carbon'
  | 'gemini-3.1-flash-lite';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  modelUsed?: string;
}

interface StrategyChatPanelProps {
  board: BoardState;
  currentPlayer: PlayerId;
  moveCount: number;
  safeMoveCount: number;
  evaluation: BoardEvaluation;
  winner: PlayerId | null;
}

const MODEL_OPTIONS: { id: ChatModelId; label: string; hint: string }[] = [
  { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', hint: 'General strategy' },
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon', hint: 'Complex interactive' },
  { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon', hint: 'Deep reasoning proofs' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', hint: 'Fast responses' },
];

const QUICK_PROMPTS = [
  'Is there a Nim-style strategy to win?',
  'Analyze my current board position',
  'Why can placing a 1 make existing 2s lose?',
];

export const StrategyChatPanel: React.FC<StrategyChatPanelProps> = ({
  board,
  currentPlayer,
  moveCount,
  safeMoveCount,
  evaluation,
  winner,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask me about LineLimit 45 rules, Nim / Sprague-Grundy parity strategies, or how to win from your current board position.',
    },
  ]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<ChatModelId>('gemini-4-hydrogen');
  const [includeBoard, setIncludeBoard] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function sendMessage(textToSend: string) {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const remaining = getRemainingCoins(board);
      const boardContext = includeBoard
        ? {
            n: board.length,
            currentPlayer,
            moveCount,
            safeMoveCount,
            remainingCoins: remaining,
            grid: board.map((row) => row.map((c) => (c ? c.value : 0))),
            isGameOver: evaluation.isGameOver,
            winner,
            totalWinnings: evaluation.totalWinnings,
          }
        : undefined;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: nextMessages.map((m) => ({ role: m.role, text: m.text })),
          boardContext,
        }),
      });

      const data = (await res.json()) as { reply?: string; model?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.reply || 'No reply received.',
          modelUsed: data.model || selectedModel,
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reach strategy tutor.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-[560px] flex-col rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <label htmlFor="chat-model-select" className="text-xs font-medium text-slate-400">
            Model
          </label>
          <select
            id="chat-model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as ChatModelId)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-100 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} ({opt.hint})
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeBoard}
            onChange={(e) => setIncludeBoard(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-600 accent-amber-500"
          />
          <span>Share live board</span>
        </label>
      </div>

      {/* Scrollable Message Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-amber-500 text-slate-950 font-medium'
                  : 'border border-slate-800 bg-slate-950/80 text-slate-200'
              }`}
            >
              {msg.text}
            </div>
            {msg.modelUsed && (
              <span className="mt-1 font-mono text-[10px] text-slate-500">
                {msg.modelUsed}
              </span>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start">
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-400">
              Thinking with {selectedModel}…
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Quick Prompt Actions */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-t border-slate-800/80 bg-slate-950/40 px-3 py-2">
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp}
            type="button"
            disabled={isLoading}
            onClick={() => void sendMessage(qp)}
            className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-amber-500/50 hover:text-amber-300 whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3 text-amber-400" aria-hidden="true" />
            <span>{qp}</span>
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="flex items-center gap-2 border-t border-slate-800 bg-slate-950/80 p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about Nim parity, traps, or your current move…"
          disabled={isLoading}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-amber-400"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
};
