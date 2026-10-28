import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path("screenshots/android")
OUT.mkdir(parents=True, exist_ok=True)


def run(args):
    subprocess.check_call(args)


def shot(name):
    data = subprocess.check_output(["adb", "exec-out", "screencap", "-p"])
    (OUT / name).write_bytes(data)
    print("saved", name, len(data))


def dump():
    for _ in range(4):
        proc = subprocess.run(["adb", "shell", "uiautomator", "dump", "/sdcard/uidump.xml"], capture_output=True, text=True)
        if proc.returncode == 0 and "ERROR" not in (proc.stdout + proc.stderr):
            xml = subprocess.check_output(["adb", "exec-out", "cat", "/sdcard/uidump.xml"])
            if xml.strip().startswith(b"<"):
                return ET.fromstring(xml)
        time.sleep(1)
    return None


def tap(label):
    root = dump()
    if root is None:
        print("no ui dump for", label)
        return False
    for node in root.iter("node"):
        if node.attrib.get("text") == label:
            bounds = node.attrib.get("bounds", "")
            match = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
            if not match:
                continue
            x1, y1, x2, y2 = map(int, match.groups())
            run(["adb", "shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2)])
            return True
    print("missing", label)
    return False


run(["adb", "install", "-r", "apk/app-debug.apk"])
run(["adb", "shell", "am", "start", "-n", "cn.pawhope.app/.MainActivity"])
time.sleep(12)
shot("01-home.png")
for index, label in enumerate(["设备", "萌圈", "商城", "我的"], start=2):
    if tap(label):
        time.sleep(3)
        shot(f"{index:02d}-{label}.png")
