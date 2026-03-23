/* ─── app.js — Calculateur de délais procéduraux ─────────────────────────── */
'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// 1. JOURS FÉRIÉS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcule la date de Pâques (algorithme de Oudin / Tondering).
 * @param {number} year
 * @returns {Date}
 */
function easterDate(year) {
  const f = Math.floor;
  const G = year % 19;
  const C = f(year / 100);
  const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
  const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
  const L = I - J;
  const month = 3 + f((L + 40) / 44); // 1-indexed
  const day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
}

/**
 * Retourne l'ensemble des jours fériés français métropolitains pour une année.
 * Format clé : "YYYY-MM-DD"
 * @param {number} year
 * @returns {Set<string>}
 */
function getJoursFeries(year) {
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const d = (m, day) => new Date(year, m - 1, day);
  const offset = (base, days) => { const r = new Date(base); r.setDate(r.getDate() + days); return r; };

  const paques = easterDate(year);

  return new Set([
    fmt(d(1, 1)),    // Jour de l'an
    fmt(offset(paques, 1)),  // Lundi de Pâques
    fmt(d(5, 1)),    // Fête du Travail
    fmt(d(5, 8)),    // Victoire 1945
    fmt(offset(paques, 39)), // Ascension (J+39)
    fmt(offset(paques, 50)), // Lundi de Pentecôte (J+50)
    fmt(d(7, 14)),   // Fête nationale
    fmt(d(8, 15)),   // Assomption
    fmt(d(11, 1)),   // Toussaint
    fmt(d(11, 11)),  // Armistice
    fmt(d(12, 25)),  // Noël
  ]);
}

/** Vérifie si une Date est un week-end. */
const isWeekend = d => d.getDay() === 0 || d.getDay() === 6;

/** Formatte une Date en "YYYY-MM-DD". */
function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Reporte une date au premier jour ouvré suivant si elle tombe
 * un week-end ou un jour férié (art. 642 CPC).
 */
