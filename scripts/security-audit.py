#!/usr/bin/env python3
"""
security-audit.py — static security auditor for Casa Origen.

Checks tailored to this repo's actual architecture (Next.js 15 App Router +
Prisma + shared-password admin), not a generic OWASP linter. Each check
encodes a real invariant from CLAUDE.md / docs/AI-ROLE.md so a violation
means the invariant broke, not that a pattern merely matched.

Usage:
    python3 scripts/security-audit.py [--json] [root]

Exit code: 1 if any HIGH severity finding, else 0.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

SEVERITY_ORDER = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, "INFO": 3}


@dataclass
class Finding:
    severity: str  # HIGH | MEDIUM | LOW | INFO
    check: str
    file: str
    line: int | None
    message: str


@dataclass
class Report:
    findings: list[Finding] = field(default_factory=list)

    def add(self, severity: str, check: str, file: str, line: int | None, message: str) -> None:
        self.findings.append(Finding(severity, check, file, line, message))

    def sorted(self) -> list[Finding]:
        return sorted(self.findings, key=lambda f: (SEVERITY_ORDER[f.severity], f.file, f.line or 0))


TEXT_EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
SKIP_DIRS = {"node_modules", ".next", ".git", "dist", "build", "coverage"}


def iter_source_files(root: Path, exts: set[str] | None = None) -> list[Path]:
    exts = exts or TEXT_EXTS
    out = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        if p.suffix in exts:
            out.append(p)
    return out


def read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def rel(root: Path, p: Path) -> str:
    try:
        return str(p.relative_to(root))
    except ValueError:
        return str(p)


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------

def check_env_files_tracked(root: Path, report: Report) -> None:
    """.env / .env.local / .env.production must never be committed."""
    try:
        out = subprocess.run(
            ["git", "-C", str(root), "ls-files"],
            capture_output=True, text=True, check=True,
        ).stdout.splitlines()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return

    for f in out:
        name = Path(f).name
        if name == ".env.example":
            continue
        if re.fullmatch(r"\.env(\.[\w.-]+)?", name):
            report.add("HIGH", "env-tracked", f, None,
                       "Archivo .env real trackeado en git — filtra credenciales al historial.")


def check_secrets_in_example(root: Path, report: Report) -> None:
    """.env.example should only carry placeholders, never a real-looking secret."""
    example = root / ".env.example"
    if not example.exists():
        return
    weak_placeholder = re.compile(r"^(change-me|changeme|example|your-|xxx|<)", re.IGNORECASE)
    for i, line in enumerate(read(example).splitlines(), 1):
        m = re.match(r"^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$", line.strip())
        if not m:
            continue
        key, val = m.groups()
        val = val.strip('"\'')
        if any(t in key for t in ("PASSWORD", "SECRET", "KEY", "TOKEN")) and val:
            if not weak_placeholder.search(val) and len(val) > 4:
                report.add("MEDIUM", "example-secret-looking-real",
                           ".env.example", i,
                           f"{key} en .env.example no parece un placeholder — confirmar que no es un secreto real.")


def check_hardcoded_secrets(root: Path, report: Report) -> None:
    """Look for likely credential literals inside source (not .env*)."""
    patterns = [
        (re.compile(r"""(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9+/_=\-]{16,}['"]"""), "posible secreto embebido"),
        (re.compile(r"""sk-[A-Za-z0-9]{20,}"""), "posible API key de OpenAI/Anthropic-style embebida"),
        (re.compile(r"""(?i)postgres(?:ql)?://[^:\s]+:[^@\s]+@"""), "connection string con credenciales embebidas"),
    ]
    for f in iter_source_files(root):
        if "test" in f.name.lower() or "spec" in f.name.lower():
            continue
        text = read(f)
        for i, line in enumerate(text.splitlines(), 1):
            if "process.env" in line or "env." in line and "config/env" in text[:200]:
                continue
            for pat, msg in patterns:
                if pat.search(line):
                    report.add("HIGH", "hardcoded-secret", rel(root, f), i, msg)


