# Debian-based (not alpine): Google OR-Tools ships only manylinux/glibc wheels,
# so it cannot be pip-installed on alpine's musl libc.
FROM node:18-bookworm-slim

WORKDIR /app

# Python + OR-Tools for the CP-SAT solver sidecar. Installed into a venv so the
# image plays nicely with Debian's PEP 668 externally-managed environment.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

COPY solver/requirements.txt ./solver/requirements.txt
RUN pip install --no-cache-dir -r solver/requirements.txt

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build && npm prune --omit=dev

CMD ["npm", "start"]
