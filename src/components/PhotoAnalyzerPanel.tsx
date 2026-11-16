import React, { useRef, useState } from 'react';
import { Camera, CheckCircle2, ImagePlus, Upload } from 'lucide-react';

interface AnalysisResult {
  boardSize: number;
  grid: number[][];
  summary: string;
  ruleCheck: string;
  strategicAdvice: string;
}

interface PhotoAnalyzerPanelProps {
  onLoadDetectedGrid: (grid: number[][]) => void;
}

const SAMPLE_IMAGE_URL = '/src/assets/images/sample_board_photo_1794833667308.jpg';

export const PhotoAnalyzerPanel: React.FC<PhotoAnalyzerPanelProps> = ({ onLoadDetectedGrid }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [question, setQuestion] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [imgLoadFailed, setImgLoadFailed] = useState(false);

  function handleFileSelected(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPEG, or WebP).');
      return;
    }
    setError(null);
    setResult(null);
    setImgLoadFailed(false);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const commaIdx = dataUrl.indexOf(',');
      const rawBase64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      setPreviewUrl(dataUrl);
      setImageBase64(rawBase64);
      setMimeType(file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  }

  async function loadSamplePhoto() {
    setError(null);
    setResult(null);
    setImgLoadFailed(false);
    try {
      const res = await fetch(SAMPLE_IMAGE_URL);
      if (!res.ok) throw new Error('Sample photo unavailable.');
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const commaIdx = dataUrl.indexOf(',');
        setPreviewUrl(SAMPLE_IMAGE_URL);
        setImageBase64(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl);
        setMimeType(blob.type || 'image/jpeg');
      };
      reader.readAsDataURL(blob);
    } catch {
      setError('Could not load the sample board photo. Please upload your own image.');
    }
  }

  async function analyzePhoto() {
    if (!imageBase64 || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          prompt: question.trim() || undefined,
        }),
      });
      const data = (await res.json()) as AnalysisResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Analysis failed with status ${res.status}`);
      }
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to analyze uploaded photo.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  const hasValidGrid =
    result !== null &&
    result.boardSize >= 2 &&
    result.boardSize <= 6 &&
    Array.isArray(result.grid) &&
    result.grid.length === result.boardSize &&
    result.grid.every((row) => Array.isArray(row) && row.length === result.boardSize);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-display text-base font-bold text-slate-50">
              Board Photo Analyzer
            </h3>
            <p className="text-xs text-slate-400">
              Upload a hand-drawn or tabletop board photo for gemini-4-argon inspection.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSamplePhoto()}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-amber-500/50 hover:text-amber-300 whitespace-nowrap shrink-0"
          >
            Try Sample Photo
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileSelected(e.target.files?.[0])}
          className="sr-only"
        />

        {!previewUrl ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-8 text-center transition-colors hover:border-amber-500/60 hover:bg-slate-950 cursor-pointer"
          >
            <Upload className="h-7 w-7 text-amber-400" aria-hidden="true" />
            <div className="text-xs font-semibold text-slate-200">
              Click to upload a board photo
            </div>
            <div className="text-[11px] text-slate-400">
              PNG, JPEG, or WebP · Recognizes 2×2 to 6×6 grids
            </div>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
              {!imgLoadFailed ? (
                <img
                  src={previewUrl}
                  alt="Uploaded game board for Gemini analysis"
                  referrerPolicy="no-referrer"
                  onError={() => setImgLoadFailed(true)}
                  className="max-h-52 w-full object-contain"
                />
              ) : (
                <div className="flex h-40 flex-col items-center justify-center gap-2 bg-slate-900 text-slate-400">
                  <Camera className="h-6 w-6" aria-hidden="true" />
                  <span className="text-xs">Image preview ready for analysis</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Optional question (e.g., Is diagonal A1–D4 safe?)"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-amber-400"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Replace photo"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap shrink-0"
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Replace</span>
              </button>
              <button
                type="button"
                disabled={isAnalyzing || !imageBase64}
                onClick={() => void analyzePhoto()}
                className="h-9 rounded-lg bg-amber-500 px-4 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {isAnalyzing ? 'Analyzing…' : 'Analyze Photo'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Analysis Complete (gemini-4-argon)</span>
            </div>
            {hasValidGrid && (
              <button
                type="button"
                onClick={() => onLoadDetectedGrid(result.grid)}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 whitespace-nowrap shrink-0"
              >
                Load {result.boardSize}×{result.boardSize} Board
              </button>
            )}
          </div>

          <div className="space-y-2.5 text-xs leading-relaxed text-slate-300">
            <div>
              <div className="font-semibold text-slate-100">Observation</div>
              <p>{result.summary}</p>
            </div>
            <div>
              <div className="font-semibold text-slate-100">45° Line Rule Check</div>
              <p>{result.ruleCheck}</p>
            </div>
            <div>
              <div className="font-semibold text-slate-100">Strategic Advice</div>
              <p>{result.strategicAdvice}</p>
            </div>
          </div>

          {hasValidGrid && (
            <div className="border-t border-slate-800 pt-3">
              <div className="mb-2 text-xs font-semibold text-slate-300">
                Extracted {result.boardSize}×{result.boardSize} Matrix
              </div>
              <div
                className="inline-grid gap-1 rounded-lg bg-slate-950 p-2 font-mono text-xs tabular-nums"
                style={{ gridTemplateColumns: `repeat(${result.boardSize}, 28px)` }}
              >
                {result.grid.flatMap((row, r) =>
                  row.map((val, c) => (
                    <div
                      key={`${r}-${c}`}
                      className={`flex h-7 w-7 items-center justify-center rounded ${
                        val > 0
                          ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                          : 'bg-slate-900 text-slate-600'
                      }`}
                    >
                      {val > 0 ? val : '·'}
                    </div>
                  )),
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
