export interface Option {
  value: string;
  label: string;
}

export interface SearchResult {
  uid?: string;
  'Prov.': string;
  'Comune': string;
  'Num. Rivendita': string;
  'Indirizzo': string;
  'Tipo Rivendita'?: string;
  'Stato'?: string;
  'Distr. Automatico'?: string;
  isStore?: boolean;
  storeName?: string;
  storeNumber?: string;
  isChain?: boolean;
  chainCount?: number;
  rivenditaUfficiale?: string;
  pec?: string;
  _giroLength?: number;
  [key: string]: any;
}

// 1. ANAGRAFICA PRODOTTI (IL MAGAZZINO)
export interface Product {
  id: string;
  codice: string;
  descrizione: string;
  prezzoUnita: number;
  unita: 'Pezzi' | 'Stecche';
  attivo?: boolean;
  categoria?: string;
}

// 2. IL CARRELLO (ORDER ITEM)
export interface OrderItem {
  id: string;               // ID unico per riga (permette righe doppie dello stesso SKU)
  productId: string;
  codice: string;
  descrizione: string;
  quantita: number;         // Numero di unità (es. 1 stecca)
  unita: number;            // Moltiplicatore usato (es. 10 o 1)
  prezzoApplicato: number;  // Prezzo cristallizzato al momento dell'ordine
  isOmaggio: boolean;       // Se true, costo 0 per cliente, scala budget AM
  isCredito?: boolean;
}

export interface RivenditaHistoryEntry {
  data: string;
  tipo: 'VISITA' | 'ORDINE' | 'HOSTESS';
  note: string;
  importo: number;
  stato?: string;
  items?: OrderItem[];      // Il carrello prodotti strutturato
  budgetAmScalato?: number; // Quota totale scalata dal budget AM per questo ordine
  dataEvasione?: string;    // La data scelta per la consegna (YYYY-MM-DD)
  isEseguito?: boolean;     // Il flag magico per la Regia
  dataEsecuzione?: string;  // Quando hai cliccato "Eseguito"
  visitaInizio?: string;
  visitaFine?: string;
}

export interface MissionDetail {
  id: string;
  nome: string;
  comune: string;
  valore?: number;
  data?: string;
  nota?: string;
}

export interface Mission {
  id: string;
  nome: string;
  tipo: 'FATTURATO' | 'ATTIVAZIONE' | 'PRODOTTO';
  sku?: string;
  target: number;
  targetSingolo?: number;
  pesoPercentuale: number;
  progressoAttuale: number;
  valoreGenerato?: number;
  stato?: "ATTIVA" | "ARCHIVIATA";
  dettagliProgresso?: MissionDetail[];
}

export interface CampaignPeriod {
  id: string;
  dataInizio: string;
  dataFine?: string;
}

export interface Campaign {
  id: string;
  nome: string;
  sku: string;
  valoreBonus: number;
  periodi: CampaignPeriod[];
  stato?: "ATTIVA" | "ARCHIVIATA";
}

export interface SalaryConfig {
  ralAnnua: number;
  percentualeBonus: number;
}

// 3. BUDGET AM & TESORETTO (ROLLOVER)
export interface BudgetTransaction {
  id: string;
  data: string;
  importo: number;
  tipo?: 'RICARICA' | 'SPESA';
  nota?: string;           // es: "Ricarica AM", "Azzeramento Tesoretto"
}

export interface AMBudget {
  id: string;              
  nome: string;            // es: "Gestione 2026"
  dataInizio: string;
  dataFine: string;
  transazioni: BudgetTransaction[]; 
}

export interface RivenditaExtra {
  stato: 'Attivata' | 'Non Attiva' | 'RIP' | '';
  visitata: 'Si' | 'Da Rivisitare' | 'No' | '';
  dataVisita?: string;
  oraVisita?: string;
  lastDataVisita?: string;
  lastOraVisita?: string;
  dataRivisita?: string;
  oraRivisita?: string;
  giornoLevata: 'Lunedì' | 'Martedì' | 'Mercoledì' | 'Giovedì' | 'Venerdì' | '';
  riferimento: string;
  telefono: string;
  pIva: string;
  mail: string;
  pec?: string;
  isSavedToRubrica?: boolean;
  richiestaOrdine?: boolean;
  noteOrdine?: string;
  dataOrdine?: string;
  ordineEvaso?: boolean;
  note?: string;
  manualCap?: string;
  ordinante?: 'alto' | 'basso' | '';
  targetIdoneo: string[]; // Array di ID missioni
  history?: RivenditaHistoryEntry[];
  importoOrdine?: number;
  hostessData?: string;
  hostessInizio?: string;
  hostessFine?: string;
  codiceUnivoco?: string;
  showHostessModule?: boolean;
  ultimaHostessInfo?: string;
  zona?: string;
  targetMese?: number;
  targetSpecifico?: number;
  carrelloBozza?: OrderItem[]; // Supporto per non perdere dati se si chiude la scheda
  visitaInCorso?: string;
  [key: string]: any;
}

export interface ArchiveEntry {
  mese: string;
  brAssegnati: number;
  brCompletati: number;
  targetMensile: number;
  globalFatto: number;
}

export type RubricaData = Record<string, RivenditaExtra>;
