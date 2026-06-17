'use strict';

/* =========================================================
   ORBIT — Startup Idea Validator — script.js
   Pure vanilla JS. No backend. Everything persists to
   localStorage so ideas survive a page refresh.
   ========================================================= */

/* ---------------------------------------------------------
   0. CONSTANTS & TEMPLATES
   --------------------------------------------------------- */
const LS_IDEAS = 'orbit_ideas_v1';
const LS_DRAFT = 'orbit_draft_v1';
const LS_THEME = 'orbit_theme_v1';

const CATEGORY_META = {
  marketDemand:        { label: 'Market Demand',     short: 'Demand',   color: '#7c5cff', desc: 'How much real demand exists, based on market size, audience clarity and customer pain.' },
  feasibility:         { label: 'Feasibility',        short: 'Feasible', color: '#2fe6d9', desc: 'How realistic it is to build and launch given the complexity you described.' },
  profitability:       { label: 'Profitability',      short: 'Profit',   color: '#ffb23f', desc: 'How likely this business model and revenue strategy are to produce healthy margins.' },
  uniqueness:          { label: 'Uniqueness',         short: 'Unique',   color: '#ff5c7a', desc: 'How differentiated this idea is from existing alternatives and competitors.' },
  scalability:         { label: 'Scalability',        short: 'Scale',    color: '#3ddc97', desc: 'How well this could grow without a proportional rise in cost or manual effort.' },
  competitiveAdvantage:{ label: 'Competitive Edge',   short: 'Edge',     color: '#a48bff', desc: 'How defensible your position is if competitors target the same customers.' },
  customerValue:       { label: 'Customer Value',     short: 'Value',    color: '#5cc8ff', desc: 'How strongly the problem and pain points resonate with a real, felt need.' },
  growthPotential:     { label: 'Growth Potential',   short: 'Growth',   color: '#ffd24c', desc: 'Combined long-term upside from demand, scalability and differentiation.' }
};
const CATEGORY_KEYS = Object.keys(CATEGORY_META);

const DEFAULT_CHECKLIST = [
  { text: 'Talked to at least 5 potential customers about this problem', group: 'Problem & Customer' },
  { text: 'Confirmed the problem is frequent and painful, not a nice-to-have', group: 'Problem & Customer' },
  { text: 'Defined a specific, narrow target persona', group: 'Problem & Customer' },
  { text: 'Validated customers are actively trying (and failing) to solve this today', group: 'Problem & Customer' },
  { text: 'Estimated total addressable market size', group: 'Market & Competition' },
  { text: 'Identified at least 3 direct or indirect competitors', group: 'Market & Competition' },
  { text: 'Articulated a clear, one-sentence unique value proposition', group: 'Market & Competition' },
  { text: 'Checked for regulatory or legal constraints in this market', group: 'Market & Competition' },
  { text: 'Tested willingness to pay with real prospects', group: 'Business Model & Execution' },
  { text: 'Defined a primary revenue stream and rough pricing', group: 'Business Model & Execution' },
  { text: 'Identified your first customer acquisition channel', group: 'Business Model & Execution' },
  { text: 'Sketched an MVP scope and rough timeline', group: 'Business Model & Execution' }
];

const DEFAULT_INVESTOR = [
  'Problem validated with real customer interviews',
  'Clear, specific target market defined',
  'Competitive landscape mapped',
  'Working MVP or prototype exists',
  'Defined and tested revenue model',
  'Early traction signal (users, waitlist, or revenue)',
  'Financial projections drafted',
  'Pitch narrative or deck prepared',
  'Founding team committed and complementary',
  'Legal entity and basic compliance in place'
];

const MARKET_SIZE_LABEL = { niche: 'Niche', growing: 'Growing', large: 'Large', massive: 'Massive' };
const BIZ_MODEL_LABEL = {
  saas: 'Subscription / SaaS', marketplace: 'Marketplace', ecommerce: 'E-commerce', freemium: 'Freemium',
  advertising: 'Advertising', licensing: 'Licensing', service: 'Service / Consulting', hardware: 'Hardware', other: 'Other'
};

/* ---------------------------------------------------------
   1. STATE
   --------------------------------------------------------- */
let ideas = [];          // saved ideas (array of full idea objects)
let currentIdea = null;  // the idea currently being built / viewed / edited
let activeFlippedCard = null;
let compareSelection = []; // ids picked in compare tab

/* ---------------------------------------------------------
   2. UTILITIES
   --------------------------------------------------------- */
function genId() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function clamp100(n) { return Math.max(0, Math.min(100, Math.round(n))); }
function textSignal(text, capLen) {
  capLen = capLen || 180;
  if (!text) return 0;
  const len = text.trim().length;
  return Math.min(100, (len / capLen) * 100);
}
function countItems(text) {
  if (!text) return 0;
  return text.split(/[,\n]/).map(s => s.trim()).filter(Boolean).length;
}
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ---------------------------------------------------------
   3. PERSISTENCE
   --------------------------------------------------------- */
function saveIdeasList() { localStorage.setItem(LS_IDEAS, JSON.stringify(ideas)); }
function loadIdeasList() { try { ideas = JSON.parse(localStorage.getItem(LS_IDEAS)) || []; } catch (e) { ideas = []; } }
function saveDraft() { if (currentIdea) localStorage.setItem(LS_DRAFT, JSON.stringify(currentIdea)); }
function loadDraft() { try { return JSON.parse(localStorage.getItem(LS_DRAFT)) || null; } catch (e) { return null; } }

// If the active idea already exists in the saved list, keep that list in sync too.
function persistCurrent() {
  saveDraft();
  if (!currentIdea) return;
  const idx = ideas.findIndex(i => i.id === currentIdea.id);
  if (idx !== -1) {
    ideas[idx] = JSON.parse(JSON.stringify(currentIdea));
    saveIdeasList();
  }
}

