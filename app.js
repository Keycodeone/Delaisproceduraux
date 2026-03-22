document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('deadlineForm');
    const modal = document.getElementById('resultModal');
    const closeBtn = document.querySelector('.close');
    const resultDetails = document.getElementById('resultDetails');
    const calculateBtn = document.getElementById('calculateBtn');
    const exportCalendar = document.getElementById('exportCalendar');
    const exportPDF = document.getElementById('exportPDF');
    const acteType = document.getElementById('acteType');
    const customDuration = document.getElementById('customDuration');
    const adjustment = document.getElementById('adjustment');
    const adjustmentDays = document.getElementById('adjustmentDays');
    const remarks = document.getElementById('remarks');
    const charCount = document.getElementById('charCount');
    const notificationDate = document.getElementById('notificationDate');

    // Durées par défaut
    const actes = {
        '10': 'Formation d\'Opposition (10 jours)',
        '15': 'Réponse à Assignation (15 jours)',
        '60': 'Contestation de Décision (60 jours)',
        '30': 'Déclaration d\'Appel (30 jours)',
        '60-pourvoi': 'Pourvoi en Cassation (60 jours)',
        '60-recours': 'Recours Administratif (60 jours)',
        '90': 'Dépôt de Conclusions (90 jours)'
    };

    // Jours fériés France 2026+ (métropolitains, extensible)
    const ferie = [
        '2026-01-01', '2026-04-05', '2026-04-06', '2026-05-01', '2026-05-08', '2026-05-14', '2026-05-25',
        '2026-07-14', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25'
    ];

    function isWeekend(date) {
        const day = date.getDay();
        return day === 0 || day === 6;
    }

    function addWorkingDays(startDate, days) {
        let result = new Date(startDate);
        let remaining = days;
        while (remaining > 0) {
            result.setDate(result.getDate() + 1);
            if (!isWeekend(result) && !ferie.includes(result.toISOString().split('T')[0])) {
                remaining--;
            }
        }
        return result;
    }

    // Compteur caractères
    remarks.addEventListener('input', () => {
        charCount.textContent = `${remarks.value.length}/30`;
    });

    // Toggle custom duration
    acteType.addEventListener('change', () => {
        customDuration.style.display = acteType.value === 'custom' ? 'block' : 'none';
    });

    // Toggle adjustment
    adjustment.addEventListener('change', () => {
        adjustmentDays.style.display = adjustment.checked ? 'block' : 'none';
    });

    // Calcul
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        calculateBtn.classList.add('shimmer');
        setTimeout(() => {
            const duration = acteType.value === 'custom' ? parseInt(customDuration.value) || 0 : parseInt(acteType.value);
            const start = new Date(notificationDate.value);
            let endDate = addWorkingDays(start, duration);
            
            // Ajustement calendaires (+/-)
            if (adjustment.checked && adjustmentDays.value) {
                const adj = parseInt(adjustmentDays.value);
                endDate.setDate(endDate.getDate() + adj);
            }
            
            const acteLabel = acteType.options[acteType.selectedIndex].text;
            const details = `
                <strong>Type d'acte:</strong> ${acteLabel}<br>
                <strong>Date notification:</strong> ${start.toLocaleDateString('fr-FR')}<br>
                <strong>Date limite:</strong> ${endDate.toLocaleDateString('fr-FR')}<br>
                ${adjustment.checked ? `<strong>Ajustement:</strong> ${adjustmentDays.value} jours<br>` : ''}
                <strong>Remarques:</strong> ${remarks.value || 'Aucune'}
            `;
            resultDetails.innerHTML = details;
            modal.style.display = 'block';
            calculateBtn.classList.remove('shimmer');
        }, 500);
    });

    // Fermeture modal
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    // Export Calendrier (ICS simple)
    exportCalendar.onclick = () => {
        const start = new Date(notificationDate.value);
        const endDate = new Date(resultDetails.querySelector('strong:nth-of-type(3)').nextSibling.textContent.trim());
        const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${start.toISOString().replace(/[:-]/g,'').slice(0,-5)}Z\nDTEND:${endDate.toISOString().replace(/[:-]/g,'').slice(0,-5)}Z\nSUMMARY:Délai procédural - ${acteType.options[acteType.selectedIndex].text}\nDESCRIPTION:${remarks.value}\nEND:VEVENT\nEND:VCALENDAR`;
        const blob = new Blob([ics], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'delai.ics'; a.click();
    };

    // PDF
    exportPDF.onclick = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFillColor(102, 126, 234);
        doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255,255,255);
        doc.setFontSize(20);
        doc.text('Délais Procéduraux', 105, 15, { align: 'center' });
        doc.setTextColor(0,0,0);
        doc.setFontSize(12);
        let y = 35;
        const lines = resultDetails.innerHTML.replace(/<[^>]*>/g, '').split('\n');
        lines.forEach(line => {
            doc.text(line.replace(/:/g, ': '), 20, y);
            y += 7;
        });
        doc.save('delai_procedural.pdf');
    };
});
