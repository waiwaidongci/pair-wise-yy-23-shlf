import { MasteryLevelText } from "../constants/MasteryLevel";
import { MAIN_SOURCE } from "./syncMeta";

export const formatDate = (value: string) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";

export const formatStatus = (value: string) => value.replace(/_/g, " ");

export const formatNumber = (value: number) => new Intl.NumberFormat("zh-CN").format(value);

export const formatRisk = (value: string) =>
  ({ LOW: "低", MEDIUM: "中", HIGH: "高", CRITICAL: "严重", EXTREME: "极高" }[value] ?? value);

export const formatPercent = (ratio: number) => `${Math.round((ratio || 0) * 100)}%`;

export const formatSource = (source: string | undefined) =>
  !source ? "未回填" : source === MAIN_SOURCE ? "主设备" : `志愿者 ${source.replace(/^volunteer-/, "")}`;

export const formatMastery = (level: string) =>
  MasteryLevelText[level as keyof typeof MasteryLevelText] ?? level;
