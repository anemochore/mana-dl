function initSettingContainer(container, epNumber, main) {
  //add container for setting
  const setting = document.createElement('div');
  setting.id = 'setting';
  container.prepend(setting);

  //add select-all check button
  const selectAllLabel = document.createElement('label');
  const selectAll = document.createElement('input');
  selectAll.type = 'checkbox';
  selectAll.id = 'select-all';
  selectAll.checked = true;
  selectAllLabel.appendChild(selectAll);
  selectAllLabel.appendChild(document.createTextNode('전체 선택'));
  setting.append(selectAllLabel);

  //add range check button
  let sepSpan = document.createElement('span');
  sepSpan.textContent = '또는';
  setting.append(sepSpan);

  const label1 = document.createElement('label');
  const label2 = document.createElement('label');
  label1.textContent = '시작';
  label2.textContent = '끝';
  const input1 = document.createElement('input');
  const input2 = document.createElement('input');
  input1.type = input2.type = 'number';
  input1.id = 'input1';
  input2.id = 'input2';
  input1.min = input2.min = input1.value = 1;
  input1.max = input2.max = input2.value = epNumber;
  label1.appendChild(input1);
  label2.appendChild(input2);

  sepSpan = document.createElement('span');
  sepSpan.classList.add('marginRight');
  sepSpan.textContent = '~';
  setting.append(label1, sepSpan, label2);

  //add d/l start button
  const dlStart = document.createElement('button');
  dlStart.id = 'dl-start';
  dlStart.textContent = '다운로드 시작';
  dlStart.addEventListener('click', main);
  setting.append(dlStart);

  //add lisener to container (for indeterminate visual)
  container.addEventListener('change', e => {
    const target = e.target;
    const selectAll = document.getElementById('select-all');
    const input1 = document.getElementById('input1');
    const input2 = document.getElementById('input2');
    const dlStart = document.getElementById('dl-start');

    const items = [...container.querySelectorAll('.fy-check')];
    let checkedCount;
    if (target == selectAll) {
      //전체 선택
      items.forEach(item => item.checked = selectAll.checked);
      checkedCount = items.filter(i => i.checked).length;
      if (selectAll.checked) {
        input1.disabled = input2.disabled = false;
        input1.value = input1.min;
        input2.value = input2.max;
      }
      else {
        input1.disabled = input2.disabled = true;
      }
    }
    else if (target == input1 || target == input2 || target.classList.contains('fy-check')) {
      if (target == input1 || target == input2) {
        //범위 입력 시
        let [value1, value2] = [parseInt(input1.value), parseInt(input2.value)];
        if (value1 > value2) {
          [input1.value, input2.value] = [input2.value, input1.value];
          [value1, value2] = [value2, value1];
        }
        items.forEach(item => item.checked = false);
        items.toReversed().slice(value1-1, value2).forEach(item => item.checked = true);
      }
      else {
        //목록의 체크박스 클릭 시
        const [value1, value2] = [parseInt(input1.value), parseInt(input2.value)];

        //배열 trim
        const start = items.findIndex(v => v.checked);
        const end = items.length - items.toReversed().findIndex(v => v.checked);
        const trimmed = items.slice(start, end);
        if (!trimmed.every(v => v.checked)) {
          //중간이 비어 있다면 범위 선택 X
          input1.disabled = input2.disabled = true;
        }
        else {
          input1.disabled = input2.disabled = false;
          const value1 = parseInt(trimmed.at(-1).nextSibling.textContent);
          const value2 = parseInt(trimmed[0].nextSibling.textContent);

          //일일툰은 목록에 회차 텍스트가 없음
          if (isNaN(value1)) input1.value = start + 1
          else input1.value = value1;
          if (isNaN(value2)) input2.value = end;
          else input2.value = value2;
          //console.debug('start, end, input1.value, input2.value, trimmed', start, end, input1.value, input2.value, trimmed);
        }
      }

      //indeterminate visual
      checkedCount = items.filter(i => i.checked).length;
      //console.debug('checkedCount, items.length', checkedCount, items.length);
      if (checkedCount == 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        dlStart.disabled = true;
      }
      else if (checkedCount == items.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
        dlStart.disabled = false;
      }
      else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
        dlStart.disabled = false;
      }
    }
  });

  //다운로드 시작 버튼 반환
  return dlStart;
}

