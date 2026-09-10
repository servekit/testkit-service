/**
 * GID debug (internal-only). Three tools over the authenticated gid RPCs:
 * generate a single snowflake ID, generate a batch, and decompose an ID into
 * time / sequence / machine_id / generated_at.
 *
 * IDs are 63-bit and arrive as STRING (int64 → string via the openapi
 * fix-int64 pass) — no precision loss in the UI. The decompose input is
 * therefore a free-text Input, not an InputNumber. Calls the GENERATED
 * services only; no hand-written fetch (design v2 Delta C).
 * access: canPlatform at the route level.
 */
import { PageContainer, ProCard } from "@ant-design/pro-components";
import {
  App,
  Button,
  Descriptions,
  Input,
  InputNumber,
  Space,
  Typography,
} from "antd";
import { useState } from "react";
import { batchNextId, decompose, nextId } from "@/services/testkit/testkitService";

const { Paragraph, Text } = Typography;

export default function GidDebugPage() {
  const { message } = App.useApp();

  // Single ID.
  const [singleId, setSingleId] = useState<string>();
  const [genSingleLoading, setGenSingleLoading] = useState(false);

  // Batch.
  const [batchCount, setBatchCount] = useState(10);
  const [batchIds, setBatchIds] = useState<string[]>();
  const [genBatchLoading, setGenBatchLoading] = useState(false);

  // Decompose.
  const [decomposeId, setDecomposeId] = useState("");
  const [decomposed, setDecomposed] = useState<API.v1DecomposeResponse>();
  const [decomposeLoading, setDecomposeLoading] = useState(false);

  const genSingle = async () => {
    setGenSingleLoading(true);
    try {
      const r = await nextId();
      setSingleId(r.id);
      message.success("已生成");
    } catch {
      /* request interceptor surfaces errors + handles 401 redirect */
    } finally {
      setGenSingleLoading(false);
    }
  };

  const genBatch = async () => {
    setGenBatchLoading(true);
    try {
      const r = await batchNextId({ count: batchCount });
      setBatchIds(r.ids ?? []);
      message.success(`已生成 ${r.ids?.length ?? 0} 个`);
    } catch {
      /* noop */
    } finally {
      setGenBatchLoading(false);
    }
  };

  const doDecompose = async () => {
    const id = decomposeId.trim();
    if (!id) {
      message.warning("请输入要解析的 ID");
      return;
    }
    setDecomposeLoading(true);
    try {
      const r = await decompose({ id });
      setDecomposed(r);
    } catch {
      /* noop */
    } finally {
      setDecomposeLoading(false);
    }
  };

  return (
    <PageContainer>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <ProCard title="生成单个 ID" headerBordered>
          <Space align="center" wrap>
            <Button
              type="primary"
              loading={genSingleLoading}
              onClick={genSingle}
            >
              生成 ID
            </Button>
            {singleId && (
              <Text copyable code>
                {singleId}
              </Text>
            )}
          </Space>
        </ProCard>

        <ProCard title="批量生成 ID" headerBordered>
          <Space>
            <InputNumber
              min={1}
              max={1000}
              value={batchCount}
              onChange={(v) => setBatchCount(v ?? 1)}
            />
            <Button
              type="primary"
              loading={genBatchLoading}
              onClick={genBatch}
            >
              批量生成
            </Button>
          </Space>
          {batchIds && batchIds.length > 0 && (
            <Paragraph style={{ marginTop: 16 }}>
              <Text copyable>{batchIds.join(", ")}</Text>
            </Paragraph>
          )}
        </ProCard>

        <ProCard title="解析 ID" headerBordered>
          <Space>
            <Input
              style={{ width: 320 }}
              value={decomposeId}
              onChange={(e) => setDecomposeId(e.target.value)}
              placeholder="输入要解析的 ID"
              onPressEnter={doDecompose}
            />
            <Button
              type="primary"
              loading={decomposeLoading}
              onClick={doDecompose}
            >
              解析
            </Button>
          </Space>
          {decomposed && (
            <Descriptions
              column={1}
              bordered
              size="small"
              style={{ marginTop: 16 }}
            >
              <Descriptions.Item label="时间（Unix 毫秒）">
                {decomposed.time ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="序列号">
                {decomposed.sequence ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="机器 ID">
                {decomposed.machineId ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="生成时间">
                {decomposed.generatedAt ?? "-"}
              </Descriptions.Item>
            </Descriptions>
          )}
        </ProCard>
      </Space>
    </PageContainer>
  );
}
