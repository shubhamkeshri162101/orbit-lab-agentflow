import shutil
import subprocess

import pytest

from src.agents.run_agent import MissingRequiredStateError
from src.tools.run_tool import execute_code, run_tool


def _tool_actually_works(name: str, version_flag: str) -> bool:
    """shutil.which() isn't enough: macOS ships a `javac` stub on PATH that
    exists but fails at runtime if no JDK is installed."""
    if shutil.which(name) is None:
        return False
    try:
        result = subprocess.run([name, version_flag], capture_output=True, timeout=10)
        return result.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


HAS_JAVAC = _tool_actually_works("javac", "-version")
HAS_GPP = _tool_actually_works("g++", "--version")


def test_execute_code_python():
    code = 'def run(inputs):\n    return int(inputs["a"]) + int(inputs["b"])\n'
    assert execute_code("python", code, {"a": "2", "b": "3"}, 10) == "5"


def test_execute_code_python_timeout():
    code = "def run(inputs):\n    import time\n    time.sleep(5)\n    return 'done'\n"
    with pytest.raises(RuntimeError, match="timed out"):
        execute_code("python", code, {}, 1)


def test_execute_code_python_raises_on_bad_code():
    code = "def run(inputs):\n    raise ValueError('boom')\n"
    with pytest.raises(RuntimeError):
        execute_code("python", code, {}, 10)


@pytest.mark.skipif(not HAS_JAVAC, reason="javac not installed on this machine")
def test_execute_code_java():
    code = (
        "    static String run(java.util.Map<String,String> inputs) {\n"
        "        int a = Integer.parseInt(inputs.get(\"a\"));\n"
        "        int b = Integer.parseInt(inputs.get(\"b\"));\n"
        "        return String.valueOf(a + b);\n"
        "    }\n"
    )
    assert execute_code("java", code, {"a": "4", "b": "5"}, 20) == "9"


@pytest.mark.skipif(not HAS_GPP, reason="g++ not installed on this machine")
def test_execute_code_cpp():
    code = (
        "string run(map<string,string> inputs) {\n"
        '    int a = stoi(inputs["a"]);\n'
        '    int b = stoi(inputs["b"]);\n'
        "    return to_string(a + b);\n"
        "}\n"
    )
    assert execute_code("cpp", code, {"a": "6", "b": "7"}, 20) == "13"


def test_run_tool_raises_on_missing_required_variable():
    tool = {
        "name": "adder",
        "language": "python",
        "code": 'def run(inputs):\n    return inputs["a"]\n',
        "variables": [{"name": "a", "required": True}],
    }
    with pytest.raises(MissingRequiredStateError):
        run_tool(tool, {})


def test_run_tool_writes_to_declared_key():
    tool = {
        "name": "adder",
        "language": "python",
        "code": 'def run(inputs):\n    return int(inputs["a"]) + int(inputs["b"])\n',
        "variables": [{"name": "a", "required": True}, {"name": "b", "required": True}],
        "writes": "sum",
    }
    result = run_tool(tool, {"a": "2", "b": "3"})
    assert result == {"inputs": {"a": "2", "b": "3"}, "output": {"sum": "5"}}


def test_run_tool_defaults_writes_key_to_name():
    tool = {
        "name": "shout",
        "language": "python",
        "code": 'def run(inputs):\n    return inputs["text"].upper()\n',
        "variables": [{"name": "text", "required": True}],
        "writes": None,
    }
    result = run_tool(tool, {"text": "hi"})
    assert result["output"] == {"shout": "HI"}
