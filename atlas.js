'use strict';
const $=id=>document.getElementById(id);
const NF=new Intl.NumberFormat('es-MX');
const fmt=n=>n==null?'S/D':NF.format(n);
const pct=n=>n==null?'S/D':Number(n).toFixed(1)+'%';
const sanitize=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
const colors={"Peso Bajo":['#eaf2ed','#c9dfd4','#93c2b0','#4b957d','#176b52'],Normal:['#e7f1e3','#c8dfb5','#96c889','#64a96a','#2a7543'],Sobrepeso:['#fff4df','#f7e1b0','#edc476','#d9a043','#b47422'],Obesidad:['#fcf1ec','#f4cbbb','#e79c83','#d56a54','#9f3e36']};
const ramps={under5:['#f1f5e4','#d9e7a2','#a5d17a','#64aa76','#297c6b'],under5_share:['#f1f5e4','#d9e7a2','#a5d17a','#64aa76','#297c6b'],cct_extraidas:['#eef5ee','#d6e8d8','#a6d0b7','#65af90','#216b53'],cct_evaluadas:['#eef5ee','#d6e8d8','#a6d0b7','#65af90','#216b53'],pct_menores_evaluados:['#e9f3f5','#c5e4ec','#90c3d0','#529db1','#24637a'],pct_tableau_en_sep:['#e9f3f5','#c5e4ec','#90c3d0','#529db1','#24637a']};
const thresholds={under5:[500,2000,6000,20000],under5_share:[5,6,7,8],"Peso Bajo":[1,2,3,5],Normal:[35,45,55,65],Sobrepeso:[10,15,20,25],Obesidad:[10,15,20,25],cct_extraidas:[25,50,75,90],cct_evaluadas:[25,50,75,90],pct_menores_evaluados:[20,40,60,80],pct_tableau_en_sep:[10,20,30,40]};
const healthCategories=['Peso Bajo','Normal','Sobrepeso','Obesidad'];
const metricNames={'Peso Bajo':'Peso bajo · categoría Tableau',Normal:'Peso normal · categoría Tableau',Sobrepeso:'Sobrepeso · categoría Tableau',Obesidad:'Obesidad · categoría Tableau',cct_extraidas:'Escuelas extraídas / disponibles en Tableau',cct_evaluadas:'Escuelas con evaluaciones / disponibles en Tableau',pct_menores_evaluados:'Menores evaluados / menores registrados',pct_tableau_en_sep:'Escuelas visibles en Tableau / padrón SEP',under5:'Población residente de 0–4 años · CONAPO',under5_share:'Población de 0–4 años como % de residentes · CONAPO'};
let conapo=null,agebCensus=null, data=null,geo=null,schoolData=null,tableauSchoolNames=new Map(),map=null,geoLayer=null,schoolLayer=null,agebLayer=null,agebItems=[],agebSelected=null,agebSerial=0;
let state={level:'municipio',metric:'Obesidad',district:'',municipality:'',tab:'map',showSchools:false,schoolFilter:'TODAS',schoolSearch:'',popYear:2026};
let byNormDistrict=new Map();
let boobokMarkerIcon=null,boobokEventLayer=null;
let schoolLayerCacheKey='',schoolCanvas=null,schoolSearchTimer=null;
const agebRequestCache=new Map();
function numberBox(title,val,detail=''){return '<div class="info-card"><small>'+sanitize(title)+'</small><b>'+fmt(val)+'</b><span>'+sanitize(detail)+'</span></div>';}
function percentBox(title,val,detail=''){return '<div class="info-card"><small>'+sanitize(title)+'</small><b>'+pct(val)+'</b><span>'+sanitize(detail)+'</span></div>';}
function getProjection(r,year=state.popYear){
 if(!conapo||!r)return null;
 const ym=String(year);let mrs=[];
 if(r.nombre==='Sonora')return conapo.estado[ym]||null;
 if(state.level==='ageb'&&agebSelected)return null;
 const key=norm(r.nombre);
 if(conapoIndex.has(key))return conapoIndex.get(key).serie[ym]||null;
 if(r.distrito){mrs=Object.values(conapo.municipios).filter(m=>initialMunicipal(m.municipio)?.distrito===r.distrito);}
 else return null;
 if(!mrs.length)return null;
 const res={};for(const k of ['mujeres_0_4','hombres_0_4','pob_0_4','mujeres_todos','hombres_todos','pob_total'])res[k]=mrs.reduce((s,m)=>s+(m.serie[ym]?.[k]||0),0);
 res.pct_0_4=res.pob_total?res.pob_0_4/res.pob_total*100:null;return res;
}
let conapoIndex=new Map();
function getProjectionForMunicipality(name,year=state.popYear){return conapoIndex.get(norm(name))?.serie?.[String(year)]||null;}
function yearProjectionForTerritory(r,year){
 if(!r)return null;
 if(r.nombre==='Sonora')return conapo?.estado?.[String(year)]||null;
 const m=conapoIndex.get(norm(r.nombre));if(m)return m.serie[String(year)]||null;
 if(r.distrito){const parts=Object.values(conapo?.municipios||{}).filter(x=>initialMunicipal(x.municipio)?.distrito===r.distrito);if(!parts.length)return null;
  let result={};for(const k of ['mujeres_0_4','hombres_0_4','pob_0_4','mujeres_todos','hombres_todos','pob_total'])result[k]=parts.reduce((a,b)=>a+(b.serie?.[String(year)]?.[k]||0),0);
  result.pct_0_4=result.pob_total?result.pob_0_4/result.pob_total*100:null;return result;}
 return null;
}
function initialDistrict(key){return data?.distritos?.[key]||null;}
function initialMunicipal(name){return data?.municipios?.[norm(name)]||null;}
function selectedRecord(){
 if(state.level==='ageb'&&agebSelected)return agebSelected;
 if(state.municipality)return initialMunicipal(state.municipality);
 if(state.district)return initialDistrict(state.district);
 const m=data.meta;return {nombre:'Sonora',distrito:'',cct_sep:m.cct_sep,cct_tableau:m.cct_tableau,cct_extraidas:m.cct_extraidas,cct_con_evaluados:m.cct_con_evaluados,cct_con_imc:m.cct_con_evaluados,menores_registrados:m.menores_registrados,menores_evaluados:m.menores_evaluados,imc_clasificados:m.imc_clasificados,pct_extraidas_en_tableau:m.cct_extraidas/m.cct_tableau*100,pct_evaluadas_en_tableau:m.cct_con_evaluados/m.cct_tableau*100,pct_menores_evaluados:m.menores_evaluados/m.menores_registrados*100,pct_tableau_en_sep:m.cct_tableau/m.cct_sep*100,nutricion_publicable:true,nutricion:Object.fromEntries(healthCategories.map(k=>[k,{n:m.categorias[k],pct:m.categorias[k]/m.imc_clasificados*100}])),menores_5_evaluados:m.menores_5_evaluados_observados,poblacion_0_4:null,rango_edad_5_9:m.evaluados_edad_5_9,rango_edad_10_16:m.evaluados_edad_10_16};
}
function metricValue(r){
 if(!r)return null;
 if(['under5','under5_share'].includes(state.metric)){if(state.level==='ageb')return null; const p=yearProjectionForTerritory(r,state.popYear);return state.metric==='under5'?p?.pob_0_4??null:p?.pct_0_4??null;}
 if(healthCategories.includes(state.metric))return r.nutricion_publicable?r.nutricion?.[state.metric]?.pct??null:null;
 if(state.metric==='cct_extraidas')return r.pct_extraidas_en_tableau??null;
 if(state.metric==='cct_evaluadas')return r.pct_evaluadas_en_tableau??null;
 return r[state.metric]??null;
}
function colorFor(val){
 if(val==null||!Number.isFinite(val))return '#cdd6d0';
 const th=thresholds[state.metric]||[25,50,75,90];
 let index=0;while(index<4&&val>=th[index])index++;
 return (colors[state.metric]||ramps[state.metric]||ramps.cct_extraidas)[index];
}
function nameForGeo(f){const p=f.properties||{};return p.nombre||p.nom_agem||p.NOMGEO||p.name||'';}
function recordForGeo(f){const name=nameForGeo(f),m=initialMunicipal(name);return state.level==='distrito'?initialDistrict(m?.distrito):m;}
function selectDistrict(id,fit=true){state.district=id||'';state.municipality='';agebSelected=null;syncFilters();applyMap();if(fit)fitSelection();renderSidebar();if(state.level==='ageb')reloadAgebs();}
function selectMunicipio(name,fit=true){const m=initialMunicipal(name);if(!m)return;state.municipality=m.nombre;state.district=m.distrito;agebSelected=null;syncFilters();applyMap();if(fit)fitSelection();renderSidebar();if(state.level==='ageb')reloadAgebs();}
function syncFilters(){$('distrito').value=state.district||'';const ms=[...$('municipio').options];$('municipio').value=ms.some(o=>o.value===state.municipality)?state.municipality:'';}
function styleGeo(f){let val=metricValue(recordForGeo(f));const name=nameForGeo(f);const sel=state.level==='distrito'?initialMunicipal(name)?.distrito===state.district&&!!state.district:!!state.municipality&&norm(name)===norm(state.municipality);return {color:sel?'#163d33':'#647d6c',weight:sel?2.8:.8,opacity:.95,fillColor:state.level==='ageb'?'#d1ddd5':colorFor(val),fillOpacity:sel?.60:.72};}
function popupSummary(f){const name=nameForGeo(f),rec=recordForGeo(f),v=metricValue(rec);return '<b>'+sanitize(state.level==='distrito'?(rec?.nombre||'Distrito'):name)+'</b><div>'+sanitize(metricNames[state.metric])+'<br><strong>'+(v==null?'Sin dato válido':(state.metric==='under5'?fmt(v):pct(v)))+'</strong></div><small>Clic para abrir el territorio en el panel lateral.</small>';}
function applyMap(){
 if(geoLayer){geoLayer.eachLayer(l=>{l.setStyle(styleGeo(l.feature));l.unbindTooltip();l.bindTooltip(popupSummary(l.feature),{sticky:true})});}
 refreshSchoolLayer();if(agebLayer)agebLayer.eachLayer(l=>l.setStyle(styleAgeB(l.feature)));drawLegend();renderTable();renderTitle();syncMetricPills();
}

