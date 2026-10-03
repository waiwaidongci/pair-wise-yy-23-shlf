import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { routes } from "./router/routes";
import { LearnPage } from "./pages/LearnPage";
import { PracticePage } from "./pages/PracticePage";
import { MistakesPage } from "./pages/MistakesPage";
import { ProgressPage } from "./pages/ProgressPage";
import { SyncPage } from "./pages/SyncPage";
import { useSyncStore } from "./stores/SyncStore";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { usePendingSync } from "./hooks/usePendingSync";
import { runBackfill } from "./services/BackfillService";
import { StatusBadge } from "./components/common/StatusBadge";
import "./styles.css";

function renderPage(route: string) {
  switch (route) {
    case "/learn":
      return <LearnPage />;
    case "/practice":
      return <PracticePage />;
    case "/mistakes":
      return <MistakesPage />;
    case "/progress":
      return <ProgressPage />;
    case "/sync":
      return <SyncPage />;
    default:
      return <LearnPage />;
  }
}

function App() {
  const [active, setActive] = useState<string>(routes[0]?.route ?? "/learn");
  const [ready, setReady] = useState(false);
  const loadSync = useSyncStore((s) => s.load);
  const online = useOnlineStatus();
  const { count: pendingCount } = usePendingSync();

  useEffect(() => {
    // 升级回填：旧数据缺少 source/revision 时回填，错题本/历史可查、进度可算
    runBackfill()
      .then(() => loadSync())
      .finally(() => setReady(true));
  }, [loadSync]);

  const current = routes.find((route) => route.route === active) ?? routes[0];

  if (!ready) {
    return (
      <div className="shell">
        <aside>
          <div className="brand">盲文点字学习训练器</div>
        </aside>
        <main className="page">
          <section className="panel">正在升级数据…</section>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside>
        <div className="brand">盲文点字学习训练器</div>
        <nav>
          {routes.map((route) => (
            <button key={route.route} className={active === route.route ? "active" : ""} onClick={() => setActive(route.route)}>
              {route.name}
              {route.route === "/sync" && pendingCount > 0 ? <span className="nav-badge">{pendingCount}</span> : null}
            </button>
          ))}
        </nav>
        <div className="nav-status">
          <StatusBadge value={online ? "ONLINE" : "OFFLINE"} />
        </div>
      </aside>
      {renderPage(current?.route ?? "/learn")}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
