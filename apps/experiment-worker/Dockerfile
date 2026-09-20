FROM python:3.12-slim
WORKDIR /app
COPY compute.py server.py ./
RUN mkdir /data && chown 10001:10001 /data
USER 10001:10001
ENV EXPERIMENT_HOST=0.0.0.0 EXPERIMENT_DATA_DIR=/data PYTHONDONTWRITEBYTECODE=1
CMD ["python", "server.py"]