def check_prisma_outside_repositories(root: Path, report: Report) -> None:
    """Layer contract: only src/server/repositories/ may import the Prisma client runtime (CLAUDE.md).

    Type-only imports from '@prisma/client' (`import type { X }`) don't touch
    Prisma at runtime and are excluded. src/lib/db/prisma.ts is the client
    singleton itself and is exempt from restricting its own import.
    """
    allowed_dir = "src/server/repositories/"
    exempt_file = "src/lib/db/prisma.ts"
    runtime_import = re.compile(r"""^\s*import\s+(?!type\s)[^;]*from\s+['"](@/lib/db/prisma|@prisma/client)['"]""")
    for f in iter_source_files(root, {".ts", ".tsx"}):
        r = rel(root, f)
        if not r.startswith("src/") or r == exempt_file:
            continue
        if allowed_dir in r or r.startswith("prisma/"):
            continue
        for i, line in enumerate(read(f).splitlines(), 1):
            if runtime_import.search(line):
                report.add("HIGH", "prisma-layer-violation", r, i,
                           "Import runtime de Prisma fuera de src/server/repositories/ — rompe el contrato de capas "
                           "(CLAUDE.md: 'Prisma solo desde src/server/repositories/').")


def check_raw_sql(root: Path, report: Report) -> None:
    """$queryRawUnsafe/$executeRawUnsafe are injection-prone; $queryRaw is templated-safe but flag for review."""
    unsafe = re.compile(r"\$(query|execute)RawUnsafe")
    tagged = re.compile(r"\$(query|execute)Raw\b")
    for f in iter_source_files(root, {".ts", ".tsx"}):
        r = rel(root, f)
        for i, line in enumerate(read(f).splitlines(), 1):
            if unsafe.search(line):
                report.add("HIGH", "raw-sql-unsafe", r, i,
                           "queryRawUnsafe/executeRawUnsafe — concatenación puede ser SQL injection. Preferir Prisma Client o $queryRaw con template tag.")
            elif tagged.search(line):
                report.add("LOW", "raw-sql-tagged", r, i,
                           "$queryRaw/$executeRaw en uso — confirmar que es template tag, no string interpolado.")


def check_money_float(root: Path, report: Report) -> None:
    """Money must be integers, never float/Decimal (hard rule)."""
    decimal_pat = re.compile(r"\bDecimal\b")
    float_money_pat = re.compile(r"(?i)(price|amount|total|subtotal|delta)\w*\s*:\s*(number|float)\b")
    for f in iter_source_files(root, {".ts", ".tsx"}):
        r = rel(root, f)
        if "node_modules" in r or r.startswith(".next"):
            continue
        text = read(f)
        if "prisma/schema" in r:
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if decimal_pat.search(line) and "@/lib" in text[:500]:
                report.add("MEDIUM", "money-decimal", r, i,
                           "Uso de Decimal detectado — dinero debe ser entero (CLAUDE.md).")
    schema = root / "prisma" / "schema.prisma"
    if schema.exists():
        for i, line in enumerate(read(schema).splitlines(), 1):
            if re.search(r"(?i)(price|amount|total|delta)\w*\s+(Float|Decimal)\b", line):
                report.add("HIGH", "money-float-schema", "prisma/schema.prisma", i,
                            f"Campo de dinero como Float/Decimal en schema: {line.strip()}")


def check_client_price_trust(root: Path, report: Report) -> None:
    """Server actions that accept a raw numeric price field from the client (should recompute server-side)."""
    action_files = [f for f in iter_source_files(root, {".ts"}) if "src/server/actions" in rel(root, f)]
    price_field = re.compile(r"""(?i)\b(price|amount|total|subtotal)\s*:\s*z\.number\(\)""")
    for f in action_files:
        r = rel(root, f)
        for i, line in enumerate(read(f).splitlines(), 1):
            if price_field.search(line):
                report.add("HIGH", "client-supplied-price", r, i,
                           "Schema zod de action acepta precio/monto numérico del cliente — el precio debe venir SOLO de pricing.service.ts.")


