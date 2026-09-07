/**
 * Shared country picker: full directory (loaded once by the page), searchable
 * by name / alpha-2 / dial code, options render flag + name + dial code —
 * the shape a real form's country field wants.
 */
import { Select } from "antd";
import type { CSSProperties } from "react";

type Props = {
  countries?: API.v1Country[];
  value?: string;
  onChange?: (code?: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  allowClear?: boolean;
};

export default function CountrySelect({
  countries,
  value,
  onChange,
  placeholder = "选择国家",
  style,
  allowClear = true,
}: Props) {
  const list = countries ?? [];
  return (
    <Select
      showSearch
      allowClear={allowClear}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ minWidth: 220, ...style }}
      filterOption={(input, option) => {
        const kw = input.trim().toLowerCase();
        if (!kw || !option?.country) return true;
        const c = option.country;
        return (
          (c.code ?? "").toLowerCase().includes(kw) ||
          (c.alpha3 ?? "").toLowerCase().includes(kw) ||
          (c.name ?? "").toLowerCase().includes(kw) ||
          (c.dialCode ?? "").includes(kw)
        );
      }}
      options={list.map((c) => ({
        value: c.code,
        country: c,
        label: (
          <span>
            {c.flagEmoji} {c.name}
            <span style={{ color: "#999", marginLeft: 8 }}>
              {c.code} · {c.dialCode}
            </span>
          </span>
        ),
      }))}
      notFoundContent={list.length ? undefined : "加载中…"}
    />
  );
}
