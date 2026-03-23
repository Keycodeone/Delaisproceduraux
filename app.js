/**
 * app.js — Délais procéduraux
 * Logique métier : calcul des délais, jours fériés FR, export iCal, génération PDF
 */

'use strict';

/* =========================================================
   1. DONNÉES MÉTIER — Types d'actes
   ========================================================= */

const TYPES_ACTES = {
  '10':              { label: "Formation d'Opposition",    jours: 10  },
  '15':              { label: 'Réponse à Assignation',     jours: 15  },
  '60_contestation': { label: 'Contestation de Décision',  jours: 60  },
  '10_appel':        { label: 'Interjeter un Appel',        jours: 10  },
  '60_cassation':    { label: 'Pourvoi en Cassation',       jours: 60  },
  '60_admin':        { label: 'Recours Administratif',      jours: 60  },
  '90':              { label: 'Dépôt de Conclusions',       jours: 90  },
  'autre':           { label: 'Autre',                      jours: null },
};

/* =========================================================
   2. JOURS FÉRIÉS MÉTROPOLITAINS FRANÇAIS
   ========================================================= */

/**
 * Algorithme de Butcher/Meeus pour calculer le dimanche de Pâques.
 * @param {number} annee
 * @returns {Date} Dimanche de Pâques (UTC minuit)
 */
function dimanchePaques(annee) {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31); // 1-indexé
  const jour  = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(annee, mois - 1, jour));
}

/**
 * Retourne l'ensemble des jours fériés métropolitains pour une année.
 * Chaque entrée est une chaîne "YYYY-MM-DD".
 * @param {number} annee
 * @returns {Set<string>}
 */
function joursFerriesAnnee(annee) {
  const paques    = dimanchePaques(annee);
  const lundi     = (p, j) => new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate() + j));
  const fmt       = d => d.toISOString().slice(0, 10);

  const feries = [
    new Date(Date.UTC(annee, 0,  1)),  // Jour de l'An
    lundi(paques, 1),                   // Lundi de Pâques
    new Date(Date.UTC(annee, 4,  1)),  // Fête du Travail
    new Date(Date.UTC(annee, 4,  8)),  // Victoire 1945
    lundi(paques, 39),                  // Ascension (J+39)
    lundi(paques, 50),                  // Lundi de Pentecôte (J+50)
    new Date(Date.UTC(annee, 6, 14)),  // Fête Nationale
    new Date(Date.UTC(annee, 7, 15)),  // Assomption
    new Date(Date.UTC(annee, 10, 1)),  // Toussaint
    new Date(Date.UTC(annee, 10,11)),  // Armistice
    new Date(Date.UTC(annee, 11,25)),  // Noël
  ];

  return new Set(feries.map(fmt));
}

/** Cache des ensembles de jours fériés par année */
const _cacheJF = new Map();

function estFerie(date) {
  const annee = date.getUTCFullYear();
  if (!_cacheJF.has(annee)) _cacheJF.set(annee, joursFerriesAnnee(annee));
  return _cacheJF.get(annee).has(date.toISOString().slice(0, 10));
}

/** Vérifie si la date UTC est un week-end */
function estWeekend(date) {
  const j = date.getUTCDay(); // 0 = dimanche, 6 = samedi
  return j === 0 || j === 6;
}

/** Reporte la date au 1er jour ouvré suivant si nécessaire (art. 642 CPC) */
function reporterAuJourOuvre(date) {
  while (estWeekend(date) || estFerie(date)) {
    date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  }
  return date;
}

/* =========================================================
   3. CALCUL DU DÉLAI
   ========================================================= */

/**
 * Calcule la date limite légale.
 * @param {Date}   dateNotif  - J0 (date de notification)
 * @param {number} delaiJours - Nombre de jours calendaires de base
 * @param {number} ajustement - Ajustement signé en jours calendaires
 * @returns {Date} Date limite ouvrable
 */
