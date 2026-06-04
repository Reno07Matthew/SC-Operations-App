"""
S3 Operations App — Flask Backend
Provides REST API endpoints for Amazon S3 bucket and object management.
"""

import os
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import boto3
from botocore.exceptions import ClientError, NoCredentialsError, BotoCoreError

# Load environment variables from .env file (if it exists)
load_dotenv()

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# Maximum upload size: 50 MB
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

# ---------------------------------------------------------------------------
# AWS S3 Regions
# ---------------------------------------------------------------------------
S3_REGIONS = [
    {"code": "us-east-1", "name": "US East (N. Virginia)"},
    {"code": "us-east-2", "name": "US East (Ohio)"},
    {"code": "us-west-1", "name": "US West (N. California)"},
    {"code": "us-west-2", "name": "US West (Oregon)"},
    {"code": "af-south-1", "name": "Africa (Cape Town)"},
    {"code": "ap-east-1", "name": "Asia Pacific (Hong Kong)"},
    {"code": "ap-south-1", "name": "Asia Pacific (Mumbai)"},
    {"code": "ap-south-2", "name": "Asia Pacific (Hyderabad)"},
    {"code": "ap-southeast-1", "name": "Asia Pacific (Singapore)"},
    {"code": "ap-southeast-2", "name": "Asia Pacific (Sydney)"},
    {"code": "ap-northeast-1", "name": "Asia Pacific (Tokyo)"},
    {"code": "ap-northeast-2", "name": "Asia Pacific (Seoul)"},
    {"code": "ap-northeast-3", "name": "Asia Pacific (Osaka)"},
    {"code": "ca-central-1", "name": "Canada (Central)"},
    {"code": "eu-central-1", "name": "Europe (Frankfurt)"},
    {"code": "eu-west-1", "name": "Europe (Ireland)"},
    {"code": "eu-west-2", "name": "Europe (London)"},
    {"code": "eu-west-3", "name": "Europe (Paris)"},
    {"code": "eu-south-1", "name": "Europe (Milan)"},
    {"code": "eu-north-1", "name": "Europe (Stockholm)"},
    {"code": "me-south-1", "name": "Middle East (Bahrain)"},
    {"code": "sa-east-1", "name": "South America (São Paulo)"},
]

# Supported canned ACLs
CANNED_ACLS = ["private", "public-read", "public-read-write", "authenticated-read"]


def get_s3_client(region=None):
    """Create and return a boto3 S3 client."""
    kwargs = {}
    if region:
        kwargs['region_name'] = region
    return boto3.client('s3', **kwargs)


# ---------------------------------------------------------------------------
# Serve the frontend
# ---------------------------------------------------------------------------
@app.route('/')
def serve_index():
    """Serve the main HTML page."""
    return send_from_directory(app.static_folder, 'index.html')


# ---------------------------------------------------------------------------
# API: Health check
# ---------------------------------------------------------------------------
@app.route('/api/health', methods=['GET'])
def health_check():
    """Check if AWS credentials are configured."""
    try:
        s3 = get_s3_client()
        s3.list_buckets()
        return jsonify({"status": "ok", "message": "AWS credentials are valid."})
    except NoCredentialsError:
        return jsonify({
            "status": "error",
            "message": "AWS credentials not found. Please run 'aws configure' or set environment variables."
        }), 401
    except ClientError as e:
        return jsonify({"status": "error", "message": str(e)}), 403


# ---------------------------------------------------------------------------
# API: List available regions
# ---------------------------------------------------------------------------
@app.route('/api/regions', methods=['GET'])
def list_regions():
    """Return a list of available S3 regions."""
    return jsonify({"regions": S3_REGIONS})


# ---------------------------------------------------------------------------
# API: List all buckets
# ---------------------------------------------------------------------------
@app.route('/api/buckets', methods=['GET'])
def list_buckets():
    """List all S3 buckets owned by the authenticated user."""
    try:
        s3 = get_s3_client()
        response = s3.list_buckets()
        buckets = []
        for b in response.get('Buckets', []):
            # Get the bucket region
            try:
                loc = s3.get_bucket_location(Bucket=b['Name'])
                region = loc.get('LocationConstraint') or 'us-east-1'
            except ClientError:
                region = 'unknown'
            buckets.append({
                "name": b['Name'],
                "created": b['CreationDate'].isoformat(),
                "region": region,
            })
        return jsonify({"buckets": buckets})
    except NoCredentialsError:
        return jsonify({"error": "AWS credentials not configured."}), 401
    except ClientError as e:
        return jsonify({"error": str(e)}), 400


