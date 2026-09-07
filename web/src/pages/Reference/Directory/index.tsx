/**
 * Reference directory console (internal-only). One page over the five
 * reference-service directories — countries / timezones / languages /
 * currencies / region groups — with a locale switcher (the 11 compiled
 * locales) and client-side search. Data is static and fetched once per
 * (tab, locale); data_version shows which snapshot is served.
 * access: canInternal at the route level.
 */
import { PageContainer, ProCard } from "@ant-design/pro-components";
import {
  App,
  Descriptions,
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
  getCountryDefaults,
  getCountryProfile,
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

function ProfileDrawer({
  code,
  locale,
  onClose,
}: {
  code?: string;
  locale: string;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const [profile, setProfile] = useState<API.v1GetCountryProfileResponse>();
  const [defaults, setDefaults] = useState<API.v1GetCountryDefaultsResponse>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setLoading(true);
    getCountryDefaults({ countryCode: code, locale }).then((d) => {
      if (!cancelled) setDefaults(d);
    }).catch(() => {
      /* defaults are additive; profile still renders */
    });
    getCountryProfile({ countryCode: code, locale })
      .then((r) => {
        if (!cancelled) setProfile(r);
      })
      .catch(() => {
        if (!cancelled) message.error("加载国家详情失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code, locale]);

  const c = profile?.country;
  return (
    <Drawer
      open={!!code}
      onClose={onClose}
      width={520}
      title={
        c ? (
          <span style={{ fontSize: 20 }}>
            {c.flagEmoji} {c.name} <Text type="secondary">{c.code}</Text>
          </span>
        ) : (
          "国家详情"
        )
      }
    >
      <Spin spinning={loading}>
        {profile && (
          <Descriptions column={1} bordered size="small" labelStyle={{ width: 110 }}>
            <Descriptions.Item label="区号">{c?.dialCode}</Descriptions.Item>
            <Descriptions.Item label="alpha-3">{c?.alpha3}</Descriptions.Item>
            <Descriptions.Item label="所属区域">
              {(profile.regionGroups ?? []).map((g) => g.name).join(" → ") || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="官方语言">
              {(profile.languages ?? []).map((l) => `${l.name} (${l.tag})`).join("、") || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="货币">
              {(profile.currencies ?? [])
                .map((cur) => `${cur.flagEmoji ?? ""} ${cur.name} ${cur.symbol} (${cur.code})`)
                .join("；") || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="时区">
              {(profile.timezones ?? []).map((tz) => `${tz.id}（${tz.name}）`).join("、") || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="默认时区">
              {defaults ? `${defaults.timezoneName}（${defaults.timezoneId}）` : "…"}
            </Descriptions.Item>
            <Descriptions.Item label="默认语言">
              {defaults ? `${defaults.languageName}（${defaults.languageTag}）` : "…"}
            </Descriptions.Item>
            <Descriptions.Item label="示例号码">
              {profile.country?.exampleNumber || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="数据版本">{profile.dataVersion}</Descriptions.Item>
          </Descriptions>
        )}
      </Spin>
    </Drawer>
  );
}

export default function ReferenceDirectoryPage() {
  const [detailCode, setDetailCode] = useState<string>();
  const [regionCountries, setRegionCountries] = useState<API.v1Country[]>();
  const [regionTitle, setRegionTitle] = useState<string>();
  const [regionLoading, setRegionLoading] = useState(false);

  const openRegion = (code: string, name: string) => {
    setRegionTitle(name);
    setRegionCountries(undefined);
    setRegionLoading(true);
    listCountriesByRegion({ regionCode: code, locale })
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
  // instead of waiting for a tab round-trip.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (domain === "countries") {
          const r = await listCountries({ locale });
          if (!cancelled) { setCountries(r.countries ?? []); setVersion(r.dataVersion); }
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

  const countryColumns = useMemo(
    () => [
      { title: "国旗", dataIndex: "flagEmoji", width: 56, render: (v: string) => <span style={{ fontSize: 18 }}>{v}</span> },
      { title: "alpha-2", dataIndex: "code", width: 90 },
      { title: "alpha-3", dataIndex: "alpha3", width: 90 },
      { title: "区号", dataIndex: "dialCode", width: 90 },
      { title: "名称", dataIndex: "name" },
    ],
    [],
  );
  const timezoneColumns = useMemo(
    () => [
      { title: "IANA ID", dataIndex: "id", width: 220 },
      { title: "名称", dataIndex: "name", width: 140 },
      {
        title: "国家",
        dataIndex: "countryCodes",
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
        dataIndex: "countryCodes",
        render: (v: string[]) => v?.length ?? 0,
      },
    ],
    [],
  );
  const groupColumns = useMemo(
    () => [
      { title: "M49", dataIndex: "code", width: 80 },
      { title: "名称", dataIndex: "name", width: 140 },
      {
        title: "层级",
        dataIndex: "parentCode",
        width: 100,
        render: (v: string) => (v ? `└ ${v}` : "顶级"),
      },
      {
        title: "直接成员",
        dataIndex: "countryCodes",
        render: (v: string[]) => v?.length ?? 0,
      },
    ],
    [],
  );

  const tables: Record<Domain, { columns: any[]; rows: { key: string; [k: string]: any }[] }> = {
    countries: {
      columns: countryColumns,
      rows: (countries ?? [])
        .filter((c) => match(c.code, c.alpha3, c.dialCode, c.name))
        .map((c) => ({ ...c, key: c.code ?? "" })),
    },
    timezones: {
      columns: timezoneColumns,
      rows: (timezones ?? [])
        .filter((t) => match(t.id, t.name, ...(t.countryCodes ?? [])))
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
        .filter((g) => match(g.code, g.name))
        .map((g) => ({ ...g, key: g.code ?? "" })),
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
              domain === "countries"
                ? (r) => ({ onClick: () => setDetailCode(String(r.code)), style: { cursor: "pointer" } })
                : domain === "groups"
                  ? (r) => ({
                      onClick: () => openRegion(String(r.code), String(r.name)),
                      style: { cursor: "pointer" },
                    })
                  : undefined
            }
            pagination={listPagination}
          />
        </Spin>
      </ProCard>
      <ProfileDrawer code={detailCode} locale={locale} onClose={() => setDetailCode(undefined)} />
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
            <div
              key={c.code}
              style={{ padding: "4px 0", cursor: "pointer" }}
              onClick={() => {
                setRegionTitle(undefined);
                setDetailCode(c.code);
              }}
            >
              {c.flagEmoji} {c.name} <Text type="secondary">{c.code} · {c.dialCode}</Text>
            </div>
          ))}
          {!regionLoading && (regionCountries ?? []).length === 0 && <Text type="secondary">无直接成员国</Text>}
        </Spin>
      </Drawer>
    </PageContainer>
  );
}
