import { FileZipOutlined, WarningOutlined } from "@ant-design/icons";
import { Button, Card, Space, Spin, Typography } from "antd";
import { useEffect, useState } from "react";
import { useParams } from "@umijs/max";
import { getFileLinkDownload } from "@/services/testkit/testkitService";

const { Text, Title } = Typography;

/**
 * Anonymous file-link landing page — the stable URL embedded in sent emails
 * points here. The link token in the path IS the credential (the backend RPC
 * is on the public-methods list). Fetches a freshly presigned short-TTL URL
 * per visit and hands off to the browser download, or renders the
 * "attachment expired" answer once the retention window has closed.
 */
export default function FileLinkDownloadPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [filename, setFilename] = useState("");
  const [sizeBytes, setSizeBytes] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("链接无效");
      setLoading(false);
      return;
    }
    getFileLinkDownload({ linkToken: token })
      .then((resp) => {
        if (resp.expired) {
          setExpired(true);
          setFilename(resp.filename ?? "");
        } else if (resp.downloadUrl) {
          setFilename(resp.filename ?? "附件");
          setSizeBytes(resp.sizeBytes ? Number(resp.sizeBytes) : null);
          setDownloadUrl(resp.downloadUrl);
          // Auto-start the download shortly after the summary renders, like
          // classic web-mail attachment landing pages.
          window.setTimeout(() => {
            window.location.href = resp.downloadUrl as string;
          }, 1500);
        } else {
          setError("获取下载链接失败");
        }
      })
      .catch(() => {
        setError("获取下载链接失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const formatSize = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f2f5",
      }}
    >
      <Card style={{ width: 460, textAlign: "center" }} bordered={false}>
        {loading ? (
          <Space direction="vertical" size={12} style={{ padding: "24px 0" }}>
            <Spin size="large" />
            <Text type="secondary">正在获取附件…</Text>
          </Space>
        ) : expired ? (
          <Space direction="vertical" size={12} style={{ padding: "12px 0" }}>
            <WarningOutlined style={{ fontSize: 42, color: "#faad14" }} />
            <Title level={4} style={{ margin: 0 }}>
              附件已过期
            </Title>
            <Text type="secondary">
              {filename ? `「${filename}」` : "该附件"}
              的保存期已结束，链接已失效。
              如仍需要该文件，请联系发件人重新发送。
            </Text>
          </Space>
        ) : error ? (
          <Space direction="vertical" size={12} style={{ padding: "12px 0" }}>
            <WarningOutlined style={{ fontSize: 42, color: "#ff4d4f" }} />
            <Title level={4} style={{ margin: 0 }}>
              {error}
            </Title>
          </Space>
        ) : (
          <Space direction="vertical" size={12} style={{ padding: "12px 0" }}>
            <FileZipOutlined style={{ fontSize: 42, color: "#1677ff" }} />
            <Title level={4} style={{ margin: 0 }}>
              {filename}
            </Title>
            {sizeBytes !== null && (
              <Text type="secondary">大小：{formatSize(sizeBytes)}</Text>
            )}
            <Text type="secondary">下载即将开始…</Text>
            <Button
              type="primary"
              size="large"
              href={downloadUrl}
              style={{ marginTop: 8 }}
            >
              立即下载
            </Button>
          </Space>
        )}
      </Card>
    </div>
  );
}