# ---------------------------------------------------------------------------
# API: Create a new bucket
# ---------------------------------------------------------------------------
@app.route('/api/buckets', methods=['POST'])
def create_bucket():
    """
    Create a new S3 bucket with ACLs enabled.
    Expects JSON: { "name": "bucket-name", "region": "us-east-1" }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body must be JSON."}), 400

    bucket_name = data.get('name', '').strip().lower()
    region = data.get('region', '').strip()

    # Validation
    if not bucket_name:
        return jsonify({"error": "Bucket name is required."}), 400
    if len(bucket_name) < 3 or len(bucket_name) > 63:
        return jsonify({"error": "Bucket name must be 3-63 characters long."}), 400
    if not region:
        return jsonify({"error": "Region is required."}), 400

    try:
        s3 = get_s3_client(region)

        # Step 1: Create the bucket
        create_config = {}
        # us-east-1 must NOT include LocationConstraint
        if region != 'us-east-1':
            create_config['CreateBucketConfiguration'] = {
                'LocationConstraint': region
            }
        s3.create_bucket(Bucket=bucket_name, **create_config)

        # Step 2: Enable ACLs by setting ownership controls
        s3.put_bucket_ownership_controls(
            Bucket=bucket_name,
            OwnershipControls={
                'Rules': [{'ObjectOwnership': 'BucketOwnerPreferred'}]
            }
        )

        # Step 3: Disable public access block (for demo / ACL demonstration)
        s3.put_public_access_block(
            Bucket=bucket_name,
            PublicAccessBlockConfiguration={
                'BlockPublicAcls': False,
                'IgnorePublicAcls': False,
                'BlockPublicPolicy': False,
                'RestrictPublicBuckets': False,
            }
        )

        return jsonify({
            "message": f"Bucket '{bucket_name}' created successfully in {region}.",
            "bucket": {
                "name": bucket_name,
                "region": region,
            }
        }), 201

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_msg = e.response['Error']['Message']
        if error_code == 'BucketAlreadyOwnedByYou':
            return jsonify({"error": f"You already own a bucket named '{bucket_name}'."}), 409
        elif error_code == 'BucketAlreadyExists':
            return jsonify({"error": f"Bucket name '{bucket_name}' is already taken globally. Try a different name."}), 409
        elif error_code == 'InvalidBucketName':
            return jsonify({"error": f"Invalid bucket name: {error_msg}"}), 400
        return jsonify({"error": f"{error_code}: {error_msg}"}), 400
    except NoCredentialsError:
        return jsonify({"error": "AWS credentials not configured."}), 401


# ---------------------------------------------------------------------------
# API: Upload files to a bucket
# ---------------------------------------------------------------------------
@app.route('/api/upload', methods=['POST'])
def upload_files():
    """
    Upload one or more files to a specified S3 bucket.
    Expects multipart/form-data with:
      - 'bucket' field: bucket name
      - 'files' field: one or more files
    """
    bucket_name = request.form.get('bucket', '').strip()
    if not bucket_name:
        return jsonify({"error": "Bucket name is required."}), 400

    files = request.files.getlist('files')
    if not files or all(f.filename == '' for f in files):
        return jsonify({"error": "At least one file is required."}), 400

    try:
        # Determine the bucket's region
        s3_default = get_s3_client()
        loc = s3_default.get_bucket_location(Bucket=bucket_name)
        region = loc.get('LocationConstraint') or 'us-east-1'
        s3 = get_s3_client(region)

        uploaded = []
        errors = []

        for f in files:
            if f.filename == '':
                continue
            key = f.filename
            try:
                s3.upload_fileobj(f, bucket_name, key)
                uploaded.append({
                    "key": key,
                    "size": f.content_length or 0,
                    "bucket": bucket_name,
                })
            except ClientError as e:
                errors.append({"file": key, "error": str(e)})

        result = {
            "message": f"Uploaded {len(uploaded)} file(s) to '{bucket_name}'.",
            "uploaded": uploaded,
        }
        if errors:
            result["errors"] = errors

        return jsonify(result), 200

    except ClientError as e:
        return jsonify({"error": str(e)}), 400
    except NoCredentialsError:
        return jsonify({"error": "AWS credentials not configured."}), 401


# ---------------------------------------------------------------------------
# API: List objects in a bucket
# ---------------------------------------------------------------------------
@app.route('/api/objects/<bucket_name>', methods=['GET'])
def list_objects(bucket_name):
    """List all objects in the specified S3 bucket."""
    try:
        s3_default = get_s3_client()
        loc = s3_default.get_bucket_location(Bucket=bucket_name)
        region = loc.get('LocationConstraint') or 'us-east-1'
        s3 = get_s3_client(region)

        response = s3.list_objects_v2(Bucket=bucket_name)
        objects = []
        for obj in response.get('Contents', []):
            # Get the ACL for each object
            try:
                acl_response = s3.get_object_acl(Bucket=bucket_name, Key=obj['Key'])
                acl_grants = acl_response.get('Grants', [])
                acl_label = _interpret_acl(acl_grants)
            except ClientError:
                acl_label = 'unknown'

            objects.append({
                "key": obj['Key'],
                "size": obj['Size'],
                "lastModified": obj['LastModified'].isoformat(),
                "acl": acl_label,
                "url": f"https://{bucket_name}.s3.{region}.amazonaws.com/{obj['Key']}",
            })

        return jsonify({"objects": objects, "bucket": bucket_name})

    except ClientError as e:
        return jsonify({"error": str(e)}), 400
    except NoCredentialsError:
        return jsonify({"error": "AWS credentials not configured."}), 401


# ---------------------------------------------------------------------------
# API: Get object ACL
# ---------------------------------------------------------------------------
@app.route('/api/acl/<bucket_name>/<path:key>', methods=['GET'])
def get_object_acl(bucket_name, key):
    """Get the current ACL of an object."""
    try:
        s3_default = get_s3_client()
        loc = s3_default.get_bucket_location(Bucket=bucket_name)
        region = loc.get('LocationConstraint') or 'us-east-1'
        s3 = get_s3_client(region)

        acl_response = s3.get_object_acl(Bucket=bucket_name, Key=key)
        grants = acl_response.get('Grants', [])
        owner = acl_response.get('Owner', {}).get('DisplayName', 'N/A')
        acl_label = _interpret_acl(grants)

        return jsonify({
            "bucket": bucket_name,
            "key": key,
            "acl": acl_label,
            "owner": owner,
            "grants": _format_grants(grants),
        })

    except ClientError as e:
        return jsonify({"error": str(e)}), 400
    except NoCredentialsError:
        return jsonify({"error": "AWS credentials not configured."}), 401


# ---------------------------------------------------------------------------
# API: Change object ACL
# ---------------------------------------------------------------------------
@app.route('/api/acl/<bucket_name>/<path:key>', methods=['PUT'])
def set_object_acl(bucket_name, key):
    """
    Change the ACL of an object.
    Expects JSON: { "acl": "public-read" }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body must be JSON."}), 400

    new_acl = data.get('acl', '').strip()
    if new_acl not in CANNED_ACLS:
        return jsonify({
            "error": f"Invalid ACL '{new_acl}'. Must be one of: {', '.join(CANNED_ACLS)}"
        }), 400

    try:
        # Get old ACL first
        s3_default = get_s3_client()
        loc = s3_default.get_bucket_location(Bucket=bucket_name)
        region = loc.get('LocationConstraint') or 'us-east-1'
        s3 = get_s3_client(region)

        old_acl_response = s3.get_object_acl(Bucket=bucket_name, Key=key)
        old_acl = _interpret_acl(old_acl_response.get('Grants', []))

        # Apply the new ACL
        s3.put_object_acl(Bucket=bucket_name, Key=key, ACL=new_acl)

        # Verify by reading back
        new_acl_response = s3.get_object_acl(Bucket=bucket_name, Key=key)
        verified_acl = _interpret_acl(new_acl_response.get('Grants', []))

        return jsonify({
            "message": f"ACL for '{key}' changed from '{old_acl}' to '{verified_acl}'.",
            "bucket": bucket_name,
            "key": key,
            "previousAcl": old_acl,
            "currentAcl": verified_acl,
            "grants": _format_grants(new_acl_response.get('Grants', [])),
        })

    except ClientError as e:
        return jsonify({"error": str(e)}), 400
    except NoCredentialsError:
        return jsonify({"error": "AWS credentials not configured."}), 401


