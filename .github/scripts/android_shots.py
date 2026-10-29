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
    proc = subprocess.run(["adb", "shell", "uiautomator", "dump", "/sdcard/uidump.xml"], capture_output=True, text=True)
    if proc.returncode != 0 or "ERROR" in (proc.stdout + proc.stderr):
        return None
    xml = subprocess.check_output(["adb", "exec-out", "cat", "/sdcard/uidump.xml"])
    if not xml.strip().startswith(b"<"):
        return None
    return ET.fromstring(xml)


def wait_connected():
    deadline = time.time() + 50
    while time.time() < deadline:
        root = dump()
        if root is not None:
            for node in root.iter("node"):
                if (node.attrib.get("text") or "").startswith("已连接"):
                    return True
        time.sleep(2)
    print("home did not finish loading")
    return False


def tap(label):
    for _ in range(5):
        root = dump()
        if root is not None:
            for node in root.iter("node"):
                if node.attrib.get("text") == label:
                    bounds = node.attrib.get("bounds", "")
                    match = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
                    if not match:
                        continue
                    x1, y1, x2, y2 = map(int, match.groups())
                    run(["adb", "shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2)])
                    return True
        time.sleep(1)
    print("missing", label)
    return False


def start_api():
    log = open("/tmp/pawhope-api.log", "w", encoding="utf-8")
    proc = subprocess.Popen(["node", "server/index.js"], stdout=log, stderr=subprocess.STDOUT)
    for _ in range(30):
        probe = subprocess.run(["curl", "-sf", "http://127.0.0.1:3680/api/v1/bootstrap"], stdout=subprocess.DEVNULL)
        if probe.returncode == 0:
            print("local api ready", proc.pid)
            return
        if proc.poll() is not None:
            break
        time.sleep(1)
    log.flush()
    print(Path("/tmp/pawhope-api.log").read_text(encoding="utf-8", errors="replace")[-4000:])
    raise SystemExit("local api did not start")


start_api()
run(["adb", "install", "-r", "apk/app-debug.apk"])
run([
    "adb", "shell", "am", "start", "-n", "cn.pawhope.app/.MainActivity",
    "--es", "origin", "http://10.0.2.2:3680",
])
wait_connected()
time.sleep(2)
shot("01-home.png")
for index, label in enumerate(["设备", "萌圈", "商城", "我的"], start=2):
    if tap(label):
        time.sleep(3)
        shot(f"{index:02d}-{label}.png")
