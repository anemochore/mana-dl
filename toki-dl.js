// ==UserScript==
// @name         toki downloader
// @namespace    http://tampermonkey.net/
// @version      0.1.2
// @description  try to take over the world!
// @author       anemochore
// @include      https://*to*/*
// @include      https://*/*.jpg*
// @updateURL    https://anemochore.github.io/mana-dl/toki-dl.js
// @downloadURL  https://anemochore.github.io/mana-dl/toki-dl.js
// @require      https://anemochore.github.io/mana-dl/util/loadScript.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==

//v0.1.0: 2027-8-5

/* 사용법:
뉴토끼와 마나토끼(구분은 url 기준)에서 이미지(만화, 웹툰)를 받는 스크립트로, 딱히 설명할 건 없음
*/

// 개발자 도구 차단 해제(// @run-at document-start 필요)
(() => {
  function isBlockedKey(event) {
    const key = (event.key || "").toLowerCase();

    return key === "f12" || (event.ctrlKey && event.shiftKey && (key === "i" || key === "j" || key === "c")) || (event.ctrlKey && (key === "u" || key === "s")) || (event.metaKey && (key === "u" || key === "s"));
  }

  window.addEventListener(
    "keydown",
    (event) => {
      if (isBlockedKey(event)) {
        event.stopImmediatePropagation();
      }
    },
    true
  );

  for (const type of ["contextmenu", "selectstart", "dragstart"]) {
    window.addEventListener(
      type,
      (event) => {
        event.stopImmediatePropagation();
      },
      true
    );
  }
})();


// entry point
await domReady();

let console2 = window.console2;
if (GM_getValue('URLS_TO_DL')?.includes(location.href)) {
  const [rootSelector1, rootSelector2] = ['div.theme-viewer-image', '#manamoa_img'];  // 1. 뉴토끼, 2. 마나토끼
  let rootSelector = rootSelector1, elementReadyOption;
  if (document.querySelector(rootSelector1)) {
    // 뉴토끼
    elementReadyOption = {countForWait: document.querySelectorAll(rootSelector1 + '.is-loading').length};
  }
  else if (document.querySelector(rootSelector2)) {
    // 마나토끼
    elementReadyOption = {waitAgain: true};
    rootSelector = rootSelector2;
  }

  //console2 is not used here
  console.log('waiting for images to load...');
  await elementReady(rootSelector + '>img', document, elementReadyOption);
  console.log('all images are loaded. fetching...');
  await getImages(rootSelector + '>img');
}
else if (location.href.includes('to') && !location.href.match(/\.jpg[?]{0,}.*$/)) {  // url 하드코딩했음
  if (!console2) await loadScript('https://anemochore.github.io/mana-dl/util/common.js');  // loadScript() is needed for jszip working in tampermonkey
  console2 = new FadingAlert();
  init();
}
// end of flow


function init() {
  const container = document.querySelector('#serial-move') || document.querySelector('div.serial-list');  // 전자가 뉴토끼, 후자가 마나토끼
  if (!container) {
    console.log('컨테이너를 찾지 못함. 화수 페이지가 아니라면 사이트가 업데이트된 거니 개발자에게 문의하셈.');
    return;
  }

  console2.log('initializing... please wait...');

  //add css
  loadScript('https://anemochore.github.io/mana-dl/css/toki.css');  //no await

  //add check buttons
  const lis = container.querySelectorAll('li');
  const epNumber = lis.length;
  for (const li of lis) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add('fy-check');
    checkbox.checked = true;
    li.querySelector('div').prepend(checkbox);
  }

  const dlStart = initSettingContainer(container, epNumber, main);
  dlStart.textContent = '다운로드 시작(최대 50화 권장)';

  console2.log('ready!');
  console2.log();
}

