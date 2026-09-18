import { BarraScheletro, ScheletroCaricamento } from "../scheletro-caricamento";

export default function Caricamento() {
  return (
    <ScheletroCaricamento titolo="Analytics">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <BarraScheletro key={i} classe="h-24 w-full" />
        ))}
      </div>
      <BarraScheletro classe="h-64 w-full" />
    </ScheletroCaricamento>
  );
}
