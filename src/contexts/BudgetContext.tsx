import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AMBudget, BudgetTransaction } from '../types';

interface BudgetContextType {
  budget: AMBudget;
  addTransaction: (transaction: Omit<BudgetTransaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  calculateBalance: (meseSelezionato?: string) => number;
  initializeBudget: (amount: number, meseSelezionato: string) => void;
  reconcileBudget: (currentRealAmount: number, meseSelezionato: string) => void;
  consolidateBudget: (targetAmount: number) => void;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);
const STORAGE_KEY = 'tgest_budget_v3'; // Cambio chiave per isolare i vecchi bug

export const BudgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [budget, setBudget] = useState<AMBudget>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { id: 'am-budget-root', transazioni: [] };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(budget));
  }, [budget]);

  const addTransaction = useCallback((transaction: Omit<BudgetTransaction, 'id'>) => {
    const newTransaction: BudgetTransaction = {
      ...transaction,
      id: `t-${Math.random().toString(36).substring(2, 9)}`
    };
    setBudget(prev => ({ ...prev, transazioni: [...prev.transazioni, newTransaction] }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setBudget(prev => ({ ...prev, transazioni: prev.transazioni.filter(t => t.id !== id) }));
  }, []);

  // CALCOLO SALDO PROGRESSIVO (Somma tutto fino alla fine del mese selezionato)
  const calculateBalance = useCallback((meseSelezionato?: string) => {
    const mese = meseSelezionato || new Date().toISOString().substring(0, 7);
    // Prende tutte le transazioni avvenute PRIMA della fine del mese selezionato
    return budget.transazioni
      .filter(t => t.data.substring(0, 7) <= mese)
      .reduce((acc, t) => t.tipo === 'RICARICA' ? acc + t.importo : acc - t.importo, 0);
  }, [budget]);

  // INIZIALIZZAZIONE PULITA: Sovrascrive ricariche "Inizializzazione" dello stesso mese
  const initializeBudget = useCallback((amount: number, meseSelezionato: string) => {
    const dateStr = `${meseSelezionato}-01T08:00:00.000Z`;
    setBudget(prev => {
      const filtered = prev.transazioni.filter(t => 
        !(t.nota === "Inizializzazione Mese" && t.data.startsWith(meseSelezionato))
      );
      const initTx: BudgetTransaction = {
        id: `init-${meseSelezionato}`,
        data: dateStr,
        nota: "Inizializzazione Mese",
        importo: amount
      };
      return { ...prev, transazioni: [...filtered, initTx] };
    });
  }, []);

  // BONIFICA (SOFT RESET): Rilascia un'unica transazione di rettifica per allineare il saldo
  const reconcileBudget = useCallback((currentRealAmount: number, meseSelezionato: string) => {
    const currentBalance = calculateBalance(meseSelezionato);
    const difference = currentRealAmount - currentBalance;
    if (difference === 0) return;

    addTransaction({
      data: new Date().toISOString(),
      descrizione: "Rettifica Saldo (Soft Reset)",
      importo: Math.abs(difference),
      tipo: difference > 0 ? 'RICARICA' : 'SPESA'
    });
  }, [calculateBalance, addTransaction]);

  const consolidateBudget = (targetAmount: number) => {
    const currentBalance = calculateBalance();
    const difference = targetAmount - currentBalance;
    
    if (difference === 0) return;

    addTransaction({
      data: new Date().toISOString(),
      descrizione: 'Rettifica Saldo Manuale',
      importo: Math.abs(difference),
      tipo: difference > 0 ? 'RICARICA' : 'SPESA'
    });
  };

  return (
    <BudgetContext.Provider value={{ budget, addTransaction, deleteTransaction, calculateBalance, initializeBudget, reconcileBudget, consolidateBudget }}>
      {children}
    </BudgetContext.Provider>
  );
};

export const useBudget = () => {
  const context = useContext(BudgetContext);
  if (!context) throw new Error('useBudget must be used within a BudgetProvider');
  return context;
};
