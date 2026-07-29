/**
 * Upload modal: the STS upload flow (design spec §5).
 *
 * Three steps, all wired to generated services:
 *   1. getStsCredential — the BFF injects the owner from ctx and returns STS
 *      temporary credentials + an upload_token (+ fileInfo when MD5 dedup hit
 *      => instant upload, no PUT needed).
 *   2. PUT the file bytes DIRECTLY to OSS/S3 from the browser using those
 *      credentials. The file stream never transits the BFF.
 *   3. confirmUpload — the BFF verifies HMAC + tells storage to persist.
 *
 * Two integration points are deliberate, clearly-marked placeholders (the
 * credential-fetch wiring is the P3 deliverable; see task brief):
 *   - putToOSS: a real browser OSS/S3 PUT requires a vendor SDK
 *     (oss-browser-sdk / @aws-sdk/client-s3) chosen per `vendor`. That depends
 *     on provider configuration not available here, so the actual PUT is a
 *     stub. Swap in the SDK call at the marked line.
 *   - MD5: protovalidate requires `md5` to be exactly 32 hex chars. Production
 *     must compute it with spark-md5 (needed for dedup / instant upload). Until
 *     that dep is added we send a zero-padded placeholder so the request still
 *     satisfies validation shape — replace with the real digest.
 */
import { App, Button, Modal, Upload } from "antd";
import { InboxOutlined, UploadOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import { confirmUpload, getStsCredential } from "@/services/testkit/testkitService";

const { Dragger } = Upload;

interface Credential {
  endpoint?: string;
  bucket?: string;
  objectKey?: string;
  accessKey?: string;
  secretKey?: string;
  securityToken?: string;
}

/**
 * PLACEHOLDER: PUT `file` to OSS/S3 using STS credentials.
 *
 * A real implementation chooses a browser SDK by vendor, e.g. for Aliyun OSS:
 *   const client = new OSS({ endpoint, accessKeyId: accessKey,
 *     accessKeySecret: secretKey, stsToken: securityToken, bucket });
 *   await client.put(objectKey, file);
 * and for S3-compatible vendors the @aws-sdk/client-s3 PutObjectCommand with
 * the STS credentials. Vendor SDK choice + provider config are out of scope for
 * P3 wiring; insert the real PUT at the marked line below.
 */
async function putToOSS(_cred: Credential, _file: File): Promise<void> {
  // --- INSERT real OSS/S3 browser PUT here (see docstring above) ---
  await new Promise((resolve) => setTimeout(resolve, 50));
}

/** PLACEHOLDER MD5: spark-md5 is the production choice (not a dep yet). */
function placeholderMd5(): string {
  // protovalidate requires len == 32; replace with await md5(file) using
  // spark-md5 before enabling real uploads.
  return "00000000000000000000000000000000";
}

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export default function UploadModal({
  open,
  onOpenChange,
  onDone,
}: UploadModalProps) {
  const { message } = App.useApp();
  const [uploading, setUploading] = useState(false);

  const customRequest = async (opt: UploadRequestOption) => {
    const file = opt.file as File;
    setUploading(true);
    try {
      // 1) Fetch STS credentials + upload_token (BFF injects owner from ctx).
      const cred = await getStsCredential({
        filename: file.name,
        md5: placeholderMd5(),
        contentType: file.type || "application/octet-stream",
        maxSize: String(file.size),
      });

      // 1a) Instant upload: MD5 dedup hit, file already exists.
      if (cred.instant && cred.fileId) {
        message.success("秒传成功（MD5 命中）");
        onDone();
        onOpenChange(false);
        opt.onSuccess?.(cred);
        return;
      }

      if (!cred.uploadToken) {
        throw new Error("未获得上传凭证");
      }

      // 2) PUT directly to OSS/S3 from the browser (BFF never sees the bytes).
      await putToOSS(
        {
          endpoint: cred.endpoint,
          bucket: cred.bucket,
          objectKey: cred.objectKey,
          accessKey: cred.accessKey,
          secretKey: cred.secretKey,
          securityToken: cred.securityToken,
        },
        file,
      );

      // 3) Confirm: BFF verifies HMAC + persists via storage-service.
      await confirmUpload({ uploadToken: cred.uploadToken });
      message.success("上传成功");
      onDone();
      onOpenChange(false);
      opt.onSuccess?.({});
    } catch (e) {
      const reason = e instanceof Error ? e.message : "上传失败";
      message.error(`上传失败：${reason}`);
      opt.onError?.(e as Error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      footer={null}
      title="上传文件"
      destroyOnClose
    >
      <Dragger
        customRequest={customRequest}
        showUploadList={false}
        multiple={false}
        disabled={uploading}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          {uploading ? "上传中..." : "点击或拖拽文件到此区域上传"}
        </p>
        <p className="ant-upload-hint">
          文件直传对象存储，不经过 BFF。上传后需确认完成。
        </p>
      </Dragger>
      <Button
        style={{ marginTop: 12 }}
        icon={<UploadOutlined />}
        loading={uploading}
        onClick={() => onOpenChange(false)}
        block
      >
        关闭
      </Button>
    </Modal>
  );
}
