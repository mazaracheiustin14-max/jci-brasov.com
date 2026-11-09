/* Meta Pixel JCI Brașov (ID 1646950960458698). Fișier extern, ca CSP să rămână fără 'unsafe-inline'. */
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1646950960458698');
fbq('track', 'PageView');

/* Conversii standard pe paginile de confirmare */
(function () {
  var p = location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  if (/(^|\/)inscriere-confirmata$/.test(p)) fbq('track', 'CompleteRegistration', { content_name: 'Inscriere eveniment' });
  else if (/(^|\/)vip-confirmat$/.test(p)) fbq('track', 'CompleteRegistration', { content_name: 'Bilet VIP' });
  else if (/(^|\/)multumim$/.test(p)) fbq('track', 'Lead');
})();
