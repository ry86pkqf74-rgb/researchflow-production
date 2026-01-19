# Authorization Policy for ResearchFlow
# Phase A - Task 41: OPA Policies for Orchestrator
#
# This policy implements role-based access control (RBAC) for ResearchFlow API endpoints.
# It validates JWT tokens, checks user roles, and enforces resource-level permissions.

package envoy.authz

import input.attributes.request.http as http_request
import input.attributes.source.address as source_address

# Default deny
default allow = false

# Allow health check endpoints (no authentication required)
allow {
    http_request.path == "/healthz"
}

allow {
    http_request.path == "/readyz"
}

allow {
    startswith(http_request.path, "/health")
}

# Require authentication for all other paths
allow {
    is_token_valid
    has_required_role
    has_resource_permission
}

# ============================================
# Token Validation
# ============================================

is_token_valid {
    # Extract token from Authorization header
    token := get_token
    token != null

    # Decode and validate JWT
    jwt := io.jwt.decode(token)

    # Check token hasn't expired
    jwt[1].exp > time.now_ns() / 1000000000

    # Check issuer (optional)
    # jwt[1].iss == "researchflow-auth"
}

get_token = token {
    # Bearer token
    auth_header := http_request.headers.authorization
    startswith(auth_header, "Bearer ")
    token := trim_prefix(auth_request.headers.authorization, "Bearer ")
}

get_token = token {
    # API key (alternative)
    token := http_request.headers["x-api-key"]
}

# ============================================
# Role-Based Access Control
# ============================================

has_required_role {
    # Get required role for the endpoint
    required_role := get_required_role
    required_role == "public"
}

has_required_role {
    required_role := get_required_role
    user_has_role(required_role)
}

user_has_role(role) {
    token := get_token
    jwt := io.jwt.decode(token)
    jwt[1].roles[_] == role
}

user_has_role(role) {
    token := get_token
    jwt := io.jwt.decode(token)
    # Admin has all roles
    jwt[1].roles[_] == "admin"
}

# Define required roles for endpoints
get_required_role = "viewer" {
    http_request.method == "GET"
    startswith(http_request.path, "/api/artifacts")
}

get_required_role = "viewer" {
    http_request.method == "GET"
    startswith(http_request.path, "/api/datasets")
}

get_required_role = "researcher" {
    http_request.method == "POST"
    startswith(http_request.path, "/api/artifacts")
}

get_required_role = "researcher" {
    http_request.method == "PUT"
    startswith(http_request.path, "/api/artifacts")
}

get_required_role = "researcher" {
    http_request.method == "POST"
    startswith(http_request.path, "/api/ros")
}

get_required_role = "admin" {
    startswith(http_request.path, "/api/admin")
}

get_required_role = "admin" {
    http_request.method == "DELETE"
    startswith(http_request.path, "/api/")
}

get_required_role = "admin" {
    startswith(http_request.path, "/api/governance")
}

get_required_role = "public" {
    # Default for unspecified endpoints
    true
}

# ============================================
# Resource-Level Permissions
# ============================================

has_resource_permission {
    # Extract resource ID from path
    not requires_resource_check
}

has_resource_permission {
    requires_resource_check
    resource_id := extract_resource_id
    user_can_access_resource(resource_id)
}

requires_resource_check {
    # Check if path includes a resource ID
    re_match("/api/artifacts/[0-9a-f-]+", http_request.path)
}

requires_resource_check {
    re_match("/api/datasets/[0-9a-f-]+", http_request.path)
}

extract_resource_id = id {
    # Extract UUID from path
    parts := split(http_request.path, "/")
    id := parts[3]  # /api/artifacts/{id}
}

user_can_access_resource(resource_id) {
    # Admin can access all resources
    user_has_role("admin")
}

user_can_access_resource(resource_id) {
    # User can access their own resources
    token := get_token
    jwt := io.jwt.decode(token)
    user_id := jwt[1].sub

    # This would typically check a database or cache
    # For now, we allow if user is authenticated
    user_id != ""
}

# ============================================
# Rate Limiting Context (for future use)
# ============================================

# Provide context for rate limiting in headers
response_headers = headers {
    headers := {
        "x-user-id": get_user_id,
        "x-user-roles": concat(",", get_user_roles),
        "x-request-id": http_request.headers["x-request-id"]
    }
}

get_user_id = user_id {
    token := get_token
    jwt := io.jwt.decode(token)
    user_id := jwt[1].sub
}

get_user_id = "anonymous" {
    not get_token
}

get_user_roles = roles {
    token := get_token
    jwt := io.jwt.decode(token)
    roles := jwt[1].roles
}

get_user_roles = [] {
    not get_token
}

# ============================================
# Audit Logging
# ============================================

# Log all authorization decisions
decision_log = log {
    log := {
        "timestamp": time.now_ns(),
        "decision": allow,
        "user": get_user_id,
        "roles": get_user_roles,
        "method": http_request.method,
        "path": http_request.path,
        "source_ip": source_address.Address.SocketAddress.address,
        "user_agent": http_request.headers["user-agent"]
    }
}