function zipAndDownload(zip, fileName, console2 = console) {
  zip.generateAsync({type: "blob", compression: "STORE"}, metadata => {
    let msg = 'zipping: ' + metadata.percent.toFixed(2) + '%';
    if (metadata.currentFile) msg = msg + ' (' + metadata.currentFile + ')';
    console2.show(msg);
  })
  .then(blob => {
    const fileLink = document.createElement('a');
    fileLink.href = window.URL.createObjectURL(blob);
    fileLink.download = `${fileName}.zip`;
    fileLink.click();
    console2.log('plz wait until d/l starts (if file is big, it takes some time)' );
    console2.log();
  })
  .catch(error => console2.log('cannot d/l a zip file due to:', error));
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

class FadingAlert {
  constructor(styleObj = {}) {
    this.div = document.getElementById('alertBoxDiv');

    if (!this.div) {
      this.div = document.createElement('div');
      this.div.id = 'alertBoxDiv';

      this.div.style.opacity = 0;
      this.div.style.pointerEvents = 'none';
      this.div.style.transition = 'none';

      document.body.appendChild(this.div);
    }

    this.textEl = this.div.querySelector('.fading-alert-text');
    if (!this.textEl) {
      this.textEl = document.createElement('span');
      this.textEl.className = 'fading-alert-text';
      this.div.appendChild(this.textEl);
    }

    const s = this.div.style;
    Object.assign(s, styleObj);

    s.position ||= 'fixed';
    s.top ||= '25%';
    if (!s.left) {
      s.left = '50%';
      s.transform ||= 'translateX(-50%)';
    }
    s.width ||= '250px';
    s.textAlign ||= 'center';
    s.padding ||= '2px';
    s.color ||= 'black';
    s.backgroundColor ||= 'pink';
    s.border ||= '0';
    s.overflow = 'hidden';
    s.wordBreak ||= 'break-word';
    s.whiteSpace ||= 'pre-line';

    this.div.addEventListener('click', () => {
      this.fadeOut();
    });
  }

  log_(func = console.log, ...txt) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.spinnerEl) {
      this.spinnerEl.textContent = '';
    }

    if (txt.length === 0 || !txt[0]) {
      if (this.div.style.opacity == 1) this.fadeOut();
    }
    else {
      this.textEl.textContent = txt.join(txt[0].endsWith('\n') ? '' : ' ');
      this.div.style.transition = '';
      this.div.style.opacity = 1;
      this.div.style.pointerEvents = 'auto';
      func(...txt);
    }
  }

  log(...txt) {
    this.log_(console.log, ...txt);
  }

  add(...txt) {
    if (this?.spinnerEl.textContent) this.log_(console.log, ...txt);  //ignore text of previous spin()
    else this.log_(console.log, this.textEl.textContent + '\n\n', ...txt);
  }

  get() {
    return this.textEl.textContent;
  }

  show(...txt) {
    this.log_(() => {},    ...txt);
  }

  spin(...txt) {
    this.log_(console.log, ...txt);

    this.spinnerEl ||= this.div.querySelector('.fading-alert-spinner');
    if (!this.spinnerEl) {
      this.spinnerEl = document.createElement('span');
      this.spinnerEl.className = 'fading-alert-spinner';
      this.spinnerEl.style.fontFamily = "'Courier New', monospace";
      this.spinnerEl.style.marginLeft = '8px';
      this.div.appendChild(this.spinnerEl);
    }

    const spinner = ['|', '/', '-', '\\'];
    let i = 0;

    this.spinnerEl.textContent = spinner[0];

    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      this.spinnerEl.textContent = spinner[i++ % spinner.length];
    }, 100);
  }

  fadeOut() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.spinnerEl) {
      this.spinnerEl.textContent = '';
    }

    this.div.style.transition = '';
    this.div.style.opacity = 1;

    void this.div.offsetWidth;  //강제 reflow

    this.div.style.transition = 'opacity 3s ease-in';
    this.div.style.opacity = 0;
    this.div.style.pointerEvents = 'none';

    const onEnd = (e) => {
      this.textEl.textContent = '';
      this.div.style.transition = '';
    };

    this.div.addEventListener('transitionend', onEnd, { once: true });
  }
}

//globalThis.FadingAlert = FadingAlert;
