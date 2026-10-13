"""Agrega hashes sha256 de TODOS los artefactos PyPI a cada pin del lock."""
import json, re, sys, urllib.request

src = open("requirements.lock", encoding="utf-8").read().splitlines()
out = []
header = [
    "#",
    "# Lockfile con hashes (hallazgo 2.20) — generado con pip-compile y",
    "# completado con los digests sha256 de todos los artefactos de PyPI.",
    "# Regenerar tras cambiar requirements.txt:",
    "#   pip-compile requirements.txt -o requirements.lock",
    "#   python scripts/add_hashes.py   (o repetir la consulta a PyPI)",
    "# Instalar: pip install --require-hashes -r requirements.lock",
    "#",
]
pin_re = re.compile(r"^([A-Za-z0-9._-]+)==([A-Za-z0-9.+!_-]+)(\s*;.*)?$")
for line in src:
    m = pin_re.match(line.strip())
    if not m:
        # comentarios "# via ..." se descartan; se conserva el pin
        continue
    pkg, ver, marker = m.group(1), m.group(2), (m.group(3) or "").rstrip()
    # URL fija a pypi.org; pkg/ver provienen del lock generado por pip-compile
    with urllib.request.urlopen(f"https://pypi.org/pypi/{pkg}/{ver}/json") as r:  # nosec B310
        data = json.load(r)
    hashes = sorted({f["digests"]["sha256"] for f in data["urls"]})
    if not hashes:
        print(f"SIN ARTEFACTOS: {pkg}=={ver}", file=sys.stderr)
        sys.exit(1)
    out.append(f"{pkg}=={ver}{marker} \\")
    out.extend(f"    --hash=sha256:{h} \\" for h in hashes[:-1])
    out.append(f"    --hash=sha256:{hashes[-1]}")
with open("requirements.lock", "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(header + out) + "\n")
print(f"OK: {len(out) and sum(1 for l in out if not l.startswith(' '))} paquetes con hashes")
