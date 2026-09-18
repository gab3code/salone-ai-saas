import { BarraScheletro, ScheletroCaricamento } from "../scheletro-caricamento";

export default function Caricamento() {
  return (
    <ScheletroCaricamento titolo="Impostazioni">
      {Array.from({ length: 8 }).map((_, i) => (
        <BarraScheletro key={i} classe="h-12 w-full" />
      ))}
    </ScheletroCaricamento>
  );
}
