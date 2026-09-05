/**
 * Preset HTML email templates shared by the Register page (verification-code
 * defaults) and the Message/SendEmail page (template picker + live preview).
 *
 * The HTML follows classic mail-client compatibility rules — table layout,
 * inline styles only, no external CSS/JS/images — so it renders correctly in
 * QQ Mail, NetEase Mail, Gmail, and Outlook. message-service sends html_body
 * as MIME multipart/alternative: HTML-capable clients render the styled card,
 * plain-text-only clients fall back to `body`, so both variants must stay
 * semantically equal.
 *
 * The literal "{code}" placeholder is substituted by user-service before
 * delivery — it must survive verbatim in `body` / `htmlBody`.
 */

export interface EmailTemplate {
  /** Stable template id used as the Select value on the SendEmail page. */
  id: string;
  /** Chinese label shown in the template picker. */
  label: string;
  /** Default email subject (may be empty for the blank template). */
  subject: string;
  /** Plain-text fallback body, semantically equal to htmlBody. */
  body: string;
  /** Styled HTML body (empty = plain-text only send). */
  htmlBody: string;
}

/** Brand color and font stack shared by the built-in templates. */
const BRAND_COLOR = "#1677ff";
const FONT_STACK =
  "'PingFang SC','Microsoft YaHei','Helvetica Neue',Arial,sans-serif";

/** Wraps card content rows in the outer page background table. */
function emailDocument(innerRows: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Testkit</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f0f2f5;">
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="background-color:#f0f2f5;padding:24px 12px;"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="600"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="width:600px;max-width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;font-family:${FONT_STACK};"
          >
            ${innerRows}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Renders the blue brand header row shared by all styled templates. */
function brandHeaderRow(): string {
  return `<tr>
  <td style="background-color:${BRAND_COLOR};padding:20px 32px;">
    <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:1px;">Testkit</span>
  </td>
</tr>`;
}

/** Renders the grey auto-send disclaimer footer row. */
function footerRow(extraNote: string): string {
  return `<tr>
  <td style="padding:8px 32px 28px;">
    <p style="margin:0;padding-top:16px;border-top:1px solid #f0f0f0;font-size:12px;line-height:18px;color:#a8adb4;">
      此邮件由 Testkit 系统自动发送，请勿直接回复。${extraNote}
    </p>
  </td>
</tr>`;
}

const verificationCodeHtml = emailDocument(`
${brandHeaderRow()}
<tr>
  <td style="padding:36px 32px 12px;">
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2329;">您的验证码</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#51565d;">
      您好！您正在进行身份验证，请使用下方验证码完成操作：
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="background-color:#f5f8ff;border:1px dashed ${BRAND_COLOR};border-radius:6px;padding:18px 12px;">
          <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:${BRAND_COLOR};font-family:'Courier New',monospace;">{code}</span>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 6px;font-size:13px;line-height:20px;color:#51565d;">验证码 5 分钟内有效，请尽快使用。</p>
    <p style="margin:0;font-size:13px;line-height:20px;color:#51565d;">
      为了您的账号安全，请勿将验证码透露给任何人。
    </p>
  </td>
</tr>
${footerRow("若非本人操作，请忽略此邮件。")}
`);

const notificationHtml = emailDocument(`
${brandHeaderRow()}
<tr>
  <td style="padding:36px 32px 12px;">
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#1f2329;">系统通知</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:24px;color:#51565d;">
      您好！这里是一封系统通知邮件的示例正文，发送前请替换为实际内容。
    </p>
    <p style="margin:0;font-size:14px;line-height:24px;color:#51565d;">
      第二段正文：支持多段文字，编辑 HTML 可调整样式与结构。
    </p>
  </td>
</tr>
${footerRow("")}
`);

/**
 * Built-in templates listed in the SendEmail page picker. The blank template
 * clears all three content fields for fully hand-written sends.
 */
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "verification-code",
    label: "验证码邮件（大字号验证码卡片）",
    subject: "Testkit 验证码",
    body: "您的验证码：{code}，5 分钟内有效。为了您的账号安全，请勿将验证码透露给任何人。",
    htmlBody: verificationCodeHtml,
  },
  {
    id: "notification",
    label: "通知邮件（标题 + 正文段落）",
    subject: "Testkit 系统通知",
    body: "您好！这里是一封系统通知邮件的示例正文，发送前请替换为实际内容。",
    htmlBody: notificationHtml,
  },
  {
    id: "blank",
    label: "空白（自定义）",
    subject: "",
    body: "",
    htmlBody: "",
  },
];

/** The default verification-code template pre-filled on the Register page. */
export const VERIFICATION_CODE_TEMPLATE: EmailTemplate = EMAIL_TEMPLATES[0];
