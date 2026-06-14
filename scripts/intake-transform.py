#!/usr/bin/env python3
"""
Portfolio Intake Transform (secondary routine) - v25
Owned by CTO-Hermes (THIAAAAAA-2794)

Handles secondary webhook intake for redundancy.
Multi-routine aware per THIAAAAAA-879.

Supports CLI arg, stdin, or no input.
"""

import sys
import json
from datetime import datetime

VERSION = "25"

def process_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object")
    if payload.get("_binding_probe"):
        print("Probe ping detected - would auto-cancel via transform.")
        return "cancelled"
    print(f"Processing OpCo payload: {payload.get('source', 'unknown')}")
    return "reassigned"

def main():
    ts = datetime.now().isoformat()
    print(f"intake-transform.py v{VERSION} (CTO-Hermes secondary routine) @ {ts}")
    payload_str = None
    if len(sys.argv) > 1:
        payload_str = sys.argv[1]
    elif not sys.stdin.isatty():
        payload_str = sys.stdin.read().strip()
    if payload_str:
        try:
            payload = json.loads(payload_str)
            result = process_payload(payload)
            print(json.dumps({"result": result}, indent=2))
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
    else:
        print("No pending payloads. Standing by for OpCo webhooks.")
    print("--- end of transform ---")

if __name__ == "__main__":
    main()
