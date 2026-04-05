import React from 'react';
import { RefreshCw, MapPin, Filter, GripVertical, Phone, Layout, X } from 'lucide-react';

interface ChangelogModalProps {
  isOpen: boolean;
  version: string;
  onClose: () => void;
}

const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, version, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
              <RefreshCw className="w-6 h-6 text-brand-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Novità dell'App</h3>
              <span className="text-sm font-medium text-brand-600">Versione {version}</span>
            </div>
          </div>
          
          <div className="space-y-4 mb-6 text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100 h-80 overflow-y-auto">
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-brand-500"/> Gestione C.A.P. Manuale</h4>
              <p className="mt-1">Dato che i server esterni non forniscono il CAP, ora puoi inserirlo manualmente nei dettagli della rivendita. Una volta salvato, comparirà ovunque e potrai usarlo per filtrare le zone!</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5"><Filter className="w-4 h-4 text-brand-500"/> Filtri Avanzati a Scomparsa</h4>
              <p className="mt-1">I filtri nel CRM ora sono racchiusi in un elegante menu a tendina per salvare spazio sullo schermo. Un led luminoso ti avviserà se hai dei filtri attivi dimenticati.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5"><GripVertical className="w-4 h-4 text-brand-500"/> Nuovo Ordinamento Giro</h4>
              <p className="mt-1">Abbiamo sostituito il trascinamento (spesso impreciso sui telefoni) con delle precisissime Frecce Su/Giù per riordinare le tue visite in modo infallibile.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5"><Phone className="w-4 h-4 text-brand-500"/> Chiamate Rapide One-Tap</h4>
              <p className="mt-1">I numeri di telefono inseriti manualmente nel CRM ora sono link cliccabili. Sfiorali per far partire immediatamente la chiamata senza fare copia e incolla.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5"><Layout className="w-4 h-4 text-brand-500"/> FAB Multifunzione</h4>
              <p className="mt-1">Il tasto in basso a destra ora è un menu animato rapido per Reset, Impostazioni e Sync Volante.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3.5 bg-brand-600 text-white font-bold rounded-2xl text-sm shadow-lg shadow-brand-100 hover:bg-brand-700 active:scale-95 transition-all"
          >
            Ho capito, non mostrare più
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;
