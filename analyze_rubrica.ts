import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'tgest.db');
const db = new Database(dbPath);

try {
  const tables = ['crm_data', 'giro_visite', 'stores', 'rubrica'];
  let totalRows = 0;

  tables.forEach(table => {
    const rows = db.prepare(`SELECT count(*) as count FROM ${table}`).get() as any;
    console.log(`Tabella ${table}: ${rows.count} righe`);
    totalRows += rows.count;
  });

  if (totalRows === 0) {
    console.log('Il database è attualmente vuoto.');
  } else {
    const rows = db.prepare('SELECT id, data FROM rubrica').all();
  
    let oldFieldsOrders = 0;
    let historyOrdersWithoutStatus = 0;
    let historyOrdersWithStatus = 0;
    let totalRivenditeWithOrders = 0;

    rows.forEach((row: any) => {
      const data = JSON.parse(row.data);
      let hasOrder = false;

      // Check old fields
      if (data.richiestaOrdine === true) {
        oldFieldsOrders++;
        hasOrder = true;
      }

      // Check history
      if (data.history && Array.isArray(data.history)) {
        data.history.forEach((h: any) => {
          if (h.tipo === 'ORDINE') {
            hasOrder = true;
            if (h.stato === 'DA_EVADERE') {
              historyOrdersWithStatus++;
            } else {
              historyOrdersWithoutStatus++;
            }
          }
        });
      }

      if (hasOrder) totalRivenditeWithOrders++;
    });

    console.log('--- ANALISI RUBRICA ---');
    console.log(`Totale rivendite con ordini: ${totalRivenditeWithOrders}`);
    console.log(`Ordini nei campi vecchi (richiestaOrdine: true): ${oldFieldsOrders}`);
    console.log(`Ordini in history SENZA stato 'DA_EVADERE': ${historyOrdersWithoutStatus}`);
    console.log(`Ordini in history CON stato 'DA_EVADERE': ${historyOrdersWithStatus}`);
    console.log('-----------------------');
  }

} catch (error) {
  console.error('Errore durante l\'analisi:', error);
} finally {
  db.close();
}
