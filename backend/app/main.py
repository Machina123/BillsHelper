import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .routers import recipients, batches, export, settings, import_recipients


app = FastAPI(title="BillsHelper")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recipients.router, prefix="/api")
app.include_router(import_recipients.router, prefix="/api")
app.include_router(batches.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(settings.router, prefix="/api")

static_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(static_dir, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))
