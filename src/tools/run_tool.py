"""Executes a user-supplied function as a workflow step, in whichever of
Python/Java/C++ it was written in.

No sandboxing: this runs with the same OS privileges as the backend process,
on the machine the backend is running on. That's an accepted tradeoff for a
local prototype where the person writing the tool code and the person running
it are the same — it is not safe to expose to untrusted authors.

Contract (same across all three languages, mirrors run_agent's requires/writes
shape): the tool's `code` must define a `run` function/method taking a
string-to-string map of its declared `variables` and returning a single
string-like value, which becomes `output[writes_key]`. I/O between this
process and the tool subprocess is a trivial `name\\tvalue` line format so no
language needs a JSON library.
"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import Any

from src.agents.run_agent import MissingRequiredStateError
from src.mcp_client.client import call_tool as call_mcp_tool

PYTHON_TEMPLATE = """\
{code}

def _read_inputs():
    import sys
    inputs = {{}}
    for line in sys.stdin:
        line = line.rstrip("\\n")
        if not line:
            continue
        k, _, v = line.partition("\\t")
        inputs[k] = v
    return inputs


print(run(_read_inputs()))
"""

JAVA_TEMPLATE = """\
import java.util.*;
import java.io.*;

public class Tool {{
{code}

    public static void main(String[] args) throws Exception {{
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        Map<String,String> inputs = new LinkedHashMap<>();
        String line;
        while ((line = br.readLine()) != null) {{
            if (line.isEmpty()) continue;
            int i = line.indexOf('\\t');
            inputs.put(line.substring(0, i), line.substring(i + 1));
        }}
        System.out.println(run(inputs));
    }}
}}
"""

CPP_TEMPLATE = """\
#include <iostream>
#include <string>
#include <map>
#include <sstream>
#include <vector>
#include <algorithm>
using namespace std;

{code}

int main() {{
    map<string,string> inputs;
    string line;
    while (getline(cin, line)) {{
        if (line.empty()) continue;
        auto pos = line.find('\\t');
        inputs[line.substr(0, pos)] = line.substr(pos + 1);
    }}
    cout << run(inputs) << endl;
    return 0;
}}
"""


def _run_subprocess(cmd: list[str], stdin_text: str, timeout_seconds: int, cwd: str) -> str:
    try:
        result = subprocess.run(
            cmd,
            input=stdin_text,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            cwd=cwd,
        )
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(f"timed out after {timeout_seconds}s") from e
    except FileNotFoundError as e:
        raise RuntimeError(f"'{cmd[0]}' is not installed on this machine") from e
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"exited with code {result.returncode}")
    return result.stdout.strip()


def execute_code(language: str, code: str, inputs: dict[str, str], timeout_seconds: int) -> str:
    stdin_text = "".join(f"{k}\t{v}\n" for k, v in inputs.items())

    with tempfile.TemporaryDirectory() as tmpdir:
        if language == "python":
            src = Path(tmpdir) / "tool.py"
            src.write_text(PYTHON_TEMPLATE.format(code=code))
            return _run_subprocess(["python3", str(src)], stdin_text, timeout_seconds, tmpdir)

        if language == "java":
            src = Path(tmpdir) / "Tool.java"
            src.write_text(JAVA_TEMPLATE.format(code=code))
            try:
                compiled = subprocess.run(
                    ["javac", "Tool.java"], capture_output=True, text=True, cwd=tmpdir, timeout=timeout_seconds
                )
            except FileNotFoundError as e:
                raise RuntimeError("'javac' is not installed on this machine") from e
            if compiled.returncode != 0:
                raise RuntimeError(compiled.stderr.strip() or "javac compile failed")
            return _run_subprocess(["java", "-cp", tmpdir, "Tool"], stdin_text, timeout_seconds, tmpdir)

        if language == "cpp":
            src = Path(tmpdir) / "tool.cpp"
            binary = Path(tmpdir) / "tool_bin"
            src.write_text(CPP_TEMPLATE.format(code=code))
            try:
                compiled = subprocess.run(
                    ["g++", "-O2", "-std=c++17", "-o", str(binary), str(src)],
                    capture_output=True,
                    text=True,
                    timeout=timeout_seconds,
                )
            except FileNotFoundError as e:
                raise RuntimeError("'g++' is not installed on this machine") from e
            if compiled.returncode != 0:
                raise RuntimeError(compiled.stderr.strip() or "g++ compile failed")
            return _run_subprocess([str(binary)], stdin_text, timeout_seconds, tmpdir)

        raise ValueError(f"unsupported language: {language}")


def run_tool(tool: dict[str, Any], shared_state: dict[str, Any]) -> dict[str, Any]:
    variables = tool.get("variables", [])
    missing_keys = [
        v["name"] for v in variables if v["name"] not in shared_state and v.get("required", True)
    ]
    if missing_keys:
        raise MissingRequiredStateError(tool["name"], missing_keys)

    inputs = {v["name"]: shared_state.get(v["name"], v.get("default") or "") for v in variables}

    try:
        if tool.get("source") == "mcp":
            server = tool.get("mcp_server")
            if not server:
                raise RuntimeError("no MCP server configured for this tool")
            output_value = call_mcp_tool(server, tool["mcp_tool_name"], inputs, tool.get("timeout_seconds", 20))
        else:
            output_value = execute_code(tool["language"], tool["code"], inputs, tool.get("timeout_seconds", 10))
    except (RuntimeError, ValueError) as e:
        raise RuntimeError(f"tool '{tool['name']}' failed: {e}") from e

    writes_key = tool.get("writes") or tool["name"]
    return {"inputs": inputs, "output": {writes_key: output_value}}
