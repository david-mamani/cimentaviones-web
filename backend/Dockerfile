FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar calculos (motor de cálculos) y backend (servidor API)
COPY calculos/ ./calculos/
COPY backend/ ./backend/

# El server corre desde backend/ pero importa calculos/ del nivel superior
WORKDIR /app/backend

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
