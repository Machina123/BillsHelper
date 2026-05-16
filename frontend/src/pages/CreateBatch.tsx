import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, Recipient, exportUrl, ExportFormat, ElixirEncoding } from "../api";
import { formatNrb } from "../utils";
import { useBankRegistry } from "../hooks/useBankRegistry";

function currentMonthLabel() {
  return new Date().toISOString().slice(0, 10);
}

interface ItemState {
  amount: string;
  title: string;
  invoice_number: string;
  execution_date: string;
}

const EMPTY_ITEM: ItemState = { amount: "", title: "", invoice_number: "", execution_date: "" };

const inputBase =
  "w-full border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2";
const inputNormal = `${inputBase} border-gray-300 dark:border-gray-600 focus:ring-blue-300 dark:focus:ring-blue-700`;
const inputError = `${inputBase} border-red-400 dark:border-red-600 focus:ring-red-300 dark:focus:ring-red-800`;
const labelClass = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";
const selectClass =
  "border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700";

export default function CreateBatch() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });
  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ["recipients"],
    queryFn: api.recipients.list,
  });

  const getBankName = useBankRegistry();
  const [label, setLabel] = useState(currentMonthLabel);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("erste");
  const [elixirEncoding, setElixirEncoding] = useState<ElixirEncoding>("cp852");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [items, setItems] = useState<Record<number, ItemState>>({});
  const [errors, setErrors] = useState<Record<number, Partial<ItemState>>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const ownNrb = settings?.own_account_nrb;

  const toggle = (id: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setItems((prev) => ({ ...prev, [id]: prev[id] ?? { ...EMPTY_ITEM } }));
      }
      return next;
    });
  };

  const setItem = (id: number, key: keyof ItemState, value: string) => {
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
    setErrors((prev) => ({ ...prev, [id]: { ...prev[id], [key]: undefined } }));
  };

  const validate = () => {
    const newErrors: Record<number, Partial<ItemState>> = {};
    let valid = true;
    for (const id of selected) {
      const item = items[id] ?? EMPTY_ITEM;
      const errs: Partial<ItemState> = {};
      const amountNum = Number(item.amount.replace(",", "."));
      if (
        !item.amount ||
        isNaN(amountNum) ||
        amountNum <= 0 ||
        !/^\d+([.,]\d{1,2})?$/.test(item.amount.trim())
      ) {
        errs.amount = t("createBatch.errors.amountInvalid");
        valid = false;
      }
      const recipient = (recipients as Recipient[]).find((r) => r.id === id);
      if (!item.title.trim() && !recipient?.title_suffix) {
        errs.title = t("createBatch.errors.titleRequired");
        valid = false;
      }
      newErrors[id] = errs;
    }
    setErrors(newErrors);
    return valid;
  };

  const createMutation = useMutation({
    mutationFn: api.batches.create,
    onSuccess: async (batch) => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      window.location.href = exportUrl(batch.id, exportFormat, exportFormat === "elixir" ? elixirEncoding : undefined);
      setSelected(new Set());
      setItems({});
      setLabel(currentMonthLabel());
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGlobalError(msg ?? t("createBatch.errorFailed"));
    },
  });

  const handleSubmit = () => {
    setGlobalError(null);
    if (!ownNrb) { setGlobalError(t("createBatch.errorNoNrb")); return; }
    if (selected.size === 0) { setGlobalError(t("createBatch.errorNoSelection")); return; }
    if (!validate()) return;

    createMutation.mutate({
      label,
      items: Array.from(selected).map((id) => {
        const item = items[id] ?? EMPTY_ITEM;
        return {
          recipient_id: id,
          amount: item.amount.replace(",", "."),
          title: item.title,
          invoice_number: item.invoice_number || null,
          execution_date: item.execution_date || null,
        };
      }),
    });
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-6">{t("createBatch.title")}</h1>

      {!ownNrb && (
        <div className="mb-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {t("createBatch.noNrbWarning")}{" "}
          <Link to="/settings" className="font-medium underline">
            {t("createBatch.noNrbLink")}
          </Link>
        </div>
      )}

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          {t("createBatch.batchLabel")}
        </label>
        <input
          className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 w-64"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("createBatch.loadingRecipients")}</p>
      ) : recipients.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-sm">
            {t("createBatch.noRecipients")}{" "}
            <Link to="/recipients" className="text-blue-600 dark:text-blue-400 underline">
              {t("createBatch.noRecipientsLink")}
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {(recipients as Recipient[]).map((r) => {
            const checked = selected.has(r.id);
            const item = items[r.id] ?? EMPTY_ITEM;
            const errs = errors[r.id] ?? {};

            return (
              <div
                key={r.id}
                className={`bg-white dark:bg-gray-800 border rounded-lg transition-colors ${
                  checked
                    ? "border-blue-300 dark:border-blue-600"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(r.id)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {r.short_name && (
                        <span className="shrink-0 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 px-1.5 py-0.5 rounded">
                          {r.short_name}
                        </span>
                      )}
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{r.name}</p>
                    </div>
                    <p className="text-xs font-mono text-gray-400 dark:text-gray-500">
                      {formatNrb(r.account_nrb)}
                      {getBankName(r.account_nrb) && (
                        <span className="font-sans not-italic ml-1.5">
                          · {getBankName(r.account_nrb)}
                        </span>
                      )}
                    </p>
                  </div>
                </label>

                {checked && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>{t("createBatch.amount")} *</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className={errs.amount ? inputError : inputNormal}
                        value={item.amount}
                        onChange={(e) => setItem(r.id, "amount", e.target.value)}
                        placeholder="0,00"
                      />
                      {errs.amount && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{errs.amount}</p>}
                    </div>

                    <div>
                      <label className={labelClass}>{t("createBatch.invoiceNumber")}</label>
                      <input
                        type="text"
                        className={inputNormal}
                        value={item.invoice_number}
                        onChange={(e) => setItem(r.id, "invoice_number", e.target.value)}
                        placeholder="FV/01/2026"
                        maxLength={35}
                      />
                    </div>

                    <div className="col-span-2">
                      <label className={labelClass}>
                        {t("createBatch.transferTitle")} {!r.title_suffix && "*"}
                      </label>
                      <div className={`flex items-stretch rounded border ${
                        errs.title
                          ? "border-red-400 dark:border-red-600 focus-within:ring-2 focus-within:ring-red-300 dark:focus-within:ring-red-800"
                          : "border-gray-300 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-300 dark:focus-within:ring-blue-700"
                      } bg-white dark:bg-gray-700`}>
                        <input
                          type="text"
                          className="flex-1 min-w-0 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none bg-transparent rounded-l"
                          value={item.title}
                          onChange={(e) => setItem(r.id, "title", e.target.value)}
                          maxLength={140}
                        />
                        {r.title_suffix && (
                          <span className="flex items-center px-2.5 text-xs text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-600/50 border-l border-gray-300 dark:border-gray-600 rounded-r whitespace-nowrap">
                            {r.title_suffix}
                          </span>
                        )}
                      </div>
                      {errs.title && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{errs.title}</p>}
                    </div>

                    <div>
                      <label className={labelClass}>{t("createBatch.executionDate")}</label>
                      <input
                        type="date"
                        className={inputNormal}
                        value={item.execution_date}
                        onChange={(e) => setItem(r.id, "execution_date", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {globalError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{globalError}</p>}

      {recipients.length > 0 && (
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div>
            <label className={labelClass}>{t("createBatch.format")}</label>
            <select className={selectClass} value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)}>
              <option value="erste">{t("createBatch.formatErste")}</option>
              <option value="elixir">{t("createBatch.formatElixir")}</option>
            </select>
          </div>

          {exportFormat === "elixir" && (
            <div>
              <label className={labelClass}>{t("createBatch.encoding")}</label>
              <select className={selectClass} value={elixirEncoding} onChange={(e) => setElixirEncoding(e.target.value as ElixirEncoding)}>
                <option value="cp852">{t("createBatch.encodingCp852")}</option>
                <option value="windows-1250">{t("createBatch.encodingWindows1250")}</option>
                <option value="utf-8">{t("createBatch.encodingUtf8")}</option>
              </select>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending || selected.size === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className={`lni ${createMutation.isPending ? "lni-hourglass" : "lni-download-1"} text-base leading-none`} />
            {createMutation.isPending
              ? t("createBatch.generating")
              : t("createBatch.generateButton", { count: selected.size })}
          </button>
        </div>
      )}
    </div>
  );
}
