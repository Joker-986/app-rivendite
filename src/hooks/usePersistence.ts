import { useState, useCallback, Dispatch, SetStateAction, ChangeEvent } from 'react';
import { SearchResult, RivenditaExtra, RubricaData } from '../types';
import { getRivenditaId } from '../utils/helpers';
import packageVersion from '../version.json';

const DATA_VERSION = packageVersion.version;

interface UsePersistenceProps {
  giroVisite: SearchResult[];
  crmAnagrafiche: SearchResult[];
  stores: SearchResult[];
  rubrica: RubricaData;
  setGiroVisite: Dispatch<SetStateAction<SearchResult[]>>;
  setCrmAnagrafiche: Dispatch<SetStateAction<SearchResult[]>>;
  setStores: Dispatch<SetStateAction<SearchResult[]>>;
  setRubrica: Dispatch<SetStateAction<RubricaData>>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  meseSelezionato: string;
  isDateInRange: (dateStr?: string) => boolean;
  setConfirmModal: Dispatch<SetStateAction<any>>;
  setShowSettingsModal: Dispatch<SetStateAction<boolean>>;
}

export function usePersistence({
  giroVisite,
  crmAnagrafiche,
  stores,
  rubrica,
  setGiroVisite,
  setCrmAnagrafiche,
  setStores,
  setRubrica,
  showToast,
  meseSelezionato,
  isDateInRange,
  setConfirmModal,
  setShowSettingsModal
}: UsePersistenceProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [generatedSyncCode, setGeneratedSyncCode] = useState('');
  const [syncCodeInput, setSyncCodeInput] = useState('');

  const handleExportData = () => {
    try {
      const data = {
        giroVisite,
        crmAnagrafiche,
        stores,
        rubrica,
        version: DATA_VERSION,
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      const now = new Date();
      const dateStr = now.getFullYear().toString() + 
                      (now.getMonth() + 1).toString().padStart(2, '0') + 
                      now.getDate().toString().padStart(2, '0');
      a.download = `TgesT_Backup_${dateStr}.json`;
      
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1500);
    } catch (err) {
      console.error('Errore durante l\'esportazione:', err);
      showToast('Errore durante il salvataggio del backup.', 'error');
    }
  };

  const handleImportData = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result as string;
        const data = JSON.parse(result);
        
        if (typeof data !== 'object' || data === null) throw new Error('Formato non valido');
        
        if (data.giroVisite) localStorage.setItem('giroVisite', JSON.stringify(data.giroVisite));
        if (data.crmAnagrafiche) localStorage.setItem('crmAnagrafiche', JSON.stringify(data.crmAnagrafiche));
        if (data.stores) localStorage.setItem('stores', JSON.stringify(data.stores));
        if (data.rubrica) localStorage.setItem('rubrica', JSON.stringify(data.rubrica));
        if (data.version) localStorage.setItem('app_data_version', data.version);
        
        showToast('Backup ripristinato con successo! L\'app verrà ricaricata.');
        setTimeout(() => window.location.reload(), 2000);
      } catch (err) {
        console.error('Errore importazione:', err);
        showToast('Errore durante l\'importazione del file.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateSyncCode = async () => {
    try {
      setIsSyncing(true);
      const data = { giroVisite, crmAnagrafiche, stores, rubrica, version: DATA_VERSION };
      
      const res = await fetch('https://bytebin.lucko.me/post', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await res.json();
      
      if (result && result.key) {
        setGeneratedSyncCode(result.key);
        navigator.clipboard.writeText(result.key).catch(() => console.log('Clipboard copy prevented'));
        showToast('Codice generato con successo!');
      } else {
        throw new Error('Impossibile recuperare il codice');
      }
    } catch (err) {
      showToast('Errore durante la generazione del codice', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportFromSyncCode = async () => {
    if (!syncCodeInput.trim()) return;
    try {
      setIsSyncing(true);
      const res = await fetch(`https://bytebin.lucko.me/${syncCodeInput.trim()}`);
      if (!res.ok) throw new Error('Codice non valido o scaduto');
      
      const data = await res.json();
      
      if (data.giroVisite) localStorage.setItem('giroVisite', JSON.stringify(data.giroVisite));
      if (data.crmAnagrafiche) localStorage.setItem('crmAnagrafiche', JSON.stringify(data.crmAnagrafiche));
      if (data.stores) localStorage.setItem('stores', JSON.stringify(data.stores));
      if (data.rubrica) localStorage.setItem('rubrica', JSON.stringify(data.rubrica));
      if (data.version) localStorage.setItem('app_data_version', data.version);
      
      showToast('Dati scaricati con successo! Riavvio in corso...');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      showToast('Codice errato, inesistente o scaduto', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const exportHistoryToExcel = () => {
    const headers = ['Data', 'Tipo', 'Rivendita', 'Comune', 'Importo', 'Note'];
    const rows: string[][] = [];

    Object.entries(rubrica).forEach(([id, riv]: [string, any]) => {
      const infoAnagrafica = [...crmAnagrafiche, ...stores, ...giroVisite].find(r => getRivenditaId(r) === id);
      const nomeRiv = infoAnagrafica?.isStore ? (infoAnagrafica.storeName || 'Store') : `Riv. ${infoAnagrafica?.['Num. Rivendita'] || ''}`;
      const comuneRiv = infoAnagrafica?.['Comune'] || '';

      riv.history?.forEach((h: any) => {
        if (isDateInRange(h.data)) {
          rows.push([
            new Date(h.data).toLocaleDateString('it-IT'),
            h.tipo,
            nomeRiv,
            comuneRiv,
            h.importo?.toString() || '0',
            `"${(h.note || '').replace(/"/g, '""')}"`
          ]);
        }
      });
    });

    if (rows.length === 0) {
      showToast("Nessun dato da esportare per questo periodo", "info");
      return;
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const periodo = meseSelezionato.replace('-', '_');
    link.href = url;
    link.download = `TgesT_Report_${periodo}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportGiroForMyMaps = useCallback(() => {
    if (giroVisite.length === 0) return;

    const headers = ['Nome Punto Vendita', 'Indirizzo Completo', 'Tipo', 'Stato CRM', 'Referente', 'Telefono', 'Note'];

    const rows = giroVisite.map(res => {
      const id = getRivenditaId(res);
      const extra = (rubrica[id] || {}) as RivenditaExtra;
      const capToDisplay = extra.manualCap || res['CAP'] || res['Cap'] || '';
      
      const nome = res.isStore ? `STORE ${res.storeName || res.storeNumber || ''}` : `RIVENDITA ${res['Num. Rivendita']}`;
      const indirizzoCompleto = `${res['Indirizzo'] || ''}, ${capToDisplay}, ${res['Comune'] || ''}, ${res['Prov.'] || ''}, Italia`;
      
      return [
        `"${nome}"`,
        `"${indirizzoCompleto}"`,
        `"${res['Tipo Rivendita'] || ''}"`,
        `"${extra.stato || ''}"`,
        `"${extra.riferimento || ''}"`,
        `"${extra.telefono || ''}"`,
        `"${(extra.note || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `GiroVisite_MyMaps_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1500);
  }, [giroVisite, rubrica]);

  const handleClearAllData = () => {
    setConfirmModal({
      isOpen: true,
      title: 'CANCELLA TUTTO',
      message: 'ATTENZIONE: Questa operazione cancellerà DEFINITIVAMENTE tutti i tuoi dati (Giro, Rubrica, Store). Sei sicuro di voler procedere?',
      isDestructive: true,
      onConfirm: () => {
        setGiroVisite([]);
        setCrmAnagrafiche([]);
        setStores([]);
        setRubrica({});
        localStorage.clear();
        localStorage.setItem('app_data_version', DATA_VERSION);
        setConfirmModal((prev: any) => ({ ...prev, isOpen: false }));
        showToast('Tutti i dati sono stati cancellati.');
        setShowSettingsModal(false);
      }
    });
  };

  return {
    handleExportData,
    handleImportData,
    handleGenerateSyncCode,
    handleImportFromSyncCode,
    exportHistoryToExcel,
    exportGiroForMyMaps,
    handleClearAllData,
    isSyncing,
    generatedSyncCode,
    setGeneratedSyncCode,
    syncCodeInput,
    setSyncCodeInput
  };
}
