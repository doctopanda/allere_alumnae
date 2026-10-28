'use strict';
const el=id=>document.getElementById(id);
const fmt=x=>new Intl.NumberFormat('es-MX').format(x);
const cssFor={COMPLETADA:'pin-completed',FALLIDA:'pin-failed',PENDIENTE:'pin-pending',SIN_ESTADO_LOCAL:'pin-historic'};
const statusText={COMPLETADA:'Completada en checkpoint',FALLIDA:'Fallida: requiere reintento',PENDIENTE:'Pendiente de consulta',SIN_ESTADO_LOCAL:'Sin estado local'};
let records=[],filtered=[],map,markers,health,markerByCct=new Map(),debounce;
function escapeHtml(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeFile(x){return String(x??'').replace(/["\n\r]/g,'');}
function school(r){return {cct:r[0],nombre:r[1],municipio:r[2],localidad:r[3],lat:r[4],lon:r[5],estado:r[6]};}
function getStatus(s){return statusText[s]||'No informado';}
function statusClass(s){return cssFor[s]||cssFor.SIN_ESTADO_LOCAL;}
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
    const [schoolsResponse,healthResponse]=await Promise.all([fetch('./data/escuelas.json'),fetch('./data/salud_agregada.json')]);
    if(!schoolsResponse.ok||!healthResponse.ok)throw Error('Error al cargar datos');
    const [info,hs]=await Promise.all([schoolsResponse.json(),healthResponse.json()]);
    health=hs;records=info.records.map(school);
    if(records.length!==1501)throw Error('Cantidad de CCT distinta a la esperada: '+records.length);
    filtered=records;
    updateKpis();fillMunicipalities();initMap();applyFilters(false);populateHealth();
    el('search').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>applyFilters(true),230)});
    el('municipio').addEventListener('change',()=>applyFilters(true));
    el('estado').addEventListener('change',()=>applyFilters(true));
    el('reset').addEventListener('click',()=>{el('search').value='';el('municipio').value='';el('estado').value='';applyFilters(true)});
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
