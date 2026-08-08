import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Plus, Trash2, X, Check, Calendar, Gift, FileText, Ticket, Calculator, Search, ChevronDown, Edit3 } from 'lucide-react';
import { useProducts } from '../contexts/ProductContext';
import { useModals } from '../contexts/ModalContext';
import { OrderItem } from '../types';
import { getTodayLocalISO } from '../utils/helpers';

interface OrderModuleProps {
  onConfirmOrder: (cart: OrderItem[], totaleEuro: number, note: string, dataEvasione: string, pagamento: string, isEvaso?: boolean) => void;
  onCancel: () => void;
  onDelete?: () => void;
  initialCart?: OrderItem[];
  initialNote?: string;
  initialDataEvasione?: string;
  initialIsEvaso?: boolean;
  initialPaymentMethod?: string;
  isEditMode?: boolean;
  onGoToCalc?: (amount: string) => void;
}

const OrderModule: React.FC<OrderModuleProps> = ({ 
  onConfirmOrder, 
  onCancel,
  onDelete,
  initialCart,
  initialNote,
  initialDataEvasione,
  initialIsEvaso = false,
  initialPaymentMethod = 'Contanti alla consegna',
  isEditMode = false,
  onGoToCalc
}) => {
  const { products } = useProducts();
  const { openConfirm } = useModals();

  const [cart, setCart] = useState<OrderItem[]>(initialCart || []);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantita, setQuantita] = useState<number>(1);
  const [note, setNote] = useState<string>(initialNote || '');
  const [dataEvasione, setDataEvasione] = useState<string>(initialDataEvasione || getTodayLocalISO());
  const [isEvaso, setIsEvaso] = useState<boolean>(initialIsEvaso);
  const [showNotaCredito, setShowNotaCredito] = useState(false);
  const [notaCredito, setNotaCredito] = useState<number | ''>('');
  const [showVoucher, setShowVoucher] = useState(false);
  const [voucherValue, setVoucherValue] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'Contanti alla consegna' | 'Bonifico 30 gg'>(
    (initialPaymentMethod === 'Bonifico 30 gg' ? 'Bonifico 30 gg' : 'Contanti alla consegna') as 'Contanti alla consegna' | 'Bonifico 30 gg'
  );

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);

  const toggleNotaCredito = () => { setShowNotaCredito(!showNotaCredito); if (!showNotaCredito) { setShowVoucher(false); } };
  const toggleVoucher = () => { setShowVoucher(!showVoucher); if (!showVoucher) { setShowNotaCredito(false); } };

  const closeNdc = () => setShowNotaCredito(false);
  const cancelNdc = () => { setNotaCredito(''); setShowNotaCredito(false); };
  const closeVoucher = () => setShowVoucher(false);
  const cancelVoucher = () => { setVoucherValue(''); setShowVoucher(false); };
  const [backupData, setBackupData] = useState<string>(initialDataEvasione || getTodayLocalISO());
  const [isOmaggio, setIsOmaggio] = useState<boolean>(false);
  const [isCredito, setIsCredito] = useState<boolean>(false);
  const [isSpacchettatoUI, setIsSpacchettatoUI] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('TUTTE');

  const selectedProductObj = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);

  // Estrazione sicura e normalizzata delle categorie (ignora eliminati)
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.attivo === false) return;
      const c = p.categoria?.trim().toUpperCase();
      if (c) cats.add(c);
      else cats.add('ALTRO'); // Raggruppamento per prodotti orfani o legacy
    });
    return Array.from(cats).sort();
  }, [products]);

  // Motore di filtraggio dinamico
  const filteredProducts = useMemo(() => {
    const activeProducts = products.filter(p => p.attivo !== false);
    if (selectedCategory === 'TUTTE') return activeProducts;

    return activeProducts.filter(p => {
      const c = p.categoria?.trim().toUpperCase();
      if (selectedCategory === 'ALTRO') return !c;
      return c === selectedCategory;
    });
  }, [products, selectedCategory]);

  const searchedProducts = useMemo(() => {
    if (!productSearchTerm) return filteredProducts;
    const term = productSearchTerm.toLowerCase();
    return filteredProducts.filter(p => 
      (p.descrizione && p.descrizione.toLowerCase().includes(term)) ||
      (p.codice && p.codice.toLowerCase().includes(term))
    );
  }, [filteredProducts, productSearchTerm]);

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
      categoria: product.categoria,
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

  const updateCartItemQuantity = (id: string, newQty: number) => {
    if (newQty < 1) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantita: newQty } : item));
  };

  const updateCartItemPrice = (id: string, newPrice: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, prezzoApplicato: newPrice } : item));
  };

  const handleConfirm = () => {
    if (cart.length === 0 && !note && !notaCredito && !voucherValue) return;
    
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

    if (typeof voucherValue === 'number' && voucherValue > 0) {
      finalCart.push({
        id: `voucher-${Date.now()}`,
        productId: 'VOUCHER_AM',
        codice: 'VOUCHER',
        descrizione: 'Voucher One Shot',
        quantita: 1,
        unita: 1,
        prezzoApplicato: voucherValue,
        isOmaggio: true,
        isCredito: true,
        isVoucher: true
      });
    }

    onConfirmOrder(finalCart, totaleEuro, note, dataEvasione, paymentMethod, isEvaso);
  };

  const handleSafeCancel = () => {
    if (isEditMode) {
      onCancel(); // Se siamo in modifica, lascia gestire tutto al QuickEditModal
    } else {
      const hasChanges = cart.length > 0 || note.trim().length > 0 || notaCredito !== '' || voucherValue !== '';
      if (hasChanges) {
        openConfirm({
          title: 'Annulla Ordine',
          message: 'Hai inserito dei dati. Sei sicuro di voler chiudere perdendo l\'ordine in corso?',
          isDestructive: true,
          onConfirm: () => onCancel()
        });
      } else {
        onCancel();
      }
    }
  };

  // Collega il paracadute globale per il tasto indietro hardware (solo se è un Nuovo Ordine standalone)
  useEffect(() => {
    if (!isEditMode) {
      (window as any).formParachute = { isActive: true, requestClose: handleSafeCancel };
    }
    return () => {
      if (!isEditMode) (window as any).formParachute = null;
    };
  });

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
              onClick={handleSafeCancel}
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
            
            {/* FILTRO CATEGORIE */}
            {uniqueCategories.length > 0 && (
              <div className="flex gap-2 animate-in fade-in zoom-in-95 duration-200">
                <select 
                  value={selectedCategory}
                  onChange={(e) => { 
                    setSelectedCategory(e.target.value); 
                    setSelectedProductId(''); // Fallback Sicurezza anti-ghosting
                    setQuantita(1);
                    setIsSpacchettatoUI(false); 
                    setIsDropdownOpen(false);
                    setProductSearchTerm('');
                  }}
                  className="flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:ring-2 focus:ring-brand-500 outline-none appearance-none w-full transition-colors"
                >
                  <option value="TUTTE">Tutte le categorie</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <div 
                onClick={() => setIsDropdownOpen(true)}
                className="flex-1 h-12 px-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between cursor-pointer"
              >
                <span className="text-xs font-bold text-slate-700 truncate">
                  {selectedProductId 
                    ? products.find(p => p.id === selectedProductId)?.descrizione 
                    : "Tocca per scegliere un prodotto..."}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
            </div>
              
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
                  onFocus={(e) => e.target.select()}
                  className="w-14 h-10 text-center bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                />
                <button 
                  onClick={handleAddToCart}
                  disabled={!selectedProductId}
                  className="w-10 h-10 bg-brand-600 text-white rounded-xl disabled:opacity-50 disabled:bg-slate-300 flex items-center justify-center shadow-sm active:scale-95 transition-all shrink-0"
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
              <div className="space-y-2">
            {cart.map((item) => {
              // Recupero dinamico della categoria dal catalogo prodotti
              const originalProduct = products.find(p => p.id === item.productId);
              const categoryLabel = originalProduct?.categoria || 'VARIE';

              return (
                <div key={item.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 group">
                  
                  <div className="flex-1 min-w-0 pr-3">
                    {/* Descrizione in alto (Priorità) */}
                    <div className="text-xs font-bold text-slate-800 leading-tight">
                      {item.descrizione}
                    </div>
                    
                    {/* Codice, Categoria e Badge Stato in basso */}
                    <div className="flex items-center flex-wrap gap-1.5 mt-1">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                        {item.codice}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide truncate">
                        • {categoryLabel}
                      </span>
                      {item.isCredito && !item.isVoucher && (
                        <span className="text-[9px] font-black text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                          NOTA DI CREDITO
                        </span>
                      )}
                      {item.isVoucher && (
                        <span className="text-[9px] font-black text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                          VOUCHER
                        </span>
                      )}
                      {item.isOmaggio && !item.isCredito && !item.isVoucher && (
                        <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                          OMAGGIO
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Input Quantità Pulito e Minimale */}
                    <input 
                      type="number" 
                      value={item.quantita}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateCartItemQuantity(item.id, parseInt(e.target.value) || 1)}
                      className="w-10 h-7 text-center bg-slate-100 hover:bg-slate-200 border-transparent rounded-md text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                    />

                    {/* Prezzo Editabile in Sicurezza e Rimozione */}
                    <div className="flex flex-col items-end min-w-[60px]">
                      {editingPriceId === item.id ? (
                        <div className="flex items-center gap-1 animate-in zoom-in-95 duration-200">
                          <input
                            type="number"
                            step="0.01"
                            autoFocus
                            value={tempPrice === 0 ? '' : tempPrice}
                            onChange={(e) => setTempPrice(parseFloat(e.target.value) || 0)}
                            onBlur={() => {
                              updateCartItemPrice(item.id, tempPrice);
                              setEditingPriceId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateCartItemPrice(item.id, tempPrice);
                                setEditingPriceId(null);
                              }
                            }}
                            className="w-14 h-6 text-right text-[11px] font-black text-brand-600 bg-brand-50 border border-brand-200 rounded outline-none px-1 focus:ring-2 focus:ring-brand-400"
                            placeholder="Prezzo..."
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group/price cursor-pointer" onClick={() => { setTempPrice(item.prezzoApplicato); setEditingPriceId(item.id); }}>
                          <span className="text-[11px] font-black text-slate-700">
                            €{(item.prezzoApplicato * item.quantita).toFixed(2)}
                          </span>
                          <button className="text-slate-300 group-hover/price:text-brand-500 transition-colors" title="Modifica prezzo unitario">
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      
                      <button 
                        onClick={() => setCart(cart.filter(i => i.id !== item.id))}
                        className="text-[9px] font-bold text-red-400 uppercase hover:text-red-600 transition-colors mt-0.5"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                  
                </div>
              );
            })}
                <div className="p-2.5 bg-brand-50/20 border border-brand-100 rounded-xl flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Totale Spesa</span>
                    <span className="text-sm font-black text-brand-700">€{totaleEuro.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {onGoToCalc && (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(totaleEuro.toFixed(2));
                        handleConfirm();
                        onGoToCalc(totaleEuro.toFixed(2));
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-all active:scale-95"
                      title="Copia, Salva e Vai al Calcolatore"
                    >
                      <Calculator className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase">Margine</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center bg-slate-50/30 rounded-2xl border border-dashed border-slate-200">
                <ShoppingBag className="w-5 h-5 text-slate-200 mb-1" />
                <p className="text-[9px] font-bold text-slate-400 italic">Nessun prodotto selezionato</p>
              </div>
            )}
          </div>

          {/* --- SEZIONE PREMIALITÀ (NdC E VOUCHER) --- */}
          <div className="space-y-3">
            {/* Pulsanti in linea se nessuno dei due è aperto */}
            {(!showNotaCredito && !showVoucher) && (
              <div className="flex flex-wrap items-center gap-2 animate-in fade-in duration-300">
                <button 
                  onClick={toggleNotaCredito}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-lg border border-purple-100 transition-colors shadow-sm active:scale-95"
                >
                  <span className="text-lg leading-none mt-[-2px]">+</span> Nota di credito
                </button>
                <button 
                  onClick={toggleVoucher}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-lg border border-orange-100 transition-colors shadow-sm active:scale-95"
                >
                  <Ticket className="w-3.5 h-3.5" /> ONE SHOT
                </button>
              </div>
            )}

            {/* Input Nota Credito */}
            {showNotaCredito && (
              <div className="flex flex-col gap-3 p-3 bg-purple-50 border border-purple-200 rounded-[1.5rem] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                    <span className="font-black text-sm">-</span>
                  </div>
                  <input 
                    type="number"
                    placeholder="Importo NdC..."
                    value={notaCredito}
                    onChange={(e) => setNotaCredito(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="flex-1 bg-white border border-purple-200 rounded-xl px-3 py-2 text-sm font-black text-purple-700 outline-none shadow-sm"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={cancelNdc} className="flex-1 py-2 text-[10px] font-black text-slate-400 bg-white border border-slate-200 rounded-lg uppercase">Annulla</button>
                  <button onClick={closeNdc} className="flex-1 py-2 text-[10px] font-black text-white bg-purple-600 rounded-lg uppercase shadow-sm">Applica</button>
                </div>
              </div>
            )}

            {/* Input One Shot */}
            {showVoucher && (
              <div className="flex flex-col gap-3 p-3 bg-orange-50 border border-orange-200 rounded-[1.5rem] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <input 
                    type="number"
                    placeholder="Importo Voucher..."
                    value={voucherValue}
                    onChange={(e) => setVoucherValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="flex-1 bg-white border border-orange-200 rounded-xl px-3 py-2 text-sm font-black text-orange-700 outline-none shadow-sm"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={cancelVoucher} className="flex-1 py-2 text-[10px] font-black text-slate-400 bg-white border border-slate-200 rounded-lg uppercase">Annulla</button>
                  <button onClick={closeVoucher} className="flex-1 py-2 text-[10px] font-black text-white bg-orange-600 rounded-lg uppercase shadow-sm">Applica</button>
                </div>
              </div>
            )}
          </div>
          {/* --- FINE SEZIONE PREMIALITÀ --- */}

          {/* MODALITÀ DI PAGAMENTO */}
          <div className="space-y-3 mb-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modalità di Pagamento</label>
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
              <button 
                onClick={() => setPaymentMethod('Contanti alla consegna')}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${paymentMethod === 'Contanti alla consegna' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}
              >
                CONTANTI
              </button>
              <button 
                onClick={() => setPaymentMethod('Bonifico 30 gg')}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${paymentMethod === 'Bonifico 30 gg' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}
              >
                BONIFICO 30 GG
              </button>
            </div>
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
                onChange={(e) => setIsEvaso(e.target.checked)} 
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        </div>

        {/* FOOTER AZIONI */}
        <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
          <button 
            onClick={handleSafeCancel}
            className="flex-1 py-3 text-slate-400 font-bold text-xs hover:bg-slate-50 rounded-xl transition-all"
          >
            Annulla
          </button>
          <button 
            onClick={handleConfirm}
            disabled={cart.length === 0 && !note && !notaCredito && !voucherValue}
            className="flex-[2] py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-100 disabled:text-slate-300 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-100 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isEditMode ? 'AGGIORNA ORDINE' : 'SALVA BOZZA'}</span>
          </button>
        </div>

        {isDropdownOpen && (
          <div className="fixed inset-0 z-[999] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* HEADER FISSO: Ricerca e Chiudi */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  autoFocus
                  type="text"
                  placeholder="Cerca prodotto..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
                />
              </div>
              <button 
                onClick={() => { setIsDropdownOpen(false); setProductSearchTerm(''); }}
                className="p-3 bg-slate-200 text-slate-600 rounded-2xl active:scale-95 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BODY SCORREVOLE: Lista Prodotti Full-Width */}
            <div className="flex-1 overflow-y-auto bg-white">
              {searchedProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <ShoppingBag className="w-12 h-12 mb-4 opacity-20" />
                  <span className="text-xs font-black uppercase tracking-widest">Nessun prodotto trovato</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {searchedProducts.map(product => (
                    <div 
                      key={product.id}
                      onClick={() => { 
                        setSelectedProductId(product.id); 
                        setIsDropdownOpen(false);
                        setProductSearchTerm('');
                      }}
                      className="px-4 py-2 flex flex-col active:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                    >
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="px-1.5 py-[1px] bg-brand-50 text-brand-700 text-[9px] font-black rounded uppercase tracking-tighter border border-brand-100 leading-none">
                          {product.codice}
                        </span>
                        <span className="font-black text-slate-900 text-[11px] leading-none">
                          €{product.prezzoUnita.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-700 leading-tight uppercase pr-2 line-clamp-2">
                        {product.descrizione}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderModule;
