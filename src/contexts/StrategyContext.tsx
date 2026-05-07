import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Mission, SalaryConfig, RubricaData, Campaign, CampaignPeriod, MissionDetail } from '../types';

export interface MonthlyAdjustment { logista: number; amCorrection: number; }

const generateId = () => Math.random().toString(36).substring(2, 9);

interface StrategyContextType {
  salaryConfig: SalaryConfig;
  missions: Mission[];
  campaigns: Campaign[];
  adjustments: Record<string, MonthlyAdjustment>;
  setSalaryConfig: (config: SalaryConfig) => void;
  setLogista: (mese: string, importo: number) => void;
  setAmCorrection: (mese: string, delta: number) => void;
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
  const [adjustments, setAdjustments] = useState<Record<string, MonthlyAdjustment>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved).adjustments || {}) : {};
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ salaryConfig, missions, campaigns, adjustments }));
  }, [salaryConfig, missions, campaigns, adjustments]);

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

  const setLogista = (mese: string, importo: number) => {
    setAdjustments(prev => ({ ...prev, [mese]: { ...(prev[mese] || { logista: 0, amCorrection: 0 }), logista: importo } }));
  };
  const setAmCorrection = (mese: string, delta: number) => {
    setAdjustments(prev => ({ ...prev, [mese]: { ...(prev[mese] || { logista: 0, amCorrection: 0 }), amCorrection: delta } }));
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
        let dettagli: MissionDetail[] = [];

        Object.entries(rubrica).forEach(([rivId, riv]) => {
          const rivNome = riv.isStore ? `Store ${riv.storeNumber}` : `Riv. ${riv['Num. Rivendita']}`;
          const comune = riv.Comune || riv['Comune'] || '';

          if (mission.tipo === 'FATTURATO') {
            if (mission.targetSingolo && mission.targetSingolo > 0) {
              // Logica Sbarramento: se ha la missione assegnata, calcola se ha raggiunto la soglia in €
              if (riv.targetIdoneo?.includes(mission.id)) {
                let storeTotal = 0;
                let lastOrderDate = '';
                riv.history?.forEach(h => {
                  if (h.tipo === 'ORDINE' && h.data.startsWith(meseSelezionato)) {
                    storeTotal += (h.importo || 0);
                    lastOrderDate = h.data;
                  }
                });
                generatedValue += storeTotal;
                if (storeTotal >= mission.targetSingolo) {
                  progress += 1;
                  dettagli.push({
                    id: rivId,
                    nome: rivNome,
                    comune: comune,
                    valore: storeTotal,
                    data: lastOrderDate
                  });
                }
              }
            } else {
              // Logica standard: somma globale del fatturato
              riv.history?.forEach(h => {
                if (h.tipo === 'ORDINE' && h.data.startsWith(meseSelezionato)) {
                  const val = (h.importo || 0);
                  progress += val;
                  generatedValue += val;
                  dettagli.push({
                    id: rivId,
                    nome: rivNome,
                    comune: comune,
                    valore: val,
                    data: h.data
                  });
                }
              });
            }
          } else if (mission.tipo === 'ATTIVAZIONE') {
            // Conta +1 SOLO SE la missione è assegnata E c'è un ordine nel mese corrente
            if (riv.targetIdoneo?.includes(mission.id)) {
              const activationOrder = riv.history?.find(h => h.tipo === 'ORDINE' && h.data.startsWith(meseSelezionato));
              if (activationOrder) {
                progress += 1;
                dettagli.push({
                  id: rivId,
                  nome: rivNome,
                  comune: comune,
                  valore: 1,
                  data: activationOrder.data
                });
              }
            }
          } else if (mission.tipo === 'PRODOTTO') {
            const productOrder = riv.history?.find(h => {
              if (h.tipo === 'ORDINE' && h.items && h.data.startsWith(meseSelezionato) && h.isEseguito === true) {
                return h.items.some(item => 
                  item.codice.toLowerCase() === mission.nome.toLowerCase() || 
                  mission.nome.toLowerCase().includes(item.codice.toLowerCase())
                );
              }
              return false;
            });

            if (productOrder) {
              progress += 1;
              dettagli.push({
                id: rivId,
                nome: rivNome,
                comune: comune,
                valore: 1,
                data: productOrder.data
              });
            }
          }
        }); // <-- Fine ciclo ordini
        
        // APPLICAZIONE CONGUAGLI
        if (mission.tipo === 'FATTURATO' && !(mission.targetSingolo && mission.targetSingolo > 0)) {
          const adj = adjustments[meseSelezionato];
          if (adj) {
            const extraTotale = adj.logista + adj.amCorrection;
            if (extraTotale !== 0) {
              progress += extraTotale;
              generatedValue += extraTotale;
              let label = 'Fatturato Logista';
              if (adj.amCorrection !== 0 && adj.logista !== 0) {
                label = 'Rettifica Magazzino + Logista';
              } else if (adj.amCorrection !== 0) {
                label = 'Rettifica Magazzino';
              }

              dettagli.push({
                id: 'conguaglio-allineamento',
                nome: label,
                comune: 'Bilancio',
                valore: extraTotale,
                data: `${meseSelezionato}-01`
              });
            }
          }
        }
        
        dettagli.sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime());
        
        return { ...mission, progressoAttuale: progress, valoreGenerato: generatedValue, dettagliProgresso: dettagli };
      });
    });
  }, [adjustments]);

  return (
    <StrategyContext.Provider value={{
      salaryConfig,
      missions,
      campaigns,
      adjustments,
      setSalaryConfig,
      setLogista,
      setAmCorrection,
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
