async function loadScript(url) {
  const txt = await fetchOne(url);
  if (!txt) return;

  if (url.endsWith('.js')) {
    const se = document.createElement('script');
    se.type = 'text/javascript';
    se.text = txt;
    document.getElementsByTagName('head')[0].appendChild(se);
  }
  else if (url.endsWith('.css')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = txt;
    document.head.appendChild(link);
  }
}