import { PageContainer } from "@ant-design/pro-components";
import { Empty } from "antd";

/** Shared placeholder for the P2–P5 domain routes (用户/文件/消息/gid/系统). */
export default function PlaceholderPage() {
  return (
    <PageContainer header={{ title: "敬请期待" }}>
      <Empty description="该模块将在后续阶段（P2–P5）交付" />
    </PageContainer>
  );
}
