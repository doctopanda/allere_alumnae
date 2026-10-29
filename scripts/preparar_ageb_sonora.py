#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AGEB urbanas y rurales Sonora. Descarga oficial INEGI por municipio, geometría SIN salud.
No elude bloqueos de servicio; ante 403/429 falla y solicita reintentar más tarde.

Ejemplo: python scripts/preparar_ageb_sonora.py --municipio 030
Deps: pip install shapely==2.0.7
"""
import argparse, json, re, urllib.request, urllib.error, datetime
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.validation import explain_validity

ROOT=Path(__file__).resolve().parents[1]
SERVICE="https://gaia.inegi.org.mx/wscatgeo/v2/geo/"
def obj(v):
    if isinstance(v,str):
        try:return json.loads(v)
        except Exception:return None
    return v

def feature_items(raw):
    data=obj(raw)
    if isinstance(data,dict) and data.get("type")=="FeatureCollection":
        return data.get("features",[])
    if isinstance(data,dict) and data.get("type")=="Feature":
        return [data]
    if isinstance(data,dict):
        entries=obj(data.get("datos",data.get("data",data.get("resultados"))))
    elif isinstance(data,list):
        entries=data
    else:
        entries=[]
    if not isinstance(entries,list):
        raise ValueError("Respuesta INEGI no contiene registros GeoJSON legibles")
    result=[]
    for entry in entries:
        if not isinstance(entry,dict):
            continue
        geo=obj(entry.get("geojson") or entry.get("geometry") or entry)
        if not isinstance(geo,dict):
            continue
        if geo.get("type")=="FeatureCollection":
            result.extend(geo.get("features",[]))
        elif geo.get("type")=="Feature":
            result.append(geo)
        elif geo.get("type") in {"Polygon","MultiPolygon"}:
            result.append({"type":"Feature","properties":entry.get("properties") or entry,"geometry":geo})
        elif isinstance(entry.get("geometry"),dict) and entry["geometry"].get("type") in {"Polygon","MultiPolygon"}:
            result.append({"type":"Feature","properties":entry.get("properties") or entry,"geometry":entry["geometry"]})
    return result

def cvegeo(f):
    p=f.get("properties") or {}
    for key in ("cvegeo","CVEGEO","Cvegeo","CVE_GEO","cve_geo"):
        if p.get(key):
            return str(p[key]).strip()
    return ""

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--municipio",required=True,help="Clave municipal INEGI de 3 dígitos: 030 para Hermosillo")
    args=ap.parse_args()
    code=args.municipio.strip()
    if not re.fullmatch(r"\d{3}",code) or not (1<=int(code)<=999):
        ap.error("Municipio debe ser clave AGEM de tres dígitos")
    prefix="26"+code
    filtered=[]
    type_status={}
    for tipo,endpoint in [("urbana","agebu"),("rural","agebr")]:
        uri=f"{SERVICE}{endpoint}/26/{code}"
        print("Consultando geometrías públicas oficiales:",uri)
        try:
            req=urllib.request.Request(uri,headers={"User-Agent":"Mozilla/5.0 (compatible; ALLERE-ALUMNAE/1.0)","Accept":"application/json, application/geo+json"})
            with urllib.request.urlopen(req,timeout=80) as stream:
                if stream.status!=200:raise RuntimeError(f"HTTP {stream.status}")
                payload=stream.read(28_000_000)
            raw=json.loads(payload.decode("utf-8-sig"))
            items=feature_items(raw)
        except urllib.error.HTTPError as e:
            print(f"INEGI {tipo}: HTTP {e.code}. No se insistirá en caso de límite o prohibición.")
            type_status[tipo]="ERROR_"+str(e.code)
            continue
        except Exception as e:
            print(f"INEGI {tipo}: {type(e).__name__}: {e}")
            type_status[tipo]="ERROR"
            continue
        count=0
        for f in items:
            c=cvegeo(f)
            expected=(prefix+r"\d{4}[0-9A-Z]{4}" if tipo=="urbana" else prefix+r"[0-9A-Z]{4}")
            if not re.fullmatch(expected,c):
                continue
            try:geom=shape(f.get("geometry"))
            except Exception:continue
            if geom.is_empty or geom.geom_type not in ("Polygon","MultiPolygon"):
                continue
            geom=geom.simplify(.0003,preserve_topology=True)
            b=geom.bounds
            if not (-117<b[0]<-106 and 25<b[1]<35 and -117<b[2]<-106 and 25<b[3]<35):
                raise SystemExit(f"Geometría fuera de Sonora: {c} {b}")
            filtered.append({"type":"Feature","properties":{"cvegeo":c,"cve_mun":code,"tipo_ageb":tipo},"geometry":mapping(geom)})
            count+=1
        type_status[tipo]=count
        print(f"{tipo}: {count} polígonos aceptados")
    if not filtered:
        raise SystemExit(f"INEGI no produjo AGEB para municipio {code}. No se publicará archivo vacío.")
    if len({f["properties"]["cvegeo"] for f in filtered})!=len(filtered):
        raise SystemExit("CVEGEO duplicado: detener publicación.")
    out={"type":"FeatureCollection","features":filtered}
    dest=ROOT/"data"/"ageb"/f"26{code}.geojson"
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(out,separators=(",",":"),ensure_ascii=False),encoding="utf-8")
    print(f"OK: {len(filtered)} AGEB urbanas/rurales. {dest} ({dest.stat().st_size} bytes)")
    print("Cobertura de servicios:",type_status)
    print("No se han publicado datos de salud. Verificar y subir sólo este GeoJSON público.")

if __name__=="__main__":
    main()
