import axios from 'axios';

/**
 * Transactional email.
 *
 * Entirely optional: with no RESEND_API_KEY configured, every send is a no-op
 * that logs what it would have sent. That keeps local development and the
 * deployed instance working without a mail provider — but note that password
 * reset genuinely does not work end-to-end until a key is set, since the reset
 * link can only reach the user by email.
 */

const FROM = process.env.EMAIL_FROM || 'IntellMeet <onboarding@resend.dev>';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export const isEmailEnabled = () => Boolean(process.env.RESEND_API_KEY);

const send = async ({ to, subject, html }) => {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) return { skipped: true, reason: 'no-recipients' };

  if (!isEmailEnabled()) {
    console.log(`[Email] (not configured) would send "${subject}" to ${recipients.join(', ')}`);
    return { skipped: true, reason: 'not-configured' };
  }

  try {
    await axios.post(
      RESEND_ENDPOINT,
      { from: FROM, to: recipients, subject, html },
      {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        timeout: 10000,
      }
    );
    return { sent: true };
  } catch (error) {
    // Never throw: a failed email must not fail the request that triggered it.
    console.error('[Email] Send failed:', error.response?.data?.message || error.message);
    return { sent: false, error: error.message };
  }
};

const layout = (title, bodyHtml) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1A1A1A">
  <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
  ${bodyHtml}
  <hr style="border:none;border-top:1px solid #E8E4DD;margin:32px 0 16px" />
  <p style="font-size:12px;color:#6B6560;margin:0">Sent by IntellMeet</p>
</div>`;

const button = (href, label) => `
<a href="${href}" style="display:inline-block;background:#7C3AED;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${label}</a>`;

export const sendPasswordResetEmail = async ({ to, name, resetUrl }) =>
  send({
    to,
    subject: 'Reset your IntellMeet password',
    html: layout(
      'Reset your password',
      `<p>Hi ${name || 'there'},</p>
       <p>Use the link below to choose a new password. It expires in 30 minutes.</p>
       <p style="margin:24px 0">${button(resetUrl, 'Reset password')}</p>
       <p style="font-size:13px;color:#6B6560">If you didn't request this, you can ignore this email — your password will stay the same.</p>`
    ),
  });

export const sendMeetingSummaryEmail = async ({ to, meetingTitle, summary, actionItems = [], summaryUrl }) => {
  const items = actionItems.slice(0, 10);

  return send({
    to,
    subject: `Summary: ${meetingTitle}`,
    html: layout(
      meetingTitle,
      `<p style="white-space:pre-wrap;line-height:1.6">${String(summary || '').slice(0, 2000)}</p>
       ${
         items.length
           ? `<h2 style="font-size:16px;margin:24px 0 8px">Action items</h2>
              <ul style="padding-left:20px;line-height:1.8">
                ${items.map((i) => `<li>${i.task}${i.assignee && i.assignee !== 'Unassigned' ? ` — <strong>${i.assignee}</strong>` : ''}</li>`).join('')}
              </ul>`
           : ''
       }
       <p style="margin:24px 0">${button(summaryUrl, 'View full summary')}</p>`
    ),
  });
};

export default { isEmailEnabled, sendPasswordResetEmail, sendMeetingSummaryEmail };
