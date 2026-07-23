#!/usr/bin/env bash
# =============================================================
# BizAuto — Manual AWS Deployment Script
# Usage: ./scripts/deploy.sh [ENVIRONMENT]
#   ENVIRONMENT: production (default) | staging
# =============================================================

set -euo pipefail

ENV="${1:-production}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
ECR_REGISTRY="${ECR_REGISTRY:?ECR_REGISTRY env var required}"
ECR_REPOSITORY="${ECR_REPOSITORY:-bizauto-api}"
ECS_CLUSTER="${ECS_CLUSTER:-bizauto-cluster}"
ECS_SERVICE="${ECS_SERVICE:-bizauto-api-service}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
FULL_IMAGE="${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"

echo ""
echo "═══════════════════════════════════════════"
echo "  BizAuto Deploy → ${ENV}"
echo "  Image : ${FULL_IMAGE}"
echo "  Region: ${AWS_REGION}"
echo "═══════════════════════════════════════════"
echo ""

# 1. Login to ECR
echo "▶ Logging in to Amazon ECR..."
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# 2. Build Docker image
echo "▶ Building Docker image..."
docker build \
  --platform linux/amd64 \
  --build-arg NODE_ENV=production \
  -t "${ECR_REPOSITORY}:${IMAGE_TAG}" \
  -t "${ECR_REPOSITORY}:latest" \
  .

# 3. Tag & push to ECR
echo "▶ Pushing to ECR..."
docker tag "${ECR_REPOSITORY}:${IMAGE_TAG}" "${FULL_IMAGE}"
docker tag "${ECR_REPOSITORY}:latest"       "${ECR_REGISTRY}/${ECR_REPOSITORY}:latest"
docker push "${FULL_IMAGE}"
docker push "${ECR_REGISTRY}/${ECR_REPOSITORY}:latest"

# 4. Update ECS service with new image
echo "▶ Updating ECS service..."
TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition bizauto-api \
  --query 'taskDefinition' \
  --output json)

NEW_TASK_DEF=$(echo "$TASK_DEF" | \
  python3 -c "
import json, sys
td = json.load(sys.stdin)
for c in td['containerDefinitions']:
    if c['name'] == 'bizauto-api':
        c['image'] = '${FULL_IMAGE}'
for k in ['taskDefinitionArn','revision','status','requiresAttributes','compatibilities','registeredAt','registeredBy']:
    td.pop(k, None)
print(json.dumps(td))
")

NEW_TD_ARN=$(aws ecs register-task-definition \
  --cli-input-json "$NEW_TASK_DEF" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

aws ecs update-service \
  --cluster   "$ECS_CLUSTER" \
  --service   "$ECS_SERVICE" \
  --task-definition "$NEW_TD_ARN" \
  --force-new-deployment

echo "▶ Waiting for service to stabilize..."
aws ecs wait services-stable \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE"

echo ""
echo "✅ Deployment complete!"
echo "   Image: ${FULL_IMAGE}"
echo ""
