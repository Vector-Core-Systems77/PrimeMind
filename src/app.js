// app.js — منطق الواجهة الأمامية لـ PrimeMind
// يتواصل مع الـ Backend عبر window.__TAURI__.core.invoke

/* ── جسر Tauri ──────────────────────────────────────────────────────────── */

const invoke = (...args) =>
  window.__TAURI__?.core?.invoke?.(...args) ?? mockInvoke(...args);

/* ── محاكاة للتطوير في المتصفح (بدون Tauri) ─────────────────────────────── */

const ZETA_ZEROS_JS = [
  14.134725, 21.022040, 25.010858, 30.424876, 32.935062,
  37.586178, 40.918719, 43.327073, 48.005151, 49.773832,
  52.970321, 56.446248, 59.347044, 60.831779, 65.112544,
  67.079811, 69.546402, 72.067158, 75.704691, 77.144840,
  79.337375, 82.910380, 84.735493, 87.425275, 88.809111,
  92.491899, 94.651344, 95.870634, 98.831194, 101.317851,
];

const CHAR_PRIME = {
  a:2, b:3, c:5, d:7, e:11, f:13, g:17, h:19, i:23, j:29,
  k:31, l:37, m:41, n:43, o:47, p:53, q:59, r:61, s:67, t:71,
  u:73, v:79, w:83, x:89, y:97, z:101, ' ':103, '.':107,
  ',':109, '?':113, '!':127,
};
const PRIME_CHAR = Object.fromEntries(
  Object.entries(CHAR_PRIME).map(([c, p]) => [p, c])
);

function mockSpectral(text, g) {
  const DEFAULT_G = g || 1e-6;
  const zeros = appState.zeros;

  // نص → أعداد أولية
  const inputPrimes = [...text.toLowerCase()]
    .map(c => CHAR_PRIME[c])
    .filter(Boolean);

  if (!inputPrimes.length) {
    return {
      input_text: text, input_primes: [], resonance_strengths: [],
      inferred_primes: [], output_text: '', zeros_used: zeros.length,
      g_used: DEFAULT_G, max_resonance: 0,
    };
  }

  // حساب الرنين لكل عدد أولي
  const resonance_strengths = inputPrimes.map(p => {
    const lnp = Math.log(p);
    const amp = DEFAULT_G * lnp * Math.pow(p, -0.5);
    const total = zeros.reduce((sum, gamma) => {
      const phase = gamma * lnp;
      const re = amp * Math.cos(phase);
      const im = -amp * Math.sin(phase);
      return sum + Math.sqrt(re * re + im * im);
    }, 0);
    return total / zeros.length;
  });

  // العتبة = متوسط الرنين
  const mean = resonance_strengths.reduce((a, b) => a + b, 0) / resonance_strengths.length;
  const max_resonance = Math.max(...resonance_strengths);

  // الأعداد المستنتجة
  const inferred_primes = inputPrimes.filter((_, i) => resonance_strengths[i] >= mean);

  // أعداد → نص
  const output_text = inferred_primes.map(p => PRIME_CHAR[p] || '').join('');

  return {
    input_text: text, input_primes: inputPrimes, resonance_strengths,
    inferred_primes, output_text, zeros_used: zeros.length,
    g_used: DEFAULT_G, max_resonance,
  };
}

function mockInvoke(cmd, args) {
  console.log(`[mock] ${cmd}`, args);
  if (cmd === 'run_spectral')
    return Promise.resolve(mockSpectral(args.text, args.g));
  if (cmd === 'get_zeros')
    return Promise.resolve([...appState.zeros]);
  if (cmd === 'get_primes')
    return Promise.resolve(
      Array.from({length: args.limit}, (_, i) => i + 2).filter(n => {
        for (let d = 2; d <= Math.sqrt(n); d++) if (n % d === 0) return false;
        return true;
      })
    );
  if (cmd === 'expand_zeros_cmd') {
    appState.zeros = [...appState.zeros, ...args.new_zeros]
      .filter((v, i, a) => a.findIndex(x => Math.abs(x - v) < 0.001) === i)
      .sort((a, b) => a - b);
    return Promise.resolve(appState.zeros.length);
  }
  if (cmd === 'expand_primes_cmd') {
    appState.primeLimit = args.new_limit;
    return Promise.resolve(Math.floor(args.new_limit / Math.log(args.new_limit)));
  }
  if (cmd === 'get_engine_status')
    return Promise.resolve({
      zeros_count: appState.zeros.length,
      prime_limit: appState.primeLimit,
      g_constant: 1e-6,
    });
  return Promise.resolve(null);
}

