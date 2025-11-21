// ==UserScript==
// @name         chzzk-dl
// @namespace    https://chzzk.naver.com/
// @version      0.1.0
// @updateURL    https://anemochore.github.io/mana-dl/chzzk-dl.js
// @downloadURL  https://anemochore.github.io/mana-dl/chzzk-dl.js
// @description  CHZZK VOD 다운로더(라이브 X)
// @author       anemochore
// @match        https://chzzk.naver.com/video/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      api.chzzk.naver.com
// @connect      apis.naver.com
// @connect      *
// @noframes
// ==/UserScript==

const VOD_INFO = "https://api.chzzk.naver.com/service/v2/videos/{video_no}";
const VOD_URL = "https://apis.naver.com/neonplayer/vodplay/v2/playback/{video_id}?key={in_key}";

// 다운로드 진행 계산기 클래스
class DownloadProgress {
  constructor(totalBytesEstimate = null) {
    this.totalBytes = totalBytesEstimate;   // 추정 총 용량 (없으면 null)
    this.startTime = null;
    this.lastUpdate = 0;                    // throttle용
    this.lastLoadedBytes = 0;               // 마지막 loaded
  }

  start() {
    this.startTime = performance.now();
    this.lastUpdate = 0;
    this.lastLoadedBytes = 0;
  }

  // onprogress 이벤트에서 e.loaded를 넣어서 호출
  update(loadedBytes, throttleMs = 300) {
    const now = performance.now();
    if (!this.startTime) this.startTime = now;
    this.lastLoadedBytes = loadedBytes;

    if (now - this.lastUpdate < throttleMs) return null; // 너무 자주 호출되는 건 무시
    this.lastUpdate = now;

    const elapsedSec = (now - this.startTime) / 1000;
    const speedBps = elapsedSec > 0 ? loadedBytes / elapsedSec : 0; // bytes/sec

    let percent = null;
    if (this.totalBytes && this.totalBytes > 0) {
      percent = (loadedBytes / this.totalBytes) * 100;
      if (percent > 100) percent = 100;
    }

    let etaSec = null;
    if (this.totalBytes && speedBps > 0) {
      const remain = this.totalBytes - loadedBytes;
      if (remain > 0) etaSec = remain / speedBps;
    }

    const loadedText = formatBytes(loadedBytes);
    const totalText  = this.totalBytes ? formatBytes(this.totalBytes) : null;
    const speedText  = speedBps > 0 ? `${formatBytes(speedBps)}/s` : null;
    const etaText    = formatDuration(etaSec) + ' 남음';
    const percentText = percent != null ? percent.toFixed(1) + "%" : null;

    return { percent, percentText, loadedBytes, totalBytes: this.totalBytes, loadedText, totalText, speedBps, speedText, etaSec, etaText };
  }

  finalize() {
    if (!this.startTime) return null;

    const endTime = performance.now();
    const durationSec = (endTime - this.startTime) / 1000;
    const totalBytes = this.totalBytes || this.lastLoadedBytes;

    const result = { durationSec, durationText: formatDuration(durationSec), totalBytes };
    if (!totalBytes || durationSec <= 0) {
      result.avgSpeedBps = null;
      result.avgSpeedText = null;
      result.totalText = totalBytes ? formatBytes(totalBytes) : null;
    }
    else {
      result.avgSpeedBps = totalBytes / durationSec;
      result.avgSpeedText = `${formatBytes(result.avgSpeedBps)}/s`;
      result.totalText = formatBytes(totalBytes);
    }
    return result;
  }
}

// UI 관리 클래스
class DownloadUI {
  // 버튼과 프로그레스 박스에 공통으로 들어가는 스타일
  static BASE_UI_STYLE = {
    position: "fixed",
    right: "20px",
    zIndex: 99999,
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    color: "#fff",
    fontSize: "15px",
    padding: "0.5rem 1rem",
  };

  constructor() {
    this.isDownloading = false;
    this.onClickHandler = null;
    this.button = this.createButton();
    this.progressBox = this.createProgressBox();
  }

  createButton() {
    const btn = document.createElement("button");
    btn.id = "fy-download-btn";
    btn.textContent = "다운로드 시작";

    Object.assign(btn.style, DownloadUI.BASE_UI_STYLE, {
      bottom: "30px",
      background: "#00c73c",
      border: "none",
      cursor: "pointer",
    });

    btn.addEventListener("click", () => {
      if (typeof this.onClickHandler === "function") {
        this.onClickHandler();
      }
    });

    document.body.appendChild(btn);
    return btn;
  }

