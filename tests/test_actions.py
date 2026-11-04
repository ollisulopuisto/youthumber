"""Unit tests for youthumber.actions and LLM tool calling."""

import pytest

from youthumber.actions import (
    execute_action,
    execute_batch,
    get_anthropic_tools,
    get_openai_tools,
    list_actions,
)


def test_list_actions():
    actions = list_actions()
    assert len(actions) > 0
    names = [a["name"] for a in actions]
    assert "create_project" in names
    assert "set_headline" in names
    assert "add_extra_text" in names
    assert "set_speaker_name" in names
    assert "set_speaker_count" in names
    assert "set_layout" in names
    assert "set_background_solid" in names
    assert "set_background_gradient" in names
    assert "add_element" in names


def test_openai_and_anthropic_tools_format():
    oa_tools = get_openai_tools()
    assert len(oa_tools) > 0
    for tool in oa_tools:
        assert tool["type"] == "function"
        assert "function" in tool
        assert "name" in tool["function"]
        assert "parameters" in tool["function"]

    ant_tools = get_anthropic_tools()
    assert len(ant_tools) > 0
    for tool in ant_tools:
        assert "name" in tool
        assert "description" in tool
        assert "input_schema" in tool


def test_execute_create_project():
    proj = execute_action("create_project", {"name": "Test Ep", "speaker_count": 3})
    assert proj["name"] == "Test Ep"
    assert len(proj["speakers"]) == 3
    assert proj["layoutId"] == "panel-of-three"


def test_execute_set_headline():
    proj = execute_action(
        "set_headline", {"text": "MY NEW HEADLINE", "fillColor": "#FACC15"}
    )
    assert proj["text"]["text"] == "MY NEW HEADLINE"
    assert proj["text"]["fillColor"] == "#FACC15"


def test_execute_speaker_actions():
    proj = execute_action("create_project", {"speaker_count": 2})
    proj = execute_action("set_speaker_name", {"index": 0, "name": "Alice"}, proj)
    proj = execute_action("set_speaker_name", {"index": 1, "name": "Bob"}, proj)
    assert proj["speakers"][0]["name"] == "Alice"
    assert proj["speakers"][1]["name"] == "Bob"

    proj = execute_action("set_speaker_count", {"count": 1}, proj)
    assert len(proj["speakers"]) == 1
    assert proj["speakers"][0]["name"] == "Alice"


def test_execute_background_and_elements():
    proj = execute_action("set_background_solid", {"color": "#FF0000"})
    assert proj["background"]["type"] == "solid"
    assert proj["background"]["color"] == "#FF0000"

    proj = execute_action(
        "set_background_gradient", {"colors": ["#111111", "#444444"], "angle": 90}, proj
    )
    assert proj["background"]["type"] == "gradient"
    assert proj["background"]["gradient"]["colors"] == ["#111111", "#444444"]
    assert proj["background"]["gradient"]["angle"] == 90

    proj = execute_action("add_element", {"elementId": "vs-badge", "text": "VS"}, proj)
    assert len(proj["stickers"]) == 1
    assert proj["stickers"][0]["elementId"] == "vs-badge"
    assert proj["stickers"][0]["text"] == "VS"


def test_execute_unknown_action():
    with pytest.raises(ValueError, match="Unknown action"):
        execute_action("non_existent_action", {})


def test_execute_batch():
    actions = [
        {
            "action": "create_project",
            "params": {"name": "Batch Project", "speaker_count": 2},
        },
        {"action": "set_headline", "params": {"text": "Ep 100", "fontSize": 80}},
        {
            "action": "add_extra_text",
            "params": {"text": "Special Guest", "fontSize": 40},
        },
        {"action": "set_layout", "params": {"layout_id": "host-guest-spotlight"}},
    ]
    res = execute_batch(actions)
    assert res["name"] == "Batch Project"
    assert res["text"]["text"] == "Ep 100"
    assert res["text"]["fontSize"] == 80
    assert len(res["textLayers"]) == 1
    assert res["textLayers"][0]["text"] == "Special Guest"
    assert res["layoutId"] == "host-guest-spotlight"