def check_dangerously_set_inner_html(root: Path, report: Report) -> None:
    pat = re.compile(r"dangerouslySetInnerHTML")
    for f in iter_source_files(root, {".tsx", ".jsx"}):
        r = rel(root, f)
        text = read(f)
        for i, line in enumerate(text.splitlines(), 1):
            if pat.search(line):
                # Check nearby lines for escaping of '<' before JSON.stringify injection.
                window = "\n".join(text.splitlines()[max(0, i - 4):i])
                escaped = "\\u003c" in window or "replace(/</g" in window or "replace(/</" in window
                if escaped:
                    report.add("INFO", "dangerously-set-inner-html", r, i,
                                "dangerouslySetInnerHTML con escape de '<' visible cerca — probable JSON-LD seguro, confirmar igual.")
                else:
                    report.add("HIGH", "dangerously-set-inner-html", r, i,
                                "dangerouslySetInnerHTML SIN escape visible de '<' — riesgo de XSS si el contenido no es 100% confiable/estático.")


def check_eval_and_function_ctor(root: Path, report: Report) -> None:
    pat = re.compile(r"(?<![.\w])eval\s*\(|new\s+Function\s*\(")
    for f in iter_source_files(root):
        r = rel(root, f)
        for i, line in enumerate(read(f).splitlines(), 1):
            if pat.search(line):
                report.add("HIGH", "eval-usage", r, i, "eval()/Function() detectado — ejecución de código dinámico.")


def check_admin_password_comparison(root: Path, report: Report) -> None:
    """Admin password compared with === instead of constant-time compare → timing side-channel."""
    targets = [
        root / "src/lib/auth/admin-session.ts",
        root / "middleware.ts",
    ]
    for f in targets:
        if not f.exists():
            continue
        r = rel(root, f)
        text = read(f)
        for i, line in enumerate(text.splitlines(), 1):
            if "ADMIN_PASSWORD" in line and "===" in line:
                report.add("MEDIUM", "timing-unsafe-compare", r, i,
                           "Comparación de ADMIN_PASSWORD con === (no constant-time) — timing side-channel teórico. Usar crypto.timingSafeEqual.")
    # cookie stores the raw password, not a derived token
    session = root / "src/lib/auth/admin-session.ts"
    if session.exists() and "store.set(COOKIE_NAME, env.ADMIN_PASSWORD" in read(session):
        report.add("MEDIUM", "cookie-holds-raw-password", rel(root, session), None,
                    "Cookie admin_session guarda la password en texto plano (no un token derivado). "
                    "Si el cookie se filtra (XSS, log, backup), la password admin queda expuesta directamente. "
                    "httpOnly+secure+sameSite=strict mitigan pero no eliminan el riesgo.")


def check_console_log(root: Path, report: Report) -> None:
    pat = re.compile(r"\bconsole\.(log|debug|info|warn|error)\s*\(")
    for f in iter_source_files(root, {".ts", ".tsx"}):
        r = rel(root, f)
        if r.startswith("src/lib/logger"):
            continue
        for i, line in enumerate(read(f).splitlines(), 1):
            if pat.search(line):
                report.add("LOW", "console-log", r, i,
                            "console.* en vez de pino logger — no expone secretos por sí solo pero es lint error del proyecto y puede filtrar datos a stdout sin control de nivel.")