/* BOOBOK: eventos públicos previamente validados. Nunca crear ubicaciones ficticias,
   ni sustituir con su pin los puntos escolares del padrón SEP. */
async function loadBoobokPublicEvents(){
 const toggle=$('boobokEventsToggle');
 if(!map||!window.L||!toggle||!boobokMarkerIcon)return;
 toggle.hidden=true;
 try{
  const resp=await fetch('./data/boobok_eventos_publicos.json',{cache:'no-cache'});
  if(!resp.ok)return;
  const document=await resp.json();
  if(!Array.isArray(document.eventos))return;
  const allowedTypes=new Set(['PUNTO_ATENCION','JORNADA','INTERVENCION']);
  const layer=L.layerGroup(),markers=[];
  for(const entry of document.eventos){
   if(entry?.publico_autorizado!==true||!allowedTypes.has(entry.tipo))continue;
   const lat=Number(entry.lat),lng=Number(entry.lng);
   if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<26||lat>33||lng< -116||lng> -108)continue;
   if(typeof entry.nombre!=='string'||!entry.nombre.trim()||entry.nombre.length>130)continue;
   if(typeof entry.descripcion!=='string'||entry.descripcion.length>500)continue;
   const types={PUNTO_ATENCION:'Punto de atención',JORNADA:'Jornada',INTERVENCION:'Intervención'};
   const popup='<div class="boobok-event-popup"><strong>BOOBOK · '+sanitize(types[entry.tipo])+
     '</strong><h3>'+sanitize(entry.nombre)+'</h3><p>'+sanitize(entry.descripcion)+
     '</p><small>Ubicación operativa pública y autorizada. No corresponde a la residencia de menores.</small></div>';
   const marker=L.marker([lat,lng],{icon:boobokMarkerIcon,title:'BOOBOK · '+entry.nombre});
   marker.bindPopup(popup).addTo(layer);
   markers.push(marker);
  }
  if(!markers.length)return;
  boobokEventLayer=layer;
  toggle.hidden=false;
  toggle.textContent='Mostrar '+markers.length+' intervención'+(markers.length===1?'':'es')+' BOOBOK';
  toggle.setAttribute('aria-pressed','false');
  toggle.addEventListener('click',()=>{
    if(!boobokEventLayer)return;
    const next=!map.hasLayer(boobokEventLayer);
    if(next)map.addLayer(boobokEventLayer);
    else map.removeLayer(boobokEventLayer);
    toggle.setAttribute('aria-pressed',String(next));
    toggle.textContent=(next?'Ocultar':'Mostrar')+' '+markers.length+
      ' intervención'+(markers.length===1?'':'es')+' BOOBOK';
  });
 }catch(err){
  console.info('BOOBOK: sin eventos públicos cargados o recurso no disponible.',err);
 }
}

