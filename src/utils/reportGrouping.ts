import { EventReport } from '../types';

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * Extrai o mês (1-12) a partir dos 2 últimos dígitos do número do relatório.
 * Aceita formatos como "001/07", "0012506" ou "125-06" - sempre olha para
 * os últimos 1-2 dígitos numéricos ao final da string.
 * Retorna null se não for possível identificar um mês válido (01-12).
 */
export function extractMonthFromNumero(numeroRelatorio?: string): number | null {
  if (!numeroRelatorio) return null;
  const match = numeroRelatorio.trim().match(/(\d{1,2})\s*$/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  if (Number.isNaN(month) || month < 1 || month > 12) return null;
  return month;
}

/**
 * Extrai o ano a partir do campo "data" do relatório (formato YYYY-MM-DD).
 * Retorna null se a data estiver ausente ou em formato inválido.
 */
export function extractYearFromData(data?: string): number | null {
  if (!data) return null;
  const match = data.trim().match(/^(\d{4})-\d{2}-\d{2}/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

export function getMonthLabel(month: number | null, year: number | null): string {
  if (month === null) return 'Sem mês identificado';
  const monthName = MONTH_NAMES[month - 1] || 'Mês inválido';
  return year !== null ? `${monthName} de ${year}` : monthName;
}

export interface ReportMonthGroup {
  month: number | null;
  year: number | null;
  label: string;
  reports: EventReport[];
}

/**
 * Agrupa os relatórios por mês + ano: o mês vem dos 2 últimos dígitos do
 * numeroRelatorio, e o ano vem do campo "data" (data do evento). Isso evita
 * misturar, por exemplo, "Agosto de 2026" com um futuro "Agosto de 2027" -
 * quando o ano virar, os relatórios de janeiro passam a formar um grupo
 * novo ("Janeiro de 2027"), sem se misturar com "Janeiro de 2026".
 *
 * Relatórios sem mês identificável no número ficam em um grupo separado ao
 * final ("Sem mês identificado"). Os grupos são ordenados de forma
 * decrescente: ano mais recente primeiro, e dentro do mesmo ano, mês mais
 * recente primeiro (ex: Ago/2026, Jul/2026, ..., Jan/2026, Dez/2025...).
 */
export function groupReportsByMonth(reports: EventReport[]): ReportMonthGroup[] {
  // chave única "ano-mes" (ex: "2026-08"); null quando não é possível identificar o mês
  const groups = new Map<string | null, { month: number | null; year: number | null; reports: EventReport[] }>();

  for (const report of reports) {
    const month = extractMonthFromNumero(report.numeroRelatorio);
    const year = extractYearFromData(report.data);

    const key = month === null ? null : `${year ?? 'sem-ano'}-${String(month).padStart(2, '0')}`;

    const bucket = groups.get(key);
    if (bucket) {
      bucket.reports.push(report);
    } else {
      groups.set(key, { month, year, reports: [report] });
    }
  }

  const entries = Array.from(groups.entries());
  entries.sort((a, b) => {
    const [, groupA] = a;
    const [, groupB] = b;
    if (groupA.month === null) return 1;
    if (groupB.month === null) return -1;
    const yearA = groupA.year ?? -Infinity;
    const yearB = groupB.year ?? -Infinity;
    if (yearA !== yearB) return yearB - yearA; // ano mais recente primeiro
    return groupB.month - groupA.month; // dentro do mesmo ano, mês mais recente primeiro
  });

  return entries.map(([, group]) => ({
    month: group.month,
    year: group.year,
    label: getMonthLabel(group.month, group.year),
    reports: group.reports,
  }));
}
