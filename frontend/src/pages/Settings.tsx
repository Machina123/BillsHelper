import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { validateNrb, formatNrb } from "../utils";
import { useBankRegistry } from "../hooks/useBankRegistry";

export default function Settings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });
  const [nrb, setNrb] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.own_account_nrb) setNrb(data.own_account_nrb);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (value: string) => api.settings.update({ own_account_nrb: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => api.settings.update({ own_account_nrb: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setNrb("");
      setSaved(false);
    },
  });

  const getBankName = useBankRegistry();
  const digits = nrb.replace(/\D/g, "");
  const valid = validateNrb(digits);
  const bankName = valid ? getBankName(digits) : undefined;

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-6">{t("settings.title")}</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          {t("settings.nrbLabel")}
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t("settings.nrbHint")}</p>
        <input
          type="text"
          value={formatNrb(nrb)}
          onChange={(e) => setNrb(e.target.value.replace(/\D/g, ""))}
          placeholder={t("settings.nrbPlaceholder")}
          maxLength={34}
          className={`w-full border rounded px-3 py-2 text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 ${
            nrb && !valid
              ? "border-red-400 dark:border-red-600 focus:ring-red-300 dark:focus:ring-red-800"
              : "border-gray-300 dark:border-gray-600 focus:ring-blue-300 dark:focus:ring-blue-700"
          }`}
        />
        {nrb && !valid && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-1">
            {digits.length !== 26 ? t("settings.errorLength") : t("settings.errorChecksum")}
          </p>
        )}
        {bankName && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{bankName}</p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => mutation.mutate(digits)}
            disabled={!valid || mutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="lni lni-save text-base leading-none" />
            {mutation.isPending ? t("settings.saving") : saved ? t("settings.saved") : t("settings.save")}
          </button>
          {data?.own_account_nrb && (
            <button
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="lni lni-trash text-base leading-none" />
              {t("settings.clear")}
            </button>
          )}
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-2">{t("settings.saveFailed")}</p>
        )}
      </div>
    </div>
  );
}