async function main(e, minDelay = 3000, maxDelay = 3300) {
  console2.spin('fetching started.');

  if (!window.JSZip) await loadScript('https://raw.githubusercontent.com/Stuk/jszip/master/dist/jszip.min.js');
  const zip = new JSZip();

  const buttons = [...document.querySelectorAll('li.list-item:has(.fy-check)')]
  .filter(el => el.querySelector('.fy-check').checked).map(el => el.querySelector('a.item-subject')).reverse();  //역순으로 정렬(오름차순이 되게)
  const epTitles = buttons.map(el => [...el.childNodes].filter(n => n.nodeType == Node.TEXT_NODE)
  .find(n => n.textContent.trim().length > 0)?.textContent.trim().replace(/[/\\?%*:|"<>]/g, '_'));
  const epUrls = buttons.map(el => el.href);

  //load each ep in sequence and get imgs asynchronously and add them to zip
  let i = -1;
  for ([i, epUrl] of epUrls.entries()) {
    console2.spin(`openening: ${epUrl} (${i+1}/${epUrls.length})`);

    const performanceStartTime = performance.now();
    const result = (await visitAndFetchAll([epUrl]))[0];  //첫 번째 요소만 필요
    const performanceElapsedTime = performance.now() - performanceStartTime;
    //console.debug('result', result);

    const [imgUrls, imgBlobs] = result.reduce(([urls, blobs], {url, blob}) => {
      urls.push(url);
      blobs.push(blob);
      return [urls, blobs];
    }, [[], []]);
    console.debug('imgUrls', imgUrls);

    let pauseTime = Math.random() * (maxDelay - minDelay) + minDelay - performanceElapsedTime;
    if (i+1 == epUrls.length || pauseTime < 0) pauseTime = 0;
    console2.spin(`fetched ${imgUrls.filter(el => el).length}/${imgUrls.length} images on ${i+1}/${epUrls.length} sub-pages (${epTitles[i]}). took ${Math.round(performanceElapsedTime)} ms. sleeping ${Math.round(pauseTime)} ms...`);
    await sleep(pauseTime);

    //zip에 추가
    for (let [j, imgUrl] of imgUrls.entries()) {
      let ext = imgUrl.split('.').pop().split('?')[0];
      if (ext.startsWith('js') || ext.startsWith('woff') || ext == 'css') ext = 'jpg';  //is it safe to use jpg for fallback?
      const name = epTitles[i].replace(/[/\\?%*:|"<>]/g, '_') || '';
      zip.folder(`${i+1} ${name}`).file(`${j+1}.${ext}`, imgBlobs[j]);
    }
  }

  //zip and d/l (일부라도 성공했으면 다운로드는 진행)
  if(i >= 0 && Object.keys(zip.files).length > 0) {
    console2.log(`${i+1}/${epUrls.length} sub-pages are fetched. plz wait for zipping.`);
    const BOOK_TITLE =
      (document.querySelector('.page-title>h2')?.innerText ||  //뉴토끼
       document.querySelector('.view-content>span>b')?.innerText)  //마나토끼
      ?.trim().replace(/[/\\?%*:|"<>]/g, '_') || '제목 없음';
    zipAndDownload(zip, BOOK_TITLE, console2);
  }
  else {
    console2.log('fetching failed? nothing to download. :(');
  }
}

async function visitAndFetchAll(urls) {
  // 항상 배열을 받고, {url, blob} 객체들의 배열을 반환한다.

  GM_setValue('URLS_TO_DL', urls);
  await Promise.all(urls.map(openTabAndWait));

  const results = [];
  for (const [i, url] of urls.entries()) {
    let imgArray = GM_getValue(i);
    if (url && imgArray?.length > 0) {
      results[i] = [];
      for (const obj of imgArray) {
        //b64를 다시 blob으로 변환
        const base64Response = await fetch(obj.b64);
        const blob = await base64Response.blob();
        results[i].push({url: obj.url, blob});
      }
    }
    GM_deleteValue(i);
  }

  //console.debug('results in visitAndFetchAll:', results);
  GM_deleteValue('URLS_TO_DL');
  return results;
}

async function openTabAndWait(url) {
  const index = GM_getValue('URLS_TO_DL').indexOf(url);
  if (index == -1) return;

  //console.debug(`opening: ${url}`);  //dev
  const tab = GM_openInTab(url, { active: false, setParent: true });
  await waitForValueChange(index);
  tab.close();

  //return is not needed
}

function waitForValueChange(key) {
  return new Promise(resolve => {
    const listenerId = GM_addValueChangeListener(key, async (name, oldValue, newValue, remote) => {
      if (remote && newValue !== null) {
        GM_removeValueChangeListener(listenerId);
        resolve(newValue);
      }
    });
  });
}

async function getImages(selector = 'img') {
  // {url, b64} 객체들의 배열을 반환한다.

  const url = location.href;
  const index = GM_getValue('URLS_TO_DL').indexOf(url);  //it cannot be -1

  const imgUrls = [...document.querySelectorAll(selector)].map(img => img.src);
  if (imgUrls.length == 0) {
    console.error('No images found with selector:', selector);
    return;
  }
  try {
    //console.debug('imgUrls', imgUrls);

    const results = [];
    for (const url of imgUrls) {
      const blob = await fetchOne(url, 'blob');

      // Blob → Base64 변환
      const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      results.push({url, b64});
    }

    // 저장
    //console.debug('results in getImages:', results);
    GM_setValue(index, results);
  } catch (err) {
    console.error('이미지 직접 저장 실패:', err);
  }
}

function domReady() {
  if (document.readyState === 'loading') {
    return new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }

  return Promise.resolve();
}

function elementReady(selector, baseEl = document, options = {}) {
  return new Promise(resolve => {
    let els = [...baseEl.querySelectorAll(selector)];
    const lastEl = els.at(-1);

    if(els.length > 0 && !options.waitAgain) {
      console.debug('resolved at first call', els);
      if(options.returnAll) return resolve(els);
      else return resolve(lastEl);
    }

    let mutated = null;
    const timerId = setTimeout(async function tick() {
      if(!mutated) {
        if(!options.suppressTimeoutWarning) console.warn('elementReadey failed!!??', selector, els);
        observer.disconnect();
        if(options.returnAll) return resolve(els);
        else return resolve(lastEl);
      }
      clearTimeout(timerId);
    }, options.timeout || 5000);

    const observer = new MutationObserver(async (mutationRecords, observer) => {
      mutated = true;
      console.debug('mutated!');

      let els = [...baseEl.querySelectorAll(selector)];
      let lastEl = els.at(-1);
      if (els.length > 0 && !options.waitAgain) {
        console.debug('resolved for waitAgain false', els);
        observer.disconnect();
        if(options.returnAll) return resolve(els);
        else return resolve(lastEl);
      }
      else if (options.waitAgain) {
        console.debug('waiting again hoping for all children added...');
        observer.disconnect();
        await sleep(3000);  //dirty hack

        els = [...baseEl.querySelectorAll(selector)];
        lastEl = els.at(-1);

        console.debug('resolved for waitAgain true', els);
        if(options.returnAll) return resolve(els);
        else return resolve(lastEl);
      }
    });

    observer.observe(baseEl, {
      childList: true,
      subtree: true
    });
  });
}

// 개별 페이지에서는 common.js를 로드하지 않아 여기 또 씀...
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}