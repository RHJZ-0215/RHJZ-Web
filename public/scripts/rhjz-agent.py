#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RHJZ 远程控制代理 (Remote Agent)
在被控电脑上运行，网页端即可实时发送命令、查看目录/文件、监控屏幕并操控。

用法:
    python rhjz-agent.py [--server https://rhjz-web.vercel.app]
                        [--id auto] [--interval 2]

功能（命令类型）:
    cmd / powershell   执行系统命令并返回输出
    directory          查看目录内容（返回文件/文件夹列表）
    drives             列出驱动器
    download           将本机文件上传到服务器，网页端生成下载链接
    execute            执行文件（双击打开）
    delete             删除文件或目录
    screenshot         截取屏幕并上传（需安装 PIL）
    mouse              鼠标控制（移动/点击/拖拽，需安装 pyautogui）
    keyboard           键盘输入（需安装 pyautogui）
    ping               连通性测试

可选依赖（缺失时对应功能降级，命令/目录/文件传输不受影响）:
    pip install pillow psutil pyautogui
"""
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import time
import uuid
import urllib.request
import urllib.parse

DEFAULT_SERVER = "https://rhjz-web.vercel.app"
INTERVAL = 2  # 轮询间隔（秒）

# ── 可选依赖探测 ──
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

try:
    import PIL.ImageGrab  # Windows 内置支持
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import pyautogui
    HAS_PYAUTOGUI = True
except ImportError:
    HAS_PYAUTOGUI = False


def get_id():
    """稳定客户端 ID：优先复用本机生成的文件，否则生成新 ID。"""
    id_path = os.path.join(os.path.expanduser("~"), ".rhjz_agent_id")
    if os.path.isfile(id_path):
        with open(id_path, "r") as f:
            cid = f.read().strip()
            if cid:
                return cid
    cid = "rhjz-" + uuid.uuid4().hex[:12]
    try:
        with open(id_path, "w") as f:
            f.write(cid)
    except Exception:
        pass
    return cid


def get_sysinfo():
    """采集系统信息用于注册。"""
    info = {
        "hostname": socket.gethostname(),
        "os": "%s %s" % (platform.system(), platform.release()),
        "username": os.environ.get("USERNAME") or os.environ.get("USER") or "unknown",
        "cpu": "未知",
        "ram": "未知",
    }
    if HAS_PSUTIL:
        try:
            info["cpu"] = "%s%% (%s cores)" % (
                psutil.cpu_percent(interval=0.5),
                psutil.cpu_count(logical=True),
            )
            mem = psutil.virtual_memory()
            info["ram"] = "%d%% (%d/%d GB)" % (
                mem.percent,
                mem.used // (1024 ** 3),
                mem.total // (1024 ** 3),
            )
        except Exception:
            pass
    return info


def http(url, method="GET", body=None, content_type=None, timeout=120):
    req = urllib.request.Request(url, method=method)
    if content_type:
        req.add_header("Content-Type", content_type)
    if body is not None:
        req.add_header("Content-Length", str(len(body)))
    try:
        with urllib.request.urlopen(req, data=body, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read()
        except Exception:
            return e.code, b""


def post_json(url, payload):
    status, raw = http(url, "POST", json.dumps(payload).encode(),
                       "application/json")
    try:
        return status, json.loads(raw.decode("utf-8", "replace"))
    except Exception:
        return status, {}


def build_multipart(file_path, file_field="file", extra=None):
    boundary = "----RHJZ" + uuid.uuid4().hex
    lines = []
    extra = extra or {}
    for key, value in extra.items():
        lines.append(("--%s" % boundary).encode())
        lines.append(('Content-Disposition: form-data; name="%s"' % key).encode())
        lines.append(b"")
        lines.append(str(value).encode())
    filename = os.path.basename(file_path)
    with open(file_path, "rb") as f:
        data = f.read()
    lines.append(("--%s" % boundary).encode())
    lines.append(('Content-Disposition: form-data; name="%s"; filename="%s"'
                   % (file_field, filename)).encode())
    lines.append(b"Content-Type: application/octet-stream")
    lines.append(b"")
    lines.append(data)
    lines.append(("--%s--" % boundary).encode())
    lines.append(b"")
    body = b"\r\n".join(lines)
    return body, "multipart/form-data; boundary=%s" % boundary


def api(server):
    return {
        "clients": server + "/api/admin/clients",
        "remote": server + "/api/admin/remote",
    }


def run_shell(command, use_powershell=False):
    """执行命令，返回 stdout+stderr 合并输出。Windows 输出为 GBK，需显式解码。"""
    try:
        if use_powershell:
            args = ["powershell", "-NoProfile", "-Command", command]
        else:
            args = ["cmd", "/c", command]
        enc = "gbk" if os.name == "nt" else "utf-8"
        proc = subprocess.run(
            args, capture_output=True, text=True, timeout=300,
            encoding=enc, errors="replace",
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        out = (proc.stdout or "").strip()
        err = (proc.stderr or "").strip()
        if out and err:
            return "标准输出:\n%s\n\n错误输出:\n%s" % (out, err)
        return out or err or "(命令执行完成，无输出，退出码 %d)" % proc.returncode
    except subprocess.TimeoutExpired:
        return "(命令执行超时 300s)"
    except Exception as e:
        return "(执行失败: %s)" % e


def list_drives():
    """列出驱动器。优先 psutil，其次标准库盘符探测，最后 wmic。"""
    drives = []
    if HAS_PSUTIL:
        try:
            drives = [p.mountpoint for p in psutil.disk_partitions()]
            if drives:
                return json.dumps({"drives": drives}, ensure_ascii=False)
        except Exception:
            pass
    if os.name == "nt":
        import string
        for letter in string.ascii_uppercase:
            root = letter + ":\\"
            if os.path.exists(root):
                drives.append(root)
        if drives:
            return json.dumps({"drives": drives}, ensure_ascii=False)
    try:
        proc = subprocess.run(
            ["wmic", "logicaldisk", "get", "name"],
            capture_output=True, text=True, timeout=10,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        drives = [line.strip() + "\\"
                  for line in (proc.stdout or "").splitlines()
                  if line.strip() and ":" in line and "Name" not in line]
        return json.dumps({"drives": drives}, ensure_ascii=False)
    except Exception:
        return json.dumps({"drives": []}, ensure_ascii=False)


def list_directory(path):
    """列出目录内容。返回 {items: [{name,path,type,size}]} JSON。"""
    if not path or path == ".":
        path = os.path.expanduser("~")
    try:
        entries = []
        for name in os.listdir(path):
            full = os.path.join(path, name)
            try:
                is_dir = os.path.isdir(full)
                size = 0 if is_dir else os.path.getsize(full)
                entries.append({
                    "name": name,
                    "path": full,
                    "type": "directory" if is_dir else "file",
                    "size": size,
                })
            except Exception:
                continue
        return json.dumps({"items": entries}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e), "items": []}, ensure_ascii=False)


def upload_file(server, client_id, file_path):
    """上传被控文件到服务器，返回 Blob pathname 供网页下载。"""
    if not os.path.isfile(file_path):
        return json.dumps({"error": "文件不存在: %s" % file_path})
    try:
        body, ctype = build_multipart(file_path)
        url = "%s?action=uploadAgentFile&id=%s" % (api(server)["clients"],
                                                    urllib.parse.quote(client_id))
        status, raw = http(url, "POST", body, ctype, timeout=600)
        try:
            result = json.loads(raw.decode("utf-8", "replace"))
        except Exception:
            result = {}
        if status == 200 and result.get("status") == "success":
            return json.dumps({"pathname": result.get("pathname", ""),
                               "size": os.path.getsize(file_path)})
        return json.dumps({"error": result.get("message", "上传失败")})
    except Exception as e:
        return json.dumps({"error": str(e)})


def take_screenshot(server, client_id, tmp_dir):
    """截图并上传。返回提示文本。"""
    if not HAS_PIL:
        return "(截图功能不可用：本机未安装 Pillow，请执行 pip install pillow)"
    try:
        img = PIL.ImageGrab.grab()
        shot = os.path.join(tmp_dir, "shot_%d.png" % int(time.time()))
        img.save(shot)
        body, ctype = build_multipart(shot, "screenshot")
        url = "%s?action=uploadScreenshot&id=%s" % (api(server)["clients"],
                                                     urllib.parse.quote(client_id))
        status, raw = http(url, "POST", body, ctype, timeout=300)
        os.remove(shot)
        return "(截图已上传, HTTP %d)" % status
    except Exception as e:
        return "(截图失败: %s)" % e


def handle_mouse(cmd_text):
    """鼠标控制: x|y|action (action: move/click/rightclick/doubleclick/drag)"""
    if not HAS_PYAUTOGUI:
        return "(鼠标控制不可用：未安装 pyautogui)"
    pyautogui.FAILSAFE = True
    try:
        parts = cmd_text.split("|")
        x = float(parts[0]); y = float(parts[1])
        action = parts[2] if len(parts) > 2 else "move"
        if action == "move":
            pyautogui.moveTo(x, y, duration=0.1)
        elif action == "click":
            pyautogui.click(x, y)
        elif action == "rightclick":
            pyautogui.rightClick(x, y)
        elif action == "doubleclick":
            pyautogui.doubleClick(x, y)
        elif action == "drag":
            pyautogui.dragTo(x, y, duration=0.3)
        else:
            pyautogui.moveTo(x, y, duration=0.1)
        return "(鼠标 %s → %s,%s)" % (action, x, y)
    except Exception as e:
        return "(鼠标操作失败: %s)" % e


def handle_keyboard(cmd_text):
    """键盘控制: key|action (action: press/type/hotkey)"""
    if not HAS_PYAUTOGUI:
        return "(键盘控制不可用：未安装 pyautogui)"
    try:
        key, _, action = cmd_text.partition("|")
        action = action or "press"
        if action == "type":
            pyautogui.typewrite(key, interval=0.02)
        elif action == "hotkey":
            parts = key.split("+")
            pyautogui.hotkey(*[p.strip().lower() for p in parts])
        else:
            pyautogui.press(key.lower())
        return "(按键 %s → %s)" % (action, key)
    except Exception as e:
        return "(键盘操作失败: %s)" % e


def execute_command(server, client_id, cmd, cmd_type, tmp_dir):
    """根据命令类型分发处理。"""
    if cmd_type in ("cmd", "powershell"):
        return run_shell(cmd, use_powershell=(cmd_type == "powershell"))
    if cmd_type == "ping":
        return "pong"
    if cmd_type == "drives":
        return list_drives()
    if cmd_type == "directory":
        return list_directory(cmd)
    if cmd_type == "download":
        return upload_file(server, client_id, cmd)
    if cmd_type == "execute":
        try:
            os.startfile(cmd)  # Windows
            return "(已执行: %s)" % cmd
        except Exception as e:
            return "(执行失败: %s)" % e
    if cmd_type == "delete":
        try:
            if os.path.isdir(cmd):
                shutil.rmtree(cmd)
            else:
                os.remove(cmd)
            return "(已删除: %s)" % cmd
        except Exception as e:
            return "(删除失败: %s)" % e
    if cmd_type == "screenshot":
        return take_screenshot(server, client_id, tmp_dir)
    if cmd_type == "mouse":
        return handle_mouse(cmd)
    if cmd_type == "keyboard":
        return handle_keyboard(cmd)
    return "(未知命令类型: %s)" % cmd_type


def main():
    import argparse
    parser = argparse.ArgumentParser(description="RHJZ 远程控制代理")
    parser.add_argument("--server", default=DEFAULT_SERVER,
                        help="服务器地址，默认 %s" % DEFAULT_SERVER)
    parser.add_argument("--id", default="auto", help="客户端ID，默认自动生成")
    parser.add_argument("--interval", type=float, default=INTERVAL,
                        help="轮询间隔秒数，默认 %s" % INTERVAL)
    args = parser.parse_args()

    server = args.server.rstrip("/")
    client_id = get_id() if args.id == "auto" else args.id
    tmp_dir = os.path.join(os.path.expanduser("~"), ".rhjz_agent_tmp")
    os.makedirs(tmp_dir, exist_ok=True)

    print("=" * 52)
    print("RHJZ 远程控制代理")
    print("  服务器 : %s" % server)
    print("  客户端 : %s" % client_id)
    print("  主机   : %s (%s)" % (socket.gethostname(), platform.system()))
    print("  能力   : 命令[%s] 截图[%s] 鼠标键盘[%s]" % (
        "✓", "✓" if HAS_PIL else "✗(pip install pillow)",
        "✓" if HAS_PYAUTOGUI else "✗(pip install pyautogui)"))
    print("  说明   : 保持本窗口运行即可，Ctrl+C 退出")
    print("=" * 52)

    urls = api(server)
    sysinfo = get_sysinfo()

    # 注册
    status, result = post_json(urls["clients"] + "?action=register", {
        "id": client_id, **sysinfo,
    })
    print("[注册] HTTP %d %s" % (status, result.get("message", "")))

    heartbeat_interval = max(5.0, args.interval * 2)
    last_heartbeat = 0
    running = True

    while running:
        try:
            now = time.time()
            # 心跳（独立于命令轮询）
            if now - last_heartbeat >= heartbeat_interval:
                post_json(urls["clients"] + "?action=heartbeat&id="
                          + urllib.parse.quote(client_id), {})
                last_heartbeat = now

            # 取命令
            status, data = http(urls["remote"]
                                + "?action=getCommand&clientId="
                                + urllib.parse.quote(client_id))
            if status != 200:
                time.sleep(args.interval)
                continue
            try:
                payload = json.loads(data.decode("utf-8", "replace"))
            except Exception:
                time.sleep(args.interval)
                continue

            command = payload.get("command")
            if not command:
                time.sleep(args.interval)
                continue

            cmd_id = command.get("id", "")
            cmd_text = command.get("command", "")
            cmd_type = command.get("type", "cmd")
            print("\n[命令] %s (%s): %s" % (cmd_id, cmd_type, cmd_text or "(空)"))

            output = execute_command(server, client_id, cmd_text, cmd_type, tmp_dir)
            print("[结果] %s" % (output[:200] + ("..." if len(output) > 200 else "")))

            post_json(urls["remote"] + "?action=reportResult&clientId="
                      + urllib.parse.quote(client_id),
                      {"commandId": cmd_id, "output": output})
        except KeyboardInterrupt:
            running = False
            print("\n已退出")
        except Exception as e:
            print("[错误] %s" % e)
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
