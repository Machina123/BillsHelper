import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { api, Recipient, RecipientPayload, importRecipients, ImportResult } from "../api";
import { validateNrb, formatNrb } from "../utils";
import { useBankRegistry } from "../hooks/useBankRegistry";

const TRANSFER_TYPE_KEYS: Record<number, string> = { 1: "regular", 2: "zus", 6: "splitPayment" };
const PAYMENT_METHOD_KEYS: Record<string, string> = {
  "0": "internal", "1": "elixir", "6": "sorbnet", "8": "expressElixir",
};

function transferTypeLabel(type: number, t: TFunction): string {
  const key = TRANSFER_TYPE_KEYS[type];
  return key ? t(`recipients.transferTypes.${key}`) : String(type);
}
function paymentMethodLabel(method: string, t: TFunction): string {
  const key = PAYMENT_METHOD_KEYS[method];
  return key ? t(`recipients.paymentMethods.${key}`) : method;
}

const EMPTY_FORM: RecipientPayload = {
  name: "", address: "", account_nrb: "", transfer_type: 1,
  payment_method: "1", short_name: null, nip: null, title_suffix: null,
};

interface FormErrors { name?: string; address?: string; account_nrb?: string; nip?: string; }

interface RecipientFormProps {
  initial: RecipientPayload;
  onSubmit: (data: RecipientPayload) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
  serverError?: string | null;
}

function RecipientForm({ initial, onSubmit, onCancel, isPending, submitLabel, serverError }: RecipientFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<RecipientPayload>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof RecipientPayload, boolean>>>({});

  const validate = (f: RecipientPayload): FormErrors => {
    const errors: FormErrors = {};
    if (!f.name.trim()) errors.name = t("recipients.errors.nameRequired");
    else if (f.name.length > 80) errors.name = t("recipients.errors.nameMax");
    if (!f.address.trim()) errors.address = t("recipients.errors.addressRequired");
    else if (f.address.length > 60) errors.address = t("recipients.errors.addressMax");
    const nrbDigits = f.account_nrb.replace(/\D/g, "");
    if (!nrbDigits) errors.account_nrb = t("recipients.errors.nrbRequired");
    else if (nrbDigits.length !== 26) errors.account_nrb = t("recipients.errors.nrbLength");
    else if (!validateNrb(nrbDigits)) errors.account_nrb = t("recipients.errors.nrbChecksum");
    if (f.nip) {
      if (f.nip.replace(/\D/g, "").length !== 10) errors.nip = t("recipients.errors.nipLength");
    }
    return errors;
  };

  const errors = validate(form);
  const set = <K extends keyof RecipientPayload>(key: K, value: RecipientPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const touch = (key: keyof RecipientPayload) => setTouched((t) => ({ ...t, [key]: true }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, address: true, account_nrb: true, nip: true });
    if (Object.keys(errors).length > 0) return;
    onSubmit({
      ...form,
      account_nrb: form.account_nrb.replace(/\D/g, ""),
      nip: form.nip ? form.nip.replace(/\D/g, "") : null,
    });
  };

  const inputBase = "w-full border rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2";
  const fieldClass = (key: keyof FormErrors) =>
    `${inputBase} ${touched[key] && errors[key]
      ? "border-red-400 dark:border-red-600 focus:ring-red-300 dark:focus:ring-red-800"
      : "border-gray-300 dark:border-gray-600 focus:ring-blue-300 dark:focus:ring-blue-700"}`;
  const labelClass = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";
  const selectClass = `${inputBase} border-gray-300 dark:border-gray-600 focus:ring-blue-300 dark:focus:ring-blue-700`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass}>{t("recipients.fields.name")} *</label>
          <input className={fieldClass("name")} value={form.name}
            onChange={(e) => set("name", e.target.value)} onBlur={() => touch("name")} maxLength={80} />
          {touched.name && errors.name && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{errors.name}</p>}
        </div>
        <div>
          <label className={labelClass}>{t("recipients.fields.shortName")}</label>
          <input className={selectClass} value={form.short_name ?? ""}
            onChange={(e) => set("short_name", e.target.value || null)}
            maxLength={20} placeholder={t("recipients.fields.shortNameHint")} />
        </div>
      </div>

      <div>
        <label className={labelClass}>{t("recipients.fields.address")} *</label>
        <input className={fieldClass("address")} value={form.address}
          onChange={(e) => set("address", e.target.value)} onBlur={() => touch("address")} maxLength={60} />
        {touched.address && errors.address && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{errors.address}</p>}
      </div>

      <div>
        <label className={labelClass}>{t("recipients.fields.accountNrb")} *</label>
        <input className={`${fieldClass("account_nrb")} font-mono`}
          value={formatNrb(form.account_nrb)}
          onChange={(e) => set("account_nrb", e.target.value.replace(/\D/g, ""))}
          onBlur={() => touch("account_nrb")}
          placeholder="26 1234 5678 9012 3456 7890 1234" maxLength={34} />
        {touched.account_nrb && errors.account_nrb && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{errors.account_nrb}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>{t("recipients.fields.transferType")} *</label>
          <select className={selectClass} value={form.transfer_type} onChange={(e) => set("transfer_type", Number(e.target.value))}>
            <option value={1}>{t("recipients.transferTypes.regular")}</option>
            <option value={2}>{t("recipients.transferTypes.zus")}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("recipients.fields.paymentMethod")} *</label>
          <select className={selectClass} value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)}>
            <option value="1">{t("recipients.paymentMethods.elixir")}</option>
            <option value="0">{t("recipients.paymentMethods.internal")}</option>
            <option value="6">{t("recipients.paymentMethods.sorbnet")}</option>
            <option value="8">{t("recipients.paymentMethods.expressElixir")}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("recipients.fields.nip")}</label>
          <input className={fieldClass("nip")} value={form.nip ?? ""}
            onChange={(e) => set("nip", e.target.value || null)} onBlur={() => touch("nip")}
            placeholder="10 digits" maxLength={10} />
          {touched.nip && errors.nip && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{errors.nip}</p>}
        </div>
      </div>

      <div>
        <label className={labelClass}>{t("recipients.fields.titleSuffix")}</label>
        <input className={selectClass} value={form.title_suffix ?? ""}
          onChange={(e) => set("title_suffix", e.target.value || null)}
          maxLength={140} placeholder={t("recipients.fields.titleSuffixHint")} />
      </div>

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50">
          <i className="lni lni-floppy-disk-1 text-base leading-none" />
          {isPending ? t("recipients.saving") : submitLabel}
        </button>
        <button type="button" onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <i className="lni lni-xmark text-base leading-none" />
          {t("recipients.cancel")}
        </button>
      </div>
      {serverError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{serverError}</p>}
    </form>
  );
}

