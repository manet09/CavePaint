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

    project = relationship("Project", back_populates="scenes")

# Create tables automatically on import
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
