"""Keep automated tests isolated from configured production services."""

import os
import tempfile
from pathlib import Path


TEST_DATABASE = Path(tempfile.gettempdir()) / "threatscope-tests.db"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE}"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
