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
    const newProduct = { ...p, id: Date.now().toString() };
    setProducts(prev => [...prev, newProduct]);
  };

  const updateProduct = (id: string, p: Partial<Product>) => {
    setProducts(prev => prev.map(prod => prod.id === id ? { ...prod, ...p } : prod));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(prod => prod.id !== id));
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
