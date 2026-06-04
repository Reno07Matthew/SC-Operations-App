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

## Prerequisites

1. **Python 3.8+** — [Download Python](https://www.python.org/downloads/)
2. **AWS Account** — [Create an AWS Account](https://aws.amazon.com/)
3. **AWS CLI** (recommended) — [Install AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

### AWS Credentials

Configure your credentials using one of these methods:

**Option A — AWS CLI (Recommended):**
```bash
aws configure
# Enter your Access Key ID, Secret Access Key, and default region
```

**Option B — Environment Variables:**
```bash
cp .env.example .env
# Edit .env with your AWS credentials
```

### Required IAM Permissions

Attach the following IAM policy to your user/role. See the implementation plan for the full JSON policy.

| Permission Group | Actions |
|-----------------|---------|
| Bucket Management | `s3:CreateBucket`, `s3:ListAllMyBuckets`, `s3:ListBucket`, `s3:GetBucketLocation` |
| Object Operations | `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` |
| ACL Operations | `s3:PutObjectAcl`, `s3:GetObjectAcl`, `s3:PutBucketAcl`, `s3:GetBucketAcl` |
| Bucket Config | `s3:PutBucketOwnershipControls`, `s3:PutBucketPublicAccessBlock` |

---

## Installation

```bash
# 1. Navigate to the project directory
cd s3-operations-app

# 2. (Optional) Create a virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. (Optional) Set up environment variables
cp .env.example .env
# Edit .env with your values
```

---

## Running the App

```bash
python app.py
```

The app will start at **http://localhost:5000**. Open this URL in your browser.

---

## Usage

### 1. Create a Bucket
- Enter a globally unique bucket name (lowercase, 3-63 characters)
- Select an AWS region
- Click **Create Bucket**

### 2. Upload Files
- Select a target bucket from the dropdown
- Drag and drop files into the upload zone, or click to browse
- Click **Upload Files**

### 3. Change Access Permissions
- Select a bucket in the **Manage Access** panel
- Objects will be listed with their current ACL
- Choose a new ACL from the dropdown and click **Apply**
- A verification modal confirms the change with full grant details

### 4. Monitor Activity
- The **Activity Log** panel shows timestamped entries for all operations
- Use the **Clear** button to reset the log

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Python, Flask, boto3 |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| AWS SDK | boto3 (official AWS SDK for Python) |
| Styling | Custom CSS with glassmorphism dark theme |

---

## Project Structure

```
s3-operations-app/
├── app.py                  # Flask backend (API routes)
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── README.md               # This file
└── static/
    ├── index.html          # Main UI page
    ├── index.css           # Dark theme styles
    └── index.js            # Frontend logic
```

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
