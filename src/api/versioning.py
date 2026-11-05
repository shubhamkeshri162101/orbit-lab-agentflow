"""Semantic version bumping for agents and workflows: major.minor.patch, each capped at 99."""
from __future__ import annotations

DEFAULT_VERSION = "1.0.0"


def bump_patch(version: str) -> str:
    major, minor, patch = (int(p) for p in version.split("."))
    patch += 1
    if patch > 99:
        patch = 0
        minor += 1
        if minor > 99:
            minor = 0
            major += 1
    return f"{major}.{minor}.{patch}"


def bump_major(version: str) -> str:
    major = int(version.split(".")[0])
    return f"{major + 1}.0.0"


def bump_minor(version: str) -> str:
    """Used for forking ('Make personal') a public resource -- unlike
    bump_patch, the patch digit is left untouched (1.0.1 -> 1.1.1)."""
    major, minor, patch = (int(p) for p in version.split("."))
    minor += 1
    if minor > 99:
        minor = 0
        major += 1
    return f"{major}.{minor}.{patch}"
