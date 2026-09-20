FROM python:3.12-slim AS lean-toolchain
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl zstd \
    && rm -rf /var/lib/apt/lists/*
RUN test "$(uname -m)" = x86_64 \
    && curl -fL --retry 3 https://github.com/leanprover/lean4/releases/download/v4.19.0/lean-4.19.0-linux.tar.zst -o /tmp/lean.tar.zst \
    && mkdir /opt/lean && tar --zstd -xf /tmp/lean.tar.zst --strip-components=1 -C /opt/lean \
    && rm /tmp/lean.tar.zst \
    && /opt/lean/bin/lean --version | grep 'version 4.19.0'

FROM python:3.12-slim
COPY --from=lean-toolchain /opt/lean /opt/lean
WORKDIR /app
COPY compute.py server.py lean_job.py lean_check.py ./
RUN mkdir /data && chown 10001:10001 /data
USER 10001:10001
ENV EXPERIMENT_HOST=0.0.0.0 EXPERIMENT_DATA_DIR=/data PYTHONDONTWRITEBYTECODE=1 SWARM_LEAN_BIN=/opt/lean/bin/lean
# Fail deployment during build if the pinned compiler or shared audit is broken.
RUN python -c "from lean_check import check; assert check('(n : Nat) : n = n', 'by rfl', local_only=True)['verified']; assert not check(': False', 'by decide', local_only=True)['verified']"
CMD ["python", "server.py"]
