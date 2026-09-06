import { ActionType } from "@ant-design/pro-components";
import { Button, Space } from "antd";
import { useCallback, useMemo, useRef, useState, type ReactNode, type MutableRefObject } from "react";

/**
 * Progressive pagination over a cursor-based list RPC, as a ProTable companion.
 *
 * Cursor APIs cannot answer "how many rows in total" — a numbered pager with a
 * 总共 count would either lie or fluctuate on every fetch. So: 上一页/下一页
 * only. 下一页 disables exactly when the last fetch returned no next cursor;
 * the cumulative 已加载 count only grows as pages are walked. Page state lives
 * in a ref (ProTable's `pagination` is off — it always asks for page 1, we
 * override with the pager's page and drive reloads through actionRef).
 */
export function useCursorTable<T>(
  fetch: (params: Record<string, unknown> & { cursor?: string; pageSize: number }) => Promise<{
    items?: T[];
    nextCursor?: string;
  }>,
  defaultPageSize = 20,
): {
  actionRef: MutableRefObject<ActionType | undefined>;
  request: (params: Record<string, unknown> & { current?: number; pageSize?: number }) => Promise<{
    data: T[];
    success: boolean;
  }>;
  pager: ReactNode;
} {
  const actionRef = useRef<ActionType>(undefined);
  const pageRef = useRef(1);
  const [state, setState] = useState({ page: 1, hasMore: false, loaded: 0, loading: false });
  // Cursor chain for the CURRENT query window: entry cursor per fetched page
  // (pageCursors[0] === "" = page 1); ended = the chain hit the last page.
  const chain = useRef({ cursors: [""] as string[], filterKey: "", pageSize: 0, ended: false });

  // The fetcher is captured once: keep it free of reactive closures and pass
  // filter fields through ProTable's params instead.
  const request = useMemo(
    () =>
      async (params: Record<string, unknown> & { current?: number; pageSize?: number }) => {
        const { current: _c, pageSize: _p, ...filters } = params;
        const pageSize = params.pageSize ?? defaultPageSize;
        const filterKey = JSON.stringify(filters);
        const c = chain.current;
        if (filterKey !== c.filterKey || pageSize !== c.pageSize) {
          // New query window (filter submit / reset / size change): restart at page 1.
          c.cursors = [""];
          c.filterKey = filterKey;
          c.pageSize = pageSize;
          c.ended = false;
          pageRef.current = 1;
        }
        const want = pageRef.current;

        setState((s) => ({ ...s, loading: true }));
        try {
          // Walk the chain forward until page `want` has an entry cursor.
          while (!c.ended && c.cursors.length < want) {
            const cursor = c.cursors[c.cursors.length - 1];
            const resp = await fetch({ ...filters, cursor: cursor || undefined, pageSize });
            if (resp.nextCursor) {
              c.cursors.push(resp.nextCursor);
            } else {
              c.ended = true;
            }
          }

          const entry = c.cursors[want - 1];
          let data: T[] = [];
          let hasMore = false;
          if (entry !== undefined) {
            const resp = await fetch({ ...filters, cursor: entry || undefined, pageSize });
            data = resp.items ?? [];
            if (resp.nextCursor) {
              if (c.cursors.length === want) c.cursors.push(resp.nextCursor);
              c.ended = false;
              hasMore = true;
            } else {
              c.ended = true;
              c.cursors = c.cursors.slice(0, want);
            }
          }
          setState({ page: want, hasMore, loaded: (want - 1) * pageSize + data.length, loading: false });
          return { data, success: true };
        } catch (err) {
          setState((s) => ({ ...s, loading: false }));
          throw err;
        }
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const go = useCallback((page: number) => {
    pageRef.current = page;
    actionRef.current?.reload();
  }, []);

  const pager = (
    <Space style={{ display: "flex", justifyContent: "flex-end" }}>
      <span>
        已加载 {state.loaded} 条
        {!state.hasMore && state.loaded > 0 ? " · 没有更多了" : ""}
      </span>
      <Button size="small" disabled={state.page <= 1 || state.loading} onClick={() => go(state.page - 1)}>
        上一页
      </Button>
      <Button
        size="small"
        disabled={!state.hasMore || state.loading}
        loading={state.loading}
        onClick={() => go(state.page + 1)}
      >
        下一页
      </Button>
    </Space>
  );

  return { actionRef, request, pager };
}
