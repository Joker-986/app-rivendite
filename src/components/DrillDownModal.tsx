import React from 'react';
import { X, MapPin, Calendar, ChevronDown, ChevronUp, ShoppingBag, Box } from 'lucide-react';
import { MissionDetail } from '../types';

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionName: string;
  dettagli: MissionDetail[];
}

const DrillDownModal: React.FC<DrillDownModalProps> = ({ isOpen, onClose, missionName, dettagli }) => {
  if (!isOpen) return null;

  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = React.useState<string[]>([]);

  const totaleElementi = dettagli.length;
  const totaleValore = dettagli.reduce((acc, curr) => acc + (curr.valore || 0), 0);
  const isEuro = totaleValore > totaleElementi && totaleValore > 50; 

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const toggleHighlight = (id: string) => { 
    setHighlightedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); 
  };

  const handleClose = () => {
    setHighlightedIds([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={handleClose}>
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        
        {/* Header Modale */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-800 leading-tight">{missionName}</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              {totaleElementi} {totaleElementi === 1 ? 'Rivendita' : 'Rivendite'} • Totale €{totaleValore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {highlightedIds.length > 0 && (
                <span className="text-emerald-600 font-bold ml-1.5">• Selezionate: {highlightedIds.length}</span>
              )}
            </p>
          </div>
          <button onClick={handleClose} className="p-2 bg-white hover:bg-slate-200 rounded-full transition-colors shadow-sm text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista Dettagli */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50 space-y-2.5">
          {dettagli.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm font-bold text-slate-500">Nessun dato registrato per questa missione.</p>
            </div>
          ) : (
            dettagli.map((item, idx) => {
              const itemId = item.id || String(idx);
              const isExpanded = expandedId === itemId;
              const isHighlighted = highlightedIds.includes(itemId);
              const hasSubOrders = item.ordini && item.ordini.length > 0;

              return (
                <div 
                  key={itemId}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col ${
                    isHighlighted 
                      ? 'bg-emerald-50 border-emerald-400 shadow-sm ring-1 ring-emerald-400/50' 
                      : isExpanded 
                        ? 'bg-white border-brand-300 shadow-md ring-1 ring-brand-300/40' 
                        : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  {/* Riga Sintetica Principale SPLIT CLICK */}
                  <div className="flex items-stretch justify-between w-full">
                    
                    {/* Area 1: Selezione Rivendita */}
                    <div 
                      onClick={() => toggleHighlight(itemId)}
                      className="p-3.5 flex-1 min-w-0 cursor-pointer select-none hover:bg-black/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black text-slate-800 truncate">{item.nome}</p>
                        {hasSubOrders && (
                          <span className="text-[10px] font-bold text-slate-400">
                            ({item.ordini?.length} {item.ordini?.length === 1 ? 'ordine' : 'ordini'})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {item.comune && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold shrink-0">
                            <MapPin className="w-3 h-3 text-slate-300 shrink-0" /> {item.comune}
                          </span>
                        )}

                        {/* Micro Badges Fonte */}
                        {(item.totaleLogista !== undefined || item.totaleMagazzino !== undefined) && (
                          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                            {(item.totaleMagazzino || 0) > 0 && (
                              <span className="shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[9px] font-bold border border-blue-100/80">
                                Mag: €{(item.totaleMagazzino || 0).toLocaleString('it-IT')}
                              </span>
                            )}
                            {(item.totaleLogista !== undefined && (item.totaleLogista || 0) > 0) && (
                              <span className="shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-700 text-[9px] font-bold border border-orange-100/80">
                                Log: €{(item.totaleLogista || 0).toLocaleString('it-IT')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Area 2: Espansione Dettagli */}
                    <div 
                      onClick={() => hasSubOrders ? toggleExpand(itemId) : toggleHighlight(itemId)}
                      className={`p-3.5 shrink-0 flex items-center justify-end gap-2 text-right border-l border-slate-100/50 transition-colors ${hasSubOrders ? 'cursor-pointer hover:bg-black/5' : 'cursor-pointer hover:bg-black/5'}`}
                    >
                      <div>
                        <p className="text-sm font-black text-slate-800">
                          {isEuro ? `€${(item.valore || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `+${item.valore}`}
                        </p>
                      </div>
                      {hasSubOrders && (
                        <div className="text-slate-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sotto-elenco Analitico (Espandibile) */}
                  {isExpanded && hasSubOrders && (
                    <div className="bg-slate-50/80 border-t border-slate-100 p-3 space-y-1.5 animate-in fade-in duration-150">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2 px-1">
                        Dettaglio Ordini Mensili
                      </p>
                      {item.ordini?.map((ord, oIdx) => (
                        <div 
                          key={ord.id || oIdx}
                          className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200/60 text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-tight ${
                              ord.fonte === 'Logista' 
                                ? 'bg-orange-100/80 text-orange-800' 
                                : 'bg-blue-100/80 text-blue-800'
                            }`}>
                              {ord.fonte}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500">
                              {new Date(ord.data).toLocaleDateString('it-IT')}
                            </span>
                          </div>
                          <span className="font-bold text-slate-800 text-[11px]">
                            €{ord.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default DrillDownModal;
