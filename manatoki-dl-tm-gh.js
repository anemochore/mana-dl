// ==UserScript==
// @name         manatoki downloader
// @namespace    http://tampermonkey.net/
// @version      0.2.2
// @description  try to take over the world!
// @author       anemochore
// @include      https://*toki*/*
// @include      https://*/*.jpg*
// @updateURL    https://anemochore.github.io/mana-dl/manatoki-dl-tm-gh.js
// @downloadURL  https://anemochore.github.io/mana-dl/manatoki-dl-tm-gh.js
// @require      https://anemochore.github.io/mana-dl/util/loadScript.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @grant        GM_closeTab
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// ==/UserScript==

//v0.1.2: 2025-11-5, 디시에서 삭제당해서 파일에 사용법 추가
//v0.1.5: fix minor css, change episode title, add spinner
//v0.2.0: add support for migrating to github
//v0.2.1: migrate to github
//v0.2.2: fix entry condition check bug

/* 사용법:
마나토끼에서 이미지를 받는 스크립트야.

여기는 자주 차단(403)을 당하므로 애초에 VPN이 내장된 오페라 브라우저를 쓰는 걸 권한다.
오페라를 쓰다가 차단당하면 VPN을 켜고 접속하면 된다(본 스크립트도 물론 작동함).
물론 VPN을 써도 차단당할 수 있는데, 그때는 국가를 바꾸면 됨.
https://www.clien.net/service/board/lecture/13181828

Tampermonkey를 지금껏 한 번도 안 써봤다면, 요즘엔 처음 사용할 때 좀 까다로운 부분이 있을 텐데 다음 글 등등을 참고하렴.
Tampermonkey 사용법은 검색하면 많이 나온다.
https://www.tampermonkey.net/faq.php#Q209
https://www.reddit.com/r/GreaseMonkey/comments/1hqv3iw/tampermonkey_scripts_not_loading_in_chrome/?tl=ko

여기도 CORS 문제가 있다가 없다가 해서 탬퍼멍키 버전으로 바꿨는데,
CORS 문제가 깔끔하게는 해결이 안 돼서, 어떤 경우에는 이미지가 있는 탭들을 마구 열어서 이미지를 저장할 거야. 놀라지 마셈.

혹시 차단당하지 않더라도, 한 번에 파일을 많이 받으면 zip 파일 다운로드 준비가 꽤 오래 걸린다.
*/


//check entry condition
let continueRun = true, console2 = window.console2;
if (GM_getValue('URLS_TO_DL')?.includes(location.href)) {
  console.log('direct d/l started.');
  await getImage();
}
else if (location.href.includes('toki') && !location.href.match(/\.jpg[?]{0,}.*$/)) {
  //loadScript() is needed for jszip working in tampermonkey
  if (!console2) await loadScript('https://anemochore.github.io/mana-dl/util/common.js');
  console2 = new FadingAlert();

  init();
}


