import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BoldOutlined,
  ClearOutlined,
  CodeOutlined,
  FontSizeOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Input, Popover, Tooltip } from "antd";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

/**
 * Lightweight WYSIWYG email editor that mirrors the web-mail compose box
 * (QQ Mail / NetEase style): a formatting toolbar above a contentEditable
 * area, plus a source-code mode for direct HTML editing with live preview.
 *
 * It intentionally avoids a rich-text library dependency. Formatting goes
 * through document.execCommand with styleWithCSS=false so the output keeps
 * the old-school b/i/u/font markup that email clients render most reliably —
 * the same vocabulary the preset templates in utils/emailTemplates.ts use.
 */

/** Imperative surface for the host page (e.g. loading a preset template). */
export interface RichEmailEditorHandle {
  setHtml(html: string): void;
  /** Appends an HTML fragment at the end of the content (e.g. attachment blocks). */
  appendHtml(html: string): void;
}

interface RichEmailEditorProps {
  /** Content applied once on mount. */
  initialHtml?: string;
  /** Fires on every content change (typing, formatting, source edits). */
  onHtmlChange: (html: string) => void;
  /** Rendered under the textarea in source mode (live preview). */
  renderPreview?: (html: string) => ReactNode;
}

const FONT_SIZES = [
  { key: "2", label: "小" },
  { key: "3", label: "标准" },
  { key: "4", label: "中" },
  { key: "5", label: "大" },
  { key: "6", label: "特大" },
  { key: "7", label: "最大" },
];

const TEXT_COLORS = [
  "#000000",
  "#51565d",
  "#1677ff",
  "#52c41a",
  "#faad14",
  "#ff4d4f",
];

const HIGHLIGHT_COLORS = ["#f5f8ff", "#fff7e6", "#f6ffed", "#fff1f0"];

interface ToolButtonProps {
  title: string;
  onClick: () => void;
  children: ReactNode;
}

/**
 * Toolbar button. onMouseDown preventDefault keeps the editor selection alive
 * so execCommand targets the text the user just selected.
 */