function reporterSiNecessaire(date) {
  // On peut avoir besoin de jours fériés sur 2 ans max (si on est fin décembre)
  const feN = getJoursFeries(date.getFullYear());
  const feN1 = getJoursFeries(date.getFullYear() + 1);
  const feries = new Set([...feN, ...feN1]);

  let d = new Date(date);
  while (isWeekend(d) || feries.has(toKey(d))) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. CALCUL PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcule la date limite.
 * @param {Date} dateNotif   - Date de notification (J0)
 * @param {number} delaiJours - Délai de base en jours calendaires
 * @param {number} adjustJours - Ajustement signé en jours calendaires (peut être 0)
 * @returns {Date}
 */
function calculerDateLimite(dateNotif, delaiJours, adjustJours = 0) {
  // J0 + délai + ajustement (tous en jours calendaires)
  const result = new Date(dateNotif);
  result.setDate(result.getDate() + delaiJours + adjustJours);

  // Report si week-end ou férié
  return reporterSiNecessaire(result);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. UTILITAIRES FORMAT
// ═══════════════════════════════════════════════════════════════════════════

const MOIS = ['janvier','février','mars','avril','mai','juin',
              'juillet','août','septembre','octobre','novembre','décembre'];
const JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

/** Formate une Date en "15 mai 2026" */
function formatDateLong(d) {
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Formate une Date en "JJ/MM/AAAA" */
function formatDateCourt(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

/** Nom du jour */
const nomJour = d => JOURS[d.getDay()].charAt(0).toUpperCase() + JOURS[d.getDay()].slice(1);

/** Supprime les emojis d'une chaîne (pour le PDF) */
function stripEmojis(str) {
  return str.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{25AA}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu, '');
}

/** Lit la valeur de l'input date et retourne une Date locale (pas UTC) */
function parseDateInput(val) {
  const [y, m, d] = val.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Formate une Date en "YYYYMMDD" (pour iCal) */
function iCalDate(d) {
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. ÉTAT APPLICATIF
// ═══════════════════════════════════════════════════════════════════════════

let lastResult = null; // { dateLimite, typeLabel, delaiJours, dateNotif, adjust, remarques }

// ═══════════════════════════════════════════════════════════════════════════
// 5. DOM REFERENCES
// ═══════════════════════════════════════════════════════════════════════════

const form          = document.getElementById('delaiForm');
const typeActe      = document.getElementById('typeActe');
const dureeAutreWrap= document.getElementById('dureeAutreWrapper');
const dureeAutreInp = document.getElementById('dureeAutre');
const dateNotifInp  = document.getElementById('dateNotif');
const adjustCheck   = document.getElementById('adjustCheck');
const adjustWrapper = document.getElementById('adjustWrapper');
const adjustDays    = document.getElementById('adjustDays');
const signBtn       = document.getElementById('signBtn');
const remarques     = document.getElementById('remarques');
const charCounter   = document.getElementById('charCounter');
const errorMsg      = document.getElementById('errorMsg');
const btnCalculer   = document.getElementById('btnCalculer');

const modalOverlay  = document.getElementById('modalOverlay');
const modalClose    = document.getElementById('modalClose');
const resultDate    = document.getElementById('resultDate');
const resultDayName = document.getElementById('resultDayName');
const resultList    = document.getElementById('resultList');
const btnCal        = document.getElementById('btnCal');
const btnPdf        = document.getElementById('btnPdf');

// ═══════════════════════════════════════════════════════════════════════════
// 6. INTERACTIONS FORMULAIRE
// ═══════════════════════════════════════════════════════════════════════════

// --- Type d'acte : afficher champ durée si "autre" ---
typeActe.addEventListener('change', () => {
  const isAutre = typeActe.value === 'autre';
  dureeAutreWrap.hidden = !isAutre;
  setTimeout(() => dureeAutreWrap.classList.toggle('visible', isAutre), 10);
  if (!isAutre) dureeAutreInp.value = '';
  clearError();
});

// --- Checkbox ajustement ---
adjustCheck.addEventListener('change', () => {
  const on = adjustCheck.checked;
  adjustWrapper.hidden = false;
  requestAnimationFrame(() => {
    adjustWrapper.classList.toggle('visible', on);
  });
  setTimeout(() => { if (!on) adjustWrapper.hidden = true; }, on ? 0 : 300);
  if (!on) { adjustDays.value = ''; signBtn.dataset.sign = '+'; signBtn.textContent = '+'; }
  clearError();
});

// --- Bouton signe +/- ---
signBtn.addEventListener('click', () => {
  const current = signBtn.dataset.sign;
  const next = current === '+' ? '-' : '+';
  signBtn.dataset.sign = next;
  signBtn.textContent = next;
});

// --- Compteur remarques ---
remarques.addEventListener('input', () => {
  const len = remarques.value.length;
  charCounter.textContent = `${len}/30`;
  charCounter.classList.toggle('warn', len >= 20 && len < 30);
  charCounter.classList.toggle('full', len >= 30);
});

// --- Nettoyer erreur sur interaction ---
[typeActe, dateNotifInp, dureeAutreInp, adjustDays].forEach(el =>
  el && el.addEventListener('input', clearError)
);

function clearError() {
  errorMsg.hidden = true;
  errorMsg.textContent = '';
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. SOUMISSION DU FORMULAIRE
// ═══════════════════════════════════════════════════════════════════════════

form.addEventListener('submit', e => {
  e.preventDefault();
  clearError();

  // — Validation —
  if (!typeActe.value) { showError('Veuillez sélectionner un type d\'acte.'); return; }

  let delaiJours = 0;
  let typeLabel = '';

  const labelMap = {
    '10':             'Formation d\'Opposition',
    '15':             'Réponse à Assignation',
    '60_contestation':'Contestation de Décision',
    '30':             'Déclaration d\'Appel',
    '60_cassation':   'Pourvoi en Cassation',
    '60_admin':       'Recours Administratif',
    '90':             'Dépôt de Conclusions',
    'autre':          'Autre',
  };
  typeLabel = labelMap[typeActe.value] || typeActe.value;

  if (typeActe.value === 'autre') {
    const v = parseInt(dureeAutreInp.value, 10);
    if (!v || v < 1) { showError('Veuillez saisir un nombre de jours valide.'); return; }
    delaiJours = v;
  } else {
    delaiJours = parseInt(typeActe.value, 10);
  }

  if (!dateNotifInp.value) { showError('Veuillez saisir la date de notification.'); return; }
  const dateNotif = parseDateInput(dateNotifInp.value);
  if (isNaN(dateNotif.getTime())) { showError('Date de notification invalide.'); return; }

  // Ajustement
  let adjustSign = signBtn.dataset.sign || '+';
  let adjustVal  = 0;
  if (adjustCheck.checked) {
    const av = parseInt(adjustDays.value, 10);
    if (isNaN(av) || av < 1) { showError('Veuillez saisir un nombre de jours pour l\'ajustement.'); return; }
    adjustVal = adjustSign === '+' ? av : -av;
  }

  const remarquesVal = remarques.value.trim();

  // — Calcul —
  const dateLimite = calculerDateLimite(dateNotif, delaiJours, adjustVal);

  // — Sauvegarde résultat —
  lastResult = {
    dateLimite,
    typeLabel,
    delaiJours,
    dureeAutreLabel: typeActe.value === 'autre' ? `${delaiJours} jours` : null,
    dateNotif,
    adjustVal,
    adjustSign,
    remarques: remarquesVal,
  };

  // — Shimmer effect —
  btnCalculer.disabled = true;
  btnCalculer.classList.add('shimmer');
  setTimeout(() => {
    btnCalculer.classList.remove('shimmer');
    btnCalculer.disabled = false;
    openModal();
  }, 500);
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. MODAL
// ═══════════════════════════════════════════════════════════════════════════

function openModal() {
  const r = lastResult;

  // Date limite
  resultDate.textContent   = formatDateLong(r.dateLimite);
  resultDayName.textContent = nomJour(r.dateLimite);

  // Liste détails
  resultList.innerHTML = '';

  const rows = [
    ['Type d\'acte',   r.typeLabel + (r.delaiJours && typeActe.value !== 'autre' ? ` — ${r.delaiJours} jours` : '')],
    ...(r.dureeAutreLabel ? [['Durée spécifique', r.dureeAutreLabel]] : []),
    ['Notification',   formatDateCourt(r.dateNotif)],
    ...(r.adjustVal !== 0 ? [['Ajustement', `${r.adjustVal > 0 ? '+' : ''}${r.adjustVal} jours calendaires`]] : []),
    ...(r.remarques ? [['Remarques', r.remarques]] : []),
  ];

  rows.forEach(([label, value]) => {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    resultList.appendChild(dt);
    resultList.appendChild(dd);
  });

  modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';

  // Focus piégé dans le modal
  setTimeout(() => modalClose.focus(), 100);
}

function closeModal() {
  modalOverlay.hidden = true;
  document.body.style.overflow = '';
  btnCalculer.focus();
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

// Fermeture clavier
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. EXPORT CALENDRIER (iCal .ics)
// ═══════════════════════════════════════════════════════════════════════════

btnCal.addEventListener('click', () => {
  const r = lastResult;
  if (!r) return;

  const uid  = `delai-${Date.now()}@delais-proceduraux`;
  const now  = iCalDate(new Date());
  const dl   = iCalDate(r.dateLimite);
  const summary = `Délai : ${stripEmojis(r.typeLabel)}`;
  const desc  = [
    `Type : ${stripEmojis(r.typeLabel)}`,
    `Notification : ${formatDateCourt(r.dateNotif)}`,
    r.adjustVal !== 0 ? `Ajustement : ${r.adjustVal > 0 ? '+' : ''}${r.adjustVal} j` : '',
    r.remarques ? `Remarques : ${stripEmojis(r.remarques)}` : '',
  ].filter(Boolean).join('\\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Délais procéduraux//FR',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}T000000Z`,
    `DTSTART;VALUE=DATE:${dl}`,
    `DTEND;VALUE=DATE:${dl}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Rappel : ${summary}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `delai_${r.typeLabel.replace(/\s+/g, '_').toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. GÉNÉRATION PDF (jsPDF)
// ═══════════════════════════════════════════════════════════════════════════

btnPdf.addEventListener('click', () => {
  const r = lastResult;
  if (!r || !window.jspdf) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = 210, M = 16, CW = W - 2 * M;

  // ── En-tête coloré dégradé ──────────────────────────────────────────────
  // Fond violet
  doc.setFillColor(75, 46, 154);
  doc.rect(0, 0, W, 42, 'F');
  // Accent bleu
  doc.setFillColor(30, 95, 173);
  doc.rect(W * 0.55, 0, W * 0.45, 42, 'F');
  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('Délais procéduraux', M, 20);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 185, 240);
  doc.text('Calculateur de délais procéduraux — Usage professionnel', M, 28);

  // Date de génération (coin droit)
  const today = formatDateCourt(new Date());
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 240);
  doc.text(`Généré le ${today}`, W - M, 28, { align: 'right' });

  // ── Date limite — bloc proéminent ───────────────────────────────────────
  const dlY = 50;
  doc.setFillColor(248, 244, 255);
  doc.roundedRect(M, dlY - 4, CW, 22, 3, 3, 'F');
  doc.setDrawColor(124, 79, 255);
  doc.setLineWidth(0.5);
  doc.roundedRect(M, dlY - 4, CW, 22, 3, 3, 'D');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(124, 79, 255);
  doc.text('DATE LIMITE', M + 6, dlY + 4);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 15, 60);
  doc.text(formatDateLong(r.dateLimite).toUpperCase(), M + 6, dlY + 14);

  // ── Détails ─────────────────────────────────────────────────────────────
  let y = 82;

  const fields = [
    ['TYPE D\'ACTE',         stripEmojis(r.typeLabel)],
    ...(r.dureeAutreLabel ? [['DURÉE SPÉCIFIQUE',   r.dureeAutreLabel]] : []),
    ['NOTIFICATION',         formatDateLong(r.dateNotif)],
    ...(r.adjustVal !== 0   ? [['AUGMENTATION / DIMINUTION', `${r.adjustVal > 0 ? '+' : ''}${r.adjustVal} jours calendaires`]] : []),
    ...(r.remarques         ? [['REMARQUES',         stripEmojis(r.remarques)]] : []),
  ];

  fields.forEach(([label, value]) => {
    // Fond alternant
    doc.setFillColor(249, 247, 255);
    doc.rect(M, y - 4, CW, 14, 'F');
    doc.setDrawColor(220, 215, 235);
    doc.setLineWidth(0.3);
    doc.rect(M, y - 4, CW, 14, 'D');
    // Barre latérale
    doc.setFillColor(124, 79, 255);
    doc.rect(M, y - 4, 2, 14, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(124, 79, 255);
    doc.text(label, M + 6, y + 2);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 20, 50);
    doc.text(value, M + 6, y + 8);

    y += 18;
  });

  // ── Pied de page ────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(160, 155, 180);
  doc.text('Ce document a été généré automatiquement par Délais procéduraux.', M, 285);
  doc.text('Il ne constitue pas un conseil juridique.', M, 290);
  doc.text(`Page 1/1  |  ${today}`, W - M, 290, { align: 'right' });

  // Ligne séparatrice pied
  doc.setDrawColor(220, 215, 235);
  doc.setLineWidth(0.3);
  doc.line(M, 282, W - M, 282);

  // ── Téléchargement ──────────────────────────────────────────────────────
  const fname = `delai_${stripEmojis(r.typeLabel).replace(/\s+/g,'_').toLowerCase()}_${today.replace(/\//g,'-')}.pdf`;
  doc.save(fname);
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. SERVICE WORKER
// ═══════════════════════════════════════════════════════════════════════════

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => {
        // Mise à jour silencieuse
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nouveau contenu disponible — activation automatique
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(err => console.warn('[SW] Erreur d\'enregistrement :', err));

    // Rechargement si le SW prend le contrôle
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. INIT — date max = aujourd'hui
// ═══════════════════════════════════════════════════════════════════════════

(function init() {
  const today = new Date();
  const yyyy  = today.getFullYear();
  const mm    = String(today.getMonth() + 1).padStart(2, '0');
  const dd    = String(today.getDate()).padStart(2, '0');
  dateNotifInp.max = `${yyyy}-${mm}-${dd}`;
})();
