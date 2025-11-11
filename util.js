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
