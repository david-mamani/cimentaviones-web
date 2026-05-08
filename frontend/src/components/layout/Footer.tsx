export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm text-slate-400">
              <span className="text-amber-400 font-semibold">Cimentaciones Web</span>
              {' '}— Análisis de Capacidad Portante
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Basado en la teoría de Terzaghi (1943) y extensiones de Meyerhof (1963) / Hansen (1970)
            </p>
          </div>
          
          <div className="text-center sm:text-right">
            <p className="text-sm text-slate-400">
              Desarrollado por <span className="text-white font-medium">David Mamani</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              © {new Date().getFullYear()} — Ingeniería Geotécnica
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-xs text-slate-600 text-center">
            Refs: Das, B.M. (2015) "Principios de Ingeniería de Cimentaciones", 8va ed.
            • Terzaghi, K. (1943) "Theoretical Soil Mechanics"
            • Meyerhof, G.G. (1963) Canadian Geotechnical Journal
          </p>
        </div>
      </div>
    </footer>
  );
}
