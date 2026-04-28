import React, { useState, useMemo } from 'react';
import { ShoppingBag, Plus, Trash2, X, Check, Calendar, Gift, FileText } from 'lucide-react';
import { useProducts } from '../contexts/ProductContext';
import { OrderItem } from '../types';
import { getTodayLocalISO } from '../utils/helpers';

interface OrderModuleProps {
  onConfirmOrder: (cart: OrderItem[], totaleEuro: number, note: string, dataEvasione: string, isEvaso?: boolean) => void;
  onCancel: () => void;
  onDelete?: () => void;
  initialCart?: OrderItem[];
  initialNote?: string;
  initialDataEvasione?: string;
  initialIsEvaso?: boolean;
  isEditMode?: boolean;
}

const OrderModule: React.FC<OrderModuleProps> = ({ 
  onConfirmOrder, 
  onCancel,
  onDelete,
  initialCart,
  initialNote,
  initialDataEvasione,
  initialIsEvaso = false,
  isEditMode = false
}) => {
  const { products } = useProducts();

  const [cart, setCart] = useState<OrderItem[]>(initialCart || []);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantita, setQuantita] = useState<number>(1);
  const [note, setNote] = useState<string>(initialNote || '');
  const [dataEvasione, setDataEvasione] = useState<string>(initialDataEvasione || getTodayLocalISO());
  const [isEvaso, setIsEvaso] = useState<boolean>(initialIsEvaso);
  const [showNotaCredito, setShowNotaCredito] = useState(false);
  const [notaCredito, setNotaCredito] = useState<number | ''>('');
  const [backupData, setBackupData] = useState<string>(initialDataEvasione || getTodayLocalISO());
  const [isOmaggio, setIsOmaggio] = useState<boolean>(false);
  const [isCredito, setIsCredito] = useState<boolean>(false);
  const [isSpacchettatoUI, setIsSpacchettatoUI] = useState<boolean>(false);

  const selectedProductObj = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);

  const totaleEuro = useMemo(() => {
    return cart.reduce((acc, item) => item.isOmaggio ? acc : acc + (item.quantita * item.prezzoApplicato), 0);
  }, [cart]);

  const handleAddToCart = () => {
    if (!selectedProductId || quantita <= 0) return;
    
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    let finalPrice = product.prezzoUnita;
    let appliedSpacchettato = false;

    if (product.unita === 'Stecche' && isSpacchettatoUI) {
      const divider = Math.max(1, product.pezziPerStecca || 10);
      finalPrice = Math.round((product.prezzoUnita / divider) * 100) / 100;
      appliedSpacchettato = true;
    }

    const newItem: OrderItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      productId: product.id,
      codice: product.codice,
      descrizione: product.descrizione,
      quantita: quantita,
      unita: 1, 
      prezzoApplicato: finalPrice,
      isOmaggio: isOmaggio,
      isCredito: isCredito,
      isSpacchettato: appliedSpacchettato
    };

    setCart([...cart, newItem]);
    setSelectedProductId('');
    setQuantita(1);
    setIsOmaggio(false);
    setIsCredito(false);
    setIsSpacchettatoUI(false);
  };

  const handleRemoveItem = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleConfirm = () => {
    if (cart.length === 0 && !note) return;
    onConfirmOrder(cart, totaleEuro, note, dataEvasione, isEvaso);
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
              onChange={(e) => {
                setDataEvasione(e.target.value);
                // BLINDATURA MEMORIA: Mantiene il backup aggiornato se cambi la data manualmente
                if (!isEvaso) {
                  setBackupData(e.target.value);
                }
              }}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <select 
                value={selectedProductId}
                onChange={(e) => { setSelectedProductId(e.target.value); setIsSpacchettatoUI(false); }}
                className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none appearance-none min-w-0 truncate w-full"
              >
                <option value="">Seleziona SKU...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.codice} - {p.descrizione} ({p.prezzoUnita.toFixed(2)}€)
                  </option>
                ))}
              </select>
              
              <div className="flex items-center gap-1.5">
                <div className="flex gap-1 shrink-0">
                  <button 
                    onClick={() => { setIsOmaggio(!isOmaggio); setIsCredito(false); }}
                    className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all border ${isOmaggio ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                    title="Sconto 100% (No Fatturato)"
                  >
                    <Gift className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => { setIsCredito(!isCredito); setIsOmaggio(false); }}
                    className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all border ${isCredito ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                    title="Usa Credito AM (Genera Fatturato)"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                </div>
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

            {selectedProductObj && selectedProductObj.unita === 'Stecche' && (
              <div className="flex bg-slate-100/80 p-1 rounded-xl mt-2 animate-in fade-in zoom-in-95 duration-200">
                <button 
                  onClick={() => setIsSpacchettatoUI(false)}
                  className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all shadow-sm ${!isSpacchettatoUI ? 'bg-white text-slate-800 border border-slate-200/50' : 'text-slate-400 bg-transparent shadow-none border-transparent hover:bg-slate-200/50'}`}
                >
                  Stecca
                </button>
                <button 
                  onClick={() => setIsSpacchettatoUI(true)}
                  className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all shadow-sm ${isSpacchettatoUI ? 'bg-white text-brand-600 border border-brand-200/50' : 'text-slate-400 bg-transparent shadow-none border-transparent hover:bg-slate-200/50'}`}
                >
                  Pezzo
                </button>
              </div>
            )}
          </div>

          {/* CARRELLO COMPATTO - DENSE VIEW */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Riepilogo Articoli</label>
            {cart.length > 0 ? (
              <div className="bg-slate-50/50 rounded-2xl border border-slate-100 divide-y divide-slate-100/50">
                {cart.map(item => (
                  <div key={item.id} className="p-2 flex justify-between items-center">
                    <div className="flex flex-col min-w-0 flex-1 pr-2">
                      <p className="text-[10px] font-bold text-slate-700 truncate">
                        {item.codice} {item.isSpacchettato && <span className="bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded-[4px] text-[8px] font-black ml-1 uppercase tracking-wider">PZ</span>}
                      </p>
                      <p className="text-[9px] text-slate-400 truncate text-ellipsis overflow-hidden leading-tight">{item.descrizione}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right flex flex-col items-end">
                        <p className="text-[11px] font-black text-slate-800">x{item.quantita}</p>
                        {item.isCredito ? (
                          <span className="text-[9px] text-purple-600 font-black bg-purple-50 px-1 rounded mt-0.5 border border-purple-100">NOTA CREDITO</span>
                        ) : item.isOmaggio ? (
                          <span className="text-[9px] text-amber-600 font-black bg-amber-50 px-1 rounded mt-0.5 border border-amber-100">SCONTO 100%</span>
                        ) : null}
                        {(!item.isOmaggio || item.isCredito) && (
                          <p className={`text-[9px] font-bold ${item.isCredito ? 'text-purple-700' : 'text-brand-600'}`}>
                            €{(item.prezzoApplicato * item.quantita).toFixed(2)}
                          </p>
                        )}
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

          {/* --- SEZIONE NOTA DI CREDITO A SCOMPARSA --- */}
          <div className="mb-3">
            {!showNotaCredito ? (
              <button 
                onClick={() => setShowNotaCredito(true)}
                className="flex items-center gap-1.5 text-[11px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-lg border border-purple-100 transition-colors w-fit shadow-sm"
              >
                <span className="text-lg leading-none mt-[-2px]">+</span> Nota di credito
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-purple-50 border border-purple-200 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-7 h-7 rounded-md bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                    <span className="font-black text-sm">-</span>
                  </div>
                  <input 
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="Importo da abbonare..."
                    value={notaCredito}
                    onChange={(e) => setNotaCredito(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="flex-1 bg-white border border-purple-200 rounded-md px-2 py-1.5 text-sm font-bold text-purple-700 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm"
                    autoFocus
                  />
                </div>
                <button 
                  onClick={() => { setShowNotaCredito(false); setNotaCredito(''); }}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-white rounded-md border border-slate-200 shadow-sm"
                >
                  Annulla
                </button>
              </div>
            )}
          </div>
          {/* --- FINE SEZIONE NOTA DI CREDITO --- */}

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

          {/* TOGGLE EVASIONE RAPIDA */}
          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-slate-700">Evadi immediatamente</span>
              <span className="text-[10px] text-slate-500 truncate">Segna l'ordine come completato e archiviato</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input 
                type="checkbox" 
                checked={isEvaso} 
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsEvaso(checked);
                  if (checked) {
                    setBackupData(dataEvasione); // Salva la data prevista
                    setDataEvasione(getTodayLocalISO()); // Usa la funzione locale
                  } else {
                    setDataEvasione(backupData); // Ripristina la data prevista
                  }
                }} 
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
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
            onClick={() => {
              let finalCart = [...cart];
              if (typeof notaCredito === 'number' && notaCredito > 0) {
                finalCart.push({
                  id: `credito-manuale-${Date.now()}`,
                  productId: 'SCONTO_AM',
                  codice: 'CREDITO',
                  descrizione: 'Nota di Credito',
                  quantita: 1,
                  unita: 1,
                  prezzoApplicato: notaCredito,
                  isOmaggio: true,
                  isCredito: true
                });
              }
              onConfirmOrder(finalCart, totaleEuro, note, dataEvasione, isEvaso);
            }}
            disabled={cart.length === 0 && !note && !notaCredito}
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
