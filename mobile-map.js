/* Activo únicamente desde el contenedor webapp ?app=1 */
(function(){
 const params=new URLSearchParams(location.search);
 if(params.get('app')!=='1')return;
 const root=document.documentElement;
 root.classList.add('allere-mobile-map');
 const init=()=>{
 const sidebar=document.querySelector('.left'),detail=document.querySelector('.right');
 const holder=document.querySelector('.shell');
 if(!sidebar||!detail||!holder)return;
 const bar=document.createElement('header');bar.className='allere-map-mobilebar';
 bar.innerHTML='<button type="button" id="allereOpenFilters" aria-controls="allereDrawerFilters" aria-expanded="false">☷ Filtros</button><span>🐸 ALLERE · MAPA</span><button type="button" id="allereOpenDetail" aria-controls="allereDrawerDetail" aria-expanded="false">Ficha territorial ▴</button>';
 document.body.prepend(bar);sidebar.id='allereDrawerFilters';detail.id='allereDrawerDetail';
 const scrim=document.createElement('div');scrim.className='allere-mobile-scrim';scrim.hidden=true;document.body.append(scrim);
 const closeFilters=document.createElement('button');closeFilters.type='button';closeFilters.className='allere-mobile-close';closeFilters.textContent='✕ Cerrar filtros';sidebar.prepend(closeFilters);
 const closeDetail=document.createElement('button');closeDetail.type='button';closeDetail.className='allere-mobile-close';closeDetail.textContent='✕ Cerrar ficha territorial';detail.prepend(closeDetail);
 const bFilter=bar.querySelector('#allereOpenFilters'),bDetail=bar.querySelector('#allereOpenDetail');
 const close=()=>{sidebar.classList.remove('mobile-open');detail.classList.remove('mobile-open');scrim.hidden=true;bFilter.setAttribute('aria-expanded','false');bDetail.setAttribute('aria-expanded','false')};
 const show=which=>{close();which.classList.add('mobile-open');scrim.hidden=false;(which===sidebar?bFilter:bDetail).setAttribute('aria-expanded','true')};
 bFilter.addEventListener('click',()=>sidebar.classList.contains('mobile-open')?close():show(sidebar));
 bDetail.addEventListener('click',()=>detail.classList.contains('mobile-open')?close():show(detail));
 scrim.addEventListener('click',close);closeFilters.addEventListener('click',close);closeDetail.addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 let initial=true;const name=document.getElementById('selName');
 if(name){const observer=new MutationObserver(()=>{if(initial){initial=false;return;}if(!sidebar.classList.contains('mobile-open'))show(detail)});
 observer.observe(name,{childList:true,characterData:true,subtree:true});setTimeout(()=>{initial=false},1250);}
 for(const id of ['distrito','municipio'])document.getElementById(id)?.addEventListener('change',()=>{
 setTimeout(()=>{close();show(detail);},280);
 });
 const mapPanel=document.getElementById('mapPanel');
 const ro=('ResizeObserver' in window)&&mapPanel?new ResizeObserver(()=>{if(typeof map!=='undefined'&&map&&typeof map.invalidateSize==='function')map.invalidateSize()}):null;
 if(ro)ro.observe(mapPanel);
 window.addEventListener('message',e=>{if(e.origin!==location.origin)return;if(e.data?.type==='allere-close-drawers')close()});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
