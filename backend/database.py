import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from config import DATABASE_URL
except ModuleNotFoundError:
    from backend.config import DATABASE_URL


# check_same_thread=False is needed only for SQLite
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
