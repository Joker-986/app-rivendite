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

export interface Product {
  id: string;
  codice: string;
  descrizione: string;
  categoria: string;
  unitaDefault: string;
  prezzoUnitaDefault: number;
  valoreBonus?: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  codice: string;
  descrizione: string;
  quantita: number;
  unita: string;
  prezzoApplicato: number;
  isOmaggio: boolean;
}

export interface RivenditaHistoryEntry {
  data: string;
  tipo: 'VISITA' | 'ORDINE' | 'HOSTESS';
  note: string;
  importo: number;
  items?: OrderItem[];
  stato?: string;
}

export interface Mission {
  id: string;
  nome: string;
  tipo: 'FATTURATO' | 'ATTIVAZIONE' | 'PRODOTTO';
  target: number;
  targetSingolo?: number;
  pesoPercentuale: number;
  progressoAttuale: number;
  valoreGenerato?: number;
  stato?: "ATTIVA" | "ARCHIVIATA";
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

export interface BudgetTransaction {
  id: string;
  data: string;
  descrizione: string;
  importo: number;
  tipo: 'RICARICA' | 'SPESA';
}

export interface AMBudget {
  id: string;
  nome: string;
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
}

export interface ArchiveEntry {
  mese: string;
  brAssegnati: number;
  brCompletati: number;
  targetMensile: number;
  globalFatto: number;
}

export type RubricaData = Record<string, RivenditaExtra>;
