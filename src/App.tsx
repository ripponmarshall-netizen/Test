import { useState } from "react";
import { 
  Search, 
  ShieldCheck, 
  Zap, 
  Brain, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  ChevronRight,
  RefreshCcw,
  Trophy,
  AlertTriangle,
  Info
} from "lucide-react";
import Markdown from "react-markdown";
import { cn } from "@/src/lib/utils";
import { 
  getModelResponse, 
  verifyResponses, 
  ModelId, 
  ModelResponse,
  VerificationResult
} from "@/src/services/gemini";

const MODELS: { id: ModelId; name: string; icon: any; color: string; description: string }[] = [
  { 
    id: "gemini-3.1-pro-preview", 
    name: "Gemini 3.1 Pro", 
    icon: Brain, 
    color: "text-purple-500",
    description: "Complex reasoning & deep analysis"
  },
  { 
    id: "gemini-3-flash-preview", 
    name: "Gemini 3 Flash", 
    icon: Zap, 
    color: "text-blue-500",
    description: "Balanced speed & intelligence"
  },
  { 
    id: "gemini-3.1-flash-lite-preview", 
    name: "Gemini 3.1 Lite", 
    icon: Loader2, 
    color: "text-emerald-500",
    description: "Ultra-fast lightweight responses"
  }
];

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [responses, setResponses] = useState<ModelResponse[]>([]);
  const [verification, setVerification] = useState<{ data: VerificationResult | null; loading: boolean; error?: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    if (!prompt.trim()) return;

    setIsRunning(true);
    setVerification(null);
    
    // Initialize responses
    const initialResponses: ModelResponse[] = MODELS.map(m => ({
      modelId: m.id,
      text: "",
      loading: true
    }));
    setResponses(initialResponses);

    // Run all models in parallel
    const promises = MODELS.map(async (m, index) => {
      try {
        const text = await getModelResponse(m.id, prompt);
        setResponses(prev => {
          const next = [...prev];
          next[index] = { ...next[index], text, loading: false };
          return next;
        });
        return { modelId: m.id, text, loading: false };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        setResponses(prev => {
          const next = [...prev];
          next[index] = { ...next[index], loading: false, error: errorMsg };
          return next;
        });
        return { modelId: m.id, text: "", loading: false, error: errorMsg };
      }
    });

    const results = await Promise.all(promises);
    
    // Run verification
    setVerification({ data: null, loading: true });
    try {
      const verificationData = await verifyResponses(prompt, results);
      setVerification({ data: verificationData, loading: false });
    } catch (error) {
      setVerification({ 
        data: null, 
        loading: false, 
        error: error instanceof Error ? error.message : "Verification failed" 
      });
    }

    setIsRunning(false);
  };

  const handleRecheck = async () => {
    if (!responses.length || isRunning) return;
    
    setIsRunning(true);
    setVerification({ data: null, loading: true });
    
    try {
      const verificationData = await verifyResponses(prompt, responses);
      setVerification({ data: verificationData, loading: false });
    } catch (error) {
      setVerification({ 
        data: null, 
        loading: false, 
        error: error instanceof Error ? error.message : "Re-check failed" 
      });
    }
    
    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center bg-[#E4E3E0] sticky top-0 z-10">
        <div>
          <h1 className="font-serif italic text-2xl tracking-tight leading-none">AI Consensus Lab</h1>
          <p className="text-[10px] uppercase tracking-widest opacity-50 mt-1 font-mono">Multi-Model Verification Protocol v1.1</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {MODELS.map(m => (
              <div key={m.id} className={cn("w-8 h-8 rounded-full bg-[#141414] flex items-center justify-center border-2 border-[#E4E3E0]", m.color)}>
                <m.icon size={14} />
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Input Section */}
        <section className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider opacity-50 font-mono">
              <Search size={14} />
              <span>Input Prompt for Cross-Verification</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a complex question, factual query, or logic puzzle..."
              className="w-full bg-transparent border-none focus:ring-0 text-xl font-serif italic resize-none min-h-[100px] placeholder:opacity-30"
            />
            <div className="flex justify-end">
              <button
                onClick={handleRun}
                disabled={isRunning || !prompt.trim()}
                className={cn(
                  "flex items-center gap-2 px-8 py-3 bg-[#141414] text-[#E4E3E0] font-mono uppercase text-xs tracking-widest transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(20,20,20,0.3)] active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-30 disabled:cursor-not-allowed",
                  isRunning && "animate-pulse"
                )}
              >
                {isRunning ? (
                  <>
                    <RefreshCcw size={14} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Execute Verification</span>
                    <ChevronRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Results Grid */}
        {responses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {responses.map((resp, idx) => {
              const model = MODELS.find(m => m.id === resp.modelId)!;
              const isWinner = verification?.data?.winner === resp.modelId;
              
              return (
                <div key={resp.modelId} className={cn(
                  "bg-white border border-[#141414] flex flex-col transition-all",
                  isWinner && "ring-2 ring-purple-500 shadow-[8px_8px_0px_0px_rgba(168,85,247,0.2)]"
                )}>
                  <div className="border-b border-[#141414] p-3 flex items-center justify-between bg-[#f5f5f5]">
                    <div className="flex items-center gap-2">
                      <model.icon size={16} className={model.color} />
                      <span className="font-mono text-[11px] uppercase tracking-wider font-bold">{model.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isWinner && (
                        <div className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter">
                          <Trophy size={10} />
                          <span>Winner</span>
                        </div>
                      )}
                      {resp.loading ? (
                        <Loader2 size={14} className="animate-spin opacity-50" />
                      ) : resp.error ? (
                        <AlertCircle size={14} className="text-red-500" />
                      ) : (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      )}
                    </div>
                  </div>
                  <div className="p-4 flex-1 font-sans text-sm leading-relaxed overflow-auto max-h-[400px] markdown-body">
                    {resp.loading ? (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-4 bg-gray-100 w-3/4 rounded" />
                        <div className="h-4 bg-gray-100 w-full rounded" />
                        <div className="h-4 bg-gray-100 w-5/6 rounded" />
                      </div>
                    ) : resp.error ? (
                      <div className="text-red-500 font-mono text-xs p-2 bg-red-50 border border-red-200">
                        Error: {resp.error}
                      </div>
                    ) : (
                      <Markdown>{resp.text}</Markdown>
                    )}
                  </div>
                  <div className="border-t border-[#141414] p-2 bg-[#f5f5f5]">
                    <p className="text-[9px] uppercase tracking-tighter opacity-40 font-mono">{model.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Verification Section */}
        {(verification || verification?.loading) && (
          <div className="space-y-6">
            {/* Discrepancy Alerts */}
            {verification?.data?.discrepancies && verification.data.discrepancies.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-500 p-6 shadow-[4px_4px_0px_0px_rgba(245,158,11,0.2)]">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle size={20} className="text-amber-600" />
                  <h3 className="font-mono text-xs uppercase tracking-widest font-bold text-amber-900">
                    Discrepancy Detected ({verification.data.discrepancies.length})
                  </h3>
                </div>
                <div className="space-y-4">
                  {verification.data.discrepancies.map((d, i) => (
                    <div key={i} className="bg-white/50 border border-amber-200 p-4 rounded-sm">
                      <p className="font-serif italic text-sm mb-2 text-amber-900">"{d.point}"</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase tracking-widest opacity-50 font-mono">Conflicting Claims:</p>
                          {Object.entries(d.models).map(([mid, claim]) => (
                            <div key={mid} className="text-xs bg-white p-2 border border-amber-100">
                              <span className="font-bold font-mono text-[10px] block mb-1 opacity-70">{MODELS.find(m => m.id === mid)?.name}:</span>
                              <span className="italic opacity-80">"{claim}"</span>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase tracking-widest opacity-50 font-mono">Resolution:</p>
                          <div className="text-xs bg-emerald-50 p-3 border border-emerald-200 text-emerald-900 leading-relaxed">
                            {d.resolution}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Consensus */}
            <section className="bg-[#141414] text-[#E4E3E0] p-8 border border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,0.2)]">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={24} className="text-purple-400" />
                  <div>
                    <h2 className="font-serif italic text-2xl">Final Verification & Consensus</h2>
                    <p className="text-[10px] uppercase tracking-widest opacity-50 font-mono">Expert Model Synthesis (Gemini 3.1 Pro)</p>
                  </div>
                </div>
                {!verification?.loading && (
                  <button
                    onClick={handleRecheck}
                    disabled={isRunning}
                    className="flex items-center gap-2 px-4 py-2 border border-[#E4E3E0]/20 hover:bg-[#E4E3E0]/10 transition-colors text-[10px] font-mono uppercase tracking-widest"
                  >
                    <RefreshCcw size={12} className={cn(isRunning && "animate-spin")} />
                    <span>Request Re-Check</span>
                  </button>
                )}
              </div>

              <div className="font-sans leading-relaxed markdown-body prose prose-invert max-w-none">
                {verification?.loading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <RefreshCcw size={32} className="animate-spin opacity-50" />
                    <p className="font-mono text-xs uppercase tracking-widest animate-pulse">Analyzing discrepancies and synthesizing consensus...</p>
                  </div>
                ) : verification?.error ? (
                  <div className="text-red-400 font-mono text-sm p-4 border border-red-400/30 bg-red-400/10">
                    Verification Error: {verification.error}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {verification?.data?.winner && (
                      <div className="bg-purple-500/10 border border-purple-500/30 p-4 flex gap-4 items-start">
                        <Trophy className="text-purple-400 shrink-0 mt-1" size={20} />
                        <div>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-purple-400 mb-1 font-mono">Model Recommendation</p>
                          <p className="text-sm italic opacity-90">
                            The verifier selected <span className="font-bold text-purple-300">{MODELS.find(m => m.id === verification.data?.winner)?.name}</span> as the most reliable source for this query.
                          </p>
                          {verification.data.winnerReason && (
                            <p className="text-xs mt-2 opacity-60 leading-relaxed">{verification.data.winnerReason}</p>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="relative">
                      <div className="absolute -left-4 top-0 bottom-0 w-1 bg-purple-500/30" />
                      <Markdown>{verification?.data?.consensus}</Markdown>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#141414] p-8 mt-12 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-mono text-[10px] uppercase tracking-widest opacity-50">
            © 2026 AI Consensus Lab • Multi-Model Verification Protocol
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-6 font-mono text-[10px] uppercase tracking-widest">
              <span className="opacity-50">Status:</span>
              <span className="text-emerald-600 font-bold">Systems Online</span>
            </div>
            <div className="h-4 w-[1px] bg-gray-200" />
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest opacity-50">
              <Info size={12} />
              <span>Disagreement Resolution Active</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