function ToolButton({ title, onClick, children }: ToolButtonProps) {
  return (
    <Tooltip title={title}>
      <Button
        type="text"
        size="small"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

const RichEmailEditor = forwardRef<RichEmailEditorHandle, RichEmailEditorProps>(
  function RichEmailEditor(
    { initialHtml = "", onHtmlChange, renderPreview },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const savedRange = useRef<Range | null>(null);
    const [mode, setMode] = useState<"rich" | "source">("rich");
    const [sourceValue, setSourceValue] = useState("");
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");

    const notify = () => onHtmlChange(editorRef.current?.innerHTML ?? "");

    useEffect(() => {
      // Old-school markup (b/i/u/font) instead of styled spans — what email
      // clients render best. Applied once; execCommand state is per-document.
      document.execCommand("styleWithCSS", false, "false");
      if (editorRef.current && initialHtml) {
        editorRef.current.innerHTML = initialHtml;
      }
      // initialHtml is a mount-time seed only; later changes come via setHtml.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      setHtml(html: string) {
        if (mode === "source") {
          setSourceValue(html);
        } else if (editorRef.current) {
          editorRef.current.innerHTML = html;
        }
        onHtmlChange(html);
      },
      appendHtml(html: string) {
        if (mode === "source") {
          const next = sourceValue + html;
          setSourceValue(next);
          onHtmlChange(next);
        } else if (editorRef.current) {
          editorRef.current.insertAdjacentHTML("beforeend", html);
          notify();
        }
      },
    }));

    const exec = (command: string, value?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
      notify();
    };

    // The link popover hosts a focusable input, so selection-preserving
    // preventDefault doesn't apply there — save the range when opening and
    // restore it right before createLink.
    const saveSelection = () => {
      const sel = window.getSelection();
      if (
        sel &&
        sel.rangeCount > 0 &&
        editorRef.current?.contains(sel.anchorNode)
      ) {
        savedRange.current = sel.getRangeAt(0).cloneRange();
      }
    };

    const restoreSelection = () => {
      const sel = window.getSelection();
      if (savedRange.current && sel) {
        sel.removeAllRanges();
        sel.addRange(savedRange.current);
      }
    };

    const insertLink = () => {
      const url = linkUrl.trim() || "https://";
      restoreSelection();
      exec("createLink", url);
      setLinkOpen(false);
      setLinkUrl("");
    };

    const toggleMode = () => {
      if (mode === "rich") {
        const html = editorRef.current?.innerHTML ?? "";
        setSourceValue(html);
        setMode("source");
        onHtmlChange(html);
      } else {
        if (editorRef.current) {
          editorRef.current.innerHTML = sourceValue;
        }
        setMode("rich");
        onHtmlChange(sourceValue);
      }
    };

    const swatches = (colors: string[], command: string) => (
      <div style={{ display: "flex", gap: 8, padding: 8 }}>
        {colors.map((color) => (
          // Same preventDefault trick as ToolButton, applied per swatch.
          <span
            key={color}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(command, color)}
            style={{
              width: 20,
              height: 20,
              background: color,
              border: "1px solid #d9d9d9",
              cursor: "pointer",
              display: "inline-block",
            }}
          />
        ))}
      </div>
    );

    const toolbar = (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
          padding: "4px 8px",
          borderBottom: "1px solid #f0f0f0",
          background: "#fafafa",
          borderRadius: "8px 8px 0 0",
        }}
      >
        <ToolButton title="加粗" onClick={() => exec("bold")}>
          <BoldOutlined />
        </ToolButton>
        <ToolButton title="斜体" onClick={() => exec("italic")}>
          <ItalicOutlined />
        </ToolButton>
        <ToolButton title="下划线" onClick={() => exec("underline")}>
          <UnderlineOutlined />
        </ToolButton>
        <ToolButton title="删除线" onClick={() => exec("strikeThrough")}>
          <StrikethroughOutlined />
        </ToolButton>
        <Dropdown
          menu={{
            items: FONT_SIZES.map((s) => ({ key: s.key, label: s.label })),
            onClick: ({ key }) => exec("fontSize", key),
          }}
        >
          <ToolButton title="字号" onClick={() => undefined}>
            <FontSizeOutlined />
          </ToolButton>
        </Dropdown>
        <Dropdown
          menu={{
            items: [
              { key: "colors", label: swatches(TEXT_COLORS, "foreColor") },
            ],
          }}
        >
          <ToolButton title="文字颜色" onClick={() => undefined}>
            <span style={{ color: "#1677ff" }}>A</span>
          </ToolButton>
        </Dropdown>
        <Dropdown
          menu={{
            items: [
              { key: "hl", label: swatches(HIGHLIGHT_COLORS, "hiliteColor") },
            ],
          }}
        >
          <ToolButton title="背景高亮" onClick={() => undefined}>
            <span style={{ background: "#f5f8ff" }}>A</span>
          </ToolButton>
        </Dropdown>
        <ToolButton title="左对齐" onClick={() => exec("justifyLeft")}>
          <AlignLeftOutlined />
        </ToolButton>
        <ToolButton title="居中" onClick={() => exec("justifyCenter")}>
          <AlignCenterOutlined />
        </ToolButton>
        <ToolButton title="右对齐" onClick={() => exec("justifyRight")}>
          <AlignRightOutlined />
        </ToolButton>
        <ToolButton
          title="无序列表"
          onClick={() => exec("insertUnorderedList")}
        >
          <UnorderedListOutlined />
        </ToolButton>
        <ToolButton title="有序列表" onClick={() => exec("insertOrderedList")}>
          <OrderedListOutlined />
        </ToolButton>
        <Popover
          open={linkOpen}
          trigger="click"
          placement="bottom"
          onOpenChange={(open) => {
            if (open) saveSelection();
            setLinkOpen(open);
          }}
          content={
            <div style={{ display: "flex", gap: 8, width: 280 }}>
              <Input
                size="small"
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onPressEnter={insertLink}
              />
              <Button size="small" type="primary" onClick={insertLink}>
                插入
              </Button>
            </div>
          }
        >
          <Button type="text" size="small">
            <LinkOutlined />
          </Button>
        </Popover>
        <ToolButton title="清除格式" onClick={() => exec("removeFormat")}>
          <ClearOutlined />
        </ToolButton>
        <span style={{ flex: 1 }} />
        <ToolButton
          title={mode === "rich" ? "查看 HTML 源码" : "返回富文本"}
          onClick={toggleMode}
        >
          <CodeOutlined />
        </ToolButton>
      </div>
    );

    return (
      <div style={{ border: "1px solid #d9d9d9", borderRadius: 8 }}>
        <style>{`.rich-email-editor-area:empty::before{content:attr(data-placeholder);color:#bfbfbf;}`}</style>
        {toolbar}
        {/* The contentEditable div stays mounted across mode switches (hidden
            via display) so its DOM content survives the round-trip. */}
        <div style={{ display: mode === "rich" ? "block" : "none" }}>
          <div
            ref={editorRef}
            className="rich-email-editor-area"
            data-placeholder="在此撰写邮件正文…"
            contentEditable
            suppressContentEditableWarning
            onInput={notify}
            onBlur={notify}
            style={{
              minHeight: 320,
              padding: "12px 16px",
              outline: "none",
              fontSize: 14,
              lineHeight: 1.8,
              fontFamily:
                "'PingFang SC','Microsoft YaHei','Helvetica Neue',Arial,sans-serif",
              overflowY: "auto",
              maxHeight: 640,
            }}
          />
        </div>
        {mode === "source" && (
          <div style={{ padding: 12 }}>
            <Input.TextArea
              value={sourceValue}
              onChange={(e) => {
                setSourceValue(e.target.value);
                onHtmlChange(e.target.value);
              }}
              autoSize={{ minRows: 10, maxRows: 20 }}
              style={{ fontFamily: "monospace", fontSize: 12 }}
            />
            {renderPreview && (
              <div style={{ marginTop: 12 }}>{renderPreview(sourceValue)}</div>
            )}
          </div>
        )}
      </div>
    );
  },
);

export default RichEmailEditor;