/* ── حالة التطبيق ─────────────────────────────────────────────────────────── */

const appState = {
  zeros: [...ZETA_ZEROS_JS],
  primeLimit: 1000,
  lastResult: null,
  waveAnimId: null,
  wavePhase: 0,
  isLoading: false,
};

/* ── التهيئة ────────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
  setupCharCounter();
  await loadEngineStatus();
  drawZetaSpikes();
  startIdleWave();
});

/* ── عداد الأحرف ─────────────────────────────────────────────────────────── */

function setupCharCounter() {
  const ta = document.getElementById('inputText');
  const counter = document.getElementById('charCount');
  ta.addEventListener('input', () => {
    counter.textContent = ta.value.length;
  });
}

/* ── تحميل حالة المحرك ───────────────────────────────────────────────────── */

async function loadEngineStatus() {
  try {
    const status = await invoke('get_engine_status');
    const zeros  = await invoke('get_zeros');
    appState.zeros = zeros;
    appState.primeLimit = status.prime_limit;
    updateEngineUI();
  } catch (e) {
    console.warn('لم يتم تحميل حالة المحرك:', e);
  }
}

function updateEngineUI() {
  const el = document.getElementById('zerosCount');
  if (el) el.textContent = appState.zeros.length;
  const pl = document.getElementById('primeLimitDisplay');
  if (pl) pl.textContent = appState.primeLimit.toLocaleString();
}

/* ── رسم أصفار زيتا ──────────────────────────────────────────────────────── */