/* ---------------------------------------------------------
   4. IDEA FACTORY
   --------------------------------------------------------- */
function createBlankIdea() {
  return {
    id: genId(),
    title: '', problemStatement: '', targetAudience: '', uvp: '',
    businessModel: 'saas', revenueStrategy: '', marketSize: 'growing',
    competitors: '', painPoints: '', scalability: 3, innovation: 3, complexity: 3,
    scores: null,
    swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
    risks: [],
    checklist: DEFAULT_CHECKLIST.map(c => ({ id: genId(), text: c.text, group: c.group, done: false })),
    investor: DEFAULT_INVESTOR.map(t => ({ id: genId(), text: t, done: false })),
    milestones: [],
    createdAt: Date.now(), updatedAt: Date.now(), saved: false
  };
}

function getActiveIdea() {
  if (!currentIdea) {
    currentIdea = createBlankIdea();
    saveDraft();
  }
  return currentIdea;
}

/* ---------------------------------------------------------
   5. SCORING ENGINE
   --------------------------------------------------------- */
const MARKET_SIZE_VAL = { niche: 35, growing: 60, large: 80, massive: 96 };
const BM_PROFIT = { saas: 88, marketplace: 76, ecommerce: 64, freemium: 58, advertising: 54, licensing: 80, service: 60, hardware: 55, other: 50 };
const BM_SCALE_BONUS = { saas: 14, marketplace: 12, ecommerce: 4, freemium: 8, advertising: 6, licensing: 10, service: -6, hardware: -4, other: 0 };

function computeScores(d) {
  const marketVal = MARKET_SIZE_VAL[d.marketSize] ?? 55;
  const painSig = textSignal(d.painPoints, 160);
  const audienceSig = textSignal(d.targetAudience, 70);
  const problemSig = textSignal(d.problemStatement, 200);
  const uvpSig = textSignal(d.uvp, 180);
  const revenueSig = textSignal(d.revenueStrategy, 140);
  const competitorCount = countItems(d.competitors);
  const competitorPenalty = Math.min(35, competitorCount * 6);

  const marketDemand = clamp100(marketVal * 0.55 + painSig * 0.30 + audienceSig * 0.15);
  const feasibility = clamp100(100 - (d.complexity - 1) * 19 + revenueSig * 0.10);
  const profitability = clamp100((BM_PROFIT[d.businessModel] ?? 55) * 0.7 + revenueSig * 0.2 + marketVal * 0.1);
  const uniqueness = clamp100(d.innovation * 20 * 0.55 + uvpSig * 0.40 - competitorPenalty * 0.55 + 6);
  const scalability = clamp100(d.scalability * 20 * 0.7 + (BM_SCALE_BONUS[d.businessModel] ?? 0) + marketVal * 0.1);
  const competitiveAdvantage = clamp100(uvpSig * 0.35 + uniqueness * 0.35 + (100 - competitorPenalty * 2) * 0.3);
  const customerValue = clamp100(problemSig * 0.5 + painSig * 0.3 + audienceSig * 0.2);
  const growthPotential = clamp100(scalability * 0.4 + marketDemand * 0.35 + uniqueness * 0.25);

  const health = clamp100(
    marketDemand * 0.15 + feasibility * 0.12 + profitability * 0.15 + uniqueness * 0.12 +
    scalability * 0.13 + competitiveAdvantage * 0.13 + customerValue * 0.12 + growthPotential * 0.08
  );

  return { marketDemand, feasibility, profitability, uniqueness, scalability, competitiveAdvantage, customerValue, growthPotential, health };
}

function ratingForScore(score) {
  if (score >= 85) return { label: 'Exceptional — High Potential', tone: 'good' };
  if (score >= 75) return { label: 'Strong — Investment Ready', tone: 'good' };
  if (score >= 60) return { label: 'Promising — Solid Foundation', tone: 'ok' };
  if (score >= 40) return { label: 'Developing — Needs Validation', tone: 'warn' };
  return { label: 'Weak — High Risk', tone: 'warn' };
}

function scoreColor(score) {
  if (score >= 75) return cssVar('--green') || '#3ddc97';
  if (score >= 50) return cssVar('--violet') || '#7c5cff';
  return cssVar('--rose') || '#ff5c7a';
}

function generateInsights(d, scores) {
  const insights = [];
  const sorted = CATEGORY_KEYS.slice().sort((a, b) => scores[a] - scores[b]);
  const weakest = sorted[0], strongest = sorted[sorted.length - 1];

  insights.push({ tone: scores[strongest] >= 70 ? 'good' : '', text: `${CATEGORY_META[strongest].label} is your strongest signal at ${scores[strongest]}/100 — lean into it in your pitch and messaging.` });
  insights.push({ tone: scores[weakest] < 55 ? 'warn' : '', text: `${CATEGORY_META[weakest].label} is your weakest area at ${scores[weakest]}/100 — this is the highest-leverage place to do more validation.` });

  if (countItems(d.competitors) >= 4) {
    insights.push({ tone: 'warn', text: `You listed ${countItems(d.competitors)} competitors. A crowded space is survivable, but your UVP needs to be unmistakably different.` });
  } else if (countItems(d.competitors) === 0) {
    insights.push({ tone: 'warn', text: 'No competitors listed — double-check this. Zero competitors often means zero validated demand, not zero competition.' });
  }
  if (d.complexity >= 4) {
    insights.push({ tone: 'warn', text: 'Implementation complexity is high. Consider a scoped-down MVP to test the core value before building everything.' });
  }
  if (d.scalability <= 2) {
    insights.push({ text: 'Scalability is rated low — this can still be a great business, just budget for linear (not exponential) growth.' });
  }
  if (scores.health >= 85) {
    insights.push({ tone: 'good', text: 'This idea scores in the top tier across the board. Strong candidate to move into investor-readiness work.' });
  }
  return insights;
}

