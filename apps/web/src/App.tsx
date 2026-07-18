import { useEffect } from "react";
import { useUiStore } from "./state/uiStore";
import { Library } from "./components/Library";
import { Studio } from "./components/Studio";

function Toast() {
  const toast = useUiStore((s) => s.toast);
  const clearToast = useUiStore((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 6000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.actionLabel && (
        <button
          type="button"
          className="btn lime"
          onClick={() => {
            toast.onAction?.();
            clearToast();
          }}
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}

export default function App() {
  const view = useUiStore((s) => s.view);
  return (
    <div className="app">
      {view === "library" ? <Library /> : <Studio />}
      <Toast />
    </div>
  );
}
