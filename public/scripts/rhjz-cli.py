#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
RHJZ 文件服务器命令行客户端（纯标准库，无第三方依赖）

用法:
    python rhjz-cli.py Uploadfile:D:\path\to\file
    python rhjz-cli.py Downloadfilename:remote.txt,file:D:\local\dir

可选参数:
    --server https://rhjz-web.vercel.app   服务器地址（默认线上）
    --help                                  显示帮助

说明:
    Uploadfile     将本机文件上传到服务器的「文件下载列表」
    Downloadfilename 从下载列表按文件名下载到本机指定目录
"""
import json
import os
import sys
import uuid
import urllib.request
import urllib.parse

DEFAULT_SERVER = "https://rhjz-web.vercel.app"


def parse_args(argv):
    """解析用户命令，兼容 `Uploadfile:...` / `Downloadfilename:...,file:...` 格式。"""
    server = DEFAULT_SERVER
    args = []
    for a in argv:
        if a.startswith("--server="):
            server = a.split("=", 1)[1].rstrip("/")
        elif a == "--server":
            continue  # 下一参数处理
        elif a.startswith("--"):
            continue
        else:
            args.append(a)
    if not args:
        print(__doc__)
        sys.exit(1)
    cmd = args[0]
    lower = cmd.lower()

    if lower.startswith("uploadfile:"):
        local_path = cmd[len("uploadfile:"):].strip()
        if not local_path:
            print("错误: Uploadfile 后缺少本机文件路径")
            sys.exit(1)
        return {"action": "upload", "server": server, "path": local_path}

    if lower.startswith("downloadfilename:"):
        rest = cmd[len("downloadfilename:"):]
        name, _, dir_part = rest.partition(",file:")
        name = name.strip()
        dir_part = dir_part.strip() or "."
        if not name:
            print("错误: Downloadfilename 后缺少文件名")
            sys.exit(1)
        return {"action": "download", "server": server, "name": name, "dir": dir_part}

    print("错误: 无法识别的命令，应为 Uploadfile:... 或 Downloadfilename:...,file:...")
    sys.exit(1)


def build_multipart(fields, file_path=None, file_field="file"):
    """构造 multipart/form-data 请求体。返回 (body, content_type)。"""
    boundary = "----RHJZ" + uuid.uuid4().hex
    lines = []
    for key, value in fields.items():
        lines.append(("--%s" % boundary).encode())
        lines.append(('Content-Disposition: form-data; name="%s"' % key).encode())
        lines.append(b"")
        lines.append(str(value).encode())
    if file_path:
        filename = os.path.basename(file_path)
        with open(file_path, "rb") as f:
            data = f.read()
        lines.append(("--%s" % boundary).encode())
        lines.append(
            ('Content-Disposition: form-data; name="%s"; filename="%s"'
             % (file_field, filename)).encode()
        )
        lines.append(b"Content-Type: application/octet-stream")
        lines.append(b"")
        lines.append(data)
    lines.append(("--%s--" % boundary).encode())
    lines.append(b"")
    body = b"\r\n".join(lines)
    content_type = "multipart/form-data; boundary=%s" % boundary
    return body, content_type


def http_request(url, method="GET", body=None, content_type=None, timeout=120):
    req = urllib.request.Request(url, method=method)
    if content_type:
        req.add_header("Content-Type", content_type)
    if body is not None:
        req.add_header("Content-Length", str(len(body)))
    with urllib.request.urlopen(req, data=body, timeout=timeout) as resp:
        return resp.status, resp.read()


def cmd_upload(server, local_path):
    if not os.path.isfile(local_path):
        print("错误: 本机文件不存在或不是文件: %s" % local_path)
        sys.exit(1)
    size = os.path.getsize(local_path)
    print("上传 %s (%d bytes) → %s/api/upload ..." % (local_path, size, server))
    body, ctype = build_multipart({}, local_path)
    try:
        status, raw = http_request(
            server + "/api/upload", "POST", body, ctype, timeout=600
        )
        result = json.loads(raw.decode("utf-8", "replace"))
        if status == 200 and result.get("status") == "success":
            print("✅ 上传成功: %s" % result.get("filename"))
            print("   大小: %d bytes" % result.get("size", 0))
            print("   已出现在下载列表，可通过 Downloadfilename:%s,file:<目录> 下载"
                  % result.get("filename"))
            return 0
        print("❌ 上传失败: %s - %s" % (result.get("message"), result.get("details", "")))
        return 1
    except Exception as e:
        print("❌ 上传请求失败: %s" % e)
        return 1


def cmd_download(server, name, target_dir):
    if not os.path.isdir(target_dir):
        try:
            os.makedirs(target_dir, exist_ok=True)
        except Exception as e:
            print("错误: 无法创建本地目录 %s: %s" % (target_dir, e))
            sys.exit(1)
    url = server + "/api/download/" + urllib.parse.quote(name)
    print("下载 %s → %s" % (name, target_dir))
    try:
        status, data = http_request(url, "GET", timeout=600)
        if status != 200:
            print("❌ 下载失败 (HTTP %d): 文件可能不存在或服务器错误" % status)
            return 1
        dest = os.path.join(target_dir, os.path.basename(name))
        with open(dest, "wb") as f:
            f.write(data)
        print("✅ 下载成功: %s (%d bytes)" % (dest, len(data)))
        return 0
    except Exception as e:
        print("❌ 下载请求失败: %s" % e)
        return 1


def main():
    if "--help" in sys.argv or "-h" in sys.argv:
        print(__doc__)
        return 0
    opt = parse_args(sys.argv[1:])
    if opt["action"] == "upload":
        return cmd_upload(opt["server"], opt["path"])
    return cmd_download(opt["server"], opt["name"], opt["dir"])


if __name__ == "__main__":
    sys.exit(main())
