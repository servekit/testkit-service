/**
 * Common-usage examples (internal-only). One page, five patterns consumers
 * ask for: a searchable country box, a continent→country cascade, an
 * in-form country dropdown (flag + dial), a dial-prefixed phone input
 * wired to ParsePhone, and the country-picked defaults auto-fill. All
 * client-side over the directory + existing RPCs.
 */
import { PageContainer, ProCard } from "@ant-design/pro-components";
import {
  App,
  Button,
  Cascader,
  Input,
  List,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import CountrySelect from "../components/CountrySelect";
import {
  getCountryDefaults,
  listCountries,
  listCountriesByRegion,
  listRegionGroups,
  parsePhone,
} from "@/services/testkit/testkitService";

const { Text } = Typography;

export default function ReferenceExamplesPage() {
  const { message } = App.useApp();
  const [countries, setCountries] = useState<API.v1Country[]>();
  const [groups, setGroups] = useState<API.v1RegionGroup[]>();

  useEffect(() => {
    listCountries({ locale: "zh-Hans" })
      .then((r) => setCountries(r.countries ?? []))
      .catch(() => undefined);
    listRegionGroups({ locale: "zh-Hans" })
      .then((r) => setGroups(r.regionGroups ?? []))
      .catch(() => undefined);
  }, []);

  // 1. search box
  const [kw, setKw] = useState("");
  const hits = useMemo(() => {
    const k = kw.trim().toLowerCase();
    if (!k) return [];
    return (countries ?? [])
      .filter(
        (c) =>
          (c.regionCode ?? "").toLowerCase().includes(k) ||
          (c.name ?? "").toLowerCase().includes(k) ||
          (c.dialCode ?? "").includes(k),
      )
      .slice(0, 10);
  }, [kw, countries]);

  // 2. cascade
  const [regionPath, setRegionPath] = useState<string[]>();
  const [regionCountries, setRegionCountries] = useState<API.v1Country[]>();
  const regionCode = regionPath?.[regionPath.length - 1];
  useEffect(() => {
    if (!regionCode) {
      setRegionCountries(undefined);
      return;
    }
    let cancelled = false;
    listCountriesByRegion({ groupCode: regionCode, locale: "zh-Hans" })
      .then((r) => {
        if (!cancelled) setRegionCountries(r.countries ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [regionCode]);
  const cascadeOptions = useMemo(() => {
    const byParent = new Map<string, API.v1RegionGroup[]>();
    for (const g of groups ?? []) {
      const arr = byParent.get(g.parentCode ?? "") ?? [];
      arr.push(g);
      byParent.set(g.parentCode ?? "", arr);
    }
    const build = (parent: string): any[] =>
      (byParent.get(parent) ?? []).map((g) => ({
        value: g.groupCode,
        label: g.name,
        children: build(g.groupCode ?? ""),
      }));
    return build("");
  }, [groups]);

  // 3. in-form dropdown
  const [formCode, setFormCode] = useState<string>();
  const formCountry = (countries ?? []).find((c) => c.regionCode === formCode);

  // 4. dial-prefixed phone input
  const [dialCode, setDialCode] = useState<string>("CN");
  const dialCountry = (countries ?? []).find((c) => c.regionCode === dialCode);
  const [phone, setPhone] = useState("");
  const [parsed, setParsed] = useState<API.v1ParsePhoneResponse>();
  const [parsing, setParsing] = useState(false);
  const doParse = async () => {
    if (!phone.trim()) {
      message.warning("请输入手机号");
      return;
    }
    setParsing(true);
    try {
      const r = await parsePhone({
        raw: phone,
        defaultRegion: dialCode === "CN" && !phone.trim().startsWith("+") ? "CN" : "",
      });
      setParsed(r);
    } catch {
      /* surfaced by interceptor */
    } finally {
      setParsing(false);
    }
  };

  // 5. defaults auto-fill: pick a country once, GetCountryDefaults fills
  // the rest of the form in a single call — the registration-form pattern.
  // This card IS the defaults demo (the former standalone Defaults page
  // folded into here).
  const [fillCode, setFillCode] = useState<string>();
  const [fill, setFill] = useState<API.v1GetCountryDefaultsResponse>();
  const [filling, setFilling] = useState(false);
  useEffect(() => {
    if (!fillCode) {
      setFill(undefined);
      return;
    }
    let cancelled = false;
    setFilling(true);
    getCountryDefaults({ regionCode: fillCode, locale: "zh-Hans" })
      .then((d) => {
        if (!cancelled) setFill(d);
      })
      .catch(() => undefined) /* interceptor surfaces errors */
      .finally(() => {
        if (!cancelled) setFilling(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fillCode]);
  const filledField = (label: string, value: string | undefined, extra?: string) => (
    <Input
      addonBefore={label}
      value={value ?? ""}
      placeholder={fillCode ? "无数据" : "选择国家后自动填充"}
      suffix={extra ? <Text type="secondary">{extra}</Text> : undefined}
      readOnly
      style={{ width: 320 }}
    />
  );

  return (
    <PageContainer
      header={{
        title: "常用用法示例",
        subTitle: "reference-service · 搜索 / 级联 / 下拉 / 区号前缀 / 默认值填充",
      }}
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <ProCard title="① 国家搜索框（客户端过滤全量目录）" headerBordered>
          <Input.Search
            style={{ maxWidth: 360 }}
            placeholder="输入名称 / 代码 / 区号，如“日本” “+61” “DE”"
            allowClear
            onSearch={setKw}
            onChange={(e) => !e.target.value && setKw("")}
          />
          {kw && (
            <List
              size="small"
              style={{ marginTop: 12, maxWidth: 480 }}
              dataSource={hits}
              renderItem={(c) => (
                <List.Item>
                  {c.flagEmoji} {c.name}
                  <Text type="secondary">
                    {" "}
                    {c.regionCode} · {c.dialCode} · 示例 {c.exampleNumber}
                  </Text>
                </List.Item>
              )}
            />
          )}
        </ProCard>

        <ProCard title="② 洲 → 国家级联（区域接口递归聚合）" headerBordered>
          <Space wrap>
            <Cascader
              options={cascadeOptions}
              value={regionPath}
              onChange={(v) => setRegionPath(v as string[] | undefined)}
              changeOnSelect
              showSearch
              placeholder="选择大洲或次区域"
              style={{ minWidth: 280 }}
            />
            {regionCountries && <Tag color="blue">{regionCountries.length} 国</Tag>}
          </Space>
          {regionCountries && (
            <div style={{ marginTop: 12 }}>
              <CountrySelect
                countries={regionCountries}
                placeholder="该区域内的国家（供表单选择的二级下拉）"
                style={{ minWidth: 300 }}
              />
            </div>
          )}
        </ProCard>

        <ProCard title="③ 表单内国家下拉（国旗 + 名称 + 区号，可搜索）" headerBordered>
          <CountrySelect
            countries={countries}
            value={formCode}
            onChange={setFormCode}
            placeholder="像真实表单一样选择国家"
          />
          {formCountry && (
            <div style={{ marginTop: 12 }}>
              <Text>
                已选：{formCountry.flagEmoji} {formCountry.name}（{formCountry.regionCode}）
              </Text>
            </div>
          )}
        </ProCard>

        <ProCard title="④ 带区号前缀的手机号输入（直连 ParsePhone）" headerBordered>
          <Space wrap>
            <Select
              showSearch
              value={dialCode}
              onChange={setDialCode}
              style={{ width: 140 }}
              filterOption={(input, option) =>
                (option?.search ?? "").toLowerCase().includes(input.trim().toLowerCase())
              }
              options={(countries ?? []).map((c) => ({
                value: c.regionCode,
                search: `${c.regionCode} ${c.name} ${c.dialCode}`,
                label: (
                  <span>
                    {c.flagEmoji} {c.dialCode} {c.regionCode}
                  </span>
                ),
              }))}
            />
            <Input
              style={{ width: 280 }}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={dialCountry?.exampleNumber || "输入手机号（本地或国际格式）"}
              onPressEnter={doParse}
            />
            <Button type="primary" loading={parsing} onClick={doParse}>
              解析
            </Button>
          </Space>
          {parsed && (
            <div style={{ marginTop: 12 }}>
              {parsed.isValid ? <Tag color="green">有效</Tag> : <Tag color="red">无效</Tag>}
              <Text>
                {" "}
                {parsed.e164 || "-"} · 归属 {parsed.regionCode || "-"}
                {parsed.dialCode || ""} · {parsed.type}
                {parsed.errorReason ? ` · ${parsed.errorReason}` : ""}
              </Text>
            </div>
          )}
        </ProCard>

        <ProCard title="⑤ 选国家自动填默认值（GetCountryDefaults 一次调用）" headerBordered>
          <Space direction="vertical" size="middle">
            <CountrySelect
              countries={countries}
              value={fillCode}
              onChange={setFillCode}
              placeholder="像注册表单第一步那样选择国家"
              style={{ minWidth: 300 }}
            />
            <Spin spinning={filling}>
              <Space direction="vertical" size="small" style={{ width: "100%" }}>
                {filledField("区号", fill?.dialCode)}
                {filledField("默认时区", fill?.timezoneName, fill?.timezoneId)}
                {filledField("默认货币", fill?.currencyName ? `${fill.currencySymbol ?? ""} ${fill.currencyName}` : undefined, fill?.currencyCode)}
                {filledField("默认语言", fill?.languageName, fill?.languageTag)}
                {filledField("号码占位", fill?.exampleNumber)}
              </Space>
            </Spin>
          </Space>
        </ProCard>
      </Space>
    </PageContainer>
  );
}
