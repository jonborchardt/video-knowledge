"""Synthesise one sentence with edge-tts. stdin: {"text", "voice", "rate", "out"}; stdout: word boundaries as JSON
[{"text", "start", "end"}] in seconds. Driven by edge.ts; not meant to be run by hand."""

import asyncio
import json
import sys

import edge_tts


async def main() -> None:
    a = json.load(sys.stdin)
    c = edge_tts.Communicate(a["text"], a["voice"], rate=a["rate"], boundary="WordBoundary")
    words = []
    with open(a["out"], "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                start = ch["offset"] / 1e7
                words.append({"text": ch["text"], "start": start, "end": start + ch["duration"] / 1e7})
    json.dump(words, sys.stdout)


asyncio.run(main())
