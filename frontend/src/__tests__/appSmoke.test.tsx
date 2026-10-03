// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { closeAllContexts } from "../services/appContext";
import { setDeviceSource } from "../utils/syncMeta";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function del(name: string) {
  return new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onblocked = () => resolve();
    req.onerror = () => resolve();
  });
}

// Mounts the real app (main.tsx renders into #root and bootstraps IndexedDB).
describe("应用启动冒烟", () => {
  beforeEach(async () => {
    await closeAllContexts();
    setDeviceSource("main");
    await del("braille-trainer-db");
    await del("braille-trainer-hub-db");
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("打开主设备数据库并渲染五个页面，无运行时异常", async () => {
    const container = document.getElementById("root")!;
    const root = createRoot(container);
    await act(async () => {
      await import("../main");
    });

    // Poll for the async IndexedDB bootstrap (v1->v2 upgrade + first load).
    for (let i = 0; i < 50 && !container.textContent?.includes("盲文点字学习训练器"); i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }

    expect(container.textContent).toContain("盲文点字学习训练器");
    expect(container.textContent).toContain("学习卡片");

    for (const name of ["练习模式", "错题本", "学习进度", "同步中心"]) {
      await act(async () => {
        const button = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === name);
        button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(container.textContent).toContain(name);
    }
    root.unmount();
  }, 10000);
});
