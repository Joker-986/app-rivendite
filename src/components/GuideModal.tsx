import React from 'react';
import { X, BookOpen, Search, Navigation, BookOpen as CrmIcon, Phone, Share2, Save } from 'lucide-react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-600" />
            <h3 className="text-lg font-bold text-slate-900">Guida all'App</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto space-y-6 text-sm text-slate-600">
          <section>
            <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><Search className="w-4 h-4"/> 1. Ricerca e Aggiunta</h4>
            <p>Usa la scheda <strong>Cerca</strong> selezionando Regione e Provincia. Usa i filtri per restringere i risultati. Clicca sull'icona della <strong>Cartellina</strong> per aggiungere al Giro.</p>
          </section>
          <section>
            <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><Navigation className="w-4 h-4"/> 2. Il Giro Visite</h4>
            <p>Usa le <strong>Frecce Su/Giù</strong> per riordinare le tappe. Clicca "Naviga" per la mappa. Clicca "Rivendita Visitata" per segnare l'orario.</p>
          </section>
          <section>
            <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><CrmIcon className="w-4 h-4"/> 3. CRM e Filtri Avanzati</h4>
            <p>In <strong>Dettagli</strong> compila la scheda completa. Cliccando "Salva nel CRM" la rivendita diventerà permanente. Usa i <strong>Filtri Avanzati</strong> per le ricerche rapide.</p>
          </section>
          <section>
            <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><Phone className="w-4 h-4"/> 4. Contatti e Chiamate</h4>
            <p>I numeri di telefono sono <strong>link cliccabili</strong>. Se mancano, usa "Orari e contatti" per l'AI.</p>
          </section>
          <section>
            <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><Share2 className="w-4 h-4"/> 5. Condivisione e Report</h4>
            <p>Il tasto <strong>Condividi</strong> genera un resoconto perfetto per WhatsApp con tutto lo storico.</p>
          </section>
          <section>
            <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><Save className="w-4 h-4"/> 6. Backup e Sicurezza</h4>
            <p>L'app salva localmente. Usa regolarmente <strong>Esporta Backup</strong> nelle Impostazioni per sicurezza.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default GuideModal;
