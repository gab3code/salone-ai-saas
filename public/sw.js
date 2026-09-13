// Service worker minimo (PIANO.md Fase 4 "PWA installabile" vs Fase 7 "PWA
// rifinita"): serve SOLO a soddisfare il criterio di installabilità di
// Chrome (un service worker registrato con un gestore "fetch"), non
// implementa nessuna strategia di cache -- ogni richiesta passa dritta alla
// rete. Deliberato: durante lo sviluppo attivo un service worker che mette
// in cache in modo aggressivo è un modo classico di vedersi servire
// contenuto vecchio senza capire perché. Il caching vero/offline è
// rimandato alla passata di rifinitura in Fase 7.
self.addEventListener("fetch", () => {});