/* ---------------------------------------------------------
   6. RING / GAUGE HELPERS
   --------------------------------------------------------- */
function setRingProgress(circle, percent, color) {
  const r = circle.r.baseVal.value;
  const c = 2 * Math.PI * r;
  circle.style.strokeDasharray = c;
  circle.style.strokeDashoffset = c;
  if (color) circle.style.stroke = color;
  requestAnimationFrame(() => {
    circle.style.strokeDashoffset = c - (percent / 100) * c;
  });
}

function animateCounter(el, target, duration) {
  duration = duration || 1100;
  const start = 0;
  const startTime = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  }
  requestAnimationFrame(tick);
}

/* ---------------------------------------------------------
   7. RADAR CHART (canvas)
   --------------------------------------------------------- */
function drawRadarChart(canvas, labels, datasets) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2 + 6;
  const radius = Math.min(w, h) / 2 - 60;
  const n = labels.length;
  const angleStep = (Math.PI * 2) / n;
  let progress = 0;
  const muted = cssVar('--text-muted') || '#8a93b8';
  const gridColor = 'rgba(255,255,255,0.10)';

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (let r = 1; r <= 4; r++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const ang = (i % n) * angleStep - Math.PI / 2;
        const rr = radius * (r / 4);
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const ang = i * angleStep - Math.PI / 2;
      const x2 = cx + Math.cos(ang) * radius, y2 = cy + Math.sin(ang) * radius;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x2, y2);
      ctx.strokeStyle = gridColor; ctx.stroke();
      const lx = cx + Math.cos(ang) * (radius + 30), ly = cy + Math.sin(ang) * (radius + 30);
      ctx.fillStyle = muted;
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], lx, ly);
    }
    datasets.forEach(ds => {
      ctx.beginPath();
      ds.scores.forEach((s, i) => {
        const ang = i * angleStep - Math.PI / 2;
        const rr = radius * (s / 100) * progress;
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = ds.fill;
      ctx.fill();
      ctx.strokeStyle = ds.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ds.scores.forEach((s, i) => {
        const ang = i * angleStep - Math.PI / 2;
        const rr = radius * (s / 100) * progress;
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = ds.color; ctx.fill();
      });
    });
  }
  function animate() {
    progress += 0.045;
    if (progress > 1) progress = 1;
    draw();
    if (progress < 1) requestAnimationFrame(animate);
  }
  animate();
}

/* ---------------------------------------------------------
   8. CONFETTI
   --------------------------------------------------------- */
const confettiCanvas = document.getElementById('confettiCanvas');
const confettiCtx = confettiCanvas.getContext('2d');
function resizeConfetti() { confettiCanvas.width = window.innerWidth; confettiCanvas.height = window.innerHeight; }
window.addEventListener('resize', resizeConfetti);
resizeConfetti();

function fireConfetti(strength) {
  strength = strength || 1;
  const colors = ['#7c5cff', '#2fe6d9', '#ffb23f', '#ff5c7a', '#3ddc97'];
  const count = Math.round(90 * strength);
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: confettiCanvas.width / 2 + (Math.random() - 0.5) * 200,
      y: confettiCanvas.height * 0.25 + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -7 - 3,
      size: Math.random() * 7 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 0
    });
  }
  let frame = 0;
  function tick() {
    frame++;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let alive = false;
    particles.forEach(p => {
      p.vy += 0.18; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
      if (p.y < confettiCanvas.height + 40) alive = true;
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.globalAlpha = Math.max(0, 1 - p.life / 140);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      confettiCtx.restore();
    });
    if (alive && frame < 160) requestAnimationFrame(tick);
    else confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
  tick();
}

/* ---------------------------------------------------------
   9. TOASTS & MODAL
   --------------------------------------------------------- */
function showToast(message, type) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 350);
  }, 3000);
}

const modalOverlay = document.getElementById('modalOverlay');
const modalBox = document.getElementById('modalBox');
function openModal(html) {
  modalBox.innerHTML = html;
  modalOverlay.classList.add('open');
}
function closeModal() { modalOverlay.classList.remove('open'); }
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

function confirmAction(message, onConfirm) {
  openModal(`
    <h3>Are you sure?</h3>
    <p style="margin-bottom:18px;">${escapeHtml(message)}</p>
    <div class="modal-close-row">
      <button class="btn btn-ghost" id="modalCancel">Cancel</button>
      <button class="btn btn-primary" id="modalConfirm" style="margin-left:10px;">Confirm</button>
    </div>
  `);
  document.getElementById('modalCancel').onclick = closeModal;
  document.getElementById('modalConfirm').onclick = () => { closeModal(); onConfirm(); };
}

/* ---------------------------------------------------------
   10. TAB NAVIGATION
   --------------------------------------------------------- */
function goToTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + tab);
  const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
  document.getElementById('tabs').closest('.topbar').classList.remove('menu-open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderTab(tab);
}

function renderTab(tab) {
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'swot') renderSwot();
  if (tab === 'risk') renderRisk();
  if (tab === 'checklist') renderChecklist();
  if (tab === 'milestones') renderMilestones();
  if (tab === 'investor') renderInvestor();
  if (tab === 'compare') renderCompare();
  if (tab === 'saved') renderSaved();
  if (tab === 'results') renderResultsIfPresent();
}

/* ---------------------------------------------------------
   11. DASHBOARD
   --------------------------------------------------------- */
