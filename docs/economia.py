USD=0.92  # 1 USD in EUR (settembre 2026, ipotesi prudente ~0.90-0.93)
IVA=1.22  # reverse charge non recuperabile sui fornitori esteri (e IVA italiana su Skebby)

PREZZI={"starter":19.90,"growth":39.90,"pro":89.90}
EXTRA={"starter":10,"growth":15,"pro":20}
OP={"starter":1.3,"growth":1.6,"pro":2.5}   # operatori medi per piano

def ricavo(p): return PREZZI[p]+EXTRA[p]*(OP[p]-1)

def stripe(r): return r*0.015+0.25+r*0.007

# costi variabili mensili per tenant pagante (euro), caso medio e caso "quota piena"
MSG_MEDIO={"starter":0,"growth":300,"pro":500}         # messaggi cliente/mese realistici
MSG_PIENO={"starter":0,"growth":2500+500*(OP["growth"]-1),"pro":3000*OP["pro"]}
COSTO_MSG=0.0079*USD*IVA
SMS_MEDIO={"starter":0,"growth":0,"pro":30*OP["pro"]}
SMS_PIENO={"starter":0,"growth":0,"pro":100*OP["pro"]}
COSTO_SMS=0.09  # Skebby, IVA inclusa circa
EMAIL_TENANT=150  # email/mese per tenant (conferme, promemoria, follow-up)

def var_medio(p): return MSG_MEDIO[p]*COSTO_MSG+SMS_MEDIO[p]*COSTO_SMS+stripe(ricavo(p))
def var_pieno(p): return MSG_PIENO[p]*COSTO_MSG+SMS_PIENO[p]*COSTO_SMS+stripe(ricavo(p))

print("=== PER PIANO (euro/mese, 1 tenant) ===")
for p in PREZZI:
    r=ricavo(p); vm=var_medio(p); vp=var_pieno(p)
    print(f"{p:8s} incasso {r:6.2f}  var medio {vm:5.2f} ({vm/r*100:4.1f}%)  var quota piena {vp:6.2f} ({vp/r*100:4.1f}%)  stripe {stripe(r):.2f}")

# costi fissi mensili
def fissi(n_paganti, n_free):
    tenants=n_paganti+n_free
    email=tenants*EMAIL_TENANT*0.6  # i free mandano meno
    mailjet=0 if email<=6000 else (17 if email<=15000 else 35)
    vercel=20*USD*IVA
    supabase=25*USD*IVA
    dominio=15/12
    commercialista=450/12
    pec_camera=(25+53)/12
    return {"vercel":vercel,"supabase":supabase,"mailjet":mailjet,"dominio":dominio,"commercialista":commercialista,"pec+camera":pec_camera}

SCENARI={
 "peggiore":{"starter":3,"growth":2,"pro":0,"free":30},
 "medio":{"starter":8,"growth":12,"pro":5,"free":100},
 "migliore":{"starter":20,"growth":40,"pro":20,"free":300},
}

def inps_commercianti(imponibile, riduzione):
    fisso=4611.64; minimale=18808
    base=fisso*(1-riduzione)
    if imponibile>minimale: base+= (imponibile-minimale)*0.2448*(1-riduzione)
    return base

def tasse(ricavi_anno, inps_mode, riduzione=0.0):
    imponibile=ricavi_anno*0.67
    if inps_mode=="separata":
        inps=imponibile*0.2607
    else:
        inps=inps_commercianti(imponibile, riduzione)
    # anno 1: nessun contributo dell'anno prima da dedurre; a regime si deduce l'INPS pagata
    imposta_anno1=imponibile*0.05
    imposta_regime=max(0,imponibile-inps)*0.05
    return imponibile,inps,imposta_anno1,imposta_regime

print("\n=== SCENARI A 12 MESI DI REGIME (euro/anno) ===")
for nome,sc in SCENARI.items():
    n_pag=sc["starter"]+sc["growth"]+sc["pro"]
    ricavi=sum(sc[p]*ricavo(p) for p in PREZZI)*12
    var=sum(sc[p]*var_medio(p) for p in PREZZI)*12
    var_p=sum(sc[p]*var_pieno(p) for p in PREZZI)*12
    f=fissi(n_pag,sc["free"]); fiss=sum(f.values())*12
    free_cost=sc["free"]*0.10*12
    lordo=ricavi-var-fiss-free_cost
    print(f"\n[{nome}] paganti {n_pag} (S{sc['starter']} G{sc['growth']} P{sc['pro']}), free {sc['free']}")
    print(f"  ricavi {ricavi:8.0f}  variabili {var:6.0f} (quota piena {var_p:6.0f})  fissi {fiss:6.0f}  free {free_cost:4.0f}")
    print(f"  fissi dettaglio: "+", ".join(f"{k} {v+12:.0f}" for k,v in f.items()))
    print(f"  margine lordo prima di tasse {lordo:8.0f}  ({lordo/ricavi*100:.0f}% dei ricavi)")
    for mode,rid,label in [("separata",0,"gestione separata 26,07%"),("comm",0.35,"commercianti -35%"),("comm",0.50,"commercianti -50% (nuovi, se confermato 2026)"),("comm",0,"commercianti piena")]:
        imp,inps,i1,ir=tasse(ricavi,mode,rid)
        netto1=lordo-inps-i1
        nettor=lordo-inps-ir
        print(f"    {label:48s} INPS {inps:6.0f}  imposta 5% {i1:5.0f} (a regime {ir:5.0f})  NETTO anno1 {netto1:7.0f}  a regime {nettor:7.0f}  ({nettor/12:.0f}/mese)")
    # 15% dopo 5 anni
    imp,inps,_,_=tasse(ricavi,"comm",0.35)
    print(f"    con imposta 15% (dal 6o anno, commercianti -35%): netto {lordo-inps-max(0,imp-inps)*0.15:7.0f}")

print("\n=== PAREGGIO ===")
f=sum(fissi(10,50).values())*12
for mode,rid,label in [("separata",0,"separata"),("comm",0.35,"comm -35%"),("comm",0.5,"comm -50%")]:
    # trova ricavi tali che netto=0 con mix medio
    mix={"starter":8,"growth":12,"pro":5}; tot=25
    r_t=sum(mix[p]*ricavo(p) for p in mix)/tot; v_t=sum(mix[p]*var_medio(p) for p in mix)/tot
    for n in range(1,80):
        ric=n*r_t*12; var=n*v_t*12
        lordo=ric-var-f
        imp,inps,i1,ir=tasse(ric,mode,rid)
        if lordo-inps-i1>0:
            print(f"  {label:10s}: netto positivo da {n} paganti (ricavi {ric:.0f}/anno)"); break

print("\n=== SOGLIE CHE CONTANO ===")
# familiare a carico: reddito imponibile (67% ricavi - inps?) > 4000 under 24
for r in [3000,6000,9000,12000]:
    print(f"  ricavi {r}: reddito forfettario {r*0.67:.0f}")
