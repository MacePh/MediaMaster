import { useEffect } from "react";
import { useAppStore } from "../../stores/appStore";

export function Toast() {
  const toast = useAppStore((state) => state.toast);
  const clearToast = useAppStore((state) => state.clearToast);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => clearToast(), 1900);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  return <div className={`toast ${toast ? "show" : ""}`}>{toast ?? ""}</div>;
}
