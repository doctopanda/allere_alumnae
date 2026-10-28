#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Actualizar SOLO metadatos de cobertura en el mapa público.
Sin alumnos, CURP, nombres de pacientes, domicilios ni contraseñas.
Ejecutar con Python 3.10+ desde la raíz de un clon del repositorio.

python scripts/actualizar_estado_local.py
python scripts/actualizar_estado_local.py --csv "C:\ruta\ESTADO_CCT_ACTUAL.csv" --dry-run
"""
import argparse, csv, json, os, re, sys, shutil
from collections import Counter
from pathlib import Path
from datetime import datetime, timezone

REPO = Path(__file__).resolve().parents[1]
MAP = REPO / "data" / "escuelas.json"
DEFAULT_CSV = Path.home() / "IMSS_TABLEAU_RESCATE_SONORA" / "AUDITORIA_LOCAL" / "ESTADO_CCT_ACTUAL.csv"
VALID = {"COMPLETADA","PENDIENTE","FALLIDA","SIN_ESTADO_LOCAL"}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv",type=Path,default=DEFAULT_CSV)
    parser.add_argument("--dry-run",action="store_true",help="Validar sin escribir")
    args=parser.parse_args()
    if not args.csv.is_file():
        parser.error(f"No existe el CSV local: {args.csv}")
    try:
        dataset=json.loads(MAP.read_text(encoding="utf-8"))
    except Exception as e:
        parser.error(f"Falta o no se puede leer {MAP}: {e}")
    rows=dataset.get("records",[])
    if len(rows)!=1501 or any(len(row)!=7 for row in rows):
        parser.error("El JSON del mapa no tiene las 1501 CCT o cambió su estructura: no modificar.")

    state={}
    with args.csv.open("r",encoding="utf-8-sig",newline="") as fh:
        reader=csv.DictReader(fh)
        if not {"cct","estado"}.issubset(reader.fieldnames or []):
            parser.error("El CSV debe incluir columnas 'cct' y 'estado'.")
        for row in reader:
            cct=row["cct"].strip().upper()
            status=row["estado"].strip().upper()
            if not re.fullmatch(r"26[A-Z0-9]{8}",cct):
                continue
            if status not in VALID:
                parser.error(f"Estado inesperado para {cct}: {status!r}")
            if cct in state and state[cct]!=status:
                parser.error(f"Estados contradictorios para {cct}: {state[cct]} vs {status}")
            state[cct]=status
    previous=Counter(row[6] for row in rows)
    changed=0
    for row in rows:
        if row[0] in state and state[row[0]]!=row[6]:
            row[6]=state[row[0]]
            changed+=1
    current=Counter(row[6] for row in rows)
    if sum(current.values())!=1501:
        parser.error("Inconsistencia de totales. No se ha escrito nada.")
    print("ALLERE ALUMNAE | actualización de estado técnico (sin datos clínicos)")
    print("CSV local:",args.csv)
    print("CCT en mapa:",len(rows),"| estados nuevos en CSV:",len(state))
    print("CCT con cambio:",changed)
    print("ANTES:",dict(previous))
    print("AHORA:",dict(current))
    if args.dry_run:
        print("Simulación: sin cambios en archivos.")
        return
    if changed==0:
        print("No hay cambios. JSON intacto.")
        return
    backup=MAP.with_suffix(".json.bak")
    shutil.copy2(MAP,backup)
    tmp=MAP.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(dataset,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    tmp.replace(MAP)
    metadata={
        "tipo":"estado_técnico_de_consulta",
        "fecha_utc":datetime.now(timezone.utc).isoformat(),
        "archivo_fuente":"ESTADO_CCT_ACTUAL.csv",
        "cct_mapa":1501,
        "cct_actualizadas":changed,
        "completadas":current.get("COMPLETADA",0),
        "fallidas":current.get("FALLIDA",0),
        "pendientes":current.get("PENDIENTE",0),
        "sin_estado_local":current.get("SIN_ESTADO_LOCAL",0),
        "NOTA":"Completada significa consulta en el checkpoint, no validación epidemiológica ni datos de menores."
    }
    (REPO/"data"/"estado_corte.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding="utf-8")
    print("OK: actualizados data/escuelas.json y data/estado_corte.json")
    print("Copia previa:",backup,"(NO subir *.bak a GitHub)")
    print("Revisar git diff; publicar SOLO JSON de estado, nunca la carpeta de resultados IMSS.")

if __name__=="__main__":
    main()
