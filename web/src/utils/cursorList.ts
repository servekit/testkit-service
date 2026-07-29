/**
 * Run a cursor-paginated list RPC as a ProTable `request`.
 *
 * The P2 RBAC list RPCs (roles / groups / permissions / permission-groups) are
 * cursor-based, not offset-based. For the admin UIs we fetch a bounded first
 * page (default 100) and disable server-side pagination — these datasets are
 * small and a full cursor-paging UX is out of scope for P2.
 */
export async function cursorList<T>(
  fetcher: (pageSize: number) => Promise<{ items?: T[] }>,
  pageSize = 100,
): Promise<{ data: T[]; success: boolean }> {
  const resp = await fetcher(pageSize);
  return { data: resp.items ?? [], success: true };
}
