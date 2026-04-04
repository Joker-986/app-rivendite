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

export const calculateBrStats = (
  rubrica: RubricaData, 
  targetBassoRendente: number, 
  meseSelezionato: string
) => {
  const attuali = Object.values(rubrica) as RivenditaExtra[];
  const targetizzate = attuali.filter(r => r.hasTarget === true);
  
  const [year, month] = meseSelezionato.split('-').map(Number);
  const meseCorrente = month - 1;
  const annoCorrente = year;

  const completate = targetizzate.filter(r => {
    const fattoMese = (r.history || []).reduce((acc, curr) => {
      if (curr.tipo === 'ORDINE') {
        const d = new Date(curr.data);
        if (d.getMonth() === meseCorrente && d.getFullYear() === annoCorrente) {
          return acc + (Number(curr.importo) || 0);
        }
      }
      return acc;
    }, 0);
    return fattoMese >= targetBassoRendente;
  });

  return {
    assegnati: targetizzate.length,
    completati: completate.length,
    percentuale: targetizzate.length > 0 ? (completate.length / targetizzate.length) * 100 : 0
  };
};

export const calculateKpiStats = (
  rubrica: RubricaData, 
  targetBassoRendente: number, 
  meseSelezionato: string,
  allRivendite: SearchResult[]
) => {
  const attuali = Object.entries(rubrica) as [string, RivenditaExtra][];
  const targetizzati = attuali.filter(([_, r]) => r.hasTarget || r.kpiAttivazione || r.kpiProdotto);

  const [year, month] = meseSelezionato.split('-').map(Number);
  const meseCorrente = month - 1;
  const annoCorrente = year;

  let fatturatoAssegnati = 0, fatturatoCompletati = 0;
  let attivazioneAssegnati = 0, attivazioneCompletati = 0;
  let prodottoAssegnati = 0, prodottoCompletati = 0;

  const lista = targetizzati.map(([id, r]) => {
    const riv = allRivendite.find(x => getRivenditaId(x) === id);
    if (!riv) return null; 

    const fattoMese = (r.history || []).reduce((acc: number, curr: any) => {
      if (curr.tipo === 'ORDINE') {
        const d = new Date(curr.data);
        if (d.getMonth() === meseCorrente && d.getFullYear() === annoCorrente) {
          return acc + (Number(curr.importo) || 0);
        }
      }
      return acc;
    }, 0);

    if (r.hasTarget) { fatturatoAssegnati++; if (fattoMese >= targetBassoRendente) fatturatoCompletati++; }
    if (r.kpiAttivazione) { attivazioneAssegnati++; if (fattoMese > 0) attivazioneCompletati++; }
    if (r.kpiProdotto) { prodottoAssegnati++; if (r.kpiProdottoCompletato) prodottoCompletati++; }

    return {
      id,
      nome: riv.isStore ? (riv.storeName || 'Store') : `Riv. ${riv['Num. Rivendita']}`,
      comune: riv['Comune'] || '',
      soloNumero: riv.isStore ? (riv.storeNumber || '') : (riv['Num. Rivendita'] || ''),
      fattoMese,
      hasTarget: r.hasTarget,
      kpiAttivazione: r.kpiAttivazione,
      kpiProdotto: r.kpiProdotto,
      kpiProdottoNome: r.kpiProdottoNome,
      kpiProdottoCompletato: r.kpiProdottoCompletato
    };
  }).filter(x => x !== null);

  return {
    fatturato: { assegnati: fatturatoAssegnati, completati: fatturatoCompletati },
    attivazione: { assegnati: attivazioneAssegnati, completati: attivazioneCompletati },
    prodotto: { assegnati: prodottoAssegnati, completati: prodottoCompletati },
    lista
  };
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
