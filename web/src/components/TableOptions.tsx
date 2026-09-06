import { ReloadOutlined } from "@ant-design/icons";
import { useState } from "react";

/**
 * ProTable 工具栏刷新图标的可感知反馈。
 *
 * 本地/内网接口毫秒级返回，ProTable 自带的 reload 转圈一闪而过，用户
 * 感知不到"点了之后发生了什么"。这个图标被点击后自旋至少 600ms——
 * 与数据加载解耦（数据照常立即渲染），只保证视觉反馈的最低时长。
 */
function SpinReloadIcon() {
  const [spin, setSpin] = useState(false);
  return (
    <ReloadOutlined
      spin={spin}
      onClick={() => {
        setSpin(true);
        setTimeout(() => setSpin(false), 600);
      }}
    />
  );
}

/**
 * Spread into a ProTable: `options={spinReload}`. Reusing one element
 * descriptor across tables is safe — React renders a separate component
 * instance (and thus separate spin state) per table.
 *
 * pro-components v3 customizes the toolbar icon via `options.reloadIcon`
 * (the v2 `reload: { icon }` form is gone — reload is boolean | handler).
 */
export const spinReload = {
  reloadIcon: <SpinReloadIcon />,
};
