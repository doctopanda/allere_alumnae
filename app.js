'use strict';
const el=id=>document.getElementById(id);
const fmt=x=>new Intl.NumberFormat('es-MX').format(x);
const cssFor={COMPLETADA:'pin-completed',FALLIDA:'pin-failed',PENDIENTE:'pin-pending',SIN_ESTADO_LOCAL:'pin-historic'};
const statusText={COMPLETADA:'Completada en checkpoint',FALLIDA:'Fallida: requiere reintento',PENDIENTE:'Pendiente de consulta',SIN_ESTADO_LOCAL:'Sin estado local'};
let records=[],filtered=[],map,markers,health,markerByCct=new Map(),debounce;
let municipalLayer=null, agebLayer=null, nutritionData=null, nutritionIndex=new Map(), agebLoadToken=0;
const MUNICIPIO_CODE_NAMES=["Aconchi","Agua Prieta","Álamos","Altar","Arivechi","Arizpe","Átil","Bacadéhuachi","Bacanora","Bacerac","Bacoachi","Bácum","Banámichi","Baviácora","Bavispe","Benjamín Hill","Caborca","Cajeme","Cananea","Carbó","La Colorada","Cucurpe","Cumpas","Divisaderos","Empalme","Etchojoa","Fronteras","Granados","Guaymas","Hermosillo","Huachinera","Huásabas","Huatabampo","Huépac","Ímuris","Magdalena","Mazatán","Moctezuma","Naco","Nácori Chico","Nacozari de García","Navojoa","Nogales","Ónavas","Opodepe","Oquitoa","Pitiquito","Puerto Peñasco","Quiriego","Rayón","Rosario","Sahuaripa","San Felipe de Jesús","San Javier","San Luis Río Colorado","San Miguel de Horcasitas","San Pedro de la Cueva","Santa Ana","Santa Cruz","Sáric","Soyopa","Suaqui Grande","Tepache","Trincheras","Tubutama","Ures","Villa Hidalgo","Villa Pesqueira","Yécora","General Plutarco Elías Calles","Benito Juárez","San Ignacio Río Muerto"];
const MUNICIPAL_URLS=['./data/municipios_sonora.geojson','https://raw.githubusercontent.com/MacWilliXD/INEGI-geojson/main/geojson_descargas/AGEM_26.geojson'];

