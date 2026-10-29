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
        if(selected){el('municipio').value=selected.value;applyFilters(true);loadAgebs();}
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
  const inegi='https://gaia.inegi.org.mx/wscatgeo/v2/geo/agebu/26/'+code;
  let featureCollection=null,which='';
  for(const url of [local,inegi]){
    try{
      const resp=await fetch(url,{cache:'force-cache'});
      if(!resp.ok)continue;
      const candidate=readAgebs(await resp.json());
      if(!candidate||candidate.features.length===0)continue;
      featureCollection=candidate;which=url===local?'copia local':'servicio INEGI';break;
    }catch(e){console.warn('AGEB no disponible:',url,String(e));}
  }
  if(requestId!==agebLoadToken)return;
  if(!featureCollection){
    status.textContent='AGEB no disponibles en esta sesión. Si INEGI bloquea la consulta, hay que generar los GeoJSON locales. Los polígonos municipales siguen visibles.';
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
    style:{color:'#375a63',weight:1,fillColor:'#b3d8db',fillOpacity:.13},
    onEachFeature:(f,l)=>{
      const inside=municipalSchools.filter(s=>geomContains([s.lon,s.lat],f.geometry));
      if(inside.length){located+=inside.length;nAgebsWithSchools++;}
      const cv=agebCode(f);
      const label='<b>AGEB '+escapeHtml(cv)+'</b><br>'+fmt(inside.length)+' planteles SEP ubicados en el polígono'+
        '<br><small>No hay indicadores clínicos válidos por AGEB. No representa domicilio ni estado nutricional de residentes.</small>';
      l.bindPopup(label);
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
  status.textContent=allFeatures.length+' AGEB urbanas · '+nAgebsWithSchools+' con planteles SEP · fuente: '+which+'. Sin tasas de IMC por AGEB.';
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
  filtered=records.filter(s=>(!municipio||s.municipio===municipio)&&(!estado||s.estado===estado)&&(!q||[s.cct,s.nombre,s.localidad,s.municipio].some(t=>(t||'').toLocaleLowerCase('es').includes(q))));
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
  const isMap=tab==='map';
  el('mapView').hidden=!isMap;el('healthView').hidden=isMap;
  el('tabMap').classList.toggle('active',isMap);
  el('tabHealth').classList.toggle('active',!isMap);
  el('tabMap').setAttribute('aria-pressed',String(isMap));
  el('tabHealth').setAttribute('aria-pressed',String(!isMap));
  if(isMap&&map){setTimeout(()=>map.invalidateSize(),40);}
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
async function main(){
  try{
    const [schoolsResponse,healthResponse,nutritionResponse]=await Promise.all([fetch('./data/escuelas.json'),fetch('./data/salud_agregada.json'),fetch('./data/nutricion_municipal_parcial.json')]);
    if(!schoolsResponse.ok||!healthResponse.ok||!nutritionResponse.ok)throw Error('Error al cargar datos');
    const [info,hs,nm]=await Promise.all([schoolsResponse.json(),healthResponse.json(),nutritionResponse.json()]);
    nutritionData=nm;
    nutritionIndex=new Map(nm.municipios.map(r=>[normalizeMunicipio(r.municipio),r]));
    health=hs;records=info.records.map(school);
    if(records.length!==1501)throw Error('Cantidad de CCT distinta a la esperada: '+records.length);
    filtered=records;
    updateKpis();fillMunicipalities();initMap();applyFilters(false);populateHealth();
    loadPolygons();
    syncMapMode();
    el('mapMode').addEventListener('change',syncMapMode);
    el('nutritionMetric').addEventListener('change',syncMapMode);
    el('showAgebs').addEventListener('change',loadAgebs);
    el('showPolygons').addEventListener('change',togglePolygons);
    el('polyMetric').addEventListener('change',refreshPolygonMetric);

    el('search').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>applyFilters(true),230)});
    el('municipio').addEventListener('change',()=>{applyFilters(true);loadAgebs();});
    el('estado').addEventListener('change',()=>applyFilters(true));
    el('reset').addEventListener('click',()=>{el('search').value='';el('municipio').value='';el('estado').value='';el('showAgebs').checked=false;applyFilters(true);clearAgebs();el('agebStatus').textContent='Selecciona un municipio para ver sus AGEB urbanas.';});
    el('download').addEventListener('click',exportList);
    el('tabMap').addEventListener('click',()=>switchTab('map'));
    el('tabHealth').addEventListener('click',()=>switchTab('health'));
  }catch(error){
    console.error(error);
    el('resultCount').textContent='No se pudieron cargar los datos';
    el('schoolList').innerHTML='<div class="list-empty">Error de lectura. Abre el sitio desde GitHub Pages o un servidor local, no desde archivo://.</div>';
  }
}
document.addEventListener('DOMContentLoaded',main);
