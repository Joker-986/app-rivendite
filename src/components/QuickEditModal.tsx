import React, { useState, useEffect, useMemo } from 'react';
import { X, ShoppingBag, UserCheck, CheckCircle2, Trash2, Calendar, Clock, Edit3, Check } from 'lucide-react';
import { useModals } from '../contexts/ModalContext';
import OrderModule from './OrderModule';

interface QuickEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editType: 'VISITA' | 'ORDINE' | 'HOSTESS' | null;
  rivenditaId: string;
  extra: any;
  onUpdateRubrica: (id: string, field: string, value: any) => void;
  onEditHistory: (id: string, index: number, note: string, importo: number, data?: string, ora?: string, stato?: string, isEseguito?: boolean, dataEsecuzione?: string, items?: any[], dataEvasione?: string, visitaInizio?: string, visitaFine?: string) => void;
  onDeleteHistory: (id: string, index: number) => void;
  targetHistoryIndex?: number;
}

const QuickEditModal: React.FC<QuickEditModalProps> = ({
  isOpen, onClose, editType, rivenditaId, extra, onUpdateRubrica, onEditHistory, onDeleteHistory, targetHistoryIndex
}) => {
  const { openConfirm } = useModals();

  const [data, setData] = useState('');
  const [oraInizio, setOraInizio] = useState('');
  const [ora, setOra] = useState('');
  const [note, setNote] = useState('');
  const [importo, setImporto] = useState<number>(0);
  const [isEvaso, setIsEvaso] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [dataEvasione, setDataEvasione] = useState('');
  const [isEditingTimeRange, setIsEditingTimeRange] = useState(false);
  const formattedData = data ? new Date(data).toLocaleDateString('it-IT') : '-';
  
  // Stato per salvare la "Fotografia" iniziale dei dati
  const [initialState, setInitialState] = useState({ data: '', oraInizio: '', ora: '', note: '', importo: 0, isEvaso: false, items: [] as any[], dataEvasione: '' });

  const actualIndex = useMemo(() => {
    if (targetHistoryIndex !== undefined) return targetHistoryIndex;
    if (extra?.history && editType) {
      return extra.history.findIndex((h: any) => h.tipo === editType);
    }
    return -1;
  }, [targetHistoryIndex, extra, editType]);

  useEffect(() => {
    if (isOpen && editType && actualIndex >= 0 && extra?.history) {
      const entry = extra.history[actualIndex];
      if (entry) {
        const d = new Date(entry.data);
        const initData = d.toISOString().split('T')[0];
        const initOra = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        
        let initOraInizio = initOra;
        let cleanNote = entry.note || '';

        if (editType === 'VISITA') {
          if (entry.visitaInizio) {
             initOraInizio = new Date(entry.visitaInizio).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
          } else {
             // Fallback: Deduce l'inizio e pulisce la stringa legacy
             const match = cleanNote.match(/\[⌚ (\d+) min\]\s*/);
             if (match) {
                const mins = parseInt(match[1], 10);
                const startD = new Date(d.getTime() - mins * 60000);
                initOraInizio = startD.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                cleanNote = cleanNote.replace(/\[⌚ \d+ min\]\s*/, '');
             }
          }
        }

        const initImporto = entry.importo || 0;
        const initEvaso = entry.isEseguito === true;
        const initItems = entry.items || [];
        const initDataEvasione = entry.dataEvasione || '';

        // Impostiamo i dati visibili
        setData(initData);
        setOraInizio(initOraInizio);
        setOra(initOra);
        setNote(cleanNote);
        setImporto(initImporto);
        setIsEvaso(initEvaso);
        setItems(initItems);
        setDataEvasione(initDataEvasione);

        // Salviamo la fotografia per il confronto
        setInitialState({
          data: initData,
          oraInizio: initOraInizio,
          ora: initOra,
          note: cleanNote,
          importo: initImporto,
          isEvaso: initEvaso,
          items: initItems,
          dataEvasione: initDataEvasione
        });
      }
    }
  }, [isOpen, editType, extra, actualIndex]);

  const durataMin = useMemo(() => {
    if (!data || !oraInizio || !ora) return 0;
    const start = new Date(`${data}T${oraInizio}:00`).getTime();
    const end = new Date(`${data}T${ora}:00`).getTime();
    return Math.max(0, Math.round((end - start) / 60000));
  }, [data, oraInizio, ora]);

  if (!isOpen || !editType || actualIndex < 0) return null;

  // FUNZIONE PARACADUTE
  const handleCloseRequest = () => {
    const hasChanges = 
      data !== initialState.data || 
      oraInizio !== initialState.oraInizio || 
      ora !== initialState.ora || 
      note !== initialState.note || 
      importo !== initialState.importo || 
      isEvaso !== initialState.isEvaso ||
      JSON.stringify(items) !== JSON.stringify(initialState.items) ||
      dataEvasione !== initialState.dataEvasione;

    if (hasChanges) {
      openConfirm({
        title: 'Modifiche non salvate',
        message: 'Hai modificato i dati di questo evento. Sei sicuro di voler uscire perdendo tutte le modifiche?',
        isDestructive: true,
        onConfirm: () => onClose()
      });
    } else {
      onClose(); // Nessuna modifica, esce in silenzio
    }
  };

  const handleSave = () => {
    let newStato = undefined;
    if (editType === 'ORDINE') {
      newStato = isEvaso ? 'EVASO' : 'DA_EVADERE';
      if (isEvaso) {
        onUpdateRubrica(rivenditaId, 'ordineEvaso', true);
        onUpdateRubrica(rivenditaId, 'richiestaOrdine', false);
      }
    }

    let vInizio, vFine;
    if (editType === 'VISITA') { 
        vInizio = `${data}T${oraInizio}:00`; 
        vFine = `${data}T${ora}:00`; 
    }

    onEditHistory(rivenditaId, actualIndex, note, importo, data, ora, newStato, isEvaso, isEvaso ? new Date().toISOString() : undefined, items, dataEvasione, vInizio, vFine);
    onClose();
  };

  const handleDelete = () => {
    openConfirm({
      title: 'Elimina Evento',
      message: 'Sei sicuro di voler eliminare questo evento? L\'azione è irreversibile.',
      isDestructive: true,
      onConfirm: () => {
        onDeleteHistory(rivenditaId, actualIndex);
        onClose();
      }
    });
  };

  if (editType === 'ORDINE') {
    const entry = extra.history[actualIndex];
    return (
      <OrderModule 
        isEditMode={true}
        initialCart={entry.items || []}
        initialNote={entry.note || ''}
        initialDataEvasione={entry.dataEvasione || entry.data?.split('T')[0]}
        onConfirmOrder={(cart, totaleEuro, note, dataEvasione) => {
          onEditHistory(
            rivenditaId, 
            actualIndex, 
            note, 
            totaleEuro, 
            entry.data?.split('T')[0], 
            entry.data?.split('T')[1]?.substring(0, 5), 
            entry.stato, 
            entry.isEseguito, // Mantiene lo stato originale (Bozza o Evaso) invece di forzare true
            entry.dataEsecuzione, 
            cart,
            dataEvasione
          );
          onClose();
        }}
        onCancel={handleCloseRequest}
        onDelete={handleDelete}
      />
    );
  }

  const configs = {
    VISITA: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', title: 'Modifica Visita' },
    ORDINE: { icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', title: 'Modifica Ordine' },
    HOSTESS: { icon: UserCheck, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', title: 'Modifica Hostess' },
  };
  const config = configs[editType];
  const Icon = config.icon;

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleCloseRequest}
    >
      <div 
        className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Smart */}
        <div className={`p-4 border-b flex items-center justify-between ${config.bg} ${config.border}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm ${config.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-base font-black text-slate-800 tracking-tight">{config.title}</h3>
              {editType === 'VISITA' && (
                <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mt-0.5 animate-in fade-in">
                  <Clock className="w-3 h-3" /> Durata totale: {durataMin} min
                </span>
              )}
            </div>
          </div>
          <button onClick={handleCloseRequest} className="p-2 bg-white/60 hover:bg-white rounded-full transition-colors text-slate-500 shadow-sm active:scale-95">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {editType === 'VISITA' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Orario del passaggio</label>
              
              {!isEditingTimeRange ? (
                /* RIGA DI RIEPILOGO STILE TILE (Pillola) */
                <button 
                  onClick={() => setIsEditingTimeRange(true)} 
                  className="w-full flex items-center justify-center gap-2 p-2.5 bg-white border border-slate-100 rounded-full shadow-sm hover:bg-slate-50 transition-colors group"
                >
                  <span className="text-sm font-bold text-slate-700">
                    {formattedData} <span className="text-slate-400 font-medium px-1">•</span> {oraInizio} - {ora}
                  </span>
                  <Edit3 className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 transition-colors" />
                </button>
              ) : (
                /* CONTROLLI EDIT TEMPORANEI (LAYOUT VERTICALE) */
                <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in zoom-in-95">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data della Visita</label>
                    <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full h-12 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-shadow" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ora Inizio</label>
                    <input type="time" value={oraInizio} onChange={(e) => setOraInizio(e.target.value)} className="w-full h-12 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-shadow" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ora Fine</label>
                    <div className="flex items-center gap-2">
                      <input type="time" value={ora} onChange={(e) => setOra(e.target.value)} className="flex-1 h-12 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-shadow" />
                      <button 
                        onClick={() => setIsEditingTimeRange(false)} 
                        className="h-12 w-12 flex items-center justify-center shrink-0 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 shadow-sm active:scale-95 transition-all" 
                        title="Conferma orari"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {editType !== 'VISITA' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Data</label>
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full h-12 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Ora</label>
                <input type="time" value={ora} onChange={(e) => setOra(e.target.value)} className="w-full h-12 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 transition-all" />
              </div>
            </div>
          )}

          {editType === 'ORDINE' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valore Ordine (€)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">€</span>
                <input type="number" inputMode="decimal" value={importo || ''} onChange={(e) => setImporto(Number(e.target.value))} className="w-full h-14 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner" placeholder="0.00" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5"/> Note e Dettagli</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 resize-none transition-all" placeholder="Aggiungi dettagli o articoli..." />
          </div>

          {editType === 'ORDINE' && (
            <div className="pt-2">
              <label className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.98] ${isEvaso ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                <input type="checkbox" checked={isEvaso} onChange={(e) => setIsEvaso(e.target.checked)} className="hidden" />
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors ${isEvaso ? 'bg-emerald-500 border-emerald-600 shadow-inner' : 'bg-slate-100 border-slate-300'}`}>
                    {isEvaso && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className={`text-sm font-black ${isEvaso ? 'text-emerald-800' : 'text-slate-600'}`}>Segna come Evaso / Completato</span>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <button onClick={handleDelete} className="w-10 h-10 flex items-center justify-center bg-white border border-red-200 text-red-500 rounded-xl hover:bg-red-50 active:scale-95 transition-all shadow-sm shrink-0" title="Elimina Evento">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={handleSave} className={`flex-1 h-10 flex items-center justify-center gap-2 text-white font-bold text-sm rounded-xl border-b-[3px] active:border-b active:translate-y-[2px] transition-all shadow-sm ${editType === 'ORDINE' && isEvaso ? 'bg-emerald-600 border-emerald-700 hover:bg-emerald-700' : 'bg-brand-600 border-brand-700 hover:bg-brand-700'}`}>
            {editType === 'ORDINE' && isEvaso ? 'Salva e Archivia' : 'Salva Modifiche'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickEditModal;
