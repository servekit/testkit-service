/**
 * Reference directory console (internal-only). One page over the five
 * reference-service directories — countries / timezones / languages /
 * currencies / region groups — with a locale switcher (the 11 compiled
 * locales) and client-side search. Data is static and fetched once per
 * (tab, locale); data_version shows which snapshot is served.
 * The countries tab shows every field inline: the list APIs are joined
 * client-side (region chain, currencies, timezones) and language_tags on
 * each row carry the official languages — no per-country detail round-trip.
 * access: canInternal at the route level.
 */
import { PageContainer, ProCard } from "@ant-design/pro-components";
import {
  Drawer,
  Input,
  Segmented,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
  Tooltip,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import {
  listCountries,
  listCountriesByRegion,
  listCurrencies,
  listLanguages,
  listRegionGroups,
  listTimezones,
} from "@/services/testkit/testkitService";
import { listPagination } from "@/utils/pagination";

const { Text } = Typography;

const LOCALES = [
  { value: "zh-Hans", label: "简体中文" },
  { value: "zh-Hant", label: "繁體中文" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
  { value: "es", label: "Español" },
  { value: "ar", label: "العربية" },
  { value: "ru", label: "Русский" },
];

type Domain = "countries" | "timezones" | "languages" | "currencies" | "groups";

const DOMAIN_LABEL: Record<Domain, string> = {
  countries: "国家",
  timezones: "时区",
  languages: "语言",
  currencies: "货币",
  groups: "区域分组",
};

/** Joins the four other directories onto each country row. All inputs are
 * already in the request locale's collation order, so the joined lists keep
 * that order — same shape GetCountryProfile returns, without the N+1 calls. */
function buildCountryJoin(
  groups: API.v1RegionGroup[],
  currencies: API.v1Currency[],
  timezones: API.v1Timezone[],
  languages: API.v1Language[],
) {
  const groupByCode = new Map(groups.map((g) => [g.groupCode, g]));
  const langName = new Map(languages.map((l) => [l.tag, l.name ?? l.tag]));

  // Country -> set of group codes (direct membership plus ancestors), then
  // emitted in the list's top-down order — the same chain GetCountryProfile
  // returns (continent before sub-region).
  const regionCodes = new Map<string, Set<string>>();
  for (const g of groups) {
    for (const cc of g.regionCodes ?? []) {
      let set = regionCodes.get(cc);
      if (!set) {
        set = new Set();
        regionCodes.set(cc, set);
      }
      for (let cur = g.groupCode; cur; cur = groupByCode.get(cur)?.parentCode) {
        set.add(cur);
      }
    }
  }
  const regionChain = new Map<string, string[]>();
  for (const [cc, set] of regionCodes) {
    const chain: string[] = [];
    for (const g of groups) {
      if (set.has(g.groupCode ?? "")) chain.push(g.name ?? g.groupCode ?? "");
    }
    regionChain.set(cc, chain);
  }

  const currenciesOf = new Map<string, API.v1Currency[]>();
  for (const cur of currencies) {
    for (const cc of cur.regionCodes ?? []) {
      const list = currenciesOf.get(cc) ?? [];
      list.push(cur);
      currenciesOf.set(cc, list);
    }
  }
  const timezonesOf = new Map<string, API.v1Timezone[]>();
  for (const tz of timezones) {
    for (const cc of tz.regionCodes ?? []) {
      const list = timezonesOf.get(cc) ?? [];
      list.push(tz);
      timezonesOf.set(cc, list);
    }
  }
  return { regionChain, currenciesOf, timezonesOf, langName };
}

export default function ReferenceDirectoryPage() {
  const [regionCountries, setRegionCountries] = useState<API.v1Country[]>();
  const [regionTitle, setRegionTitle] = useState<string>();
  const [regionLoading, setRegionLoading] = useState(false);

  const openRegion = (code: string, name: string) => {
    setRegionTitle(name);
    setRegionCountries(undefined);
    setRegionLoading(true);
    listCountriesByRegion({ groupCode: code, locale })
      .then((r) => setRegionCountries(r.countries ?? []))
      .catch(() => undefined)
      .finally(() => setRegionLoading(false));
  };
  const [locale, setLocale] = useState("zh-Hans");
  const [domain, setDomain] = useState<Domain>("countries");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState<string>();

  const [countries, setCountries] = useState<API.v1Country[]>();
  const [timezones, setTimezones] = useState<API.v1Timezone[]>();
  const [languages, setLanguages] = useState<API.v1Language[]>();
  const [currencies, setCurrencies] = useState<API.v1Currency[]>();
  const [groups, setGroups] = useState<API.v1RegionGroup[]>();

  // Fetch the CURRENT tab whenever the tab or the locale changes — the
  // tables are keyed off both, so a locale switch re-renders in place
  // instead of waiting for a tab round-trip. The countries tab also pulls
  // the four join inputs (all static, fetched once per locale).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (domain === "countries") {
          const [r, g, cur, tz, lang] = await Promise.all([
            listCountries({ locale }),
            listRegionGroups({ locale }),
            listCurrencies({ locale }),
            listTimezones({ locale }),
            listLanguages({ locale }),
          ]);
          if (!cancelled) {
            setCountries(r.countries ?? []);
            setGroups(g.regionGroups ?? []);
            setCurrencies(cur.currencies ?? []);
            setTimezones(tz.timezones ?? []);
            setLanguages(lang.languages ?? []);
            setVersion(r.dataVersion);
          }
        } else if (domain === "timezones") {
          const r = await listTimezones({ locale });
          if (!cancelled) { setTimezones(r.timezones ?? []); setVersion(r.dataVersion); }
        } else if (domain === "languages") {
          const r = await listLanguages({ locale });
          if (!cancelled) { setLanguages(r.languages ?? []); setVersion(r.dataVersion); }
        } else if (domain === "currencies") {
          const r = await listCurrencies({ locale });
          if (!cancelled) { setCurrencies(r.currencies ?? []); setVersion(r.dataVersion); }
        } else if (domain === "groups") {
          const r = await listRegionGroups({ locale });
          if (!cancelled) { setGroups(r.regionGroups ?? []); setVersion(r.dataVersion); }
        }
      } catch {
        /* request interceptor surfaces errors */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [domain, locale]);

  const kw = keyword.trim().toLowerCase();
  const match = (...fields: (string | undefined)[]) =>
    !kw || fields.some((f) => (f ?? "").toLowerCase().includes(kw));

  const join = useMemo(
    () => buildCountryJoin(groups ?? [], currencies ?? [], timezones ?? [], languages ?? []),
    [groups, currencies, timezones, languages],
  );

  const countryColumns = useMemo(
    () => [
      { title: "国旗", dataIndex: "flagEmoji", width: 52, render: (v: string) => <span style={{ fontSize: 18 }}>{v}</span> },
      { title: "alpha-2", dataIndex: "regionCode", width: 76 },
      { title: "alpha-3", dataIndex: "alpha3", width: 76, render: (v: string) => v || "—" },
      { title: "区号", dataIndex: "dialCode", width: 80 },
      { title: "名称", dataIndex: "name", width: 150 },
      { title: "示例号码", dataIndex: "exampleNumber", width: 165, render: (v: string) => v || "—" },
      {
        title: "官方语言",
        dataIndex: "languageTags",
        width: 130,
        render: (tags: string[]) =>
          tags?.length ? tags.map((t) => join.langName.get(t) ?? t).join("、") : "—",
      },
      {
        title: "货币",
        dataIndex: "currencies",
        width: 175,
        render: (list: API.v1Currency[]) =>
          list?.length
            ? list.map((c) => `${c.name} ${c.symbol} (${c.code})`).join("；")
            : "—",
      },
      {
        title: "时区",
        dataIndex: "timezones",
        width: 185,
        render: (list: API.v1Timezone[]) => {
          if (!list?.length) return "—";
          const ids = list.map((t) => t.id);
          if (ids.length <= 2) return ids.join("、");
          return (
            <Tooltip title={ids.join("、")}>
              <Tag>{ids[0]} 等 {ids.length} 个</Tag>
            </Tooltip>
          );
        },
      },
      {
        title: "区域",
        dataIndex: "regionChain",
        width: 195,
        render: (chain: string[]) => chain?.join(" · ") || "—",
      },
    ],
    [join],
  );
  const timezoneColumns = useMemo(
    () => [
      { title: "IANA ID", dataIndex: "id", width: 220 },
      { title: "名称", dataIndex: "name", width: 140 },
      {
        title: "国家",
        dataIndex: "regionCodes",
        render: (v: string[]) => v?.join(", "),
      },
      {
        title: "别名",
        dataIndex: "aliases",
        width: 200,
        render: (v: string[]) =>
          v?.length ? (
            <Tooltip title={v.join("、")}>
              <Tag>{v.length} 个</Tag>
            </Tooltip>
          ) : (
            "-"
          ),
      },
    ],
    [],
  );
  const languageColumns = useMemo(
    () => [
      { title: "BCP 47", dataIndex: "tag", width: 140 },
      { title: "名称", dataIndex: "name" },
      {
        title: "当地名称",
        dataIndex: "nativeName",
        width: 180,
        // No fallback to the locale name — this column means "the language's
        // OWN name"; languages without CLDR endonym data show a dash.
        render: (v: string) => v || "—",
      },
    ],
    [],
  );
  const currencyColumns = useMemo(
    () => [
      {
        title: "国旗",
        dataIndex: "flagEmoji",
        width: 60,
        render: (v: string) => <span style={{ fontSize: 18 }}>{v || "-"}</span>,
      },
      { title: "代码", dataIndex: "code", width: 90 },
      { title: "符号", dataIndex: "symbol", width: 90 },
      { title: "小数位", dataIndex: "minorUnits", width: 80 },
      { title: "名称", dataIndex: "name" },
      {
        title: "使用国家/地区",
        dataIndex: "regionCodes",
        render: (v: string[]) => v?.length ?? 0,
      },
    ],
    [],
  );
  const groupColumns = useMemo(
    () => [
      { title: "M49", dataIndex: "groupCode", width: 80 },
      { title: "名称", dataIndex: "name", width: 140 },
      {
        title: "层级",
        dataIndex: "parentCode",
        width: 100,
        render: (v: string) => (v ? `└ ${v}` : "顶级"),
      },
      {
        title: "直接成员",
        dataIndex: "regionCodes",
        render: (v: string[]) => v?.length ?? 0,
      },
    ],
    [],
  );

  const tables: Record<Domain, { columns: any[]; rows: { key: string; [k: string]: any }[] }> = {
    countries: {
      columns: countryColumns,
      rows: (countries ?? [])
        .map((c) => {
          const chain = join.regionChain.get(c.regionCode ?? "") ?? [];
          const curs = join.currenciesOf.get(c.regionCode ?? "") ?? [];
          const tzs = join.timezonesOf.get(c.regionCode ?? "") ?? [];
          const langText = (c.languageTags ?? []).map((t) => join.langName.get(t) ?? t);
          return {
            ...c,
            regionChain: chain,
            currencies: curs,
            timezones: tzs,
            // Fold the joined fields into the search corpus so "欧元" / "EUR"
            // / "Asia/Shanghai" / "东亚" all filter rows.
            searchText: [
              c.regionCode, c.alpha3, c.dialCode, c.name, c.exampleNumber,
              langText.join(" "), (c.languageTags ?? []).join(" "),
              curs.map((x) => `${x.code} ${x.name}`).join(" "),
              tzs.map((x) => x.id).join(" "),
              chain.join(" "),
            ].join(" "),
            key: c.regionCode ?? "",
          };
        })
        .filter((r) => !kw || r.searchText.toLowerCase().includes(kw)),
    },
    timezones: {
      columns: timezoneColumns,
      rows: (timezones ?? [])
        .filter((t) => match(t.id, t.name, ...(t.regionCodes ?? [])))
        .map((t) => ({ ...t, key: t.id ?? "" })),
    },
    languages: {
      columns: languageColumns,
      rows: (languages ?? [])
        .filter((l) => match(l.tag, l.name, l.nativeName))
        .map((l) => ({ ...l, key: l.tag ?? "" })),
    },
    currencies: {
      columns: currencyColumns,
      rows: (currencies ?? [])
        .filter((c) => match(c.code, c.symbol, c.name))
        .map((c) => ({ ...c, key: c.code ?? "" })),
    },
    groups: {
      columns: groupColumns,
      rows: (groups ?? [])
        .filter((g) => match(g.groupCode, g.name))
        .map((g) => ({ ...g, key: g.groupCode ?? "" })),
    },
  };

  const current = tables[domain];

  return (
    <PageContainer
      header={{
        title: "参考数据目录",
        subTitle: "reference-service · 全球静态参考数据",
        extra: version ? <Tag color="blue">数据版本 {version}</Tag> : undefined,
      }}
    >
      <ProCard
        headerBordered
        title={
          <span>
            <Segmented
              value={domain}
              onChange={(v) => setDomain(v as Domain)}
              options={(Object.keys(DOMAIN_LABEL) as Domain[]).map((d) => ({
                label: DOMAIN_LABEL[d],
                value: d,
              }))}
            />
          </span>
        }
        extra={
          <span style={{ display: "inline-flex", gap: 8 }}>
            <Select
              size="small"
              value={locale}
              onChange={setLocale}
              options={LOCALES}
              style={{ width: 140 }}
            />
            <Input.Search
              size="small"
              allowClear
              placeholder="搜索代码或名称"
              onSearch={setKeyword}
              onChange={(e) => !e.target.value && setKeyword("")}
              style={{ width: 200 }}
            />
          </span>
        }
      >
        <Spin spinning={loading}>
          <Table
            size="small"
            columns={current.columns}
            dataSource={current.rows}
            onRow={
              domain === "groups"
                ? (r) => ({
                    onClick: () => openRegion(String(r.groupCode), String(r.name)),
                    style: { cursor: "pointer" },
                  })
                : undefined
            }
            pagination={listPagination}
          />
        </Spin>
      </ProCard>
      <Drawer
        open={!!regionTitle}
        onClose={() => {
          setRegionTitle(undefined);
          setRegionCountries(undefined);
        }}
        width={420}
        title={regionTitle ? `${regionTitle} · 国家（含次级分组）` : "区域国家"}
      >
        <Spin spinning={regionLoading}>
          {(regionCountries ?? []).map((c) => (
            <div key={c.regionCode} style={{ padding: "4px 0" }}>
              {c.flagEmoji} {c.name} <Text type="secondary">{c.regionCode} · {c.dialCode}</Text>
            </div>
          ))}
          {!regionLoading && (regionCountries ?? []).length === 0 && <Text type="secondary">无直接成员国</Text>}
        </Spin>
      </Drawer>
    </PageContainer>
  );
}