  createProgressBox() {
    const box = document.createElement("div");
    box.id = "fy-progress-box";

    Object.assign(box.style, DownloadUI.BASE_UI_STYLE, {
      bottom: "70px",
      fontSize: "90%",
      background: "rgba(0,192,168, 0.7)",
      display: "none",
    });

    document.body.appendChild(box);
    return box;
  }

  setDownloading(flag) {
    this.isDownloading = flag;
    if (!this.button) return;

    if (flag) {
      this.button.textContent = "다운로드 중...";
      this.button.style.opacity = "0.7";
      this.button.style.cursor = "not-allowed";
    } else {
      this.button.textContent = "다운로드 시작";
      this.button.style.opacity = "1";
      this.button.style.cursor = "pointer";

      this.progressBox.style.display = "none";
    }
  }

  showProgress(text) {
    if (!this.progressBox) return;
    this.progressBox.style.display = "block";
    this.progressBox.textContent = text;
  }

  showProgressDetail(info) {
    if (!info) return;

    let msg = "";
    if (info.percentText) msg += `다운로드 ${info.percentText} `;
    if (info.loadedText) {
      msg += '(' + info.loadedText;
      if (info.totalText) msg += "/" + info.totalText;
      msg += ") ";
    }
    if (info.speedText) msg += '@ ' + info.speedText + " ";
    if (info.etaText) msg += '(' + info.etaText + ')';

    this.showProgress(msg || "다운로드 중...");
  }
}


