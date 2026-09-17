import os
import json
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace", "studio.db"))
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

SHARED_CHARACTERS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace", "shared_characters"))
os.makedirs(SHARED_CHARACTERS_DIR, exist_ok=True)

CUSTOM_VOICES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace", "custom_voices"))
os.makedirs(CUSTOM_VOICES_DIR, exist_ok=True)

class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    gender = Column(String)
    personality_tag = Column(String)
    audio_path = Column(String)
    reference_text = Column(String)

class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    active_provider = Column(String, default="gemini")
    active_slot = Column(Integer, default=1)
    image_provider = Column(String, default="local")  # "local" or "flow"

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    slug = Column(String, unique=True, index=True)
    raw_research = Column(Text, nullable=True)
    script_narrative = Column(Text, nullable=True)
    video_concept = Column(Text, nullable=True)
    illustration_style = Column(Text, nullable=True)
    global_voice_style = Column(Text, nullable=True)
    structured_json_data = Column(Text, nullable=True)
    status = Column(String, default="draft")  # "draft", "generating", "completed"
    master_audio_path = Column(String, nullable=True)
    voice_profile_tag = Column(String, nullable=True)
    audio_format = Column(String, default="wav")
    theme_era = Column(String, nullable=True)
    theme_mood = Column(String, nullable=True)
    theme_custom = Column(Text, nullable=True)
    aspect_ratio = Column(String, default="16:9")
    character_attire = Column(Text, nullable=True)
    scene_staging = Column(String, default="studio")
    flow_project_id = Column(String, nullable=True)

    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan")


class Scene(Base):
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    scene_number = Column(Integer)
    narration_khmer = Column(Text, nullable=True)
    image_prompt_english = Column(Text, nullable=True)
    negative_prompt = Column(Text, nullable=True)
    user_refinement_prompt = Column(Text, nullable=True)
    audio_path = Column(String, nullable=True)
    image_path = Column(String, nullable=True)
    images_list = Column(Text, default="[]")  # JSON string of relative paths
    reference_images = Column(Text, default="[]")  # JSON string of reference paths or Flow media UUIDs
    audio_status = Column(String, default="idle")  # "idle", "processing", "completed", "failed"
    image_status = Column(String, default="idle")
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=True)
    character_name = Column(String, nullable=True)

    project = relationship("Project", back_populates="scenes")
    character = relationship("Character")
    generations = relationship("Generation", back_populates="scene", cascade="all, delete-orphan")


class Generation(Base):
    __tablename__ = "generations"

    id = Column(Integer, primary_key=True, index=True)
    scene_id = Column(Integer, ForeignKey("scenes.id"), nullable=False)
    provider = Column(String, default="flow")  # "local", "flow", "upload"
    model = Column(String, nullable=True)  # e.g. "nano2", "nano-pro", "draw_things"
    aspect_ratio = Column(String, default="16:9")
    count = Column(Integer, default=1)
    prompt = Column(Text, nullable=True)
    refinement_instruction = Column(Text, nullable=True)
    reference_media_ids = Column(Text, default="[]")  # JSON list
    output_paths = Column(Text, default="[]")  # JSON list of relative paths
    flow_media_ids = Column(Text, default="[]")  # JSON list of Flow UUIDs
    status = Column(String, default="completed")  # "pending", "completed", "failed"

    scene = relationship("Scene", back_populates="generations")


# Create tables automatically on import
Base.metadata.create_all(bind=engine)

from sqlalchemy import text

# Automatic migration fallback
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN master_audio_path VARCHAR;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN voice_profile_tag VARCHAR;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN audio_format VARCHAR DEFAULT 'wav';"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN theme_era VARCHAR;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN theme_mood VARCHAR;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN theme_custom TEXT;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN aspect_ratio VARCHAR DEFAULT '16:9';"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN character_attire TEXT;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN scene_staging VARCHAR DEFAULT 'studio';"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE settings ADD COLUMN active_provider VARCHAR;"))
        conn.execute(text("ALTER TABLE settings ADD COLUMN active_slot INTEGER;"))
except Exception:
    pass


try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE scenes ADD COLUMN character_id INTEGER REFERENCES characters(id);"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE scenes ADD COLUMN character_name VARCHAR;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE settings ADD COLUMN image_provider VARCHAR DEFAULT 'local';"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN flow_project_id VARCHAR;"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE scenes ADD COLUMN images_list TEXT DEFAULT '[]';"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE scenes ADD COLUMN reference_images TEXT DEFAULT '[]';"))
except Exception:
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def sync_project_json(project_id: int, db):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return
    scenes = db.query(Scene).filter(Scene.project_id == project.id).order_by(Scene.scene_number).all()
    clean_json_array = []
    for s in scenes:
        clean_json_array.append({
            "scene_number": s.scene_number,
            "narration_khmer": s.narration_khmer,
            "image_prompt_english": s.image_prompt_english,
            "negative_prompt": s.negative_prompt,
            "image_path": s.image_path,
            "audio_path": s.audio_path,
            "character_id": s.character_id,
            "character_name": s.character_name
        })
    project.structured_json_data = json.dumps(clean_json_array, indent=2)
    db.commit()
