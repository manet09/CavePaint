import os
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from contextlib import contextmanager

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
    name = Column(String, unique=True, index=True)
    topic = Column(Text)
    research = Column(Text)
    script = Column(Text)
    video_concept = Column(Text)
    image_style = Column(Text)
    voice_style = Column(Text)
    status = Column(String, default="draft")  # "draft", "generating", "completed"

    scenes = relationship("Scene", back_populates="project")


class Scene(Base):
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    scene_number = Column(Integer)
    narration_khmer = Column(Text)
    image_prompt_english = Column(Text)
    user_refinement_prompt = Column(Text, nullable=True)
    audio_path = Column(String, nullable=True)
    image_path = Column(String, nullable=True)
    audio_status = Column(String, default="pending")  # "pending", "rendering", "completed", "failed"
    image_status = Column(String, default="pending")

    project = relationship("Project", back_populates="scenes")

# Create tables automatically on import
Base.metadata.create_all(bind=engine)

@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
