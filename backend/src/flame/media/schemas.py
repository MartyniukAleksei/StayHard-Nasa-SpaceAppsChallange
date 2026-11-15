from pydantic import BaseModel, Field


class CameraOut(BaseModel):
    camera: str = Field(description="Camera letter in PSI file names (A, B, D)")
    label: str
    view: str
    psi_file: str = Field(description="Source archive in NASA PSI (PSI-69) — cite this")
    archive_mb: float


class CamerasOut(BaseModel):
    test_no: int
    cameras: list[CameraOut]


class FramesOut(BaseModel):
    test_no: int
    camera: str
    label: str
    psi_file: str
    n_frames: int
    start_time: str | None = Field(description="Onboard time of frame 0 (ISO), from the index")
    fps: float | None = Field(description="Mean frame rate from the frame index")
    t_ms: list[int | None] = Field(
        description="Milliseconds since frame 0 for each frame i. Not aligned to ignition (t_s "
        "in ts_* tables) yet."
    )
    frame_url: str = Field(description="URL template for one frame, {i} = frame index")
