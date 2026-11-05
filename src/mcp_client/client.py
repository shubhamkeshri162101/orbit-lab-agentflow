"""Thin synchronous wrapper around the MCP Python SDK's stdio client.

Only the stdio transport is supported (a local command, e.g. `npx -y
some-mcp-server` or `python my_server.py`) — that covers the large majority
of real-world MCP servers and avoids the extra auth/session complexity of
SSE/HTTP transports for this prototype.
"""
from __future__ import annotations

import asyncio
import os
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


def _params(server: dict[str, Any]) -> StdioServerParameters:
    env = dict(server.get("env") or {})
    for var_name in server.get("env_passthrough") or []:
        if var_name in os.environ:
            env[var_name] = os.environ[var_name]
    return StdioServerParameters(
        command=server["command"],
        args=server.get("args") or [],
        env=env or None,
    )


async def _discover_tools_async(server: dict[str, Any]) -> list[dict[str, Any]]:
    async with stdio_client(_params(server)) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.list_tools()
            return [
                {
                    "name": t.name,
                    "description": t.description or "",
                    "input_schema": t.input_schema or {},
                }
                for t in result.tools
            ]


async def _call_tool_async(server: dict[str, Any], tool_name: str, arguments: dict[str, str]) -> str:
    async with stdio_client(_params(server)) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            texts = [c.text for c in result.content if getattr(c, "type", None) == "text"]
            return "\n".join(texts)


def discover_tools(server: dict[str, Any], timeout_seconds: int = 20) -> list[dict[str, Any]]:
    try:
        return asyncio.run(asyncio.wait_for(_discover_tools_async(server), timeout=timeout_seconds))
    except FileNotFoundError as e:
        raise RuntimeError(f"'{server['command']}' is not installed on this machine") from e
    except TimeoutError as e:
        raise RuntimeError(f"timed out connecting to MCP server after {timeout_seconds}s") from e
    except Exception as e:  # noqa: BLE001 - surfaced as a single readable API error
        raise RuntimeError(f"failed to connect to MCP server: {e}") from e


def call_tool(server: dict[str, Any], tool_name: str, arguments: dict[str, str], timeout_seconds: int = 20) -> str:
    try:
        return asyncio.run(asyncio.wait_for(_call_tool_async(server, tool_name, arguments), timeout=timeout_seconds))
    except FileNotFoundError as e:
        raise RuntimeError(f"'{server['command']}' is not installed on this machine") from e
    except TimeoutError as e:
        raise RuntimeError(f"timed out calling MCP tool after {timeout_seconds}s") from e
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"MCP tool call failed: {e}") from e
