import os
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
    audio_status = Column(String, default="idle")  # "idle", "processing", "completed", "failed"
    image_status = Column(String, default="idle")
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=True)
    character_name = Column(String, nullable=True)

    project = relationship("Project", back_populates="scenes")
    character = relationship("Character")

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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
