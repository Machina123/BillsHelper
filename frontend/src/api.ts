import axios from "axios";

const http = axios.create({ baseURL: "/api" });

export interface Recipient {
  id: number;
  name: string;
  address: string;
  account_nrb: string;
  transfer_type: number;
  payment_method: string;
  short_name: string | null;
  nip: string | null;
  title_suffix: string | null;
}

export interface RecipientPayload {
  name: string;
  address: string;
  account_nrb: string;
  transfer_type: number;
  payment_method: string;
  short_name: string | null;
  nip: string | null;
  title_suffix: string | null;
}

export interface BatchItemPayload {
  recipient_id: number;
  amount: string;
  title: string;
  invoice_number: string | null;
  execution_date: string | null;
}

export interface BatchPayload {
  label: string;
  items: BatchItemPayload[];
}

export interface BatchSummary {
  id: number;
  label: string;
  created_at: string;
  item_count: number;
}

export interface Settings {
  own_account_nrb: string | null;
}

export const api = {
  recipients: {
    list: () => http.get<Recipient[]>("/recipients").then((r) => r.data),
    create: (data: RecipientPayload) =>
      http.post<Recipient>("/recipients", data).then((r) => r.data),
    update: (id: number, data: RecipientPayload) =>
      http.put<Recipient>(`/recipients/${id}`, data).then((r) => r.data),
    delete: (id: number) => http.delete(`/recipients/${id}`),
  },
  batches: {
    list: () => http.get<BatchSummary[]>("/batches").then((r) => r.data),
    create: (data: BatchPayload) =>
      http.post<{ id: number }>("/batches", data).then((r) => r.data),
    delete: (id: number) => http.delete(`/batches/${id}`),
  },
  settings: {
    get: () => http.get<Settings>("/settings").then((r) => r.data),
    update: (data: Partial<Settings>) =>
      http.put<Settings>("/settings", data).then((r) => r.data),
  },
};

export interface ImportResult {
  added: number;
  skipped: number;
  errors: string[];
}

export const importRecipients = (file: File): Promise<ImportResult> => {
  const form = new FormData();
  form.append("file", file);
  return http.post<ImportResult>("/recipients/import", form).then((r) => r.data);
};

export type ExportFormat = "erste" | "elixir";
export type ElixirEncoding = "cp852" | "windows-1250" | "utf-8";

export function exportUrl(batchId: number, format: ExportFormat, encoding?: ElixirEncoding): string {
  const params = new URLSearchParams({ format });
  if (format === "elixir" && encoding) params.set("encoding", encoding);
  return `/api/export/${batchId}?${params.toString()}`;
}
