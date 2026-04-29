import { useFoundationStore } from '../../store/foundationStore';

export default function Header() {
  return (
    <header className="relative overflow-hidden border-b border-white/10">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo icon */}
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                CimentAviones
                <span className="text-amber-400 ml-1">Web</span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Análisis Geotécnico de Capacidad Portante
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20">
              v1.0.0
            </span>
            <ResetButton />
          </div>
        </div>
      </div>
    </header>
  );
}

function ResetButton() {
  const reset = useFoundationStore((s) => s.reset);
  
  return (
    <button
      onClick={reset}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-200"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Reiniciar
    </button>
  );
}
