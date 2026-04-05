import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SearchResult } from '../types';

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateStore: (store: Partial<SearchResult>) => void;
}

const INITIAL_STORE_STATE: Partial<SearchResult> = {
  'Prov.': '',
  'Comune': '',
  'Num. Rivendita': '',
  'Indirizzo': '',
  'Tipo Rivendita': '',
  'Distr. Automatico': '',
  storeName: '',
  storeNumber: '',
  isChain: false,
  chainCount: 1,
  rivenditaUfficiale: '',
  pec: ''
};

export default function StoreModal({ isOpen, onClose, onCreateStore }: StoreModalProps) {
  const [newStore, setNewStore] = useState<Partial<SearchResult>>(INITIAL_STORE_STATE);

  useEffect(() => {
    if (isOpen) {
      setNewStore(INITIAL_STORE_STATE);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900">Nuovo Store</h3>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            onCreateStore(newStore);
          }} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome Store *</label>
              <input 
                value={newStore.storeName || ''} 
                onChange={(e) => setNewStore({...newStore, storeName: e.target.value})} 
                required 
                placeholder="Es. Svapo World" 
                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold text-brand-700" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <input 
                type="text" 
                placeholder="RIV. (Opzionale)" 
                value={newStore.rivenditaUfficiale || ''} 
                onChange={(e) => setNewStore({...newStore, rivenditaUfficiale: e.target.value})} 
                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none" 
              />
              <input 
                type="email" 
                placeholder="PEC (Opzionale)" 
                value={newStore.pec || ''} 
                onChange={(e) => setNewStore({...newStore, pec: e.target.value})} 
                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Numero Store</label>
                <input 
                  value={newStore.storeNumber || ''} 
                  onChange={(e) => setNewStore({...newStore, storeNumber: e.target.value, 'Num. Rivendita': e.target.value})} 
                  placeholder="Es. 101" 
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo Attività</label>
                <select 
                  value={newStore.isChain ? 'true' : 'false'} 
                  onChange={(e) => setNewStore({...newStore, isChain: e.target.value === 'true'})} 
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium"
                >
                  <option value="false">Attività Singola</option>
                  <option value="true">Catena</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Provincia *</label>
                <input 
                  value={newStore['Prov.'] || ''} 
                  onChange={(e) => setNewStore({...newStore, 'Prov.': e.target.value.toUpperCase()})} 
                  required 
                  placeholder="Es. MI" 
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comune *</label>
                <input 
                  value={newStore['Comune'] || ''} 
                  onChange={(e) => setNewStore({...newStore, 'Comune': e.target.value})} 
                  required 
                  placeholder="Es. Milano" 
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Indirizzo *</label>
              <input 
                value={newStore['Indirizzo'] || ''} 
                onChange={(e) => setNewStore({...newStore, 'Indirizzo': e.target.value})} 
                required 
                placeholder="Via Roma 1" 
                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo Rivendita</label>
                <input 
                  value={newStore['Tipo Rivendita'] || ''} 
                  onChange={(e) => setNewStore({...newStore, 'Tipo Rivendita': e.target.value})} 
                  placeholder="Es. SVAPO STORE" 
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Distr. Automatico</label>
                <input 
                  value={newStore['Distr. Automatico'] || ''} 
                  onChange={(e) => setNewStore({...newStore, 'Distr. Automatico': e.target.value})} 
                  placeholder="SI/NO" 
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium" 
                />
              </div>
            </div>
            
            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl text-sm hover:bg-slate-200 transition-all"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="flex-1 py-4 bg-gradient-to-b from-brand-500 to-brand-600 text-white font-bold rounded-2xl border border-brand-700 border-b-[4px] hover:brightness-110 active:border-b active:translate-y-[3px] text-sm transition-all shadow-md"
              >
                Crea Store
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
