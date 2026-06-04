# S3 Operations Console

A modern web application for managing Amazon S3 buckets, uploading files, and controlling object access permissions — all through a beautiful dark-themed UI.

![Python](https://img.shields.io/badge/Python-3.8+-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.0+-green?logo=flask)
![AWS S3](https://img.shields.io/badge/AWS-S3-orange?logo=amazonaws)

---

## Features

- **Create Buckets** — Specify bucket name and AWS region to create new S3 buckets
- **Upload Files** — Drag-and-drop or browse to upload multiple files to any bucket
- **Change Access Levels** — Modify object ACLs (Private, Public Read, Public Read-Write, Authenticated Read)
- **Verify Permissions** — Visual confirmation modal showing before/after ACL changes with detailed grant information
- **Activity Log** — Real-time timestamped log of all operations

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Python, Flask, boto3 |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| AWS SDK | boto3 (official AWS SDK for Python) |
| Styling | Custom CSS with glassmorphism dark theme |

---

## Security Notes

⚠️ **This app is designed for local development and demonstration purposes.**

- Buckets are created with ACLs enabled and Public Access Block disabled to demonstrate ACL changes
- In production, keep Public Access Block enabled and use pre-signed URLs or CloudFront
- Scope IAM policies to specific bucket ARNs instead of wildcards
- Never expose AWS credentials in client-side code

---

## License

MIT
