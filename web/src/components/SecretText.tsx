/**
 * 凭据单元格：默认星号掩码，眼睛切换明文，复制按钮取值。显隐状态由调用页面持有
 * （按 "行键:字段" 记忆），创建/轮换后由页面点亮对应字段。
 */
import {
  CopyOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { App, Button, Space } from "antd";

interface SecretTextProps {
  value?: string;
  visible: boolean;
  onToggle: () => void;
}

export function SecretText({ value, visible, onToggle }: SecretTextProps) {
  const { message } = App.useApp();
  return (
    <Space size={2}>
      <span
        style={{
          fontFamily: "monospace",
          wordBreak: "break-all",
          display: "inline-block",
          minWidth: 64,
        }}
      >
        {visible ? value || "-" : "••••••••••"}
      </span>
      <Button
        type="text"
        size="small"
        icon={visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        onClick={onToggle}
      />
      <Button
        type="text"
        size="small"
        icon={<CopyOutlined />}
        onClick={async () => {
          if (!value) return;
          try {
            await navigator.clipboard.writeText(value);
            message.success("已复制");
          } catch {
            message.error("复制失败，请手动选择复制");
          }
        }}
      />
    </Space>
  );
}
