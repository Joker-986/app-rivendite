import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '../types';

interface ProductContextType {
  products: Product[];
  addProduct: (p: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, p: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

const STORAGE_KEY = 'tgest_magazzino';

const DEFAULT_PRODUCTS: Product[] = [
  { id: 'p1', codice: 'WAKA-SM', descrizione: 'Waka soMatch', prezzoUnita: 40, unita: 'Pezzi' },
  { id: 'p2', codice: 'WAKA-U', descrizione: 'Waka Ultra', prezzoUnita: 99.90, unita: 'Pezzi' },
  { id: 'p3', codice: 'RELX-PP', descrizione: 'RELX Prime PREMIUM', prezzoUnita: 163.50, unita: 'Pezzi' },
  { id: 'p4', codice: 'RELX-PL', descrizione: 'RELX Prime LIGHT', prezzoUnita: 99.90, unita: 'Pezzi' },
  { id: 'p5', codice: 'RELX-IE', descrizione: 'RELX KIT Infinity Essential', prezzoUnita: 50, unita: 'Pezzi' }
];

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_PRODUCTS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  const addProduct = (p: Omit<Product, 'id'>) => {
    setProducts(prev => {
      // 1. Controllo anti-duplicato (case-insensitive)
      const skuExists = prev.some(prod => prod.codice.trim().toUpperCase() === p.codice.trim().toUpperCase());
      if (skuExists) {
        alert(`Errore: Il codice SKU "${p.codice}" esiste già in magazzino. Scegli un codice univoco.`);
        return prev; // Blocca il salvataggio
      }
      
      // 2. Creazione sicura (attivo di default se non specificato)
      const newProduct: Product = { 
        ...p, 
        id: Date.now().toString(),
        attivo: p.attivo !== false 
      };
      return [...prev, newProduct];
    });
  };

  const updateProduct = (id: string, p: Partial<Product>) => {
    setProducts(prev => {
      // 1. Controllo anti-duplicato solo se si sta modificando il codice SKU
      if (p.codice) {
        const skuExists = prev.some(prod => 
          prod.id !== id && // Escludi se stesso
          prod.codice.trim().toUpperCase() === p.codice!.trim().toUpperCase()
        );
        if (skuExists) {
          alert(`Errore: Il codice SKU "${p.codice}" è già assegnato a un altro prodotto.`);
          return prev; // Blocca il salvataggio
        }
      }
      
      // 2. Aggiornamento
      return prev.map(prod => prod.id === id ? { ...prod, ...p } : prod);
    });
  };

  const deleteProduct = (id: string) => {
    // FIX CRITICO: Soft Delete. Non cancelliamo l'oggetto, lo rendiamo invisibile.
    // Questo preserva l'integrità dei vecchi ordini e delle campagne.
    setProducts(prev => prev.map(prod => prod.id === id ? { ...prod, attivo: false } : prod));
  };

  return (
    <ProductContext.Provider value={{ products, addProduct, updateProduct, deleteProduct }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) throw new Error('useProducts must be used within a ProductProvider');
  return context;
};
