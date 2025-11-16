/**
 * Vacances scolaires Zone B (France)
 * Année scolaire 2025-2026
 */

export function isSchoolHoliday(date) {
  const checkDate = new Date(date);
  const year = checkDate.getFullYear();
  const month = checkDate.getMonth() + 1; // 1-12
  const day = checkDate.getDate();

  // Vacances de la Toussaint 2025
  // Du samedi 18 octobre au lundi 3 novembre 2025
  if (year === 2025 && month === 10 && day >= 18) return true;
  if (year === 2025 && month === 11 && day <= 3) return true;

  // Vacances de Noël 2025-2026
  // Du samedi 20 décembre 2025 au lundi 5 janvier 2026
  if (year === 2025 && month === 12 && day >= 20) return true;
  if (year === 2026 && month === 1 && day <= 5) return true;

  // Vacances d'hiver Zone B 2026
  // Du samedi 14 février au lundi 2 mars 2026
  if (year === 2026 && month === 2 && day >= 14) return true;
  if (year === 2026 && month === 3 && day <= 2) return true;

  // Vacances de printemps Zone B 2026
  // Du samedi 11 avril au lundi 27 avril 2026
  if (year === 2026 && month === 4 && day >= 11) return true;
  if (year === 2026 && month === 4 && day <= 27) return true;

  // Vacances d'été 2026
  // À partir du samedi 4 juillet 2026
  if (year === 2026 && month >= 7) {
    if (month === 7 && day >= 4) return true;
    if (month > 7) return true;
  }

  // Vacances d'été 2025 (fin)
  // Jusqu'au 31 août 2025 (rentrée le 1er septembre)
  if (year === 2025 && month === 8) return true;
  if (year === 2025 && month === 7 && day >= 4) return true;

  return false;
}