function renderDashboard() {
  const total = ideas.length;
  const avg = total ? Math.round(ideas.reduce((s, i) => s + (i.scores ? i.scores.health : 0), 0) / total) : 0;
  const top = ideas.slice().sort((a, b) => (b.scores ? b.scores.health : 0) - (a.scores ? a.scores.health : 0))[0];
  const milestonesDone = ideas.reduce((s, i) => s + i.milestones.filter(m => m.done).length, 0);

  document.getElementById('dashAvgScore').textContent = total ? avg : '--';
  animateCounter(document.getElementById('statTotal'), total);
  animateCounter(document.getElementById('statAvg'), avg);
  animateCounter(document.getElementById('statMilestones'), milestonesDone);
  document.getElementById('statTop').textContent = top ? top.title || 'Untitled' : '—';
  document.getElementById('statTopScore').textContent = top ? `${top.scores ? top.scores.health : 0}/100 health score` : 'no ideas yet';

  const continueContent = document.getElementById('continueContent');
  if (currentIdea && (currentIdea.title || currentIdea.scores)) {
    const idea = currentIdea;
    const score = idea.scores ? idea.scores.health : 0;
    continueContent.classList.remove('continue-empty');
    continueContent.innerHTML = `
      <div class="continue-idea" style="width:100%;">
        <div class="mini-ring-wrap">
          <svg viewBox="0 0 70 70"><circle cx="35" cy="35" r="28" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6"/><circle class="cont-ring" cx="35" cy="35" r="28" fill="none" stroke="${scoreColor(score)}" stroke-width="6" stroke-linecap="round" transform="rotate(-90 35 35)"/></svg>
          <div class="idea-mini-num">${score}</div>
        </div>
        <div class="continue-info">
          <h4>${escapeHtml(idea.title || 'Untitled idea')}</h4>
          <p style="font-size:12.5px;">${idea.scores ? 'Scored — keep refining SWOT, risk and milestones.' : 'Not scored yet — finish the builder form.'}</p>
        </div>
        <button class="btn btn-primary magnetic" id="resumeBtn">Resume</button>
      </div>
    `;
    const ring = continueContent.querySelector('.cont-ring');
    if (ring) setRingProgress(ring, score, scoreColor(score));
    document.getElementById('resumeBtn').onclick = () => goToTab(idea.scores ? 'results' : 'builder');
  } else {
    continueContent.classList.add('continue-empty');
    continueContent.innerHTML = `<p>You haven't validated an idea yet. Start your first one and Orbit will track it here.</p><button class="btn btn-primary magnetic" id="continueCta2">Start Validating</button>`;
    document.getElementById('continueCta2').onclick = () => goToTab('builder');
  }
}

/* ---------------------------------------------------------
   12. BUILDER FORM
   --------------------------------------------------------- */
const formFieldIds = ['ideaTitle', 'targetAudience', 'problemStatement', 'uvp', 'businessModel', 'marketSize', 'revenueStrategy', 'competitors', 'painPoints', 'scalability', 'innovation', 'complexity'];

function fillFormFromIdea(idea) {
  document.getElementById('ideaTitle').value = idea.title || '';
  document.getElementById('targetAudience').value = idea.targetAudience || '';
  document.getElementById('problemStatement').value = idea.problemStatement || '';
  document.getElementById('uvp').value = idea.uvp || '';
  document.getElementById('businessModel').value = idea.businessModel || 'saas';
  document.getElementById('marketSize').value = idea.marketSize || 'growing';
  document.getElementById('revenueStrategy').value = idea.revenueStrategy || '';
  document.getElementById('competitors').value = idea.competitors || '';
  document.getElementById('painPoints').value = idea.painPoints || '';
  document.getElementById('scalability').value = idea.scalability || 3;
  document.getElementById('innovation').value = idea.innovation || 3;
  document.getElementById('complexity').value = idea.complexity || 3;
}

function readFormIntoIdea(idea) {
  idea.title = document.getElementById('ideaTitle').value.trim();
  idea.targetAudience = document.getElementById('targetAudience').value.trim();
  idea.problemStatement = document.getElementById('problemStatement').value.trim();
  idea.uvp = document.getElementById('uvp').value.trim();
  idea.businessModel = document.getElementById('businessModel').value;
  idea.marketSize = document.getElementById('marketSize').value;
  idea.revenueStrategy = document.getElementById('revenueStrategy').value.trim();
  idea.competitors = document.getElementById('competitors').value.trim();
  idea.painPoints = document.getElementById('painPoints').value.trim();
  idea.scalability = parseInt(document.getElementById('scalability').value, 10);
  idea.innovation = parseInt(document.getElementById('innovation').value, 10);
  idea.complexity = parseInt(document.getElementById('complexity').value, 10);
  idea.updatedAt = Date.now();
  return idea;
}

document.getElementById('ideaForm').addEventListener('submit', e => {
  e.preventDefault();
  const idea = getActiveIdea();
  readFormIntoIdea(idea);
  if (!idea.title) { showToast('Give your idea a title first.', 'error'); return; }
  idea.scores = computeScores(idea);
  persistCurrent();
  goToTab('results');
  showToast('Score calculated!', 'success');
});

document.getElementById('resetForm').addEventListener('click', () => {
  confirmAction('Start a brand new idea? Your current draft will stay saved if you already saved it.', () => {
    currentIdea = createBlankIdea();
    saveDraft();
    fillFormFromIdea(currentIdea);
    showToast('Started a new draft.');
  });
});

/* ---------------------------------------------------------
   13. RESULTS
   --------------------------------------------------------- */
