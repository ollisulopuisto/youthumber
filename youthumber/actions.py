"""Programmatic Actions & Tool Calling Engine for YouThumber.

Provides structured action definitions, OpenAPI/LLM tool calling schemas
(OpenAI and Anthropic compatible), and execution helpers to inspect and
manipulate thumbnail projects programmatically or via LLMs.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, Field

CANVAS_WIDTH = 1280
CANVAS_HEIGHT = 720
PROJECT_VERSION = 2

# Standard layout definitions matching src/modules/thumbnail/layouts.ts
LAYOUT_DEFINITIONS: dict[str, dict[str, Any]] = {
    "solo-centre": {
        "id": "solo-centre",
        "name": "Solo Centre",
        "speakerCount": 1,
        "description": "One speaker centred and large, headline across the top",
    },
    "side-by-side": {
        "id": "side-by-side",
        "name": "Dual Speaker Debate",
        "speakerCount": 2,
        "description": "Balanced side-by-side layout with bold centered headline",
    },
    "host-guest-spotlight": {
        "id": "host-guest-spotlight",
        "name": "Host & Guest Spotlight",
        "speakerCount": 2,
        "description": "Prominent guest on right, host on left with angled headline",
    },
    "dramatic-clash": {
        "id": "dramatic-clash",
        "name": "Dramatic Clash",
        "speakerCount": 2,
        "description": "Overlapping centered speakers with high-impact uppercase headline",
    },
    "panel-of-three": {
        "id": "panel-of-three",
        "name": "Panel of Three",
        "speakerCount": 3,
        "description": "Three speakers in equal thirds",
    },
    "panel-of-four": {
        "id": "panel-of-four",
        "name": "Panel of Four",
        "speakerCount": 4,
        "description": "Four speakers in equal quarters; neighbours overlap slightly",
    },
}

DEFAULT_LAYOUT_FOR_COUNT = {
    1: "solo-centre",
    2: "side-by-side",
    3: "panel-of-three",
    4: "panel-of-four",
}


def create_default_speaker(name: str, speaker_id: str | None = None) -> dict[str, Any]:
    sid = speaker_id or f"spk_{uuid.uuid4().hex[:7]}"
    return {
        "id": sid,
        "name": name,
        "sourceImageUrl": None,
        "sourceImageHash": None,
        "maskUrl": None,
        "objectsMaskUrl": None,
        "cutoutUrl": None,
        "isProcessing": False,
        "processingProgress": 0,
        "processingStatus": None,
        "error": None,
        "visible": True,
        "transform": {
            "x": CANVAS_WIDTH / 2,
            "y": 420,
            "scaleX": 1.0,
            "scaleY": 1.0,
            "rotation": 0.0,
            "flipX": False,
        },
        "removerId": None,
    }


def create_default_project(
    name: str = "Untitled Thumbnail", speaker_count: int = 2
) -> dict[str, Any]:
    count = max(1, min(4, int(speaker_count)))
    now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    layout_id = DEFAULT_LAYOUT_FOR_COUNT.get(count, "side-by-side")

    speakers = []
    default_names = ["Host", "Guest", "Guest 2", "Guest 3"]
    for i in range(count):
        speakers.append(create_default_speaker(default_names[i]))

    layer_order = ["background", "decor", *[s["id"] for s in speakers], "text"]

    return {
        "id": f"proj_{int(time.time() * 1000)}_{uuid.uuid4().hex[:5]}",
        "name": name,
        "createdAt": now,
        "updatedAt": now,
        "version": PROJECT_VERSION,
        "canvas": {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT},
        "background": {
            "type": "solid",
            "color": "#111827",
            "imageUrl": None,
            "gradient": None,
            "transform": {"x": 0, "y": 0, "scaleX": 1, "scaleY": 1},
        },
        "speakers": speakers,
        "layoutId": layout_id,
        "text": {
            "text": "EPISODE TITLE GOES HERE",
            "fontFamily": "Montserrat",
            "fontSize": 64,
            "fontWeight": "bold",
            "fontStyle": "normal",
            "textAlign": "center",
            "fillColor": "#FFFFFF",
            "strokeColor": "#000000",
            "strokeWidth": 4,
            "shadowColor": "rgba(0, 0, 0, 0.75)",
            "shadowBlur": 12,
            "shadowOffsetX": 3,
            "shadowOffsetY": 5,
            "transform": {"x": 640, "y": 110, "scaleX": 1, "scaleY": 1, "rotation": 0},
            "visible": True,
        },
        "decor": {"visible": True, "seed": 1, "elements": {}},
        "stickers": [],
        "textLayers": [],
        "bugs": [],
        "layerOrder": layer_order,
    }


# Action Definitions & Handlers


class ActionDef(BaseModel):
    name: str
    description: str
    category: str
    parameters: dict[str, Any]
    required: list[str] = Field(default_factory=list)


ACTION_REGISTRY: dict[str, ActionDef] = {}
ACTION_HANDLERS: dict[str, Callable[[dict[str, Any] | None, dict[str, Any]], Any]] = {}


def register_action(
    name: str,
    description: str,
    category: str,
    parameters: dict[str, Any],
    required: list[str] | None = None,
):
    def decorator(fn: Callable[[dict[str, Any] | None, dict[str, Any]], Any]):
        action_def = ActionDef(
            name=name,
            description=description,
            category=category,
            parameters=parameters,
            required=required or [],
        )
        ACTION_REGISTRY[name] = action_def
        ACTION_HANDLERS[name] = fn
        return fn

    return decorator


@register_action(
    name="create_project",
    description="Create a new thumbnail project with initial name and number of speakers.",
    category="project",
    parameters={
        "name": {
            "type": "string",
            "description": "Name or title for the project",
            "default": "Untitled Thumbnail",
        },
        "speaker_count": {
            "type": "integer",
            "description": "Number of speakers (1 to 4)",
            "default": 2,
            "minimum": 1,
            "maximum": 4,
        },
    },
)
def handle_create_project(
    project: dict[str, Any] | None, params: dict[str, Any]
) -> dict[str, Any]:
    name = params.get("name", "Untitled Thumbnail")
    count = params.get("speaker_count", 2)
    return create_default_project(name=name, speaker_count=count)


@register_action(
    name="set_headline",
    description="Update the main headline text, font, colors, and styling.",
    category="text",
    parameters={
        "text": {"type": "string", "description": "Headline text to display"},
        "fontFamily": {
            "type": "string",
            "description": "Font family (e.g. Montserrat, Anton, Bebas Neue)",
        },
        "fontSize": {"type": "number", "description": "Font size in pixels"},
        "fillColor": {
            "type": "string",
            "description": "Primary fill color (hex code like #FFFFFF)",
        },
        "strokeColor": {"type": "string", "description": "Outline stroke color"},
        "strokeWidth": {"type": "number", "description": "Outline stroke width in px"},
        "textAlign": {
            "type": "string",
            "enum": ["left", "center", "right"],
            "description": "Text alignment",
        },
    },
    required=["text"],
)
def handle_set_headline(
    project: dict[str, Any] | None, params: dict[str, Any]
) -> dict[str, Any]:
    proj = project or create_default_project()
    text_data = proj.setdefault("text", {})
    for key in [
        "text",
        "fontFamily",
        "fontSize",
        "fillColor",
        "strokeColor",
        "strokeWidth",
        "textAlign",
    ]:
        if key in params:
            text_data[key] = params[key]
    proj["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    return proj


@register_action(
    name="add_extra_text",
    description="Add an extra secondary text layer to the thumbnail.",
    category="text",
    parameters={
        "text": {"type": "string", "description": "Text content"},
        "fontSize": {
            "type": "number",
            "description": "Font size in pixels",
            "default": 48,
        },
        "fillColor": {
            "type": "string",
            "description": "Text color",
            "default": "#FFFFFF",
        },
        "fontFamily": {
            "type": "string",
            "description": "Font family",
            "default": "Montserrat",
        },
    },
    required=["text"],
)
def handle_add_extra_text(
    project: dict[str, Any] | None, params: dict[str, Any]
) -> dict[str, Any]:
    proj = project or create_default_project()
    text_layers = proj.setdefault("textLayers", [])
    layer_order = proj.setdefault("layerOrder", [])
    tid = f"txt_{uuid.uuid4().hex[:7]}"
    new_layer = {
        "id": tid,
        "text": params.get("text", "EXTRA TEXT"),
        "fontFamily": params.get("fontFamily", "Montserrat"),
        "fontSize": params.get("fontSize", 48),
        "fillColor": params.get("fillColor", "#FFFFFF"),
        "fontWeight": "bold",
        "textAlign": "center",
        "transform": {
            "x": CANVAS_WIDTH / 2,
            "y": CANVAS_HEIGHT * 0.82,
            "scaleX": 1.0,
            "scaleY": 1.0,
            "rotation": 0.0,
        },
        "visible": True,
    }
    text_layers.append(new_layer)
    layer_order.append(tid)
    proj["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    return proj


@register_action(
    name="set_speaker_name",
    description="Update the name of a speaker by speaker index (0-based) or speaker id.",
    category="speakers",
    parameters={
        "index": {
            "type": "integer",
            "description": "Speaker index (0 for first, 1 for second, etc.)",
        },
        "id": {"type": "string", "description": "Speaker ID (e.g. spk_...)"},
        "name": {"type": "string", "description": "Speaker name"},
    },
    required=["name"],
)
def handle_set_speaker_name(
    project: dict[str, Any] | None, params: dict[str, Any]
) -> dict[str, Any]:
    proj = project or create_default_project()
    speakers = proj.get("speakers", [])
    target = None
    if "id" in params:
        for s in speakers:
            if s.get("id") == params["id"]:
                target = s
                break
    if target is None and "index" in params:
        idx = int(params["index"])
        if 0 <= idx < len(speakers):
            target = speakers[idx]

    if target is None and speakers:
        target = speakers[0]

    if target:
        target["name"] = params["name"]
        proj["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    return proj


@register_action(
    name="set_speaker_count",
    description="Set the speaker count (1 to 4), adjusting layouts and default slots.",
    category="speakers",
    parameters={
        "count": {
            "type": "integer",
            "minimum": 1,
            "maximum": 4,
            "description": "Number of speakers (1-4)",
        }
    },
    required=["count"],
)
def handle_set_speaker_count(
    project: dict[str, Any] | None, params: dict[str, Any]
) -> dict[str, Any]:
    proj = project or create_default_project()
    target_count = max(1, min(4, int(params["count"])))
    current = proj.get("speakers", [])
    if len(current) == target_count:
        return proj

    kept = current[:target_count]
    default_names = ["Host", "Guest", "Guest 2", "Guest 3"]
    added = [
        create_default_speaker(default_names[len(kept) + i])
        for i in range(target_count - len(kept))
    ]
    speakers = kept + added
    proj["speakers"] = speakers
    proj["layoutId"] = DEFAULT_LAYOUT_FOR_COUNT.get(target_count, "side-by-side")

    removed_ids = {s.get("id") for s in current[target_count:]}
    order = [id_ for id_ in proj.get("layerOrder", []) if id_ not in removed_ids]
    if added:
        insert_at = order.index("text") if "text" in order else len(order)
        order = order[:insert_at] + [s["id"] for s in added] + order[insert_at:]
    proj["layerOrder"] = order
    proj["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    return proj


@register_action(
    name="set_layout",
    description="Select a thumbnail layout preset (e.g. side-by-side, dramatic-clash, solo-centre).",
    category="layout",
    parameters={
        "layout_id": {
            "type": "string",
            "enum": list(LAYOUT_DEFINITIONS.keys()),
            "description": "Identifier of the layout preset",
        }
    },
    required=["layout_id"],
)
def handle_set_layout(
    project: dict[str, Any] | None, params: dict[str, Any]
) -> dict[str, Any]:
    proj = project or create_default_project()
    lid = params["layout_id"]
    if lid in LAYOUT_DEFINITIONS:
        proj["layoutId"] = lid
        proj["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    return proj


@register_action(
    name="set_background_solid",
    description="Set solid background color.",
    category="background",
    parameters={
        "color": {
            "type": "string",
            "description": "Hex color code, e.g. #0F172A or #111827",
        }
    },
    required=["color"],
)
def handle_set_background_solid(
    project: dict[str, Any] | None, params: dict[str, Any]
) -> dict[str, Any]:
    proj = project or create_default_project()
    bg = proj.setdefault("background", {})
    bg["type"] = "solid"
    bg["color"] = params["color"]
    bg["gradient"] = None
    bg["imageUrl"] = None
    proj["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    return proj


@register_action(
    name="set_background_gradient",
    description="Set gradient background with two colors and angle.",
    category="background",
    parameters={
        "colors": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 2,
            "maxItems": 2,
            "description": "Two hex color codes for start and end of gradient",
        },
        "angle": {
            "type": "number",
            "default": 135,
            "description": "Angle in degrees (0-360)",
        },
    },
    required=["colors"],
)
def handle_set_background_gradient(
    project: dict[str, Any] | None, params: dict[str, Any]
) -> dict[str, Any]:
    proj = project or create_default_project()
    bg = proj.setdefault("background", {})
    bg["type"] = "gradient"
    bg["gradient"] = {
        "colors": params["colors"],
        "angle": params.get("angle", 135),
    }
    proj["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    return proj


@register_action(
    name="add_element",
    description="Add an element/sticker badge or decoration (e.g. vs-badge, on-air, speech, torn-paper).",
    category="decor",
    parameters={
        "elementId": {
            "type": "string",
            "description": "Identifier of the element (e.g. vs-badge, on-air, exclamation)",
        },
        "primaryColor": {
            "type": "string",
            "description": "Primary color hex",
            "default": "#FF1F1F",
        },
        "accentColor": {
            "type": "string",
            "description": "Accent color hex",
            "default": "#FFE600",
        },
        "text": {
            "type": "string",
            "description": "Custom label text for label elements (like VS or LIVE)",
        },
    },
    required=["elementId"],
)
def handle_add_element(
    project: dict[str, Any] | None, params: dict[str, Any]
) -> dict[str, Any]:
    proj = project or create_default_project()
    stickers = proj.setdefault("stickers", [])
    order = proj.setdefault("layerOrder", [])
    sid = f"stk_{uuid.uuid4().hex[:7]}"
    sticker = {
        "id": sid,
        "elementId": params["elementId"],
        "colors": {
            "primary": params.get("primaryColor", "#FF1F1F"),
            "accent": params.get("accentColor", "#FFE600"),
        },
        "lineWeight": 1.0,
        "outline": 0,
        "outlineColor": "#000000",
        "shadow": True,
        "opacity": 1.0,
        "visible": True,
        "x": CANVAS_WIDTH / 2,
        "y": CANVAS_HEIGHT / 2,
        "width": 120,
        "height": 120,
        "rotation": 0.0,
    }
    if "text" in params:
        sticker["text"] = params["text"]

    stickers.append(sticker)
    order.append(sid)
    proj["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    return proj


# Helper exporters for actions & LLM tools


def list_actions() -> list[dict[str, Any]]:
    """Return list of all registered actions with schemas."""
    return [action.model_dump() for action in ACTION_REGISTRY.values()]


def get_openai_tools() -> list[dict[str, Any]]:
    """Return OpenAI function calling tools format for all actions."""
    tools = []
    for action in ACTION_REGISTRY.values():
        tools.append(
            {
                "type": "function",
                "function": {
                    "name": action.name,
                    "description": action.description,
                    "parameters": {
                        "type": "object",
                        "properties": action.parameters,
                        "required": action.required,
                    },
                },
            }
        )
    return tools


def get_anthropic_tools() -> list[dict[str, Any]]:
    """Return Anthropic tool definitions format for all actions."""
    tools = []
    for action in ACTION_REGISTRY.values():
        tools.append(
            {
                "name": action.name,
                "description": action.description,
                "input_schema": {
                    "type": "object",
                    "properties": action.parameters,
                    "required": action.required,
                },
            }
        )
    return tools


def execute_action(
    action_name: str,
    params: dict[str, Any],
    project: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute a single action against a project state and return the updated project."""
    if action_name not in ACTION_HANDLERS:
        raise ValueError(
            f"Unknown action: '{action_name}'. Available: {list(ACTION_HANDLERS.keys())}"
        )
    handler = ACTION_HANDLERS[action_name]
    return handler(project, params)


def execute_batch(
    actions: list[dict[str, Any]],
    initial_project: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute a series of actions in sequence."""
    current_project = initial_project
    for step in actions:
        name = step.get("action") or step.get("name")
        if not name:
            raise ValueError(
                f"Action missing 'action' or 'name' field in batch step: {step}"
            )
        params = step.get("parameters") or step.get("params") or {}
        current_project = execute_action(name, params, current_project)
    return current_project or create_default_project()
