FROM chromium-builder:trixie-slim
USER root
RUN apt-get -y update && apt-get -y install quilt
USER builder
