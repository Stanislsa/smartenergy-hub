FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt requirements-lstm.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir -r requirements-lstm.txt

COPY app/ ./app/
COPY tests/ ./tests/

EXPOSE 8085

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8085"]
