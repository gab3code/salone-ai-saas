import { ScheletroCaricamento } from "./scheletro-caricamento";

/**
 * Vale per la dashboard e per ogni sua sezione che non abbia un proprio
 * `loading.tsx` (impostazioni, team, abbonamento, fatturazione...).
 */
export default function Caricamento() {
  return <ScheletroCaricamento titolo="Dashboard" righe={5} />;
}
