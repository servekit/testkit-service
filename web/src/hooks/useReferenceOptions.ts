import { useRequest } from "@umijs/max";
import { listLanguages, listTimezones } from "@/services/testkit/testkitService";

/**
 * Timezone/language picker options from reference-service (public endpoints —
 * the register form renders pre-login). cacheKey dedupes across mounts.
 */
export function useTimezoneOptions(): { value: string; label: string }[] {
  const { data } = useRequest(
    async (): Promise<{ value: string; label: string }[]> => {
      const resp = await listTimezones({ locale: "zh-Hans" });
      return (resp.timezones ?? []).map((t) => ({
        value: t.id ?? "",
        label: `${t.name}（${t.id}）`,
      }));
    },
    { cacheKey: "reference-timezones", formatResult: (r) => r },
  );
  return (data as { value: string; label: string }[] | undefined) ?? [];
}

export function useLanguageOptions(): { value: string; label: string }[] {
  const { data } = useRequest(
    async (): Promise<{ value: string; label: string }[]> => {
      const resp = await listLanguages({ locale: "zh-Hans" });
      return (resp.languages ?? []).map((l) => ({
        value: l.tag ?? "",
        label: `${l.name}（${l.tag}）`,
      }));
    },
    { cacheKey: "reference-languages", formatResult: (r) => r },
  );
  return (data as { value: string; label: string }[] | undefined) ?? [];
}
