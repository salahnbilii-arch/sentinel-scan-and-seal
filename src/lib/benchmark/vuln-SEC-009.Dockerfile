FROM python:latest
WORKDIR /srv
USER app
CMD ["python", "main.py"]
