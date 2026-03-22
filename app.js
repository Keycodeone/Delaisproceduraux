/* ===================================================
   DÉLAIS PROCÉDURAUX — app.js
   Logique : calcul délais, jours fériés FR, PDF, ICS
   =================================================== */

'use strict';

/* ─── CONSTANTES ─── */
const ACTES = {
  'opposition:10':    { label: 'Formation d\'Opposition',    jours: 10 },
  'assignation:15':   { label: 'Réponse à Assignation',     jours: 15 },
  'contestation:60':  { label: 'Contestation de Décision',  jours: 60 },
  'appel:30':         { label: 'Déclaration d\'Appel',       jours: 30 },
  'cassation:60':     { label: 'Pourvoi en Cassation',       jours: 60 },
  'administratif:60': { label: 'Recours Administratif',      jours: 60 },
  'conclusions:90':   { label: 'Dépôt de Conclusions',       jours: 90 },
  'autre:0':          { label: 'Autre',                      jours: 0  },
};

/* ─── JOURS FÉRIÉS MÉTROPOLITAINS ─── */

/**
 * Algorithme de Meeus/Jones/Butcher — Pâques (calendrier grégorien)
 * @param {number} year
 * @returns {Date} dimanche de Pâques
 */
function getEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

/**
 * Retourne les 11 jours fériés légaux français pour une année donnée.
 * Stockage en Set de chaînes 'YYYY-MM-DD' pour lookup O(1).
 * @param {number} year
 * @returns {Set<string>}
 */
const _feriéCache = {};
function getFeries(year) {
  if (_feriéCache[year]) return _feriéCache[year];

  const easter = getEaster(year);
  const DAY = 24 * 3600 * 1000;

  const dates = [
    // Fêtes fixes
    new Date(year, 0,  1),  // Jour de l'An
    new Date(year, 4,  1),  // Fête du Travail
    new Date(year, 4,  8),  // Victoire 1945
    new Date(year, 6, 14),  // Fête Nationale
    new Date(year, 7, 15),  // Assomption
    new Date(year, 10,  1), // Toussaint
    new Date(year, 10, 11), // Armistice
    new Date(year, 11, 25), // Noël
    // Fêtes mobiles (basées sur Pâques)
    new Date(easter.getTime() +  1 * DAY),  // Lundi de Pâques
    new Date(easter.getTime() + 39 * DAY),  // Ascension
    new Date(easter.getTime() + 50 * DAY),  // Lundi de Pentecôte
  ];

  const set = new Set(dates.map(d => toISO(d)));
  _feriéCache[year] = set;
  return set;
}

/* ─── HELPERS DATE ─── */

/** Formatte une Date en 'YYYY-MM-DD' (locale-safe) */
function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Parse une chaîne 'YYYY-MM-DD' en Date locale (sans décalage TZ) */
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Vérifie si une date est un weekend */
function isWeekend(d) {
  const dow = d.getDay();
  return dow === 0 || dow === 6; // 0=dim, 6=sam
}

/** Vérifie si une date est fériée */
function isFerie(d) {
  return getFeries(d.getFullYear()).has(toISO(d));
}

/** Vérifie si une date est non ouvrable (weekend ou férié) */
function isNonOuvre(d) {
  return isWeekend(d) || isFerie(d);
}

/**
 * Avance une date au prochain jour ouvré si elle tombe un non-ouvrable.
 * @param {Date} d
 * @returns {Date} nouveau Date (ne modifie pas l'original)
 */
