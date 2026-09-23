#!/usr/bin/env python3
"""Generate the credential-free native template. Sign separately on macOS."""
import argparse
import json
from pathlib import Path
import plistlib
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--node', default='node')
parser.add_argument('--output', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
data = json.loads(subprocess.check_output([args.node, str(root / 'examples/ios-shortcut.cjs')], text=True))
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(plistlib.dumps(data, sort_keys=True))
print('Generated credential-free Shortcut template')
