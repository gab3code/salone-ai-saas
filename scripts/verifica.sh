#!/usr/bin/env bash
#
# Verifica completa prima di dire "fatto".
#
#   ./scripts/verifica.sh          controlli veloci (nessun costo, nessun browser)
#   ./scripts/verifica.sh --e2e    aggiunge gli scenari Playwright deterministici
#
# Perche' esiste (18/09/2026): i controlli che contano sono quattro, girano in
# ordine dal piu' veloce al piu' lento, e ognuno trova una classe di problemi
# che gli altri non vedono.
#
#   tipi    -> firme e contratti, non dice niente sul comportamento
#   lint    -> import morti, variabili dimenticate
#   test    -> il comportamento, ma solo dentro un livello alla volta
#   build   -> i confini che solo Next conosce: una server action passata a un
#              componente client, un modulo server finito in un bundle browser.
#              Questi tre non se ne accorgono, e in produzione e' una pagina
#              bianca.
#
# Lo script NON si ferma al primo errore: li esegue tutti e riassume alla
# fine. Sapere che sono rotti tre controlli su quattro e' un'informazione
# diversa da "il primo e' rosso", e costa lo stesso tempo.

set -uo pipefail
cd "$(dirname "$0")/.."

CON_E2E=0
[ "${1:-}" = "--e2e" ] && CON_E2E=1

VERDE=$'\033[32m'; ROSSO=$'\033[31m'; GRIGIO=$'\033[90m'; FINE=$'\033[0m'
ESITI=()
FALLITI=0

esegui() {
  local nome="$1"; shift
  echo ""
  echo "${GRIGIO}── $nome ──${FINE}"
  local inizio; inizio=$(date +%s)
  if "$@"; then
    local durata=$(( $(date +%s) - inizio ))
    ESITI+=("${VERDE}ok${FINE}    $nome (${durata}s)")
  else
    local durata=$(( $(date +%s) - inizio ))
    ESITI+=("${ROSSO}ROTTO${FINE} $nome (${durata}s)")
    FALLITI=$((FALLITI + 1))
  fi
}

esegui "tipi" npx tsc --noEmit
esegui "lint" npm run lint
esegui "test unitari" npm test
esegui "build di produzione" npx next build

# I permessi del database: confronta quello che dichiarano le migrazioni con
# quello che c'e' davvero. Legge e basta, ma parla col database vero di
# .env.local -- quindi salta senza far rumore se non e' configurato.
if [ -f .env.local ]; then
  esegui "permessi del database" npm run permessi
else
  ESITI+=("${GRIGIO}salto${FINE} permessi del database (.env.local assente)")
fi

# Gli scenari Playwright deterministici: niente modello, niente costi, ma
# serve il database di prova (.env.test) e qualche minuto.
if [ "$CON_E2E" = "1" ]; then
  esegui "scenari e2e deterministici" npm run test:e2e:deterministici
  esegui "scenario 30 (configurazione)" npx playwright test tests/e2e/30-configurazione-completa.spec.ts
else
  ESITI+=("${GRIGIO}salto${FINE} scenari e2e (aggiungi --e2e)")
fi

echo ""
echo "════════════════════════════════════"
for riga in "${ESITI[@]}"; do echo -e "  $riga"; done
echo "════════════════════════════════════"

if [ "$FALLITI" -gt 0 ]; then
  if [ "$FALLITI" = "1" ]; then
    echo "${ROSSO}Un controllo rotto.${FINE}"
  else
    echo "${ROSSO}$FALLITI controlli rotti.${FINE}"
  fi
  echo "${GRIGIO}Se il rosso e' solo sui permessi, guarda il messaggio: \"database non raggiungibile\"${FINE}"
  echo "${GRIGIO}vuol dire rete, non permessi sbagliati.${FINE}"
  exit 1
fi
echo "${VERDE}Tutto a posto.${FINE}"
