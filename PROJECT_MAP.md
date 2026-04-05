# PROJECT MAP - TgesT Full-Stack Ecosystem

## 0. LIVELLO 0: ROOT & INFRASTRUTTURA (L'Ossatura)
L'infrastruttura di base che abilita lo sviluppo, il build e la distribuzione dell'applicazione come Progressive Web App (PWA).

- **vite.config.ts**: Il cuore del build engine. Configura i plugin React e Tailwind CSS, gestisce gli alias di percorso (`@`) e implementa misure di sicurezza rimuovendo le chiavi API dal blocco `define` per evitare esposizioni accidentali nel bundle frontend.
- **tsconfig.json**: Definisce le regole di compilazione TypeScript, garantendo la coerenza dei tipi tra il frontend React e il backend Node.js (ESM).
- **package.json**: Manifest del progetto. 
  - **Scripts**: `dev` e `start` utilizzano `tsx` per eseguire `server.ts` direttamente, abilitando un ambiente di sviluppo full-stack fluido.
  - **Dependencies**: Un mix critico di librerie frontend (React, Leaflet, Motion) e backend (Express, better-sqlite3, Cheerio).
- **PWA Implementation**:
  - **public/sw.js (Service Worker)**: Implementa una strategia di **Cache-First** per gli asset statici e una logica di **Offline Fallback** (ritorna una pagina HTML minimale in caso di assenza di rete). Gestisce l'invalidazione della cache tramite iniezione dinamica della versione dal server.
  - **public/manifest.json**: Definisce l'identità visiva e il comportamento dell'app una volta installata (icone, colori, modalità standalone).

---

## 1. LIVELLO 1: BACKEND & MOTORE DI SCRAPING (I Lavoratori)
Il motore "headless" che estrae i dati dai portali governativi e gestisce la persistenza centralizzata.

- **server.ts**: L'orchestratore full-stack.
  - **Scraping Proxy**: Gestisce la sessione complessa JSF (JavaServer Faces) del portale ADM, manipolando ViewState e Cookies per eseguire ricerche multi-pagina.
  - **Persistence Layer**: Interfaccia `better-sqlite3` per gestire `tgest.db`. Sincronizza Rubrica, CRM e Giro Visite, permettendo la persistenza oltre il `localStorage`.
  - **AI & Geo Proxy**: Protegge la `GEMINI_API_KEY` ed esegue l'arricchimento dei dati (con Web Search) e il geocoding (Nominatim) lato server.
- **fetch.ts**: Script di diagnostica a basso livello per verificare la raggiungibilità HTTPS dei server ADM.
- **analyze_rubrica.ts**: Strumento di audit del database. Analizza l'integrità dei dati salvati, focalizzandosi sulla migrazione dei campi storici e sullo stato degli ordini.
- **Suite 'test-jsf' (1-7) & 'output.html' (1-6)**: 
  - **Ruolo**: Laboratorio di Reverse Engineering. Questi script isolati sono fondamentali per mappare i selettori CSS dinamici e i parametri POST necessari per navigare nel portale ADM. I file HTML sono snapshot usati per validare le regex e i selettori di Cheerio.

---

## 2. LIVELLO 2: SERVIZI, UTILITY & DATA TYPES (Il Sistema Nervoso)
Moduli trasversali che collegano la logica di business all'interfaccia utente.

- **src/services/geminiService.ts**: Bridge frontend per l'arricchimento. Astrae la chiamata all'endpoint `/api/enrich`, gestendo i fallback in caso di errore del server o timeout dell'AI.
- **src/services/statsService.ts**: Coprocessore matematico. Centralizza i calcoli complessi per fatturato, KPI, statistiche BR, ordini e visite. La migrazione completa della logica matematica (Fase 1 e Fase 2) è conclusa.
- **src/hooks/usePersistence.ts**: Custom Hook per la gestione della persistenza, backup, export Excel/Maps e sincronizzazione cloud. Isola la logica di I/O dal componente UI principale.
- **src/utils/helpers.ts**: Libreria di funzioni pure e utility. Gestisce:
  - Deep-linking per navigazione GPS (Android/iOS/Web).
  - Formattazione date per Google Calendar.
  - Astrazione tipizzata del `localStorage`.
  - Calcolo orari e turni (es. Hostess).