// 실제 다운로드 로직
async function fetchVodInfoAndDownload(whatever) {
  const ui = window.chzzkDownloadUI;
  if (ui.isDownloading) {
    log("이미 다운로드 중이라 두 번째 호출 무시");
    return;
  }

  try {
    const videoNo = location.pathname.match(/\/video\/(\d+)/)?.[1];
    if (!videoNo) {
      alert("동영상 번호를 찾을 수 없습니다.");
      return;
    }
    //log("video_no:", videoNo);

    ui.setDownloading(true);
    ui.showProgress("다운로드 준비 중...");

    const infoUrl = VOD_INFO.replace("{video_no}", videoNo);
    const json = await gmGetText(infoUrl, {}, 'json');
    const content = json.content || {};
    log("API 주소 및 응답:", infoUrl, content);

    const videoId = content.videoId;
    const inKey = content.inKey;
    if (!videoId || !inKey) {
      alert("로그인이 필요한 영상이거나 정보를 가져올 수 없습니다.");
      ui.setDownloading(false);
      return;
    }

    const author = content.channel.channelName || content.channel || "";
    const category = content.videoCategory || "";
    const title = content.videoTitle || "chzzk_video";
    //log(`Author: ${author}, Category: ${category}, Title: ${title}, videoId: ${videoId}, inKey: ${inKey}`);

    const playbackUrl = VOD_URL.replace("{video_id}", encodeURIComponent(videoId)).replace("{in_key}", encodeURIComponent(inKey));
    const rep = await getRepFromManifest(playbackUrl);
    const baseUrl = rep.baseUrl;
    log("파일 정보:", rep);

    const totalSize = await getContentLength(baseUrl);
    const filename = cleanFilename(title) + ".mp4";
    log(`저장 파일명 및 용량: ${filename} (${totalSize ? totalSize + " bytes" : "용량 정보 없음"})`);

    // 진행 계산기 생성
    const progress = new DownloadProgress(totalSize);
    progress.start();
    //window.chzzkDownloadProgress = progress; // 디버깅용

    GM_download({
      url: baseUrl,
      name: filename,
      onload: function () {
        const summary = progress.finalize();  // 여기서 평균 속도와 총 시간 계산
        if (summary) {
          const avgText = summary.avgSpeedText || "알 수 없음";
          const durText = summary.durationText || "알 수 없음";
          const sizeText = summary.totalText || "알 수 없음";

          ui.showProgress(`완료  ${sizeText}  평균속도 ${avgText}  ${durText}`);
          alert("다운로드 완료\n- 파일명: " + filename + "\n- 총 용량: " + sizeText + "\n- 걸린 시간: " + durText + "\n- 평균 속도: " + avgText);
          log(`다운로드 완료 요약: size = ${sizeText}, duration = ${durText}, avg = ${avgText}`);
        }
        ui.setDownloading(false);
      },
      onerror: function (err) {
        console.error(err);
        alert("다운로드 중 오류가 발생했습니다.");
        ui.setDownloading(false);
        log("다운로드 오류:", err);
      },
      onprogress: function (e) {
        const info = progress.update(e.loaded);
        ui.showProgressDetail(info);
       //log(`진행률: ${percent.toFixed(2)}%(${e.loaded}/${(e.total || totalSize)})`);
      },
    });
  } catch (e) {
    console.error(e);
    alert("VOD 정보를 가져오거나 다운로드하는 중 오류가 발생했습니다.");
    log("예외 발생:", e);
  } finally {
    // 치명적 예외 케이스 대비용 안전장치
    setTimeout(() => {
      if (window.chzzkDownloadUI && !window.chzzkDownloadUI.isDownloading) {
        window.chzzkDownloadUI.setDownloading(false);
      }
    }, 1000);
  }
  //end of fetchVodInfoAndDownload


  // DASH manifest에서 BaseURL 추출
  async function getRepFromManifest(manifestUrl) {
    log("DASH manifest 요청:", manifestUrl);

    const xmlText = await gmGetText(manifestUrl, {
      Accept: "application/dash+xml",
    });
    //log("DASH xml:", xmlText);

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    //log("DASH doc:", doc);

    const candidates = [];
    const reps = Array.from(doc.getElementsByTagName("Representation"));
    for (const rep of reps) {
      const mime = rep.getAttribute("mimeType") || "";
      const baseUrlElem = rep.getElementsByTagName("BaseURL")[0];
      const baseUrl = baseUrlElem?.textContent.trim();
      if (!mime.startsWith("video/mp4") || !baseUrlElem || baseUrl?.includes('/hls/')) continue;

      const bwStr = rep.getAttribute("bandwidth");
      const bandwidth = bwStr ? parseInt(bwStr, 10) : 0;
      candidates.push({rep, baseUrl, bandwidth});
    }
    //log("candidates from DASH MPD:", candidates);

    // bandwidth가 가장 높은 Representation 선택
    candidates.sort((a, b) => b.bandwidth - a.bandwidth);
    const best = candidates[0];

    if (!best.baseUrl) throw new Error("DASH manifest에서 BaseURL을 찾을 수 없습니다.");
    return best;
  }

  // HEAD 요청으로 Content-Length 얻기(@connect * 필요)
  function getContentLength(url) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: "HEAD",
        url: url,
        onload: function (res) {
          const len = res.responseHeaders.match(/content-length:\s*(\d+)/i);
          if (len) {
            resolve(parseInt(len[1], 10));
          } else {
            resolve(null);
          }
        },
        onerror: function () {
          resolve(null);
        }
      });
    });
  }

  // 파일 이름 클린업
  function cleanFilename(filename) {
    // / \ ? % * : | " < > 를 언더스코어로 치환
    const pattern = /[\/\\?%*:|"<>]/g;
    const cleaned = filename.replace(pattern, "_").trim();
    return cleaned || "chzzk_video";
  }
}


// 콘솔 로그 헬퍼
function log(msg, ...rest) {
  console.log("[CHZZK-DL]", msg, ...rest);
}

// GM_xmlhttpRequest 래퍼 (텍스트 또는 JSON 응답)
function gmGetText(url, headers = {}, type = 'text') {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "GET",
      url,
      headers,
      onload: function (res) {
        const responseText = res.responseText;
        if (type === 'json') {
          try {
            const data = JSON.parse(responseText);
            resolve(data);
          } catch (e) {
            reject(e);
          }
        } else {
          resolve(responseText);
        }
      },
      onerror: function (err) {
        reject(err);
      },
    });
  });
}

// 바이트 수를 kB, MB, GB 단위로 포맷
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes < 0) return "0 B";

  const k = 1024;
  const units = ["B", "kB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  const nf = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

  return nf.format(value) + " " + units[i];
}

// 초를 1분 23초, 2시간 3분 이런 식으로 포맷
function formatDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return null;

  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0)      return `${h}시간 ${m}분`;
  else if (m > 0) return `${m}분 ${s}초`;
  else            return `${s}초`;
}


// entry point
if (!window.chzzkDownloadUI) {
  window.chzzkDownloadUI = new DownloadUI(); // 디버깅용
  window.chzzkDownloadUI.onClickHandler = fetchVodInfoAndDownload;
  log("CHZZK VOD Downloader 초기화 완료");
}