function init() {
  const container = document.querySelector('#serial-move');
  if (!container) return;

  console2.log('initializing... please wait...');

  //add css
  loadScript('https://anemochore.github.io/mana-dl/css/manatoki.css');  //no await

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

  //manatoki's poor encoding function (copied from their source code)
  function html_encoder(s) {
    let out = '';
    for (let i = 0; i < s.length; i += 3) {
      out += String.fromCharCode(parseInt(s.substr(i, 2), 16));
    }
    return out;
  }

  //load each ep in sequence and get imgs asynchronously and add them to zip
  let i;
  for ([i, epUrl] of epUrls.entries()) {
    const html = await fetchOne(epUrl, 'text');  //same domain
    if (!html) {
      console2.log('차단당한 것 같음... 장비를 정지합니다.');
      i--;
      break;
    }
    else {
      var html_data;  //it will be populated by eval()
      const start = html.indexOf("var html_data='';");
      const end = html.indexOf("html_data+='';");
      const htmlDataLines = html.slice(start, end);
      eval(htmlDataLines);

      if (!html_data) {
        console2.log('페이지 응답이 이상함. 새로고침하고 다시 실행해봐. 계속 안 되면 제보 바람.');
        console.warn('응답 등 정보', html, start, end, htmlDataLines);
        throw new Error(`unexpected html data: ${htmlDataLines}`);
      }
      const htmlData = html_encoder(html_data);
      //console.debug(htmlData);  //dev+++

      //보통은 DOM을 만들어서 가져왔을 텐데 attribute 이름이 거지 같아서 그냥 regexp가 나을 듯.
      const imgUrls = [...htmlData.matchAll(/<img.+?data-.+?="(.+?)"/g)].map(el => el.pop());
      //console.debug(imgUrls);  //dev+++
      if (imgUrls.length == 0) {
        console2.log('이미지 개수가 0임!!! 제보 바람.');
        console.warn('html 응답', htmlData);
      }

      //화 단위로 병렬처리
      const performanceStartTime = performance.now();

      let results = await fetchAll(imgUrls, 'blob');  //'some' CORS restriction
      let shouldBreak = results.some(el => !el) || results.length == 0;
      if (shouldBreak) {
        console2.spin(`one or more images were not fetched. trying to open missing images...`);
        const results2 = await visitAndFetchAll(imgUrls.map((el, i) => !results[i] ? el : null));
        results.forEach((el, i) => {
          if (!el && results2[i]) results[i] = results2[i];
        });
      }
      shouldBreak = results.some(el => !el) || results.length == 0;

      const performanceElapsedTime = performance.now() - performanceStartTime;
      let pauseTime = Math.random() * (maxDelay - minDelay) + minDelay - performanceElapsedTime;
      if (i+1 == epUrls.length || shouldBreak || pauseTime < 0) pauseTime = 0;
      console2.spin(`fetched ${results.filter(el => el).length}/${imgUrls.length} images on ${i+1}/${epUrls.length} sub-pages (${epTitles[i]}). took ${Math.round(performanceElapsedTime)} ms. sleeping ${Math.round(pauseTime)} ms...`);
      await sleep(pauseTime);

      //실패한 이미지가 1도 없다면 zip에 추가
      if (shouldBreak) {
        i--;
        break;
      }
      for (let [j, img] of results.entries()) {
        const ext = imgUrls[j].split('.').pop().split('?')[0];
        const name = epTitles[i].replace(/[/\\?%*:|"<>]/g, '_') || '';
        zip.folder(`${i+1} ${name}`).file(`${j+1}.${ext}`, img);
      }
    }
  }

  //zip and d/l
  if(i >= 0) {
    console2.log(`${i+1}/${epUrls.length} sub-pages are fetched. plz wait for zipping.`);
    const BOOK_TITLE = document.querySelector('.view-content>span>b')?.innerText.replace(/[/\\?%*:|"<>]/g, '_') || '제목 없음';
    zipAndDownload(zip, BOOK_TITLE, console2);
  }
  else {
    console2.log('fetching failed? nothing to download. :(');
  }
}

async function fetchAll(urls, type) {
  const results = [];

  //중도 취소 불가(fetch를 쓰거나 순차처리하면 가능은 함)
  await Promise.all(urls.map(async (url, i) => {
    const res = await fetchOne(url, type);
    results[i] = res;
  }));
  
  return results;
}

async function fetchOne(url, type = 'text') {
  console.debug(`fetching: ${url}`);  //dev+++
  let res, result;
  try {
    res = handleErrors(await fetch(url));  //to catch 404, etc
  }
  catch (error) {
    console.debug('fetching failed:', url);
  }

  if (res?.ok) {
    if (type == 'text') {
      result = await res.text();
    }
    else {
      result = await res.blob();  //no error-handing
    }
  }
  return result;
}

function handleErrors(response) {
  if (!response.ok) throw new Error(response.statusText);
  return response;
}

async function visitAndFetchAll(urls) {
  GM_setValue('URLS_TO_DL', urls);

  await Promise.all(urls.map(openTab));

  const results = [];
  for (const [i, url] of urls.entries()) {
    const result = GM_getValue(i);
    if (url && result) {
      //b64를 다시 blob으로 변환
      const base64Response = await fetch(result);
      const blob = await base64Response.blob();
      results[i] = blob;
    }
    GM_deleteValue(i);
  }

  GM_deleteValue('URLS_TO_DL');
  return results;
}

async function openTab(url) {
  const index = GM_getValue('URLS_TO_DL').indexOf(url);
  if (index == -1) return;

  console.debug(`opening: ${url}`);  //dev+++
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

async function getImage() {
  const url = location.href;
  const index = GM_getValue('URLS_TO_DL').indexOf(url);  //it cannot be -1

  try {
    const res = await fetch(url);
    const blob = await res.blob();

    // Blob → Base64 변환
    const b64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // 저장
    GM_setValue(index, b64);
  } catch (err) {
    console.error('이미지 직접 저장 실패:', err);
  }
}
