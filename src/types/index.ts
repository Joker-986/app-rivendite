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
  _giroLength?: number; // Usato temporaneamente nel giro
  [key: string]: any;
}

export interface RivenditaHistoryEntry {
  data: string;
  tipo: 'VISITA' | 'ORDINE' | 'HOSTESS';
  note: string;
  importo: number;
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
  kpiAttivazione?: boolean;
  kpiProdotto?: boolean;
  kpiProdottoNome?: string;
  kpiProdottoCompletato?: boolean;
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
  hasTarget?: boolean;
  targetSpecifico?: number;
}

export interface ArchiveEntry {
  mese: string;
  brAssegnati: number;
  brCompletati: number;
  targetMensile: number;
  globalFatto: number;
}

export type RubricaData = Record<string, RivenditaExtra>;
