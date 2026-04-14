import React from 'react';
import { X, MapPin, Calendar } from 'lucide-react';
import { MissionDetail } from '../types';

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionName: string;
  dettagli: MissionDetail[];
}

const DrillDownModal: React.FC<DrillDownModalProps> = ({ isOpen, onClose, missionName, dettagli }) => {
  if (!isOpen) return null;

  const [highlightedIds, setHighlightedIds] = React.useState<string[]>([]);

  const totaleElementi = dettagli.length;
  // Calcola il valore totale. Se è palesemente un conteggio (es. tutti i valori sono 1), lo formattiamo diversamente
  const totaleValore = dettagli.reduce((acc, curr) => acc + (curr.valore || 0), 0);
  const isEuro = totaleValore > totaleElementi && totaleValore > 50; 

  const toggleHighlight = (id: string) => { 
    setHighlightedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); 
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => { setHighlightedIds([]); onClose(); }}>
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        
        {/* Header Modale */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-800 leading-tight">{missionName}</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              {totaleElementi} {totaleElementi === 1 ? 'Rivendita' : 'Rivendite'}
              {highlightedIds.length > 0 && (
                <span className="text-emerald-600 font-bold"> • Selezionate: {highlightedIds.length}</span>
              )}
            </p>
          </div>
          <button onClick={() => { setHighlightedIds([]); onClose(); }} className="p-2 bg-white hover:bg-slate-200 rounded-full transition-colors shadow-sm text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista Dettagli */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50 space-y-2">
          {dettagli.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm font-bold text-slate-500">Nessun dato registrato per questa missione.</p>
            </div>
          ) : (
            dettagli.map((item, idx) => (
              <div 
                key={item.id || idx} 
                onClick={() => toggleHighlight(item.id || String(idx))}
                className={`p-3 rounded-xl border flex justify-between items-center transition-all cursor-pointer ${
                  highlightedIds.includes(item.id || String(idx)) 
                    ? 'bg-emerald-50 border-emerald-400 shadow-sm ring-1 ring-emerald-400/50' 
                    : 'bg-white border-slate-100 hover:shadow-md hover:border-slate-300'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{item.nome}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {item.comune && (
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-500 font-medium">
                        <MapPin className="w-3 h-3" /> {item.comune}
                      </span>
                    )}
                    {item.data && (
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-400 font-medium">
                        <Calendar className="w-3 h-3" /> {new Date(item.data).toLocaleDateString('it-IT')}
                      </span>
                    )}
                  </div>
                </div>
                {item.valore !== undefined && (
                  <div className="shrink-0 ml-3 text-right">
                    <p className="text-sm font-black text-brand-600">
                      {isEuro ? `€${item.valore.toLocaleString('it-IT')}` : `+${item.valore.toLocaleString('it-IT')}`}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DrillDownModal;
