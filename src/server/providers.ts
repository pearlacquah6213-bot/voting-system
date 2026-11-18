import crypto from 'crypto';

export type SmsProviderType = 'ARKESEL' | 'HUBTEL' | 'MNOTIFY' | 'SANDBOX';

export async function dispatchSmsOtp(
  phone: string,
  otp: string,
  preferredProvider: string
): Promise<{ delivered: boolean; provider: SmsProviderType }> {
  const message = `Your Black Star Honours verification code is ${otp}. Valid for 10 minutes.`;

  if (preferredProvider === 'ARKESEL' && process.env.ARKESEL_API_KEY) {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': process.env.ARKESEL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: 'BlackStarGH',
        message,
        recipients: [phone.replace(/^\+/, '')],
      }),
    });
    if (res.ok) return { delivered: true, provider: 'ARKESEL' };
  }

  if (preferredProvider === 'HUBTEL' && process.env.HUBTEL_CLIENT_ID && process.env.HUBTEL_CLIENT_SECRET) {
    const auth = Buffer.from(
      `${process.env.HUBTEL_CLIENT_ID}:${process.env.HUBTEL_CLIENT_SECRET}`
    ).toString('base64');
    const url = new URL('https://smsc.hubtel.com/v1/messages/send');
    url.searchParams.set('From', 'BlackStarGH');
    url.searchParams.set('To', phone.replace(/^\+/, ''));
    url.searchParams.set('Content', message);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (res.ok) return { delivered: true, provider: 'HUBTEL' };
  }

  if (preferredProvider === 'MNOTIFY' && process.env.MNOTIFY_API_KEY) {
    const res = await fetch(
      `https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(process.env.MNOTIFY_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: [phone.replace(/^\+/, '')],
          sender: 'BlackStarGH',
          message,
        }),
      }
    );
    if (res.ok) return { delivered: true, provider: 'MNOTIFY' };
  }

  return { delivered: false, provider: 'SANDBOX' };
}

export async function dispatchEmailOtp(
  email: string,
  subject: string,
  htmlBody: string
): Promise<{ delivered: boolean; provider: 'RESEND' | 'SANDBOX' }> {
  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Black Star Honours <no-reply@blackstarhonours.gh>',
        to: [email],
        subject,
        html: htmlBody,
      }),
    });
    if (res.ok) return { delivered: true, provider: 'RESEND' };
  }
  return { delivered: false, provider: 'SANDBOX' };
}

export async function verifyPaystackTransaction(reference: string): Promise<{
  verified: boolean;
  amountGhs?: number;
}> {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return { verified: false };
  }
  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    }
  );
  if (!res.ok) return { verified: false };
  const payload = (await res.json()) as {
    status?: boolean;
    data?: { status?: string; amount?: number; currency?: string };
  };
  if (payload.status && payload.data?.status === 'success') {
    return {
      verified: true,
      amountGhs: Math.round((payload.data.amount || 0) / 100),
    };
  }
  return { verified: false };
}

export function verifyPaystackSignature(rawBody: string, signature?: string): boolean {
  if (!process.env.PAYSTACK_SECRET_KEY || !signature) return false;
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  if (!process.env.TURNSTILE_SECRET_KEY) return false;
  const formData = new URLSearchParams();
  formData.append('secret', process.env.TURNSTILE_SECRET_KEY);
  formData.append('response', token);
  if (remoteIp) formData.append('remoteip', remoteIp);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });
  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}
