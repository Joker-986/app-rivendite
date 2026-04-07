import { SearchResult, RubricaData } from '../types';

export const formatGoogleCalendarDate = (dateString: string, timeString?: string) => {
  const date = new Date(dateString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  
  let timePart = '090000';
  if (timeString) {
    timePart = timeString.replace(':', '') + '00';
  }
  
  const start = `${yyyy}${mm}${dd}T${timePart}`;
  
  let endHour = parseInt(timePart.substring(0, 2)) + 1;
  let endHourStr = String(endHour).padStart(2, '0');
  if (endHour >= 24) {
    endHourStr = '23';
  }
  const end = `${yyyy}${mm}${dd}T${endHourStr}${timePart.substring(2)}`;
  
  return `${start}/${end}`;
};

export const getAvailableTimes = (date: string, currentId: string, rubricaData: RubricaData) => {
  const allTimes = Array.from({ length: (20 - 8) * 4 + 1 }).map((_, i) => {
    const h = (Math.floor(i / 4) + 8).toString().padStart(2, '0');
    const m = ((i % 4) * 15).toString().padStart(2, '0');
    return `${h}:${m}`;
  });
  if (!date) return allTimes;
  
  const bookedTimes = Object.entries(rubricaData)
    .filter(([id, data]) => id !== currentId && data.dataRivisita === date && data.oraRivisita)
    .map(([_, data]) => data.oraRivisita);
    
  return allTimes.filter(t => !bookedTimes.includes(t));
};

export const handleNavigation = (address: string) => {
  const encoded = encodeURIComponent(address);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    window.location.href = 'geo:0,0?q=' + encoded;
  } else {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  }
};

export const toTitleCase = (str: string) => { 
  return str ? str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase()) : ''; 
};

export const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return defaultValue;
    return JSON.parse(saved) as T;
  } catch (err) {
    console.error(`Error loading ${key} from storage:`, err);
    return defaultValue;
  }
};

export const getRivenditaId = (res: SearchResult) => {
  if (res.uid) return res.uid;
  const num = res.isStore ? (res.storeNumber || res['Num. Rivendita']) : res['Num. Rivendita'];
  return `${res['Prov.']}_${res['Comune']}_${num}`;
};

