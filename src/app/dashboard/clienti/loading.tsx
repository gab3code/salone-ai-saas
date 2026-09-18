import { BarraScheletro, ScheletroCaricamento } from "../scheletro-caricamento";

export default function Caricamento() {
  return (
    <ScheletroCaricamento titolo="Clienti">
      <div className="flex gap-2">
        <BarraScheletro classe="h-9 w-72" />
        <BarraScheletro classe="h-9 w-24" />
      </div>
      <div className="rounded border border-zinc-200">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-b border-zinc-100 p-3 last:border-0">
            <BarraScheletro classe="h-4 w-full" />
          </div>
        ))}
      </div>
    </ScheletroCaricamento>
  );
}
