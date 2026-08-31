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

async function fetchOne(url, type = 'text', options = {}) {
  if (!url) return null;

  const retries = options.retries ?? 2;
  const retryDelay = options.retryDelay ?? 3000;
  const retryJitter = options.retryJitter ?? 1000;
  const retryStatuses = options.retryStatuses ?? [408, 425, 429, 500, 502, 503, 504];

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await new Promise((resolve, reject) => {
        //detail object. see https://wiki.greasespot.net/GM.xmlHttpRequest
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          responseType: type == 'blob' ? 'blob' : 'text',
          timeout: options.timeout ?? 30000,
          onload: res => {
            if (res.status < 200 || res.status >= 300) {
              reject(createFetchError(`HTTP ${res.status} ${res.statusText || ''}`.trim(), url, res.status));
              return;
            }
            resolve(res);
          },
          onerror: () => reject(createFetchError('네트워크 오류', url)),
          ontimeout: () => reject(createFetchError('요청 시간 초과', url)),
          onabort: () => reject(createFetchError('요청 취소됨', url)),
        });
      });

      if (type == 'blob') validateImageResponse(res, url);
      return res.response;
    } catch (err) {
      const canRetry = attempt < retries && (err.retryable || !err.status || retryStatuses.includes(err.status));
      if (!canRetry) throw err;

      const delay = retryDelay * 2 ** attempt + Math.random() * retryJitter;
      console.warn(`fetch failed. retrying in ${delay} ms (${attempt + 1}/${retries}):`, url, err);
      options.onRetry?.({url, error: err, attempt: attempt + 1, retries, delay});
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function createFetchError(message, url, status = 0, retryable = false) {
  const err = new Error(`${message}: ${url}`);
  err.url = url;
  err.status = status;
  err.retryable = retryable;
  return err;
}

function validateImageResponse(res, url) {
  const blob = res.response;
  const contentType = (blob?.type || getResponseHeader(res.responseHeaders, 'content-type')).toLowerCase();
  if (!blob || typeof blob.size != 'number') throw createFetchError('이미지 Blob 응답이 아님', url, res.status, true);
  if (contentType.startsWith('text/') || contentType.includes('html') || contentType.includes('json')) {
    console.warn('[dev] HTTP 성공 응답이 이미지가 아님:', {
      status: res.status,
      url,
      contentType,
      size: blob.size,
    });
    throw createFetchError(`이미지가 아닌 응답 (${contentType})`, url, res.status, true);
  }
}

function getResponseHeader(headers = '', name) {
  const line = headers.split(/\r?\n/).find(header => header.toLowerCase().startsWith(`${name.toLowerCase()}:`));
  return line?.slice(line.indexOf(':') + 1).trim() || '';
}