function initMap(){
 if(!window.L){$('map').textContent='No se pudo cargar el mapa. Revisa la conexión de red.';return;}
 map=L.map('map',{preferCanvas:true,zoomControl:false}).setView([29.15,-110.7],7);
 boobokMarkerIcon=L.icon({
   iconUrl:'./assets/boobok/BOOBOK_pin_48x72.png',
   iconSize:[48,72],
   iconAnchor:[24,70],
   popupAnchor:[0,-65]
 });
 L.control.zoom({position:'topright'}).addTo(map);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
 geoLayer=L.geoJSON(geo,{style:styleGeo,onEachFeature:(f,l)=>{
  l.bindTooltip(popupSummary(f),{sticky:true});
  l.on('mouseover',()=>l.setStyle({weight:2.1,fillOpacity:.87}));
  l.on('mouseout',()=>l.setStyle(styleGeo(f)));
  l.on('click',()=>{
   const name=nameForGeo(f),rec=initialMunicipal(name);
   if(state.level==='distrito')selectDistrict(rec?.distrito,true);
   else selectMunicipio(name,true);
  });
 }}).addTo(map);
 map.fitBounds(geoLayer.getBounds().pad(.07));
 map.attributionControl.addAttribution('<a href="https://github.com/MacWilliXD/INEGI-geojson" target="_blank" rel="noopener">Cartografía municipal derivada INEGI-geojson</a>');
}
function fitSelection(){if(!map||!geoLayer)return;let bounds=null;geoLayer.eachLayer(l=>{const m=initialMunicipal(nameForGeo(l.feature));const ok=state.municipality?norm(m?.nombre)===norm(state.municipality):state.district?m?.distrito===state.district:false;if(ok){const b=l.getBounds();if(!bounds)bounds=b;else bounds.extend(b)}});if(bounds?.isValid())map.fitBounds(bounds.pad(.09),{maxZoom:12});else if(!state.district&&!state.municipality)map.fitBounds(geoLayer.getBounds().pad(.06));}
function drawLegend(){const name=state.level==='ageb'&&state.metric==='under5'?'Residentes 0–4 por AGEB · INEGI 2020':state.level==='ageb'&&state.metric==='under5_share'?'% residentes 0–4 por AGEB · INEGI 2020':metricNames[state.metric];$('legendTitle').textContent=name;
 $('legendNote').textContent=['under5','under5_share'].includes(state.metric)?(state.level==='ageb'?'INEGI 2020 · AGEB urbana':'CONAPO '+state.popYear+' · población residente'):'Proporción dentro del corte disponible';
 const target=$('legendBins');target.innerHTML='';const th=state.level==='ageb'&&state.metric==='under5'?[15,50,150,350]:thresholds[state.metric],ramp=colors[state.metric]||ramps[state.metric];const arr=['< '+th[0],th[0]+'–'+th[1],th[1]+'–'+th[2],th[2]+'–'+th[3],'≥ '+th[3]];
 ramp.forEach((c,i)=>{target.innerHTML+='<div><i style="background:'+c+'"></i><small>'+arr[i]+(state.metric==='under5'?' niños':'%')+'</small></div>'});target.innerHTML+='<div><i style="background:#cdd6d0"></i><small>S/D</small></div>';}