function prochainJourOuvre(d) {
  const result = new Date(d);
  while (isNonOuvre(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/* ─── CALCUL PRINCIPAL ─── */

/**
 * Calcule la date limite procédurale.
 * Les délais légaux et l'ajustement sont en jours CALENDAIRES.
 * Si la date résultante tombe un weekend/férié, report au prochain jour ouvré.
 *
 * @param {Date}   dateNotif  - date de notification
 * @param {number} delaiJours - délai légal en jours calendaires
 * @param {number} ajustJours - ajustement en jours calendaires (peut être négatif)
 * @returns {{ deadline: Date, adjustedWeekend: boolean }}
 */
function calculerDelai(dateNotif, delaiJours, ajustJours) {
  const rawDeadline = new Date(dateNotif);
  rawDeadline.setDate(rawDeadline.getDate() + delaiJours + ajustJours);

  const nonOuvre = isNonOuvre(rawDeadline);
  const deadline = prochainJourOuvre(rawDeadline);

  return { deadline, reportee: nonOuvre };
}

/* ─── FORMATAGE ─── */

const JOURS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const MOIS  = ['janvier','février','mars','avril','mai','juin',
                'juillet','août','septembre','octobre','novembre','décembre'];

function formatDateFR(d) {
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Nettoie les emojis et caractères spéciaux (pour PDF) */
function stripEmojis(str) {
  return (str || '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\uFE00-\uFE0F]/g, '')
    .trim();
}

/* ─── DOM ELEMENTS ─── */

const elTypeActe    = document.getElementById('type-acte');
const elGroupAutre  = document.getElementById('group-autre');
const elDureeAutre  = document.getElementById('duree-autre');
const elDateNotif   = document.getElementById('date-notif');
const elCbAjust     = document.getElementById('cb-ajust');
const elAjustWrapper= document.getElementById('ajust-wrapper');
const elBtnPlus     = document.getElementById('btn-sign-plus');
const elBtnMinus    = document.getElementById('btn-sign-minus');
const elAjustJours  = document.getElementById('ajust-jours');
const elRemarques   = document.getElementById('remarques');
const elCharCounter = document.getElementById('char-counter');
const elBtnCalc     = document.getElementById('btn-calculer');
const elModal       = document.getElementById('modal-overlay');
const elModalClose  = document.getElementById('btn-modal-close');
const elModalDead   = document.getElementById('modal-title');
const elResType     = document.getElementById('res-type-val');
const elResDureeSpec= document.getElementById('res-duree-spec');
const elResDurVal   = document.getElementById('res-duree-spec-val');
const elResNotif    = document.getElementById('res-notif-val');
const elResAjust    = document.getElementById('res-ajust');
const elResAjustVal = document.getElementById('res-ajust-val');
const elResRem      = document.getElementById('res-remarques');
const elResRemVal   = document.getElementById('res-remarques-val');
const elBtnCal      = document.getElementById('btn-calendrier');
const elBtnPdf      = document.getElementById('btn-pdf');
const elToast       = document.getElementById('toast');

/* ─── INITIALISATION ─── */
document.addEventListener('DOMContentLoaded', () => {
  // Date de notification : aujourd'hui par défaut
  elDateNotif.value = toISO(new Date());
  initEvents();
});

/* ─── EVENTS ─── */
function initEvents() {

  // Type d'acte → afficher/masquer champ "Autre"
  elTypeActe.addEventListener('change', () => {
    const isAutre = elTypeActe.value === 'autre:0';
    elGroupAutre.hidden = !isAutre;
    if (isAutre) elDureeAutre.focus();
  });

  // Checkbox ajustement
  elCbAjust.addEventListener('change', () => {
    elAjustWrapper.hidden = !elCbAjust.checked;
    if (elCbAjust.checked) elAjustJours.focus();
  });

  // Boutons signe +/-
  elBtnPlus.addEventListener('click', () => setSign(+1));
  elBtnMinus.addEventListener('click', () => setSign(-1));

  // Compteur de caractères remarques
  elRemarques.addEventListener('input', () => {
    const len = elRemarques.value.length;
    elCharCounter.textContent = `${len}/30`;
    elCharCounter.classList.toggle('warn', len >= 28);
  });

  // Bouton calculer
  elBtnCalc.addEventListener('click', handleCalculer);

  // Modal : fermeture
  elModalClose.addEventListener('click', closeModal);
  elModal.addEventListener('click', (e) => {
    if (e.target === elModal) closeModal();
  });

  // Modal : actions
  elBtnCal.addEventListener('click', exportCalendrier);
  elBtnPdf.addEventListener('click', exportPDF);

  // Fermeture modal avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elModal.hidden) closeModal();
  });
}

function setSign(sign) {
  ajustSign = sign;
  elBtnPlus.setAttribute('aria-pressed', sign === +1 ? 'true' : 'false');
  elBtnMinus.setAttribute('aria-pressed', sign === -1 ? 'true' : 'false');
}

/* ─── VALIDATION ─── */
function validate() {
  let valid = true;

  // Type d'acte
  clearError(elTypeActe);
  if (!elTypeActe.value) {
    showError(elTypeActe, 'Veuillez sélectionner un type d\'acte.');
    valid = false;
  }

  // Durée si "Autre"
  if (elTypeActe.value === 'autre:0') {
    clearError(elDureeAutre);
    const val = parseInt(elDureeAutre.value, 10);
    if (!val || val < 1) {
      showError(elDureeAutre, 'Entrez une durée valide (≥ 1 jour).');
      valid = false;
    }
  }

  // Date de notification
  clearError(elDateNotif);
  if (!elDateNotif.value) {
    showError(elDateNotif, 'Veuillez saisir la date de notification.');
    valid = false;
  }

  // Ajustement
  if (elCbAjust.checked) {
    clearError(elAjustJours);
    const val = parseInt(elAjustJours.value, 10);
    if (!val || val < 1) {
      showError(elAjustJours, 'Entrez un nombre de jours valide (≥ 1).');
      valid = false;
    }
  }

  return valid;
}

function showError(el, msg) {
  el.classList.add('error');
  const err = document.createElement('span');
  err.className = 'error-msg';
  err.textContent = msg;
  err.setAttribute('role', 'alert');
  el.parentNode.appendChild(err);
}

function clearError(el) {
  el.classList.remove('error');
  const existing = el.parentNode.querySelector('.error-msg');
  if (existing) existing.remove();
}

/* ─── CALCUL ─── */
function handleCalculer() {
  if (!validate()) return;

  // Shimmer
  elBtnCalc.classList.remove('shimmer');
  void elBtnCalc.offsetWidth; // reflow
  elBtnCalc.classList.add('shimmer');
  setTimeout(() => elBtnCalc.classList.remove('shimmer'), 600);

  const acteKey  = elTypeActe.value;
  const acte     = ACTES[acteKey];
  const delai    = acteKey === 'autre:0' ? parseInt(elDureeAutre.value, 10) : acte.jours;
  const dateNotif = parseDate(elDateNotif.value);
  const ajust    = elCbAjust.checked ? (ajustSign * parseInt(elAjustJours.value, 10)) : 0;
  const remarques = elRemarques.value.trim();

  const { deadline, reportee } = calculerDelai(dateNotif, delai, ajust);
  currentDeadline = deadline;

  // Stocker les données pour export
  currentData = {
    typeLabel:    acte.label,
    delai,
    isAutre:      acteKey === 'autre:0',
    dateNotif,
    ajust,
    remarques,
    reportee,
  };

  afficherResultat();
}

/* ─── MODAL ─── */
function afficherResultat() {
  const { typeLabel, delai, isAutre, dateNotif, ajust, remarques, reportee } = currentData;

  // Date limite
  let deadlineStr = formatDateFR(currentDeadline);
  if (reportee) deadlineStr += ' *';
  elModalDead.textContent = deadlineStr;

  // Type d'acte
  elResType.textContent = typeLabel;

  // Durée spécifique (si Autre)
  if (isAutre) {
    elResDureeSpec.hidden = false;
    elResDurVal.textContent = `${delai} jour${delai > 1 ? 's' : ''}`;
  } else {
    elResDureeSpec.hidden = true;
  }

  // Notification
  elResNotif.textContent = formatDateFR(dateNotif);

  // Ajustement
  if (ajust !== 0) {
    elResAjust.hidden = false;
    const sign = ajust > 0 ? '+' : '';
    elResAjustVal.textContent = `${sign}${ajust} jour${Math.abs(ajust) > 1 ? 's' : ''} (calendaires)`;
  } else {
    elResAjust.hidden = true;
  }

  // Remarques
  if (remarques) {
    elResRem.hidden = false;
    elResRemVal.textContent = remarques;
  } else {
    elResRem.hidden = true;
  }

  // Note report si weekend/férié
  let note = elModal.querySelector('.modal-note');
  if (reportee) {
    if (!note) {
      note = document.createElement('p');
      note.className = 'modal-note';
      note.style.cssText = 'font-size:0.72rem;color:#7c6fa0;text-align:center;padding:0.5rem 1.5rem 0;font-style:italic;';
      elModal.querySelector('.modal-body').appendChild(note);
    }
    note.textContent = '* Date reportée au prochain jour ouvré.';
  } else if (note) {
    note.remove();
  }

  elModal.hidden = false;
  elModalClose.focus();
}

function closeModal() {
  elModal.hidden = true;
  elBtnCalc.focus();
}

/* ─── EXPORT CALENDRIER (.ics) ─── */
function exportCalendrier() {
  const { typeLabel, remarques } = currentData;
  const iso = toISO(currentDeadline).replace(/-/g, '');
  const isoNext = toISO(new Date(currentDeadline.getTime() + 86400000)).replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const desc = remarques ? stripEmojis(remarques) : '';

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Délais Procéduraux//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:delai-${stamp}@delais-proceduraux`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${iso}`,
    `DTEND;VALUE=DATE:${isoNext}`,
    `SUMMARY:⚖️ Délai : ${stripEmojis(typeLabel)}`,
    desc ? `DESCRIPTION:${desc}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Rappel délai : ${stripEmojis(typeLabel)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `delai-${toISO(currentDeadline)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Fichier calendrier généré ✓');
}

/* ─── EXPORT PDF ─── */
function exportPDF() {
  if (!window.jspdf) {
    showToast('jsPDF non disponible — vérifiez la connexion.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const { typeLabel, delai, isAutre, dateNotif, ajust, remarques } = currentData;

  const marginX = 20;
  const pageW   = 210;
  const contentW = pageW - marginX * 2;

  // ── Header violet ──
  doc.setFillColor(55, 48, 163);       // violet-700
  doc.rect(0, 0, pageW, 38, 'F');
  doc.setFillColor(29, 78, 216);       // blue accent
  doc.rect(0, 34, pageW, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉLAIS PROCÉDURAUX', pageW / 2, 16, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Calculateur procédural — France métropolitaine', pageW / 2, 24, { align: 'center' });

  const genDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.text(`Généré le ${genDate}`, pageW / 2, 31, { align: 'center' });

  // ── Date limite — encart coloré ──
  doc.setFillColor(238, 242, 255);     // violet-50
  doc.roundedRect(marginX, 44, contentW, 22, 3, 3, 'F');
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginX, 44, contentW, 22, 3, 3, 'S');

  doc.setTextColor(55, 48, 163);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DATE LIMITE', pageW / 2, 51, { align: 'center' });

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text(stripEmojis(formatDateFR(currentDeadline)), pageW / 2, 61, { align: 'center' });

  // ── Lignes de détail ──
  let y = 76;
  const rows = [
    { label: 'TYPE D\'ACTE',                  value: stripEmojis(typeLabel) },
    isAutre ? { label: 'DURÉE SPÉCIFIQUE',    value: `${delai} jour${delai > 1 ? 's' : ''}` } : null,
    { label: 'DATE DE NOTIFICATION',          value: stripEmojis(formatDateFR(dateNotif)) },
    ajust !== 0 ? { label: 'AJUSTEMENT',      value: `${ajust > 0 ? '+' : ''}${ajust} jour${Math.abs(ajust) > 1 ? 's' : ''} calendaires` } : null,
    remarques   ? { label: 'REMARQUES',       value: stripEmojis(remarques) } : null,
  ].filter(Boolean);

  rows.forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(marginX, y - 5, contentW, 11, 'F');
    }

    doc.setTextColor(100, 110, 150);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(row.label, marginX + 4, y);

    doc.setTextColor(30, 27, 75);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.text(row.value, marginX + 4, y + 5.5);

    y += 13;
  });

  // ── Footer ──
  doc.setFillColor(245, 245, 250);
  doc.rect(0, 275, pageW, 22, 'F');
  doc.setTextColor(150, 150, 180);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text('Délais calculés selon le Code de procédure civile et le CJA. Jours fériés France métropolitaine.', pageW / 2, 283, { align: 'center' });
  doc.text('Ce document est fourni à titre indicatif. Vérifiez toujours les délais avec un professionnel du droit.', pageW / 2, 289, { align: 'center' });

  const filename = `delai-${toISO(currentDeadline)}.pdf`;
  doc.save(filename);
  showToast('PDF généré ✓');
}

/* ─── TOAST ─── */
let toastTimer = null;
function showToast(msg, duration = 2500) {
  elToast.textContent = msg;
  elToast.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => elToast.classList.add('show'));
  });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    elToast.classList.remove('show');
    setTimeout(() => { elToast.hidden = true; }, 350);
  }, duration);
}

/* ─── SERVICE WORKER ─── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .then(reg => {
        // Vérifier les mises à jour toutes les 60 secondes
        setInterval(() => reg.update(), 60000);
      })
      .catch(err => console.warn('SW registration failed:', err));
  });
}
