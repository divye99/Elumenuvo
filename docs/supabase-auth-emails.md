# Branded auth emails (from info@elumenuvo.com)

Auth emails (confirm signup, reset password) are sent by Supabase. Two
dashboard changes make them come from Elume with Elume branding. About ten
minutes, one time.

## 1. Send via your own address (Resend SMTP)

Prerequisite: elumenuvo.com verified as a domain in Resend (same requirement
as the order emails; if order confirmations already arrive from
info@elumenuvo.com this is done).

Supabase Dashboard → Project Settings → Authentication → **SMTP Settings**:

| Field | Value |
|---|---|
| Enable custom SMTP | on |
| Sender email | `info@elumenuvo.com` |
| Sender name | `Elume` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |

## 2. Fix where the confirmation link lands

Supabase Dashboard → Authentication → **URL Configuration**:

- **Site URL**: `https://elumenuvo.com`  (this is why links currently land on
  a random Vercel page: the Site URL still points at a preview deployment)
- **Redirect URLs**: add `https://elumenuvo.com/**`

The code now sends `emailRedirectTo = https://elumenuvo.com/signin?confirmed=1`
with every signup, and the sign-in page greets confirmed users with
"Email confirmed. Sign in below to get started."

## 3. Branded templates

Supabase Dashboard → Authentication → **Email Templates**. Paste the HTML
below into each template (adjust the heading/body line per template as noted).
`{{ .ConfirmationURL }}` is filled by Supabase.

**Confirm signup** — subject: `Confirm your Elume account`

```html
<div style="background:#F5F6F9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E8EBF1">
    <div style="background:linear-gradient(120deg,#191c45 0%,#5b2d63 55%,#b0472e 100%);padding:28px 32px;text-align:center">
      <img src="https://elumenuvo.com/icon.png" width="52" height="52" alt="Elume" style="display:inline-block">
      <div style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:2px;margin-top:10px">elume</div>
    </div>
    <div style="padding:30px 32px">
      <h1 style="font-size:19px;color:#19202E;margin:0 0 10px">Confirm your email</h1>
      <p style="font-size:14px;color:#56627A;line-height:1.65;margin:0 0 22px">
        Welcome to Elume, India's multi-brand store for electrical goods.
        Confirm your email to activate your account.
      </p>
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:#4E5BDC;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;padding:13px 26px;border-radius:10px">
        Confirm email address
      </a>
      <p style="font-size:12px;color:#8A93A6;line-height:1.6;margin:22px 0 0">
        After confirming you'll be brought back to elumenuvo.com to sign in.
        If you didn't create this account, ignore this email.
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #F0F2F6;font-size:11px;color:#A0A7B5">
      Elume Nuvotech Private Limited · info@elumenuvo.com · elumenuvo.com
    </div>
  </div>
</div>
```

**Reset password** — subject: `Reset your Elume password`; same HTML with the
heading `Reset your password`, body line "Tap the button to choose a new
password for your Elume account.", button text `Choose a new password`.

**Magic link** (if ever enabled) — subject: `Your Elume sign-in link`; heading
`Sign in to Elume`, button text `Sign in`.

## 4. Verify

Create a throwaway account on elumenuvo.com/signin → the email should arrive
from "Elume <info@elumenuvo.com>" with the branded card → the button should
land on elumenuvo.com/signin with the green "Email confirmed" banner.
