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
  onEditHistory: (id: string, index: number, note: string, importo: number, data?: string, ora?: string, stato?: string, isEseguito?: boolean, dataEsecuzione?: string, items?: any[]) => void;
  onDeleteHistory: (id: string, index: number) => void;
  targetHistoryIndex?: number;
}

const QuickEditModal: React.FC<QuickEditModalProps> = ({
  isOpen, onClose, editType, rivenditaId, extra, onUpdateRubrica, onEditHistory, onDeleteHistory, targetHistoryIndex
}) => {
  const { openConfirm } = useModals();

  const [data, setData] = useState('');
  const [ora, setOra] = useState('');
  const [note, setNote] = useState('');
  const [importo, setImporto] = useState<number>(0);
  const [isEvaso, setIsEvaso] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [dataEvasione, setDataEvasione] = useState('');
  
  // Stato per salvare la "Fotografia" iniziale dei dati
  const [initialState, setInitialState] = useState({ data: '', ora: '', note: '', importo: 0, isEvaso: false, items: [] as any[], dataEvasione: '' });

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
        const initNote = entry.note || '';
        const initImporto = entry.importo || 0;
        const initEvaso = entry.isEseguito === true;
        const initItems = entry.items || [];
        const initDataEvasione = entry.dataEvasione || '';

        // Impostiamo i dati visibili
        setData(initData);
        setOra(initOra);
        setNote(initNote);
        setImporto(initImporto);
        setIsEvaso(initEvaso);
        setItems(initItems);
        setDataEvasione(initDataEvasione);

        // Salviamo la fotografia per il confronto
        setInitialState({
          data: initData,
          ora: initOra,
          note: initNote,
          importo: initImporto,
          isEvaso: initEvaso,
          items: initItems,
          dataEvasione: initDataEvasione
        });
      }
    }
  }, [isOpen, editType, extra, actualIndex]);

  if (!isOpen || !editType || actualIndex < 0) return null;

  // FUNZIONE PARACADUTE
  const handleCloseRequest = () => {
    const hasChanges = 
      data !== initialState.data || 
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
    onEditHistory(rivenditaId, actualIndex, note, importo, data, ora, newStato, isEvaso, isEvaso ? new Date().toISOString() : undefined, items);
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
            true, 
            entry.dataEsecuzione || new Date().toISOString(), 
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
        <div className={`p-5 border-b flex items-center justify-between ${config.bg} ${config.border}`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm ${config.color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">{config.title}</h3>
          </div>
          <button onClick={handleCloseRequest} className="p-2.5 bg-white/60 hover:bg-white rounded-full transition-colors text-slate-500 shadow-sm active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
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
        <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <button onClick={handleDelete} className="w-14 h-14 flex items-center justify-center bg-white border border-red-200 text-red-500 rounded-2xl hover:bg-red-50 active:scale-95 transition-all shadow-sm shrink-0" title="Elimina Evento">
            <Trash2 className="w-6 h-6" />
          </button>
          <button onClick={handleSave} className={`flex-1 h-14 flex items-center justify-center gap-2 text-white font-bold rounded-2xl border-b-[4px] active:border-b active:translate-y-[3px] transition-all shadow-md ${editType === 'ORDINE' && isEvaso ? 'bg-emerald-600 border-emerald-700 hover:bg-emerald-700' : 'bg-brand-600 border-brand-700 hover:bg-brand-700'}`}>
            {editType === 'ORDINE' && isEvaso ? 'Salva e Archivia' : 'Salva Modifiche'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickEditModal;
