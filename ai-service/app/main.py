from fastapi import FastAPI

app = FastAPI(
    title="Rehearse.io AI API",
    version="1.0.0"
)


@app.get("/")
def root():
    return {"message": "Welcome to Rehearse.io AI API 🚀"}
