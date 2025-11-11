async function loadScript(url) {
  const js = await fetchOne(url);
  if (!js) return;

  const se = document.createElement('script');
  se.type = 'text/javascript';
  se.text = js;
  document.getElementsByTagName('head')[0].appendChild(se);
}