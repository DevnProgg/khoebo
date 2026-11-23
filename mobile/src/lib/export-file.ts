export type ExportFormat = 'pdf' | 'xlsx';

export interface ExportQuery {
  dataset: string;
  format: ExportFormat;
  startDate?: string;
  endDate?: string;
}

export function exportPath(businessId: string, query: ExportQuery): string {
  const params = new URLSearchParams({ format: query.format });
  if (query.startDate) params.set('start_date', query.startDate);
  if (query.endDate) params.set('end_date', query.endDate);
  return `/businesses/${businessId}/exports/${query.dataset}?${params.toString()}`;
}

export function exportFilename(
  dataset: string,
  endDate: string | undefined,
  format: ExportFormat,
): string {
  const date = endDate ?? new Date().toISOString().slice(0, 10);
  return `khoebo-${dataset}-${date}.${format}`;
}
