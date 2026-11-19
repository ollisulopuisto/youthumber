"""macOS menu bar (the mirror of the page's menu), tested with a fake AppKit."""

from __future__ import annotations

import json
import threading

import pytest

from youthumber import native_menu


@pytest.fixture(autouse=True)
def _fresh_module_state():
    native_menu._kept.update({"edit": [], "view": []})
    native_menu._target = None


class FakeItem:
    def __init__(self, title="", action=None, key="", separator=False):
        self._title, self._action, self._key = title, action, key
        self._separator = separator
        self._sub = None
        self._menu = None
        self.target = None
        self.represented = None
        self.enabled = True
        self.state = 0
        self.tag_value = 0

    @classmethod
    def alloc(cls):
        return cls()

    def initWithTitle_action_keyEquivalent_(self, title, action, key):
        self._title, self._action, self._key = title, action, key
        return self

    def init(self):
        return self

    @classmethod
    def separatorItem(cls):
        return cls(separator=True)

    def title(self):
        return self._title

    def setTitle_(self, title):
        self._title = title

    def action(self):
        return self._action

    def keyEquivalent(self):
        return self._key

    def isSeparatorItem(self):
        return self._separator

    def setSubmenu_(self, menu):
        self._sub = menu

    def submenu(self):
        return self._sub

    def menu(self):
        return self._menu

    def setTarget_(self, target):
        self.target = target

    def setRepresentedObject_(self, obj):
        self.represented = obj

    def representedObject(self):
        return self.represented

    def setEnabled_(self, flag):
        self.enabled = flag

    def setState_(self, state):
        self.state = state

    def setTag_(self, tag):
        self.tag_value = tag

    def tag(self):
        return self.tag_value


class FakeMenu:
    def __init__(self, title=""):
        self._title = title
        self.items: list[FakeItem] = []
        self.autoenables = True

    @classmethod
    def alloc(cls):
        return cls()

    def init(self):
        return self

    def initWithTitle_(self, title):
        self._title = title
        return self

    def setAutoenablesItems_(self, flag):
        self.autoenables = flag

    def addItem_(self, item):
        item._menu = self
        self.items.append(item)

    def insertItem_atIndex_(self, item, index):
        item._menu = self
        self.items.insert(index, item)

    def removeItem_(self, item):
        self.items.remove(item)
        item._menu = None

    def itemArray(self):
        return list(self.items)


class FakeApp:
    def __init__(self, main):
        self.main = main

    def mainMenu(self):
        return self.main


class FakeAppKit:
    NSMenu = FakeMenu
    NSMenuItem = FakeItem

    def __init__(self, main):
        self._app = FakeApp(main)

        outer = self

        class NSApplication:
            @staticmethod
            def sharedApplication():
                return outer._app

        self.NSApplication = NSApplication


def pywebview_menu():
    """What pywebview builds with no custom menu: app menu, Edit, View."""
    main = FakeMenu("main")
    for title, entries in (
        (
            "YouThumber",
            [("About YouThumber", "orderFrontStandardAboutPanel:"), ("Quit", "terminate:")],
        ),
        (
            "Edit",
            [
                ("Cut", "cut:"),
                ("Copy", "copy:"),
                ("Paste", "paste:"),
                ("Select All", "selectAll:"),
            ],
        ),
        ("View", [("Enter Full Screen", "toggleFullScreen:")]),
    ):
        top = FakeItem(title)
        sub = FakeMenu(title)
        for name, action in entries:
            sub.addItem_(FakeItem(name, action))
        top.setSubmenu_(sub)
        main.addItem_(top)
    return main


def item(id_, label=None, **extra):
    return {
        "kind": "item",
        "id": id_,
        "label": label or id_,
        "keys": "",
        "enabled": True,
        **extra,
    }


