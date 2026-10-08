# Security Policy — What's Not Up

The full security posture — minimal permissions, threat model, residual risks, scope, and how to report a vulnerability — is documented in:

**[`docs/security.md`](docs/security.md)**

Summary:

- Runs only on `https://web.whatsapp.com` and `https://www.instagram.com`
- No backend, no telemetry, no credential access, no network interception
- Minimal permissions: `storage`, `tabs`, and two specific host origins
- Detection fails safe: low confidence yields no blur, never a wrong blur

To report a security issue, open a GitHub issue with the label `security`.
