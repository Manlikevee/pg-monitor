"""Open PostgreSQL connectivity check endpoint used by the PG Monitor app."""
from time import monotonic

import psycopg
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView


MAX_FIELD_LENGTH = 255
ALLOWED_SSL_MODES = {"disable", "prefer", "require", "verify-ca", "verify-full"}


def _error(code, http_status=status.HTTP_200_OK):
    # Never return psycopg's exception text: it may contain connection details.
    return Response(
        {
            "success": False,
            "latency_ms": None,
            "error_code": code,
            "checked_at": timezone.now().isoformat(),
        },
        status=http_status,
    )


def _bounded_text(value, *, allow_empty=False):
    if not isinstance(value, str):
        return None
    if len(value) > MAX_FIELD_LENGTH:
        return None
    if not allow_empty and not value.strip():
        return None
    return value


class CheckRateThrottle(AnonRateThrottle):
    rate = "20/minute"


class DatabaseCheckView(APIView):
    """Accept {"database": {...}} and execute a bounded SELECT 1 check.

    This endpoint is deliberately unauthenticated. Expose it only where intended.
    Set MONITOR_ALLOWED_DATABASE_HOSTS to a list of hostnames if the checker should
    only connect to known database hosts.
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [CheckRateThrottle]

    def post(self, request):
        payload = request.data
        database = payload.get("database") if isinstance(payload, dict) else None
        if not isinstance(database, dict):
            return _error("invalid_request", status.HTTP_400_BAD_REQUEST)

        host = _bounded_text(database.get("host"))
        dbname = _bounded_text(database.get("database_name"))
        user = _bounded_text(database.get("username"))
        password = _bounded_text(database.get("password"), allow_empty=True)
        sslmode = database.get("ssl_mode", "require")
        try:
            port = int(database.get("port", 5432))
        except (TypeError, ValueError):
            return _error("invalid_request", status.HTTP_400_BAD_REQUEST)

        if (
            host is None
            or dbname is None
            or user is None
            or password is None
            or not 1 <= port <= 65535
            or not isinstance(sslmode, str)
            or sslmode not in ALLOWED_SSL_MODES
            or "/" in host
        ):
            return _error("invalid_request", status.HTTP_400_BAD_REQUEST)

        # Optional host allowlist. Leave unset only when the endpoint's network
        # exposure is controlled elsewhere.
        allowed_hosts = getattr(settings, "MONITOR_ALLOWED_DATABASE_HOSTS", None)
        if allowed_hosts and host.lower() not in {item.lower() for item in allowed_hosts}:
            return _error("host_not_allowed", status.HTTP_400_BAD_REQUEST)

        started = monotonic()
        try:
            with psycopg.connect(
                host=host,
                port=port,
                dbname=dbname,
                user=user,
                password=password,
                sslmode=sslmode,
                connect_timeout=5,
                options="-c statement_timeout=4000",
            ) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    cursor.fetchone()
        except psycopg.OperationalError as exc:
            sqlstate = getattr(exc, "sqlstate", None) or ""
            if sqlstate.startswith("28"):
                code = "authentication_failed"
            elif sqlstate == "3D000":
                code = "database_not_found"
            else:
                code = "connection_failed"
            return _error(code)
        except psycopg.Error:
            return _error("connection_failed")

        return Response(
            {
                "success": True,
                "latency_ms": round((monotonic() - started) * 1000),
                "error_code": None,
                "checked_at": timezone.now().isoformat(),
            }
        )
