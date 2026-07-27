# Engine Dockerfile
# Builds the packet capture and detection container

FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /app

# Install system dependencies needed by Scapy
RUN apt-get update && apt-get install -y \
    libpcap-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy engine source code
COPY . .

# Run the capture engine
CMD ["python", "capture.py"]
