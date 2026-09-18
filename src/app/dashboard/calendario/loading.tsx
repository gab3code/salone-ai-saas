import { BarraScheletro, ScheletroCaricamento } from "../scheletro-caricamento";

export default function Caricamento() {
  return (
    <ScheletroCaricamento titolo="Calendario">
      <div className="flex flex-wrap gap-3">
        <BarraScheletro classe="h-9 w-32" />
        <BarraScheletro classe="h-9 w-40" />
        <BarraScheletro classe="h-9 w-32" />
      </div>
      <BarraScheletro classe="h-5 w-56" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <BarraScheletro key={i} classe="h-12 w-full" />
        ))}
      </div>
      <BarraScheletro classe="h-48 w-full" />
    </ScheletroCaricamento>
  );
}