function renderResultsIfPresent() {
  const empty = document.getElementById('resultsEmpty');
  const content = document.getElementById('resultsContent');
  if (!currentIdea || !currentIdea.scores) {
    empty.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  content.classList.remove('hidden');
  renderResults(currentIdea);
}

function renderResults(idea) {
  const scores = idea.scores;
  document.getElementById('resultsTitle').textContent = idea.title || 'Untitled idea';
  const rating = ratingForScore(scores.health);
  const ratingEl = document.getElementById('resultsRating');
  ratingEl.textContent = rating.label;

  const healthRing = document.getElementById('healthRing');
  setRingProgress(healthRing, scores.health, scoreColor(scores.health));
  animateCounter(document.getElementById('healthScoreNum'), scores.health, 1300);

  const labels = CATEGORY_KEYS.map(k => CATEGORY_META[k].short);
  drawRadarChart(document.getElementById('radarChart'), labels, [{
    scores: CATEGORY_KEYS.map(k => scores[k]),
    color: '#7c5cff',
    fill: 'rgba(124,92,255,0.22)'
  }]);

  const grid = document.getElementById('scoreGrid');
  grid.innerHTML = CATEGORY_KEYS.map(key => {
    const meta = CATEGORY_META[key];
    const val = scores[key];
    return `
      <div class="score-card" data-key="${key}">
        <div class="score-card-inner">
          <div class="score-face front">
            <div class="score-ring-wrap">
              <svg viewBox="0 0 74 74">
                <circle class="score-ring-track" cx="37" cy="37" r="30"/>
                <circle class="score-ring-fill" data-key="${key}" cx="37" cy="37" r="30" stroke="${meta.color}"/>
              </svg>
              <div class="score-ring-num">${val}</div>
            </div>
            <span class="score-label">${meta.label}</span>
          </div>
          <div class="score-face back">
            <h4 style="color:${meta.color}">${meta.label} — ${val}/100</h4>
            <p>${meta.desc}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.score-ring-fill').forEach(circle => {
    const key = circle.dataset.key;
    setRingProgress(circle, scores[key]);
  });
  grid.querySelectorAll('.score-card').forEach(card => {
    card.addEventListener('click', () => card.classList.toggle('flipped'));
  });

  const insights = generateInsights(idea, scores);
  document.getElementById('insightsList').innerHTML = insights.map(i =>
    `<li class="${i.tone || ''}">${escapeHtml(i.text)}</li>`
  ).join('');

  if (scores.health >= 85) {
    setTimeout(() => fireConfetti(1), 500);
  }
}

document.getElementById('saveIdeaBtn').addEventListener('click', () => {
  if (!currentIdea || !currentIdea.scores) return;
  const idx = ideas.findIndex(i => i.id === currentIdea.id);
  currentIdea.saved = true;
  if (idx === -1) ideas.push(JSON.parse(JSON.stringify(currentIdea)));
  else ideas[idx] = JSON.parse(JSON.stringify(currentIdea));
  saveIdeasList();
  saveDraft();
  showToast('Idea saved to My Ideas.', 'success');
});

function buildSummaryText(idea) {
  const s = idea.scores || {};
  const lines = [];
  lines.push('ORBIT — STARTUP VALIDATION SUMMARY');
  lines.push('='.repeat(40));
  lines.push(`Idea: ${idea.title || 'Untitled'}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push(`HEALTH SCORE: ${s.health ?? '--'}/100 (${ratingForScore(s.health || 0).label})`);
  lines.push('');
  lines.push('CATEGORY SCORES');
  CATEGORY_KEYS.forEach(k => lines.push(`  - ${CATEGORY_META[k].label}: ${s[k] ?? '--'}/100`));
  lines.push('');
  lines.push('IDEA DETAILS');
  lines.push(`  Target audience: ${idea.targetAudience || '-'}`);
  lines.push(`  Problem statement: ${idea.problemStatement || '-'}`);
  lines.push(`  Unique value proposition: ${idea.uvp || '-'}`);
  lines.push(`  Business model: ${BIZ_MODEL_LABEL[idea.businessModel] || '-'}`);
  lines.push(`  Revenue strategy: ${idea.revenueStrategy || '-'}`);
  lines.push(`  Market size: ${MARKET_SIZE_LABEL[idea.marketSize] || '-'}`);
  lines.push(`  Competitors: ${idea.competitors || '-'}`);
  lines.push(`  Customer pain points: ${idea.painPoints || '-'}`);
  lines.push('');
  lines.push('SWOT ANALYSIS');
  ['strengths', 'weaknesses', 'opportunities', 'threats'].forEach(k => {
    lines.push(`  ${k.toUpperCase()}:`);
    (idea.swot[k] || []).forEach(item => lines.push(`    - ${item.text}`));
    if (!idea.swot[k] || !idea.swot[k].length) lines.push('    (none added)');
  });
  lines.push('');
  lines.push('VALIDATION CHECKLIST');
  idea.checklist.forEach(c => lines.push(`  [${c.done ? 'x' : ' '}] ${c.text}`));
  lines.push('');
  lines.push('MILESTONES');
  idea.milestones.forEach(m => lines.push(`  [${m.done ? 'x' : ' '}] ${m.title} (${formatDate(m.date)})`));
  if (!idea.milestones.length) lines.push('  (none added)');
  lines.push('');
  lines.push('RISKS');
  idea.risks.forEach(r => lines.push(`  - ${r.title} | likelihood ${r.likelihood}/5, impact ${r.impact}/5 | mitigation: ${r.mitigation || '-'}`));
  if (!idea.risks.length) lines.push('  (none logged)');
  return lines.join('\n');
}

document.getElementById('downloadSummaryBtn').addEventListener('click', () => {
  if (!currentIdea) return;
  const text = buildSummaryText(currentIdea);
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(currentIdea.title || 'idea').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-validation-summary.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast('Summary downloaded.');
});

document.getElementById('printReportBtn').addEventListener('click', () => {
  if (!currentIdea || !currentIdea.scores) return;
  const idea = currentIdea, s = idea.scores;
  const report = document.getElementById('printReport');
  report.innerHTML = `
    <h1>Orbit Validation Report</h1>
    <p>${escapeHtml(idea.title || 'Untitled idea')} — generated ${new Date().toLocaleDateString()}</p>
    <p class="pr-score">${s.health}/100 — ${ratingForScore(s.health).label}</p>
    <h2>Category Scores</h2>
    <table>${CATEGORY_KEYS.map(k => `<tr><td>${CATEGORY_META[k].label}</td><td>${s[k]}/100</td></tr>`).join('')}</table>
    <h2>Idea Details</h2>
    <table>
      <tr><td>Target audience</td><td>${escapeHtml(idea.targetAudience || '-')}</td></tr>
      <tr><td>Problem</td><td>${escapeHtml(idea.problemStatement || '-')}</td></tr>
      <tr><td>UVP</td><td>${escapeHtml(idea.uvp || '-')}</td></tr>
      <tr><td>Business model</td><td>${BIZ_MODEL_LABEL[idea.businessModel]}</td></tr>
      <tr><td>Market size</td><td>${MARKET_SIZE_LABEL[idea.marketSize]}</td></tr>
    </table>
    <h2>SWOT</h2>
    <table>
      <tr><td>Strengths</td><td>${idea.swot.strengths.map(s2 => escapeHtml(s2.text)).join('; ') || '-'}</td></tr>
      <tr><td>Weaknesses</td><td>${idea.swot.weaknesses.map(s2 => escapeHtml(s2.text)).join('; ') || '-'}</td></tr>
      <tr><td>Opportunities</td><td>${idea.swot.opportunities.map(s2 => escapeHtml(s2.text)).join('; ') || '-'}</td></tr>
      <tr><td>Threats</td><td>${idea.swot.threats.map(s2 => escapeHtml(s2.text)).join('; ') || '-'}</td></tr>
    </table>
  `;
  window.print();
});

/* ---------------------------------------------------------
   14. SWOT
   --------------------------------------------------------- */
function renderSwot() {
  const idea = getActiveIdea();
  document.getElementById('swotActiveLabel').innerHTML = `Editing SWOT for: <strong>${escapeHtml(idea.title || 'Untitled idea')}</strong>`;
  ['strengths', 'weaknesses', 'opportunities', 'threats'].forEach(quad => {
    const list = idea.swot[quad] || [];
    const listEl = document.querySelector(`.swot-list[data-list="${quad}"]`);
    if (!list.length) {
      listEl.innerHTML = `<div class="swot-empty">Nothing added yet.</div>`;
      return;
    }
    listEl.innerHTML = list.map((item, i) => `
      <div class="swot-card" draggable="true" data-quad="${quad}" data-index="${i}">
        <div class="swot-card-text" data-id="${item.id}">${escapeHtml(item.text)}</div>
        <div class="swot-card-actions">
          <button class="edit-swot" title="Edit">✎</button>
          <button class="delete-swot" title="Delete">✕</button>
        </div>
      </div>
    `).join('');
  });
  bindSwotDrag();
}

document.querySelectorAll('.swot-quad').forEach(quad => {
  const quadKey = quad.dataset.quad;
  const input = quad.querySelector('.swot-input');
  const addBtn = quad.querySelector('.btn-mini');
  function addItem() {
    const val = input.value.trim();
    if (!val) return;
    const idea = getActiveIdea();
    idea.swot[quadKey].push({ id: genId(), text: val });
    input.value = '';
    persistCurrent();
    renderSwot();
  }
  addBtn.addEventListener('click', addItem);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } });

  quad.querySelector('.swot-list').addEventListener('click', e => {
    const card = e.target.closest('.swot-card');
    if (!card) return;
    const idx = parseInt(card.dataset.index, 10);
    const idea = getActiveIdea();
    if (e.target.classList.contains('delete-swot')) {
      idea.swot[quadKey].splice(idx, 1);
      persistCurrent();
      renderSwot();
    } else if (e.target.classList.contains('edit-swot')) {
      const textEl = card.querySelector('.swot-card-text');
      const current = idea.swot[quadKey][idx].text;
      textEl.innerHTML = `<textarea>${escapeHtml(current)}</textarea><div style="margin-top:6px;display:flex;gap:6px;"><button class="btn-mini save-swot-edit">Save</button></div>`;
      const ta = textEl.querySelector('textarea');
      ta.focus();
      textEl.querySelector('.save-swot-edit').addEventListener('click', () => {
        idea.swot[quadKey][idx].text = ta.value.trim() || current;
        persistCurrent();
        renderSwot();
      });
    }
  });
});

