FROM python:3.11-slim

# Turn off bytecode generation and python stdout buffering
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy dependency definition file
COPY requirements.txt .

# Install requirements
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app appuser
RUN chown -R appuser:appgroup /app

# Set working directory to the app folder where main.py resides
WORKDIR /app/app

USER appuser

# Expose AI service port
EXPOSE 8000

# Execute the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