#: The same shape nativeMenu.ts builds from SHORTCUTS.
SPEC = [
    {
        "id": "file",
        "label": "File",
        "items": [
            item("projects", "Open projects", keys="⌘O"),
            item("save", "Save project", keys="⌘S"),
            item("export", "Export thumbnail", keys="⌘E"),
        ],
    },
    {
        "id": "edit",
        "label": "Edit",
        "items": [
            item("undo", "Undo", keys="⌘Z"),
            item("redo", "Redo", keys="⇧⌘Z"),
            {"kind": "separator"},
            item("edit.cut", "Cut", keys="⌘X"),
            item("edit.copy", "Copy", keys="⌘C"),
            item("edit.paste", "Paste", keys="⌘V"),
            item("edit.select_all", "Select All", keys="⌘A"),
        ],
    },
    {
        "id": "window",
        "label": "Window",
        "items": [
            item("window.minimize", "Minimize"),
            item("window.close", "Close Window"),
        ],
    },
    {
        "id": "help",
        "label": "Help",
        "items": [
            item("palette", "Find a command", keys="⌘K"),
            item("help", "Show keyboard shortcuts", keys="⇧?"),
        ],
    },
]


def run_install(main, spec=SPEC, runs=None, **kw):
    runs = runs if runs is not None else []
    made = {}

    def target_factory(run):
        made["target"] = type("T", (), {"run": staticmethod(run)})()
        return made["target"]

    ok = native_menu.install(
        spec,
        runs.append,
        platform="darwin",
        appkit=FakeAppKit(main),
        main_thread=lambda fn: fn(),
        target_factory=target_factory,
        **kw,
    )
    return ok, made.get("target"), runs


def titles(menu):
    return [i.title() for i in menu.items]


def test_normalize_spec_rejects_garbage_and_keeps_good_items():
    assert native_menu.normalize_spec(None) == []
    assert native_menu.normalize_spec("x") == []
    assert native_menu.normalize_spec([{"label": "A", "items": "no"}]) == []
    spec = native_menu.normalize_spec(
        [{"id": "a", "label": "A", "items": [item("x", "X"), {"kind": "bogus"}, 5]}]
    )
    assert [i["id"] for i in spec[0]["items"]] == ["x"]


def test_normalize_spec_caps_size_depth_and_text():
    many = [item(f"c{n}") for n in range(native_menu.MAX_ITEMS + 10)]
    spec = native_menu.normalize_spec([{"id": "a", "label": "A", "items": many}])
    assert len(spec[0]["items"]) == native_menu.MAX_ITEMS
    deep = {"kind": "submenu", "label": "1", "items": [item("leaf")]}
    for level in range(native_menu.MAX_DEPTH + 2):
        deep = {"kind": "submenu", "label": str(level), "items": [deep]}
    spec = native_menu.normalize_spec([{"id": "a", "label": "A", "items": [deep]}])
    assert "leaf" not in json.dumps(spec)
    long = native_menu.normalize_spec(
        [{"id": "a", "label": "L" * 500, "items": [item("x", "Y" * 500)]}]
    )
    assert len(long[0]["label"]) <= native_menu.MAX_LABEL
    assert len(long[0]["items"][0]["label"]) <= native_menu.MAX_LABEL


def test_off_macos_nothing_is_touched():
    ok = native_menu.install(
        SPEC, lambda _c: None, platform="linux", appkit=FakeAppKit(pywebview_menu())
    )
    assert ok is False


def test_the_menus_follow_the_app_menu_and_replace_pywebviews_edit_and_view():
    main = pywebview_menu()
    ok, _target, _runs = run_install(main)
    assert ok is True
    assert titles(main) == ["YouThumber", "File", "Edit", "Window", "Help"]


def test_the_native_clipboard_items_stay_pywebviews_and_ours_for_them_are_dropped():
    main = pywebview_menu()
    run_install(main)
    edit = main.items[2].submenu()
    assert [i.title() for i in edit.items if not i.isSeparatorItem()] == [
        "Undo" + native_menu.hint_suffix("⌘Z"),
        "Redo" + native_menu.hint_suffix("⇧⌘Z"),
        "Cut",
        "Copy",
        "Paste",
        "Select All",
    ]
    assert [
        i.action()
        for i in edit.items
        if i.title() in ("Cut", "Copy", "Paste", "Select All")
    ] == ["cut:", "copy:", "paste:", "selectAll:"]