function escapeHtml(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeFile(x){return String(x??'').replace(/["\n\r]/g,'');}
function school(r){return {cct:r[0],nombre:r[1],municipio:r[2],localidad:r[3],lat:r[4],lon:r[5],estado:r[6]};}
function getStatus(s){return statusText[s]||'No informado';}
function statusClass(s){return cssFor[s]||cssFor.SIN_ESTADO_LOCAL;}

function normalizeMunicipio(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();}
function municipalityName(feature){
  const p=feature.properties||{};
  for(const k of ['nombre','NOMGEO','NOM_MUN','NOM_MPIO','NOM_MUNICIPIO','nomgeo','nom_mun','municipio','NOMBRE','name','NAME']){
    if(p[k]&&String(p[k]).trim())return String(p[k]).trim();
  }
  for(const k of ['CVE_MUN','CVEGEO','CVE_MPIO','cve_mun','id']){
    const code=String(p[k]||'').slice(-3);
    const i=Number(code);
    if(Number.isInteger(i)&&i>=1&&i<=72)return MUNICIPIO_CODE_NAMES[i-1];
  }
  return '';
}
function municipalityStats(){
  const stats=new Map();
  for(const s of records){
    const k=normalizeMunicipio(s.municipio);
    if(!stats.has(k))stats.set(k,{cct:0,done:0});
    const st=stats.get(k);st.cct++;
    if(s.estado==='COMPLETADA')st.done++;
  }
  return stats;
}
const nutritionRamp=['#fff4de','#f9ddb1','#f3b578','#dd8054','#b64432'];
const nutritionCuts={peso_bajo:[1,2,3,4],sobrepeso:[15,18,21,24],obesidad:[15,18,21,24]};
function nutritionSelected(){return el('nutritionMetric').value;}
function nutritionRow(name){return nutritionIndex.get(normalizeMunicipio(name))||null;}
function metricEntry(name){const r=nutritionRow(name);return r?.apto_tasa_descriptiva?r.indicadores?.[nutritionSelected()]||null:null;}
function nutritionName(){return {peso_bajo:'Peso bajo',sobrepeso:'Sobrepeso',obesidad:'Obesidad'}[nutritionSelected()];}
function nutritionSwatch(n,metric){
  if(n===null||!Number.isFinite(n))return '#c9d2cd';
  const cuts=nutritionCuts[metric]||nutritionCuts.obesidad;
  let level=0;while(level<cuts.length&&n>=cuts[level])level++;
  return nutritionRamp[level];
}
function polygonStyle(feature){
  const name=municipalityName(feature);
  let color='#d7ded9',fillOpacity=.68;
  if(el('mapMode').value==='nutricion'){
    const e=metricEntry(name);
    color=nutritionSwatch(e?.pct??null,nutritionSelected());
    fillOpacity=.72;
  }else{
    const stats=municipalityStats().get(normalizeMunicipio(name))||{cct:0,done:0};
    const metric=el('polyMetric').value;
    const score=metric==='avance'?(stats.cct?stats.done*100/stats.cct:-1):stats.cct;
    if(metric==='avance'){
      if(score>=95)color='#20735c';
      else if(score>=85)color='#56a88c';
      else if(score>=65)color='#a4c7a5';
      else if(score>=0)color='#dec28b';
    }else{
      if(score>=100)color='#175f4f';
      else if(score>=50)color='#348777';
      else if(score>=20)color='#65aa94';
      else if(score>=5)color='#a0cab3';
      else if(score>0)color='#cfdfd2';
    }
    fillOpacity=.37;
  }
  return {color:'#49685f',weight:.9,opacity:.85,fillColor:color,fillOpacity};
}
function municipalityPopupText(name){
  const n=municipalityStats().get(normalizeMunicipio(name))||{cct:0,done:0};
  const row=nutritionRow(name),e=metricEntry(name);
  const common='<br><small>Del filtro Tableau: '+fmt(n.cct)+' CCT; '+fmt(n.done)+' completadas.</small>';
  if(el('mapMode').value!=='nutricion')return '<b>'+escapeHtml(name)+'</b>'+common+'<br><small>Indicador de extracción, no prevalencia.</small>';
  if(!row||!e)return '<b>'+escapeHtml(name)+'</b><br><strong>Sin datos nutricionales suficientes para colorear</strong>'+common;
  return '<b>'+escapeHtml(name)+'</b><br><strong>'+escapeHtml(nutritionName())+': '+e.pct.toFixed(2)+'%</strong>'+
    '<br>'+fmt(e.n)+' casos / '+fmt(e.d)+' clasificaciones IMC'+
    '<br>'+fmt(row.cct_respaldo)+' escuelas en el respaldo 24/10/2026'+common+
    '<br><small>Corte parcial de muestra; NO es tasa poblacional ni dato por domicilio.</small>';
}
function showNutritionDetail(name){
  const detail=el('nutritionDetail');
  if(!name){detail.textContent='Selecciona un municipio para ver numerador, denominador y cobertura de la muestra.';return;}
  const row=nutritionRow(name),e=metricEntry(name);
  if(!e){detail.textContent=name+': sin información IMC pública completa de este corte. No equivale a cero casos.';return;}
  detail.innerHTML='<b>'+escapeHtml(name)+'</b><div><strong>'+e.pct.toFixed(2)+'%</strong> ('+escapeHtml(nutritionName())+')</div>'+
    '<p>'+fmt(e.n)+' / '+fmt(e.d)+' clasificaciones en '+fmt(row.cct_respaldo)+' escuelas del respaldo.</p>'+
    '<small>Muestra parcial, no prevalencia poblacional ni residencial.</small>';
}
function syncMapMode(){
  const nutrition=el('mapMode').value==='nutricion';
  el('nutritionControls').hidden=!nutrition;
  el('coverageControls').hidden=nutrition;
  refreshPolygonMetric();
  showNutritionDetail(el('municipio').value);
}

function setPolygonStatus(msg,status=''){
  const node=el('polygonStatus');node.textContent=msg;node.className='polygon-status '+status;
}
async function loadPolygons(){
  if(!map)return;
  let geojson=null,origin='';
  for(const url of MUNICIPAL_URLS){
    try{
      const response=await fetch(url,{cache:'no-cache'});
      if(!response.ok)continue;
      const j=await response.json();
      if(j.type!=='FeatureCollection'||!Array.isArray(j.features)||j.features.length!==72)throw Error('Se esperaban exactamente 72 polígonos municipales.');
      geojson=j;origin=url;break;
    }catch(e){console.warn('Fuente municipal no disponible:',url,String(e));}
  }
  if(!geojson){
    setPolygonStatus('No fue posible cargar los polígonos. El mapa escolar sigue operativo.','error');
    el('showPolygons').checked=false;
    return;
  }
  const counts=municipalityStats();
  let named=0;
  const layer=L.geoJSON(geojson,{
    style:polygonStyle,
    onEachFeature:(f,l)=>{
      const name=municipalityName(f);
      if(name)named++;
      const stat=counts.get(normalizeMunicipio(name))||{cct:0,done:0};
      const pct=stat.cct?(100*stat.done/stat.cct).toFixed(1)+'%':'Sin CCT observadas';
      l.bindTooltip(municipalityPopupText(name),{sticky:true});
      l.on('mouseover',()=>l.setStyle({weight:2.3,fillOpacity:.55}));
      l.on('mouseout',()=>l.setStyle(polygonStyle(f)));
      l.on('click',()=>{
        const selected=[...el('municipio').options].find(o=>normalizeMunicipio(o.value)===normalizeMunicipio(name));
        if(selected){el('municipio').value=selected.value;atlasGeoClick(name);loadAgebs();}
        else setPolygonStatus('Nombre de municipio por revisar: '+name,'error');
      });
    }
  });
  if(named!==72){
    setPolygonStatus('La fuente contiene 72 polígonos, pero sólo '+named+' tienen municipio identificable. Revisar correspondencias.','error');
    return;
  }
  municipalLayer=layer;
  const select=el('municipio'), values=new Set([...select.options].map(o=>normalizeMunicipio(o.value)));
  const append=[];
  layer.eachLayer(l=>{
    const n=municipalityName(l.feature);
    if(n&&!values.has(normalizeMunicipio(n))){
      const opt=document.createElement('option');opt.value=n;opt.textContent=n;append.push(opt);
      values.add(normalizeMunicipio(n));
    }
  });
  for(const opt of append)select.append(opt);
  const options=[...select.options].slice(1).sort((a,b)=>a.textContent.localeCompare(b.textContent,'es'));
  for(const opt of options)select.append(opt);
  if(el('showPolygons').checked)municipalLayer.addTo(map);
  el('municipalLegend').hidden=!el('showPolygons').checked;
  setPolygonStatus('72 municipios cargados · '+(origin.startsWith('./')?'capa local':'fuente externa')+' · clic para filtrar','ok');
  refreshPolygonMetric();
  map.attributionControl.addAttribution('<a href="https://github.com/MacWilliXD/INEGI-geojson" target="_blank" rel="noopener">Geometrías municipales (compilación INEGI-geojson)</a>');
}
function togglePolygons(){
  if(!map||!municipalLayer)return;
  const enabled=el('showPolygons').checked;
  if(enabled&&!map.hasLayer(municipalLayer))municipalLayer.addTo(map);
  if(!enabled&&map.hasLayer(municipalLayer))map.removeLayer(municipalLayer);
  el('municipalLegend').hidden=!enabled;
}
function refreshPolygonMetric(){
  if(municipalLayer)municipalLayer.eachLayer(l=>{
    l.setStyle(polygonStyle(l.feature));
    const name=municipalityName(l.feature);
    l.unbindTooltip();
    l.bindTooltip(municipalityPopupText(name),{sticky:true});
  });
  const nutrition=el('mapMode').value==='nutricion';
  el('legendTitle').textContent=nutrition?nutritionName()+' · corte parcial':'Cobertura de extracción';
  el('legendMetric').textContent=nutrition?'% de clasificados IMC · 7 municipios':'CCT observadas o consultas completadas';
  const b=el('legendBins');b.innerHTML='';
  if(nutrition){
    const cuts=nutritionCuts[nutritionSelected()];
    const labels=['< '+cuts[0]+'%',cuts[0]+'–<'+cuts[1]+'%',cuts[1]+'–<'+cuts[2]+'%',cuts[2]+'–<'+cuts[3]+'%','≥ '+cuts[3]+'%'];
    for(let i=0;i<5;i++)b.innerHTML+='<span><i style="background:'+nutritionRamp[i]+'"></i>'+labels[i]+'</span>';
    b.innerHTML+='<span><i style="background:#c9d2cd"></i>Sin datos</span>';
  }
}


// AGEB URBANAS: geometría y conteo de escuelas, NO tasas de salud.
// Punto escolar SEP => AGEB de ubicación del plantel; nunca inferir residencia de alumnos.
function codeMunicipio(name){
  if(!name)return null;
  if(municipalLayer){
    let fromGeometry=null;
    municipalLayer.eachLayer(layer=>{
      if(fromGeometry||normalizeMunicipio(municipalityName(layer.feature))!==normalizeMunicipio(name))return;
      const p=layer.feature.properties||{};
      const code=String(p.cve_mun||p.cve_agem||p.cvegeo||'').slice(-3);
      if(/^\d{3}$/.test(code))fromGeometry=code;
    });
    if(fromGeometry)return fromGeometry;
  }
  const id=MUNICIPIO_CODE_NAMES.findIndex(x=>normalizeMunicipio(x)===normalizeMunicipio(name));
  return id>=0?String(id+1).padStart(3,'0'):null;
}
function readAgebs(input){
  const obj=typeof input==='string'?JSON.parse(input):input;
  if(!obj)return null;
  if(obj.type==='FeatureCollection'&&Array.isArray(obj.features))return obj;
  if(obj.type==='Feature')return {type:'FeatureCollection',features:[obj]};
  let entries=obj.datos??obj.data??obj.features??obj.resultados??obj;
  if(typeof entries==='string'){try{entries=JSON.parse(entries)}catch(e){return null}}
  if(!Array.isArray(entries))return null;
  const features=[];
  for(const r of entries){
    let item=r?.geojson??r?.geometry??r;
    if(typeof item==='string'){try{item=JSON.parse(item)}catch(e){continue}}
    if(item?.type==='FeatureCollection'){features.push(...item.features);continue}
    if(item?.type==='Feature'){features.push(item);continue}
    if(item?.type==='Polygon'||item?.type==='MultiPolygon'){
      features.push({type:'Feature',properties:r.properties||r,geometry:item});
      continue;
    }
    if(r?.geometry&&r.geometry.type)features.push({type:'Feature',properties:r.properties||r,geometry:r.geometry});
  }
  return features.length?{type:'FeatureCollection',features}:null;
}
function ringContains(point,ring){
  const x=point[0],y=point[1];let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    const intersect=((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]);
    if(intersect)inside=!inside;
  }
  return inside;
}
function polygonContains(point,poly){
  if(!Array.isArray(poly)||!poly.length||!ringContains(point,poly[0]))return false;
  for(let i=1;i<poly.length;i++)if(ringContains(point,poly[i]))return false;
  return true;
}
function geomContains(point,geom){
  if(!geom)return false;
  if(geom.type==='Polygon')return polygonContains(point,geom.coordinates);
  if(geom.type==='MultiPolygon')return geom.coordinates.some(p=>polygonContains(point,p));
  return false;
}
function agebCode(feature){
  const p=feature.properties||{};
  for(const k of ['cvegeo','CVEGEO','Cvegeo','cve_geo','CVE_GEO','clave','CLAVE']){
    if(p[k])return String(p[k]).trim();
  }
  return '';
}
function clearAgebs(){
  agebLoadToken++;
  if(map&&agebLayer){map.removeLayer(agebLayer);agebLayer=null;}
}
async function loadAgebs(){
  clearAgebs();
  const status=el('agebStatus');
  const name=el('municipio').value;
  if(!el('showAgebs').checked){status.textContent='Capa AGEB desactivada.';return;}
  if(!name){status.textContent='Selecciona primero un municipio para cargar sólo sus AGEB urbanas.';return;}
  if(!map){status.textContent='Mapa no disponible.';return;}
  const code=codeMunicipio(name);
  if(!code){status.textContent='No se confirmó la clave INEGI de este municipio.';return;}
  const requestId=agebLoadToken;
  status.className='polygon-status';
  status.textContent='Consultando AGEB urbanas de '+name+' (INEGI 26'+code+')…';
  const local='./data/ageb/26'+code+'.geojson';
  let featureCollection=null,which='',partialSource=false;
  try{
    const localResp=await fetch(local,{cache:'force-cache'});
    if(localResp.ok){
      const candidate=readAgebs(await localResp.json());
      if(candidate?.features?.length){featureCollection=candidate;which='archivo local';}
    }
  }catch(e){console.warn('AGEB local no disponible:',String(e));}
  if(!featureCollection){
    const endpoints=[
      ['urbana','https://gaia.inegi.org.mx/wscatgeo/v2/geo/agebu/26/'+code],
      ['rural','https://gaia.inegi.org.mx/wscatgeo/v2/geo/agebr/26/'+code]
    ];
    const results=await Promise.all(endpoints.map(async([tipo,url])=>{
      try{
        const res=await fetch(url,{cache:'force-cache'});
        if(!res.ok)return {tipo,features:[],ok:false};
        const j=readAgebs(await res.json());
        return {tipo,features:(j?.features||[]).map(f=>({...f,properties:{...(f.properties||{}),tipo_ageb:tipo}})),ok:true};
      }catch(e){console.warn('AGEB '+tipo+' no disponible:',String(e));return {tipo,features:[],ok:false};}
    }));
    const features=results.flatMap(r=>r.features);
    if(features.length){featureCollection={type:'FeatureCollection',features};which='servicio INEGI';partialSource=results.some(r=>!r.ok);}
  }
  if(requestId!==agebLoadToken)return;
  if(!featureCollection){
    status.textContent='AGEB urbanas/rurales no disponibles en esta sesión. Se requiere descargar el GeoJSON oficial y guardarlo localmente. Los polígonos municipales siguen visibles.';
    status.className='polygon-status error';return;
  }
  const prefix='26'+code;
  // Evitar que una respuesta global termine mezclando otros municipios.
  let allFeatures=featureCollection.features.filter(f=>{
    const code=agebCode(f);
    return (code?code.startsWith(prefix):false) &&
      ['Polygon','MultiPolygon'].includes(f.geometry?.type);
  });
  if(!allFeatures.length){
    status.textContent='La respuesta AGEB no trajo códigos CVEGEO validados para '+name+'. No se mostrará una geometría ambigua.';
    status.className='polygon-status error';return;
  }
  const municipalSchools=records.filter(s=>normalizeMunicipio(s.municipio)===normalizeMunicipio(name)&&s.lat!=null&&s.lon!=null);
  let located=0;let nAgebsWithSchools=0;
  agebLayer=L.geoJSON({type:'FeatureCollection',features:allFeatures},{
    style:f=>({color:'#375a63',weight:1,fillColor:'#b3d8db',fillOpacity:.13,dashArray:(agebCode(f).length===9?'4,3':null)}),
    onEachFeature:(f,l)=>{
      const inside=municipalSchools.filter(s=>geomContains([s.lon,s.lat],f.geometry));
      if(inside.length){located+=inside.length;nAgebsWithSchools++;}
      const cv=agebCode(f);
      const kind=f.properties?.tipo_ageb|| (cv.length===9?'rural':'urbana');
      const label='<b>AGEB '+escapeHtml(kind)+' '+escapeHtml(cv)+'</b><br>'+fmt(inside.length)+' planteles SEP ubicados en el polígono'+
        '<br><small>No hay indicadores clínicos válidos por AGEB. No representa domicilio ni estado nutricional de residentes.</small>';
      l.bindPopup(label);
      l.on('click',()=>atlasSelectAgeb(cv,inside.length,inside.filter(s=>s.estado==='COMPLETADA').length));
      l.on('mouseover',()=>l.setStyle({weight:2.5,fillOpacity:.30}));
      l.on('mouseout',()=>l.setStyle({weight:1,fillOpacity:.13}));
    }
  });
  if(requestId!==agebLoadToken){agebLayer=null;return;}
  agebLayer.addTo(map);
  if(agebLayer.getLayers().length){
    const bounds=agebLayer.getBounds();
    if(bounds.isValid())map.fitBounds(bounds.pad(.08),{maxZoom:12});
  }
  status.textContent=allFeatures.length+' AGEB urbanas/rurales · '+nAgebsWithSchools+' con planteles SEP · fuente: '+which+(partialSource?' (fuente parcial)':'')+'. Sin tasas IMC válidas por AGEB.';
  status.className='polygon-status ok';
}

function popupText(s){
  return '<div class="popup"><h3>'+escapeHtml(s.nombre||'Escuela sin denominación')+'</h3>'+
    '<p><b>CCT:</b> '+escapeHtml(s.cct)+'</p><p><b>Municipio:</b> '+escapeHtml(s.municipio)+'</p>'+
    '<p><b>Localidad:</b> '+escapeHtml(s.localidad||'Sin dato')+'</p>'+
    '<p><b>Extracción:</b> '+escapeHtml(getStatus(s.estado))+'</p>'+
    '<small>Ubicación SEP aproximada. No representa evaluaciones individuales ni prevalencia.</small></div>';
}
function initMap(){
  if(typeof L==='undefined'){el('map').innerHTML='<div class="list-empty">No se pudo cargar el mapa. Verifica tu conexión a Internet. El listado escolar sigue disponible.</div>';return;}
  map=L.map('map',{zoomControl:false,preferCanvas:true}).setView([29.2,-110.9],7);
  L.control.zoom({position:'topright'}).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  const clusterFactory=(cluster)=>L.divIcon({html:'<div class="cluster-icon">'+fmt(cluster.getChildCount())+'</div>',className:'',iconSize:[39,39],iconAnchor:[19,19]});
  markers=typeof L.markerClusterGroup==='function'?
    L.markerClusterGroup({chunkedLoading:true,showCoverageOnHover:false,removeOutsideVisibleBounds:true,maxClusterRadius:58,iconCreateFunction:clusterFactory}):
    L.layerGroup();
  map.addLayer(markers);
}
function updateKpis(){
  const counts=Object.fromEntries(['COMPLETADA','PENDIENTE','FALLIDA','SIN_ESTADO_LOCAL'].map(k=>[k,records.filter(r=>r.estado===k).length]));
  el('kTotal').textContent=fmt(records.length);
  el('kComplete').textContent=fmt(counts.COMPLETADA);
  el('kFailed').textContent=fmt(counts.FALLIDA);
  el('kPending').textContent=fmt(counts.PENDIENTE+counts.SIN_ESTADO_LOCAL);
  el('kPercent').textContent=(counts.COMPLETADA*100/records.length).toFixed(1)+'%';
  el('barDone').style.width=(100*counts.COMPLETADA/records.length)+'%';
  el('barFailed').style.width=(100*counts.FALLIDA/records.length)+'%';
  el('barPending').style.width=(100*(counts.PENDIENTE+counts.SIN_ESTADO_LOCAL)/records.length)+'%';
}
function fillMunicipalities(){
  const options=[...new Set(records.map(x=>x.municipio).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  for(const m of options){const opt=document.createElement('option');opt.value=m;opt.textContent=m;el('municipio').appendChild(opt);}
}
function focusSchool(cct){
  let r=records.find(x=>x.cct===cct);
  if(!r)return;
  if(el('healthView').hidden===false) switchTab('map');
  if(r.lat!=null&&r.lon!=null&&map){
    const mark=markerByCct.get(cct);
    if(mark&&typeof markers.zoomToShowLayer==='function')markers.zoomToShowLayer(mark,()=>mark.openPopup());
    else{map.setView([r.lat,r.lon],14);if(mark)mark.openPopup();}
  }else{
    alert('La escuela está en el catálogo, pero aún no tenemos coordenadas SEP verificadas.');
  }
}
function displayList(){
  const box=el('schoolList');box.innerHTML='';
  const frag=document.createDocumentFragment();
  for(const s of filtered.slice(0,80)){
    const b=document.createElement('button');
    b.type='button';b.className='school-item';
    b.innerHTML='<i class="school-marker '+escapeHtml(s.estado)+'"></i><div><b>'+escapeHtml(s.nombre||'Nombre por comprobar')+'</b><small>'+escapeHtml(s.cct)+' · '+escapeHtml(s.municipio)+'</small></div>';
    b.addEventListener('click',()=>focusSchool(s.cct));frag.appendChild(b);
  }
  if(!filtered.length)box.innerHTML='<div class="list-empty">No hay escuelas para estos filtros.</div>';
  else box.appendChild(frag);
  const shown=filtered.length>80?' (primeras 80 en lista)':'';
  el('resultCount').textContent=fmt(filtered.length)+' CCT'+shown;
}
function displayMap(autoFit){
  if(!map)return;
  markers.clearLayers();markerByCct.clear();
  const bounds=[];
  const group=[];
  for(const s of filtered){
    if(s.lat===null||s.lon===null)continue;
    const m=L.marker([s.lat,s.lon],{icon:L.divIcon({
      className:'',html:'<div class="school-pin '+statusClass(s.estado)+'"></div>',
      iconSize:[13,13],iconAnchor:[6,6]
    }),title:s.nombre+' · '+s.cct});
    m.bindPopup(popupText(s));group.push(m);markerByCct.set(s.cct,m);bounds.push([s.lat,s.lon]);
  }
  if(markers.addLayers)markers.addLayers(group);else group.forEach(m=>markers.addLayer(m));
  if(autoFit&&bounds.length){const b=L.latLngBounds(bounds);map.fitBounds(b.pad(.1),{maxZoom:13});}
}
function applyFilters(autoFit=false){
  const q=el('search').value.trim().toLocaleLowerCase('es');
  const municipio=el('municipio').value;
  const estado=el('estado').value;
  filtered=records.filter(s=>(!municipio||normalizeMunicipio(s.municipio)===normalizeMunicipio(municipio))&&(!el('distritoAtlas').value||atlasMun(s.municipio)?.[1]===el('distritoAtlas').value)&&(!estado||s.estado===estado)&&(!q||[s.cct,s.nombre,s.localidad,s.municipio].some(t=>(t||'').toLocaleLowerCase('es').includes(q))));
  displayList();displayMap(autoFit);
  showNutritionDetail(el('municipio').value);
}
function exportList(){
  const h=['CCT','Escuela SEP','Municipio','Localidad','Latitud','Longitud','Estado de extracción'];
  const rows=[h,...filtered.map(s=>[s.cct,s.nombre,s.municipio,s.localidad,s.lat??'',s.lon??'',getStatus(s.estado)])];
  const content='\ufeff'+rows.map(r=>r.map(v=>'"'+safeFile(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='ALERE_ALUMNAE_CCT_FILTRADAS.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function switchTab(tab){
  for(const key of ['map','health','who']){
    const visible=key===tab;
    el(key==='map'?'mapView':key==='health'?'healthView':'whoView').hidden=!visible;
    const button=el(key==='map'?'tabMap':key==='health'?'tabHealth':'tabWHO');
    button.classList.toggle('active',visible);
    button.setAttribute('aria-pressed',String(visible));
  }
  if(tab==='map'&&map)setTimeout(()=>map.invalidateSize(),50);
}
function populateHealth(){
  const h=health;
  el('hSchools').textContent=fmt(h.escuelas_con_datos);
  el('hEvaluated').textContent=fmt(h.evaluados_registrados);
  el('hClassified').textContent=fmt(h.clasificados_imc);
  const order=['Peso Bajo','Normal','Sobrepeso','Obesidad'];
  const colors=['#a3bd91','#4b9279','#d9ad5f','#c67c5f'];
  el('healthChart').innerHTML=order.map((name,i)=>'<div><span>'+name+'</span><strong>'+fmt(h.imc_estado_muestra[name]||0)+'</strong><small>Conteo de muestra parcial</small><div class="bar"><i style="width:'+(h.imc_estado_muestra[name]*100/h.clasificados_imc).toFixed(1)+'%;background:'+colors[i]+'"></i></div></div>').join('');
  const frag=document.createDocumentFragment();
  for(const m of h.municipios_publicables){
    const div=document.createElement('div');div.className='municipality-card';
    div.innerHTML='<h4>'+escapeHtml(m.municipio)+'</h4><small>'+fmt(m.escuelas)+' CCT · '+fmt(m.evaluados)+' evaluados en el respaldo</small>'+
      '<div class="mini-numbers">'+order.map(name=>'<div><b>'+(m[name]===null?'Suprimido':fmt(m[name]))+'</b><span>'+escapeHtml(name)+'</span></div>').join('')+'</div>';
    frag.appendChild(div);
  }
  el('municipalityHealth').appendChild(frag);
}

/* ALLERE ALUMNAE V3 · Atlas territorial con datos 1393 CCT (28 Oct 2026).
   72 municipios / 6 DS / CCT agrupados: no publica medidas clínicas de escuela.
   Los faltantes y las celdas suprimidas siempre se muestran como S/D. */
let atlasData=null,atlasMunicipios=new Map(),atlasDistritos=new Map(),atlasSelection=null;
const ATLAS_CATS=[['Peso Bajo',8],['Normal',9],['Sobrepeso',10],['Obesidad',11]];
const ATLAS_LABELS={ext:'% escuelas extraídas / Tableau',evalesc:'% escuelas evaluadas / Tableau',evalmen:'% menores evaluados / registrados',tabsep:'% escuelas Tableau / SEP',bajo:'Peso bajo',normal:'Peso normal',sobre:'Sobrepeso',obes:'Obesidad',under5:'Menores de 5 años · sin denominador poblacional'};
const ATLAS_SCALES={bajo:[1,2,3,5],normal:[35,45,55,65],sobre:[10,15,20,25],obes:[10,15,20,25],ext:[25,50,75,90],evalesc:[25,50,75,90],evalmen:[20,40,60,80],tabsep:[10,20,30,40]};
const ATLAS_PALETTES={bajo:['#edf6f0','#c9e5d6','#94cab2','#4b9c79','#176f51'],normal:['#eaf4e7','#cde7c4','#a1d294','#64ac70','#2f7744'],sobre:['#fff7e6','#f9e1b0','#f1c77f','#d9a048','#a86d26'],obes:['#fff1eb','#f6cdbb','#ed9f80','#d96c56','#a13b35']};
const ATLAS_NUTRI_CODES={bajo:8,normal:9,sobre:10,obes:11};
function atlasMun(name){return atlasMunicipios.get(normalizeMunicipio(name))||null;}
function atlasDistrict(code){return atlasDistritos.get(String(code||''))||null;}
function atlasRate(num,den){return den>0?num*100/den:null;}
function atlasMetric(r){
  if(!r)return null;
  const id=el('indicadorAtlas').value;
  if(id==='under5')return null;
  if(id==='ext'||id==='evalesc')return atlasRate(r[4],r[3]);
  if(id==='evalmen')return atlasRate(r[6],r[5]);
  if(id==='tabsep')return atlasRate(r[3],r[2]);
  const ix=ATLAS_NUTRI_CODES[id];
  if(ix!=null&&r[ix]!=null)return atlasRate(r[ix],r[7]);
  return null;
}
function atlasScaleColor(val){
  if(val==null||!Number.isFinite(val))return '#cdd6d0';
  const metric=el('indicadorAtlas').value,steps=ATLAS_SCALES[metric]||[25,50,75,90];
  const colors=ATLAS_PALETTES[metric]||(metric==='evalmen'||metric==='tabsep'?['#f0f4f7','#ccdee9','#9cbed0','#5b93ab','#28647d']:['#eaf3e9','#cbdfd1','#96c8aa','#5d9e7d','#20684e']);
  let ix=0;while(ix<4&&val>=steps[ix])ix++;
  return colors[ix];
}
function atlasPublicRow(name){
  if(el('nivelAtlas').value==='distrito'){
    const r=atlasMun(name);return atlasDistrict(r?.[1]);
  }
  return atlasMun(name);
}
polygonStyle=function(feature){
  const name=municipalityName(feature),rec=atlasPublicRow(name);
  const ageb=el('nivelAtlas').value==='ageb';
  const selected=atlasSelection&&(atlasSelection.type==='municipio'?normalizeMunicipio(atlasSelection.name)===normalizeMunicipio(name):atlasSelection.type==='distrito'?atlasMun(name)?.[1]===atlasSelection.code:false);
  const color=ageb?'#d9e4df':atlasScaleColor(atlasMetric(rec));
  return {color:selected?'#19493a':'#4f6d61',weight:selected?2.7:1,opacity:.85,fillColor:color,fillOpacity:ageb?.27:.70};
};
municipalityPopupText=function(name){
  const rec=atlasPublicRow(name),v=atlasMetric(rec);const l=ATLAS_LABELS[el('indicadorAtlas').value];
  return '<b>'+escapeHtml(el('nivelAtlas').value==='distrito'?('DS'+rec?.[0]+' · '+rec?.[1]):name)+'</b><br>'+
    escapeHtml(l)+': <b>'+(v==null?'Sin dato suficiente':v.toFixed(2)+'%')+'</b>'+
    '<br><small>Clic para abrir ficha territorial. No es prevalencia poblacional.</small>';
};
function atlasChangeLegend(){
  const metric=el('indicadorAtlas').value,l=ATLAS_LABELS[metric];
  el('legendTitle').textContent=l;
  el('legendMetric').textContent=metric==='under5'?'Sin denominador de población 0–4':'Escuelas con resultados confirmados; gris = sin dato';
  const b=el('legendBins');b.innerHTML='';
  if(metric==='under5'){b.innerHTML='<span><i style="background:#cdd6d0"></i>No calculable</span>';return;}
  const cuts=ATLAS_SCALES[metric],labels=['<'+cuts[0]+'%',cuts[0]+'–<'+cuts[1]+'%',cuts[1]+'–<'+cuts[2]+'%',cuts[2]+'–<'+cuts[3]+'%','≥'+cuts[3]+'%'];
  const pal=ATLAS_PALETTES[metric]||(metric==='evalmen'||metric==='tabsep'?['#f0f4f7','#ccdee9','#9cbed0','#5b93ab','#28647d']:['#eaf3e9','#cbdfd1','#96c8aa','#5d9e7d','#20684e']);
  pal.forEach((p,i)=>{b.innerHTML+='<span><i style="background:'+p+'"></i>'+labels[i]+'</span>'});
  b.innerHTML+='<span><i style="background:#cdd6d0"></i>S/D</span>';
}
refreshPolygonMetric=function(){
  if(municipalLayer)municipalLayer.eachLayer(l=>{l.setStyle(polygonStyle(l.feature));l.unbindTooltip();l.bindTooltip(municipalityPopupText(municipalityName(l.feature)),{sticky:true})});
  atlasChangeLegend();
};
showNutritionDetail=function(name){
  const r=atlasMun(name),metric=el('indicadorAtlas').value,v=atlasMetric(r);
  const node=el('nutritionDetail');
  if(!r){node.textContent='Elige un municipio para ver los conteos confirmados.';return}
  node.innerHTML='<b>'+escapeHtml(r[0])+'</b><p>'+escapeHtml(ATLAS_LABELS[metric])+': <strong>'+(v==null?'Sin dato publicable':v.toFixed(2)+'%')+'</strong></p>'+
  '<small>'+fmt(r[4])+' CCT extraídas de '+fmt(r[3])+' Tableau; '+fmt(r[6])+' menores evaluados entre '+fmt(r[5])+' registrados.</small>';
};
function atlasRowForSidebar(){
  if(atlasSelection?.type==='ageb')return null;
  if(atlasSelection?.type==='municipio')return atlasMun(atlasSelection.name);
  if(atlasSelection?.type==='distrito')return atlasDistrict(atlasSelection.code);
  const z=atlasData.totales;
  return ['Sonora','',z.cct_sep,z.cct_tableau,z.cct_extraidas,z.menores_registrados,z.menores_evaluados,z.imc_clasificados,z.categorias['Peso Bajo'],z.categorias.Normal,z.categorias.Sobrepeso,z.categorias.Obesidad,z.edad_5_9,z.edad_10_16,z.menores5_evaluados];
}
function atlasCard(label,val,detail=''){
  return '<div class="terr-card"><small>'+escapeHtml(label)+'</small><b>'+(val==null?'S/D':typeof val==='number'?fmt(val):escapeHtml(val))+'</b><small>'+escapeHtml(detail)+'</small></div>';
}
function atlasPercent(val){return val==null?'S/D':val.toFixed(1)+'%'}
function atlasSelectMunicipio(name){
 const r=atlasMun(name);if(!r)return;
 atlasSelection={type:'municipio',name:r[0]};el('distritoAtlas').value=r[1];const opts=[...el('municipio').options];const opt=opts.find(o=>normalizeMunicipio(o.value)===normalizeMunicipio(name));if(opt)el('municipio').value=opt.value;
 renderAtlasSidebar();applyFilters(true);refreshPolygonMetric();
}
function atlasSelectDistrict(code){
 const r=atlasDistrict(code);if(!r)return;
 atlasSelection={type:'distrito',code:r[0]};el('distritoAtlas').value=r[0];el('municipio').value='';
 renderAtlasSidebar();applyFilters(true);refreshPolygonMetric();
}
function atlasSelectAgeb(code,count,done){
  atlasSelection={type:'ageb',code,count,done};renderAtlasSidebar();
}
function atlasRenderMembers(){
 const box=el('terrMembers');box.innerHTML='';
 if(!atlasSelection){for(const r of atlasData.distritos){const b=document.createElement('button');b.className='territory-link';b.textContent='DS'+r[0]+' · '+r[1]+' · '+fmt(r[4])+' CCT';b.addEventListener('click',()=>atlasSelectDistrict(r[0]));box.append(b)}return;}
 if(atlasSelection.type==='distrito'){
  for(const r of atlasData.municipios.filter(m=>m[1]===atlasSelection.code)){
   const b=document.createElement('button');b.className='territory-link';b.textContent=r[0]+' · '+fmt(r[4])+' CCT extraídas';b.addEventListener('click',()=>atlasSelectMunicipio(r[0]));box.append(b)
  }
 }else if(atlasSelection.type==='municipio'){
  box.innerHTML='<p class="terr-help">Distrito de Salud '+escapeHtml(atlasMun(atlasSelection.name)?.[1])+'. Para conocer AGEB del plantel, activa la capa AGEB y consulta el polígono.</p>';
 }else{
  box.innerHTML='<p class="terr-help">AGEB = ubicación de planteles. No hay microdatos o tasas nutricionales divulgables por AGEB.</p>';
 }
}
function renderAtlasSidebar(){
 if(!atlasData)return;
 const r=atlasRowForSidebar(),a=atlasSelection;
 el('terrTitle').textContent=a?.type==='ageb'?'AGEB '+a.code:r?r[0]:'Sonora';
 el('terrSubtitle').textContent=a?.type==='ageb'?'Escuelas localizadas en el polígono, sin información clínica':a?.type==='municipio'?'DS'+r[1]+' · ficha municipal':a?.type==='distrito'?'Distrito de Salud '+r[0]:'Estado de Sonora · 1,393 CCT extraídas';
 if(a?.type==='ageb'){
  el('terrCoverage').innerHTML=atlasCard('CCT del filtro Tableau',a.count,'escuelas con ubicación SEP')+atlasCard('CCT extraídas',a.done,'con resultado IMSS confirmado')+atlasCard('Cobertura entre Tableau',a.count?atlasPercent(a.done/a.count*100):'S/D','no incluye escuelas SEP fuera del filtro');
  el('terrNutri').innerHTML='<p class="terr-help">No hay tasas IMC autorizadas por AGEB; este polígono muestra sólo cobertura escolar. No es residencia.</p>';
  el('terrAge').innerHTML='<p class="terr-help">No existe denominador 0–4 ni seguimiento clínico por AGEB.</p>';atlasRenderMembers();return;
 }
 const v=(ix)=>r?.[ix]??null;
 el('terrCoverage').innerHTML=atlasCard('CCT SEP',v(2),'padrón 2026')+atlasCard('CCT Tableau',v(3),'visibles en filtro')+atlasCard('CCT extraídas',v(4),'resultados confirmados')+
 atlasCard('% extracción',v(3)?atlasPercent(v(4)/v(3)*100):'S/D','de CCT Tableau')+atlasCard('Menores registrados',v(5),'en CCT extraídas')+
 atlasCard('Menores evaluados',v(6),'en CCT extraídas')+atlasCard('% evaluados',v(5)?atlasPercent(v(6)/v(5)*100):'S/D','de registrados')+atlasCard('IMC clasificados',v(7),'tablero Peso y Talla');
 const box=el('terrNutri');box.innerHTML='';
 for(const [label,ix] of ATLAS_CATS){const n=v(ix),p=n==null||!v(7)?null:n/v(7)*100;
  box.innerHTML+='<div class="terr-bar"><div class="between"><b>'+label+'</b><strong>'+atlasPercent(p)+'</strong></div><div class="terr-track"><i style="width:'+Math.min(100,p||0)+'%;background:'+(ATLAS_PALETTES[{ 'Peso Bajo':'bajo',Normal:'normal',Sobrepeso:'sobre',Obesidad:'obes'}[label]][3])+'"></i></div><small>'+(n==null?'Celda suprimida por confidencialidad':fmt(n)+' / '+fmt(v(7))+' clasificados')+'</small></div>';
 }
 el('terrAge').innerHTML='<div class="terr-age">5–9 años evaluados: <b>'+fmt(v(12))+'</b></div><div class="terr-age">10–16 años evaluados: <b>'+fmt(v(13))+'</b></div><div class="terr-age">Menores de cinco años (4 años observados): <b>'+fmt(v(14))+'</b></div><p class="terr-help">No contamos aún con la población 0–4 por municipio/AGEB o distrito para calcular cobertura poblacional.</p>';
 atlasRenderMembers();
}
function atlasGeoClick(name){
 const r=atlasMun(name);if(!r)return;
 if(el('nivelAtlas').value==='distrito')atlasSelectDistrict(r[1]);
 else atlasSelectMunicipio(r[0]);
}
function atlasSyncList(){
 const district=el('distritoAtlas').value;if(district&&el('nivelAtlas').value!=='distrito')el('municipio').value='';
}
function atlasPopulateHealth(){
 health={escuelas_con_datos:atlasData.totales.cct_extraidas,evaluados_registrados:atlasData.totales.menores_evaluados,clasificados_imc:atlasData.totales.imc_clasificados,imc_estado_muestra:atlasData.totales.categorias,
  municipios_publicables:atlasData.municipios.filter(r=>r[8]!=null).map(r=>({municipio:r[0],escuelas:r[4],evaluados:r[6],'Peso Bajo':r[8],Normal:r[9],Sobrepeso:r[10],Obesidad:r[11]}))};
 nutritionData={municipios:atlasData.municipios.map(r=>({municipio:r[0],cct_respaldo:r[4],clasificados_imc:r[7],apto_tasa_descriptiva:r[8]!=null,indicadores:Object.fromEntries([['peso_bajo',8],['normal',9],['sobrepeso',10],['obesidad',11]].map(([k,index])=>[k,r[index]==null?null:{n:r[index],d:r[7],pct:r[index]/r[7]*100}]))}))};
 nutritionIndex=new Map(nutritionData.municipios.map(r=>[normalizeMunicipio(r.municipio),r]));
}
function atlasReset(){
 atlasSelection=null;el('distritoAtlas').value='';el('nivelAtlas').value='municipio';el('indicadorAtlas').value='obes';refreshPolygonMetric();renderAtlasSidebar();
}

async function main(){
  try{
    const [schoolsResponse,healthResponse,nutritionResponse,atlasResponse]=await Promise.all([fetch('./data/escuelas.json'),fetch('./data/salud_agregada.json'),fetch('./data/nutricion_municipal_parcial.json'),fetch('./data/indicadores_20261028_v3.json')]);
    if(!schoolsResponse.ok||!healthResponse.ok||!nutritionResponse.ok||!atlasResponse.ok)throw Error('Error al cargar datos');
    const [info,hs,nm]=await Promise.all([schoolsResponse.json(),healthResponse.json(),nutritionResponse.json()]);
    atlasData=await atlasResponse.json();
    if(atlasData.municipios.length!==72||atlasData.distritos.length!==6||atlasData.totales.cct_extraidas!==1393)throw Error('Inconsistencia regional/IMSS corte 28-10-2026');
    atlasMunicipios=new Map(atlasData.municipios.map(r=>[normalizeMunicipio(r[0]),r]));
    atlasDistritos=new Map(atlasData.distritos.map(r=>[r[0],r]));
    atlasPopulateHealth();

    records=info.records.map(school);
    if(records.length!==1501)throw Error('Cantidad de CCT distinta a la esperada: '+records.length);
    filtered=records;
    updateKpis();fillMunicipalities();initMap();applyFilters(false);populateHealth();populateNutritionTable();
    atlasData.distritos.forEach(r=>el('distritoAtlas').add(new Option('DS'+r[0]+' · '+r[1],r[0])));
    atlasData.municipios.forEach(r=>{if(![...el('municipio').options].some(o=>normalizeMunicipio(o.value)===normalizeMunicipio(r[0])))el('municipio').add(new Option(r[0],r[0]));});
    renderAtlasSidebar();
    el('nivelAtlas').addEventListener('change',()=>{atlasSelection=null;refreshPolygonMetric();renderAtlasSidebar();if(el('nivelAtlas').value==='ageb'&&el('municipio').value){el('showAgebs').checked=true;loadAgebs();}});
    el('indicadorAtlas').addEventListener('change',()=>{refreshPolygonMetric();renderAtlasSidebar();});
    el('distritoAtlas').addEventListener('change',()=>{const c=el('distritoAtlas').value;if(c)atlasSelectDistrict(c);else{atlasSelection=null;renderAtlasSidebar();applyFilters(true);refreshPolygonMetric();}});

    loadPolygons();
    syncMapMode();
    el('mapMode').addEventListener('change',syncMapMode);
    el('nutritionMetric').addEventListener('change',syncMapMode);
    el('showAgebs').addEventListener('change',loadAgebs);
    el('showPolygons').addEventListener('change',togglePolygons);
    el('polyMetric').addEventListener('change',refreshPolygonMetric);

    el('search').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>applyFilters(true),230)});
    el('municipio').addEventListener('change',()=>{const v=el('municipio').value;if(v)atlasSelectMunicipio(v);else{atlasSelection=null;renderAtlasSidebar();applyFilters(true);refreshPolygonMetric()}loadAgebs();});
    el('estado').addEventListener('change',()=>applyFilters(true));
    el('reset').addEventListener('click',()=>{el('search').value='';el('municipio').value='';el('estado').value='';el('showAgebs').checked=false;atlasReset();applyFilters(true);clearAgebs();el('agebStatus').textContent='Selecciona un municipio para ver sus AGEB urbanas.';});
    el('download').addEventListener('click',exportList);
    el('downloadNutrition').addEventListener('click',exportNutritionPublic);
    el('tabMap').addEventListener('click',()=>switchTab('map'));
    el('tabHealth').addEventListener('click',()=>switchTab('health'));
    el('tabWHO').addEventListener('click',()=>switchTab('who'));
  }catch(error){
    console.error(error);
    el('resultCount').textContent='No se pudieron cargar los datos';
    el('schoolList').innerHTML='<div class="list-empty">Error de lectura. Abre el sitio desde GitHub Pages o un servidor local, no desde archivo://.</div>';
  }
}
document.addEventListener('DOMContentLoaded',main);
