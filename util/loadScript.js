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
    const styleEl = document.createElement('style');
    styleEl.textContent = txt;
    document.head.appendChild(styleEl);
  }
}

async function fetchOne(url, type = 'text') {
  return new Promise((resolve, reject) => {
    if (!url) resolve(null);

    //detail object. see https://wiki.greasespot.net/GM.xmlHttpRequest
    const payload = {
      method: 'GET',
      url: url,
      responseType: type == 'blob' ? 'blob' : 'text',
      onload: res => {
        resolve(res.response);
      },
      onerror: err => {
        reject(err);
      },
    };

    console.debug('fetching', url);  //dev+++
    GM_xmlhttpRequest(payload);
  });
}