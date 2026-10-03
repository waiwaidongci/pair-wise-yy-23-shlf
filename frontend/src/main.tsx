import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { routes } from "./router/routes";
import type { AppRoute } from "./router/routes";
import { LearnPage } from "./pages/LearnPage";
import { PracticePage } from "./pages/PracticePage";
import { MistakesPage } from "./pages/MistakesPage";
import { ProgressPage } from "./pages/ProgressPage";
import { SyncPage } from "./pages/SyncPage";
import { useSyncStore } from "./stores/SyncStore";
import { useOnlineSync } from "./hooks/useOnlineSync";
import { openContext } from "./services/appContext";
import { stageVolunteerScenario, stageMainEdit } from "./services/demoScenario";
import { isMainSource, MAIN_SOURCE } from "./utils/syncMeta";
import { isServiceError } from "./utils/errors";
import { StatusBadge } from "./components/common/StatusBadge";
import "./styles.css";

const PAGE_BY_ROUTE: Record<AppRoute, () => JSX.Element> = {
  "/learn": LearnPage,
  "/practice": PracticePage,
  "/mistakes": MistakesPage,
  "/progress": ProgressPage,
  "/sync": SyncPage
};

const VOLUNTEER_SOURCE = "volunteer-zhang";

function App() {
  const { source, ready, switchSource, refresh, setMessage } = useSyncStore();
  const [active, setActive] = useState<AppRoute>("/learn");
  const [staging, setStaging] = useState(false);

  // 恢复网络自动重试: volunteer devices push their retained batches; the main
  // device pulls and merges. Failures keep the batch local (shown in 同步中心).
  const onReconnect = useCallback(async () => {
    const state = useSyncStore.getState();
    if (!state.context) return;
    try {
      if (isMainSource(state.source)) await state.context.syncService.mergeHubIntoMain();
      else await state.context.syncService.pushOutbox();
      await state.refresh();
    } catch (error) {
      if (isServiceError(error)) setMessage(error.message);
    }
  }, [setMessage]);
  const online = useOnlineSync(onReconnect);

  useEffect(() => {
    void openContext(MAIN_SOURCE).then(() => switchSource(MAIN_SOURCE));
  }, [switchSource]);

  // Demo: seed the volunteer database (copying main lineages) offline.
  const stageScenario = async (diverge: boolean) => {
    setStaging(true);
    try {
      if (diverge) await stageMainEdit();
      await stageVolunteerScenario(VOLUNTEER_SOURCE, { diverge });
      setMessage(diverge ? "已布置双源冲突场景：同一答题主设备与志愿者都改过" : "已布置志愿者离线练习场景");
    } finally {
      setStaging(false);
    }
  };

  if (!ready) {
    return <div className="boot">正在打开本地数据库并检查 v2 升级回填…</div>;
  }

  const Page = PAGE_BY_ROUTE[active];

  return (
    <div className="shell">
      <aside>
        <div className="brand">盲文点字学习训练器</div>
        <div className="device-box">
          <StatusBadge value={online ? "ONLINE" : "OFFLINE"} />
          <StatusBadge value={isMainSource(source) ? "SOURCE_MAIN" : "SOURCE_VOLUNTEER"} />
        </div>
        <nav>
          {routes.map((route) => (
            <button key={route.route} className={active === route.route ? "active" : ""} onClick={() => setActive(route.route)}>
              {route.name}
            </button>
          ))}
        </nav>
        <div className="device-switch">
          <button className={isMainSource(source) ? "btn small active" : "btn small"} onClick={() => void switchSource(MAIN_SOURCE).then(refresh)}>
            主设备
          </button>
          <button className={!isMainSource(source) ? "btn small active" : "btn small"} onClick={() => void switchSource(VOLUNTEER_SOURCE).then(refresh)}>
            志愿者设备
          </button>
        </div>
        <div className="demo-box">
          <p className="muted">教学场景演示（仅本地模拟）</p>
          <button className="btn small" disabled={staging} onClick={() => void stageScenario(false)}>
            布置离线练习
          </button>
          <button className="btn small" disabled={staging} onClick={() => void stageScenario(true)}>
            布置双源冲突
          </button>
        </div>
      </aside>
      <Page />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
