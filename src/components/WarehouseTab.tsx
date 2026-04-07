import React, { useState } from 'react';
import { 
  Package, Plus, Trash2, Edit2, Save, X, 
  Search, Filter, ArrowUpDown, MoreVertical,
  ChevronRight, AlertCircle, CheckCircle2,
  Tag, DollarSign, Layers, Info
} from 'lucide-react';
import { useProducts } from '../contexts/ProductContext';
import { Product } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

const WarehouseTab: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    codice: '',
    descrizione: '',
    prezzoUnita: 0,
    unita: 'Pezzi'
  });

  const handleAdd = () => {
    if (!formData.codice || !formData.descrizione) return;
    addProduct(formData);
    setFormData({ codice: '', descrizione: '', prezzoUnita: 0, unita: 'Pezzi' });
    setIsAdding(false);
  };

  const handleUpdate = (id: string) => {
    const product = products.find(p => p.id === id);
    if (product) {
      updateProduct(id, formData);
      setEditingId(null);
      setFormData({ codice: '', descrizione: '', prezzoUnita: 0, unita: 'Pezzi' });
    }
  };

  const startEditing = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      codice: product.codice,
      descrizione: product.descrizione,
      prezzoUnita: product.prezzoUnita,
      unita: product.unita
    });
  };

  const filteredProducts = products.filter(p => 
    p.codice.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.descrizione.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 pb-24">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center shadow-inner">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Magazzino Centrale</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gestione SKU e Listino Prezzi</p>
          </div>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-brand-900/20 transition-all active:scale-95"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? 'ANNULLA' : 'AGGIUNGI PRODOTTO'}
        </button>
      </div>

      {/* Add/Edit Form */}
      <AnimatePresence>
        {(isAdding || editingId) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-md space-y-6"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-6 bg-brand-500 rounded-full"></div>
              <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">
                {editingId ? 'Modifica Prodotto' : 'Nuovo Prodotto'}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Codice SKU</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Es: WAKA-SM-01"
                    value={formData.codice}
                    onChange={e => setFormData({...formData, codice: e.target.value.toUpperCase()})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrizione</label>
                <input 
                  type="text"
                  placeholder="Nome del prodotto"
                  value={formData.descrizione}
                  onChange={e => setFormData({...formData, descrizione: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prezzo Base (€)</label>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unità di Misura</label>
                <div className="relative">
                  <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  setFormData({ codice: '', descrizione: '', prezzoUnita: 0, unita: 'Pezzi' });
                }}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs transition-all"
              >
                ANNULLA
              </button>
              <button 
                onClick={() => editingId ? handleUpdate(editingId) : handleAdd()}
                className="px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-brand-900/10 transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'SALVA MODIFICHE' : 'CONFERMA INSERIMENTO'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400 ml-2" />
        <input 
          type="text"
          placeholder="Cerca per SKU o descrizione..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder-slate-400"
        />
        <div className="h-6 w-px bg-slate-100 mx-2"></div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
          {filteredProducts.length} PRODOTTI
        </div>
      </div>

      {/* Products List */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrizione</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unità</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Prezzo Base</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-black tracking-tight">
                        {product.codice}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800">{product.descrizione}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter ${product.unita === 'Stecche' ? 'text-purple-600' : 'text-blue-600'}`}>
                        {product.unita}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-900">€{product.prezzoUnita.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => startEditing(product)}
                          className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"
                          title="Modifica"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteProduct(product.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                        <Search className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-400">Nessun prodotto trovato nel magazzino.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
