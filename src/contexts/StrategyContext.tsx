import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Mission, SalaryConfig, RubricaData, Campaign, CampaignPeriod } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 9);

interface StrategyContextType {
  salaryConfig: SalaryConfig;
  missions: Mission[];
  campaigns: Campaign[];
  setSalaryConfig: (config: SalaryConfig) => void;
  addMission: (mission: Mission) => void;
  updateMission: (id: string, updates: Partial<Mission>) => void;
  deleteMission: (id: string) => void;
  addCampaign: (campaign: Campaign) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  deleteCampaign: (id: string) => void;
  addCampaignPeriod: (campaignId: string, period: CampaignPeriod) => void;
  closeCampaignPeriod: (campaignId: string, periodId: string) => void;
  calculateMboBonus: () => number;
  calculateExtraBonus: (rubrica: RubricaData, meseSelezionato: string) => number;
  syncProgress: (rubrica: RubricaData, meseSelezionato: string) => void;
}

const StrategyContext = createContext<StrategyContextType | undefined>(undefined);

const STORAGE_KEY = 'tgest_strategy';

const DEFAULT_SALARY: SalaryConfig = {
  ralAnnua: 29000,
  percentualeBonus: 20
};

const DEFAULT_MISSIONS: Mission[] = [
  {
    id: 'm1',
    nome: 'Fatturato Mensile',
    tipo: 'FATTURATO',
    target: 10000,
    pesoPercentuale: 20,
    progressoAttuale: 0,
    stato: 'ATTIVA'
  },
  {
    id: 'm2',
    nome: 'Riattivazioni',
    tipo: 'ATTIVAZIONE',
    target: 10,
    pesoPercentuale: 80,
    progressoAttuale: 0,
    stato: 'ATTIVA'
  }
];

const DEFAULT_CAMPAIGNS: Campaign[] = [
  {
    id: 'c1',
    nome: 'Lancio Fasoul',
    sku: 'Fasoul',
    valoreBonus: 8,
    stato: 'ATTIVA',
    periodi: [
      { id: 'p1', dataInizio: '2026-04-01' }
    ]
  }
];

