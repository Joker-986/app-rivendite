import React, { useState, useEffect, useMemo } from 'react';
import { 
  Upload, Search, Phone, Mail, MapPin, Users, MessageCircle, 
  X, Trash2, Save, UserPlus, Package, Filter, Image as ImageIcon, Edit3, CheckCircle2
} from 'lucide-react';
import { useModals } from '../contexts/ModalContext';

interface Contact {
  id: string;
  descrizione: string;
  indirizzo: string;
  cap: string;
  citta: string;
  telefono: string;
  email: string;
  codLogista: string;
  numRivendita: string;
}

const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const AnagraficaTab: React.FC = () => {
  const { openConfirm } = useModals();
  
  // Inizializzazione Sincrona dello Stato (Lazy Init)
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const saved = localStorage.getItem('anagrafica_contacts');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState<Contact | null>(null);

  const [isPromoMode, setIsPromoMode] = useState(false);
  const [promoText, setPromoText] = useState(() => localStorage.getItem('tgest_promo_text') || '');
  const [promoImagePreview, setPromoImagePreview] = useState<string | null>(null);
  const [isImageCopied, setIsImageCopied] = useState(false);

  useEffect(() => {
    localStorage.setItem('tgest_promo_text', promoText);
  }, [promoText]);

  // Funzione per convertire qualsiasi immagine in PNG e copiarla negli appunti (Requisito Clipboard API)
  const copyImageToClipboard = async (file: File) => {
    try {
      if (!file.type.startsWith('image/')) {
        alert("Per favore, seleziona un'immagine valida.");
        return;
      }
      
      let blobToCopy: Blob = file;
      
      // Se non è PNG, usiamo Canvas per convertirla al volo (Safari/Chrome Mobile lo pretendono)
      if (file.type !== 'image/png') {
        const img = new Image();
        const url = URL.createObjectURL(file);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
              if (blob) { blobToCopy = blob; resolve(null); } 
              else reject(new Error('Canvas toBlob fallito'));
            }, 'image/png');
          };
          img.onerror = () => reject(new Error('Errore caricamento immagine'));
          img.src = url;
        });
      }

      const item = new ClipboardItem({ 'image/png': blobToCopy });
      await navigator.clipboard.write([item]);
      
      setIsImageCopied(true);
      setTimeout(() => setIsImageCopied(false), 3000);
      
    } catch (err) {
      console.error("Errore Clipboard:", err);
      alert("Il tuo browser ha bloccato la copia automatica. Dovrai copiare l'immagine manualmente dalla Galleria.");
    }
  };

  const handlePromoImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPromoImagePreview(url);
    copyImageToClipboard(file);
    e.target.value = ''; // Reset input
  };

  // Salvataggio automatico
  useEffect(() => {
    localStorage.setItem('anagrafica_contacts', JSON.stringify(contacts));
  }, [contacts]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const separator = text.includes(';') ? ';' : ',';
      const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      
      const newContacts: Contact[] = lines.slice(1)
        .filter(line => line.trim())
        .map((line, index) => {
          const regex = new RegExp(`\\s*${separator}\\s*(?=(?:[^"]*"[^"]*")*[^"]*$)`);
          const values = line.split(regex).map(v => v?.trim().replace(/^"|"$/g, '') || '');
          const data: any = {};
          headers.forEach((header, i) => { data[header] = values[i] || ''; });

          return {
            id: `contact-${Date.now()}-${index}`,
            descrizione: data['descrizione'] || data['ragione sociale'] || data['nome'] || '',
            indirizzo: data['indirizzo'] || data['via'] || '',
            cap: data['cap'] || '',
            citta: data['città'] || data['citta'] || data['comune'] || '',
            telefono: data['telefono'] || data['cellulare'] || data['tel'] || '',
            email: data['email'] || data['e-mail'] || '',
            codLogista: data['cod logista'] || data['codice logista'] || data['logista'] || data['cod. logista'] || '',
            numRivendita: data['num. rivendita'] || data['rivendita'] || data['codice'] || data['num riv'] || ''
          };
        });

      setContacts(prev => {
        const merged = [...prev];
        newContacts.forEach(nc => {
          if (!nc.descrizione) return; 
          const existingIndex = merged.findIndex(c => 
            (c.codLogista && nc.codLogista && c.codLogista === nc.codLogista) || 
            (c.descrizione.toLowerCase() === nc.descrizione.toLowerCase())
          );
          if (existingIndex >= 0) {
            merged[existingIndex] = { ...merged[existingIndex], ...nc, id: merged[existingIndex].id };
          } else {
            merged.push(nc);
          }
        });
        return merged;
      });
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const cities = useMemo(() => {
    const allCities = contacts.map(c => c.citta).filter(Boolean);
    return Array.from(new Set(allCities)).sort();
  }, [contacts]);

  const filteredAndSortedContacts = useMemo(() => {
    let result = [...contacts];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.descrizione.toLowerCase().includes(term) ||
        c.citta.toLowerCase().includes(term) ||
        (c.telefono && c.telefono.includes(term)) // Ricerca per numero di telefono
      );
    }
    if (selectedCity) {
      result = result.filter(c => c.citta === selectedCity);
    }
    return result.sort((a, b) => {
      const valA = a.numRivendita || '';
      const valB = b.numRivendita || '';
      
      // I contatti senza numero di rivendita vanno in fondo alla lista
      if (!valA && valB) return 1;
      if (valA && !valB) return -1;
      
      // Ordinamento numerico naturale (gestisce correttamente 1, 2, 10...)
      return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [contacts, searchTerm, selectedCity]);

  const downloadVCard = (contact: Contact, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.descrizione}\nTEL;TYPE=CELL:${contact.telefono.replace(/\s+/g, '')}\nEMAIL:${contact.email}\nADR:;;${contact.indirizzo};${contact.citta};;${contact.cap};\nNOTE:Logista: ${contact.codLogista}\nEND:VCARD`;
    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.download = `${contact.descrizione.replace(/\W/g, '_')}.vcf`;
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveContact = () => {
    if (!editForm) return;
    const exists = contacts.some(c => c.id === editForm.id);
    if (exists) {
      setContacts(prev => prev.map(c => c.id === editForm.id ? editForm : c));
    } else {
      setContacts(prev => [editForm, ...prev]);
    }
    setSelectedContact(null);
    setEditForm(null);
  };

  const handleDeleteContact = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    openConfirm({
      title: 'Elimina Contatto',
      message: 'Sei sicuro di voler eliminare definitivamente questo contatto?',
      isDestructive: true,
      onConfirm: () => {
        setContacts(prev => prev.filter(c => c.id !== id));
        if (selectedContact?.id === id || editForm?.id === id) {
          setSelectedContact(null);
          setEditForm(null);
        }
      }
    });
  };

  const handleAddNew = () => {
    const newContact: Contact = {
      id: `contact-${Date.now()}`,
      descrizione: '',
      indirizzo: '',
      cap: '',
      citta: '',
      telefono: '',
      email: '',
      codLogista: '',
      numRivendita: ''
    };
    setSelectedContact(newContact);
    setEditForm(newContact);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      
      {/* HEADER */}
      <div className="p-4 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-slate-800 tracking-tighter">Rubrica</h2>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleAddNew}
              className="h-10 px-4 bg-brand-600 text-white text-[10px] font-black rounded-xl cursor-pointer flex items-center gap-2 shadow-lg shadow-brand-100 active:scale-95 transition-all uppercase tracking-widest"
            >
              <UserPlus className="w-3.5 h-3.5" /> Nuovo
            </button>
            <div className="flex items-center bg-slate-50 border border-slate-100 rounded-xl p-0.5">
              <label className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors" title="Importa CSV">
                <Upload className="w-4 h-4" /> 
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
              {contacts.length > 0 && (
                <button 
                  onClick={() => openConfirm({
                    title: 'Svuota Rubrica',
                    message: 'Sei sicuro di voler eliminare TUTTI i contatti? L\'azione è irreversibile.',
                    isDestructive: true,
                    onConfirm: () => setContacts([])
                  })} 
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors" 
                  title="Svuota rubrica"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none font-bold placeholder:font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/20 transition-all" />
        </div>

        {/* FILTRO CITTÀ */}
        {cities.length > 0 && (
          <div className="mt-3 relative">
            <select 
              value={selectedCity} 
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full p-3 bg-slate-100 border-none rounded-xl text-[10px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer text-slate-600 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Tutte le città</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Filter className="w-3 h-3 text-slate-400" />
            </div>
          </div>
        )}

        {/* MODALITÀ PROMO WHATSAPP */}
        <div className="mt-4">
          <div 
            onClick={() => setIsPromoMode(!isPromoMode)}
            className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all border shadow-sm ${
              isPromoMode ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl flex items-center justify-center ${isPromoMode ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className={`text-sm font-black uppercase tracking-widest ${isPromoMode ? 'text-emerald-800' : 'text-slate-700'}`}>Modalità Promo</h3>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  {isPromoMode ? 'Clicca su un contatto per inviare' : 'Invio messaggi massivi'}
                </p>
              </div>
            </div>
            <div className={`w-10 h-5 rounded-full p-1 transition-colors ${isPromoMode ? 'bg-emerald-500' : 'bg-slate-200'}`}>
              <div className={`w-3 h-3 bg-white rounded-full transition-transform shadow-sm ${isPromoMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </div>

          {isPromoMode && (
            <div className="mt-2 p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl animate-in slide-in-from-top-2 space-y-3">
              <div>
                <label className="text-[9px] font-black text-emerald-800 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Edit3 className="w-3 h-3" /> Testo Messaggio
                </label>
                <textarea
                  value={promoText}
                  onChange={(e) => setPromoText(e.target.value)}
                  placeholder="Es. Scopri la nuova offerta su..."
                  className="w-full p-3 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 resize-none h-20 shadow-sm"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <label className="flex-1 px-3 py-2 bg-white border border-emerald-200 text-emerald-700 text-[10px] font-black rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-sm hover:bg-emerald-50 active:scale-95 transition-all uppercase tracking-widest">
                  <ImageIcon className="w-3.5 h-3.5" /> 
                  {promoImagePreview ? 'Cambia Locandina' : 'Allega Locandina'}
                  <input type="file" accept="image/*" onChange={handlePromoImageSelect} className="hidden" />
                </label>
                
                {promoImagePreview && (
                  <div className="relative shrink-0">
                    <img src={promoImagePreview} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-emerald-200 shadow-sm" />
                    <button onClick={() => setPromoImagePreview(null)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-md">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
              
              {isImageCopied && (
                <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-1 rounded-lg w-fit animate-pulse uppercase tracking-widest">
                  <CheckCircle2 className="w-3 h-3" /> Immagine in memoria: Apri chat e incolla!
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* LISTA CONTATTI */}
      <div className="flex-1 overflow-y-auto pb-20 divide-y divide-slate-100">
        {filteredAndSortedContacts.map(contact => (
          <div key={contact.id} onClick={() => { setSelectedContact(contact); setEditForm(contact); }} className="p-3 bg-white active:bg-slate-50 flex flex-col cursor-pointer transition-colors">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                {(contact.codLogista?.toUpperCase().includes('SVAPO') || contact.numRivendita) && (
                  <span className="px-1.5 py-0.5 bg-brand-100 text-brand-800 text-[9px] font-black rounded shrink-0 uppercase tracking-tighter shadow-sm">
                    {contact.codLogista?.toUpperCase().includes('SVAPO') ? contact.codLogista : contact.numRivendita}
                  </span>
                )}
                <h3 className="font-black text-slate-800 text-base leading-none truncate">{contact.descrizione}</h3>
              </div>
              
              {/* Indirizzo con interlinea aumentata (mt-2 invece di mt-1) */}
              <div className="flex items-center gap-1.5 text-slate-500 mt-2">
                <MapPin className="w-3 h-3 shrink-0" />
                <p className="text-[10px] font-bold truncate uppercase tracking-tight">{contact.indirizzo}, {contact.citta}</p>
              </div>
            </div>

            {/* AZIONI RAPIDE */}
            <div className="flex items-center gap-2 mt-3.5">
              {contact.telefono && (
                <>
                  <a href={`tel:${contact.telefono}`} onClick={e => e.stopPropagation()} className="px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg flex items-center gap-1.5 active:bg-blue-100 transition-colors shadow-sm">
                    <Phone className="w-3.5 h-3.5" /> <span className="text-[10px] font-black uppercase">Chiama</span>
                  </a>
                  <a 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const cleanPhone = contact.telefono.replace(/\D/g, '');
                      const baseUrl = `https://wa.me/39${cleanPhone}`;
                      const finalUrl = (isPromoMode && promoText.trim() !== '') 
                        ? `${baseUrl}?text=${encodeURIComponent(promoText)}` 
                        : baseUrl;
                      window.open(finalUrl, '_blank');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm ${
                      isPromoMode 
                        ? 'bg-emerald-500 text-white active:bg-emerald-600 animate-pulse shadow-emerald-200' 
                        : 'bg-emerald-50 text-emerald-600 active:bg-emerald-100'
                    }`}
                    title={isPromoMode ? "Invia Promo su WhatsApp" : "Chatta su WhatsApp"}
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> 
                    <span className="text-[10px] font-black uppercase tracking-wider">{isPromoMode ? 'PROMO' : 'WhatsApp'}</span>
                  </a>
                </>
              )}
              {contact.citta && (
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.indirizzo + ' ' + contact.citta)}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  onClick={e => e.stopPropagation()} 
                  className="px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg flex items-center gap-1.5 active:bg-red-100 transition-colors shadow-sm"
                >
                  <MapPin className="w-3.5 h-3.5" /> <span className="text-[10px] font-black uppercase">Mappa</span>
                </a>
              )}
              
              {/* Tasto vCard isolato a destra (ml-auto) */}
              <div className="ml-auto flex items-center gap-2">
                <button 
                  onClick={e => downloadVCard(contact, e)} 
                  className="p-2 bg-slate-100 text-slate-600 rounded-lg active:bg-slate-200 transition-colors shadow-sm" 
                  title="Salva nel telefono"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
                <button 
                  onClick={e => handleDeleteContact(contact.id, e)} 
                  className="p-2 bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg active:scale-90 transition-all shadow-sm" 
                  title="Elimina"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* POPUP MODALE SCHEDA */}
      {selectedContact && editForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 p-0 sm:p-4">
          <div className="w-full max-w-md max-h-[92vh] bg-slate-50 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-6 duration-300">
            
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between rounded-t-3xl shrink-0">
              <button onClick={() => { setSelectedContact(null); setEditForm(null); }} className="flex items-center gap-1 text-slate-400 hover:text-slate-800 font-black text-xs uppercase tracking-widest transition-colors">
                <X className="w-5 h-5" /> CHIUDI
              </button>
              <div className="flex gap-2">
                {contacts.some(c => c.id === editForm.id) && (
                  <>
                    <button onClick={() => downloadVCard(editForm)} className="p-2 text-blue-600 bg-blue-50 rounded-lg" title="Salva vCard"><UserPlus className="w-5 h-5" /></button>
                    <button onClick={() => handleDeleteContact(editForm.id)} className="p-2 text-red-500 bg-red-50 rounded-lg" title="Elimina"><Trash2 className="w-5 h-5" /></button>
                  </>
                )}
              </div>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {contacts.some(c => c.id === editForm.id) ? 'Anagrafica Rivendita' : 'Nuova Rivendita'}
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-1 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 ml-1 uppercase">RIV.</label>
                    <input type="text" value={editForm.numRivendita} onChange={e => setEditForm({...editForm, numRivendita: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none" />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 ml-1 uppercase">RAGIONE SOCIALE</label>
                    <input type="text" value={editForm.descrizione} onChange={e => setEditForm({...editForm, descrizione: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div className="col-span-4 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 ml-1 uppercase">INDIRIZZO</label>
                    <input type="text" value={editForm.indirizzo} onChange={e => setEditForm({...editForm, indirizzo: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 ml-1 uppercase">CITTÀ</label>
                    <input type="text" value={editForm.citta} onChange={e => setEditForm({...editForm, citta: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 ml-1 uppercase">CAP</label>
                    <input type="text" value={editForm.cap} onChange={e => setEditForm({...editForm, cap: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recapiti & Logista</h4>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 ml-1 uppercase">TELEFONO</label>
                  <input type="text" value={editForm.telefono} onChange={e => setEditForm({...editForm, telefono: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 ml-1 uppercase">EMAIL</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 ml-1 uppercase flex items-center gap-1"><Package className="w-3 h-3" /> CODICE LOGISTA</label>
                  <input type="text" value={editForm.codLogista} onChange={e => setEditForm({...editForm, codLogista: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black tracking-widest outline-none" />
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 shrink-0 sm:rounded-b-3xl shadow-lg">
              <button 
                onClick={handleSaveContact} 
                className={`w-full py-4 text-white font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all uppercase text-xs tracking-widest shadow-xl ${
                   contacts.some(c => c.id === editForm.id) ? 'bg-slate-800' : 'bg-brand-600'
                }`}
              >
                <Save className="w-5 h-5" /> {contacts.some(c => c.id === editForm.id) ? 'SALVA MODIFICHE' : 'CREA CONTATTO'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default AnagraficaTab;
