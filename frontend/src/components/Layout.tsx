import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../hooks/useTheme";

const NAV_ITEMS = [
  { to: "/", icon: "lni-layers", labelKey: "nav.createTransfers" },
  { to: "/recipients", icon: "lni-users", labelKey: "nav.recipients" },
  { to: "/settings", icon: "lni-cog", labelKey: "nav.settings" },
] as const;

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const toggleLang = () => {
    const next = i18n.language === "pl" ? "en" : "pl";
    i18n.changeLanguage(next);
    localStorage.setItem("lang", next);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center gap-1 min-h-14 py-2">
          <span className="font-semibold text-gray-800 dark:text-gray-100 mr-4">BillsHelper</span>
          {NAV_ITEMS.map(({ to, icon, labelKey }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`
              }
            >
              <i className={`lni ${icon} text-base leading-none`} />
              <span>{t(labelKey)}</span>
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <i className={`lni ${theme === "dark" ? "lni-sun" : "lni-night"} text-base leading-none`} />
            </button>
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Switch language"
            >
              <i className="lni lni-world text-base leading-none" />
              <span>{i18n.language === "pl" ? "EN" : "PL"}</span>
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
