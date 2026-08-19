(function(){
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm) return;

  var hero = document.getElementById('hero');
  var root = document.documentElement;

  var bar = document.createElement('div');
  bar.className = 'fx-progress';
  document.body.appendChild(bar);

  function shaderBackdrop(){
    if (!hero) return;
    var canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    hero.insertBefore(canvas, hero.querySelector('.hero__scrim'));

    var gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) { canvas.remove(); return; }

    var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var fs = [
      'precision highp float;',
      'uniform vec2 res; uniform float t;',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
      ' return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}',
      'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}',
      'void main(){',
      ' vec2 uv=gl_FragCoord.xy/res.xy; vec2 q=uv*vec2(res.x/res.y,1.);',
      ' float f=fbm(q*2.2+vec2(t*.045,t*.02));',
      ' float g=fbm(q*3.4-vec2(t*.03,t*.05)+f*.7);',
      ' float band=smoothstep(.42,.92,g);',
      ' float sheen=pow(band,2.2);',
      ' vec3 gold=mix(vec3(.42,.32,.08),vec3(.91,.82,.55),sheen);',
      ' float edge=smoothstep(1.05,.15,uv.x)*smoothstep(1.15,.05,1.-uv.y);',
      ' float a=sheen*.5*edge;',
      ' gl_FragColor=vec4(gold*a,a);',
      '}'
    ].join('\n');

    function compile(type, src){
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    }
    var prog = gl.createProgram();
    var v = compile(gl.VERTEX_SHADER, vs), f = compile(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) { canvas.remove(); return; }
    gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog); gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    var uRes = gl.getUniformLocation(prog, 'res');
    var uT = gl.getUniformLocation(prog, 't');
    var dpr = Math.min(window.devicePixelRatio || 1, 1.6);

    function size(){
      var r = hero.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    }

    var visible = true;
    new IntersectionObserver(function(e){
      visible = e[0].isIntersecting;
      if (visible) requestAnimationFrame(draw);
    }, { threshold: 0.02 }).observe(hero);

    var start = performance.now();
    function draw(){
      if (!visible) return;
      gl.uniform1f(uT, (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(draw);
    }
    size(); requestAnimationFrame(draw);
    var rt; window.addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(size, 200); });
  }

  function pointerDepth(){
    var TILT = '.srv, .rev, .limit, .scall, .cnt, .calc, .list, .pair__shots';
    [].forEach.call(document.querySelectorAll(TILT), function(el){
      el.classList.add('fx-tilt', 'fx-spot');
      el.addEventListener('pointermove', function(e){
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--fx-ry', ((px - .5) * 7).toFixed(2) + 'deg');
        el.style.setProperty('--fx-rx', ((.5 - py) * 5).toFixed(2) + 'deg');
        el.style.setProperty('--fx-mx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--fx-my', (py * 100).toFixed(1) + '%');
        el.classList.add('is-hot');
      });
      el.addEventListener('pointerleave', function(){
        el.classList.remove('is-hot');
        el.style.setProperty('--fx-ry', '0deg');
        el.style.setProperty('--fx-rx', '0deg');
      });
    });

    [].forEach.call(document.querySelectorAll('.pill--gold, .dial__cta, .calc__cta, .after__cta'), function(btn){
      btn.classList.add('fx-magnet');
      btn.addEventListener('pointermove', function(e){
        var r = btn.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        btn.style.transform = 'translate3d(' + (dx * 8).toFixed(1) + 'px,' + (dy * 5 - 2).toFixed(1) + 'px,0)';
      });
      btn.addEventListener('pointerleave', function(){ btn.style.transform = ''; });
    });
  }

  function scrollScenes(){
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    var heroBg = hero && hero.querySelector('.hero__bg');
    if (heroBg) {
      gsap.to(heroBg, {
        yPercent: 12, scale: 1.08, ease: 'none', force3D: true,
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 }
      });
      gsap.to('.hero .copy', {
        yPercent: -6, opacity: .35, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 }
      });
    }

    var steps = gsap.utils.toArray('.step');
    var stepsWrap = document.querySelector('.steps');
    if (steps.length && stepsWrap && window.innerWidth > 900) {
      gsap.set(steps, { transformOrigin: '50% 100%' });
      ScrollTrigger.create({
        trigger: stepsWrap,
        start: 'top 78%',
        end: 'bottom 40%',
        scrub: 0.5,
        onUpdate: function(self){
          var active = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
          steps.forEach(function(el, i){
            gsap.to(el, {
              scale: i === active ? 1.03 : 1,
              yPercent: i === active ? -2 : 0,
              opacity: i <= active ? 1 : .62,
              duration: .45, ease: 'power2.out', overwrite: 'auto', force3D: true
            });
          });
        }
      });
    }

    ScrollTrigger.batch('.srv, .rev, .limit, .pair, .scall, .cnt', {
      start: 'top 88%',
      onEnter: function(els){
        gsap.fromTo(els,
          { y: 46, opacity: 0, filter: 'blur(8px)', rotateX: 6 },
          { y: 0, opacity: 1, filter: 'blur(0px)', rotateX: 0, duration: 1.05,
            ease: 'power3.out', stagger: 0.08, force3D: true, clearProps: 'filter' });
      },
      once: true
    });

    var servRow = document.querySelector('.serv');
    if (servRow) {
      gsap.fromTo(servRow, { xPercent: 2 }, {
        xPercent: -2, ease: 'none', force3D: true,
        scrollTrigger: { trigger: servRow, start: 'top bottom', end: 'bottom top', scrub: 1 }
      });
    }

    var calc = document.querySelector('.calc');
    if (calc) {
      gsap.fromTo(calc, { rotateY: 4, y: 30 }, {
        rotateY: 0, y: 0, ease: 'power2.out',
        scrollTrigger: { trigger: calc, start: 'top 85%', end: 'top 45%', scrub: 0.8 }
      });
    }

    gsap.utils.toArray('h2').forEach(function(h){
      gsap.fromTo(h, { y: 26, opacity: 0 }, {
        y: 0, opacity: 1, duration: .9, ease: 'power3.out',
        scrollTrigger: { trigger: h, start: 'top 90%', once: true }
      });
    });

    ScrollTrigger.create({
      trigger: document.body,
      start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: function(self){ root.style.setProperty('--fx-read', self.progress.toFixed(4)); }
    });
  }

  var sum = document.getElementById('sum');
  if (sum) {
    var seen = sum.textContent;
    new MutationObserver(function(){
      if (sum.textContent === seen) return;
      seen = sum.textContent;
      sum.classList.add('is-tick');
      setTimeout(function(){ sum.classList.remove('is-tick'); }, 220);
    }).observe(sum, { childList: true, characterData: true, subtree: true });
  }

  function heroEntrance(){
    if (!window.gsap || !hero) return;
    hero.classList.add('lit');
    var bits = hero.querySelectorAll('.eyebrow, h1, .lead, .cta, .facts, .slot');
    gsap.set(bits, { clearProps: 'all', opacity: 1, y: 0, filter: 'none' });
    gsap.timeline({ defaults: { ease: 'power3.out', force3D: true } })
      .from(hero.querySelector('.nav__pill'), { y: -24, opacity: 0, duration: .8 })
      .from(bits, { y: 34, opacity: 0, duration: 1, stagger: .09 }, '-=.45')
      .from(hero.querySelector('.tape'), { y: 24, opacity: 0, duration: .8 }, '-=.7');
  }

  function servicesStrip(){
    var serv = document.querySelector('.sec-serv .wrap');
    if (!serv || document.querySelector('.fx-strip')) return;
    var items = ['Диваны и кресла', 'Матрасы с двух сторон', 'Ковры и покрытия', 'Удаление запахов',
                 'Мягкие игрушки', 'Мытьё окон', 'Уборка квартир', 'После ремонта'];
    var strip = document.createElement('div');
    strip.className = 'fx-strip';
    strip.setAttribute('aria-hidden', 'true');
    var track = document.createElement('div');
    track.className = 'fx-strip__track';
    for (var pass = 0; pass < 2; pass++) {
      items.forEach(function(t){
        var s = document.createElement('span');
        s.textContent = t;
        track.appendChild(s);
      });
    }
    strip.appendChild(track);
    serv.appendChild(strip);
  }

  function countUp(){
    var sum = document.getElementById('sum');
    if (!sum || !window.gsap) return;
    var run = function(){
      var target = parseInt((sum.textContent.match(/[\d\s]+/) || ['0'])[0].replace(/\s/g, ''), 10) || 0;
      var obj = { v: 0 };
      gsap.to(obj, { v: target, duration: 1.1, ease: 'power2.out', onUpdate: function(){
        sum.textContent = 'от ' + Math.round(obj.v).toLocaleString('ru-RU') + ' ₽';
      }});
    };
    ScrollTrigger.create({ trigger: sum, start: 'top 85%', once: true, onEnter: run });
  }

  function stepsLine(){
    var wrap = document.querySelector('.steps');
    if (!wrap || !window.ScrollTrigger) return;
    ScrollTrigger.create({
      trigger: wrap, start: 'top 82%', end: 'bottom 45%', scrub: .4,
      onUpdate: function(self){ wrap.style.setProperty('--fx-steps', self.progress.toFixed(3)); }
    });
  }

  shaderBackdrop();
  pointerDepth();
  servicesStrip();
  scrollScenes();
  heroEntrance();
  countUp();
  stepsLine();
})();