function calculerDateLimite(dateNotif, delaiJours, ajustement) {
  const total = delaiJours + ajustement;
  const brute = new Date(Date.UTC(
    dateNotif.getUTCFullYear(),
    dateNotif.getUTCMonth(),
    dateNotif.getUTCDate() + total
  ));
  return reporterAuJourOuvre(brute);
}

/* =========================================================
   4. FORMATAGE
   ========================================================= */

const MOIS_FR = [
  'janvier','février','mars','avril','mai','juin',
  'juillet','août','septembre','octobre','novembre','décembre'
];

/** Formate une Date UTC en "JJ mois AAAA" */
function formatDateFR(date) {
  const j = String(date.getUTCDate()).padStart(2, '0');
  const m = MOIS_FR[date.getUTCMonth()];
  const a = date.getUTCFullYear();
  return `${j} ${m} ${a}`;
}

/** Formate une Date UTC en "YYYYMMDD" pour l'export iCal */
function formatICalDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Supprime les emojis et caractères non-ASCII parasites */
function supprimerEmojis(str) {
  return str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
}

/* =========================================================
   5. EXPORT iCAL (.ics)
   ========================================================= */

/**
 * Génère un fichier .ics et déclenche son téléchargement.
 */
function exporterICS(params) {
  const { labelType, dateNotif, dateLimite, remarques } = params;
  const uid = `delais-${Date.now()}@delais-proceduraux`;
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtStart = formatICalDate(dateLimite);
  const summary = `Délai — ${supprimerEmojis(labelType)}`;
  const desc    = remarques ? `Remarques : ${supprimerEmojis(remarques)}` : '';
  const notifFmt = formatDateFR(dateNotif);

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Délais procéduraux//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtStart}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:Notification : ${notifFmt}${desc ? '\\n' + desc : ''}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel délai procédural demain',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'delai-procedural.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* =========================================================
   6. GÉNÉRATION PDF (jsPDF)
   ========================================================= */

function genererPDF(params) {
  const { labelType, dureeSpecifique, dateNotifStr, ajustementStr, remarques, dateLimite } = params;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // --- En-tête dégradé violet-bleu ---
  const headerH = 40;
  // Simulation dégradé avec rectangles progressifs
  const steps = 60;
  for (let i = 0; i < steps; i++) {
    const t   = i / (steps - 1);
    const r   = Math.round(75  + (30  - 75)  * t);
    const g   = Math.round(46  + (95  - 46)  * t);
    const b   = Math.round(154 + (173 - 154) * t);
    doc.setFillColor(r, g, b);
    doc.rect((pageW / steps) * i, 0, pageW / steps + 0.5, headerH, 'F');
  }

  // Titre dans l'en-tête
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Délais procéduraux', pageW / 2, 18, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Récapitulatif de calcul', pageW / 2, 28, { align: 'center' });

  // --- Corps ---
  doc.setTextColor(26, 26, 46);
  let y = headerH + 14;

  const ligneKV = (cle, valeur, obligatoire = true) => {
    if (!valeur && !obligatoire) return;
    const valPropre = supprimerEmojis(String(valeur || '—'));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 122);
    doc.text(cle.toUpperCase(), 20, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(26, 26, 46);
    doc.text(valPropre, 20, y);
    y += 9;
  };

  ligneKV("Type d'acte", supprimerEmojis(labelType));
  if (dureeSpecifique) ligneKV('Durée spécifique', `${dureeSpecifique} jours calendaires`, false);
  ligneKV('Notification', dateNotifStr);
  if (ajustementStr) ligneKV('Ajustement', ajustementStr, false);
  if (remarques)     ligneKV('Remarques', supprimerEmojis(remarques), false);

  // Séparateur
  y += 2;
  doc.setDrawColor(200, 195, 235);
  doc.setLineWidth(0.4);
  doc.line(20, y, pageW - 20, y);
  y += 10;

  // Date limite encadrée
  const dateLimiteTxt = formatDateFR(dateLimite);
  const boxW = pageW - 40;
  const boxH = 28;
  doc.setFillColor(240, 239, 255);
  doc.setDrawColor(75, 46, 154);
  doc.setLineWidth(1.2);
  doc.roundedRect(20, y, boxW, boxH, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 122);
  doc.text('DATE LIMITE', pageW / 2, y + 8, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(75, 46, 154);
  doc.text(dateLimiteTxt, pageW / 2, y + 20, { align: 'center' });

  // --- Pied de page ---
  const dateGen = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(150, 140, 180);
  doc.text(
    `Document généré par Délais procéduraux — ${dateGen}`,
    pageW / 2, pageH - 10,
    { align: 'center' }
  );

  doc.save('delai-procedural.pdf');
}

/* =========================================================
   7. INTERFACE — DOM
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  // --- Références DOM ---
  const form          = document.getElementById('delaisForm');
  const selType       = document.getElementById('typeActe');
  const autreGroup    = document.getElementById('autreGroup');
  const autreJours    = document.getElementById('autreJours');
  const dateNotifEl   = document.getElementById('dateNotif');
  const ajustCheck    = document.getElementById('ajustCheck');
  const ajustGroup    = document.getElementById('ajustGroup');
  const ajustJours    = document.getElementById('ajustJours');
  const ajustSigne    = document.getElementById('ajustSigne');
  const remarquesEl   = document.getElementById('remarques');
  const remarquesCount= document.getElementById('remarquesCount');
  const btnCalculer   = document.getElementById('btnCalculer');
  const modal         = document.getElementById('resultatModal');
  const modalClose    = document.getElementById('modalClose');
  const resultList    = document.getElementById('resultList');
  const resultDate    = document.getElementById('resultDate');
  const btnExportCal  = document.getElementById('btnExportCal');
  const btnExportPDF  = document.getElementById('btnExportPDF');

  // Empêcher les dates futures dans le sélecteur de date
  const today = new Date().toISOString().slice(0, 10);
  dateNotifEl.setAttribute('max', today);

  // --- Type d'acte → afficher/masquer champ Autre ---
  selType.addEventListener('change', () => {
    const isAutre = selType.value === 'autre';
    autreGroup.classList.toggle('visible', isAutre);
    autreGroup.setAttribute('aria-hidden', String(!isAutre));
    if (!isAutre) {
      autreJours.value = '';
      clearError('autreJours');
    }
  });

  // --- Case ajustement ---
  ajustCheck.addEventListener('change', () => {
    const checked = ajustCheck.checked;
    ajustGroup.classList.toggle('visible', checked);
    ajustGroup.setAttribute('aria-hidden', String(!checked));
    if (!checked) {
      ajustJours.value = '';
      clearError('ajust');
    }
  });

  // --- Compteur de caractères pour les remarques ---
  remarquesEl.addEventListener('input', () => {
    const len = remarquesEl.value.length;
    remarquesCount.textContent = `${len}/30`;
    remarquesCount.classList.toggle('warn', len >= 28);
  });

  // --- Validation & nettoyage d'erreurs ---
  function setError(fieldId, msg) {
    const el = document.getElementById(`${fieldId}Error`);
    if (el) el.textContent = msg;
  }
  function clearError(fieldId) {
    const el = document.getElementById(`${fieldId}Error`);
    if (el) el.textContent = '';
  }
  function clearAllErrors() {
    ['typeActe','autreJours','dateNotif','ajust'].forEach(clearError);
  }

  function validerFormulaire() {
    let valide = true;
    clearAllErrors();

    if (!selType.value) {
      setError('typeActe', 'Veuillez sélectionner un type d\'acte.');
      valide = false;
    }

    if (selType.value === 'autre') {
      const v = parseInt(autreJours.value, 10);
      if (!autreJours.value || isNaN(v) || v < 1) {
        setError('autreJours', 'Veuillez saisir un nombre de jours valide (≥ 1).');
        valide = false;
      }
    }

    if (!dateNotifEl.value) {
      setError('dateNotif', 'Veuillez saisir la date de notification.');
      valide = false;
    } else if (dateNotifEl.value > today) {
      setError('dateNotif', 'La date de notification ne peut pas être dans le futur.');
      valide = false;
    }

    if (ajustCheck.checked) {
      const v = parseInt(ajustJours.value, 10);
      if (!ajustJours.value || isNaN(v) || v < 1) {
        setError('ajust', 'Veuillez saisir un nombre de jours d\'ajustement valide (≥ 1).');
        valide = false;
      }
    }

    return valide;
  }

  // --- Soumission du formulaire ---
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validerFormulaire()) return;

    // Effet shimmer
    btnCalculer.classList.add('shimmer-active');
    setTimeout(() => {
      btnCalculer.classList.remove('shimmer-active');
      afficherResultat();
    }, 500);
  });

  // Données calculées, partagées entre modal et exports
  let _dernierResultat = null;

  function afficherResultat() {
    // Lire les valeurs
    const typeVal       = selType.value;
    const typeInfo      = TYPES_ACTES[typeVal];
    const delaiBase     = typeVal === 'autre' ? parseInt(autreJours.value, 10) : typeInfo.jours;
    const dureeSpec     = typeVal === 'autre' ? delaiBase : null;

    const [anneeN, moisN, jourN] = dateNotifEl.value.split('-').map(Number);
    const dateNotif = new Date(Date.UTC(anneeN, moisN - 1, jourN));

    let ajustementVal = 0;
    let ajustementStr = '';
    if (ajustCheck.checked && ajustJours.value) {
      const nb    = parseInt(ajustJours.value, 10);
      const signe = ajustSigne.value;
      ajustementVal = signe === '+' ? nb : -nb;
      ajustementStr = `${signe} ${nb} jour${nb > 1 ? 's' : ''}`;
    }

    const remarques = remarquesEl.value.trim();

    // Calcul
    const dateLimite = calculerDateLimite(dateNotif, delaiBase, ajustementVal);

    _dernierResultat = {
      labelType:     typeInfo.label,
      dureeSpecifique: dureeSpec,
      dateNotif,
      dateNotifStr:  formatDateFR(dateNotif),
      ajustementStr,
      remarques,
      dateLimite,
    };

    // Remplir la liste de résultats
    resultList.innerHTML = '';
    const lignes = [
      ["Type d'acte",       typeInfo.label],
      dureeSpec ? ['Durée spécifique',  `${dureeSpec} jours`]  : null,
      ['Notification',      formatDateFR(dateNotif)],
      ajustementStr ? ['Ajustement', ajustementStr] : null,
      remarques     ? ['Remarques',  remarques]      : null,
    ].filter(Boolean);

    lignes.forEach(([dt, dd]) => {
      const termEl = document.createElement('dt');
      termEl.textContent = dt;
      const defEl  = document.createElement('dd');
      defEl.textContent = dd;
      resultList.appendChild(termEl);
      resultList.appendChild(defEl);
    });

    resultDate.textContent = formatDateFR(dateLimite);

    // Ouvrir le modal
    modal.hidden = false;
    requestAnimationFrame(() => {
      modal.classList.add('open');
    });
  }

  // --- Fermer le modal ---
  function fermerModal() {
    modal.classList.remove('open');
    modal.addEventListener('transitionend', () => {
      modal.hidden = true;
    }, { once: true });
  }

  modalClose.addEventListener('click', fermerModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) fermerModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) fermerModal();
  });

  // --- Export calendrier ---
  btnExportCal.addEventListener('click', () => {
    if (!_dernierResultat) return;
    exporterICS(_dernierResultat);
  });

  // --- Export PDF ---
  btnExportPDF.addEventListener('click', () => {
    if (!_dernierResultat) return;
    genererPDF(_dernierResultat);
  });
});

/* =========================================================
   8. SERVICE WORKER — Enregistrement
   ========================================================= */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(err => console.warn('[SW] Échec enregistrement :', err));
  });
}
