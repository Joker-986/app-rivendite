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
