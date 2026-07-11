import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type SettingRow = {
  key: string;
  value: string;
  label: string;
  group: string;
};

/**
 * useSettings — loads all platform settings as a key/value map.
 *
 * The Convex query `api.settings.getAll` returns an array of
 * `{ key, value, label, group }` objects. This hook converts that into
 * a convenient accessor object with typed shortcuts for known settings.
 */
export function useSettings() {
  // Cast to any to avoid type recursion from the generated api stub.
  const result = useQuery(api.settings.getAll as any) as
    | SettingRow[]
    | undefined;

  const isLoading = result === undefined;

  // Build a raw key → value record.
  const raw: Record<string, string> = {};
  if (Array.isArray(result)) {
    for (const row of result) {
      if (row && typeof row.key === "string") {
        raw[row.key] = row.value;
      }
    }
  }

  /** Get a raw string value by key. */
  const get = (key: string): string | undefined => raw[key];

  /** Get a numeric value by key (falls back to default). */
  const getNumber = (key: string, fallback = 0): number => {
    const val = raw[key];
    if (val === undefined || val === null || val === "") return fallback;
    const num = parseFloat(val);
    return isNaN(num) ? fallback : num;
  };

  /** Get a boolean value by key ("true"/"1"/"yes" → true). */
  const getBoolean = (key: string, fallback = false): boolean => {
    const val = raw[key];
    if (val === undefined || val === null || val === "") return fallback;
    return val.toLowerCase() === "true" || val === "1" || val.toLowerCase() === "yes";
  };

  return {
    isLoading,
    raw,
    get,
    getNumber,
    getBoolean,

    // ---- Typed shortcuts for known settings ----
    get platformName(): string {
      return get("platformName") ?? "ClickEarn Pro";
    },
    get registrationFee(): number {
      return getNumber("registrationFee", 1500);
    },
    get referralReward(): number {
      return getNumber("referralReward", 500);
    },
    get dailyBonus(): number {
      return getNumber("dailyBonus", 50);
    },
    get readReward(): number {
      return getNumber("readReward", 10);
    },
    get watchReward(): number {
      return getNumber("watchReward", 15);
    },
    get taskReward(): number {
      return getNumber("taskReward", 20);
    },
    get blogReward(): number {
      return getNumber("blogReward", 100);
    },
    get minCashout(): number {
      return getNumber("minCashout", 3000);
    },
    get usdToNgnRate(): number {
      return getNumber("usdToNgnRate", 1500);
    },
    get paymentProvider(): string {
      return get("paymentProvider") ?? "Bank Transfer";
    },
    get paymentAccountName(): string {
      return get("paymentAccountName") ?? "";
    },
    get paymentAccountNumber(): string {
      return get("paymentAccountNumber") ?? "";
    },
    get maintenanceMode(): boolean {
      return getBoolean("maintenanceMode", false);
    },
    get supportEmail(): string {
      return get("supportEmail") ?? "support@clickearn.pro";
    },
    get supportWhatsapp(): string {
      return get("supportWhatsapp") ?? "";
    },
    get telegramLink(): string {
      return get("telegramLink") ?? "";
    },
  };
}

export default useSettings;
