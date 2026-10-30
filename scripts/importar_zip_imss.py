#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ALLERE: auditar ZIP IMSS para proponer agregados municipales. NO publica datos.
Uso: py scripts/importar_zip_imss.py --zip "RUTA_COMPLETA_DEL_ZIP"
Genera reportes locales en REPORTES_AUDITORIA_IMSS (excluido de Git).
"""
import argparse, csv, io, json, re, zipfile, collections, unicodedata
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"REPORTES_AUDITORIA_IMSS"
LABELS=("Peso Bajo","Normal","Sobrepeso","Obesidad")
PUBLIC={"Peso Bajo":"peso_bajo","Sobrepeso":"sobrepeso","Obesidad":"obesidad"}

def get(z,filename):
    found=[p for p in z.namelist() if p.replace(chr(92),"/").startswith("VALIDADOS/") and p.endswith("/"+filename)]
    if len(found)!=1: raise ValueError("Se esperaba 1 CSV VALIDADO "+filename+"; se encontraron "+str(len(found)))
    return list(csv.DictReader(io.StringIO(z.read(found[0]).decode("utf-8-sig"))))

def number(value):
    v=str(value or "").strip()
    if re.fullmatch(r"\\d{1,3}(,\\d{3})+",v):v=v.replace(",","")
    if not re.fullmatch(r"\\d+",v):raise ValueError("Conteo ambiguo/no entero: "+repr(v))
    return int(v)

def key(row):
    fields=[k for k in row if k.startswith("_filtro__C.C.T")]
    if len(fields)!=1:raise ValueError("No se identificó el filtro CCT")
    cct=row[fields[0]].strip().upper()
    if not re.fullmatch(r"26[A-Z0-9]{8}",cct):raise ValueError("CCT no válida: "+cct)
    if row.get("_estado","").upper()!="SONORA" or row.get("_validacion_filtros","").upper()!="CONFIRMADO":
        raise ValueError("Filtro territorial no confirmado para "+cct)
    return cct

def normalize(s):
    return "".join(c for c in unicodedata.normalize("NFD",s.upper()) if not unicodedata.combining(c))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip",type=Path,required=True)
    a=parser.parse_args()
    if not a.zip.is_file():parser.error("No se encontró el ZIP: "+str(a.zip))
    j=json.loads((ROOT/"data"/"escuelas.json").read_text(encoding="utf-8"))
    if len(j.get("records",[]))!=1501:parser.error("Catálogo CCT inesperado. No se modifica ningún archivo.")
    mun={row[0]:row[2] for row in j["records"] if row[2]}
    with zipfile.ZipFile(a.zip) as z:
        if any(".." in Path(x).parts for x in z.namelist()):parser.error("Ruta sospechosa en ZIP")
        imc=get(z,"DATA__Peso y talla (IMC) Escuela.csv")
        ev=get(z,"DATA__Total Menores Evaluados.csv")
    counts=collections.defaultdict(dict);dates=set()
    for row in imc:
        c=key(row);cat=row.get("Rango IMC-alias","").strip()
        if cat not in LABELS:raise ValueError("Categoría no esperada: "+cat)
        if cat in counts[c]:raise ValueError("Snapshot duplicado para "+c+" / "+cat)
        counts[c][cat]=number(row.get("AGR(M_Menores evaluados)-alias"))
        dates.add(row.get("_timestamp","")[:10])
    evaluated={}
    for row in ev:
        c=key(row);col=[x for x in row if x.startswith("AGR(M_Menores evaluados)")]
        if len(col)!=1 or c in evaluated:raise ValueError("Evaluados duplicados/ambiguos: "+c)
        evaluated[c]=number(row[col[0]])
    if set(counts)!=set(evaluated):raise ValueError("No coinciden CCT entre IMC y evaluados")
    if any(sum(v.values())>evaluated[c] for c,v in counts.items()):raise ValueError("Clasificados > evaluados: revisar datos")
    absent=sorted(c for c in counts if c not in mun)
    if absent:raise ValueError("Faltan CCT en catálogo público: "+str(absent[:12]))
    merged=collections.defaultdict(lambda:{"cct":0,"evaluados":0,"categorias":collections.Counter()})
    for c,v in counts.items():
        m=merged[normalize(mun[c])]
        m["cct"]+=1;m["evaluados"]+=evaluated[c];m["categorias"].update(v)
    totals=sum((collections.Counter(x) for x in counts.values()),collections.Counter())
    report={"archivo":a.zip.name,"fecha_auditoria_utc":datetime.now(timezone.utc).isoformat(),
        "fechas_captura":sorted(x for x in dates if x),"cct_validas":len(counts),
        "filas_imc":len(imc),"evaluados":sum(evaluated.values()),
        "clasificados_imc":sum(totals.values()),"categorias":dict(totals),
        "municipios_detectados":len(merged),
        "nota":"La extracción no confirma ciclo escolar por CCT, ni residencia de escolares. No publicar sin revisión."}
    public={"titulo":"IMC escolar del ZIP auditado (no prevalencia municipal)",
        "corte_respaldo":report["fechas_captura"],"cct_en_respaldo":len(counts),
        "municipios":[],"criterio":"Al menos 5 CCT, 50 clasificados y TODAS las categorías con >=11 para evitar inferencias por resta."}
    for name,m in sorted(merged.items()):
        nums={k:m["categorias"].get(k,0) for k in LABELS}
        d=sum(nums.values());ok=m["cct"]>=5 and d>=50 and all(v>=11 for v in nums.values())
        public["municipios"].append({"municipio":name.title(),"cct_respaldo":m["cct"],
            "clasificados_imc":d if ok else None,"apto_tasa_descriptiva":ok,
            "indicadores":{target:({"n":nums[label],"d":d,"pct":round(nums[label]*100/d,2)} if ok else None)
            for label,target in PUBLIC.items()},
            "observacion":"Muestra parcial, no prevalencia poblacional" if ok else "Dato no publicable por mínimo de muestra o celda pequeña"})
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/"AUDITORIA_ZIP_IMSS.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    (OUT/"CANDIDATO_AGREGADO_MUNICIPAL_REVISAR.json").write_text(json.dumps(public,ensure_ascii=False,indent=2),encoding="utf-8")
    print("AUDITORÍA TERMINADA: "+str(len(counts))+" CCT; "+str(report["evaluados"])+" evaluados; "+str(report["clasificados_imc"])+" clasificados IMC")
    print("Municipios con indicador publicable:",sum(m["apto_tasa_descriptiva"] for m in public["municipios"]))
    print("Archivos LOCALES, NO publicados:",OUT)
    print("Comparte AUDITORIA_ZIP_IMSS.json y el ZIP para validar antes de actualizar el mapa.")

if __name__=="__main__": main()
