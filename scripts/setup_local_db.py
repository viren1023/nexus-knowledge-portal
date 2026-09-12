"""
One-time local Postgres setup script.
Creates the nexus user and knowledge_portal database using the postgres superuser.
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

print("Connecting as postgres superuser...")
try:
    conn = psycopg2.connect(
        host='localhost', port=5432,
        user='postgres', password='root@123',
        dbname='postgres'
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    # Create nexus user
    cur.execute("SELECT 1 FROM pg_roles WHERE rolname='nexus'")
    if not cur.fetchone():
        cur.execute("CREATE USER nexus WITH PASSWORD 'nexus_password'")
        print("  [OK] Created user: nexus")
    else:
        cur.execute("ALTER USER nexus WITH PASSWORD 'nexus_password'")
        print("  [OK] User nexus already exists, password confirmed")

    # Create database
    cur.execute("SELECT 1 FROM pg_database WHERE datname='knowledge_portal'")
    if not cur.fetchone():
        cur.execute("CREATE DATABASE knowledge_portal OWNER nexus")
        print("  [OK] Created database: knowledge_portal")
    else:
        print("  [OK] Database knowledge_portal already exists")

    cur.execute("GRANT ALL PRIVILEGES ON DATABASE knowledge_portal TO nexus")
    print("  [OK] Granted DB privileges to nexus")
    cur.close()
    conn.close()

    # Connect to knowledge_portal as superuser to grant schema permissions
    print("\nGranting schema permissions...")
    conn2 = psycopg2.connect(
        host='localhost', port=5432,
        user='postgres', password='root@123',
        dbname='knowledge_portal'
    )
    conn2.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur2 = conn2.cursor()
    cur2.execute("GRANT USAGE ON SCHEMA public TO nexus")
    cur2.execute("GRANT CREATE ON SCHEMA public TO nexus")
    cur2.execute("ALTER SCHEMA public OWNER TO nexus")
    cur2.execute("GRANT ALL ON ALL TABLES IN SCHEMA public TO nexus")
    cur2.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO nexus")
    print("  [OK] Schema permissions granted")

    # Try pgvector
    print("\nAttempting to enable pgvector extension...")
    try:
        cur2.execute("CREATE EXTENSION IF NOT EXISTS vector")
        print("  [OK] pgvector extension enabled!")
        pgvector_available = True
    except Exception as e:
        print(f"  [SKIP] pgvector not available (embeddings disabled for local dev)")
        pgvector_available = False

    cur2.close()
    conn2.close()

    print("\n[DONE] Local Postgres setup complete!")
    print(f"  pgvector available: {pgvector_available}")
    print(f"  Connect with: postgresql://nexus:nexus_password@localhost:5432/knowledge_portal")

except Exception as e:
    print(f"\n[ERROR] Setup failed: {e}")
    raise