export default function Recipients() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const getBankName = useBankRegistry();
  const { data: recipients = [], isLoading } = useQuery({ queryKey: ["recipients"], queryFn: api.recipients.list });

  const [sortField, setSortField] = useState<"name" | "short_name">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSort = (field: "name" | "short_name") => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const sortedRecipients = [...(recipients as Recipient[])].sort((a, b) => {
    if (sortField === "short_name") {
      if (!a.short_name && !b.short_name) return a.name.localeCompare(b.name);
      if (!a.short_name) return 1;
      if (!b.short_name) return -1;
      const cmp = a.short_name.localeCompare(b.short_name, undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    }
    const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const importMutation = useMutation({
    mutationFn: importRecipients,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["recipients"] });
      setImportResult(result); setImportError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: () => {
      setImportError(t("recipients.import.failed")); setImportResult(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const createMutation = useMutation({
    mutationFn: api.recipients.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recipients"] }); setShowAdd(false); setFormError(null); },
    onError: (err: unknown) => {
      setFormError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("recipients.errors.saveFailed"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: RecipientPayload }) => api.recipients.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recipients"] }); setEditId(null); setFormError(null); },
    onError: (err: unknown) => {
      setFormError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("recipients.errors.saveFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.recipients.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recipients"] }); setDeleteId(null); },
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{t("recipients.title")}</h1>
        <div className="flex gap-2 ml-auto">
          <input ref={fileInputRef} type="file" accept=".txt" className="hidden"
            title={t("recipients.import.prompt")}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importMutation.mutate(f); }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
            <i className="lni lni-upload-1 text-base leading-none" />
            <span className="hidden sm:inline">{importMutation.isPending ? "…" : t("recipients.import.button")}</span>
          </button>
          {!showAdd && (
            <button onClick={() => { setShowAdd(true); setEditId(null); setFormError(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded">
              <i className="lni lni-plus text-base leading-none" />
              <span className="hidden sm:inline">{t("recipients.addButton")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sort controls */}
      {recipients.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-4">
          <span>{t("recipients.sort.label")}:</span>
          {(["name", "short_name"] as const).map((field) => (
            <button key={field} onClick={() => toggleSort(field)}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                sortField === field
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              }`}>
              {t(`recipients.sort.${field === "name" ? "name" : "shortName"}`)}
              {sortField === field && (
                <i className={`lni ${sortDir === "asc" ? "lni-arrow-upward" : "lni-arrow-downward"} text-xs leading-none`} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Import feedback */}
      {importResult && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-4 py-3 text-sm text-green-800 dark:text-green-300">
          {importResult.errors.length > 0
            ? t("recipients.import.successWithErrors", { added: importResult.added, skipped: importResult.skipped, errorCount: importResult.errors.length })
            : t("recipients.import.success", { added: importResult.added, skipped: importResult.skipped })}
          {importResult.errors.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-xs text-green-700 dark:text-green-400 space-y-0.5">
              {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
        </div>
      )}
      {importError && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-3 text-sm text-red-800 dark:text-red-300">
          {importError}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">{t("recipients.newRecipient")}</h2>
          <RecipientForm initial={EMPTY_FORM} onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => { setShowAdd(false); setFormError(null); }}
            isPending={createMutation.isPending} submitLabel={t("recipients.addButton")} serverError={formError} />
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("recipients.loading")}</p>
      ) : recipients.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-sm">{t("recipients.empty")}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
          {sortedRecipients.map((r: Recipient) => (
            <div key={r.id}>
              {editId === r.id ? (
                <div className="p-6">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">{t("recipients.editRecipient")}</h2>
                  <RecipientForm initial={{ ...r }}
                    onSubmit={(data) => updateMutation.mutate({ id: r.id, data })}
                    onCancel={() => { setEditId(null); setFormError(null); }}
                    isPending={updateMutation.isPending} submitLabel={t("recipients.saveChanges")} serverError={formError} />
                </div>
              ) : (
                <div className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {r.short_name && (
                        <span className="shrink-0 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 px-1.5 py-0.5 rounded">
                          {r.short_name}
                        </span>
                      )}
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{r.name}</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.address}</p>
                    <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatNrb(r.account_nrb)}
                      {getBankName(r.account_nrb) && (
                        <span className="font-sans not-italic text-gray-400 dark:text-gray-500 ml-1.5">
                          · {getBankName(r.account_nrb)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                      {transferTypeLabel(r.transfer_type, t)}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {paymentMethodLabel(r.payment_method, t)}
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditId(r.id); setShowAdd(false); setFormError(null); }}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      title={t("recipients.edit")}>
                      <i className="lni lni-pencil-1 text-sm leading-none" />
                      <span className="hidden sm:inline">{t("recipients.edit")}</span>
                    </button>
                    <button onClick={() => setDeleteId(r.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title={t("recipients.delete")}>
                      <i className="lni lni-trash-3 text-sm leading-none" />
                      <span className="hidden sm:inline">{t("recipients.delete")}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="text-sm text-gray-800 dark:text-gray-200 mb-4">
              {t("recipients.deleteConfirm", { name: recipients.find((r: Recipient) => r.id === deleteId)?.name })}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <i className="lni lni-xmark text-base leading-none" />
                {t("recipients.cancel")}
              </button>
              <button onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded disabled:opacity-50">
                <i className="lni lni-trash-3 text-base leading-none" />
                {deleteMutation.isPending ? t("recipients.deleting") : t("recipients.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