function renderTitle(){const title=state.level==='ageb'&&['under5','under5_share'].includes(state.metric)?'INEGI Censo 2020 · residentes de 0–4 años por AGEB urbana':metricNames[state.metric];$('mapTitle').textContent=title;
 $('mapSubtitle').textContent=state.level==='ageb'?'AGEB = ubicación de planteles SEP; INEGI 2020 muestra residentes de 0–4 donde el censo ofrece conteos publicables. CONAPO no da proyección por AGEB.':state.level==='distrito'?'Distribución por Distrito de Salud (2025), con polígonos municipales.':'Cobertura y estado nutricional del corte escolar, por municipio.';
 const caution=['under5','under5_share'].includes(state.metric)?'CONAPO '+state.popYear+': población residente proyectada de 0–4 años. NO dividir evaluados IMSS entre esta población: el operativo escolar abarca otra cohorte y otro universo.':healthCategories.includes(state.metric)?'El color indica porcentajes entre IMC clasificados en escuelas extraídas, no prevalencia poblacional. Los municipios con celdas pequeñas se muestran grises.':state.metric==='pct_menores_evaluados'?'Denominador: menores registrados en las CCT extraídas (no población infantil del municipio).':'«Extraída» significa consulta confirmada a Tableau. No implica encuesta individual completa en toda la escuela.';
 $('filterNotice').textContent=caution;
}
function layerPoints(){return schoolData.catalogo_escuelas_2026;}
function schoolAreaRows(){
 let points=layerPoints();
 if(state.municipality)points=points.filter(x=>x[1]===norm(state.municipality));
 else if(state.district)points=points.filter(x=>byNormDistrict.get(x[1])===state.district);
 if(state.level==='ageb'&&agebSelected){
  if(!agebSelected._geometry)return [];
  points=points.filter(x=>x[2]!=null&&x[3]!=null&&pInGeom([x[3],x[2]],agebSelected._geometry));
 }
 return points;
}
function schoolVisibleRows(){
 const pts=schoolAreaRows();
 const group=state.schoolFilter==='TODAS'?pts:pts.filter(x=>x[4]===state.schoolFilter);
 const q=state.schoolSearch.trim().toUpperCase();
 return q?group.filter(x=>String(x[0]||'').toUpperCase().includes(q)):group;
}
function refreshSchoolCounts(){
 if(!$('schoolCounts')||!schoolData)return;
 if(state.level==='ageb'&&agebSelected&&!agebSelected._geometry){$('schoolCounts').textContent='No es posible ubicar escuelas en esta AGEB sin su polígono verificado. No equivale a cero escuelas.';return;}
 const pts=schoolAreaRows(),cnt={EXTRAIDA:0,TABLEAU:0,SEP:0};
 for(const p of pts){if(Object.hasOwn(cnt,p[4]))cnt[p[4]]++;}
 const current=schoolVisibleRows();
 const located=current.filter(x=>x[2]!=null&&x[3]!=null).length;
 $('schoolCounts').innerHTML=
  '<b>'+fmt(pts.length)+' CCT SEP en el territorio</b><br>'+
  '<span class="school-figure-green">'+fmt(cnt.EXTRAIDA)+' extraídas</span> · '+
  '<span class="school-figure-amber">'+fmt(cnt.TABLEAU)+' en Tableau pendientes</span> · '+
  '<span class="school-figure-grey">'+fmt(cnt.SEP)+' sólo SEP</span><br>'+
  '<strong>'+fmt(located)+' puntos visibles según filtro</strong>'+
  (located<current.length?' · '+fmt(current.length-located)+' sin coordenadas':'')+
  (state.showSchools?'':' · capa apagada');
}
function refreshSchoolLayer(){
 const controls=$('schoolControls'),legend=$('schoolMapLegend');
 if(controls)controls.hidden=!state.showSchools;
 if(legend)legend.hidden=!state.showSchools;
 const hint=$('schoolToggleHint');
 if(hint)hint.textContent=state.showSchools?'Puntos activados · puedes filtrar por estado o CCT.':'Ocultas al iniciar. Actívalas para explorar las CCT.';
 if(!map||!schoolData)return;
 refreshSchoolCounts();
 if(!state.showSchools){
   if(schoolLayer){map.removeLayer(schoolLayer);schoolLayer=null;}
   schoolLayerCacheKey='';
   return;
 }
 const key=[state.schoolFilter,state.schoolSearch,norm(state.municipality),state.district].join('|');
 if(key===schoolLayerCacheKey && schoolLayer && map.hasLayer(schoolLayer))return;
 if(schoolLayer){map.removeLayer(schoolLayer);schoolLayer=null;}
 schoolLayer=L.layerGroup();
 const points=schoolVisibleRows().filter(x=>x[2]!=null&&x[3]!=null);
 if(!schoolCanvas)schoolCanvas=L.canvas({padding:.35});
 for(const row of points){
   const color={EXTRAIDA:'#258571',TABLEAU:'#e3a24f',SEP:'#8292a1'}[row[4]]||'#87918a';
   const msg=row[4]==='EXTRAIDA'?'CCT con consulta y datos extraídos del IMSS':
     row[4]==='TABLEAU'?'CCT visible en el filtro Tableau, pendiente de extracción':
     'CCT del padrón SEP, no observada en el filtro Tableau';
   L.circleMarker([row[2],row[3]],{
     renderer:schoolCanvas,radius:row[4]==='EXTRAIDA'?4.1:3.25,
     weight:1.1,color:'#ffffff',fillColor:color,fillOpacity:.94
   }).bindPopup('<div class="school-popup"><span class="school-popup-badge">'+sanitize(row[4])+'</span>'+
     '<h3>CCT '+sanitize(row[0])+'</h3><p>'+sanitize(msg)+'</p>'+
     '<small>Ubicación SEP referencial. Sin datos clínicos individuales.</small></div>').addTo(schoolLayer);
 }
 schoolLayer.addTo(map);
 schoolLayerCacheKey=key;
}
function syncMetricPills(){
 const pills=document.querySelectorAll('[data-metric]');
 for(const btn of pills){
   const on=btn.dataset.metric===state.metric;
   btn.classList.toggle('active',on);
   btn.setAttribute('aria-pressed',String(on));
 }
}
function renderTerritoryRibbon(r,isAgeB){
 const title=isAgeB?'AGEB '+(agebSelected?.nombre||''):r?.nombre||'Sonora';
 $('ribbonArea').textContent=title;
 $('ribbonStatus').textContent=isAgeB?'Localización de planteles · sin tasas IMC por AGEB':
   'Indicadores del corte IMSS · 28 oct 2026';
 $('ribbonCct').textContent=fmt(r?.cct_extraidas)+' / '+fmt(r?.cct_tableau);
 $('ribbonEvaluated').textContent=fmt(r?.menores_evaluados)+' / '+fmt(r?.menores_registrados);
 $('ribbonCoverage').textContent=pct(r?.pct_menores_evaluados);
 $('territoryTypeLabel').textContent=isAgeB?'AGEB':state.municipality?'MUNICIPIO':state.district?'DISTRITO':'SONORA';
}
function renderNutritionalStack(r,isAgeB){
 const stack=$('nutriStack'),insight=$('territoryInsight');
 if(!stack||!insight)return;
 stack.innerHTML='';
 if(isAgeB||!r?.nutricion_publicable){
   insight.innerHTML='<b>Lectura territorial</b><p>Las categorías IMC no están publicadas para esta unidad. <strong>Sin dato no significa cero casos.</strong> Los puntos corresponden a escuelas, no al domicilio de los niños.</p>';
   return;
 }
 const categoryColors={'Peso Bajo':'#7bb7b7',Normal:'#5e9569',Sobrepeso:'#dbab62',Obesidad:'#ec889b'};
 const accessible=[];
 let parts='';
 for(const k of healthCategories){
   const z=r.nutricion?.[k],p=Number(z?.pct||0);
   if(!(p>0))continue;
   parts+='<span style="width:'+Math.max(0,Math.min(100,p)).toFixed(3)+'%;background:'+categoryColors[k]+'" title="'+sanitize(k)+' · '+pct(p)+'"></span>';
   accessible.push(k+' '+pct(p));
 }
 if(parts){
   stack.innerHTML='<div class="nutri-stack-track" role="img" aria-label="'+sanitize(accessible.join(', '))+'">'+parts+'</div>'+
   '<div class="nutri-stack-labels">'+healthCategories.map(k=>'<span><i style="background:'+categoryColors[k]+'"></i>'+sanitize(k)+'</span>').join('')+'</div>';
 }
 insight.innerHTML='<b>Cómo leer este territorio</b><p>'+fmt(r.imc_clasificados)+
 ' clasificaciones IMC recuperadas de '+fmt(r.cct_extraidas)+' CCT extraídas. Cobertura de evaluación: <strong>'+
 pct(r.pct_menores_evaluados)+'</strong> entre menores registrados en esas CCT. No es prevalencia poblacional.</p>';
}
function renderSidebar(){
 const r=selectedRecord(),isAgeB=!!(state.level==='ageb'&&agebSelected);
 const showName=isAgeB?'AGEB '+agebSelected.nombre:(r?.nombre||'Sonora');
 renderTerritoryRibbon(r,isAgeB);renderNutritionalStack(r,isAgeB);
 $('selName').textContent=showName;
 $('selSub').textContent=isAgeB?state.municipality+' · '+(agebSelected.tipo||'urbana/rural')+' · escuela situada, no residencia':r?.nombre==='Sonora'?'Resumen del corte de las 1,393 escuelas capturadas':r?.distrito?'Distrito de Salud '+r.distrito+' · evaluación escolar':'Datos del territorio seleccionado';
 const info=$('selectionInfo');info.innerHTML='<div class="info-grid">'+numberBox('CCT SEP',r.cct_sep,'catálogo 2026')+numberBox('CCT Tableau',r.cct_tableau,'filtro 2025–2026')+numberBox('CCT extraídas',r.cct_extraidas,'capturas verificadas')+percentBox('% extraídas',r.pct_extraidas_en_tableau,'de las CCT Tableau')+numberBox('Menores registrados',r.menores_registrados,'en CCT extraídas')+numberBox('Menores evaluados',r.menores_evaluados,'en CCT extraídas')+percentBox('% evaluados',r.pct_menores_evaluados,'de menores registrados')+numberBox('IMC clasificados',r.imc_clasificados,'tablas de peso y talla')+'</div>';
 if(isAgeB)info.innerHTML+='<div class="detail-note">Los conteos AGEB se calculan con la ubicación SEP del plantel. El ZIP no permite asignar las cifras de peso y talla a un AGEB de residencia ni publicar resultados clínicos a este nivel.</div>';
 const bars=$('nutrBars');bars.innerHTML='';
 if(isAgeB||!r.nutricion_publicable){bars.innerHTML='<div class="detail-note">No hay categorías IMC divulgables para este territorio. Sin dato no significa ausencia de bajo peso, sobrepeso u obesidad.</div>';}
 else for(const name of healthCategories){const z=r.nutricion?.[name];const percent=z?.pct;
  const b=document.createElement('div');b.className='nutr-row';b.innerHTML='<div class="between"><span>'+name+'</span><b>'+pct(percent)+'</b></div><div class="track"><i style="width:'+Math.min(100,Math.max(0,percent||0))+'%;background:'+(colors[name][3])+'"></i></div><small>'+fmt(z?.n)+' de '+fmt(r.imc_clasificados)+' clasificaciones IMC</small>';bars.append(b);
 }
 const age=$('ageInfo');
 if(isAgeB)age.innerHTML='<p class="subhelp">No se dispone de la distribución etaria de los niños residentes o evaluados por AGEB.</p>';
 else {age.innerHTML='<div class="age-line"><span>5–9 años evaluados</span><b>'+fmt(r.rango_edad_5_9)+'</b></div><div class="age-line"><span>10–16 años evaluados</span><b>'+fmt(r.rango_edad_10_16)+'</b></div><div class="age-line"><span>Menores de 5 años (4 años en tabla)</span><b>'+fmt(r.menores_5_evaluados)+'</b></div><p class="subhelp">El conteo de menores de 5 años se oculta cuando la celda es pequeña. CONAPO es una fuente separada para residentes de 0 a 4 años.</p>'}
 renderPopulationSidebar(r,isAgeB);renderTerritoryList();if(state.tab==='population')renderPopulationTab();
}
function renderTerritoryList(){const list=$('territoryList');list.innerHTML='';
 if(state.level==='ageb'&&state.municipality){
  const feature=geo?.features?.find(f=>norm(nameForGeo(f))===norm(state.municipality));
  const mun=String(feature?.properties?.cve_mun||'').padStart(3,'0');
  const prefix='26'+mun;
  const censusRows=Object.entries(agebCensus?.registros||{}).filter(([key,v])=>key.startsWith(prefix));
  const heading=document.createElement('p');heading.className='subhelp';
  heading.textContent=agebItems.length?
    fmt(agebItems.length)+' polígonos AGEB con geometría; selecciona el área o una clave del listado.':
    fmt(censusRows.length)+' AGEB urbanas con conteos INEGI 2020 divulgables; sin geometría cargada sólo se muestra la tabla, no la ubicación.';
  list.append(heading);
  if(!censusRows.length)return;
  const search=document.createElement('input');search.type='search';search.placeholder='Buscar clave AGEB (ej. 26030…)';
  search.setAttribute('aria-label','Buscar AGEB por clave geoestadística');search.className='ageb-search';
  list.append(search);
  const viewport=document.createElement('div');viewport.className='ageb-census-list';list.append(viewport);
  const rowsByCode=new Map(agebItems.map(rec=>[rec.nombre,rec]));
  const sorted=censusRows.sort((a,b)=>b[1].p_0a4-a[1].p_0a4);
  const render=()=>{
   viewport.innerHTML='';
   const q=search.value.trim().toUpperCase();
   const matches=sorted.filter(([id])=>!q||id.includes(q));
   for(const [id,v] of matches.slice(0,50)){
    const button=document.createElement('button');button.className='territory-link';
    button.textContent=id+' · '+fmt(v.p_0a4)+' menores 0–4 (2020)';
    button.addEventListener('click',()=>{
      const prior=rowsByCode.get(id);
      agebSelected=prior||{
        nombre:id,tipo:'urbana',distrito:initialMunicipal(state.municipality)?.distrito,
        cct_sep:null,cct_tableau:null,cct_extraidas:null,
        pct_extraidas_en_tableau:null,pct_tableau_en_sep:null,
        cct_con_evaluados:null,menores_registrados:null,menores_evaluados:null,
        pct_menores_evaluados:null,imc_clasificados:null,
        nutricion_publicable:false,nutricion:{},
        poblacion_0_4_censo_2020:v.p_0a4,
        poblacion_total_censo_2020:v.pobtot,pct_0_4_censo_2020:v.pct_0_4
      };
      renderSidebar();refreshSchoolLayer();
    });
    viewport.append(button);
   }
   if(matches.length>50){const foot=document.createElement('p');foot.className='subhelp';foot.textContent='Mostrando 50 de '+fmt(matches.length)+' AGEB. Escribe la clave para localizar otra.';viewport.append(foot)}
  };
  search.addEventListener('input',render);
  render();
  return;
 }
 if(state.municipality){const m=initialMunicipal(state.municipality);list.innerHTML='<p class="subhelp">Distrito de Salud '+(m?.distrito||'S/D')+'. Selecciona el nivel AGEB para explorar los polígonos de ubicación de planteles.</p>';return;}
 if(state.district){for(const [code,m] of Object.entries(data.municipios).filter(([k,r])=>r.distrito===state.district).sort((a,b)=>a[1].nombre.localeCompare(b[1].nombre,'es'))){const el=document.createElement('button');el.className='territory-link';el.textContent=m.nombre+' · '+fmt(m.cct_extraidas)+' CCT extraídas';el.addEventListener('click',()=>selectMunicipio(m.nombre));list.append(el)}return;}
 for(const [code,r] of Object.entries(data.distritos)){const el=document.createElement('button');el.className='territory-link';el.textContent='DS'+code+' · '+data.distritos_nombres[code]+' · '+fmt(r.cct_extraidas)+' CCT';el.addEventListener('click',()=>selectDistrict(code));list.append(el)}
}
function levelData(){if(state.level==='distrito')return Object.entries(data.distritos).map(([code,r])=>[code,r]);return Object.entries(data.municipios).map(([code,r])=>[code,r]).filter(([k,r])=>!state.district||r.distrito===state.district);}
function viewRow(r){const values=[r.nombre,r.cct_sep,r.cct_tableau,r.cct_extraidas,pct(r.pct_extraidas_en_tableau),r.menores_registrados,r.menores_evaluados,pct(r.pct_menores_evaluados),r.imc_clasificados];for(const cat of healthCategories){const c=r.nutricion_publicable?r.nutricion?.[cat]:null;values.push(c?`${fmt(c.n)} (${pct(c.pct)})`:'S/D')}return values;}
function renderTable(){if(!data)return;let body=$('tableBody');body.innerHTML='';if(state.level==='ageb'){$('tableBody').innerHTML='<tr><td colspan="13">AGEB: sólo mostramos conteos de CCT en polígonos recuperados; no hay tablas antropométricas publicables por AGEB en este corte.</td></tr>';return;}
 for(const [code,r] of levelData()){const row=document.createElement('tr');const vs=viewRow(r);row.innerHTML=vs.map((v,i)=>'<td class="'+(v==='S/D'?'na':'')+'">'+(typeof v==='number'?fmt(v):sanitize(v))+'</td>').join('');row.addEventListener('click',()=>{state.tab='map';changeTab('map');if(state.level==='distrito')selectDistrict(code);else selectMunicipio(r.nombre)});body.append(row)}
}
function downloadTable(){const rows=[['Territorio','SEP','Tableau','CCT extraídas','% extracciones','Menores registrados','Menores evaluados','% evaluados','IMC clasificados','Peso bajo','Normal','Sobrepeso','Obesidad'],...levelData().map(([code,r])=>viewRow(r))];const csv='\ufeff'+rows.map(row=>row.map(s=>'"'+String(s??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='ALLERE_COBERTURA_NUTRICION_20261028.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
function changeTab(tab){state.tab=tab;for(const name of ['map','table','population','who']){$(name+'Panel').hidden=tab!==name;const b=$('tab'+name[0].toUpperCase()+name.slice(1));b.classList.toggle('active',tab===name)}if(tab==='map'&&map)setTimeout(()=>map.invalidateSize(),70);if(tab==='table')renderTable();if(tab==='population')renderPopulationTab();}
function updateLevel(){state.level=$('nivel').value;agebSelected=null;if(state.level==='ageb'&&healthCategories.includes(state.metric)){state.metric='under5';$('metrica').value='under5';}state.municipality=state.level==='distrito'?'':state.municipality;syncFilters();renderSidebar();applyMap();if(state.level==='ageb')reloadAgebs();else clearAgebs();fitSelection();}
function fillControls(){for(const [code,name] of Object.entries(data.distritos_nombres)){$('distrito').add(new Option('DS'+code+' · '+name,code))}for(const [key,r] of Object.entries(data.municipios).sort((a,b)=>a[1].nombre.localeCompare(b[1].nombre,'es'))){$('municipio').add(new Option(r.nombre,r.nombre))}}
function clearAgebs(){agebSerial++;agebItems=[];agebSelected=null;if(map&&agebLayer){map.removeLayer(agebLayer);agebLayer=null;}}
function readAgebs(obj){if(!obj)return null;let v=typeof obj==='string'?JSON.parse(obj):obj;
 if(v.type==='FeatureCollection'&&Array.isArray(v.features))return v;
 let arr=v.datos||v.data||v.results||v.resultados||v;
 if(typeof arr==='string')arr=JSON.parse(arr);
 if(!Array.isArray(arr))return null;
 let f=[];for(const it of arr){let geo=it.geojson||it.geometry||it;if(typeof geo==='string'){try{geo=JSON.parse(geo)}catch{continue}}if(geo.type==='Feature')f.push(geo);else if(geo.type==='FeatureCollection')f.push(...geo.features);else if(['Polygon','MultiPolygon'].includes(geo.type))f.push({type:'Feature',properties:it.properties||it,geometry:geo})}return f.length?{type:'FeatureCollection',features:f}:null;}
function agebCode(f){const p=f.properties||{};return String(p.cvegeo||p.CVEGEO||p.cve_geo||'').trim();}
function pInRing(point,ring){const x=point[0],y=point[1];let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))inside=!inside;}return inside;}
function pInGeom(point,g){if(!g)return false;const inPolygon=poly=>pInRing(point,poly[0])&&!poly.slice(1).some(r=>pInRing(point,r));return g.type==='Polygon'?inPolygon(g.coordinates):g.type==='MultiPolygon'?g.coordinates.some(inPolygon):false;}
function styleAgeB(f){
 const census=agebCensus?.registros?.[agebCode(f)];
 const st=f.properties?._allereStats;
 const v=state.metric==='under5'?census?.p_0a4:state.metric==='under5_share'?census?.pct_0_4:state.metric==='cct_extraidas'?st?.pct_extraidas_en_tableau:state.metric==='pct_tableau_en_sep'?st?.pct_tableau_en_sep:null;
 let fill='#d6e6e8';
 if(v!=null&&Number.isFinite(v)){
  const cuts=state.metric==='under5'?[15,50,150,350]:thresholds[state.metric]||[5,6,7,8];let ix=0;while(ix<4&&v>=cuts[ix])ix++;
  fill=(ramps[state.metric]||ramps.under5)[ix];
 }
 return {color:'#275763',weight:1.2,fillColor:fill,fillOpacity:['under5','under5_share','cct_extraidas','pct_tableau_en_sep'].includes(state.metric)?.72:.22};
}
function agebCounts(feature,pts){const stat={cct_sep:0,cct_tableau:0,cct_extraidas:0,cct_con_evaluados:null,menores_registrados:null,menores_evaluados:null,pct_menores_evaluados:null,imc_clasificados:null,nutricion_publicable:false,nutricion:{},menores_5_evaluados:null,rango_edad_5_9:null,rango_edad_10_16:null};
 for(const row of pts){const point=[row[3],row[2]];if(pInGeom(point,feature.geometry)){stat.cct_sep++;if(row[4]==='EXTRAIDA'){stat.cct_tableau++;stat.cct_extraidas++}else if(row[4]==='TABLEAU')stat.cct_tableau++}}
 stat.pct_extraidas_en_tableau=stat.cct_tableau?stat.cct_extraidas/stat.cct_tableau*100:null;
 stat._geometry=feature.geometry;
 const census=agebCensus?.registros?.[agebCode(feature)];stat.poblacion_0_4_censo_2020=census?.p_0a4??null;stat.poblacion_total_censo_2020=census?.pobtot??null;stat.pct_0_4_censo_2020=census?.pct_0_4??null;stat.pct_evaluadas_en_tableau=null;stat.pct_tableau_en_sep=stat.cct_sep?stat.cct_tableau/stat.cct_sep*100:null;return stat;}
async function reloadAgebs(){clearAgebs();if(state.level!=='ageb')return;if(!state.municipality){$('geoStatus').textContent='AGEB: elige primero un municipio';$('filterNotice').textContent='Para calcular cobertura a escala AGEB, selecciona un municipio y espera las geometrías del INEGI. Las tasas de IMC por AGEB no están disponibles.';return;}
 const thisRun=agebSerial,mun=state.municipality;
 const f=geo.features.find(f=>norm(nameForGeo(f))===norm(mun));const code=String(f?.properties?.cve_mun||'').padStart(3,'0');if(!/^\d{3}$/.test(code)){ $('geoStatus').textContent='Clave municipal INEGI no disponible';return;}
 $('geoStatus').textContent='Consultando AGEB de '+mun+'…';
 const urls=[['local','./data/ageb/26'+code+'.geojson'],['urbana','https://gaia.inegi.org.mx/wscatgeo/v2/geo/agebu/26/'+code],['rural','https://gaia.inegi.org.mx/wscatgeo/v2/geo/agebr/26/'+code]];
 let feats=[],sources=[],localOkay=false;
 try{const r=await fetch(urls[0][1]);if(r.ok){const j=readAgebs(await r.json());feats=j?.features||[];localOkay=feats.length>0;sources.push('GeoJSON local');}}catch(e){console.warn('AGEB local',e)}
 if(!localOkay){const sets=await Promise.all(urls.slice(1).map(async ([type,u])=>{try{const r=await fetch(u);if(!r.ok)return [];const j=readAgebs(await r.json());if(j?.features?.length)sources.push(type);return (j?.features||[]).map(f=>({...f,properties:{...f.properties,tipo_ageb:type}}));}catch(e){console.warn('AGEB '+type,e);return []}}));feats=sets.flat();}
 if(thisRun!==agebSerial)return;
 const prefix='26'+code;feats=feats.filter(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type)&&agebCode(f).startsWith(prefix));
 if(!feats.length){$('geoStatus').textContent='Sin geometría AGEB utilizable para '+mun+'; el tabulado INEGI 2020 está integrado, pero no se dibujará un área sin un polígono validado';$('filterNotice').textContent='No podemos asignar escuelas a AGEB sin geometría y claves oficiales. El municipio y distrito siguen disponibles.';renderSidebar();return;}
 const pts=schoolData.catalogo_escuelas_2026.filter(r=>r[1]===norm(mun)&&r[2]!=null);
 const list=[];
 agebLayer=L.geoJSON({type:'FeatureCollection',features:feats},{style:styleAgeB,onEachFeature:(f,layer)=>{
 const id=agebCode(f);if(!id)return;const rec=agebCounts(f,pts);f.properties=f.properties||{};f.properties._allereStats=rec;rec.nombre=id;rec._geometry=f.geometry;rec.tipo=f.properties?.tipo_ageb||(id.length>9?'urbana':'rural');rec.distrito=initialMunicipal(mun)?.distrito;
 list.push(rec);
 layer.bindTooltip('<b>AGEB '+sanitize(id)+'</b><br>'+fmt(rec.cct_extraidas)+' extraídas / '+fmt(rec.cct_tableau)+' en Tableau<br>'+fmt(rec.cct_sep)+' CCT SEP<br>Residentes 0–4 INEGI 2020: '+fmt(rec.poblacion_0_4_censo_2020)+'<br>Sin tasas IMC por AGEB',{sticky:true});
 layer.on('click',()=>{agebSelected=rec;renderSidebar();refreshSchoolLayer();layer.openTooltip();});
 }}).addTo(map);
 agebItems=list;
 agebLayer.eachLayer(l=>l.setStyle(styleAgeB(l.feature)));
 refreshSchoolLayer(); // los marcadores permanecen visibles y clicables sobre los polígonos
 if(agebLayer.getBounds().isValid())map.fitBounds(agebLayer.getBounds().pad(.04),{maxZoom:13});
 $('geoStatus').textContent=fmt(list.length)+' AGEB cargadas · fuente: '+sources.join(' + ')+(agebCensus?' · censo INEGI 2020 enlazado':' · sin tabla censal 2020');$('filterNotice').textContent='AGEB = lugar del plantel SEP. Los porcentajes disponibles son sólo de extracción de CCT, no indicadores antropométricos ni población residente.';renderSidebar();
}
function chartSvg(series,mini=false){
 if(!series?.length)return '<text x="20" y="35" fill="#667" font-size="13">Sin proyección para este territorio</text>';
 const W=mini?340:820,H=mini?120:305,L=mini?10:65,R=mini?10:22,T=mini?8:27,B=mini?11:35;
 const values=series.map(v=>v.pob_0_4),lo=Math.max(0,Math.floor(Math.min(...values)*.92/1000)*1000),hi=Math.ceil(Math.max(...values)*1.07/1000)*1000;
 const xx=i=>L+i*(W-L-R)/(series.length-1),yy=v=>T+(hi-v)/(hi-lo)*(H-T-B);
 const path=series.map((v,i)=>(i?'L':'M')+xx(i).toFixed(1)+','+yy(v.pob_0_4).toFixed(1)).join(' ');
 let svg='<rect width="'+W+'" height="'+H+'" rx="12" fill="#f8fbf7" />';
 if(!mini){for(let i=0;i<5;i++){const n=lo+(hi-lo)*i/4,y=yy(n);svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" stroke="#dce9df"/><text x="'+(L-8)+'" y="'+(y+3)+'" text-anchor="end" font-size="11" fill="#648074">'+fmt(Math.round(n))+'</text>';}[2015,2020,2026,2030].forEach(year=>{let i=year-2015;svg+='<text x="'+xx(i)+'" y="'+(H-10)+'" text-anchor="middle" font-size="11" fill="#61746c">'+year+'</text>';});}
 svg+='<path d="'+path+'" fill="none" stroke="#23795d" stroke-width="'+(mini?2.5:3.5)+'" stroke-linejoin="round"/>';
 const yi=state.popYear-2015;if(series[yi])svg+='<circle cx="'+xx(yi)+'" cy="'+yy(series[yi].pob_0_4)+'" r="'+(mini?4:5.5)+'" fill="#ce8554" stroke="white" stroke-width="2"/>';
 return svg;
}

function censusTerritory(r){
 if(!agebCensus||!r)return null;
 if(r.nombre==='Sonora')return agebCensus.total_estatal_0_4;
 const m=conapoIndex.get(norm(r.nombre));
 if(m)return agebCensus.municipios_0_4_censo?.[m.clave_municipio]?.p_0a4??null;
 if(r.distrito){
  const ms=Object.values(conapo?.municipios||{}).filter(x=>initialMunicipal(x.municipio)?.distrito===r.distrito);
  if(!ms.length)return null;
  const vals=ms.map(m=>agebCensus.municipios_0_4_censo?.[m.clave_municipio]?.p_0a4);
  return vals.every(Number.isFinite)?vals.reduce((a,b)=>a+b,0):null;
 }
 return null;
}
function renderPopulationSidebar(r,isAgeB){const node=$('populationInfo'),curve=$('sidebarPopulationChart');const census=isAgeB?agebSelected:null;
 if(isAgeB){if(census?.poblacion_0_4_censo_2020!=null){node.innerHTML='<div class="info-grid">'+numberBox('Residentes 0–4 (INEGI 2020)',census.poblacion_0_4_censo_2020,'Censo 2020, no proyección')+percentBox('% 0–4 (INEGI 2020)',census.pct_0_4_censo_2020,'de los residentes de AGEB')+'</div>';}else node.innerHTML='<p class="demog-empty">No hay conteo INEGI 2020 divulgable para esta AGEB, o falta su polígono geográfico. Los residentes 0–4 por AGEB se derivan de P_0A2 + P_3YMAS - P_5YMAS.</p>';curve.innerHTML='';return;}
 const p=yearProjectionForTerritory(r,state.popYear),series=Array.from({length:16},(_,i)=>yearProjectionForTerritory(r,2015+i));
 if(!p){node.innerHTML='<p class="demog-empty">Sin proyección conciliada con el territorio seleccionado.</p>';curve.innerHTML='';return;}
 const observed=censusTerritory(r);
 node.innerHTML='<div class="info-grid">'+numberBox('Menores 0–4 · '+state.popYear,p.pob_0_4,'CONAPO residentes')+
 percentBox('% población 0–4',p.pct_0_4,'del total residente')+
 numberBox('Niñas 0–4',p.mujeres_0_4,'proyección')+numberBox('Niños 0–4',p.hombres_0_4,'proyección')+
 numberBox('Censo INEGI 2020 · 0–4',observed,'Conteo censal municipal/estatal, no AGEB parciales')+'</div>';
 curve.innerHTML=chartSvg(series,true);
}
function renderPopulationTab(){if(!conapo||!data)return;const r=selectedRecord();if(state.level==='ageb'&&agebSelected){const c=agebSelected;$('popSummary').textContent='AGEB '+c.nombre+' · INEGI Censo 2020, residentes de 0–4 años en área urbana; no hay curva anual CONAPO por AGEB.';$('populationChart').innerHTML='';$('popKpis').innerHTML=numberBox('Residentes 0–4 (INEGI 2020)',c.poblacion_0_4_censo_2020,'Conteo de AGEB, cuando es divulgable')+percentBox('% residentes 0–4',c.pct_0_4_censo_2020,'De la población total de la AGEB');$('populationTable').innerHTML='';return;}
 const series=Array.from({length:16},(_,i)=>yearProjectionForTerritory(r,2015+i));if(series.some(v=>!v))return;
 const current=series[state.popYear-2015],base=series[5],last=series[15];$('popSummary').textContent=(r?.nombre||'Sonora')+' · CONAPO residentes de 0–4 años, 2015–2030. El punto destacado es el año '+state.popYear+'.';
 $('popKpis').innerHTML=numberBox('Menores 0–4 ('+state.popYear+')',current.pob_0_4,'proyección')+numberBox('Niñas 0–4',current.mujeres_0_4,'proyección')+numberBox('Niños 0–4',current.hombres_0_4,'proyección')+percentBox('% de residentes 0–4',current.pct_0_4,'población total '+fmt(current.pob_total));
 $('populationChart').innerHTML=chartSvg(series);
 $('populationTable').innerHTML=series.map((v,i)=>'<tr'+(i+2015===state.popYear?' class="highlight-year"':'')+'><td>'+(2015+i)+'</td><td>'+fmt(v.mujeres_0_4)+'</td><td>'+fmt(v.hombres_0_4)+'</td><td><b>'+fmt(v.pob_0_4)+'</b></td><td>'+fmt(v.pob_total)+'</td><td>'+pct(v.pct_0_4)+'</td></tr>').join('');
}
async function main(){
 try{
  const paths=['./data/indicadores_20261028.json','./data/escuelas_sep2026_ubicacion.json','./data/municipios_sonora.geojson','./data/conapo_0_4_2015_2030.json'];const res=await Promise.all(paths.map(u=>fetch(u)));if(res.some(r=>!r.ok))throw Error('Falta un archivo de datos de la versión 2026-10-28.');
  [data,schoolData,geo,conapo]=await Promise.all(res.map(r=>r.json()));conapoIndex=new Map(Object.values(conapo.municipios).map(r=>[norm(r.municipio),r]));
  try{const ac=await fetch('./data/inegi_ageb_2020_0_4.json');if(ac.ok)agebCensus=await ac.json();}catch(e){console.info('Censo AGEB aún no incorporado',e);}if(Object.keys(conapo.municipios).length!==72||conapo.estado['2026'].pob_0_4!==246122||data.meta.cct_extraidas!==1393||Object.keys(data.municipios).length!==72||geo.features.length!==72||schoolData.catalogo_escuelas_2026.length!==5464)throw Error('La versión cartográfica no coincide con los catálogos y los totales auditados.');
  for(const [k,r] of Object.entries(data.municipios))byNormDistrict.set(k,r.distrito);
  $('kpSep').textContent=fmt(data.meta.cct_sep);$('kpTab').textContent=fmt(data.meta.cct_tableau);$('kpExt').textContent=fmt(data.meta.cct_extraidas);$('kpEval').textContent=fmt(data.meta.menores_evaluados);
  $('progressPct').textContent=pct(data.meta.cct_extraidas/data.meta.cct_tableau*100);$('progressFill').style.width=(data.meta.cct_extraidas/data.meta.cct_tableau*100)+'%';
  fillControls();$('showSchools').checked=false;state.showSchools=false;
  $('schoolFilter').value='TODAS';state.schoolFilter='TODAS';
  $('schoolSearch').value='';state.schoolSearch='';
  initMap();applyMap();renderSidebar();
  loadBoobokPublicEvents();
  $('nivel').addEventListener('change',updateLevel);
  $('metrica').addEventListener('change',()=>{state.metric=$('metrica').value;applyMap();renderSidebar()});
  $('populationYear').addEventListener('input',()=>{state.popYear=Number($('populationYear').value);$('populationYearVal').textContent=state.popYear;applyMap();renderSidebar();if(state.tab==='population')renderPopulationTab();});
  $('distrito').addEventListener('change',()=>selectDistrict($('distrito').value));
  $('municipio').addEventListener('change',()=>{const v=$('municipio').value;if(v)selectMunicipio(v);else{state.municipality='';agebSelected=null;syncFilters();applyMap();renderSidebar();if(state.level==='ageb')reloadAgebs();else fitSelection()}});
  $('showSchools').addEventListener('change',()=>{state.showSchools=$('showSchools').checked;refreshSchoolLayer()});
  $('schoolFilter').addEventListener('change',()=>{state.schoolFilter=$('schoolFilter').value;refreshSchoolLayer()});
  $('schoolSearch').addEventListener('input',()=>{clearTimeout(schoolSearchTimer);schoolSearchTimer=setTimeout(()=>{state.schoolSearch=$('schoolSearch').value.trim();refreshSchoolLayer()},180)});
  for(const chip of document.querySelectorAll('[data-metric]'))chip.addEventListener('click',()=>{state.metric=chip.dataset.metric;$('metrica').value=state.metric;applyMap();renderSidebar();if(state.tab!=='map')changeTab('map')});
  $('reset').addEventListener('click',()=>{
    state.district='';state.municipality='';state.level='municipio';state.metric='Obesidad';
    $('nivel').value=state.level;$('metrica').value=state.metric;
    $('showSchools').checked=false;state.showSchools=false;
    $('schoolFilter').value='TODAS';state.schoolFilter='TODAS';
    $('schoolSearch').value='';state.schoolSearch='';
    syncFilters();clearAgebs();applyMap();fitSelection();renderSidebar();
  });
  $('tabMap').addEventListener('click',()=>changeTab('map'));$('tabTable').addEventListener('click',()=>changeTab('table'));$('tabWHO').addEventListener('click',()=>changeTab('who'));$('tabPopulation').addEventListener('click',()=>changeTab('population'));$('exportTable').addEventListener('click',downloadTable);
 }catch(e){console.error(e);$('geoStatus').textContent='Error de carga: '+e.message;$('map').innerHTML='<p style="padding:30px">No se pudo cargar la versión nueva. Consulta la consola o recarga el sitio.</p>';}
}
document.addEventListener('DOMContentLoaded',main);
/* La identidad BOOBOK es independiente de las consultas y filtros del atlas. */
document.addEventListener('DOMContentLoaded',()=>{
 const modal=$('boobokIdentityDialog');
 const sidebarButton=$('showBoobokIdentity');
 const mapButton=$('boobokMapBadge');
 const close=$('closeBoobokIdentity');
 if(!modal||!close)return;
 const open=()=>{
  if(typeof modal.showModal==='function')modal.showModal();
  else modal.setAttribute('open','');
 };
 for(const button of [sidebarButton,mapButton]){
  if(button)button.addEventListener('click',open);
 }
 close.addEventListener('click',()=>{
  if(typeof modal.close==='function')modal.close();
  else modal.removeAttribute('open');
 });
 modal.addEventListener('click',event=>{
  if(event.target===modal){
   if(typeof modal.close==='function')modal.close();
   else modal.removeAttribute('open');
  }
 });
});
