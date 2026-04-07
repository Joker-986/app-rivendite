import React, { useState, useMemo } from 'react';
import { ShoppingBag, Plus, Trash2, X, Check, Calendar } from 'lucide-react';
import { useProducts } from '../contexts/ProductContext';
import { OrderItem } from '../types';

interface OrderModuleProps {
  onConfirmOrder: (cart: OrderItem[], totaleEuro: number, note: string, dataEvasione: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
  initialCart?: OrderItem[];
  initialNote?: string;
  initialDataEvasione?: string;
  isEditMode?: boolean;
}

const OrderModule: React.FC<OrderModuleProps> = ({ 
  onConfirmOrder, 
  onCancel,
  onDelete,
  initialCart,
  initialNote,
  initialDataEvasione,
  isEditMode = false
}) => {
  const { products } = useProducts();
  
  const [cart, setCart] = useState<OrderItem[]>(initialCart || []);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantita, setQuantita] = useState<number>(1);
  const [note, setNote] = useState<string>(initialNote || '');
  const [dataEvasione, setDataEvasione] = useState<string>(initialDataEvasione || new Date().toISOString().split('T')[0]);

  const totaleEuro = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.quantita * item.prezzoApplicato), 0);
  }, [cart]);

  const handleAddToCart = () => {
    if (!selectedProductId || quantita <= 0) return;
    
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const newItem: OrderItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      productId: product.id,
      codice: product.codice,
      descrizione: product.descrizione,
      quantita: quantita,
      unita: 1, 
      prezzoApplicato: product.prezzoUnita,
      isOmaggio: false
    };

    setCart([...cart, newItem]);
    setSelectedProductId('');
    setQuantita(1);
  };

  const handleRemoveItem = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleConfirm = () => {
    if (cart.length === 0 && !note) return;
    onConfirmOrder(cart, totaleEuro, note, dataEvasione);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-[500px] rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
        {/* HEADER MODALE - MINIMAL GHOST */}
        <div className="px-4 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isEditMode ? 'MODIFICA RICHIESTA ORDINE' : 'NUOVA RICHIESTA ORDINE'}
          </h3>
          <div className="flex items-center gap-2">
            {isEditMode && onDelete && (
              <button 
                onClick={onDelete}
                className="w-7 h-7 flex items-center justify-center hover:bg-red-50 rounded-full transition-colors"
                title="Elimina Ordine"
              >
                <Trash2 className="w-4 h-4 text-red-500 cursor-pointer" />
              </button>
            )}
            <button 
              onClick={onCancel}
              className="w-7 h-7 flex items-center justify-center hover:bg-slate-50 rounded-full transition-colors"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-2 sm:p-4 space-y-4 max-h-[80vh] overflow-y-auto bg-white">
          {/* DATA EVASIONE INTEGRATA */}
          <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Data Consegna Desiderata</label>
            </div>
            <input 
              type="date"
              value={dataEvasione}
              onChange={(e) => setDataEvasione(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          {/* SELETTORE PRODOTTI */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <select 
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
              >
                <option value="">Seleziona SKU...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.codice} - {p.descrizione} ({p.prezzoUnita.toFixed(2)}€)
                  </option>
                ))}
              </select>
              
              <div className="flex items-center gap-1.5">
                <input 
                  type="number" 
                  min="1"
                  value={quantita}
                  onChange={(e) => setQuantita(parseInt(e.target.value) || 1)}
                  className="w-14 h-10 text-center bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                />
                <button 
                  onClick={handleAddToCart}
                  disabled={!selectedProductId}
                  className="w-10 h-10 bg-brand-600 text-white rounded-xl disabled:opacity-50 disabled:bg-slate-300 flex items-center justify-center shadow-sm active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* CARRELLO COMPATTO - DENSE VIEW */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Riepilogo Articoli</label>
            {cart.length > 0 ? (
              <div className="bg-slate-50/50 rounded-2xl border border-slate-100 divide-y divide-slate-100/50">
                {cart.map(item => (
                  <div key={item.id} className="p-2 flex justify-between items-center">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-[10px] font-bold text-slate-700 truncate">{item.codice}</p>
                      <p className="text-[9px] text-slate-400 truncate leading-tight">{item.descrizione}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-[11px] font-black text-slate-800">x{item.quantita}</p>
                        <p className="text-[9px] text-brand-600 font-bold">€{(item.prezzoApplicato * item.quantita).toFixed(2)}</p>
                      </div>
                      <button 
                        onClick={() => handleRemoveItem(item.id)}
                        className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="p-2.5 bg-brand-50/20 flex justify-between items-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Totale</span>
                  <span className="text-xs font-black text-brand-700">€{totaleEuro.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center bg-slate-50/30 rounded-2xl border border-dashed border-slate-200">
                <ShoppingBag className="w-5 h-5 text-slate-200 mb-1" />
                <p className="text-[9px] font-bold text-slate-400 italic">Nessun prodotto selezionato</p>
              </div>
            )}
          </div>

          {/* NOTE */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Note Ordine</label>
            <textarea 
              placeholder="Eventuali note per la consegna..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none resize-none h-14"
            />
          </div>
        </div>

        {/* FOOTER AZIONI */}
        <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-3 text-slate-400 font-bold text-xs hover:bg-slate-50 rounded-xl transition-all"
          >
            Annulla
          </button>
          <button 
            onClick={handleConfirm}
            disabled={cart.length === 0 && !note}
            className="flex-[2] py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-100 disabled:text-slate-300 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-100 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isEditMode ? 'AGGIORNA ORDINE' : 'SALVA BOZZA'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderModule;
