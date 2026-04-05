import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AMBudget, BudgetTransaction } from '../types';

interface BudgetContextType {
  budget: AMBudget;
  addTransaction: (transaction: Omit<BudgetTransaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  calculateBalance: () => number;
  getRollover: () => number;
  consolidateBudget: () => void;
  initializeBudget: (amount: number) => void;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

const STORAGE_KEY = 'tgest_budget';

const DEFAULT_BUDGET: AMBudget = {
  id: 'b1',
  nome: 'Budget AM Mensile',
  dataInizio: new Date().toISOString(),
  dataFine: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
  transazioni: [
    {
      id: 't1',
      data: new Date().toISOString(),
      descrizione: 'Ricarica Mensile Standard',
      importo: 500,
      tipo: 'RICARICA'
    }
  ]
};

export const BudgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [budget, setBudget] = useState<AMBudget>(DEFAULT_BUDGET);

  // Carica dal localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.id) setBudget(parsed);
      } catch (e) {
        console.error('Errore nel parsing del budget', e);
      }
    }
  }, []);

  // Salva nel localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(budget));
  }, [budget]);

  const addTransaction = (transaction: Omit<BudgetTransaction, 'id'>) => {
    const newTransaction: BudgetTransaction = {
      ...transaction,
      id: Math.random().toString(36).substr(2, 9)
    };
    setBudget(prev => ({
      ...prev,
      transazioni: [...prev.transazioni, newTransaction]
    }));
  };

  const deleteTransaction = (id: string) => {
    setBudget(prev => ({
      ...prev,
      transazioni: prev.transazioni.filter(t => t.id !== id)
    }));
  };

  const calculateBalance = useCallback(() => {
    return budget.transazioni.reduce((acc, t) => {
      return t.tipo === 'RICARICA' ? acc + t.importo : acc - t.importo;
    }, 0);
  }, [budget]);

  const getRollover = useCallback(() => {
    // In un'app reale, questo controllerebbe il saldo del mese precedente
    // Per ora, restituiamo il saldo attuale se è positivo
    const balance = calculateBalance();
    return balance > 0 ? balance : 0;
  }, [calculateBalance]);

  const consolidateBudget = () => {
    // Kill switch: resetta il budget o lo archivia
    // Per ora, puliamo le transazioni e aggiungiamo un saldo iniziale se positivo
    const balance = calculateBalance();
    setBudget(prev => ({
      ...prev,
      transazioni: [
        {
          id: 'consolidated-' + Date.now(),
          data: new Date().toISOString(),
          descrizione: 'Consolidamento (Kill Switch)',
          importo: balance > 0 ? balance : 0,
          tipo: 'RICARICA'
        }
      ]
    }));
  };

  const initializeBudget = (amount: number) => {
    const rollover = getRollover();
    const total = amount + rollover;
    
    const initTransaction: BudgetTransaction = {
      id: 'init-' + Math.random().toString(36).substring(2, 9),
      data: new Date().toISOString(),
      descrizione: "Inizializzazione Mese",
      importo: total,
      tipo: 'RICARICA'
    };

    setBudget(prev => ({
      ...prev,
      transazioni: [...prev.transazioni, initTransaction]
    }));
  };

  return (
    <BudgetContext.Provider value={{
      budget,
      addTransaction,
      deleteTransaction,
      calculateBalance,
      getRollover,
      consolidateBudget,
      initializeBudget
    }}>
      {children}
    </BudgetContext.Provider>
  );
};

export const useBudget = () => {
  const context = useContext(BudgetContext);
  if (context === undefined) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
};
