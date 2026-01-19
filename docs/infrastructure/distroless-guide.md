# Distroless Images Guide

**Phase A - Task 19: Distroless Base Images + Non-Root**

## Overview

Distroless images are minimal container images that contain only the application and its runtime dependencies. They don't include package managers, shells, or other utilities found in standard Linux distributions.

### Benefits

1. **Security**: Reduced attack surface (no shell, no package managers)
2. **Size**: Smaller image sizes
3. **Compliance**: Easier to audit and meet security standards
4. **Performance**: Faster image pulls and container startup

### Trade-offs

1. **Debugging**: Cannot `exec` into containers (no shell)
2. **Healthchecks**: Docker HEALTHCHECK doesn't work (no shell)
3. **Complexity**: Build process is more complex
4. **Compatibility**: Some tools may not work without shell utilities

---

## ResearchFlow Distroless Implementation

### Available Dockerfiles

We maintain two sets of Dockerfiles:

1. **Standard** (`Dockerfile`): Alpine-based, includes shell, easier debugging
2. **Distroless** (`Dockerfile.distroless`): Production-hardened, minimal attack surface

### Service Images

#### Orchestrator (Node.js)
- **Base**: `gcr.io/distroless/nodejs20-debian12:nonroot`
- **User**: nonroot (UID 65532)
- **Size**: ~200MB (vs ~300MB for Alpine)
- **File**: `services/orchestrator/Dockerfile.distroless`

#### Worker (Python)
- **Base**: `gcr.io/distroless/python3-debian12:nonroot`
- **User**: nonroot (UID 65532)
- **Size**: ~250MB (vs ~400MB for Slim)
- **File**: `services/worker/Dockerfile.distroless`

#### Web (Nginx)
- **Base**: `nginx:alpine` (already minimal)
- **User**: nginx
- **Size**: ~40MB
- **Note**: Nginx Alpine is already quite minimal and well-maintained

---

## Building Distroless Images

### Local Build

```bash
# Build orchestrator distroless
docker build -f services/orchestrator/Dockerfile.distroless \
  -t researchflow/orchestrator:distroless \
  .

# Build worker distroless
docker build -f services/worker/Dockerfile.distroless \
  -t researchflow/worker:distroless \
  .

# Multi-arch build
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f services/orchestrator/Dockerfile.distroless \
  -t researchflow/orchestrator:distroless \
  .
```

### CI/CD Build

Set `USE_DISTROLESS=true` in GitHub Actions to use distroless images:

```yaml
env:
  USE_DISTROLESS: true
```

---

## Kubernetes Configuration

### Health Probes

Distroless images **require** HTTP-based health probes (no shell for exec probes):

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /readyz
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Volume Permissions

Distroless runs as UID 65532 (nonroot). Ensure volumes are writable:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 65532
  fsGroup: 65532
```

---

## Debugging Distroless Containers

Since distroless images have no shell, debugging requires different approaches:

### 1. Ephemeral Debug Containers (Kubernetes 1.23+)

```bash
# Attach a debug container with shell
kubectl debug -it pod-name \
  --image=busybox:1.36 \
  --target=orchestrator \
  -- sh

# View filesystem
kubectl debug -it pod-name \
  --image=busybox:1.36 \
  --share-processes \
  --copy-to=debug-pod \
  -- sh
```

### 2. Sidecar Debug Container

Add a debug sidecar temporarily:

```yaml
containers:
- name: orchestrator
  image: researchflow/orchestrator:distroless

- name: debug
  image: busybox:1.36
  command: ["sleep", "infinity"]
  volumeMounts:
  - name: shared-data
    mountPath: /data
```

### 3. Remote Debugging

Enable Node.js or Python remote debugging:

```yaml
env:
- name: NODE_OPTIONS
  value: "--inspect=0.0.0.0:9229"
```

Then port-forward and connect your IDE:

```bash
kubectl port-forward pod-name 9229:9229
```

### 4. Structured Logging

Always use structured logging (JSON) for observability:

```javascript
// Good: Structured logging
logger.info('Request processed', { userId: 123, duration: 45 });

// Bad: String concatenation
console.log('Request processed for user ' + userId);
```

---

## Testing Distroless Images

### Pre-deployment Checks

```bash
# 1. Verify image can start
docker run --rm researchflow/orchestrator:distroless

# 2. Check for shell (should fail)
docker run --rm researchflow/orchestrator:distroless /bin/sh
# Error: executable file not found (expected)

# 3. Verify health endpoints
docker run -d -p 3001:3001 researchflow/orchestrator:distroless
curl http://localhost:3001/healthz

# 4. Check image layers
dive researchflow/orchestrator:distroless
```

### Integration Tests

```bash
# Run integration tests with distroless images
docker-compose -f docker-compose.distroless.yml up -d
npm run test:integration
```

---

## Migration Strategy

### Phase 1: Staging (Week 1)
- Deploy distroless images to staging environment
- Monitor for issues (logs, health checks, performance)
- Test debugging procedures
- Document any compatibility issues

### Phase 2: Canary (Week 2)
- Deploy to 10% of production traffic
- Monitor error rates, latency, resource usage
- Gradually increase to 50%

### Phase 3: Full Rollout (Week 3)
- Deploy to all production traffic
- Keep standard images as rollback option
- Update documentation and runbooks

### Rollback Plan

If issues arise:

```bash
# Quick rollback to standard images
kubectl set image deployment/orchestrator \
  orchestrator=researchflow/orchestrator:latest

# Or use Argo Rollouts
kubectl argo rollouts abort orchestrator
```

---

## Security Scanning

Distroless images significantly reduce CVE counts:

```bash
# Scan standard image
trivy image researchflow/orchestrator:latest
# Typical: 20-50 vulnerabilities

# Scan distroless image
trivy image researchflow/orchestrator:distroless
# Typical: 0-5 vulnerabilities
```

---

## Best Practices

### ✅ DO

- Use HTTP health checks exclusively
- Enable structured logging
- Test thoroughly in staging
- Document debugging procedures
- Keep standard images as fallback
- Use ephemeral debug containers

### ❌ DON'T

- Use shell commands in CMD/ENTRYPOINT
- Rely on Docker HEALTHCHECK
- Try to exec into containers for debugging
- Install additional packages at runtime
- Use absolute paths without testing
- Forget to set proper file ownership

---

## Troubleshooting

### Issue: Container crashes immediately

**Cause**: Missing dependencies or incorrect CMD
**Solution**:
```bash
# Check what's included in the image
docker create --name=temp researchflow/orchestrator:distroless
docker export temp | tar -tv
docker rm temp
```

### Issue: Permission denied errors

**Cause**: Files not owned by nonroot user
**Solution**: Ensure all COPY commands use `--chown=nonroot:nonroot`

### Issue: Module not found

**Cause**: Incorrect PYTHONPATH or missing dependencies
**Solution**: Verify dependencies are copied from build stage

### Issue: Cannot connect to service

**Cause**: Application not binding to 0.0.0.0
**Solution**: Update app to listen on all interfaces:
```javascript
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on ${PORT}`);
});
```

---

## Resources

- [Google Distroless Images](https://github.com/GoogleContainerTools/distroless)
- [Kubernetes Debug Containers](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/)
- [NIST Container Security Guide](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-190.pdf)

---

## Support

For issues with distroless images:

1. Check this guide's troubleshooting section
2. Review logs: `kubectl logs pod-name`
3. Use debug containers for investigation
4. Contact DevOps team: #devops-support
5. Rollback if critical: Use standard images
