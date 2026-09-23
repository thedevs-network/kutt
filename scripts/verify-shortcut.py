#!/usr/bin/env python3
"""Compare the reviewed source graph to the signed artifact without importing it."""
import argparse
import json
from pathlib import Path
import plistlib
import struct
import subprocess
import sys


def run(args, data=None):
    return subprocess.run(args, input=data, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, check=True, timeout=30).stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", default="node")
    args = parser.parse_args()
    if sys.platform != "darwin":
        raise SystemExit("Artifact graph verification requires macOS aea and aa.")
    root = Path(__file__).resolve().parents[1]
    artifact = root / "examples/Kutt-Shorten-URL.shortcut"
    blob = artifact.read_bytes()
    assert blob[:4] == b"AEA1" and len(blob) < 1000000
    size = struct.unpack("<I", blob[8:12])[0]
    assert 0 < size < len(blob) - 12
    cert = plistlib.loads(blob[12:12 + size])["SigningCertificateChain"][0]
    pub = run(["/usr/bin/openssl", "x509", "-inform", "DER", "-pubkey", "-noout"], cert)
    key = run(["/usr/bin/openssl", "pkey", "-pubin", "-outform", "DER"], pub)
    assert key[:-65].hex() == "3059301306072a8648ce3d020106082a8648ce3d030107034200"
    # This validates the container against its embedded signing key, not the
    # Apple certificate trust chain. Git review and pinned SHA-256 remain gates.
    archive = run(["/usr/bin/aea", "decrypt", "-i", str(artifact),
                   "-sign-pub-value", "hex:" + key[-65:].hex()])
    listing = json.loads(run(["/usr/bin/aa", "list", "-list-format", "json"], archive))
    assert [(x["TYP"], x["PAT"]) for x in listing] == [("D", ""), ("F", "Shortcut.wflow")]
    assert archive[:4] == b"AA01"
    second = struct.unpack("<H", archive[4:6])[0]
    assert archive[second:second + 4] == b"AA01"
    start = second + struct.unpack("<H", archive[second + 4:second + 6])[0]
    assert archive[start - 6:start - 2] == b"DATA"
    length = struct.unpack("<H", archive[start - 2:start])[0]
    assert length == listing[1]["DAT"] and start + length == len(archive)
    actual = plistlib.loads(archive[start:])
    expected = json.loads(run([args.node, str(root / "examples/ios-shortcut.cjs")]))
    # Signing changes editor metadata, never actions or import questions.
    assert isinstance(actual.get("WFWorkflowClientVersion"), str)
    assert actual.get("WFWorkflowName", expected.get("WFWorkflowName")) == expected.get("WFWorkflowName")
    for value in (actual, expected):
        value.pop("WFWorkflowClientVersion", None)
        value.pop("WFWorkflowName", None)
    assert actual == expected, "Signed Shortcut differs from the reviewed action graph"
    print("PASS: signed Shortcut action graph and import questions match source; no import, execution or Keychain access")


if __name__ == "__main__":
    main()
