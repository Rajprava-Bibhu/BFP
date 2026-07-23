#!/usr/bin/env bash
# =============================================================
# BizAuto — AWS Infrastructure Setup Script
# Run ONCE to provision: ECR, ECS, RDS, S3, Secrets Manager
#
# Prerequisites:
#   - AWS CLI configured with admin credentials
#   - Docker installed
#   - jq installed
#
# Usage: AWS_REGION=ap-south-1 ./scripts/setup-aws.sh
# =============================================================

set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"
APP_NAME="bizauto"
ENV="${ENV:-prod}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ECR_REPO="${APP_NAME}-api"
S3_BUCKET="${APP_NAME}-uploads-${ENV}"
ECS_CLUSTER="${APP_NAME}-cluster"
DB_IDENTIFIER="${APP_NAME}-db-${ENV}"

echo "═══════════════════════════════════════════════"
echo "  BizAuto AWS Setup"
echo "  Account: ${ACCOUNT_ID}"
echo "  Region : ${AWS_REGION}"
echo "  Env    : ${ENV}"
echo "═══════════════════════════════════════════════"
echo ""

# ── 1. ECR Repository ─────────────────────────────────────────
echo "▶ [1/7] Creating ECR repository..."
aws ecr create-repository \
  --repository-name "${ECR_REPO}" \
  --region "${AWS_REGION}" \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  2>/dev/null || echo "  (Already exists)"

aws ecr put-lifecycle-policy \
  --repository-name "${ECR_REPO}" \
  --lifecycle-policy-text '{
    "rules": [{
      "rulePriority": 1,
      "description": "Keep last 10 images",
      "selection": {"tagStatus": "any", "countType": "imageCountMoreThan", "countNumber": 10},
      "action": {"type": "expire"}
    }]
  }' 2>/dev/null || true

echo "  ECR: ${ECR_REGISTRY}/${ECR_REPO}"

# ── 2. S3 Bucket for uploads ──────────────────────────────────
echo "▶ [2/7] Creating S3 bucket..."
if [ "${AWS_REGION}" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "${S3_BUCKET}" --region "${AWS_REGION}" 2>/dev/null || true
else
  aws s3api create-bucket \
    --bucket "${S3_BUCKET}" \
    --region "${AWS_REGION}" \
    --create-bucket-configuration LocationConstraint="${AWS_REGION}" \
    2>/dev/null || true
fi

aws s3api put-bucket-versioning \
  --bucket "${S3_BUCKET}" \
  --versioning-configuration Status=Enabled

aws s3api put-public-access-block \
  --bucket "${S3_BUCKET}" \
  --public-access-block-configuration \
    BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false

# CORS for direct browser uploads
aws s3api put-bucket-cors --bucket "${S3_BUCKET}" --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET","PUT","POST","DELETE","HEAD"],
    "AllowedOrigins": ["*"],
    "MaxAgeSeconds": 3000
  }]
}'
echo "  S3 bucket: ${S3_BUCKET}"

# ── 3. ECS Cluster ────────────────────────────────────────────
echo "▶ [3/7] Creating ECS cluster..."
aws ecs create-cluster \
  --cluster-name "${ECS_CLUSTER}" \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy \
    capacityProvider=FARGATE,weight=1 \
    capacityProvider=FARGATE_SPOT,weight=4 \
  2>/dev/null || echo "  (Already exists)"
echo "  ECS cluster: ${ECS_CLUSTER}"

# ── 4. IAM Roles ─────────────────────────────────────────────
echo "▶ [4/7] Creating IAM roles..."
# Task execution role
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }' 2>/dev/null || true
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy 2>/dev/null || true
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite 2>/dev/null || true

# Task role (app permissions: S3, SecretsManager)
aws iam create-role \
  --role-name "${APP_NAME}-task-role" \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }' 2>/dev/null || true
aws iam put-role-policy \
  --role-name "${APP_NAME}-task-role" \
  --policy-name "${APP_NAME}-s3-policy" \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Effect\":\"Allow\",
      \"Action\":[\"s3:PutObject\",\"s3:GetObject\",\"s3:DeleteObject\",\"s3:ListBucket\"],
      \"Resource\":[\"arn:aws:s3:::${S3_BUCKET}\",\"arn:aws:s3:::${S3_BUCKET}/*\"]
    }]
  }" 2>/dev/null || true
echo "  IAM roles configured"

# ── 5. AWS Secrets Manager ────────────────────────────────────
echo "▶ [5/7] Creating Secrets Manager placeholders..."
for SECRET in DATABASE_URL JWT_SECRET REFRESH_SECRET AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY S3_BUCKET_NAME CORS_ORIGIN; do
  aws secretsmanager create-secret \
    --name "${APP_NAME}/${ENV}/${SECRET}" \
    --description "BizAuto ${ENV} ${SECRET}" \
    --secret-string "PLACEHOLDER_CHANGE_ME" \
    --region "${AWS_REGION}" \
    2>/dev/null || echo "  Secret ${SECRET} already exists"
done
echo "  ⚠ Update secrets at: AWS Console → Secrets Manager → ${APP_NAME}/${ENV}/*"

# ── 6. RDS PostgreSQL ─────────────────────────────────────────
echo "▶ [6/7] Creating RDS PostgreSQL instance..."
echo "  (This takes ~5 minutes...)"
aws rds create-db-instance \
  --db-instance-identifier "${DB_IDENTIFIER}" \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username bizauto \
  --master-user-password "CHANGE_ME_STRONG_PASSWORD" \
  --db-name bizauto \
  --allocated-storage 20 \
  --storage-type gp3 \
  --storage-encrypted \
  --backup-retention-period 7 \
  --deletion-protection \
  --no-publicly-accessible \
  --region "${AWS_REGION}" \
  2>/dev/null || echo "  (Already exists or being created)"

echo "  ⚠ Update DATABASE_URL secret after RDS is available"

# ── 7. CloudWatch Log Group ───────────────────────────────────
echo "▶ [7/7] Creating CloudWatch log group..."
aws logs create-log-group \
  --log-group-name "/ecs/${APP_NAME}-api" \
  --region "${AWS_REGION}" \
  2>/dev/null || true
aws logs put-retention-policy \
  --log-group-name "/ecs/${APP_NAME}-api" \
  --retention-in-days 30 \
  2>/dev/null || true

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  Setup complete! Next steps:"
echo ""
echo "  1. Update secrets in Secrets Manager:"
echo "     aws secretsmanager update-secret \\"
echo "       --secret-id ${APP_NAME}/${ENV}/DATABASE_URL \\"
echo "       --secret-string 'postgresql://...'"
echo ""
echo "  2. Update aws/task-definition.json with:"
echo "     ACCOUNT_ID = ${ACCOUNT_ID}"
echo "     REGION     = ${AWS_REGION}"
echo ""
echo "  3. Register the task definition:"
echo "     aws ecs register-task-definition \\"
echo "       --cli-input-json file://aws/task-definition.json"
echo ""
echo "  4. Create ECS service (after registering task def)"
echo ""
echo "  5. Push your first image:"
echo "     ./scripts/deploy.sh"
echo "═══════════════════════════════════════════════"