function bindSwotDrag() {
  document.querySelectorAll('.swot-card').forEach(card => {
    card.addEventListener('dragstart', () => card.classList.add('dragging'));
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  document.querySelectorAll('.swot-list').forEach(list => {
    list.addEventListener('dragover', e => {
      e.preventDefault();
      const dragging = list.querySelector('.dragging');
      if (!dragging) return;
      const siblings = [...list.querySelectorAll('.swot-card:not(.dragging)')];
      const next = siblings.find(sib => e.clientY < sib.getBoundingClientRect().top + sib.offsetHeight / 2);
      if (next) list.insertBefore(dragging, next); else list.appendChild(dragging);
    });
    list.addEventListener('drop', () => {
      const quad = list.dataset.list;
      const idea = getActiveIdea();
      const newOrderIds = [...list.querySelectorAll('.swot-card-text')].map(t => t.dataset.id);
      idea.swot[quad] = newOrderIds.map(id => idea.swot[quad].find(it => it.id === id)).filter(Boolean);
      persistCurrent();
      renderSwot();
    });
  });
}

/* ---------------------------------------------------------
   15. RISK MATRIX
   --------------------------------------------------------- */
function severityClass(score) { if (score <= 6) return 'sev-low'; if (score <= 14) return 'sev-mid'; return 'sev-high'; }
function severityColor(score) { if (score <= 6) return 'rgba(61,220,151,'; if (score <= 14) return 'rgba(255,178,63,'; return 'rgba(255,92,122,'; }

function renderRisk() {
  const idea = getActiveIdea();
  const matrix = document.getElementById('riskMatrix');
  let cellsHtml = '';
  for (let impact = 5; impact >= 1; impact--) {
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      const sev = impact * likelihood;
      const count = idea.risks.filter(r => r.impact === impact && r.likelihood === likelihood).length;
      const alpha = 0.12 + Math.min(0.55, sev / 25 * 0.55);
      cellsHtml += `<div class="risk-cell" style="background:${severityColor(sev)}${alpha})">${count ? `<span class="risk-badge">${count}</span>` : ''}</div>`;
    }
  }
  matrix.innerHTML = cellsHtml;

  const listEl = document.getElementById('riskList');
  if (!idea.risks.length) {
    listEl.innerHTML = `<p style="color:var(--text-faint);font-size:13px;">No risks logged yet — add one on the left.</p>`;
  } else {
    listEl.innerHTML = idea.risks.map((r, i) => {
      const sev = r.impact * r.likelihood;
      return `
        <div class="risk-item ${severityClass(sev)}" data-index="${i}">
          <div class="risk-item-main">
            <h4>${escapeHtml(r.title)}</h4>
            <p>${escapeHtml(r.mitigation || 'No mitigation plan recorded.')}</p>
          </div>
          <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
            <span class="risk-item-meta">L${r.likelihood} × I${r.impact} = ${sev}</span>
            <button class="remove-risk" data-index="${i}">Remove</button>
          </div>
        </div>
      `;
    }).join('');
  }
  listEl.querySelectorAll('.remove-risk').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      idea.risks.splice(i, 1);
      persistCurrent();
      renderRisk();
    });
  });
}