export const StrategyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [salaryConfig, setSalaryConfigState] = useState<SalaryConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved).salaryConfig || DEFAULT_SALARY) : DEFAULT_SALARY;
  });
  const [missions, setMissions] = useState<Mission[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved).missions || DEFAULT_MISSIONS) : DEFAULT_MISSIONS;
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved).campaigns || DEFAULT_CAMPAIGNS) : DEFAULT_CAMPAIGNS;
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ salaryConfig, missions, campaigns }));
  }, [salaryConfig, missions, campaigns]);

  const setSalaryConfig = (config: SalaryConfig) => setSalaryConfigState(config);

  const addMission = (mission: Mission) => {
    setMissions(prev => [...prev, mission]);
  };

  const updateMission = (id: string, updates: Partial<Mission>) => {
    setMissions(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const deleteMission = (id: string) => {
    setMissions(prev => prev.map(m => m.id === id ? { ...m, stato: 'ARCHIVIATA' } : m));
  };

  const addCampaign = (campaign: Campaign) => {
    setCampaigns(prev => [...prev, campaign]);
  };

  const updateCampaign = (id: string, updates: Partial<Campaign>) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCampaign = (id: string) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, stato: 'ARCHIVIATA' } : c));
  };

  const addCampaignPeriod = (campaignId: string, period: CampaignPeriod) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id === campaignId) {
        return { ...c, periodi: [...c.periodi, period] };
      }
      return c;
    }));
  };

  const closeCampaignPeriod = (campaignId: string, periodId: string) => {
    const now = new Date().toISOString().split('T')[0];
    setCampaigns(prev => prev.map(c => {
      if (c.id === campaignId) {
        return {
          ...c,
          periodi: c.periodi.map(p => p.id === periodId ? { ...p, dataFine: now } : p)
        };
      }
      return c;
    }));
  };

  const calculateMboBonus = useCallback(() => {
    const monthlyBonusPool = (salaryConfig.ralAnnua / 12) * (salaryConfig.percentualeBonus / 100);
    
    return missions
      .filter(m => m.stato !== 'ARCHIVIATA')
      .reduce((total, mission) => {
      const missionWeight = mission.pesoPercentuale / 100;
      const completionRatio = mission.target > 0 ? Math.min(1.2, mission.progressoAttuale / mission.target) : 0; // Cap at 120% for performance? Or strictly 100%?
      // The prompt says (BonusTotale * (pesoPercentuale / 100)) * (Progresso / Target)
      // We'll use Math.min(1, ...) to avoid over-bonus unless specified, but usually MBO is capped.
      const earned = (monthlyBonusPool * missionWeight) * Math.min(1, completionRatio);
      return total + earned;
    }, 0);
  }, [salaryConfig, missions]);

  const calculateExtraBonus = useCallback((rubrica: RubricaData, meseSelezionato: string) => {
    let totalExtra = 0;
    if (!meseSelezionato) return 0;

    Object.values(rubrica).forEach(riv => {
      if (riv.history) {
        riv.history.forEach(entry => {
          if (entry.tipo === 'ORDINE' && entry.items && entry.data.startsWith(meseSelezionato)) {
            entry.items.forEach(item => {
              campaigns.filter(c => c.stato !== 'ARCHIVIATA').forEach(campaign => {
                if (item.codice === campaign.sku || item.descrizione.toLowerCase().includes(campaign.sku.toLowerCase())) {
                  const orderDate = entry.data;
                  const isValid = campaign.periodi.some(p => {
                    const start = p.dataInizio;
                    const end = p.dataFine;
                    return orderDate >= start && (!end || orderDate <= end);
                  });
                  if (isValid) {
                    totalExtra += (item.quantita * campaign.valoreBonus);
                  }
                }
              });
            });
          }
        });
      }
    });

    return totalExtra;
  }, [campaigns]);

  const syncProgress = useCallback((rubrica: RubricaData, meseSelezionato: string) => {
    if (!meseSelezionato) return;

    setMissions(prevMissions => {
      return prevMissions.map(mission => {
        if (mission.stato === 'ARCHIVIATA') return mission;
        let progress = 0;
        let generatedValue = 0;

        Object.values(rubrica).forEach(riv => {
          if (mission.tipo === 'FATTURATO') {
            if (mission.targetSingolo && mission.targetSingolo > 0) {
              // Logica Sbarramento: se ha la missione assegnata, calcola se ha raggiunto la soglia in €
              if (riv.targetIdoneo?.includes(mission.id)) {
                let storeTotal = 0;
                riv.history?.forEach(h => {
                  if (h.tipo === 'ORDINE' && h.data.startsWith(meseSelezionato)) {
                    storeTotal += (h.importo || 0);
                  }
                });
                generatedValue += storeTotal;
                if (storeTotal >= mission.targetSingolo) progress += 1;
              }
            } else {
              // Logica standard: somma globale del fatturato
              riv.history?.forEach(h => {
                if (h.tipo === 'ORDINE' && h.data.startsWith(meseSelezionato)) {
                  progress += (h.importo || 0);
                  generatedValue += (h.importo || 0);
                }
              });
            }
          } else if (mission.tipo === 'ATTIVAZIONE') {
            // Conta +1 SOLO SE la missione è assegnata E c'è un ordine nel mese corrente
            if (riv.targetIdoneo?.includes(mission.id)) {
              const hasOrderThisMonth = riv.history?.some(h => h.tipo === 'ORDINE' && h.data.startsWith(meseSelezionato));
              if (hasOrderThisMonth) {
                progress += 1;
              }
            }
          } else if (mission.tipo === 'PRODOTTO') {
            const hasBoughtProduct = riv.history?.some(h => {
              if (h.tipo === 'ORDINE' && h.items && h.data.startsWith(meseSelezionato) && h.isEseguito === true) {
                return h.items.some(item => 
                  item.codice.toLowerCase() === mission.nome.toLowerCase() || 
                  mission.nome.toLowerCase().includes(item.codice.toLowerCase())
                );
              }
              return false;
            });

            if (hasBoughtProduct) {
              progress += 1;
            }
          }
        });

        return { ...mission, progressoAttuale: progress, valoreGenerato: generatedValue };
      });
    });
  }, []);

  return (
    <StrategyContext.Provider value={{
      salaryConfig,
      missions,
      campaigns,
      setSalaryConfig,
      addMission,
      updateMission,
      deleteMission,
      addCampaign,
      updateCampaign,
      deleteCampaign,
      addCampaignPeriod,
      closeCampaignPeriod,
      calculateMboBonus,
      calculateExtraBonus,
      syncProgress
    }}>
      {children}
    </StrategyContext.Provider>
  );
};

export const useStrategy = () => {
  const context = useContext(StrategyContext);
  if (context === undefined) {
    throw new Error('useStrategy must be used within a StrategyProvider');
  }
  return context;
};
