import { SearchResult, RivenditaExtra, RubricaData } from '../types';
import { getRivenditaId } from '../utils/helpers';

export const calculateFatturatoPeriodo = (
  rubrica: RubricaData, 
  isDateInRange: (dateStr?: string) => boolean
): number => {
  let totale = 0;
  Object.values(rubrica).forEach((riv: any) => {
    if (riv.history && Array.isArray(riv.history)) {
      riv.history.forEach((evento: any) => {
        if (evento.tipo === 'ORDINE' && isDateInRange(evento.data)) {
          totale += Number(evento.importo || 0);
        }
      });
    }
  });
  return totale;
};

export const calculateOrderStats = (
  rubrica: RubricaData,
  allRivendite: SearchResult[],
  isDateInRange: (dateStr?: string) => boolean
) => {
  const allEntries = Object.entries(rubrica) as [string, RivenditaExtra][];
  const mapEntry = (id: string, data: any) => {
    const riv = allRivendite.find(r => getRivenditaId(r) === id);
    if (!riv) return { nome: null };
    return { 
      id, 
      nome: riv.isStore ? (riv.storeName || 'Store') : `Riv. ${riv['Num. Rivendita']}`,
      soloNumero: riv.isStore ? (riv.storeNumber || '') : (riv['Num. Rivendita'] || ''),
      comune: riv['Comune'] || '',
      dataOrdine: data.dataOrdine,
      note: data.noteOrdine || 'Nessuna nota'
    };
  };

  const daEvadereList = allEntries
    .filter(([_, d]) => d.richiestaOrdine === true && d.ordineEvaso !== true)
    .map(([id, d]) => mapEntry(id, d)).filter(o => o.nome);

  const evasiList = allEntries
    .filter(([_, d]) => d.ordineEvaso === true && isDateInRange(d.dataOrdine || d.dataVisita))
    .map(([id, d]) => mapEntry(id, d)).filter(o => o.nome);

  return { daEvadere: daEvadereList.length, evasi: evasiList.length, listaDaEvadere: daEvadereList, listaEvasi: evasiList };
};

export const calculateCrmStats = (
  rubrica: RubricaData,
  combinedRivendite: SearchResult[],
  isDateInRange: (dateStr?: string) => boolean
) => {
  let attivate = 0, nonAttive = 0, rip = 0, daAssegnare = 0;
  
  const filtrati = combinedRivendite.filter(r => {
    const id = getRivenditaId(r);
    const data = rubrica[id];
    if (!data) return false;
    return isDateInRange(data.dataVisita || data.lastDataVisita || data.dataOrdine);
  });

  filtrati.forEach(r => {
    const s = rubrica[getRivenditaId(r)]?.stato;
    if (s === 'Attivata') attivate++;
    else if (s === 'Non Attiva') nonAttive++;
    else if (s === 'RIP') rip++;
    else daAssegnare++;
  });
  return { total: filtrati.length, attivate, nonAttive, rip, daAssegnare };
};

export const calculateVisitStats = (
  rubrica: RubricaData,
  combinedRivendite: SearchResult[],
  giroVisite: SearchResult[],
  isDateInRange: (dateStr?: string) => boolean
) => {
  const listaVisitate: any[] = [];
  const prossimi: any[] = [];
  const oggi = new Date(); oggi.setHours(0,0,0,0);

  combinedRivendite.forEach(r => {
    const id = getRivenditaId(r);
    const d = rubrica[id] as RivenditaExtra;
    const infoBase = {
      id,
      nome: r.isStore ? (r.storeName || 'Store') : `Riv. ${r['Num. Rivendita']}`,
      soloNumero: r.isStore ? (r.storeNumber || '') : (r['Num. Rivendita'] || ''),
      comune: r.Comune
    };
    
    if (d?.dataVisita && isDateInRange(d.dataVisita)) {
      listaVisitate.push({ ...infoBase, data: new Date(d.dataVisita).toLocaleDateString('it-IT').slice(0, 5) });
    }

    if (d?.dataRivisita) {
      const [y, m, day] = d.dataRivisita.split('-').map(Number);
      const dr = new Date(y, m - 1, day);
      if (dr >= oggi || (dr < oggi && d.visitata !== 'Si')) {
        prossimi.push({ ...infoBase, dataRivisita: d.dataRivisita, ora: d.oraRivisita || '', dateObj: dr, isOverdue: dr < oggi });
      }
    }
  });

  const listaRimanenti = giroVisite.filter(r => {
    const id = getRivenditaId(r);
    return (rubrica[id] as RivenditaExtra)?.visitata !== 'Si';
  }).map(r => ({
    id: getRivenditaId(r),
    nome: r.isStore ? (r.storeName || 'Store') : `Riv. ${r['Num. Rivendita']}`,
    soloNumero: r.isStore ? (r.storeNumber || '') : (r['Num. Rivendita'] || ''),
    comune: r.Comune
  }));

  return { 
    vPeriodo: listaVisitate.length, 
    listaVisitate, 
    prossimi: prossimi.sort((a,b) => a.dateObj.getTime() - b.dateObj.getTime()).slice(0, 10), 
    rimanentiGiro: listaRimanenti.length,
    listaRimanenti
  };
};
