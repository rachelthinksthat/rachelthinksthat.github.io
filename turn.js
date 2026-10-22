/* Ink, paper, people: page turns between pages, the live ink on the home cover, and the motion and sound switches. */
(function () {
  var reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  function motionOn() { return !reduceMQ.matches || document.documentElement.classList.contains('motion-on'); }
  if (store.get('rj-motion') === 'on') document.documentElement.classList.add('motion-on');

  /* ---- controls ---- */
  var soundOn = store.get('rj-sound') === 'on';
  var controls = document.createElement('div'); controls.className = 'rj-controls';
  if (reduceMQ.matches) {
    var mb = document.createElement('button'); mb.type = 'button';
    function syncMotion() { var on = document.documentElement.classList.contains('motion-on'); mb.setAttribute('aria-pressed', on); mb.textContent = on ? 'Motion on' : 'Turn motion on'; }
    mb.addEventListener('click', function () { document.documentElement.classList.toggle('motion-on'); store.set('rj-motion', document.documentElement.classList.contains('motion-on') ? 'on' : 'off'); syncMotion(); initHero(); });
    syncMotion(); controls.appendChild(mb);
  }
  var sb = document.createElement('button'); sb.type = 'button';
  function syncSound() { sb.setAttribute('aria-pressed', soundOn); sb.textContent = soundOn ? 'Sound on' : 'Sound off'; }
  sb.addEventListener('click', function () { soundOn = !soundOn; store.set('rj-sound', soundOn ? 'on' : 'off'); syncSound(); if (soundOn) { var a = audio(); playTurn(); setTimeout(function () { if (soundOn && a && a.state !== 'running') sb.textContent = 'Sound blocked'; }, 1200); } });
  syncSound(); controls.appendChild(sb);
  document.body.appendChild(controls);

  /* ---- page-turn sound, made in code ---- */
  var actx = null;
  function audio() { if (!actx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; actx = new AC(); loadKeys(actx); } if (actx.state === 'suspended') actx.resume(); return actx; }
  /* recorded typewriter keys: 8 strikes cut from a real typewriter recording, each in its own 0.2s slot of one small file */
  var keyBuf = null, keyLoading = false, keyFailed = false, lastKey = -1, bellBuf = null;
  function loadKeys(a) {
    if (keyBuf || keyLoading || !a || !window.fetch) { if (!window.fetch) keyFailed = true; return; } keyLoading = true;
    fetch('/audio/typewriter-keys.mp3').then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function (b) { return new Promise(function (ok, no) { a.decodeAudioData(b, ok, no); }); })
      .then(function (buf) { keyBuf = buf; }).catch(function () { keyFailed = true; });
    /* the bell and carriage return, from a second typewriter recording */
    fetch('/audio/typewriter-bell.mp3').then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function (b) { return new Promise(function (ok, no) { a.decodeAudioData(b, ok, no); }); })
      .then(function (buf) { bellBuf = buf; }).catch(function () {});
  }
  if (soundOn) audio();  /* start loading the keys before the headline types */
  function noise(a, dur) { var b = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  function burst(a, t, dur, type, f0, f1, peak) {
    var s = a.createBufferSource(); s.buffer = noise(a, dur);
    var f = a.createBiquadFilter(); f.type = type; f.Q.value = 0.9; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    var g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.06, dur * 0.25)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(a.destination); s.start(t); s.stop(t + dur + 0.02);
  }
  /* typewriter key: a mechanical strike made in code, one per letter so it keeps exact pace with the typing.
     thump of the key bottoming out + the typebar hitting the platen (filtered noise) + a faint ring, then a softer release */
  function thump(a, t, f, dur, peak) {
    var o = a.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.45, t + dur);
    var g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function playKey(ch) {
    if (!soundOn) return; var a = audio(); if (!a) return;
    if (keyBuf) {
      var n = Math.round(keyBuf.duration / 0.2), k = Math.floor(Math.random() * n), sp = ch === ' ';
      if (k === lastKey) k = (k + 1) % n; lastKey = k;
      var src = a.createBufferSource(); src.buffer = keyBuf; src.playbackRate.value = sp ? 0.8 : 0.96 + Math.random() * 0.08;
      var kg = a.createGain(); kg.gain.value = (sp ? 0.45 : 0.6) * (0.85 + Math.random() * 0.3);
      src.connect(kg); kg.connect(a.destination); src.start(a.currentTime, k * 0.2, 0.19);
      return;
    }
    if (keyFailed) synthKey(a, ch);
  }
  function synthKey(a, ch) {
    var t = a.currentTime, space = ch === ' ', v = 0.85 + Math.random() * 0.3;
    if (space) {
      thump(a, t, 95, 0.09, 0.5 * v); burst(a, t, 0.06, 'lowpass', 1400, 500, 0.45 * v);
      burst(a, t + 0.07, 0.03, 'lowpass', 1000, 400, 0.12);
      return;
    }
    thump(a, t, 150 + Math.random() * 40, 0.05, 0.42 * v);
    burst(a, t, 0.028, 'bandpass', 1900 + Math.random() * 600, 900, 0.7 * v);
    var r = a.createOscillator(); r.type = 'sine'; r.frequency.setValueAtTime(3200 + Math.random() * 900, t);
    var rg = a.createGain(); rg.gain.setValueAtTime(0.0001, t); rg.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.002); rg.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    r.connect(rg); rg.connect(a.destination); r.start(t); r.stop(t + 0.06);
    burst(a, t + 0.06, 0.025, 'lowpass', 1200, 500, 0.14);
  }
  /* the bell when the line is done */
  function playBell() {
    if (!soundOn) return; var a = audio(); if (!a) return; var t = a.currentTime + 0.08;
    if (bellBuf) { var bs = a.createBufferSource(); bs.buffer = bellBuf; var bg = a.createGain(); bg.gain.value = 0.55; bs.connect(bg); bg.connect(a.destination); bs.start(a.currentTime + 0.03); return; }
    [2480, 3760, 5020].forEach(function (f, i) {
      var o = a.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t);
      var g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime([0.16, 0.07, 0.03][i], t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 - i * 0.15);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 1);
    });
    burst(a, t, 0.02, 'highpass', 4000, 6000, 0.12);
  }
  function playTurn() { if (!soundOn) return; var a = audio(); if (!a) return; var t = a.currentTime; burst(a, t + 0.05, 0.62, 'bandpass', 700, 3600, 0.2); burst(a, t + 0.82, 0.14, 'lowpass', 900, 500, 0.16); }

  /* ---- grain texture for the cover ---- */
  try {
    var g = document.createElement('canvas'); g.width = g.height = 180; var gc = g.getContext('2d'), img = gc.createImageData(180, 180);
    for (var i = 0; i < img.data.length; i += 4) { var v = 190 + Math.random() * 65; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    gc.putImageData(img, 0, 0); document.documentElement.style.setProperty('--grain', 'url(' + g.toDataURL() + ')');
  } catch (e) {}

  /* ---- page turns ---- */
  var busy = false;
  function sameSitePage(a) {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return false;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || /^[a-z]+:/i.test(href) && !/^https?:/i.test(href)) return false;
    var u; try { u = new URL(href, location.href); } catch (e) { return false; }
    if (u.origin !== location.origin) return false;
    if (!/\.html?$/i.test(u.pathname) && !/\/$/.test(u.pathname)) return false;
    return u;
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a'); var u = sameSitePage(a); if (!u) return;
    if (u.pathname === location.pathname) { if (u.hash) return; e.preventDefault(); scrollTo({ top: 0, behavior: motionOn() ? 'smooth' : 'auto' }); return; }
    e.preventDefault(); go(u.href, true, !/index\.html$|\/$/.test(u.pathname));
  });
  addEventListener('popstate', function () { go(location.href, false, false); });

  function go(href, push, forward) {
    if (busy) return; busy = true;
    fetch(href, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var target = doc.querySelector('main'); if (!target) throw new Error('no main');
      if (push) { try { history.pushState(null, '', href); } catch (e) {} }
      if (!motionOn()) { swap(doc); busy = false; return; }
      var hash = href.indexOf('#') > -1 ? href.slice(href.indexOf('#')) : '';
      playTurn();
      document.body.classList.add('turning');
      var peel = buildPeel(); peeling = true;
      if (forward) { swap(doc, hash); } else { setTimeout(function () { swap(doc, hash); }, 60); }
      runPeel(peel, forward, function () { peel.layer.remove(); document.body.classList.remove('turning'); busy = false; peeling = false; if (twStart) twStart(); });
    }).catch(function () { busy = false; location.href = href; });
  }

  function snapshotBody() {
    var snap = document.createElement('div'); snap.className = 'snap';
    var kids = Array.prototype.slice.call(document.body.children);
    kids.forEach(function (k) {
      if (k.tagName === 'SCRIPT' || k.tagName === 'DIALOG' || k.classList.contains('rj-controls') || k.classList.contains('page-peel')) return;
      var c = k.cloneNode(true);
      c.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
      c.querySelectorAll('.rise, .tw-fade, .tw-wait').forEach(function (n) { n.classList.remove('rise', 'tw-fade', 'tw-wait'); });
      c.querySelectorAll('.tw-cursor').forEach(function (n) { n.remove(); });
      c.querySelectorAll('video').forEach(function (v, idx) {
        var live = k.querySelectorAll('video')[idx];
        try { var cv = document.createElement('canvas'); cv.width = live.videoWidth || 960; cv.height = live.videoHeight || 540; cv.getContext('2d').drawImage(live, 0, 0, cv.width, cv.height); cv.setAttribute('style', getComputedStyle(live).position === 'absolute' ? 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover' : 'width:100%;height:auto;display:block'); v.replaceWith(cv); }
        catch (e) { var im = document.createElement('img'); im.src = live.getAttribute('poster') || ''; im.alt = ''; im.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover'); v.replaceWith(im); }
      });
      c.querySelectorAll('canvas').forEach(function (cnv, idx) {
        var live = k.querySelectorAll('canvas')[idx];
        try { var cv = document.createElement('canvas'); cv.width = live.width; cv.height = live.height; cv.getContext('2d').drawImage(live, 0, 0); cv.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%'); cnv.replaceWith(cv); } catch (e) { cnv.remove(); }
      });
      if (c.classList.contains('top')) { c.style.position = 'relative'; }
      snap.appendChild(c);
    });
    snap.style.top = (-scrollY) + 'px';
    snap.style.paddingInline = getComputedStyle(document.body).paddingInline;
    return snap;
  }
  /* a Kindle-style peel: the page lifts from its right edge and curls away to the left; going back it unpeels from the left */
  function buildPeel() {
    var layer = document.createElement('div'); layer.className = 'page-peel';
    var page = document.createElement('div'); page.className = 'peel-page'; page.appendChild(snapshotBody());
    var shadow = document.createElement('div'); shadow.className = 'peel-shadow';
    var curl = document.createElement('div'); curl.className = 'peel-curl';
    layer.appendChild(shadow); layer.appendChild(page); layer.appendChild(curl);
    document.body.appendChild(layer);
    return { layer: layer, page: page, curl: curl, shadow: shadow };
  }
  function runPeel(peel, forward, done) {
    var W = innerWidth, H = innerHeight, diag = W;
    var dx = -1, dy = -0.06;                            /* from the right edge toward the left, with a slight lean */
    var dn = Math.hypot(dx, dy); dx /= dn; dy /= dn;
    var curlW = Math.max(80, Math.min(170, W * 0.1));
    var total = W + H * Math.abs(dy) + curlW * 1.2, dur = 760, t0 = performance.now();
    var theta = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    peel.curl.style.width = (Math.hypot(W, H) * 2.2) + 'px'; peel.curl.style.height = curlW + 'px';
    peel.shadow.style.width = (Math.hypot(W, H) * 2.2) + 'px'; peel.shadow.style.height = (curlW * 1.6) + 'px';
    function clipPoly(p) {
      var pts = [[0, 0], [W, 0], [W, H], [0, H]], out = [];
      function side(q) { return (q[0] - W) * dx + (q[1] - H) * dy - p; }   /* >= 0 means still flat on the page */
      for (var i = 0; i < 4; i++) {
        var a = pts[i], b = pts[(i + 1) % 4], sa = side(a), sb = side(b);
        if (sa >= 0) out.push(a);
        if ((sa >= 0) !== (sb >= 0)) { var t = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      return out.length ? 'polygon(' + out.map(function (q) { return q[0].toFixed(1) + 'px ' + q[1].toFixed(1) + 'px'; }).join(',') + ')' : 'polygon(0 0,0 0,0 0)';
    }
    function place(el, p, back) {
      var lx = W + dx * p, ly = H + dy * p;   /* a point on the fold line */
      el.style.transform = 'translate(' + lx + 'px,' + ly + 'px) rotate(' + theta + 'deg) translate(-50%,' + (back ? '-100%' : '0') + ')';
    }
    function frame(now) {
      var k = Math.min(1, (now - t0) / dur);
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      var p = (forward ? e : 1 - e) * total;
      peel.page.style.clipPath = clipPoly(p);
      place(peel.curl, p, true);
      place(peel.shadow, p, false);
      peel.curl.style.opacity = p < 4 || p > total - 4 ? 0 : 1;
      peel.shadow.style.opacity = peel.curl.style.opacity;
      if (k < 1) requestAnimationFrame(frame); else done();
    }
    if (!forward) { peel.page.style.clipPath = clipPoly(total); }
    requestAnimationFrame(frame);
  }

  function swap(doc, hash) {
    stopHero(); stopTypewriter(); document.documentElement.classList.remove('drawing', 'rippled');
    document.title = doc.title;
    var oldMain = document.querySelector('main'), newMain = document.importNode(doc.querySelector('main'), true);
    oldMain.replaceWith(newMain);
    var oldNav = document.querySelector('header.top'), newNav = doc.querySelector('header.top');
    if (oldNav && newNav) oldNav.replaceWith(document.importNode(newNav, true));
    var oldDlg = document.querySelector('dialog'); if (oldDlg) oldDlg.remove();
    var newDlg = doc.querySelector('dialog'); if (newDlg) document.body.insertBefore(document.importNode(newDlg, true), controls);
    doc.querySelectorAll('script').forEach(function (s) {
      if (s.src) return;
      var n = document.createElement('script'); n.textContent = s.textContent; try { document.body.appendChild(n); n.remove(); } catch (e) {}
    });
    if (hash) { var t = document.querySelector(hash); if (t) t.scrollIntoView(); else scrollTo(0, 0); } else scrollTo(0, 0);
    initHero(); initTypewriter();
  }



  var drawingBusy = false;

  /* ---- typewriter reveal: headline, then subheading, once per visit ---- */
  var twTimer = 0, twSkip = null, twStart = null, peeling = false;
  function stopTypewriter() { if (twTimer) clearTimeout(twTimer); twTimer = 0; twStart = null; if (twSkip) { document.removeEventListener('click', twSkip); twSkip = null; } }
  function initTypewriter() {
    stopTypewriter();
    var head = document.querySelector('.hero, .pagehead'); if (!head) return;
    var h1 = head.querySelector('h1'), lede = head.querySelector('.lede'), after = head.querySelectorAll('.jump');
    if (!h1) return;
    var key = 'rj-typed:' + location.pathname, seen = false, home = head.classList.contains('hero');
    try { var v = sessionStorage.getItem(key); seen = home ? (v && Date.now() - Number(v) < 20 * 60 * 1000) : !!v; } catch (e) {}
    if (seen || !motionOn()) return;
    try { sessionStorage.setItem(key, home ? String(Date.now()) : '1'); } catch (e) {}
    var intro = head.querySelector('.hero > .stack > p:not(.label):not(.lede):not(.hint)');
    after = [lede, intro].filter(Boolean).concat(Array.prototype.slice.call(after)).concat(Array.prototype.slice.call(document.querySelectorAll('main [data-reveal]')));
    var parts = [h1].map(function (el) {
      var text = el.textContent; el.textContent = '';
      var sr = document.createElement('span'); sr.className = 'tw-sr'; sr.textContent = text;
      var vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true');
      el.appendChild(sr); el.appendChild(vis);
      return { el: el, text: text, vis: vis };
    });
    after.forEach(function (n) { n.classList.add('tw-wait'); });
    var cursor = document.createElement('span'); cursor.className = 'tw-cursor'; cursor.setAttribute('aria-hidden', 'true');
    var pi = 0, ci = 0, kw = 0;
    function finish() {
      stopTypewriter();
      parts.forEach(function (p) { p.vis.textContent = p.text; });
      cursor.remove();
      after.forEach(function (n, i) { n.classList.remove('tw-wait'); n.style.animationDelay = (i * 260) + 'ms'; n.classList.add('tw-fade'); });
    }
    function tick() {
      var p = parts[pi];
      if (!p) { finish(); return; }
      if (pi === 0 && ci === 0 && soundOn && !keyBuf && !keyFailed && kw < 16) { kw++; twTimer = setTimeout(tick, 50); return; }  /* give the key sounds up to 0.8s to load */
      if (ci === 0) p.el.appendChild(cursor);
      ci++; p.vis.textContent = p.text.slice(0, ci); playKey(p.text.charAt(ci - 1));
      var ch = p.text.charAt(ci - 1), base = pi === 0 ? 62 : 14, pause = /[.,;:!?]/.test(ch) ? 160 : 0;
      if (ci >= p.text.length) { pi++; ci = 0; pause = 220; playBell(); }
      twTimer = setTimeout(tick, base + pause);
    }
    twSkip = function () { finish(); };
    twStart = function () { twStart = null; if (home) { document.documentElement.classList.remove('drawing', 'rippled'); void document.body.offsetWidth; document.documentElement.classList.add('drawing'); } setTimeout(function () { if (twSkip) document.addEventListener('click', twSkip); }, 0); twTimer = setTimeout(tick, 250); };
    if (!peeling) twStart();
  }

  /* ---- home cover: paint film plus live ink the cursor stirs ---- */
  var heroState = null;
  function stopHero() { if (heroState) { heroState.stop(); heroState = null; } }
  function initHero() {
    var hero = document.querySelector('.hero'), bg = hero && hero.querySelector('.inkbg'); if (!bg) return;
    var film = bg.querySelector('video');
    if (film) { if (motionOn()) film.play().catch(function () {}); else film.pause(); }
    if (heroState || !motionOn()) return;
    var canvas = bg.querySelector('canvas'); if (!canvas) return;
    var gl; try { gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true }); } catch (e) {}
    var useGL = !!(gl && gl.getExtension('EXT_color_buffer_float'));
    document.documentElement.classList.toggle('lowfx', !useGL);
    if (!useGL && film && !bg.querySelector('img.still')) { film.pause(); var still = document.createElement('img'); still.className = 'still'; still.alt = ''; still.src = film.getAttribute('poster') || ''; bg.insertBefore(still, film); }

    var cfg = { SIM: 128, DYE: innerWidth < 760 ? 512 : 900, DENS: 0.55, VEL: 0.25, PRESSURE: 0.8, ITER: 18, CURL: 26, RADIUS: 0.32, FORCE: 5600 };
    var VS = '#version 300 es\nprecision highp float;\nlayout(location=0) in vec2 aPos;\nuniform vec2 texelSize;\nout vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;\nvoid main(){ vUv=aPos*.5+.5; vL=vUv-vec2(texelSize.x,0.); vR=vUv+vec2(texelSize.x,0.); vT=vUv+vec2(0.,texelSize.y); vB=vUv-vec2(0.,texelSize.y); gl_Position=vec4(aPos,0.,1.); }';
    var FH = '#version 300 es\nprecision highp float;\nprecision highp sampler2D;\nin vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;\nout vec4 o;\n';
    var FS = {
      splat: 'uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;\nvoid main(){ vec2 p=vUv-point; p.x*=aspectRatio; vec3 s=exp(-dot(p,p)/radius)*color; o=vec4(texture(uTarget,vUv).xyz+s,1.); }',
      advect: 'uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texelSize; uniform float dt; uniform float dissipation;\nvoid main(){ vec2 c=vUv-dt*texture(uVelocity,vUv).xy*texelSize; o=texture(uSource,c)/(1.+dissipation*dt); }',
      divergence: 'uniform sampler2D uVelocity;\nvoid main(){ float L=texture(uVelocity,vL).x; float R=texture(uVelocity,vR).x; float T=texture(uVelocity,vT).y; float B=texture(uVelocity,vB).y; vec2 C=texture(uVelocity,vUv).xy;\nif(vL.x<0.)L=-C.x; if(vR.x>1.)R=-C.x; if(vT.y>1.)T=-C.y; if(vB.y<0.)B=-C.y; o=vec4(.5*(R-L+T-B),0.,0.,1.); }',
      curl: 'uniform sampler2D uVelocity;\nvoid main(){ float L=texture(uVelocity,vL).y; float R=texture(uVelocity,vR).y; float T=texture(uVelocity,vT).x; float B=texture(uVelocity,vB).x; o=vec4(.5*(R-L-T+B),0.,0.,1.); }',
      vorticity: 'uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;\nvoid main(){ float L=texture(uCurl,vL).x; float R=texture(uCurl,vR).x; float T=texture(uCurl,vT).x; float B=texture(uCurl,vB).x; float C=texture(uCurl,vUv).x;\nvec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); f/=length(f)+.0001; f*=curl*C; f.y*=-1.; vec2 v=texture(uVelocity,vUv).xy+f*dt; o=vec4(clamp(v,-1000.,1000.),0.,1.); }',
      pressure: 'uniform sampler2D uPressure; uniform sampler2D uDivergence;\nvoid main(){ float L=texture(uPressure,vL).x; float R=texture(uPressure,vR).x; float T=texture(uPressure,vT).x; float B=texture(uPressure,vB).x; float d=texture(uDivergence,vUv).x; o=vec4((L+R+B+T-d)*.25,0.,0.,1.); }',
      gradient: 'uniform sampler2D uPressure; uniform sampler2D uVelocity;\nvoid main(){ float L=texture(uPressure,vL).x; float R=texture(uPressure,vR).x; float T=texture(uPressure,vT).x; float B=texture(uPressure,vB).x; vec2 v=texture(uVelocity,vUv).xy-vec2(R-L,T-B); o=vec4(v,0.,1.); }',
      clear: 'uniform sampler2D uTexture; uniform float value;\nvoid main(){ o=value*texture(uTexture,vUv); }',
      display: 'uniform sampler2D uTexture; uniform vec2 texelSize;\nvoid main(){ vec3 c=texture(uTexture,vUv).rgb;\nfloat dx=length(texture(uTexture,vR).rgb)-length(texture(uTexture,vL).rgb); float dy=length(texture(uTexture,vT).rgb)-length(texture(uTexture,vB).rgb);\nvec3 n=normalize(vec3(dx,dy,length(texelSize))); float shade=clamp(dot(n,vec3(0.,0.,1.))+.72,.72,1.);\nfloat d=max(c.r,max(c.g,c.b)); float a=(1.-exp(-d*2.4))*.88; vec3 hue=c/(d+.0001); o=vec4(hue*shade*a,a); }'
    };
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    var P = {};
    if (useGL) try {
      var vs = sh(gl.VERTEX_SHADER, VS);
      Object.keys(FS).forEach(function (k) {
        var p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FH + FS[k])); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for (var i = 0; i < n; i++) { var name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
        P[k] = { p: p, u: u };
      });
    } catch (e) { return; }
    if (useGL) {
    var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);
    }
    function blit(t) { if (t) { gl.viewport(0, 0, t.w, t.h); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); } else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); } gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0); }
    function target(w, h, filter) {
      gl.activeTexture(gl.TEXTURE0); var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      var fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex: tex, fb: fb, w: w, h: h, attach: function (id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; } };
    }
    function pair(w, h, filter) { var a = target(w, h, filter), b = target(w, h, filter); return { w: w, h: h, tx: 1 / w, ty: 1 / h, get read() { return a; }, get write() { return b; }, swap: function () { var t = a; a = b; b = t; } }; }
    function res(r) { var a = gl.drawingBufferWidth / gl.drawingBufferHeight; if (a < 1) a = 1 / a; var mx = Math.round(r * a), mn = Math.round(r); return gl.drawingBufferWidth > gl.drawingBufferHeight ? { w: mx, h: mn } : { w: mn, h: mx }; }
    var dye, vel, div, curlT, pres;
    function buffers() { var s = res(cfg.SIM), d = res(cfg.DYE); dye = pair(d.w, d.h, gl.LINEAR); vel = pair(s.w, s.h, gl.LINEAR); div = target(s.w, s.h, gl.NEAREST); curlT = target(s.w, s.h, gl.NEAREST); pres = pair(s.w, s.h, gl.NEAREST); }
    function sizeCanvas() { var dpr = Math.min(devicePixelRatio || 1, 1.5), w = Math.max(1, Math.floor(canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(canvas.clientHeight * dpr)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; } return false; }
    function use(k) { gl.useProgram(P[k].p); return P[k].u; }
    function splat(x, y, dx, dy, col) {
      var u = use('splat'), r = cfg.RADIUS / 100, ar = canvas.width / canvas.height; if (ar > 1) r *= ar;
      gl.uniform1i(u.uTarget, vel.read.attach(0)); gl.uniform1f(u.aspectRatio, ar); gl.uniform2f(u.point, x, y); gl.uniform3f(u.color, dx, dy, 0); gl.uniform1f(u.radius, r);
      blit(vel.write); vel.swap();
      gl.uniform1i(u.uTarget, dye.read.attach(0)); gl.uniform3f(u.color, col[0], col[1], col[2]); blit(dye.write); dye.swap();
    }
    function step(dt) {
      gl.disable(gl.BLEND);
      var u = use('curl'); gl.uniform2f(u.texelSize, vel.tx, vel.ty); gl.uniform1i(u.uVelocity, vel.read.attach(0)); blit(curlT);
      u = use('vorticity'); gl.uniform2f(u.texelSize, vel.tx, vel.ty); gl.uniform1i(u.uVelocity, vel.read.attach(0)); gl.uniform1i(u.uCurl, curlT.attach(1)); gl.uniform1f(u.curl, cfg.CURL); gl.uniform1f(u.dt, dt); blit(vel.write); vel.swap();
      u = use('divergence'); gl.uniform2f(u.texelSize, vel.tx, vel.ty); gl.uniform1i(u.uVelocity, vel.read.attach(0)); blit(div);
      u = use('clear'); gl.uniform1i(u.uTexture, pres.read.attach(0)); gl.uniform1f(u.value, cfg.PRESSURE); blit(pres.write); pres.swap();
      u = use('pressure'); gl.uniform2f(u.texelSize, vel.tx, vel.ty); gl.uniform1i(u.uDivergence, div.attach(0));
      for (var i = 0; i < cfg.ITER; i++) { gl.uniform1i(u.uPressure, pres.read.attach(1)); blit(pres.write); pres.swap(); }
      u = use('gradient'); gl.uniform2f(u.texelSize, vel.tx, vel.ty); gl.uniform1i(u.uPressure, pres.read.attach(0)); gl.uniform1i(u.uVelocity, vel.read.attach(1)); blit(vel.write); vel.swap();
      u = use('advect'); gl.uniform2f(u.texelSize, vel.tx, vel.ty);
      var v = vel.read.attach(0); gl.uniform1i(u.uVelocity, v); gl.uniform1i(u.uSource, v); gl.uniform1f(u.dt, dt); gl.uniform1f(u.dissipation, cfg.VEL); blit(vel.write); vel.swap();
      gl.uniform1i(u.uVelocity, vel.read.attach(0)); gl.uniform1i(u.uSource, dye.read.attach(1)); gl.uniform1f(u.dissipation, cfg.DENS); blit(dye.write); dye.swap();
    }
    function render() { var u = use('display'); gl.uniform2f(u.texelSize, 1 / dye.w, 1 / dye.h); gl.uniform1i(u.uTexture, dye.read.attach(0)); gl.clearColor(0, 0, 0, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clear(gl.COLOR_BUFFER_BIT); blit(null); }

    /* fallback: the same stable-fluids idea on a small CPU grid, for browsers without WebGL (Chrome with graphics acceleration off, for one) */
    function cpuSim() {
      var ctx = canvas.getContext('2d'); if (!ctx) return null;
      var W = 0, H = 0, N = 0, DW = 0, DH = 0, DN = 0, u, v, u2, v2, dr, dg, db, dr2, dg2, db2, pr, pr2, dv, img, off, octx;
      function alloc() {
        var cw = Math.max(1, canvas.clientWidth), ch = Math.max(1, canvas.clientHeight);
        var nh = innerWidth < 760 ? 48 : 72, nw = Math.max(16, Math.round(nh * cw / ch));
        if (nw === W && nh === H) return;
        W = nw; H = nh; N = W * H; DW = W * 3; DH = H * 3; DN = DW * DH;
        u = new Float32Array(N); v = new Float32Array(N); u2 = new Float32Array(N); v2 = new Float32Array(N);
        dr = new Float32Array(DN); dg = new Float32Array(DN); db = new Float32Array(DN); dr2 = new Float32Array(DN); dg2 = new Float32Array(DN); db2 = new Float32Array(DN);
        pr = new Float32Array(N); pr2 = new Float32Array(N); dv = new Float32Array(N);
        off = document.createElement('canvas'); off.width = DW; off.height = DH; octx = off.getContext('2d'); img = octx.createImageData(DW, DH);
      }
      function resize() { var dpr = Math.min(devicePixelRatio || 1, 1.5), w = Math.max(1, Math.floor(canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(canvas.clientHeight * dpr)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } alloc(); }
      function sample(a, x, y, w, h) {
        x = x < 0 ? 0 : x > w - 1.001 ? w - 1.001 : x; y = y < 0 ? 0 : y > h - 1.001 ? h - 1.001 : y;
        var i = x | 0, j = y | 0, fx = x - i, fy = y - j, k = j * w + i;
        return (a[k] * (1 - fx) + a[k + 1] * fx) * (1 - fy) + (a[k + w] * (1 - fx) + a[k + w + 1] * fx) * fy;
      }
      function splat(x, y, dx, dy, col) {
        var cx = x * W, cy = (1 - y) * H, rad = Math.sqrt(cfg.RADIUS / 100) * H * 1.15, r2 = rad * rad;
        var x0 = Math.max(0, Math.floor(cx - rad * 2.5)), x1 = Math.min(W - 1, Math.ceil(cx + rad * 2.5)), y0 = Math.max(0, Math.floor(cy - rad * 2.5)), y1 = Math.min(H - 1, Math.ceil(cy + rad * 2.5));
        for (var j = y0; j <= y1; j++) for (var i = x0; i <= x1; i++) {
          var ex = i - cx, ey = j - cy, g = Math.exp(-(ex * ex + ey * ey) / r2), k = j * W + i;
          u[k] += dx * g; v[k] -= dy * g;
        }
        cx *= 3; cy *= 3; rad *= 3; r2 = rad * rad;
        x0 = Math.max(0, Math.floor(cx - rad * 2.5)); x1 = Math.min(DW - 1, Math.ceil(cx + rad * 2.5)); y0 = Math.max(0, Math.floor(cy - rad * 2.5)); y1 = Math.min(DH - 1, Math.ceil(cy + rad * 2.5));
        for (j = y0; j <= y1; j++) for (i = x0; i <= x1; i++) {
          ex = i - cx; ey = j - cy; g = Math.exp(-(ex * ex + ey * ey) / r2); k = j * DW + i;
          dr[k] += col[0] * g; dg[k] += col[1] * g; db[k] += col[2] * g;
        }
      }
      function step(dt) {
        var i, j, k, n;
        /* vorticity confinement, light */
        for (j = 1; j < H - 1; j++) for (i = 1; i < W - 1; i++) { k = j * W + i; pr2[k] = 0.5 * ((v[k + 1] - v[k - 1]) - (u[k + W] - u[k - W])); }
        for (j = 2; j < H - 2; j++) for (i = 2; i < W - 2; i++) {
          k = j * W + i; var fx = Math.abs(pr2[k + W]) - Math.abs(pr2[k - W]), fy = Math.abs(pr2[k + 1]) - Math.abs(pr2[k - 1]), l = Math.sqrt(fx * fx + fy * fy) + 0.0001;
          fx = fx / l * cfg.CURL * pr2[k]; fy = -fy / l * cfg.CURL * pr2[k]; u[k] += fx * dt * 0.5; v[k] += fy * dt * 0.5;
        }
        /* divergence + pressure */
        for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
          k = j * W + i;
          var L = i > 0 ? u[k - 1] : -u[k], R = i < W - 1 ? u[k + 1] : -u[k], T = j > 0 ? v[k - W] : -v[k], B = j < H - 1 ? v[k + W] : -v[k];
          dv[k] = 0.5 * (R - L + B - T); pr[k] *= cfg.PRESSURE;
        }
        for (n = 0; n < cfg.ITER; n++) {
          for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
            k = j * W + i;
            pr2[k] = ((i > 0 ? pr[k - 1] : pr[k]) + (i < W - 1 ? pr[k + 1] : pr[k]) + (j > 0 ? pr[k - W] : pr[k]) + (j < H - 1 ? pr[k + W] : pr[k]) - dv[k]) * 0.25;
          }
          var t = pr; pr = pr2; pr2 = t;
        }
        for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
          k = j * W + i;
          u[k] -= 0.5 * ((i < W - 1 ? pr[k + 1] : pr[k]) - (i > 0 ? pr[k - 1] : pr[k]));
          v[k] -= 0.5 * ((j < H - 1 ? pr[k + W] : pr[k]) - (j > 0 ? pr[k - W] : pr[k]));
        }
        /* advect */
        var kv = 1 / (1 + cfg.VEL * dt), kd = 1 / (1 + cfg.DENS * dt);
        for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
          k = j * W + i; var x = i - dt * u[k], y = j - dt * v[k];
          u2[k] = sample(u, x, y, W, H) * kv; v2[k] = sample(v, x, y, W, H) * kv;
        }
        for (j = 0; j < DH; j++) for (i = 0; i < DW; i++) {
          k = j * DW + i; var vx = sample(u2, i / 3, j / 3, W, H), vy = sample(v2, i / 3, j / 3, W, H), x = i - dt * vx * 3, y = j - dt * vy * 3;
          dr2[k] = sample(dr, x, y, DW, DH) * kd; dg2[k] = sample(dg, x, y, DW, DH) * kd; db2[k] = sample(db, x, y, DW, DH) * kd;
        }
        var s; s = u; u = u2; u2 = s; s = v; v = v2; v2 = s; s = dr; dr = dr2; dr2 = s; s = dg; dg = dg2; dg2 = s; s = db; db = db2; db2 = s;
      }
      function render() {
        var d = img.data, k, o;
        for (k = 0, o = 0; k < DN; k++, o += 4) {
          var r = dr[k], g = dg[k], b = db[k], m = r > g ? (r > b ? r : b) : (g > b ? g : b);
          if (m < 0.002) { d[o + 3] = 0; continue; }
          var a = (1 - Math.exp(-m * 2.4)) * 0.88, inv = 255 / m;
          d[o] = r * inv; d[o + 1] = g * inv; d[o + 2] = b * inv; d[o + 3] = a * 255;
        }
        octx.putImageData(img, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
      }
      alloc();
      return { splat: splat, step: step, render: render, resize: resize };
    }
    var S = useGL ? { splat: splat, step: step, render: render, resize: function () { if (sizeCanvas()) buffers(); } } : cpuSim();
    if (!S) return;

    var inks = [[0.66, 0.12, 0.33], [0.91, 0.36, 0.55], [0.85, 0.62, 0.16], [0.95, 0.55, 0.66], [0.58, 0.1, 0.3]];
    var inkIndex = 0, inkSwap = 0, pending = [], last = null, activeUntil = 0, raf = 0, prev = 0, visible = true, alive = true;
    S.resize();
    function onMove(e) {
      if (e.pointerType !== 'mouse' && !e.isPrimary) return;
      var r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
      if (last) { var dx = x - last.x, dy = y - last.y, ar = r.width / r.height; if (ar < 1) dx *= ar; if (Math.abs(dx) + Math.abs(dy) > 0.0004) pending.push([x, y, dx * cfg.FORCE, dy * cfg.FORCE]); }
      last = { x: x, y: y }; wake();
    }
    function onLeave() { last = null; }
    function onDown(e) { var r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height; for (var i = 0; i < 3; i++) { var a = Math.random() * Math.PI * 2; pending.push([x, y, Math.cos(a) * 700, Math.sin(a) * 700, 2.2]); } last = { x: x, y: y }; wake(); }
    function onResize() { S.resize(); S.render(); }
    function onVis() { if (!document.hidden) wake(); }
    hero.addEventListener('pointermove', onMove, { passive: true }); hero.addEventListener('pointerleave', onLeave); hero.addEventListener('pointerdown', onDown, { passive: true });
    addEventListener('resize', onResize); document.addEventListener('visibilitychange', onVis);
    var io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) wake(); }, { threshold: 0 }); io.observe(hero);
    function wake() { if (drawingBusy) return; activeUntil = performance.now() + 7000; if (!raf && alive && visible && !document.hidden) { prev = performance.now(); raf = requestAnimationFrame(frame); } }
    function frame(now) {
      raf = 0; if (!alive) return;
      var dt = Math.min((now - prev) / 1000, 0.033); prev = now;
      S.resize();
      if (now - inkSwap > 900) { inkIndex = (inkIndex + 1) % inks.length; inkSwap = now; }
      pending.forEach(function (s) { var k = inks[inkIndex], m = 0.32 * (s[4] || 1); S.splat(s[0], s[1], s[2], s[3], [k[0] * m, k[1] * m, k[2] * m]); });
      pending = [];
      S.step(dt); S.render();
      if (now < activeUntil && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }
    /* a first stir so the cover is never blank before anyone moves */
    for (var q = 0; q < 4; q++) { var a0 = Math.random() * Math.PI * 2; pending.push([0.62 + Math.random() * 0.25, 0.35 + Math.random() * 0.4, Math.cos(a0) * 520, Math.sin(a0) * 520, 1.6]); }
    wake();
    heroState = { stop: function () { alive = false; if (raf) cancelAnimationFrame(raf); hero.removeEventListener('pointermove', onMove); hero.removeEventListener('pointerleave', onLeave); hero.removeEventListener('pointerdown', onDown); removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); io.disconnect(); } };
  }
  initHero(); initTypewriter();
})();
