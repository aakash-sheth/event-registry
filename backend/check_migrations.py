#!/usr/bin/env python
"""
Script to check for missing Django migrations.
This can be run locally to identify what migrations need to be created.
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'registry_backend.settings')
os.environ.setdefault('DATABASE_URL', 'sqlite:///tmp/migration_check.db')
os.environ.setdefault('DJANGO_SECRET_KEY', 'dummy-for-migration-check')
os.environ.setdefault('DEBUG', 'False')

django.setup()

from django.core.management import call_command
from io import StringIO

def main():
    """Check for missing migrations"""
    print("🔍 Checking for missing Django migrations...")
    print("=" * 60)
    
    # Capture output
    out = StringIO()
    err = StringIO()
    
    try:
        # Run makemigrations --check --dry-run
        call_command('makemigrations', '--check', '--dry-run', stdout=out, stderr=err)
        print("✅ All migrations are up to date!")
        print(out.getvalue())
        return 0
    except SystemExit as e:
        if e.code == 1:
            print("❌ Missing migrations detected!")
            print("\n" + "=" * 60)
            print("STDOUT:")
            print("=" * 60)
            print(out.getvalue())
            if err.getvalue():
                print("\n" + "=" * 60)
                print("STDERR:")
                print("=" * 60)
                print(err.getvalue())
            print("\n" + "=" * 60)
            print("To generate the missing migrations, run:")
            print("  python manage.py makemigrations")
            return 1
        else:
            print(f"⚠️  Unexpected exit code: {e.code}")
            print(out.getvalue())
            print(err.getvalue())
            return e.code
    except Exception as e:
        print(f"❌ Error checking migrations: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
