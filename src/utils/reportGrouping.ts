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

export function getMonthLabel(month: number | null): string {
  if (month === null) return 'Sem mês identificado';
  return MONTH_NAMES[month - 1] || 'Mês inválido';
}

export interface ReportMonthGroup {
  month: number | null;
  label: string;
  reports: EventReport[];
}

/**
 * Agrupa os relatórios pelo mês identificado nos 2 últimos dígitos do
 * numeroRelatorio, preservando a ordem original dentro de cada grupo e
 * ordenando os grupos cronologicamente (Janeiro -> Dezembro). Relatórios
 * sem número/mês identificável ficam em um grupo separado ao final.
 */
export function groupReportsByMonth(reports: EventReport[]): ReportMonthGroup[] {
  const groups = new Map<number | null, EventReport[]>();

  for (const report of reports) {
    const month = extractMonthFromNumero(report.numeroRelatorio);
    const bucket = groups.get(month);
    if (bucket) {
      bucket.push(report);
    } else {
      groups.set(month, [report]);
    }
  }

  const entries = Array.from(groups.entries());
  entries.sort((a, b) => {
    if (a[0] === null) return 1;
    if (b[0] === null) return -1;
    return b[0] - a[0]; // decrescente: mês mais recente primeiro (ex: Agosto, Julho, Junho...)
  });

  return entries.map(([month, groupReports]) => ({
    month,
    label: getMonthLabel(month),
    reports: groupReports,
  }));
}
