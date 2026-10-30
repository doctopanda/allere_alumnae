'use strict';
/* ALLERE ALUMNAE · Webapp táctil. Consume los mismos agregados públicos que el atlas. */
const $=id=>document.getElementById(id);
const nf=new Intl.NumberFormat('es-MX');
const fmt=x=>Number.isFinite(Number(x))?nf.format(Number(x)):'S/D';
const percent=(a,b)=>Number.isFinite(Number(a))&&Number(b)>0?100*Number(a)/Number(b):null;
const pct=(a,b)=>{const v=percent(a,b);return v===null?'S/D':v.toFixed(1)+'%'};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>Number.isFinite(Number(x))?Number(x):null;
const clamped=x=>Math.min(100,Math.max(0,num(x)??0));
const cats=[['Peso Bajo','#5e9569'],['Normal','#3da393'],['Sobrepeso','#e4af63'],['Obesidad','#e47f91']];
let data=null,district='',municipality='',currentView='home',frame=null,installPrompt=null;
function homeMeta(){return data?.meta||null}
function selectedRecord(){if(!data)return null;if(municipality)return data.municipios[municipality]||data.meta;if(district)return data.distritos[district]||data.meta;return data.meta}
function selectedName(){if(municipality)return data?.municipios?.[municipality]?.nombre||municipality;if(district)return data?.distritos?.[district]?.nombre||'Distrito '+district;return 'Sonora'}
function categoriesFor(rec){
 if(rec===data.meta)return Object.fromEntries(cats.map(([c])=>[c,{n:rec.categorias?.[c]??null,pct:percent(rec.categorias?.[c],rec.imc_clasificados)}]));
 if(!rec.nutricion_publicable)return null;
 return rec.nutricion||null;
}
function normMetrics(rec){
 if(!rec)return {};
 return {sep:num(rec.cct_sep),tableau:num(rec.cct_tableau),extracted:num(rec.cct_extraidas),registered:num(rec.menores_registrados),evaluated:num(rec.menores_evaluados),imc:num(rec.imc_clasificados)};
}
function valuesFor(rec){
 const r=normMetrics(rec);
 return {...r,pending:r.tableau===null||r.extracted===null?null:Math.max(0,r.tableau-r.extracted),
 unevaluated:r.registered===null||r.evaluated===null?null:Math.max(0,r.registered-r.evaluated),
 unclassified:r.evaluated===null||r.imc===null?null:Math.max(0,r.evaluated-r.imc)};
}
function kpi(label,value,detail,extraClass='',home=false){
 return '<button type="button" class="kpi '+extraClass+'" data-detail="'+detail+'"'+(home?' data-home="1"':'')+'><small>'+esc(label)+'</small><strong>'+fmt(value)+'</strong><span>Ver análisis ↗</span></button>';
}
function detailButton(label,value,key,mini){
 return '<button type="button" class="mini-stat" data-detail="'+key+'"><small>'+esc(label)+'</small><b>'+fmt(value)+'</b><i>'+esc(mini||'Tocar para analizar')+' ↗</i></button>';
}
function openDetail(key,home=false){
 if(!data)return;const rec=home?data.meta:selectedRecord();const v=valuesFor(rec);
 const area=home?'Sonora':selectedName(), category=key.startsWith('cat:')?key.slice(4):null;
 const descriptors={
 sep:['Escuelas registradas en SEP',v.sep,'Conteo de planteles en el padrón SEP, antes de filtrar los que aparecen en Tableau.',null,null],
 tableau:['Escuelas observadas en Tableau',v.tableau,'Escuelas que integran el universo observado en Tableau en el corte del operativo. No representan la totalidad de planteles de Sonora.',v.sep,'CCT en Tableau / CCT en padrón SEP'],
 extracted:['CCT con extracción confirmada',v.extracted,'CCT cuyos archivos recuperados pasaron el control de integridad y filtro de Sonora.',v.tableau,'CCT extraídas / CCT observadas en Tableau'],
 pending:['CCT pendientes de extracción',v.pending,'Diferencia entre las CCT observadas en Tableau y las CCT ya extraídas. No describe centros sin encuesta.',v.tableau,'(CCT Tableau − CCT extraídas) / CCT Tableau'],
 registered:['Menores registrados en las CCT recuperadas',v.registered,'Matrícula reportada por las escuelas extraídas. No es la población residente 0–4 ni todos los menores del estado.',null,null],
 evaluated:['Menores evaluados',v.evaluated,'Menores con evaluación reportada en las escuelas recuperadas, respecto a los menores registrados en esas mismas CCT.',v.registered,'Menores evaluados / menores registrados'],
 imc:['Registros con clasificación IMC',v.imc,'Evaluaciones con una categoría IMC disponible: peso bajo, normal, sobrepeso u obesidad.',v.evaluated,'Registros IMC / menores evaluados'],
 unevaluated:['Registros sin evaluación documentada',v.unevaluated,'Diferencia en el corte entre menores registrados y menores evaluados en las CCT recuperadas. No identifica abandonos ni ausencias individuales.',v.registered,'(Registrados − evaluados) / registrados'],
 unclassified:['Evaluados sin categoría IMC',v.unclassified,'Diferencia entre evaluados y registros con IMC clasificado. No asumir que representan casos patológicos.',v.evaluated,'(Evaluados − IMC clasificados) / evaluados']
 };
 let item=descriptors[key],source='IMSS, resultados agregados escolares; SEP, padrón de escuelas. Corte 28 de octubre de 2026.';
 if(category){
 const c=categoriesFor(rec);const value=c?.[category]??null;
 item=[category+' · clasificación IMC',value?.n??null,'Conteo y proporción de '+category.toLowerCase()+' entre las clasificaciones IMC disponibles. No constituye prevalencia poblacional ni diagnóstico individual.',v.imc,'Registros de la categoría / total de IMC clasificados'];
 if(!c||value?.n==null)item[2]='Dato suprimido por criterios de publicación: menos de 5 CCT, menos de 50 IMC clasificados o alguna categoría inferior a 11 registros. S/D no es cero.';
 }
 if(!item)return;
 const [title,value,description,denominator,formula]=item;
 const val=value==null?'S/D':fmt(value);
 const ratio=denominator!==null&&value!==null?pct(value,denominator):null;
 $('sheetTitle').textContent=title;
 $('sheetBody').innerHTML='<p style="margin:0;color:#478476;font-size:11px;font-weight:900">'+esc(area)+' · Corte 28 OCT 2026</p>'+
 '<div class="sheet-value">'+val+'</div>'+
 (ratio?'<p style="font-size:14px;font-weight:900;color:#17786b">'+ratio+' del denominador correspondiente</p>':'')+
 '<h3>¿Qué significa?</h3><p>'+esc(description)+'</p>'+
 (formula?'<h3>Cálculo y trazabilidad</h3><div class="sheet-formula">'+esc(formula)+'<br><strong>Numerador:</strong> '+(value==null?'S/D':fmt(value))+'<br><strong>Denominador:</strong> '+fmt(denominator)+(ratio?'<br><strong>Resultado:</strong> '+ratio:'')+'</div>':'')+
 '<p class="sheet-source"><strong>Fuente:</strong> '+esc(source)+' Datos por escuela de ubicación. Sin datos nominales infantiles.</p>';
 $('detailSheet').showModal();
}
function renderHome(){
 const meta=homeMeta();if(!meta)return;const v=valuesFor(meta);
 $('homeKpis').innerHTML=kpi('Escuelas en SEP',v.sep,'sep','',true)+kpi('Escuelas en Tableau',v.tableau,'tableau','',true)+kpi('CCT extraídas',v.extracted,'extracted','',true)+kpi('Menores evaluados',v.evaluated,'evaluated','rose',true);
 $('homeExtractPct').textContent=pct(v.extracted,v.tableau);
 $('homeExtractBar').style.width=clamped(percent(v.extracted,v.tableau))+'%';
 $('homeEvalPct').textContent=pct(v.evaluated,v.registered);
 $('homeEvalBar').style.width=clamped(percent(v.evaluated,v.registered))+'%';
 $('homeGaps').innerHTML=[
 ['Pendientes de extracción en Tableau',v.pending,'pending'],
 ['Registrados sin evaluación documentada',v.unevaluated,'unevaluated'],
 ['Evaluados sin clasificación IMC',v.unclassified,'unclassified']
 ].map(([label,value,key])=>'<button type="button" class="summary-row" data-detail="'+key+'" data-home="1"><span>'+esc(label)+'</span><b>'+fmt(value)+' ↗</b></button>').join('');
}
function loadSelects(){
 $('mobileDistrict').innerHTML='<option value="">Todo Sonora</option>'+Object.entries(data.distritos).map(([id,r])=>'<option value="'+esc(id)+'">'+esc(r.nombre)+'</option>').join('');
 refreshMunicipalities();
}
function refreshMunicipalities(){
 const list=Object.entries(data.municipios).filter(([id,r])=>!district||r.distrito===district)
 .sort((a,b)=>a[1].nombre.localeCompare(b[1].nombre,'es'));
 if(municipality&&!list.some(([id])=>id===municipality))municipality='';
 $('mobileMunicipality').innerHTML='<option value="">Todos los municipios</option>'+
 list.map(([id,r])=>'<option value="'+esc(id)+'">'+esc(r.nombre)+'</option>').join('');
 $('mobileMunicipality').value=municipality;
 $('mobileDistrict').value=district;
}
function meter(label,a,b,key){
 return '<button class="summary-row" type="button" data-detail="'+key+'" style="width:100%;margin:10px 0 7px;border:0;padding:0;background:transparent"><span>'+esc(label)+'</span><b>'+pct(a,b)+' ↗</b></button><div class="meter"><span style="width:'+clamped(percent(a,b))+'%"></span></div>';
}
function renderDashboard(){
 if(!data)return;const rec=selectedRecord(),v=valuesFor(rec);if(!rec)return;
 $('selectedTerritory').textContent=selectedName();
 $('selectedContext').textContent=municipality?'Municipio · información publicable':district?'Distrito de Salud · datos agregados':'Datos agregados estatales';
 $('dashboardKpis').innerHTML=detailButton('CCT SEP',v.sep,'sep')+detailButton('CCT Tableau',v.tableau,'tableau')+
 detailButton('CCT extraídas',v.extracted,'extracted')+detailButton('Pendientes',v.pending,'pending')+
 detailButton('Registrados',v.registered,'registered')+detailButton('Evaluados',v.evaluated,'evaluated')+
 detailButton('IMC clasificados',v.imc,'imc')+detailButton('Evaluados sin clasificación',v.unclassified,'unclassified');
 $('dashboardMeters').innerHTML=meter('CCT extraídas / Tableau',v.extracted,v.tableau,'extracted')+meter('Evaluados / registrados',v.evaluated,v.registered,'evaluated')+meter('IMC / evaluados',v.imc,v.evaluated,'imc');
 renderNutrition(rec,v);renderDistrictRows();
}
function renderNutrition(rec,v){
 const c=categoriesFor(rec),stack=$('nutriStack'),legend=$('nutritionLegend'),privacy=$('nutriPrivacy');
 if(!c||!v.imc){
  stack.innerHTML='<span style="font:800 11px system-ui;color:#7b8f82;padding:3px">Distribución no publicable en este territorio</span>';
  legend.innerHTML='';
  privacy.textContent='La categoría se mantiene suprimida por criterios de publicación; S/D no es cero casos.';
  return;
 }
 const total=cats.reduce((a,[cat])=>a+(num(c[cat]?.n)??0),0);
 if(total!==v.imc){
  stack.innerHTML='';legend.innerHTML='';privacy.textContent='No se visualiza el reparto: los conteos de categorías no coinciden con el total de IMC.';return;
 }
 stack.innerHTML=cats.map(([cat,color])=>'<button type="button" data-detail="cat:'+esc(cat)+'" style="background:'+color+';flex:'+(c[cat]?.n||0)+'" aria-label="'+esc(cat)+' '+fmt(c[cat]?.n)+' registros"></button>').join('');
 legend.innerHTML=cats.map(([cat,color])=>'<button type="button" class="legend-item" data-detail="cat:'+esc(cat)+'"><i style="background:'+color+'"></i><span>'+esc(cat)+'<b>'+pct(c[cat]?.n,v.imc)+'</b></span></button>').join('');
 privacy.textContent='Total IMC clasificados: '+fmt(v.imc)+'. Pulsa un segmento para consultar numerador y denominador.';
}
function renderDistrictRows(){
 const rows=Object.entries(data.distritos).map(([id,r])=>({id,r,ratio:percent(r.cct_extraidas,r.cct_tableau)}))
  .sort((a,b)=>(b.ratio||0)-(a.ratio||0));
 $('districtRows').innerHTML=rows.map(({id,r,ratio})=>'<button type="button" class="territory '+(district===id?'active':'')+'" data-district-pick="'+esc(id)+'"><div><span>'+esc(r.nombre)+'</span><small>'+fmt(r.cct_extraidas)+' / '+fmt(r.cct_tableau)+' CCT</small><div class="meter"><span style="width:'+clamped(ratio)+'%"></span></div></div><em>'+pct(r.cct_extraidas,r.cct_tableau)+'</em></button>').join('');
}
function switchView(tab,push=true){
 if(!['home','map','dashboard'].includes(tab))tab='home';
 currentView=tab;
 document.querySelectorAll('.view').forEach(x=>{x.hidden=x.id!=='view-'+tab});
 document.querySelectorAll('.tabbar button').forEach(x=>{const selected=x.dataset.tab===tab;x.classList.toggle('active',selected);if(selected)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
 const main=$('appMain');main.style.overflowY=tab==='map'?'hidden':'auto';if(tab!=='map')main.scrollTop=0;
 if(tab==='map'&&!frame){
  frame=document.createElement('iframe');frame.id='atlasMobileFrame';frame.className='map-frame';frame.title='Mapa interactivo de ALLERE ALUMNAE, Sonora';
  frame.src='./index.html?app=1';frame.loading='eager';frame.setAttribute('allow','fullscreen');
  $('mapSlot').replaceWith(frame);
 }
 if(tab==='dashboard'&&data)renderDashboard();
 if(push&&location.hash!=='#'+tab)history.replaceState(null,'','#'+tab);
 if(tab==='map'&&frame){try{frame.contentWindow?.dispatchEvent(new Event('resize'))}catch(e){/* iframe same origin by design */}}
}
function handleClick(e){
 const nav=e.target.closest('[data-tab]');if(nav){switchView(nav.dataset.tab);return;}
 const go=e.target.closest('[data-go]');if(go){switchView(go.dataset.go);return;}
 const detail=e.target.closest('[data-detail]');if(detail){openDetail(detail.dataset.detail,detail.dataset.home==='1');return;}
 const d=e.target.closest('[data-district-pick]');if(d){district=d.dataset.districtPick;municipality='';refreshMunicipalities();renderDashboard();$('appMain').scrollTo({top:0,behavior:'smooth'});return;}
}
function configureInstall(){
 let onIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent);
 let standalone=matchMedia('(display-mode:standalone)').matches||navigator.standalone===true;
 if(standalone)return;
 const banner=$('installBanner'),btn=$('installBtn'),hint=$('installHint');
 if(onIOS){banner.classList.add('visible');hint.textContent='En Safari, toca Compartir y luego «Añadir a pantalla de inicio».';btn.textContent='Ver instrucciones';btn.addEventListener('click',()=>{ $('sheetTitle').textContent='Instalar en iPhone';$('sheetBody').innerHTML='<p>1. Abre esta webapp en Safari.</p><p>2. Toca el botón Compartir.</p><p>3. Elige «Añadir a pantalla de inicio» y confirma.</p><p class="sheet-source">El mapa y las bases requieren conexión a internet. La instalación no descarga la cartografía.</p>';$('detailSheet').showModal()});}
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;banner.classList.add('visible');hint.textContent='Instala el acceso directo como una webapp independiente.';btn.textContent='Instalar ALLERE';});
 btn.addEventListener('click',async()=>{if(!installPrompt)return;const p=installPrompt;installPrompt=null;await p.prompt();const choice=await p.userChoice;if(choice?.outcome==='accepted')banner.classList.remove('visible')});
}
async function loadData(){
 try{
  const r=await fetch('./data/indicadores_20261028.json',{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const j=await r.json();if(!j?.meta||!j.distritos||!j.municipios)throw Error('Estructura incompleta');
  data=j;loadSelects();renderHome();renderDashboard();
 }catch(err){
  $('homeKpis').innerHTML='<div class="notice" style="grid-column:1/-1"><strong>No se pudieron cargar los agregados.</strong><p>Comprueba la conexión a internet e intenta de nuevo. No se muestran cifras almacenadas como si fueran datos actualizados.</p><button type="button" class="action" onclick="location.reload()">Reintentar</button></div>';
  $('dashboardKpis').innerHTML='<p class="notice">Sin conexión con los archivos de indicadores públicos. '+esc(err.message)+'</p>';
 }
}
document.addEventListener('DOMContentLoaded',()=>{
 document.addEventListener('click',handleClick);
 $('mobileDistrict').addEventListener('change',e=>{district=e.target.value;municipality='';refreshMunicipalities();renderDashboard()});
 $('mobileMunicipality').addEventListener('change',e=>{municipality=e.target.value;const r=data?.municipios?.[municipality];if(r?.distrito&&!district){district=r.distrito;$('mobileDistrict').value=district;}renderDashboard()});
 $('closeSheet').addEventListener('click',()=>$('detailSheet').close());
 $('detailSheet').addEventListener('click',e=>{if(e.target===$('detailSheet'))$('detailSheet').close()});
 window.addEventListener('hashchange',()=>switchView(location.hash.slice(1)||'home',false));
 configureInstall();switchView(location.hash.slice(1)||'home',false);loadData();
 if('serviceWorker' in navigator&&location.protocol==='https:'){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.info('PWA sin service worker:',err)))}
});
