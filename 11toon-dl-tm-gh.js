// ==UserScript==
// @name         11toon downloader
// @namespace    http://tampermonkey.net/
// @version      0.2.1
// @description  try to take over the world!
// @author       anemochore
// @match        http*://*/bbs/board.php?bo_table=toons*
// @updateURL    https://anemochore.github.io/mana-dl/11toon-dl-tm-gh.js
// @downloadURL  https://anemochore.github.io/mana-dl/11toon-dl-tm-gh.js
// @require      https://anemochore.github.io/mana-dl/util/loadScript.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

//v0.1.5: add range select and more message. internal wrap-up
//v0.1.9: fix minor css, improve and change episode title, add spinner
//v0.2.0: add support for migrating to github
//v0.2.1: migrate to github

/* 사용법:
일일툰에서 이미지를 받는 스크립트야.
여기는 너무 잘 돌아가서 딱히 할 말이 없네...
*/


//entry point (loadScript() is needed for jszip working in tampermonkey)
if (!window.console2) await loadScript('https://anemochore.github.io/mana-dl/util/common.js');
const console2 = new FadingAlert();

init();


function init() {
  const container = document.querySelector('ul#comic-episode-list');
  if (!container) return;

  console2.log('initializing... please wait...');

  //add css
  loadScript('https://anemochore.github.io/mana-dl/css/11toon.css');  //no await

  //add check buttons
  const lis = container.querySelectorAll('li');
  const epNumber = lis.length;
  for (const li of lis) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add('fy-check');
    checkbox.checked = true;
    li.prepend(checkbox);  //li에 직접 추가
  }

  const dlStart = initSettingContainer(container, epNumber, main);
  dlStart.classList.add('reset');  //버튼 css 리셋

  console2.log('ready!');
  console2.log();
}

async function main(maxDelay = 0) {
  console2.spin('fetching started.');

  if (!window.JSZip) await loadScript('https://raw.githubusercontent.com/Stuk/jszip/master/dist/jszip.min.js');
  const zip = new JSZip();

  const buttons = [...document.querySelectorAll('ul[id]>li>button[onclick]')]
  .filter(el => el.parentElement.querySelector('.fy-check').checked).reverse();  //역순으로 정렬(오름차순이 되게)
  let epTitles = buttons.map(el => el.querySelector('div.episode-title')?.innerText.trim());  //추후 수정 가능
  const epUrls = buttons.map(el => el.getAttribute('onclick')
  .replace(/location\.href=['"`]/, '').replace(/['"`]$/, '')
  .replace(/^\.\//, location.origin + '/bbs/'));  //상대주소는 절대주소로.

  //load each ep in sequence and get imgs asynchronously and add them to zip
  let i;
  for ([i, epUrl] of epUrls.entries()) {
    const result = await fetchOne(epUrl);
    if (result) {
      const doc = new DOMParser().parseFromString(result, "text/html");
      const title = doc.querySelector('h1').innerText.trim();
      if (epTitles[i].includes('…')) epTitles[i] = title;  //목록에서 제목이 축약되었을 경우 실제 문서 제목으로 대체

      //script 문자열로 파싱
      const imgUrls = JSON.parse(result.split('var img_list = ').pop().split(';')[0]);
      for (let [j, imgUrl] of imgUrls.entries()) {
        if (imgUrl.startsWith('//')) imgUrls[j] = 'http:' + imgUrl;
      }

      //화 단위로 받음
      const performanceStartTime = performance.now();
      const results = await fetchAll(imgUrls, 'blob');
      const performanceElapsedTime = performance.now() - performanceStartTime;
      console2.spin(`fetched ${results.filter(el => el).length}/${imgUrls.length} images on ${i+1}/${epUrls.length} sub-pages (${epTitles[i]}). took ${Math.round(performanceElapsedTime)} ms.`);

      //실패한 이미지는 과감하게(귀찮으니) 처리하지 않는다!!!
      for (let [j, img] of results.entries()) {
        if (img) {
          const ext = imgUrls[j].split('.').pop().split('?')[0] || 'jpg';  //is it safe to use jpg for fallback?
          const name = epTitles[i].replace(/[/\\?%*:|"<>]/g, '_') || '';
          zip.folder(`${i+1} ${name}`).file(`${j+1}.${ext}`, img);
        }
      }
      await sleep(Math.random() * maxDelay);
    }
  }

  //zip and d/l
  if(i >= 0) {
    console2.log(`${i+1}/${epUrls.length} sub-pages are fetched. plz wait for zipping.`);
    const BOOK_TITLE = document.querySelector('h2.title')?.innerText.replace(/[/\\?%*:|"<>]/g, '_') || '제목 없음';
    zipAndDownload(zip, BOOK_TITLE, console2);
  }
  else {
    console2.log('fetching failed? nothing to download. :(');
  }
}

async function fetchAll(urls, type) {
  const results = [];
  const promises = urls.map(async (url, i) => {
    results[i] = await fetchOne(url, type);
  });
  await Promise.all(promises);

  return results;
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
