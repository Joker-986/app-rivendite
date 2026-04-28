import React, { useState, useRef } from 'react';
import { 
  Package, Plus, Trash2, Edit2, Save, X, 
  Search, Filter, ArrowUpDown, MoreVertical,
  ChevronRight, AlertCircle, CheckCircle2,
  Tag, DollarSign, Layers, Info, Archive, Upload
} from 'lucide-react';
import { useProducts } from '../contexts/ProductContext';
import { useModals } from '../contexts/ModalContext';
import { Product } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

const WarehouseTab: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, bulkImportProducts } = useProducts();
  const { openConfirm } = useModals();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        // Parser CSV per standard Excel Italia (punto e virgola)
        const rows = text.split('\n').map(row => row.split(';'));
        if (rows.length < 2) {
           alert('File CSV vuoto o formato non valido.');
           return;
        }

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const idxCodice = headers.indexOf('codice');
        const idxDescrizione = headers.indexOf('descrizione');
        const idxPrezzo = headers.findIndex(h => h.includes('prezzo'));
        const idxUnita = headers.indexOf('unita');
        const idxPezzi = headers.findIndex(h => h.includes('pezzi'));
        const idxCategoria = headers.indexOf('categoria');

        if (idxCodice === -1 || idxDescrizione === -1 || idxPrezzo === -1) {
          alert('Colonne mancanti! Il file CSV deve contenere almeno le colonne: codice; descrizione; prezzoUnita');
          return;
        }

        const productsToImport: Omit<Product, 'id'>[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length < 3 || !row[idxCodice]) continue; 

          const unitaRaw = idxUnita !== -1 && row[idxUnita] ? row[idxUnita].trim() : 'Pezzi';
          const isStecche = unitaRaw.toLowerCase() === 'stecche';
          
          // Converte le virgole italiane in punti per il motore matematico
          const prezzoStr = row[idxPrezzo].replace(',', '.').replace(/[^0-9.]/g, '');

          productsToImport.push({
            codice: row[idxCodice].trim().toUpperCase(),
            descrizione: row[idxDescrizione].trim(),
            prezzoUnita: parseFloat(prezzoStr) || 0,
            unita: isStecche ? 'Stecche' : 'Pezzi',
            pezziPerStecca: isStecche && idxPezzi !== -1 && row[idxPezzi] ? (parseInt(row[idxPezzi]) || 10) : undefined,
            categoria: idxCategoria !== -1 && row[idxCategoria] ? row[idxCategoria].trim() : ''
          });
        }

        bulkImportProducts(productsToImport);
        alert(`Importazione completata! Elaborati ${productsToImport.length} prodotti.`);
      } catch (err) {
        alert('Errore di lettura CSV. Assicurati di aver salvato il file in formato CSV (delimitato dal separatore).');
      }
      
      if (e.target) e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleDelete = (id: string, descrizione: string) => {
    openConfirm({
      title: 'Archivia Prodotto',
      message: `Sei sicuro di voler archiviare "${descrizione}"? Il prodotto non sarà più selezionabile, ma rimarrà nello storico per i vecchi ordini.`,
      isDestructive: true,
      confirmText: 'Sì, Archivia',
      onConfirm: () => deleteProduct(id)
    });
  };

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  // Form state
  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    codice: '',
    descrizione: '',
    prezzoUnita: 0,
    unita: 'Pezzi',
    pezziPerStecca: 10,
    categoria: ''
  });

  const handleAdd = () => {
    if (!formData.codice || !formData.descrizione) return;
    addProduct(formData);
    setFormData({ codice: '', descrizione: '', prezzoUnita: 0, unita: 'Pezzi', pezziPerStecca: 10, categoria: '' });
    setIsAdding(false);
  };

  const handleUpdate = (id: string) => {
    const product = products.find(p => p.id === id);
    if (product) {
      updateProduct(id, formData);
      setEditingId(null);
      setFormData({ codice: '', descrizione: '', prezzoUnita: 0, unita: 'Pezzi', pezziPerStecca: 10, categoria: '' });
    }
  };

  const startEditing = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      codice: product.codice,
      descrizione: product.descrizione,
      prezzoUnita: product.prezzoUnita,
      unita: product.unita,
      pezziPerStecca: product.pezziPerStecca || 10,
      categoria: product.categoria || ''
    });
  };

  const uniqueCategories = Array.from(new Set(products.map(p => p.categoria).filter(Boolean))) as string[];
  
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.codice.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.descrizione.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = showArchived ? true : p.attivo !== false;
    const matchesCategory = selectedCategory ? p.categoria === selectedCategory : true;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 pb-24">
      <div className="flex items-center justify-between mb-6 px-1">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Magazzino</h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gestione SKU e Listino</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleImportCSV} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 p-3 rounded-xl shadow-sm transition-all flex items-center gap-2"
            title="Importa da CSV Excel"
          >
            <Upload className="w-5 h-5 text-brand-600" />
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white p-3 rounded-xl shadow-lg shadow-brand-200 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="text-xs font-bold hidden sm:inline pr-1">Aggiungi</span>
          </button>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {(isAdding || editingId) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-6 bg-brand-500 rounded-full"></div>
                  <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">
                    {editingId ? 'Modifica Prodotto' : 'Nuovo Prodotto'}
                  </h3>
                </div>
                <button 
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                    setFormData({ codice: '', descrizione: '', prezzoUnita: 0, unita: 'Pezzi', categoria: '' });
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content area with scroll */}
              <div className="overflow-y-auto p-6 space-y-4 flex-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Codice *</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="SKU"
                      value={formData.codice}
                      onChange={e => setFormData({...formData, codice: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrizione *</label>
                  <input 
                    type="text"
                    placeholder="Nome Prodotto"
                    value={formData.descrizione}
                    onChange={e => setFormData({...formData, descrizione: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                  <div className="relative">
                    <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      list="categories"
                      placeholder="Cerca o inserisci..."
                      value={formData.categoria || ''}
                      onChange={e => setFormData({...formData, categoria: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-500 focus:bg-white transition-all"
                    />
                    <datalist id="categories">
                      {uniqueCategories.map(cat => <option key={cat} value={cat} />)}
                    </datalist>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prezzo *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.prezzoUnita || ''}
                      onChange={e => setFormData({...formData, prezzoUnita: parseFloat(e.target.value) || 0})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unità *</label>
                  <div className="relative">
                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select 
                      value={formData.unita}
                      onChange={e => setFormData({...formData, unita: e.target.value as 'Pezzi' | 'Stecche'})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-500 focus:bg-white appearance-none transition-all"
                    >
                      <option value="Pezzi">Pezzi</option>
                      <option value="Stecche">Stecche</option>
                    </select>
                  </div>
                </div>

                {formData.unita === 'Stecche' && (
                  <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pezzi *</label>
                    <div className="relative">
                      <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number"
                        min="1"
                        placeholder="Pz/Stecca"
                        value={formData.pezziPerStecca || ''}
                        onChange={e => setFormData({...formData, pezziPerStecca: Math.max(1, parseInt(e.target.value) || 1)})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 bg-slate-50/50">
                <button 
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                    setFormData({ codice: '', descrizione: '', prezzoUnita: 0, unita: 'Pezzi', categoria: '' });
                  }}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs transition-all hover:bg-slate-50"
                >
                  ANNULLA
                </button>
                <button 
                  onClick={() => editingId ? handleUpdate(editingId) : handleAdd()}
                  className="px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-brand-900/10 transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingId ? 'SALVA' : 'CONFERMA'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cerca per SKU o descrizione..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-sm font-medium"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-brand-500 transition-all flex-1 sm:flex-none appearance-none"
            >
              <option value="">Tutte le Cat.</option>
              {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <button 
              onClick={() => setShowArchived(!showArchived)}
              className={`w-[46px] h-[46px] rounded-xl border flex items-center justify-center transition-all shrink-0 ${
                showArchived ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title={showArchived ? 'Nascondi Archiviati' : 'Mostra Archiviati'}
            >
              <Archive className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product, index) => (
            <div 
              key={product.id} 
              className={`flex items-center p-3 transition-colors ${
                index !== filteredProducts.length - 1 ? 'border-b border-slate-100' : ''
              } ${product.attivo === false ? 'opacity-40 grayscale' : 'hover:bg-slate-50'}`}
            >
              {/* Info Principali (SKU + Categoria + Nome) */}
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none break-all">
                    {product.codice}
                  </span>
                  {product.categoria && (
                    <span className="text-[8px] font-black text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100 uppercase tracking-wider leading-none">
                      {product.categoria}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight break-words">
                  {product.descrizione}
                </h3>
              </div>

              {/* Prezzo e Azioni */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900 leading-none">
                    €{product.prezzoUnita.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[8px] font-black text-slate-400 uppercase mt-1 leading-none">{product.unita}</p>
                </div>
                
                <div className="flex items-center gap-0.5 border-l border-slate-200 pl-1.5 ml-1">
                  <button onClick={() => startEditing(product)} className="p-2 text-slate-400 hover:text-brand-600 rounded-lg transition-colors"><Edit2 className="w-[18px] h-[18px]" /></button>
                  <button onClick={() => handleDelete(product.id, product.descrizione)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors"><Trash2 className="w-[18px] h-[18px]" /></button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 flex flex-col items-center gap-3 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-400">Nessun prodotto trovato nel magazzino.</p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-[2.5rem] flex items-start gap-4">
        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <Info className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-black text-indigo-900 uppercase tracking-tight">Nota Informativa</h4>
          <p className="text-xs text-indigo-700 font-medium leading-relaxed">
            I prodotti inseriti in questo magazzino saranno disponibili per la creazione di missioni "Focus Prodotto" nella Camera di Regia e per la compilazione degli ordini nel CRM. Assicurati che gli SKU siano univoci per evitare conflitti.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WarehouseTab;
