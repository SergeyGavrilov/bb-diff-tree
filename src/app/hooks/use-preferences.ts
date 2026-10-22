import { useSettings } from "@get-bb/plugin-sdk/app";
import { readSettings } from "../../shared/settings";

export function usePreferences() {
  const settings = useSettings();
  return { ...readSettings(settings.values), loading: settings.isLoading };
}
