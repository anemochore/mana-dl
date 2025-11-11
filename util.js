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
        //범위 선택
        let [value1, value2] = [parseInt(input1.value), parseInt(input2.value)];
        if (value1 > value2) {
          [input1.value, input2.value] = [input2.value, input1.value];
          [value1, value2] = [value2, value1];
        }
        items.forEach(item => item.checked = false);
        items.toReversed().slice(value1-1, value2).forEach(item => item.checked = true);
        checkedCount = items.filter(i => i.checked).length;
      }
      else {
        //목록에서 선택
        const [value1, value2] = [parseInt(input1.value), parseInt(input2.value)];

        //배열 trim
        //console.debug('items',items.map(el => el.nextSibling.textContent));
        const start = items.findIndex(v => v.checked);
        const end = items.length - items.toReversed().findIndex(v => v.checked);
        const trimmed = items.slice(start, end);
        //console.debug('trimmed',trimmed.map(el => el.nextSibling.textContent));
        if (trimmed.some(v => !v.checked)) {
          //중간이 비어 있다면 범위 선택 X
          input1.disabled = input2.disabled = true;
        }
        else {
          input1.disabled = input2.disabled = false;
          input1.value = parseInt(trimmed.at(-1).nextSibling.textContent);
          input2.value = parseInt(trimmed[0].nextSibling.textContent);
        }
      }

      //indeterminate visual
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

class FadingAlert {
  constructor(backgroundColor = 'pink') {
    this.div = document.createElement('div');
    this.div.id = 'alertBoxDiv';
    document.body.appendChild(this.div);

    const s = this.div.style;
    s.position = 'fixed';
    s.top = '40%'; s.left = '45%';
    s.width = '240px'; s.height = 'auto';
    s.textAlign = 'center'; s.padding = '2px';
    s.color = 'Black'; s.backgroundColor = backgroundColor;
    s.border = 0; s.overflow = 'auto';

    this.log_ = (func = console.log, ...txt) => {
      if (this.interval) {
        this.interval = null;
        clearInterval(this.interval);

        const spinnerEl = this.div.querySelector('span');
        if (spinnerEl) spinnerEl.textContent = '';
      }

      if (txt.length == 0) {
        this.div.style.opacity = 0;
        this.div.style.transition = 'opacity 5s ease-in';
      }
      else {
        this.div.style.transition = '';
        this.div.style.opacity = 1;
        this.div.textContent = txt.join(' ');
        func(...txt);
      }
    };
    this.log = (...txt) => this.log_(console.log, ...txt);
    this.show = (...txt) => this.log_(() => { }, ...txt);

    this.spin = (...txt) => {
      this.log_(console.log, ...txt);

      let spinnerEl = this.div.querySelector('span');
      if (!spinnerEl) {
        spinnerEl = document.createElement('span');
        spinnerEl.style.fontFamily = "'Courier New', monospace";
        spinnerEl.style.marginLeft = '8px';
        this.div.appendChild(spinnerEl);
      }

      spinnerEl.textContent = '|';
      const spinner = ['|', '/', '-', '\\'];
      let i = 0;

      this.interval = setInterval(() => {
        spinnerEl.textContent = spinner[i++ % spinner.length];
      }, 100);
    };

    this.log();
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