export const getGoogleResetDate = () => {
  const ptDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const yyyy = ptDate.getFullYear();
  const mm = String(ptDate.getMonth() + 1).padStart(2, '0');
  const dd = String(ptDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const calcolaFineTurno = (inizio: string) => {
  if (!inizio) return "";
  const [ore, minuti] = inizio.split(':').map(Number);
  let fineOre = ore + 4;
  return `${fineOre.toString().padStart(2, '0')}:${minuti.toString().padStart(2, '0')}`;
};

export const ORARI_INIZIO = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"
];

export const riparaDatiStorici = (
  rubrica: RubricaData, 
  crmAnagrafiche: SearchResult[], 
  stores: SearchResult[], 
  giroVisite: SearchResult[]
) => {
  const cutoffDate = "2026-04-07";
  let promotedCount = 0;
  let repairCount = 0;
  const updatedRubrica = { ...rubrica };

  Object.keys(updatedRubrica).forEach(id => {
    const extra = { ...updatedRubrica[id] };
    
    // Check if exists in lists
    const exists = [...crmAnagrafiche, ...stores, ...giroVisite].some(r => {
      return (r.uid && r.uid === id) || (`${r['Prov.']}_${r['Comune']}_${r['Num. Rivendita']}` === id);
    });
    const hasPendingData = extra.richiestaOrdine || extra.hasTarget || extra.kpiAttivazione || extra.kpiProdotto;
    
    if (!exists && !hasPendingData) {
      delete updatedRubrica[id];
      repairCount++;
      return;
    }

    if (!extra.history) extra.history = [];
    
    let historyChanged = false;
    const newHistory = extra.history.map((entry: any, idx: number) => {
      if (entry.tipo !== 'ORDINE') return entry;

      const orderDateOnly = entry.data.split('T')[0];
      const isLegacy = orderDateOnly < cutoffDate;
      let entryUpdated = false;

      if (isLegacy) {
        // 2. TRASFORMAZIONE "ORDINE" (Ripristino Visibilità)
        if (!entry.dataEvasione) {
          entry.dataEvasione = orderDateOnly;
          entryUpdated = true;
        }
        if (entry.isEseguito !== true) {
          entry.isEseguito = true;
          entry.dataEsecuzione = entry.data;
          entry.stato = "EVASO"; // Forza stato per compatibilità
          entryUpdated = true;
        }

        // 3. MAPPATURA PRODOTTI (NOTE -> ITEMS)
        if (!entry.items || entry.items.length === 0) {
          const items: any[] = [];
          const note = entry.note || "";
          const timestamp = new Date(entry.data).getTime();
          if (note.includes("Waka") || note.includes("soMatch")) {
            items.push({ 
              id: `mig_${id}_${idx}_${timestamp}_p1`, 
              productId: 'p1', 
              codice: 'WAKA-SM', 
              descrizione: 'Waka soMatch', 
              quantita: 1, 
              unita: 1, 
              prezzoApplicato: 40, 
              isOmaggio: false 
            });
          }
          if (note.includes("Ultra")) {
            items.push({ 
              id: `mig_${id}_${idx}_${timestamp}_p2`, 
              productId: 'p2', 
              codice: 'WAKA-U', 
              descrizione: 'Waka Ultra', 
              quantita: 1, 
              unita: 1, 
              prezzoApplicato: 99.90, 
              isOmaggio: false 
            });
          }
          if (note.includes("Relx")) {
            items.push({ 
              id: `mig_${id}_${idx}_${timestamp}_p5`, 
              productId: 'p5', 
              codice: 'RELX-IE', 
              descrizione: 'RELX KIT Infinity Essential', 
              quantita: 1, 
              unita: 1, 
              prezzoApplicato: 50, 
              isOmaggio: false 
            });
          }
          
          if (items.length > 0) {
            entry.items = items;
            entryUpdated = true;
          }
        }
      }

      if (entryUpdated) {
        promotedCount++;
        historyChanged = true;
      }
      return entry;
    });

    if (historyChanged) {
      extra.history = newHistory;
    }

    // 4. COERENZA CAMPI EXTRA
    const hasAnyExecutedOrder = extra.history.some((h: any) => h.tipo === 'ORDINE' && h.isEseguito === true);
    if (hasAnyExecutedOrder) {
      extra.ordineEvaso = true;
    }
    
    if (extra.richiestaOrdine) {
      extra.richiestaOrdine = false;
    }

    // B. GESTIONE HOSTESS E QUARANTENA DATI SPORCHI
    const hasLegacyHostess = extra.ultimaHostessData || extra.ultimaHostessInfo || extra.hostessData;
    
    if (hasLegacyHostess) {
      let eventDate = new Date();
      let note = extra.ultimaHostessInfo || 'Storico Hostess';
      let isDateValid = false;
      let hh = 12, mm = 0;
      
      const rawLegacyDate = extra.hostessData || extra.ultimaHostessData || 'Sconosciuta';
      const rawLegacyTime = extra.hostessInizio || 'Sconosciuta';

      try {
        if (extra.hostessData) {
          const parts = extra.hostessData.split('-');
          if (parts.length === 3) {
             const [y, m, d] = parts;
             if (extra.hostessInizio && extra.hostessInizio.includes(':')) [hh, mm] = extra.hostessInizio.split(':').map(Number);
             const testDate = new Date(Number(y), Number(m) - 1, Number(d), hh, mm, 0);
             if (!isNaN(testDate.getTime())) { eventDate = testDate; isDateValid = true; }
          }
        } 
        else if (extra.ultimaHostessInfo) {
          const match = extra.ultimaHostessInfo.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (match) {
            const [_, d, m, y] = match;
            const timeMatch = extra.ultimaHostessInfo.match(/dalle (\d{2}):(\d{2})/);
            if (timeMatch) { hh = Number(timeMatch[1]); mm = Number(timeMatch[2]); }
            const testDate = new Date(Number(y), Number(m) - 1, Number(d), hh, mm, 0);
            if (!isNaN(testDate.getTime())) { eventDate = testDate; isDateValid = true; }
          }
        }
        else if (extra.ultimaHostessData) {
           if (extra.ultimaHostessData.includes('/')) {
              const [d, m, y] = extra.ultimaHostessData.split('/');
              const testDate = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
              if (!isNaN(testDate.getTime())) { eventDate = testDate; isDateValid = true; }
           } else {
              const testDate = new Date(extra.ultimaHostessData);
              if (!isNaN(testDate.getTime())) { eventDate = testDate; isDateValid = true; }
           }
        }
      } catch (e) { isDateValid = false; }

      if (!isDateValid) {
         note = `[⚠️ DATA ORIGINALE: "${rawLegacyDate}" - ORA: "${rawLegacyTime}"] ${note}`;
         eventDate = new Date();
      }

      let calculatedFine = `${(hh + 4).toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
      if (extra.hostessFine) note = `${note} (Fine turno: ${extra.hostessFine})`.trim();
      else if (!note.includes('Fine turno') && isDateValid) note = `${note} (Fine turno: ${calculatedFine})`.trim();

      const isoDateStr = eventDate.toISOString();
      const dateOnlyStr = isoDateStr.split('T')[0];
      const existingHostess = extra.history.find((h: any) => h.tipo === 'HOSTESS' && h.data.startsWith(dateOnlyStr));

      if (!existingHostess) {
         extra.history.push({ tipo: 'HOSTESS', data: isoDateStr, note: note, importo: 0 });
         repairCount++;
      } else if (isDateValid && existingHostess.data.endsWith('Z') && new Date(existingHostess.data).getHours() === new Date().getHours()) {
         existingHostess.data = isoDateStr;
         if (!existingHostess.note.includes('Fine turno')) existingHostess.note = `${existingHostess.note} (Fine turno: ${calculatedFine})`.trim();
         repairCount++;
      }

      delete extra.ultimaHostessData;
      delete extra.ultimaHostessInfo;
      delete extra.hostessData;
      delete extra.hostessInizio;
      delete extra.hostessFine;
    }

    if (extra.history && extra.history.length > 0) {
      extra.history = extra.history.filter((h:any) => !isNaN(new Date(h.data).getTime()));
      extra.history.sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
    }

    updatedRubrica[id] = extra;
  });

  return { updatedRubrica, promotedCount, repairCount };
};
