import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '../types';

interface ProductContextType {
  products: Product[];
  addProduct: (product: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  getCategories: () => string[];
  getProductsByCategory: (category: string) => Product[];
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

const STORAGE_KEY = 'tgest_products';

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'p1',
    codice: 'Fasoul',
    descrizione: 'Bundle Fasoul Premium',
    categoria: 'Bundle',
    unitaDefault: 'PZ',
    prezzoUnitaDefault: 120,
    valoreBonus: 8
  },
  {
    id: 'p2',
    codice: 'SKU-001',
    descrizione: 'Prodotto Standard A',
    categoria: 'Standard',
    unitaDefault: 'PZ',
    prezzoUnitaDefault: 45
  },
  {
    id: 'p3',
    codice: 'SKU-002',
    descrizione: 'Prodotto Premium B',
    categoria: 'Premium',
    unitaDefault: 'PZ',
    prezzoUnitaDefault: 85
  }
];

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setProducts(parsed);
      } catch (e) {
        console.error('Error parsing products', e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  const addProduct = (product: Product) => {
    setProducts(prev => [...prev, product]);
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const getCategories = () => {
    return Array.from(new Set(products.map(p => p.categoria)));
  };

  const getProductsByCategory = (category: string) => {
    return products.filter(p => p.categoria === category);
  };

  return (
    <ProductContext.Provider value={{
      products,
      addProduct,
      updateProduct,
      deleteProduct,
      getCategories,
      getProductsByCategory
    }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
};