def check_any_and_non_null(root: Path, report: Report) -> None:
    any_pat = re.compile(r":\s*any\b")
    nonnull_pat = re.compile(r"[A-Za-z0-9_\)\]]\!(?=[.\s;,)\]]|$)")
    for f in iter_source_files(root, {".ts", ".tsx"}):
        r = rel(root, f)
        for i, line in enumerate(read(f).splitlines(), 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            if any_pat.search(line):
                report.add("LOW", "type-any", r, i, "Tipo `any` — apaga el chequeo de tipos, puede esconder validación faltante.")
            if nonnull_pat.search(line) and "!==" not in line and "!=" not in line.replace("!==", ""):
                report.add("LOW", "non-null-assertion", r, i, "Non-null assertion (`!`) — puede esconder un undefined no manejado.")


def check_hardcoded_colors(root: Path, report: Report) -> None:
    """Design contract: no hex/oklch/rgb() colors outside globals.css."""
    pat = re.compile(r"#[0-9a-fA-F]{3,8}\b|oklch\(|rgba?\(")
    for f in iter_source_files(root, {".tsx", ".ts"}):
        r = rel(root, f)
        if r.endswith("globals.css") or "globals.css" in r:
            continue
        if "components/ui" in r:
            continue  # shadcn primitives sometimes reference raw values in comments/config
        for i, line in enumerate(read(f).splitlines(), 1):
            if pat.search(line) and "className" in line:
                report.add("INFO", "hardcoded-color", r, i,
                            "Posible color hardcodeado fuera de globals.css — no es riesgo de seguridad, viola el sistema de diseño.")


def check_next_config_headers(root: Path, report: Report) -> None:
    cfg = root / "next.config.ts"
    if not cfg.exists():
        report.add("MEDIUM", "missing-security-headers", "next.config.ts", None,
                    "No se encontró next.config.ts — no se pudieron verificar headers de seguridad.")
        return
    text = read(cfg)
    required = ["X-Content-Type-Options", "X-Frame-Options", "Strict-Transport-Security", "Referrer-Policy"]
    for h in required:
        if h not in text:
            report.add("MEDIUM", "missing-security-header", "next.config.ts", None,
                        f"Falta header de seguridad: {h}")
    if "Content-Security-Policy" not in text:
        report.add("LOW", "missing-csp", "next.config.ts", None,
                    "No hay Content-Security-Policy explícito (comentario dice CSP estricto pero no está en headers()).")
    if "poweredByHeader: false" not in text:
        report.add("LOW", "powered-by-header", "next.config.ts", None,
                    "poweredByHeader no está en false — filtra que corre Next.js.")


def check_open_redirects(root: Path, report: Report) -> None:
    pat = re.compile(r"redirect\(\s*(?:req(?:uest)?\.(?:nextUrl\.searchParams|query)|searchParams\.get)")
    for f in iter_source_files(root, {".ts", ".tsx"}):
        r = rel(root, f)
        for i, line in enumerate(read(f).splitlines(), 1):
            if pat.search(line):
                report.add("MEDIUM", "open-redirect", r, i,
                            "redirect() usando valor de query/param sin whitelist — posible open redirect.")


def check_image_remote_patterns(root: Path, report: Report) -> None:
    cfg = root / "next.config.ts"
    if not cfg.exists():
        return
    text = read(cfg)
    if re.search(r"hostname:\s*['\"]\*\*['\"]", text) or re.search(r"hostname:\s*['\"]\*['\"]", text):
        report.add("MEDIUM", "wildcard-remote-image", "next.config.ts", None,
                    "images.remotePatterns con hostname comodín total — cualquier host externo puede servir imágenes.")


def check_env_var_direct_access(root: Path, report: Report) -> None:
    """Business/service code reading process.env directly instead of the validated src/config/env.ts."""
    pat = re.compile(r"process\.env\.[A-Z_]+")
    for f in iter_source_files(root, {".ts", ".tsx"}):
        r = rel(root, f)
        if r in ("src/config/env.ts",) or r == "middleware.ts" or r.startswith("prisma/") or "scripts/" in r:
            continue
        for i, line in enumerate(read(f).splitlines(), 1):
            if pat.search(line):
                report.add("LOW", "raw-process-env", r, i,
                            "process.env accedido directo, fuera de src/config/env.ts — pierde la validación zod (valor puede faltar o ser malformado).")


def check_npm_audit(root: Path, report: Report) -> None:
    if not (root / "package.json").exists():
        return
    try:
        proc = subprocess.run(
            ["npm", "audit", "--json"],
            cwd=root, capture_output=True, text=True, timeout=120,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        return
    try:
        data = json.loads(proc.stdout or "{}")
    except json.JSONDecodeError:
        return
    meta = data.get("metadata", {}).get("vulnerabilities", {})
    for level in ("critical", "high", "moderate"):
        n = meta.get(level, 0)
        if n:
            sev = "HIGH" if level in ("critical", "high") else "MEDIUM"
            report.add(sev, "npm-audit", "package.json", None,
                       f"npm audit: {n} vulnerabilidad(es) {level}. Ver PLAN.md — si son transitivas de next/sharp/postcss, ya evaluadas y aceptadas.")


def check_gitignore_covers_env(root: Path, report: Report) -> None:
    gi = root / ".gitignore"
    if not gi.exists():
        report.add("HIGH", "no-gitignore", ".gitignore", None, "No existe .gitignore — riesgo de trackear .env por accidente.")
        return
    text = read(gi)
    if not re.search(r"^\.env$", text, re.MULTILINE) and ".env" not in text:
        report.add("HIGH", "gitignore-missing-env", ".gitignore", None, ".gitignore no cubre .env")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

CHECKS = [
    check_env_files_tracked,
    check_gitignore_covers_env,
    check_secrets_in_example,
    check_hardcoded_secrets,
    check_prisma_outside_repositories,
    check_raw_sql,
    check_money_float,
    check_client_price_trust,
    check_dangerously_set_inner_html,
    check_eval_and_function_ctor,
    check_admin_password_comparison,
    check_console_log,
    check_any_and_non_null,
    check_hardcoded_colors,
    check_next_config_headers,
    check_open_redirects,
    check_image_remote_patterns,
    check_env_var_direct_access,
    check_npm_audit,
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Static security auditor for Casa Origen.")
    parser.add_argument("root", nargs="?", default=".", help="Repo root (default: cwd)")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of text")
    parser.add_argument("--min-severity", default="INFO", choices=list(SEVERITY_ORDER),
                         help="Only show findings at or above this severity")
    parser.add_argument("--skip-npm-audit", action="store_true", help="Skip the (slow) npm audit subprocess check")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.exists():
        print(f"error: root {root} does not exist", file=sys.stderr)
        return 2

    report = Report()
    checks = CHECKS if not args.skip_npm_audit else [c for c in CHECKS if c is not check_npm_audit]
    for check in checks:
        check(root, report)

    threshold = SEVERITY_ORDER[args.min_severity]
    findings = [f for f in report.sorted() if SEVERITY_ORDER[f.severity] <= threshold]

    if args.json:
        print(json.dumps([f.__dict__ for f in findings], indent=2, ensure_ascii=False))
    else:
        counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
        for f in findings:
            counts[f.severity] += 1
        print(f"Casa Origen — security audit ({root})\n")
        for f in findings:
            loc = f"{f.file}:{f.line}" if f.line else f.file
            print(f"[{f.severity:6}] {f.check:32} {loc}\n         {f.message}\n")
        print("-" * 70)
        print(f"HIGH={counts['HIGH']}  MEDIUM={counts['MEDIUM']}  LOW={counts['LOW']}  INFO={counts['INFO']}")
        print(f"Total: {len(findings)} hallazgos")

    return 1 if counts_high(findings) else 0


def counts_high(findings: list[Finding]) -> bool:
    return any(f.severity == "HIGH" for f in findings)


if __name__ == "__main__":
    sys.exit(main())
