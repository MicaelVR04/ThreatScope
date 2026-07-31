import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import database


@pytest.fixture(autouse=True)
def isolated_sqlite_database(monkeypatch, tmp_path):
    """Keep unit tests offline and isolated from developer/production Supabase data."""
    monkeypatch.setattr(database, "SUPABASE_URL", "")
    monkeypatch.setattr(database, "SUPABASE_SERVICE_ROLE_KEY", "")
    monkeypatch.setattr(database, "SUPABASE_ACTIVE", False)
    monkeypatch.setattr(database, "DB_PATH", str(tmp_path / "threatscope-test.db"))
    database.init_db()
    yield
    database.SUPABASE_ACTIVE = False