# ---------------------------------------------------------------------------
# Helper: Interpret ACL grants into a human-readable label
# ---------------------------------------------------------------------------
def _interpret_acl(grants):
    """
    Interpret S3 ACL grants list and return a canned ACL label.
    """
    has_public_read = False
    has_public_write = False
    has_auth_read = False

    for grant in grants:
        grantee = grant.get('Grantee', {})
        uri = grantee.get('URI', '')
        permission = grant.get('Permission', '')

        if uri == 'http://acs.amazonaws.com/groups/global/AllUsers':
            if permission == 'READ':
                has_public_read = True
            elif permission == 'WRITE':
                has_public_write = True
        elif uri == 'http://acs.amazonaws.com/groups/global/AuthenticatedUsers':
            if permission == 'READ':
                has_auth_read = True

    if has_public_read and has_public_write:
        return 'public-read-write'
    elif has_public_read:
        return 'public-read'
    elif has_auth_read:
        return 'authenticated-read'
    else:
        return 'private'


def _format_grants(grants):
    """Format grants into a more readable list."""
    formatted = []
    for grant in grants:
        grantee = grant.get('Grantee', {})
        g_type = grantee.get('Type', 'Unknown')
        if g_type == 'CanonicalUser':
            who = grantee.get('DisplayName', grantee.get('ID', 'Owner')[:12] + '...')
        elif g_type == 'Group':
            uri = grantee.get('URI', '')
            if 'AllUsers' in uri:
                who = 'Everyone (Public)'
            elif 'AuthenticatedUsers' in uri:
                who = 'Authenticated AWS Users'
            elif 'LogDelivery' in uri:
                who = 'Log Delivery'
            else:
                who = uri
        else:
            who = 'Unknown'

        formatted.append({
            "grantee": who,
            "permission": grant.get('Permission', 'Unknown'),
        })
    return formatted


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------
@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "File too large. Maximum size is 50 MB."}), 413


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found."}), 404


# ---------------------------------------------------------------------------
# Run the app
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'true').lower() == 'true'
    print(f"\n  🚀  S3 Operations App running at http://localhost:{port}\n")
    app.run(host='0.0.0.0', port=port, debug=debug)
