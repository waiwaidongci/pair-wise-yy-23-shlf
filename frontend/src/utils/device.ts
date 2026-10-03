// 设备身份：每台设备（志愿者手机 / 主设备）拥有稳定来源标识，用于区分答题记录来源。
import { get, put, STORES } from "./storage";

const DEVICE_KEY = "device-id";
const DEVICE_NAME_KEY = "device-name";

function randomId(): string {
  return "dev-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export async function getDeviceId(): Promise<string> {
  const existing = await get<{ key: string; value: string }>(STORES.META, DEVICE_KEY);
  if (existing?.value) return existing.value;
  const id = randomId();
  await put(STORES.META, { key: DEVICE_KEY, value: id }, "key");
  return id;
}

export async function getDeviceName(): Promise<string> {
  const existing = await get<{ key: string; value: string }>(STORES.META, DEVICE_NAME_KEY);
  return existing?.value ?? "本机";
}

export async function setDeviceName(name: string): Promise<void> {
  await put(STORES.META, { key: DEVICE_NAME_KEY, value: name }, "key");
}

export async function isMainDevice(): Promise<boolean> {
  const id = await getDeviceId();
  return id === "main" || (await getDeviceName()) === "主设备";
}
