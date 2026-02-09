FROM python:3.11-slim

WORKDIR /app

# Use CN mirrors to speed up builds on mainland servers.
# - apt: Aliyun mirror (works well on many Alibaba Cloud hosts)
# - pip: TUNA mirror
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple

# System deps
RUN set -eux; \
  if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
    sed -i 's@http://deb.debian.org/debian@http://mirrors.aliyun.com/debian@g' /etc/apt/sources.list.d/debian.sources; \
    sed -i 's@http://deb.debian.org/debian-security@http://mirrors.aliyun.com/debian-security@g' /etc/apt/sources.list.d/debian.sources; \
  elif [ -f /etc/apt/sources.list ]; then \
    sed -i 's@http://deb.debian.org/debian@http://mirrors.aliyun.com/debian@g' /etc/apt/sources.list; \
    sed -i 's@http://security.debian.org/debian-security@http://mirrors.aliyun.com/debian-security@g' /etc/apt/sources.list; \
  fi; \
  apt-get update; \
  apt-get install -y --no-install-recommends build-essential; \
  rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PORT=8000
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
