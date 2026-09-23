"""Render example Compose files with dummy values only; never start containers."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="kutt-compose-") as tmp:
    folder = Path(tmp)
    secret = folder / "root-password"
    secret.write_text("test-only-root-password\n")
    secret.chmod(0o600)
    values = {
        "JWT_SECRET": "test-only-long-dummy-secret-not-for-deployment",
        "DEFAULT_DOMAIN": "fixture.example.invalid", "MAIL_ENABLED": "true",
        "DB_NAME": "fixture", "DB_USER": "fixture_user", "DB_PASSWORD": "test-only-password",
        "POSTGRES_IMAGE": "postgres:17-alpine", "MARIADB_IMAGE": "mariadb:11.4",
        "MARIADB_ROOT_PASSWORD_FILE": str(secret),
    }
    envfile = folder / ".env"
    envfile.write_text("".join(f"{key}={value}\n" for key, value in values.items()))
    envfile.chmod(0o600)
    env = {key: value for key, value in os.environ.items() if key in ("PATH", "HOME", "DOCKER_HOST", "DOCKER_CONTEXT")}
    for name in ("docker-compose.yml", "docker-compose.sqlite-redis.yml", "docker-compose.postgres.yml", "docker-compose.mariadb.yml"):
        command = ["docker", "compose", "--project-directory", tmp, "-f", str(root / name), "config", "--format", "json"]
        result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=30)
        assert result.returncode == 0, f"{name}: Compose render failed: {result.stderr}"
        config = json.loads(result.stdout)
        app = config["services"]["server"]
        assert app["ports"][0]["host_ip"] == "127.0.0.1"
        assert str(app["ports"][0]["published"]) == "3000"
        settings = app["environment"]
        assert settings["DEFAULT_DOMAIN"] == values["DEFAULT_DOMAIN"]
        assert settings["JWT_SECRET"] == values["JWT_SECRET"]
        assert settings["MAIL_ENABLED"] == "true"
        assert settings["TRUST_PROXY"] == "false"
        for service, spec in config["services"].items():
            if service != "server":
                assert not spec.get("ports"), "Database/cache must not be host-published"
        if "sqlite" in name or name == "docker-compose.yml":
            assert settings["DB_FILENAME"] == "/var/lib/kutt/data.sqlite"
            assert settings["DB_CLIENT"] == "better-sqlite3"
        else:
            for key in ("DB_NAME", "DB_USER", "DB_PASSWORD"):
                assert settings[key] == values[key]
        if "postgres" in name:
            pg = config["services"]["postgres"]
            assert "user" not in pg
            assert pg["environment"]["POSTGRES_USER"] == values["DB_USER"]
        if "mariadb" in name:
            maria = config["services"]["mariadb"]
            assert maria["environment"]["MARIADB_ROOT_PASSWORD_FILE"] == "/run/secrets/mariadb_root_password"
            assert "MARIADB_ROOT_PASSWORD" not in maria["environment"]
            assert maria["healthcheck"]["test"] == ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
            assert not app.get("secrets"), "Application must not receive database root secret"
        envfile.write_text("".join(f"{key}={value}\n" for key, value in values.items() if key != "JWT_SECRET"))
        refused = subprocess.run(command, env=env, capture_output=True, text=True, timeout=30)
        assert refused.returncode != 0, "Missing production JWT secret must fail before startup"
        envfile.write_text("".join(f"{key}={value}\n" for key, value in values.items()))
    print("PASS: all Compose examples render with private listener, real env propagation, matching SQL identities, separate MariaDB root secret and missing-JWT refusal")