function drawZetaSpikes(highlightIdx = -1) {
  const canvas = document.getElementById('zetaCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const rect  = canvas.getBoundingClientRect();
  const W = rect.width  || 360;
  const H = rect.height || 80;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const zeros = appState.zeros;
  if (!zeros.length) return;

  const minZ = zeros[0] - 2;
  const maxZ = zeros[zeros.length - 1] + 2;
  const range = maxZ - minZ;
  const baseY = H * 0.88;

  // خط الأساس
  ctx.strokeStyle = '#1e1e30';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  ctx.lineTo(W, baseY);
  ctx.stroke();

  // رسم كل صفر كشوكة
  zeros.forEach((z, i) => {
    const x = ((z - minZ) / range) * (W - 20) + 10;
    const isHot = i === highlightIdx;

    // ارتفاع الشوكة يتناقص مع الفهرس (تأثير بصري)
    const baseH = H * 0.65 * Math.exp(-0.015 * i);
    const spikeH = isHot ? H * 0.82 : baseH;

    if (isHot) {
      // توهج للشوكة النشطة
      const grd = ctx.createLinearGradient(x, baseY, x, baseY - spikeH);
      grd.addColorStop(0, 'rgba(0,255,136,0)');
      grd.addColorStop(0.4, 'rgba(0,255,136,0.4)');
      grd.addColorStop(1, '#00ff88');
      ctx.strokeStyle = grd;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00ff88';
    } else {
      ctx.strokeStyle = `rgba(123,94,167,${0.25 + 0.45 * Math.exp(-0.03 * i)})`;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, baseY - spikeH);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // نقطة في القمة
    ctx.beginPath();
    ctx.arc(x, baseY - spikeH, isHot ? 3 : 1.5, 0, Math.PI * 2);
    ctx.fillStyle = isHot ? '#00ff88' : 'rgba(123,94,167,0.7)';
    ctx.fill();
  });

  // تسميات الحدود
  ctx.fillStyle = '#32324a';
  ctx.font = `9px ${getComputedStyle(document.documentElement).getPropertyValue('--mono') || 'monospace'}`;
  ctx.fillText(`γ₁=${zeros[0].toFixed(2)}`, 8, H - 2);
  const lastLabel = `γ${zeros.length}=${zeros[zeros.length-1].toFixed(2)}`;
  ctx.fillText(lastLabel, W - lastLabel.length * 5.5 - 4, H - 2);
}

/* ── موجة الرنين ──────────────────────────────────────────────────────────── */

function startIdleWave() {
  if (appState.waveAnimId) cancelAnimationFrame(appState.waveAnimId);
  const step = () => {
    appState.wavePhase += 0.025;
    drawWave(null, null);
    appState.waveAnimId = requestAnimationFrame(step);
  };
  appState.waveAnimId = requestAnimationFrame(step);
}

function drawWave(inputPrimes, resonanceScores) {
  const canvas = document.getElementById('waveCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const rect  = canvas.getBoundingClientRect();
  const W = rect.width  || 360;
  const H = rect.height || 90;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const midY = H / 2;
  const phase = appState.wavePhase;

  // موجة المدخل (خضراء)
  ctx.beginPath();
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 5;
  ctx.shadowColor = 'rgba(0,255,136,0.35)';

  for (let px = 0; px <= W; px++) {
    const t = (px / W) * Math.PI * 4 + phase;
    let y;
    if (inputPrimes && inputPrimes.length) {
      const idx = Math.floor((px / W) * inputPrimes.length);
      const p   = inputPrimes[Math.min(idx, inputPrimes.length - 1)];
      const amp = Math.min(28, Math.log(p) * 5.5);
      const freq = 1 + (p % 7) * 0.25;
      y = midY + amp * Math.sin(t * freq + p * 0.008);
    } else {
      y = midY + 16 * Math.sin(t) + 7 * Math.sin(t * 2.1 + 1.4);
    }
    px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // موجة المستنتج (بنفسجية منقطة)
  if (resonanceScores && resonanceScores.length) {
    ctx.beginPath();
    ctx.strokeStyle = '#7b5ea7';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);

    for (let px = 0; px <= W; px++) {
      const t = (px / W) * Math.PI * 4 + phase + 0.7;
      const idx = Math.floor((px / W) * resonanceScores.length);
      const r   = resonanceScores[Math.min(idx, resonanceScores.length - 1)];
      // طبيّع الرنين للرسم (اضرب بعامل كبير لأن g صغير جداً)
      const norm = Math.min(25, r * 1e8);
      y = midY + norm * Math.sin(t * 1.35 + 0.5);
      px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // خط الأساس
  ctx.strokeStyle = '#1e1e30';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(W, midY);
  ctx.stroke();
}

/* ── الاستدلال الرئيسي ────────────────────────────────────────────────────── */

async function runInference() {
  const input = document.getElementById('inputText').value.trim();
  if (!input) { setStatus('⚠ أدخل نصاً أولاً', 'error'); return; }
  if (appState.isLoading) return;

  const g = parseFloat(document.getElementById('gSelect').value) || 1e-6;

  appState.isLoading = true;
  const btn = document.getElementById('inferBtn');
  btn.disabled = true;
  setStatus('⟨ψ| جارٍ الاستدلال الطيفي...', 'loading');

  // إخفاء النتائج القديمة
  document.getElementById('resultsSection').style.display = 'none';

  try {
    const result = await invoke('run_spectral', { text: input, g });
    appState.lastResult = result;
    await displayResult(result);
    setStatus(
      `✓ اكتمل · ${result.input_primes.length} حرف · ${result.zeros_used} صفر · max-res=${result.max_resonance.toExponential(3)}`,
      'success'
    );
  } catch (err) {
    setStatus(`✗ خطأ: ${err}`, 'error');
    console.error(err);
  } finally {
    appState.isLoading = false;
    btn.disabled = false;
  }
}

/* ── عرض النتائج ────────────────────────────────────────────────────────────── */

async function displayResult(r) {
  const section = document.getElementById('resultsSection');
  section.style.display = 'block';

  // طبقة 1: الأعداد الأولية المُدخلة
  document.getElementById('inputPrimesRow').textContent =
    r.input_primes.slice(0, 20).join(', ') +
    (r.input_primes.length > 20 ? ` … (+${r.input_primes.length - 20})` : '');

  // طبقة 2: أشرطة الرنين
  renderResonanceBars(r.resonance_strengths, r.input_primes);

  // طبقة 3: الأعداد الأولية المستنتجة
  document.getElementById('inferredPrimesRow').textContent =
    r.inferred_primes.length
      ? r.inferred_primes.join(', ')
      : '(لا يوجد — جميع الأعداد تحت العتبة)';

  // طبقة 4: النص الناتج
  document.getElementById('outputText').textContent =
    r.output_text || '(لا نص ناتج)';

  // تحديث الرسوم البيانية
  const peakIdx = r.resonance_strengths.indexOf(Math.max(...r.resonance_strengths));
  drawZetaSpikes(peakIdx);

  // تحريك الموجة بالبيانات الحقيقية
  if (appState.waveAnimId) cancelAnimationFrame(appState.waveAnimId);
  const step = () => {
    appState.wavePhase += 0.02;
    drawWave(r.input_primes, r.resonance_strengths);
    appState.waveAnimId = requestAnimationFrame(step);
  };
  appState.waveAnimId = requestAnimationFrame(step);
}

function renderResonanceBars(strengths, primes) {
  const container = document.getElementById('resonanceBars');
  const meta      = document.getElementById('resonanceMeta');
  container.innerHTML = '';

  if (!strengths.length) {
    meta.textContent = 'لا بيانات';
    return;
  }

  const max = Math.max(...strengths);
  const mean = strengths.reduce((a, b) => a + b, 0) / strengths.length;

  strengths.slice(0, 30).forEach((r, i) => {
    const bar = document.createElement('div');
    bar.className = 'res-bar';
    const heightPct = max > 0 ? (r / max) * 100 : 0;
    bar.style.height = `${Math.max(2, heightPct * 0.38)}px`;
    bar.style.background = r >= mean
      ? `rgba(0,255,136,${0.4 + 0.6 * (r / max)})`
      : `rgba(123,94,167,${0.3 + 0.4 * (r / max)})`;
    bar.title = `p=${primes[i]} · res=${r.toExponential(3)}`;
    container.appendChild(bar);
  });

  meta.textContent =
    `المتوسط: ${mean.toExponential(3)} · الأعلى: ${max.toExponential(3)} · ` +
    `فوق العتبة: ${strengths.filter(r => r >= mean).length}/${strengths.length}`;
}

/* ── نسخ النتيجة ─────────────────────────────────────────────────────────── */

async function copyOutput() {
  if (!appState.lastResult?.output_text) return;
  try {
    await navigator.clipboard.writeText(appState.lastResult.output_text);
    setStatus('⧉ تم النسخ', 'success');
  } catch {
    setStatus('⚠ تعذّر النسخ — حاول يدوياً', 'error');
  }
}

/* ── توسيع الأصفار ───────────────────────────────────────────────────────── */

function openExpandZeros() {
  document.getElementById('expandZerosModal').style.display = 'flex';
}

async function submitExpandZeros() {
  const raw = document.getElementById('newZerosInput').value.trim();
  if (!raw) { closeModal('expandZerosModal'); return; }

  // تحليل الأرقام المفصولة بفواصل أو أسطر
  const newZeros = raw
    .split(/[\n,\s]+/)
    .map(s => parseFloat(s.trim()))
    .filter(n => !isNaN(n) && n > 0);

  if (!newZeros.length) {
    setStatus('⚠ لم يتم التعرف على أصفار صالحة', 'error');
    return;
  }

  try {
    const count = await invoke('expand_zeros_cmd', { new_zeros: newZeros });
    appState.zeros = await invoke('get_zeros');
    updateEngineUI();
    drawZetaSpikes();
    setStatus(`✓ تمت الإضافة · المجموع الآن: ${count} صفر`, 'success');
    closeModal('expandZerosModal');
    document.getElementById('newZerosInput').value = '';
  } catch (e) {
    setStatus(`✗ خطأ في الإضافة: ${e}`, 'error');
  }
}

/* ── توسيع الأعداد الأولية ───────────────────────────────────────────────── */

function openExpandPrimes() {
  document.getElementById('currentLimitModal').textContent =
    appState.primeLimit.toLocaleString();
  document.getElementById('expandPrimesModal').style.display = 'flex';
}

async function submitExpandPrimes() {
  const val = parseInt(document.getElementById('newLimitInput').value, 10);
  if (!val || val < 100) {
    setStatus('⚠ الحد الأدنى هو 100', 'error');
    return;
  }
  if (val > 1_000_000) {
    setStatus('⚠ الحد الأعلى هو 1,000,000', 'error');
    return;
  }

  try {
    setStatus('⟳ جارٍ توليد الأعداد الأولية...', 'loading');
    const count = await invoke('expand_primes_cmd', { new_limit: val });
    appState.primeLimit = val;
    updateEngineUI();
    setStatus(`✓ تم توسيع قاعدة الأعداد الأولية · ${count.toLocaleString()} عدد أولي`, 'success');
    closeModal('expandPrimesModal');
  } catch (e) {
    setStatus(`✗ خطأ: ${e}`, 'error');
  }
}

/* ── مساعدات ─────────────────────────────────────────────────────────────── */

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function setStatus(msg, type = '') {
  const bar = document.getElementById('statusBar');
  bar.textContent = msg;
  bar.className = 'status-bar' + (type ? ` ${type}` : '');
}

// اختصار لوحة المفاتيح: Ctrl+Enter = استدلال
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runInference();
  }
  if (e.key === 'Escape') {
    closeModal('expandZerosModal');
    closeModal('expandPrimesModal');
  }
});
