#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extrae población 0–4 de AGEB URBANAS de Sonora, CPV INEGI 2020.

Archivo esperado: ageb_mza_urbana_26_cpv2020_csv.zip (fuente oficial INEGI).
Uso: python scripts/inegi_ageb_2020.py --zip archivo.zip
Sin --zip, descarga la fuente oficial. P_0A4 no es columna directa: se deriva EXACTAMENTE de P_0A2+P_3YMAS-P_5YMAS. Publica sólo conteos censales AGEB
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
    import collections
    with zipfile.ZipFile(input_zip) as archive:
        corrupt=archive.testzip()
        if corrupt:raise ValueError('ZIP corrupto: '+corrupt)
        names=[n for n in archive.namelist() if n.endswith('conjunto_de_datos_ageb_urbana_26_cpv2020.csv')]
        if len(names)!=1:raise ValueError('No se encontró un CSV oficial Sonora, AGEB urbana')
        with archive.open(names[0]) as file:
            reader=csv.DictReader(io.TextIOWrapper(file,encoding='utf-8-sig',newline=''))
            required={'ENTIDAD','MUN','LOC','AGEB','MZA','P_0A2','P_3YMAS','P_5YMAS','POBTOT'}
            missing=required-set(reader.fieldnames or [])
            if missing:raise ValueError('Columnas censales faltantes: '+repr(sorted(missing)))
            records={};municipios={};counts=collections.Counter();state=None
            for r in reader:
                if str(r['ENTIDAD']).strip()!='26':continue
                mun=str(r['MUN']).strip().zfill(3);loc=str(r['LOC']).strip().zfill(4)
                ag=str(r['AGEB']).strip().upper();mza=str(r['MZA']).strip().zfill(3)
                if loc=='0000' and ag=='0000' and mza=='000':
                    x,y,z=(numeric(r[k]) for k in ('P_0A2','P_3YMAS','P_5YMAS'))
                    p=x+y-z if None not in (x,y,z) else None
                    if mun=='000':state=p
                    elif re.fullmatch(r'\d{3}',mun):
                        municipios['26'+mun]={'nombre':str(r['NOM_MUN']).strip(),'p_0a4':p,'pobtot':numeric(r['POBTOT'])}
                    continue
                if loc=='0000' or ag=='0000' or mza!='000':continue
                counts['ageb_total']+=1
                if not re.fullmatch(r'\d{3}',mun) or not re.fullmatch(r'\d{4}',loc) or not re.fullmatch(r'[A-Z0-9]{4}',ag):
                    counts['clave_no_valida']+=1;continue
                x,y,z,pop=(numeric(r[k]) for k in ('P_0A2','P_3YMAS','P_5YMAS','POBTOT'))
                if None in (x,y,z,pop):
                    counts['componentes_suprimidos']+=1;continue
                p=x+y-z
                if p<0 or p>pop:raise ValueError('Conteo inválido en CVEGEO '+mun+loc+ag)
                if p<11:
                    counts['grupo_pequeno']+=1;continue
                cve='26'+mun+loc+ag
                if cve in records:raise ValueError('CVEGEO duplicado '+cve)
                records[cve]={'p_0a4':p,'pobtot':pop,'pct_0_4':round(100*p/pop,2)}
    if state!=218345:raise ValueError('Falla control estatal Sonora 2020: '+str(state))
    if len(municipios)!=72:raise ValueError('Se esperaban 72 municipios: '+str(len(municipios)))
    if sum(x['p_0a4'] for x in municipios.values())!=state:raise ValueError('Suma municipal distinta al estado')
    if len(records)<1500:raise ValueError('Insuficientes AGEB con valores publicables: '+str(len(records)))
    total=sum(v['p_0a4'] for v in records.values())
    if not 150000<total<state:raise ValueError('Suma urbana fuera de rango: '+str(total))
    out={
      'fuente':'INEGI, Censo de Población y Vivienda 2020, AGEB y manzana urbana de Sonora',
      'url_fuente':URL,'anio':2020,
      'variable_derivada':'P_0A4=P_0A2+P_3YMAS-P_5YMAS, diferencia exacta de grupos etarios; no estimación',
      'unidad_geografica':'AGEB urbana de residencia, no ubicación de la escuela',
      'total_estatal_0_4':state,'municipios_0_4_censo':municipios,
      'agebs_en_archivo':counts['ageb_total'],'agebs_publicables':len(records),
      'agebs_omitidas_por_muestra_pequena':counts['grupo_pequeno'],
      'agebs_componentes_suprimidos':counts['componentes_suprimidos'],
      'total_0_4_agebs_publicables':total,
      'nota':'Sólo AGEB urbanas con n>=11 y valores calculables. Su suma no equivale al total estatal. No dividir entre ellas evaluaciones escolares de otra cohorte.',
      'registros':records
    }
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print('AGEB publicables:',len(records),'AGEB en archivo:',counts['ageb_total'])
    print('Residentes 0-4 en AGEB publicables:',total,'control estatal:',state,'archivo:',output)

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