def test_window_items_are_os_actions_with_real_key_equivalents():
    main = pywebview_menu()
    _ok, target, _runs = run_install(main)
    window = main.items[3].submenu()
    minimize, close = window.items
    assert minimize.action() == "miniaturize:"
    assert minimize.keyEquivalent() == "m"
    assert close.action() == "performClose:"
    assert close.keyEquivalent() == "w"
    # AppKit resolves them through the responder chain: no target, no payload.
    assert minimize.target is None
    assert minimize.representedObject() is None


def test_items_carry_the_command_to_run():
    main = pywebview_menu()
    _ok, target, runs = run_install(main)
    file_menu = main.items[1].submenu()
    save = file_menu.items[1]
    assert save.action() == "invoke:"
    assert save.target is target
    assert json.loads(save.representedObject()) == {"id": "save"}
    assert file_menu.autoenables is False
    assert runs == []


def test_choosing_an_item_hands_its_command_to_the_runner():
    main = pywebview_menu()
    _ok, target, runs = run_install(main)
    save = main.items[1].submenu().items[1]
    native_menu.dispatch(target, save)
    assert runs == [{"id": "save"}]


def test_a_second_install_replaces_the_first_and_keeps_the_native_items():
    main = pywebview_menu()
    run_install(main)
    run_install(main, spec=[SPEC[1]])
    assert titles(main) == ["YouThumber", "Edit"]
    edit = main.items[1].submenu()
    assert [i.title() for i in edit.items if i.action() in ("cut:", "copy:")]


def test_a_failed_draw_restores_pywebviews_menus():
    main = pywebview_menu()

    class BrokenAppKit(FakeAppKit):
        pass

    appkit = BrokenAppKit(main)

    class BreakingMenu(FakeMenu):
        def addItem_(self, item):
            raise RuntimeError("draw failed")

    appkit.NSMenu = BreakingMenu
    ok = native_menu.install(
        SPEC,
        lambda _c: None,
        platform="darwin",
        appkit=appkit,
        main_thread=lambda fn: fn(),
    )
    assert ok is False
    assert titles(main) == ["YouThumber", "Edit", "View"]
    edit = main.items[1].submenu()
    assert [i.title() for i in edit.items] == ["Cut", "Copy", "Paste", "Select All"]


def test_install_reports_the_drawn_result_not_the_queue():
    main = pywebview_menu()
    ok = native_menu.install(
        SPEC,
        lambda payload: None,
        platform="darwin",
        appkit=FakeAppKit(main),
        main_thread=lambda fn: threading.Thread(target=fn).start(),
        target_factory=lambda run: type("T", (), {"run": staticmethod(run)})(),
        draw_timeout=2.0,
    )
    assert ok is True
    assert any(i.title() == "File" for i in main.items)


def test_a_jammed_main_thread_reports_not_drawn():
    main = pywebview_menu()
    ok = native_menu.install(
        SPEC,
        lambda _c: None,
        platform="darwin",
        appkit=FakeAppKit(main),
        main_thread=lambda fn: None,  # never runs: the queue is jammed
        draw_timeout=0.05,
    )
    assert ok is False
    assert titles(main) == ["YouThumber", "Edit", "View"]


def test_gui_set_native_menu_installs_and_runs_commands_on_the_page(monkeypatch):
    """DesktopApi.set_native_menu draws the bar; a chosen item runs on the page."""
    from youthumber import gui

    calls = {}

    def fake_install(spec, run, **kw):
        calls["spec"] = spec
        calls["run"] = run
        return True

    monkeypatch.setattr(gui.native_menu, "install", fake_install)
    api = gui.DesktopApi()
    assert api.set_native_menu(SPEC) is True
    assert calls["spec"] == SPEC

    evaluated = []
    monkeypatch.setattr(api, "_evaluate_js", evaluated.append)
    calls["run"]({"id": "save"})
    assert evaluated == [
        'window.__youthumberNativeRun && window.__youthumberNativeRun("save")'
    ]


