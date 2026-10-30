#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extrae población 0–4 de AGEB URBANAS de Sonora, CPV INEGI 2020.

Archivo esperado: ageb_mza_urbana_26_cpv2020_csv.zip (fuente oficial INEGI).
Uso: python scripts/inegi_ageb_2020.py --zip archivo.zip
Sin --zip, descarga la fuente oficial. Publica sólo conteos censales AGEB
sin cifras suprimidas ni detalles por manzana. Nunca proyecta 2026 por AGEB.
"""
import argparse, csv, io, json, re, urllib.request, urllib.error, zipfile, pathlib, time, socket

URL='https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/ageb_manzana/ageb_mza_urbana_26_cpv2020_csv.zip'
ROOT=pathlib.Path(__file__).resolve().parents[1]
DEFAULT=ROOT/'data'/'inegi_ageb_2020_0_4.json'

def numeric(v):
    v=str(v or '').strip().replace(',','')
    if not re.fullmatch(r'\d+',v):return None
    return int(v)

def run(input_zip,output):
    with zipfile.ZipFile(input_zip) as z:
        bad=z.testzip()
        if bad:raise ValueError('ZIP dañado; primera entrada corrupta: '+str(bad))
        names=[n for n in z.namelist() if n.endswith('conjunto_de_datos_ageb_urbana_26_cpv2020.csv')]
        if len(names)!=1:raise ValueError('El ZIP no contiene el archivo oficial de AGEB urbana 26 esperado: '+str(names))
        with z.open(names[0]) as raw:
            text=io.TextIOWrapper(raw,encoding='utf-8-sig',errors='replace',newline='')
            reader=csv.DictReader(text)
            head={n.upper() for n in (reader.fieldnames or [])}
            expected={'MUN','LOC','AGEB','MZA','P_0A4','POBTOT'}
            if not expected.issubset(head):raise ValueError('Columnas censales incompletas: '+str(head.intersection(expected)))
            lookup={k.upper():k for k in reader.fieldnames}
            def col(r,k):return r.get(lookup[k],'')
            entries={};suppressed=0
            for r in reader:
                mun=str(col(r,'MUN') or '').strip().zfill(3)
                loc=str(col(r,'LOC') or '').strip().zfill(4)
                ag=str(col(r,'AGEB') or '').strip().upper()
                mza=str(col(r,'MZA') or '').strip()
                ent=str(r.get(lookup.get('ENTIDAD','ENTIDAD'),r.get(lookup.get('ENT','ENT'), '26'))).strip()
                if ent not in ('26','026','Sonora','SONORA'):continue
                if mza not in ('0','000','0000'):continue
                if not re.fullmatch(r'\d{3}',mun) or not re.fullmatch(r'\d{4}',loc) or not re.fullmatch(r'[A-Z0-9]{4}',ag):continue
                if ag in ('0000','9999'):continue
                key='26'+mun+loc+ag
                p0=numeric(col(r,'P_0A4'));pop=numeric(col(r,'POBTOT'))
                if key in entries:raise ValueError('CVEGEO duplicada '+key)
                if pop is None or p0 is None or p0<11 or pop<11:
                    suppressed+=1;continue
                if p0>pop:raise ValueError('P_0A4 > POBTOT en '+key)
                entries[key]={'p_0a4':p0,'pobtot':pop,'pct_0_4':round(100*p0/pop,2)}
    if len(entries)<500:raise ValueError('Se obtuvieron sólo '+str(len(entries))+' AGEB utilizables. No sobreescribir la capa pública; revisar el archivo y sus claves.')
    total=sum(v['p_0a4'] for v in entries.values())
    if total<30000 or total>400000:raise ValueError('Suma de población AGEB no plausible: '+str(total))
    out={'origen':'INEGI CPV 2020, Principales resultados por AGEB y manzana urbana: Sonora',
         'fuente_url':URL,'anio':2020,'unidad':'residentes de 0 a 4 años censados','escala':'AGEB urbana (localización de vivienda, no escuela)','agebs_publicables':len(entries),'registros_suprimidos_o_no_interpretables':suppressed,
         'nota':'Cobertura de AGEB URBANAS del Censo 2020; no incluye población rural no tabulada a esa escala. Celdas inferiores a 11 o suprimidas no se publican. No extrapolar a 2026 ni dividir evaluaciones escolares entre esta cifra.',
         'registros':entries}
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    print('INEGI 2020 AGEB urbanas publicables:',len(entries),'Total 0–4 en esas AGEB:',total,'suprimidas:',suppressed,'archivo:',output)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--zip',type=pathlib.Path)
    p.add_argument('--output',type=pathlib.Path,default=DEFAULT)
    a=p.parse_args()
    if a.zip:
        if not a.zip.is_file():p.error('Archivo ZIP no encontrado: '+str(a.zip))
        run(a.zip,a.output)
    else:
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            target=pathlib.Path(d)/'INEGI_Sonora_AGEB_2020.zip'
            # El catálogo oficial publica un ZIP binario; no intentar abrirlo como HTML.
            # No insistir ante 403/429, y no usar espejos no verificados.
            sources=[URL, URL.replace('https://www.inegi.org.mx/','https://inegi.org.mx/')]
            ok=False
            for source in sources:
                for attempt in range(1,3):
                    try:
                        print('INEGI descarga oficial:',source,'intento',attempt,flush=True)
                        request=urllib.request.Request(source,headers={
                            'User-Agent':'Mozilla/5.0 (compatible; ALLERE-ALUMNAE/1.0; public-census-data)',
                            'Accept':'application/zip,application/octet-stream,*/*',
                            'Accept-Encoding':'identity'})
                        with urllib.request.urlopen(request,timeout=90) as response:
                            status=getattr(response,'status',200)
                            ctype=response.headers.get('Content-Type','')
                            print('HTTP:',status,'Content-Type:',ctype,flush=True)
                            limit=45_000_000
                            with target.open('wb') as out:
                                total=0
                                while True:
                                    block=response.read(1024*1024)
                                    if not block:break
                                    total+=len(block)
                                    if total>limit:raise ValueError('Archivo supera 45 MB; detener para revisar fuente')
                                    out.write(block)
                        print('Descargados',total,'bytes',flush=True)
                        if not zipfile.is_zipfile(target):
                            raise ValueError('La respuesta no es un ZIP válido (posible página HTML o descarga interrumpida)')
                        ok=True
                        break
                    except urllib.error.HTTPError as e:
                        print('HTTP de INEGI:',e.code,e.reason,flush=True)
                        if e.code in (401,403,404,429):
                            print('No se forzará descarga ante esta respuesta.',flush=True)
                            break
                        if attempt==2:break
                        time.sleep(4)
                    except (urllib.error.URLError,socket.timeout,TimeoutError,OSError,ValueError) as e:
                        print('Error de conexión o validación:',type(e).__name__,str(e)[:250],flush=True)
                        if attempt==2:break
                        time.sleep(4)
                if ok:break
            if not ok:
                raise SystemExit('No se pudo recuperar ZIP oficial INEGI desde GitHub Actions. '
                  'Descárgalo con un navegador y usa --zip RUTA, sin cambiar los valores.')
            run(target,a.output)
