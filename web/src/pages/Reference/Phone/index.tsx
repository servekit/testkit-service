/**
 * Phone parse playground (internal-only). One input, one libphonenumber
 * call: E.164 归一、归属国、号码类型. The default-country select exists for
 * LOCAL-format numbers (no "+country" prefix) — "+86…" never needs it;
 * "13800138000" is ambiguous until a country disambiguates it. Invalid
 * input is a valid response (is_valid=false + error_reason).
 * access: canInternal at the route level.
 */
import { PageContainer, ProCard } from "@ant-design/pro-components";
import {
  App,
  Button,
  Descriptions,
  Input,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import CountrySelect from "../components/CountrySelect";
import { listCountries, parsePhone } from "@/services/testkit/testkitService";

const { Text } = Typography;

const PHONE_TYPE_LABEL: Record<string, string> = {
  PHONE_TYPE_MOBILE: "手机",
  PHONE_TYPE_FIXED_LINE: "固话",
  PHONE_TYPE_FIXED_LINE_OR_MOBILE: "手机/固话",
  PHONE_TYPE_TOLL_FREE: "免费热线",
  PHONE_TYPE_PREMIUM_RATE: "付费热线",
  PHONE_TYPE_SHARED_COST: "共担费率",
  PHONE_TYPE_VOIP: "VoIP",
  PHONE_TYPE_PERSONAL_NUMBER: "个人号码",
  PHONE_TYPE_PAGER: "寻呼",
  PHONE_TYPE_UAN: "通用接入号",
  PHONE_TYPE_VOICE_MAIL: "语音信箱",
  PHONE_TYPE_UNKNOWN: "未知",
};

const SAMPLES: { label: string; raw: string; region?: string }[] = [
  { label: "中国手机", raw: "+86 138 0013 8000" },
  { label: "本地格式（需默认国家）", raw: "13800138000", region: "CN" },
  { label: "美国固话", raw: "+1 650 253 0000" },
  { label: "无效输入", raw: "not-a-phone" },
];

export default function ReferencePhonePage() {
  const { message } = App.useApp();
  const [countries, setCountries] = useState<API.v1Country[]>();
  const [raw, setRaw] = useState("+86 138 0013 8000");
  const [region, setRegion] = useState<string>();
  const [result, setResult] = useState<API.v1ParsePhoneResponse>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listCountries({ locale: "zh-Hans" })
      .then((r) => setCountries(r.countries ?? []))
      .catch(() => undefined);
  }, []);

  const selected = (countries ?? []).find((c) => c.code === region);

  const doParse = async (payload?: { raw: string; region?: string }) => {
    const target = payload ?? { raw, region };
    if (!target.raw.trim()) {
      message.warning("请输入手机号");
      return;
    }
    setLoading(true);
    try {
      const r = await parsePhone({
        raw: target.raw,
        defaultRegion: target.region ?? "",
      });
      setResult(r);
    } catch {
      /* request interceptor surfaces errors */
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer
      header={{
        title: "手机号解析",
        subTitle: "reference-service · libphonenumber 规则",
      }}
    >
      <ProCard title="解析" headerBordered>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Space wrap>
            <Input
              style={{ width: 300 }}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={
                selected?.exampleNumber || "输入手机号（国际或本地格式）"
              }
              onPressEnter={() => doParse()}
            />
            <Tooltip title="仅在号码为本地格式（无 +国际区号）时用于判定归属国，如 13800138000 需选 CN 才能解析；国际格式 +86… 无需选择。">
              <CountrySelect
                countries={countries}
                value={region}
                onChange={setRegion}
                placeholder="默认国家（本地格式号码时需要）"
              />
            </Tooltip>
            <Button type="primary" loading={loading} onClick={() => doParse()}>
              解析
            </Button>
          </Space>
          <Space wrap>
            <Text type="secondary">示例：</Text>
            {SAMPLES.map((s) => (
              <Button
                key={s.label}
                size="small"
                onClick={() => {
                  setRaw(s.raw);
                  setRegion(s.region);
                  void doParse(s);
                }}
              >
                {s.label}
              </Button>
            ))}
          </Space>
        </Space>
      </ProCard>

      {result && (
        <ProCard title="结果" headerBordered style={{ marginTop: 16 }}>
          <Space style={{ marginBottom: 16 }}>
            {result.isValid ? (
              <Tag color="green">有效号码</Tag>
            ) : (
              <Tag color="red">无效号码</Tag>
            )}
            {result.type && (
              <Tag>{PHONE_TYPE_LABEL[result.type] ?? result.type}</Tag>
            )}
          </Space>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="E.164">
              {result.e164 ? <Text copyable>{result.e164}</Text> : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="归属国">
              {result.countryCode || "-"}
              {result.dialCode ? `（${result.dialCode}）` : ""}
            </Descriptions.Item>
            <Descriptions.Item label="国家号（NSN）">
              {result.nationalNumber || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="国际显示格式">
              {result.formattedInternational || "-"}
            </Descriptions.Item>
            {!result.isValid && (
              <Descriptions.Item label="原因" span={2}>
                {result.errorReason || "-"}
              </Descriptions.Item>
            )}
          </Descriptions>
        </ProCard>
      )}
    </PageContainer>
  );
}
