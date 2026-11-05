from src.api.versioning import DEFAULT_VERSION, bump_major, bump_minor, bump_patch


def test_default_version():
    assert DEFAULT_VERSION == "1.0.0"


def test_bump_patch_simple():
    assert bump_patch("1.0.0") == "1.0.1"
    assert bump_patch("1.2.3") == "1.2.4"


def test_bump_patch_rolls_over_to_minor():
    assert bump_patch("1.0.99") == "1.1.0"


def test_bump_patch_rolls_over_to_major():
    assert bump_patch("1.99.99") == "2.0.0"


def test_bump_major_resets_minor_and_patch():
    assert bump_major("1.5.3") == "2.0.0"
    assert bump_major("4.0.0") == "5.0.0"


def test_bump_minor_leaves_patch_untouched():
    assert bump_minor("1.0.1") == "1.1.1"
    assert bump_minor("1.5.3") == "1.6.3"


def test_bump_minor_rolls_over_to_major():
    assert bump_minor("1.99.7") == "2.0.7"
