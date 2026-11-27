// Campania Dar din Dar: cronometru până la deschiderea comenzilor și controlul clipului (src/cozonaci.py)
(function(){
var start=Date.UTC(2026,11,2,22,0,0); // 3 decembrie 2026, 00:00, ora României
function pad(n){return(n<10?'0':'')+n}
function tick(){var now=Date.now();
document.querySelectorAll('.cd-box[data-coz]').forEach(function(b){
if(now>=start){var c=b.querySelector('.cd-clock');if(c&&!b.dataset.fin){b.dataset.fin=1;var p=document.createElement('p');p.className='cd-msg';p.textContent=b.dataset.live;c.replaceWith(p);}return;}
var s=Math.floor((start-now)/1000),v={d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60};
b.querySelectorAll('.cd-num').forEach(function(e){e.textContent=pad(v[e.dataset.u]);});});}
if(document.querySelector('.cd-box[data-coz]')){tick();setInterval(tick,1000);}
var v=document.querySelector('.coz-media video'),btn=document.querySelector('.coz-pause');
if(v&&btn){
var calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var save=navigator.connection&&navigator.connection.saveData;
function lab(){btn.textContent=v.paused?btn.dataset.play:btn.dataset.pause;btn.setAttribute('aria-pressed',v.paused?'true':'false');}
btn.hidden=false;
if(calm||save){v.removeAttribute('autoplay');v.pause();}else{var p=v.play();if(p&&p.catch)p.catch(function(){});}
v.addEventListener('play',lab);v.addEventListener('pause',lab);lab();
btn.addEventListener('click',function(){if(v.paused){v.play();}else{v.pause();}});
}
})();
