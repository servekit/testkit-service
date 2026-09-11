import {
  CloudUploadOutlined,
  DeleteOutlined,
  PaperClipOutlined,
  SendOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Col,
  Collapse,
  Form,
  Input,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { PageContainer } from "@ant-design/pro-components";
import { useRef, useState } from "react";
import SparkMD5 from "spark-md5";
import RichEmailEditor from "@/components/RichEmailEditor";
import type { RichEmailEditorHandle } from "@/components/RichEmailEditor";
import { EMAIL_SCENE_OPTIONS } from "@/components/messagetags";
import {
  confirmUpload,
  createFileLink,
  generateUploadUrl,
  sendEmail,
} from "@/services/testkit/testkitService";
import { EMAIL_TEMPLATES } from "@/utils/emailTemplates";

const { Text } = Typography;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Inline-attachment limits mirror message-service defaults
// (attachment.max_inline_bytes = 2MB / max_total_inline_bytes = 5MB). Larger
// files must go through the URL channel instead.
const MAX_INLINE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_INLINE_BYTES = 5 * 1024 * 1024;

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** A local file read as base64, sent via EmailAttachment.content. */
interface FileAttachment {
  key: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Base64 payload (proto3-JSON bytes representation). */
  content: string;
}

interface ComposeFormValues {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  scene?: string;
  idempotencyKey?: string;
  plainTextBody?: string;
  templateParams?: string;
}

/**
 * A "large attachment" (QQ-mail style): the file is uploaded to object
 * storage via storage-service, a download link block is rendered into the
 * email body, and this reference is sent as pure url metadata for record
 * queries — message-service never fetches it.
 */
interface LargeAttachment {
  key: number;
  filename: string;
  url: string;
  sizeBytes: number;
  /** Whole days until the presigned download link expires, if known. */
  expiresDays?: number;
}

/** Parses "Display Name <a@b.c>" or a bare "a@b.c" tag into an address. */
function parseAddressTag(tag: string): { email: string; displayName?: string } {
  const match = tag.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (match) {
    return { displayName: match[1] || undefined, email: match[2] };
  }
  return { email: tag.trim() };
}

/**
 * Wraps editor fragment HTML in a minimal document shell so the sent email
 * gets a zero-margin body. Full documents (e.g. preset templates edited in
 * source mode) pass through untouched.
 */
function wrapHtmlDocument(content: string): string {
  if (!content.trim() || /<html[\s>]/i.test(content)) {
    return content;
  }
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;background-color:#f0f2f5;">${content}</body>
</html>`;
}

/** Extracts a plain-text fallback body from the HTML content. */
function htmlToPlainText(html: string): string {
  if (!html.trim()) {
    return "";
  }
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Reads a local file into the base64 payload EmailAttachment.content uses. */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Incremental MD5 of a File (storage requires exactly 32 hex chars). */
function fileMd5(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer();
    const reader = new FileReader();
    const chunkSize = 2 * 1024 * 1024;
    let offset = 0;
    const readNext = () => {
      reader.readAsArrayBuffer(file.slice(offset, offset + chunkSize));
    };
    reader.onload = (e) => {
      spark.append(e.target?.result as ArrayBuffer);
      offset += chunkSize;
      if (offset < file.size) {
        readNext();
      } else {
        resolve(spark.end());
      }
    };
    reader.onerror = () => reject(reader.error);
    readNext();
  });
}

/** Escapes text for safe use inside a double-quoted HTML attribute. */
function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * Mail-compatible download block appended to the editor body for each large
 * attachment — inline styles only, renders correctly in QQ/NetEase/Gmail.
 */
function largeAttachmentBlockHtml(att: LargeAttachment): string {
  const validity = att.expiresDays ? `，${att.expiresDays} 天内有效` : "";
  return `<div style="margin-top:20px;padding-top:14px;border-top:1px dashed #d9d9d9;">
  <p style="margin:0 0 10px;font-size:12px;color:#8c8c8c;">超大附件（点击下载${validity}）：</p>
  <p style="margin:0;">
    <a href="${escapeHtmlAttr(att.url)}" target="_blank" style="display:inline-block;padding:8px 16px;border:1px solid #1677ff;border-radius:4px;color:#1677ff;font-size:14px;text-decoration:none;">
      ${escapeHtmlAttr(att.filename)}（${formatBytes(att.sizeBytes)}）
    </a>
  </p>
</div>`;
}

const addressListValidator = (isRequired: boolean) => {
  return (_: unknown, value?: string[]) => {
    const tags = (value ?? []).filter((tag) => tag.trim() !== "");
    if (isRequired && tags.length === 0) {
      return Promise.reject(new Error("请至少填写一个收件人"));
    }
    const invalid = tags
      .map(parseAddressTag)
      .filter((addr) => !EMAIL_RE.test(addr.email));
    if (invalid.length > 0) {
      return Promise.reject(
        new Error(
          `邮箱格式不正确：${invalid.map((addr) => addr.email).join("、")}`,
        ),
      );
    }
    return Promise.resolve();
  };
};

const toAddressPayload = (tags?: string[]) =>
  (tags ?? [])
    .filter((tag) => tag.trim() !== "")
    .map((tag) => {
      const addr = parseAddressTag(tag);
      return { email: addr.email, displayName: addr.displayName };
    });

/** One label-left / input-right row, the way web-mail compose forms stack. */
function fieldRow(
  label: string,
  node: React.ReactNode,
  extra?: React.ReactNode,
) {
  return (
    <div
      style={{
        borderBottom: "1px solid #f0f0f0",
        display: "flex",
        alignItems: "center",
        minHeight: 44,
      }}
    >
      <div
        style={{
          width: 72,
          flexShrink: 0,
          textAlign: "right",
          paddingRight: 12,
          color: "#51565d",
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{node}</div>
      {extra && <div style={{ flexShrink: 0, paddingRight: 8 }}>{extra}</div>}
    </div>
  );
}

/**
 * Web-mail style compose page (QQ Mail / NetEase layout): tag-style
 * recipients, one-line subject, WYSIWYG body editor, inline + large
 * attachments. Content is sent free-form (subject/body on the request) —
 * {{param}} placeholders inside the content render with the 模板参数 JSON
 * from the advanced panel. Routing (账号链/限额) comes from the scene's
 * send policy; app credentials are injected by the BFF. The plain-text body
 * is auto-extracted from the HTML content (or overridden in the advanced
 * panel); message-service sends both as MIME multipart/alternative.
 */
export default function SendEmailPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<ComposeFormValues>();
  const editorRef = useRef<RichEmailEditorHandle>(null);
  const [htmlContent, setHtmlContent] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const [largeAttachments, setLargeAttachments] = useState<LargeAttachment[]>(
    [],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const largeInputRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const [sending, setSending] = useState(false);
  const [uploadingLarge, setUploadingLarge] = useState(false);

  const applyTemplate = (templateId?: string) => {
    const tpl = EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) {
      return;
    }
    form.setFieldValue("subject", tpl.subject);
    editorRef.current?.setHtml(tpl.htmlBody);
  };

  /** Picks local files into inline attachments (EmailAttachment.content). */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      if (file.size > MAX_INLINE_BYTES) {
        message.warning(
          `「${file.name}」${formatBytes(file.size)} 超过 2MB 内联上限，请改用超大附件`,
        );
        continue;
      }
      const inlineTotal =
        fileAttachments.reduce((sum, att) => sum + att.sizeBytes, 0) +
        file.size;
      if (inlineTotal > MAX_TOTAL_INLINE_BYTES) {
        message.warning("本地附件合计超过 5MB 上限，请改用超大附件");
        continue;
      }
      try {
        const content = await readFileAsBase64(file);
        setFileAttachments((rows) => [
          ...rows,
          {
            key: nextKey.current++,
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            content,
          },
        ]);
      } catch {
        message.error(`读取「${file.name}」失败`);
      }
    }
  };

  /**
   * Large-attachment flow (QQ-mail style): presigned upload via
   * storage-service → browser PUT direct to object storage → confirm →
   * long-TTL download link, which is appended to the editor body as a
   * download block and sent as pure url metadata.
   */
  const handleLargeFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      setUploadingLarge(true);
      try {
        const md5 = await fileMd5(file);
        const up = await generateUploadUrl({
          filename: file.name,
          size: String(file.size),
          md5,
          contentType: file.type || "application/octet-stream",
        });

        let fileId = up.fileId ?? "";
        if (!up.instant) {
          if (!up.uploadUrl) {
            throw new Error("未获得上传链接");
          }
          // PUT direct to object storage; presigned URL needs no SDK.
          const putHeaders: Record<string, string> = {
            "Content-Type": file.type || "application/octet-stream",
          };
          for (const [k, v] of Object.entries(up.headers ?? {})) {
            if (typeof v === "string") {
              putHeaders[k] = v;
            }
          }
          const putResp = await fetch(up.uploadUrl, {
            method: "PUT",
            headers: putHeaders,
            body: file,
          });
          if (!putResp.ok) {
            throw new Error(`对象存储上传失败（HTTP ${putResp.status}）`);
          }
          const confirmed = await confirmUpload({
            uploadToken: up.uploadToken ?? "",
          });
          fileId = confirmed.fileId ?? fileId;
        }

        // Create the file link: stable token + 30-day retention (QQ-mail
        // style). The link embedded in the email points at our own /link
        // page — it never expires as a URL; it stops working only when the
        // retention window (file lifetime) closes.
        const link = await createFileLink(
          { fileId },
          // TTL belongs in the JSON body (body: "*"): a query param would be
          // ignored by the gateway and the retention silently dropped.
          { retentionTtlSeconds: 30 * 24 * 3600 },
        );
        if (!link.linkToken) {
          throw new Error("未获得附件链接令牌");
        }
        let expiresDays: number | undefined;
        const retainUntil = link.retainUntil ? Number(link.retainUntil) : NaN;
        if (Number.isFinite(retainUntil) && retainUntil > 0) {
          expiresDays = Math.max(
            1,
            Math.floor((retainUntil - Date.now()) / 86400000),
          );
        }
        const att: LargeAttachment = {
          key: nextKey.current++,
          filename: file.name,
          url: `${window.location.origin}/link/${link.linkToken}`,
          sizeBytes: file.size,
          expiresDays,
        };
        setLargeAttachments((rows) => [...rows, att]);
        editorRef.current?.appendHtml(largeAttachmentBlockHtml(att));
        message.success(`「${file.name}」上传成功，下载区块已插入正文`);
      } catch (err) {
        const reason = err instanceof Error ? err.message : "未知错误";
        message.error(`「${file.name}」超大附件上传失败：${reason}`);
      } finally {
        setUploadingLarge(false);
      }
    }
  };

  const handleSend = async () => {
    let vals: ComposeFormValues;
    try {
      vals = await form.validateFields();
    } catch {
      // Validation errors render inline under the compose rows.
      return;
    }
    const htmlBody = wrapHtmlDocument(htmlContent);
    const body =
      (vals.plainTextBody ?? "").trim() || htmlToPlainText(htmlContent);
    if (!body && !htmlBody) {
      message.error("正文不能为空");
      return;
    }
    let templateParams: Record<string, string> = {};
    if ((vals.templateParams ?? "").trim()) {
      try {
        const parsed = JSON.parse(vals.templateParams as string);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("not an object");
        }
        templateParams = parsed as Record<string, string>;
      } catch {
        message.error("模板参数不是合法 JSON 对象");
        return;
      }
    }
    // Free-form dual-mode: subject/body travel with the request ({{param}}
    // inside them renders with templateParams server-side); the scene policy
    // still routes the send.
    const payload: API.v1SendEmailRequest = {
      to: toAddressPayload(vals.to),
      cc: toAddressPayload(vals.cc),
      bcc: toAddressPayload(vals.bcc),
      subject: vals.subject,
      body,
      htmlBody: htmlBody || undefined,
      scene: vals.scene as API.v1EmailScene,
      templateParams,
      idempotencyKey: vals.idempotencyKey || undefined,
      // Local files travel inline (content); large attachments are pure url
      // references (download link rendered into the body by this page) —
      // message-service persists the metadata and embeds nothing for them.
      attachments: [
        ...fileAttachments.map((att) => ({
          filename: att.filename,
          content: att.content,
          mimeType: att.mimeType || undefined,
          sizeBytes: String(att.sizeBytes),
        })),
        ...largeAttachments.map((att) => ({
          filename: att.filename,
          url: att.url,
          sizeBytes: String(att.sizeBytes),
        })),
      ],
    };
    setSending(true);
    try {
      const resp = await sendEmail(payload);
      message.success(
        `发送成功 id=${resp.id ?? "-"} 状态=${resp.status ?? "-"}`,
      );
    } catch {
      // 401 is handled by the request interceptor; other errors surface
      // via the default error handler. Keep the compose content for retry.
    } finally {
      setSending(false);
    }
  };

  const recipientSelect = (placeholder: string) => (
    <Select
      mode="tags"
      variant="borderless"
      open={false}
      suffixIcon={null}
      tokenSeparators={[",", ";", "\n"]}
      placeholder={placeholder}
      style={{ width: "100%" }}
    />
  );

  const renderPreview = (html: string) =>
    html ? (
      <iframe
        title="HTML 正文预览"
        srcDoc={html}
        sandbox=""
        style={{
          width: "100%",
          height: 420,
          border: "1px solid #d9d9d9",
          borderRadius: 6,
          background: "#fff",
        }}
      />
    ) : (
      <Text type="secondary">HTML 内容为空</Text>
    );

  return (
    <PageContainer>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          to: [],
          cc: [],
          bcc: [],
          scene: "EMAIL_SCENE_NOTIFICATION",
        }}
      >
        <Card bordered={false} styles={{ body: { padding: 0 } }}>
          <div style={{ padding: "8px 16px 0" }}>
            {fieldRow(
              "收件人",
              <Form.Item style={{ marginBottom: 0 }}>
                <Form.Item
                  name="to"
                  noStyle
                  rules={[{ validator: addressListValidator(true) }]}
                >
                  {recipientSelect("输入邮箱后回车，支持：显示名 <邮箱>")}
                </Form.Item>
              </Form.Item>,
              <Space size={0}>
                <Button
                  type="link"
                  size="small"
                  onClick={() => setShowCc((v) => !v)}
                >
                  抄送
                </Button>
                <Button
                  type="link"
                  size="small"
                  onClick={() => setShowBcc((v) => !v)}
                >
                  密送
                </Button>
              </Space>,
            )}
            {showCc &&
              fieldRow(
                "抄送",
                <Form.Item style={{ marginBottom: 0 }}>
                  <Form.Item
                    name="cc"
                    noStyle
                    rules={[{ validator: addressListValidator(false) }]}
                  >
                    {recipientSelect("抄送邮箱（可选）")}
                  </Form.Item>
                </Form.Item>,
              )}
            {showBcc &&
              fieldRow(
                "密送",
                <Form.Item style={{ marginBottom: 0 }}>
                  <Form.Item
                    name="bcc"
                    noStyle
                    rules={[{ validator: addressListValidator(false) }]}
                  >
                    {recipientSelect("密送邮箱（可选）")}
                  </Form.Item>
                </Form.Item>,
              )}
            {fieldRow(
              "主题",
              <Form.Item style={{ marginBottom: 0 }}>
                <Form.Item
                  name="subject"
                  noStyle
                  rules={[{ required: true, message: "请输入主题" }]}
                >
                  <Input
                    variant="borderless"
                    placeholder="邮件主题"
                    style={{ fontSize: 15, fontWeight: 600 }}
                  />
                </Form.Item>
              </Form.Item>,
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 16px 8px",
            }}
          >
            <Text type="secondary" strong>
              正文
            </Text>
            <Select
              size="small"
              allowClear
              placeholder="插入预置模板"
              style={{ width: 280 }}
              options={EMAIL_TEMPLATES.map((tpl) => ({
                value: tpl.id,
                label: tpl.label,
              }))}
              onChange={applyTemplate}
            />
          </div>

          <div style={{ padding: "0 16px" }}>
            <RichEmailEditor
              ref={editorRef}
              onHtmlChange={setHtmlContent}
              renderPreview={renderPreview}
            />

            {/* Local-file attachments — sent inline via EmailAttachment.content */}
            <div
              style={{
                borderTop: "1px dashed #f0f0f0",
                marginTop: 12,
                padding: "12px 0",
              }}
            >
              <Space>
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  添加附件
                </Button>
                <Text type="secondary">
                  本地文件随邮件直接发送（单个 ≤ 2MB，合计 ≤ 5MB）
                </Text>
              </Space>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              {fileAttachments.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Space wrap size={8}>
                    {fileAttachments.map((att) => (
                      <Tag
                        key={att.key}
                        closable
                        onClose={() =>
                          setFileAttachments((rows) =>
                            rows.filter((row) => row.key !== att.key),
                          )
                        }
                        style={{ fontSize: 13, padding: "2px 8px" }}
                      >
                        <PaperClipOutlined /> {att.filename}（
                        {formatBytes(att.sizeBytes)}）
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
            </div>

            {/* Large attachments (QQ-mail style): upload to object storage,
                render a download block into the body, send url metadata */}
            <div style={{ padding: "0 0 12px" }}>
              <Space>
                <Button
                  icon={<CloudUploadOutlined />}
                  loading={uploadingLarge}
                  onClick={() => largeInputRef.current?.click()}
                >
                  添加超大附件
                </Button>
                <Text type="secondary">
                  上传到对象存储并生成下载链接，适合大文件（邮件本身不增大；文件保存
                  30 天，到期后链接失效）
                </Text>
              </Space>
              <input
                ref={largeInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={handleLargeFileChange}
              />
              {largeAttachments.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Space wrap size={8}>
                    {largeAttachments.map((att) => (
                      <Tag
                        key={att.key}
                        closable
                        onClose={() => {
                          setLargeAttachments((rows) =>
                            rows.filter((row) => row.key !== att.key),
                          );
                          message.info(
                            "已移除附件记录，正文中的下载区块请手动删除",
                          );
                        }}
                        color="blue"
                        style={{ fontSize: 13, padding: "2px 8px" }}
                      >
                        <PaperClipOutlined /> {att.filename}（
                        {formatBytes(att.sizeBytes)}
                        {att.expiresDays ? `，${att.expiresDays} 天有效` : ""}）
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
            </div>

            <Collapse
              ghost
              items={[
                {
                  key: "advanced",
                  label: "高级选项（业务场景 / 模板参数 / 幂等键 / 纯文本正文）",
                  children: (
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item
                          name="scene"
                          label="业务场景"
                          rules={[{ required: true, message: "请选择场景" }]}
                        >
                          <Select
                            options={EMAIL_SCENE_OPTIONS}
                            placeholder="选择场景"
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="idempotencyKey" label="幂等键（可选）">
                          <Input placeholder="重试同一逻辑发送时填同一值（UUID）" />
                        </Form.Item>
                      </Col>
                      <Col span={16}>
                        <Form.Item
                          name="templateParams"
                          label="模板参数（渲染主题/正文里的 {{param}} 占位符）"
                        >
                          <Input.TextArea
                            autoSize={{ minRows: 2, maxRows: 6 }}
                            placeholder='{"nickname": "Ada", "code": "123456"}'
                          />
                        </Form.Item>
                      </Col>
                      <Col span={24}>
                        <Form.Item
                          name="plainTextBody"
                          label="纯文本正文（默认从 HTML 自动提取，填写则覆盖）"
                        >
                          <Input.TextArea
                            autoSize={{ minRows: 2, maxRows: 6 }}
                            placeholder="留空则自动提取"
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  ),
                },
              ]}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "8px 0 16px",
                borderTop: "1px solid #f0f0f0",
              }}
            >
              <Button
                type="primary"
                size="large"
                icon={<SendOutlined />}
                loading={sending}
                onClick={handleSend}
              >
                发送
              </Button>
            </div>
          </div>
        </Card>
      </Form>
    </PageContainer>
  );
}