document.getElementById('addRiskBtn').addEventListener('click', () => {
  const title = document.getElementById('riskTitle').value.trim();
  if (!title) { showToast('Describe the risk first.', 'error'); return; }
  const idea = getActiveIdea();
  idea.risks.push({
    id: genId(), title,
    likelihood: parseInt(document.getElementById('riskLikelihood').value, 10),
    impact: parseInt(document.getElementById('riskImpact').value, 10),
    mitigation: document.getElementById('riskMitigation').value.trim()
  });
  document.getElementById('riskTitle').value = '';
  document.getElementById('riskMitigation').value = '';
  persistCurrent();
  renderRisk();
  showToast('Risk added to matrix.');
});

/* ---------------------------------------------------------
   16. CHECKLIST
   --------------------------------------------------------- */
function renderChecklist() {
  const idea = getActiveIdea();
  const groups = {};
  idea.checklist.forEach(item => {
    const g = item.group || 'Your additions';
    groups[g] = groups[g] || [];
    groups[g].push(item);
  });
  const container = document.getElementById('checklistGroups');
  container.innerHTML = Object.keys(groups).map(g => `
    <h4 style="margin:14px 0 6px;font-size:13px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;">${escapeHtml(g)}</h4>
    ${groups[g].map(item => `
      <div class="check-item ${item.done ? 'done' : ''}" data-id="${item.id}">
        <input type="checkbox" ${item.done ? 'checked' : ''}>
        <span class="label">${escapeHtml(item.text)}</span>
        <button class="remove-item" title="Remove">✕</button>
      </div>
    `).join('')}
  `).join('');

  const done = idea.checklist.filter(c => c.done).length;
  const pct = idea.checklist.length ? Math.round((done / idea.checklist.length) * 100) : 0;
  document.getElementById('checklistFill').style.width = pct + '%';
  animateCounter(document.getElementById('checklistPct'), pct, 800);

  container.querySelectorAll('.check-item').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('input').addEventListener('change', e => {
      const item = idea.checklist.find(c => c.id === id);
      item.done = e.target.checked;
      persistCurrent();
      renderChecklist();
      if (item.done) showToast('Nice — checklist item complete.', 'success');
    });
    row.querySelector('.remove-item').addEventListener('click', () => {
      idea.checklist = idea.checklist.filter(c => c.id !== id);
      persistCurrent();
      renderChecklist();
    });
  });
}

document.getElementById('addChecklistItemBtn').addEventListener('click', () => {
  const input = document.getElementById('customChecklistInput');
  const val = input.value.trim();
  if (!val) return;
  const idea = getActiveIdea();
  idea.checklist.push({ id: genId(), text: val, group: 'Your additions', done: false });
  input.value = '';
  persistCurrent();
  renderChecklist();
});

/* ---------------------------------------------------------
   17. MILESTONES
   --------------------------------------------------------- */
function renderMilestones() {
  const idea = getActiveIdea();
  const sorted = idea.milestones.slice().sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  const timeline = document.getElementById('milestoneTimeline');
  if (!sorted.length) {
    timeline.innerHTML = `<p class="timeline-empty">No milestones yet. Add your next concrete step above.</p>`;
    return;
  }
  timeline.innerHTML = sorted.map(m => `
    <div class="milestone-item ${m.done ? 'done' : ''}" data-id="${m.id}">
      <span class="milestone-dot"></span>
      <div class="milestone-main">
        <h4>${escapeHtml(m.title)}</h4>
        <span class="milestone-date">${m.date ? formatDate(m.date) : 'No date set'}</span>
      </div>
      <div class="milestone-actions">
        <button class="mark-done">${m.done ? 'Completed ✓' : 'Mark done'}</button>
        <button class="remove">Remove</button>
      </div>
    </div>
  `).join('');

  timeline.querySelectorAll('.milestone-item').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('.mark-done').addEventListener('click', () => {
      const m = idea.milestones.find(x => x.id === id);
      m.done = !m.done;
      persistCurrent();
      renderMilestones();
      if (m.done) { showToast('Milestone completed! 🎉', 'success'); fireConfetti(0.45); }
    });
    row.querySelector('.remove').addEventListener('click', () => {
      idea.milestones = idea.milestones.filter(x => x.id !== id);
      persistCurrent();
      renderMilestones();
    });
  });
}

