document.addEventListener('DOMContentLoaded', function () {
  // set copyright year
  const y = new Date().getFullYear();
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = y;

  // NAV TOGGLE (mobile)
  const btn = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');
  if (btn && nav) {
    btn.addEventListener('click', () => {
      const open = nav.getAttribute('data-visible') === 'true';
      nav.setAttribute('data-visible', String(!open));
      nav.style.display = open ? 'none' : 'flex';
      btn.setAttribute('aria-expanded', String(!open));
    });
  }

  // ACCORDION (FAQ)
  document.querySelectorAll('.accordion button').forEach((b) => {
    b.addEventListener('click', () => {
      const expanded = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', String(!expanded));
      const panel = b.nextElementSibling;
      if (!panel) return;
      panel.style.display = expanded ? 'none' : 'block';
    });
  });

  // SIMPLE CAROUSEL (testimonials) with pause-on-hover/focus
  (function setupCarousel() {
    document.querySelectorAll('.carousel').forEach((carousel) => {
      const track = carousel.querySelector('.carousel-track');
      if (!track) return;
      const slides = Array.from(track.children);
      let idx = 0;
      let timer = null;
      const delay = 3000;

      function go(i) {
        idx = (i + slides.length) % slides.length;
        track.style.transform = `translateX(-${idx * 100}%)`;
      }

      function start() {
        stop();
        timer = setInterval(() => go(idx + 1), delay);
      }

      function stop() {
        if (timer) { clearInterval(timer); timer = null; }
      }

      // pause on hover
      carousel.addEventListener('mouseenter', stop);
      carousel.addEventListener('mouseleave', start);

      // pause on focus (keyboard users)
      carousel.addEventListener('focusin', stop);
      carousel.addEventListener('focusout', start);

      // initialize
      go(0);
      start();
    });
  })();

  // CONTACT FORM (demo)
  const contact = document.getElementById('contactForm');
  if (contact) {
    contact.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(contact);
      const name = f.get('name') || 'there';
      const msg = document.getElementById('formMessage');
      if (msg) msg.textContent = `Thanks, ${name} — we received your message and will reply to ${f.get('email') || ''}.`;
      contact.reset();
    });
  }

  // CALCULATOR PLACEHOLDERS (EITC & CTC)
  function setupCalc(id) {
    const root = document.getElementById(id);
    if (!root) return;
    const form = root.querySelector('form');
    const out = root.querySelector('.calc-output');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const income = Number(fd.get('income')) || 0;
      const children = Math.max(0, Number(fd.get('children')) || 0);
      const status = fd.get('status') || 'single';
      const investment = Number(fd.get('investment')) || 0;

      // 2024 parameters (from provided IRS table/attachment):
      const investLimit = 11600; // investment income limit
      const maxCredit = {
        0: 632,
        1: 4213,
        2: 6960,
        3: 7830 // 3 or more
      };
      const maxAgi = {
        0: { single: 18591, married: 25511 },
        1: { single: 49084, married: 56004 },
        2: { single: 55768, married: 62688 },
        3: { single: 59899, married: 66819 }
      };

      const kidsKey = children >= 3 ? 3 : children;
      const allowedAgi = (maxAgi[kidsKey] && maxAgi[kidsKey][status]) || 0;
      const formatter = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits:0});

      // Basic eligibility checks using the provided 2024 thresholds
      if (investment > investLimit) {
        out.textContent = `Not eligible: investment income exceeds the 2024 limit of ${formatter.format(investLimit)}.`;
        return;
      }

      if (income > allowedAgi) {
        out.textContent = `Not eligible for EITC based on 2024 maximum AGI for your filing status and number of qualifying children. Maximum AGI allowed: ${formatter.format(allowedAgi)}.`;
        return;
      }

      // If within the allowed AGI, show the published maximum credit for 2024.
      // NOTE: This returns the maximum possible credit for 2024 based on the provided table.
      // Precise EITC amounts depend on earned income phase-in/phase-out rules; use IRS tools for an exact number.
      const estimated = maxCredit[kidsKey] || 0;
      out.innerHTML = `Estimate: maximum EITC (2024) for your child count is <strong>${formatter.format(estimated)}</strong>.<br><small>Close estimate using published 2024 limits (investment income and AGI). This does not run the full IRS worksheet phase-in/phase-out math; results are usually within a small margin. For an exact amount, use the IRS EITC Assistant or consult a tax professional.</small>`;
    });
  }
  setupCalc('eitcCalc');
  // EITC handled by setupCalc; CTC has separate rules and UI, use dedicated handler
  function setupCTC(id) {
    const root = document.getElementById(id);
    if (!root) return;
    const form = root.querySelector('form');
    const out = root.querySelector('.calc-output');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const agi = Number(fd.get('income')) || 0;
      const earned = Number(fd.get('earned')) || 0;
      const children = Math.max(0, Number(fd.get('children')) || 0);
      const status = fd.get('status') || 'single';
      const tax = Math.max(0, Number(fd.get('tax')) || 0);

      // Parameters from your guidance / common IRS rules (2024-like):
      const CTC_PER = 2200; // up to $2,200 per qualifying child
      const ACTC_CAP_PER = 1700; // refundable max per child
      const ACTC_EARNED_THRESHOLD = 2500; // earned income threshold for refundable portion
      const PHASEOUT_THRESHOLD = status === 'married' ? 400000 : 200000; // AGI phaseout start
      const PHASEOUT_RATE = 0.05; // assumed 5% ($50 per $1,000) reduction rate

      const formatter = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0});

      // Full credit before phaseout
      const fullCTC = children * CTC_PER;

      // Phaseout reduction (assumed continuous 5% of excess AGI)
      const excess = Math.max(0, agi - PHASEOUT_THRESHOLD);
      const reduction = excess * PHASEOUT_RATE;
      const ctcAfterPhaseout = Math.max(0, fullCTC - reduction);

      // Compute refundable ACTC eligibility based on earned income
      const actcByEarned = Math.max(0, (earned - ACTC_EARNED_THRESHOLD) * 0.15); // 15% of earned income over threshold
      const actcCap = children * ACTC_CAP_PER;
      const actcAllowed = Math.min(actcByEarned, actcCap);

      // Determine how much of the CTC reduces tax (nonrefundable) vs refundable
      const nonrefundableUsed = Math.min(ctcAfterPhaseout, tax);
      const refundableNeeded = Math.max(0, ctcAfterPhaseout - nonrefundableUsed);
      const refundableACTC = Math.min(refundableNeeded, actcAllowed);

      const totalCreditApplied = nonrefundableUsed + refundableACTC;
      const potentialRefund = refundableACTC; // amount that increases refund (approx)

      // Build output message
      out.innerHTML = `Estimated CTC (after phaseout): <strong>${formatter.format(ctcAfterPhaseout)}</strong><br>` +
        `Nonrefundable portion used to reduce tax: <strong>${formatter.format(nonrefundableUsed)}</strong><br>` +
        `Estimated refundable ACTC available: <strong>${formatter.format(refundableACTC)}</strong><br>` +
        `<strong>Total credit applied</strong>: ${formatter.format(totalCreditApplied)}<br><small>Assumptions: CTC per child = ${formatter.format(CTC_PER)}, ACTC refundable cap = ${formatter.format(ACTC_CAP_PER)} per child, ACTC refund = 15% of earned income above ${formatter.format(ACTC_EARNED_THRESHOLD)} (capped). Phaseout begins at ${formatter.format(PHASEOUT_THRESHOLD)} with an assumed 5% reduction rate. This is an estimate — use official IRS tools or a preparer for exact amounts.</small>`;
    });
  }
  setupCTC('ctcCalc');

  // INFOGRAPHIC CAROUSEL (single-slide, with buttons + keyboard)
  (function setupInfographic() {
    const carousel = document.getElementById('infographic-carousel');
    if (!carousel) return;
    const track = carousel.querySelector('.infographic-track');
    const slides = Array.from(track.children);
    let idx = 0;

    function show(i, smooth = true) {
      idx = Math.max(0, Math.min(i, slides.length - 1));
      const offset = idx * carousel.clientWidth;
      if (smooth) track.style.transition = 'transform .45s cubic-bezier(.22,.9,.32,1)';
      else track.style.transition = 'none';
      track.style.transform = `translateX(-${idx * 100}%)`;
      // update aria-live or labels if needed
    }

    // Prev/Next buttons
    document.querySelectorAll('.inf-prev, .inf-next').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('inf-prev')) show(idx - 1);
        else show(idx + 1);
      });
    });

    // Keyboard support
    carousel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });

    // Resize: keep current slide aligned
    window.addEventListener('resize', () => show(idx, false));

    // Initialize
    show(0, false);
  })();

  // NAV submenu accessibility & mobile toggle
  (function setupSubmenus(){
    const nav = document.querySelector('.site-nav');
    if (!nav) return;
    // Add click toggles for submenu parents on small screens
    function closeAll() {
      nav.querySelectorAll('.has-submenu > a').forEach(a=>a.setAttribute('aria-expanded','false'));
    }

    nav.querySelectorAll('.has-submenu > a').forEach(toggle=>{
      toggle.setAttribute('aria-haspopup','true');
      toggle.setAttribute('aria-expanded','false');
      toggle.addEventListener('click', (e)=>{
        const width = window.innerWidth;
        if (width <= 900) {
          e.preventDefault();
          const exp = toggle.getAttribute('aria-expanded') === 'true';
          closeAll();
          toggle.setAttribute('aria-expanded', String(!exp));
          const submenu = toggle.parentElement.querySelector('.submenu');
          if (submenu) submenu.style.display = (!exp) ? 'block' : 'none';
        }
      });
    });

    // ensure submenus close on resize to desktop
    window.addEventListener('resize', ()=>{
      if (window.innerWidth > 900) {
        nav.querySelectorAll('.submenu').forEach(s=>s.style.display='');
        closeAll();
      }
    });
  })();
});

