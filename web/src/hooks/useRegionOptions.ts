import { useRequest } from "@umijs/max";
import { listRegionCodes } from "@/services/testkit/testkitService";

/**
 * International dial-code directory for region pickers — fetched from
 * message-service via testkit's GET /api/v1/region-codes (public: the
 * register page needs it pre-login). cacheKey dedupes across pages/mounts.
 */
export function useRegionOptions(): { value: string; label: string }[] {
  const { data } = useRequest(
    async (): Promise<{ value: string; label: string }[]> => {
      const resp = await listRegionCodes();
      return (resp.regionCodes ?? []).map((r) => ({
        value: r.dialCode ?? "",
        label: `${r.dialCode ?? ""} ${r.nameZh || r.nameEn || r.code}`,
      }));
    },
    // @umijs/max's useRequest wraps ahooks v2 and defaults formatResult to
    // `r => r?.data` (requestOptions-style services); our service resolves with
    // the final array, so pass it through unchanged or data becomes undefined.
    { cacheKey: "region-codes", formatResult: (r) => r },
  );
  return (data as { value: string; label: string }[] | undefined) ?? [];
}
