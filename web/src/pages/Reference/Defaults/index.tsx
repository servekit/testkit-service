/**
 * Country defaults demo (internal-only). The auto-fill story as a form:
 * pick a country once and GetCountryDefaults fills timezone / currency /
 * language / dial code / example number — the registration-form pattern,
 * one call, no follow-up lookups. The raw response is shown for the
 * console's debugging nature.
 */
import { PageContainer, ProCard } from "@ant-design/pro-components";
import { App, Form, Input, Spin, Typography } from "antd";
import { useEffect, useState } from "react";
import CountrySelect from "../components/CountrySelect";
import {
  getCountryDefaults,
  listCountries,
} from "@/services/testkit/testkitService";

const { Text } = Typography;

export default function ReferenceDefaultsPage() {
  const { message } = App.useApp();
  const [countries, setCountries] = useState<API.v1Country[]>();
  const [code, setCode] = useState<string>();
  const [defaults, setDefaults] = useState<API.v1GetCountryDefaultsResponse>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listCountries({ locale: "zh-Hans" })
      .then((r) => setCountries(r.countries ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!code) {
      setDefaults(undefined);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCountryDefaults({ countryCode: code, locale: "zh-Hans" })
      .then((d) => {
        if (!cancelled) setDefaults(d);
      })
      .catch(() => message.error("获取默认值失败"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const selected = (countries ?? []).find((c) => c.code === code);

  return (
    <PageContainer
      header={{
        title: "默认值填充",
        subTitle: "reference-service · 选国家 → 一次调用自动填全表单",
      }}
    >
      <ProCard title="注册表单示例" headerBordered>
        <Form layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item label="国家/地区" required>
            <CountrySelect
              countries={countries}
              value={code}
              onChange={setCode}
              placeholder="选择国家后，下方字段自动填充"
            />
          </Form.Item>
          <Form.Item label="时区">
            <Input
              placeholder="选择国家后自动填充"
              value={defaults ? `${defaults.timezoneName}（${defaults.timezoneId}）` : ""}
              readOnly
            />
          </Form.Item>
          <Form.Item label="货币">
            <Input
              placeholder="—"
              value={
                defaults
                  ? `${defaults.currencyName} ${defaults.currencySymbol}（${defaults.currencyCode}）`
                  : ""
              }
              readOnly
            />
          </Form.Item>
          <Form.Item label="语言">
            <Input
              placeholder="—"
              value={defaults ? `${defaults.languageName}（${defaults.languageTag}）` : ""}
              readOnly
            />
          </Form.Item>
          <Form.Item label="手机号">
            <Input
              addonBefore={defaults?.dialCode || "+86"}
              placeholder={defaults?.exampleNumber || "选择国家后显示该国示例号码"}
              readOnly={!!defaults}
            />
          </Form.Item>
        </Form>
        <Text type="secondary">
          单次调用 GET /api/v1/reference/countries/&#123;code&#125;/defaults
          返回全部字段（名称已按 locale 解析），表单无需二次查询。
          {selected ? ` 当前：${selected.flagEmoji} ${selected.name}` : ""}
        </Text>
      </ProCard>

      {defaults && (
        <ProCard title="接口返回" headerBordered style={{ marginTop: 16 }}>
          <Spin spinning={loading}>
            <pre style={{ margin: 0, fontSize: 12 }}>
              {JSON.stringify(defaults, null, 2)}
            </pre>
          </Spin>
        </ProCard>
      )}
    </PageContainer>
  );
}