- **src/types/index.ts**: La "Sorgente di Verità" per i dati. Definisce le interfacce `SearchResult`, `RivenditaExtra` e `RubricaData`, garantendo la coerenza dei tipi in tutta l'applicazione.

---

## 3. LIVELLO 3: CORE REACT (Il Cervello & L'Interfaccia)
L'interfaccia utente reattiva che orchestra l'esperienza dell'utente finale.

- **App.tsx**: Il "Grande Orchestratore".
  - **Gestione Stato**: Coordina ~60 variabili di stato, gestendo la sincronizzazione tra DB SQLite e UI.
  - **Rate Limiting (`aiUsage`)**: Implementa un sistema di "gettoni" (timestamp) per limitare le chiamate AI (max 2/min), prevenendo blocchi delle quote API.
  - **Logiche di Navigazione**: Gestisce il routing interno tramite Tab e intercetta il tasto "Back" di Android per chiudere i modali prima di navigare.
- **Componenti Esternalizzati**:
  - **MapView.tsx**: Integrazione Leaflet per la visualizzazione geografica con clustering dei marker.
  - **AgendaTab.tsx**: Componente di layout per la gestione delle scadenze, servizi hostess e ordini da evadere.
  - **KpiTab.tsx**: Componente per la visualizzazione e gestione degli obiettivi mensili (Fatturato, Attivazioni, Prodotti) e il monitoraggio delle rivendite targettizzate.
  - **SettingsModal.tsx**: Pannello di controllo centrale per la gestione del cloud sync, backup fisici, riparazione dati, quote AI e target economici globali.
  - **StatsTab.tsx**: Modulo dedicato alla visualizzazione delle statistiche, KPI, termometro del territorio e riepilogo attività.
  - **RivenditaCard.tsx**: Componente atomico complesso. Gestisce l'espansione, l'arricchimento AI locale e le azioni rapide (Call, Nav, Save).
  - **QuickEditModal.tsx**: Interfaccia di data-entry rapida per note, ordini e pianificazione visite.
  - **TargetModal.tsx**: Gestisce l'impostazione degli obiettivi economici mensili e dei Quorum operativi (Focus e Attivazioni) con persistenza in LocalStorage.
  - **StoreModal.tsx**: Modulo autonomo per l'inserimento di nuovi Store. Gestisce localmente lo stato del form per non sovraccaricare il render cycle globale.
  - **ChangelogModal.tsx & GuideModal.tsx**: Componenti informativi per l'onboarding e il tracking delle versioni.

---

## 4. MATRICE DEI FLUSSI CROSS-LAYER (Ciclo di Vita del Dato)

| Fase | Flusso Architetturale | Tecnologie Coinvolte |
| :--- | :--- | :--- |
| **Estrazione** | `App.tsx` (Search) -> `server.ts` (Proxy) -> `ADM Portal` | Cheerio, Fetch API, JSF ViewState |
| **Arricchimento** | `RivenditaCard` -> `geminiService.ts` -> `server.ts` -> `Gemini API` | Google GenAI, Web Search Tool |
| **Persistenza** | `App.tsx` (State Change) -> `server.ts` -> `SQLite (tgest.db)` | better-sqlite3, JSON.stringify |
| **Offline** | `Browser` -> `sw.js` (Cache Check) -> `LocalStorage` | Service Worker, Cache API, Web Storage |
| **Navigazione** | `RivenditaCard` -> `helpers.ts` -> `Deep Link (geo: / maps:)` | Navigator UserAgent, URL Encoding |

---

## 5. PIANO DI EVOLUZIONE (Backlog Architetturale)
- **Modularizzazione**: La migrazione delle logiche di calcolo KPI e statistiche da `App.tsx` a `statsService.ts` e `StatsTab.tsx` è conclusa. Prossimo step: estrazione del Tab CRM.
- **Sincronizzazione**: Implementare un sistema di "Background Sync" nel Service Worker per inviare i dati salvati offline al DB SQLite non appena torna la connessione.
- **Sicurezza**: Rafforzare la validazione dei dati in `server.ts` per prevenire injection nel database SQLite.
