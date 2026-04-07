src/
├── App.tsx
├── index.css
├── main.tsx
├── types.ts
├── version.json
├── components/
│   ├── AgendaTab.tsx
│   ├── ChangelogModal.tsx
│   ├── GuideModal.tsx
│   ├── MapView.tsx
│   ├── ModalContainer.tsx
│   ├── QuickEditModal.tsx
│   ├── RivenditaCard.tsx
│   ├── SettingsModal.tsx
│   ├── StatsTab.tsx
│   ├── StoreModal.tsx
│   └── StrategyDashboard.tsx
├── contexts/
│   ├── BudgetContext.tsx
│   ├── ModalContext.tsx
│   ├── ProductContext.tsx
│   └── StrategyContext.tsx
├── hooks/
│   └── usePersistence.ts
├── services/
│   ├── geminiService.ts
│   └── statsService.ts
└── utils/
    └── helpers.ts

2. MANIFESTO DEI FILE E RESPONSABILITÀ
Root Files
App.tsx
Scopo principale: Entry point principale dell'interfaccia utente. Gestisce lo stato globale (sessione, filtri, risultati di ricerca, rubrica, archivi) e l'orchestrazione dei componenti e dei modali.
Dipendenze: React, Lucide React, Componenti interni, Contexts (ModalContext, StrategyContext), Hooks (usePersistence), Services (geminiService, statsService), Utils (helpers.ts), types.ts, version.json.
main.tsx
Scopo principale: Punto di montaggio dell'applicazione React nel DOM. Avvolge l'app con i vari Provider (Contexts).
Dipendenze: React, ReactDOM, App.tsx, Context Providers, index.css.
types.ts
Scopo principale: Definizione centralizzata di tutte le interfacce e i tipi TypeScript utilizzati nell'applicazione.
Dipendenze: Nessuna (file di sole definizioni).
index.css
Scopo principale: Foglio di stile globale che include le direttive di Tailwind CSS.
Components (src/components/)
AgendaTab.tsx: Gestisce la visualizzazione e l'interazione con l'agenda delle visite e degli appuntamenti.
ChangelogModal.tsx: Modale per mostrare le novità e gli aggiornamenti dell'applicazione in base alla versione.
GuideModal.tsx: Modale informativo che fornisce istruzioni e guide all'utente.
MapView.tsx: Componente per la visualizzazione geografica (mappa) delle rivendite e degli store.
ModalContainer.tsx: Contenitore globale per la renderizzazione centralizzata dei vari modali dell'app.
QuickEditModal.tsx: Modale per la modifica rapida delle attività (Visita, Ordine, Hostess) associate a una rivendita.
RivenditaCard.tsx: Componente UI che rappresenta la singola scheda di una rivendita o store, mostrando dettagli e azioni rapide.
SettingsModal.tsx: Modale per la gestione delle impostazioni dell'app, backup/ripristino dati e pulizia cache.
StatsTab.tsx: Tab dedicato alla visualizzazione delle statistiche di vendita, visite e performance.
StoreModal.tsx: Modale per la creazione o modifica dei dettagli di uno specifico Store.
StrategyDashboard.tsx: Dashboard per il monitoraggio degli obiettivi, missioni, campagne e budget.
Contexts (src/contexts/)
BudgetContext.tsx: Fornisce lo stato globale relativo al budget e alle transazioni finanziarie.
ModalContext.tsx: Gestisce lo stato di apertura/chiusura e i dati passati ai vari modali dell'applicazione.
ProductContext.tsx: Fornisce il catalogo dei prodotti e le funzioni per gestirlo.
StrategyContext.tsx: Fornisce lo stato e le logiche di calcolo per missioni (MBO), campagne e configurazioni salariali.
Hooks (src/hooks/)
usePersistence.ts
Scopo principale: Hook custom per la gestione del salvataggio, esportazione, importazione e sincronizzazione dei dati (Giro Visite, CRM, Rubrica) tramite localStorage e API esterne.
Dipendenze: React, types.ts, helpers.ts, version.json, ModalContext.
Services (src/services/)
geminiService.ts
Scopo principale: Servizio per l'arricchimento dei dati delle rivendite interrogando un endpoint API locale (es. orari, telefono, zona).
Dipendenze: Fetch API.
statsService.ts
Scopo principale: Contiene la logica di business per il calcolo delle statistiche (fatturato, visite, ordini).
Utils (src/utils/)
helpers.ts
Scopo principale: Funzioni di utilità generiche (formattazione date, gestione orari, navigazione, parsing).
3. GESTIONE DELLO STATO E CONTEXTS (IL CERVELLO)
Il flusso dei dati è gestito principalmente tramite Context API per gli stati condivisi e App.tsx per lo stato core dell'interfaccia e del database locale.
BudgetContext
Dati esposti: budget (oggetto contenente le transazioni), funzioni di manipolazione (addTransaction, deleteTransaction, calculateBalance, initializeBudget, reconcileBudget, consolidateBudget).
Consumatori: StrategyDashboard.tsx e componenti legati alla visualizzazione finanziaria.
ModalContext
Dati esposti: Stati dei modali (confirmModal, shareModal, quickEditModal, revisitModalId, isKpiAssignOpen, selectedRivenditaId) e le relative funzioni di apertura/chiusura.
Consumatori: App.tsx, ModalContainer.tsx, RivenditaCard.tsx, AgendaTab.tsx e qualsiasi componente che necessiti di triggerare un modale.
ProductContext
Dati esposti: products (array di prodotti), funzioni CRUD (addProduct, updateProduct, deleteProduct), e funzioni di utilità (getCategories, getProductsByCategory).
Consumatori: Componenti legati alla creazione di ordini, StrategyDashboard.tsx, e modali di gestione catalogo.
StrategyContext
Dati esposti: salaryConfig, missions, campaigns, funzioni CRUD per missioni e campagne, e logiche di calcolo (calculateMboBonus, calculateExtraBonus, syncProgress).
Consumatori: App.tsx (per la sincronizzazione in background dei progressi), StrategyDashboard.tsx, StatsTab.tsx.
Stato Locale Core (App.tsx)
App.tsx detiene lo stato vitale del database locale (sincronizzato con localStorage tramite l'hook usePersistence): giroVisite, crmAnagrafiche, stores, e rubrica (dati extra e storico delle rivendite). Questi dati vengono passati a cascata come props ai vari Tab (AgendaTab, StatsTab) e componenti (RivenditaCard).
4. CORE TYPES (IL CONTRATTO DATI)
Le interfacce definite in types.ts modellano il database locale (salvato in localStorage):
SearchResult: Modella i dati anagrafici base di una rivendita o store (Provincia, Comune, Num. Rivendita, Indirizzo, flag isStore, ecc.).
RivenditaExtra: Modella i dati arricchiti e operativi di una rivendita (stato, visita, giorno di levata, contatti, target idonei, storico attività).
RivenditaHistoryEntry: Rappresenta una singola attività passata (Visita, Ordine, Hostess), includendo data, note, importo e gli articoli dell'ordine (OrderItem[]).
RubricaData: Un dizionario (Record<string, RivenditaExtra>) che mappa l'ID univoco di una rivendita ai suoi dati extra e allo storico. È il cuore del CRM locale.
Product & OrderItem: Product definisce il catalogo (codice, descrizione, categoria, prezzo base), mentre OrderItem rappresenta la riga d'ordine (quantità, prezzo applicato, omaggio).
Mission & Campaign: Definiscono gli obiettivi di business. Mission traccia target di fatturato, attivazioni o prodotti specifici. Campaign definisce periodi promozionali con bonus associati.
AMBudget & BudgetTransaction: Modellano il portafoglio/budget a disposizione, tracciando ricariche e spese.