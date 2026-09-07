/**
 * Region browse (internal-only). Standalone surface for
 * ListCountriesByRegion: pick a group at any level (continent or
 * sub-region) and get its countries recursively, in the current locale
 * collation. The Directory page keeps its click-to-expand drawer; this page
 * is the dedicated menu entry.
 */
import { PageContainer, ProCard } from "@ant-design/pro-components";
import { Cascader, Space, Spin, Table, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import {
  listCountriesByRegion,
  listRegionGroups,
} from "@/services/testkit/testkitService";
import { listPagination } from "@/utils/pagination";

const { Text } = Typography;

type GroupNode = { value: string; label: string; children?: GroupNode[] };

export default function ReferenceRegionsPage() {
  const [groups, setGroups] = useState<API.v1RegionGroup[]>();
  const [selected, setSelected] = useState<string[]>();
  const [countries, setCountries] = useState<API.v1Country[]>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listRegionGroups({ locale: "zh-Hans" })
      .then((r) => setGroups(r.regionGroups ?? []))
      .catch(() => undefined);
  }, []);

  const options = useMemo<GroupNode[]>(() => {
    const list = groups ?? [];
    const byParent = new Map<string, API.v1RegionGroup[]>();
    for (const g of list) {
      const arr = byParent.get(g.parentCode ?? "") ?? [];
      arr.push(g);
      byParent.set(g.parentCode ?? "", arr);
    }
    const build = (parent: string): GroupNode[] =>
      (byParent.get(parent) ?? []).map((g) => ({
        value: g.code ?? "",
        label: `${g.name}（${g.code}）`,
        children: build(g.code ?? ""),
      }));
    return build("");
  }, [groups]);

  const selectedCode = selected?.[selected.length - 1];
  const selectedName = (groups ?? []).find((g) => g.code === selectedCode)?.name;

  useEffect(() => {
    if (!selectedCode) {
      setCountries(undefined);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setCountries(undefined);
    listCountriesByRegion({ regionCode: selectedCode, locale: "zh-Hans" })
      .then((r) => {
        if (!cancelled) setCountries(r.countries ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCode]);

  return (
    <PageContainer
      header={{
        title: "区域浏览",
        subTitle: "reference-service · 洲/区域 → 国家（递归聚合）",
      }}
    >
      <ProCard title="选择区域（洲 → 次区域）" headerBordered>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <Space wrap>
            <Cascader
              options={options}
              value={selected}
              onChange={(v) => setSelected(v as string[] | undefined)}
              changeOnSelect
              showSearch
              placeholder="选择大洲或次区域"
              style={{ minWidth: 320 }}
            />
            {selectedName && (
              <Tag color="blue">
                {selectedName} · {countries?.length ?? "…"} 国
              </Tag>
            )}
          </Space>
          <Text type="secondary">
            选“亚洲”递归返回全部 51 国；选“东亚”只返回直接成员 8 国。接口：
            GET /api/v1/reference/regions/&#123;code&#125;/countries
          </Text>
        </Space>
      </ProCard>

      {selectedCode && (
        <ProCard
          title={`${selectedName ?? selectedCode} 的国家`}
          headerBordered
          style={{ marginTop: 16 }}
        >
          <Spin spinning={loading}>
            <Table
              size="small"
              rowKey="code"
              pagination={listPagination}
              dataSource={countries ?? []}
              columns={[
                {
                  title: "国旗",
                  dataIndex: "flagEmoji",
                  width: 56,
                  render: (v: string) => <span style={{ fontSize: 18 }}>{v}</span>,
                },
                { title: "名称", dataIndex: "name" },
                { title: "alpha-2", dataIndex: "code", width: 90 },
                { title: "区号", dataIndex: "dialCode", width: 90 },
                { title: "示例号码", dataIndex: "exampleNumber" },
              ]}
            />
          </Spin>
        </ProCard>
      )}
    </PageContainer>
  );
}
