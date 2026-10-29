#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generar límites municipales de Sonora para ALLERE ALUMNAE.
Fuente externa: INEGI-geojson (compilación comunitaria 2025, AGEM_26).
Son sólo geometrías públicas, sin datos escolares ni información personal.
"""
import json, urllib.request, hashlib, sys, datetime
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.validation import explain_validity

URL = "https://raw.githubusercontent.com/MacWilliXD/INEGI-geojson/main/geojson_descargas/AGEM_26.geojson"
OUT = Path(__file__).resolve().parents[1] / "data" / "municipios_sonora.geojson"
RELEASE_INFO = Path(__file__).resolve().parents[1] / "data" / "municipios_fuente.json"

# Claves municipales de Sonora según su catálogo 001-072.
NAMES = """Aconchi|Agua Prieta|Álamos|Altar|Arivechi|Arizpe|Átil|Bacadéhuachi|Bacanora|Bacerac|Bacoachi|Bácum|Banámichi|Baviácora|Bavispe|Benjamín Hill|Caborca|Cajeme|Cananea|Carbó|La Colorada|Cucurpe|Cumpas|Divisaderos|Empalme|Etchojoa|Fronteras|Granados|Guaymas|Hermosillo|Huachinera|Huásabas|Huatabampo|Huépac|Ímuris|Magdalena|Mazatán|Moctezuma|Naco|Nácori Chico|Nacozari de García|Navojoa|Nogales|Ónavas|Opodepe|Oquitoa|Pitiquito|Puerto Peñasco|Quiriego|Rayón|Rosario|Sahuaripa|San Felipe de Jesús|San Javier|San Luis Río Colorado|San Miguel de Horcasitas|San Pedro de la Cueva|Santa Ana|Santa Cruz|Sáric|Soyopa|Suaqui Grande|Tepache|Trincheras|Tubutama|Ures|Villa Hidalgo|Villa Pesqueira|Yécora|General Plutarco Elías Calles|Benito Juárez|San Ignacio Río Muerto""".split("|")
BY_CODE = {f"{i:03d}": n for i,n in enumerate(NAMES, 1)}

def name_for(f):
    p = f.get("properties") or {}
    for k in ("NOMGEO","NOM_MUN","NOM_MPIO","NOMBRE","nom_mun","nomgeo","nom_agem","NOM_MUNICIPIO","municipio","name","NAME","nombre"):
        if p.get(k):
            return str(p[k]).strip()
    for k in ("CVE_MUN","CVEGEO","CVE_MPIO","cve_mun","cve_agem","cvegeo","id"):
        val=str(p.get(k,"")).strip()
        if val[-3:] in BY_CODE:
            return BY_CODE[val[-3:]]
    return ""

def code_for(f):
    p = f.get("properties") or {}
    for k in ("CVE_MUN","CVEGEO","CVE_MPIO","cve_mun","id"):
        v=str(p.get(k,"")).strip()
        if v[-3:] in BY_CODE:
            return v[-3:]
    return ""

def main():
    req=urllib.request.Request(URL,headers={"User-Agent":"ALLERE-ALUMNAE/1.0 (public open data)"})
    with urllib.request.urlopen(req,timeout=100) as response:
        blob=response.read(45_000_000)
    obj=json.loads(blob)
    features=obj.get("features") or []
    if len(features)!=72:
        raise SystemExit(f"Se esperaban 72 municipios; fuente devolvió {len(features)}. No se publicarán geometrías.")
    names=set(); selected=[]
    for f in features:
        n=name_for(f)
        if not n:
            raise SystemExit(f"Municipio sin nombre ni código: keys={list((f.get('properties') or {}).keys())}")
        if n in names:
            raise SystemExit(f"Nombre duplicado: {n}")
        names.add(n)
        geom=shape(f["geometry"])
        if geom.is_empty or geom.geom_type not in ("Polygon","MultiPolygon"):
            raise SystemExit(f"Geometría incorrecta: {n}: {geom.geom_type}")
        # Para visor, simplificación topológica conservando estructura.
        geom=geom.simplify(0.0018,preserve_topology=True)
        minx,miny,maxx,maxy=geom.bounds
        if not (-117<minx<-106 and 25<miny<35 and -117<maxx<-106 and 25<maxy<35):
            raise SystemExit(f"Coordenadas fuera de Sonora: {n}: {geom.bounds}")
        selected.append({"type":"Feature","properties":{"nombre":n,"cve_mun":code_for(f)},"geometry":mapping(geom)})
    out={"type":"FeatureCollection","features":selected}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding="utf-8")
    RELEASE_INFO.write_text(json.dumps({"fuente":URL,"organizacion_fuente":"MacWilliXD/INEGI-geojson (compilación pública de geometrías INEGI)","fecha_generacion_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"municipios":len(selected),"sha256_fuente":hashlib.sha256(blob).hexdigest(),"simplificacion_grados":0.0018,"aviso":"Cartografía referencial; no debe emplearse para deslindes oficiales, geolocalización exacta o prevalencia estatal."},ensure_ascii=False,indent=2),encoding="utf-8")
    print("OK",len(selected),"polígonos;",OUT.stat().st_size,"bytes",OUT)

if __name__=="__main__":
    main()
