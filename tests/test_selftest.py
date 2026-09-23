"""`youthumber --self-test`: checks a build has everything it needs, without a model.

The first packaged app passed CI but couldn't cut anything out: the model's own code
imports kornia and torchvision's compiled ops, which PyInstaller never saw (2026-09-23).
"""

import importlib

from youthumber import selftest


def test_this_environment_passes() -> None:
    assert selftest.run() == []


def test_a_missing_module_the_model_needs_is_reported(monkeypatch) -> None:
    real_import = importlib.import_module

    def without_kornia(name, *args):
        if name.startswith("kornia"):
            raise ModuleNotFoundError("No module named 'kornia'")
        return real_import(name, *args)

    monkeypatch.setattr(selftest.importlib, "import_module", without_kornia)
    monkeypatch.setattr(selftest, "BACKEND", "torch")

    problems = selftest.run()

    assert any("kornia" in p for p in problems)


def test_main_exits_non_zero_on_problems(monkeypatch, capsys) -> None:
    monkeypatch.setattr(selftest, "run", lambda: ["kornia: missing"])

    assert selftest.main() == 1
    assert "kornia: missing" in capsys.readouterr().out
