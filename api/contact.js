// /api/contact.js
// Vercel Serverless Function — 接收网站表单提交，通过 Resend 发邮件到 hello@brandedgiftsco.com
//
// 部署前需要在 Vercel 项目的 Environment Variables 里添加：
//   RESEND_API_KEY = 你的 Resend API Key（在 resend.com 后台生成）
//
// 如果你想用 Resend 的自有域名发信（推荐，避免进垃圾箱），
// 还需要在 Resend 后台把 brandedgiftsco.com 加为已验证发信域名，
// 然后把下面 FROM_EMAIL 改成 noreply@brandedgiftsco.com 之类的地址。
// 如果还没验证域名，可以先用 Resend 提供的测试地址 onboarding@resend.dev 顶一阵。

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = "hello@brandedgiftsco.com";
const FROM_EMAIL = "Branded Gifts Co <onboarding@resend.dev>"; // 验证域名后改成 noreply@brandedgiftsco.com

// 允许跨域调用的来源。上线后建议把 "*" 换成你的真实域名，更安全。
const ALLOWED_ORIGIN = "*";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  // 浏览器发起正式请求前会先发 OPTIONS 预检请求，必须正确响应，否则真正的 POST 会被拦下
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { name, company, email, projectType, quantity, details } = req.body || {};

    // 必填字段校验，跟网页表单上的 * 保持一致
    if (!name || !email || !details) {
      res.status(400).json({ error: "缺少必填字段：姓名 / 邮箱 / 项目详情" });
      return;
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY 未配置");
      res.status(500).json({ error: "服务器邮件配置缺失" });
      return;
    }

    const emailHtml = `
      <h2>新的项目咨询（Branded Gifts Co 网站表单）</h2>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
        <tr><td><strong>姓名</strong></td><td>${escapeHtml(name)}</td></tr>
        <tr><td><strong>公司</strong></td><td>${escapeHtml(company || "-")}</td></tr>
        <tr><td><strong>工作邮箱</strong></td><td>${escapeHtml(email)}</td></tr>
        <tr><td><strong>项目类型</strong></td><td>${escapeHtml(projectType || "-")}</td></tr>
        <tr><td><strong>预估数量</strong></td><td>${escapeHtml(quantity || "-")}</td></tr>
        <tr><td><strong>项目详情</strong></td><td>${escapeHtml(details).replace(/\n/g, "<br>")}</td></tr>
      </table>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: email, // 方便直接回复客户
        subject: `新项目咨询 - ${name}${company ? ` (${company})` : ""}`,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("Resend 发送失败:", errText);
      res.status(502).json({ error: "邮件发送失败，请稍后重试" });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("表单处理出错:", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
}