document.getElementById('addMilestoneBtn').addEventListener('click', () => {
  const title = document.getElementById('milestoneTitle').value.trim();
  const date = document.getElementById('milestoneDate').value;
  if (!title) { showToast('Give the milestone a title.', 'error'); return; }
  const idea = getActiveIdea();
  idea.milestones.push({ id: genId(), title, date, done: false });
  document.getElementById('milestoneTitle').value = '';
  document.getElementById('milestoneDate').value = '';
  persistCurrent();
  renderMilestones();
  showToast('Milestone added.');
});

/* ---------------------------------------------------------
   18. INVESTOR READINESS
   --------------------------------------------------------- */
function renderInvestor() {
  const idea = getActiveIdea();
  const container = document.getElementById('investorChecklist');
  container.innerHTML = idea.investor.map(item => `
    <div class="check-item ${item.done ? 'done' : ''}" data-id="${item.id}">
      <input type="checkbox" ${item.done ? 'checked' : ''}>
      <span class="label">${escapeHtml(item.text)}</span>
    </div>
  `).join('');

  const done = idea.investor.filter(c => c.done).length;
  const pct = idea.investor.length ? Math.round((done / idea.investor.length) * 100) : 0;
  const ring = document.getElementById('investorRing');
  setRingProgress(ring, pct, scoreColor(pct));
  animateCounter(document.getElementById('investorScoreNum'), pct, 1100);

  container.querySelectorAll('.check-item input').forEach(cb => {
    cb.addEventListener('change', e => {
      const id = cb.closest('.check-item').dataset.id;
      idea.investor.find(c => c.id === id).done = e.target.checked;
      persistCurrent();
      renderInvestor();
    });
  });
}

/* ---------------------------------------------------------
   19. COMPARE
   --------------------------------------------------------- */
function renderCompare() {
  const picker = document.getElementById('comparePicker');
  if (!ideas.length) {
    picker.innerHTML = `<p style="color:var(--text-faint);font-size:13px;">Save at least 2 ideas to compare them.</p>`;
    document.getElementById('compareResults').classList.add('hidden');
    return;
  }
  picker.innerHTML = ideas.map(i => `
    <label class="compare-pick-card ${compareSelection.includes(i.id) ? 'checked' : ''}" data-id="${i.id}">
      <input type="checkbox" ${compareSelection.includes(i.id) ? 'checked' : ''}>
      <span class="cp-title">${escapeHtml(i.title || 'Untitled')}</span>
      <span class="cp-score">${i.scores ? i.scores.health : 0}/100</span>
    </label>
  `).join('');

  picker.querySelectorAll('.compare-pick-card').forEach(card => {
    card.addEventListener('click', e => {
      e.preventDefault();
      const id = card.dataset.id;
      if (compareSelection.includes(id)) compareSelection = compareSelection.filter(x => x !== id);
      else { if (compareSelection.length >= 4) { showToast('You can compare up to 4 ideas at once.', 'error'); return; } compareSelection.push(id); }
      renderCompare();
    });
  });

  const resultsWrap = document.getElementById('compareResults');
  if (compareSelection.length < 2) { resultsWrap.classList.add('hidden'); return; }
  resultsWrap.classList.remove('hidden');

  const selectedIdeas = compareSelection.map(id => ideas.find(i => i.id === id)).filter(Boolean);
  const palette = ['#7c5cff', '#2fe6d9', '#ffb23f', '#ff5c7a'];
  const labels = CATEGORY_KEYS.map(k => CATEGORY_META[k].short);
  const datasets = selectedIdeas.map((idea, i) => ({
    scores: CATEGORY_KEYS.map(k => idea.scores ? idea.scores[k] : 0),
    color: palette[i % palette.length],
    fill: palette[i % palette.length] + '33'
  }));
  drawRadarChart(document.getElementById('compareRadar'), labels, datasets);

  document.getElementById('compareLegend').innerHTML = selectedIdeas.map((idea, i) =>
    `<span><i style="background:${palette[i % palette.length]}"></i>${escapeHtml(idea.title || 'Untitled')}</span>`
  ).join('');

  const rows = [
    ['Health Score', selectedIdeas.map(i => i.scores ? i.scores.health : 0)],
    ...CATEGORY_KEYS.map(k => [CATEGORY_META[k].label, selectedIdeas.map(i => i.scores ? i.scores[k] : 0)]),
    ['Market Size', selectedIdeas.map(i => MARKET_SIZE_LABEL[i.marketSize])],
    ['Business Model', selectedIdeas.map(i => BIZ_MODEL_LABEL[i.businessModel])]
  ];
  const table = document.getElementById('compareTable');
  table.innerHTML = `
    <thead><tr><th>Metric</th>${selectedIdeas.map(i => `<th>${escapeHtml(i.title || 'Untitled')}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map(([label, vals]) => {
        const numeric = vals.every(v => typeof v === 'number');
        const max = numeric ? Math.max(...vals) : null;
        return `<tr><td>${label}</td>${vals.map(v => `<td class="${numeric && v ===
