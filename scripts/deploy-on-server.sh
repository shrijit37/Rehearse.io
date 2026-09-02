#!/usr/bin/env bash
#
# Deprecated: production deployments are managed by Dokploy.
# Configure Dokploy to track shrijit37/Rehearse.io, branch main, and
# docker-compose.yml. Dokploy handles source checkout, build, and rollout.
#
set -euo pipefail

cat >&2 <<'EOF'
Rehearse.io is deployed by Dokploy. Do not run scripts/deploy-on-server.sh.
EOF
exit 1
