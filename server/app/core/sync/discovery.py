"""M7 Sync Engine: Discovery — 局域网设备发现。

ADR-020/022 冻结：
  - Discovery 只负责发现 DeviceInfo，不访问 workspace
  - 不读写 vault / eventlogs / mind_maps
  - 不传输文件内容
  - 不涉及用户账号 / 云端 ID

流程：
  1. 发送方广播 DISCOVER 消息（UDP broadcast）
  2. 接收方收到后回复 ACK（含自身 DeviceInfo）
  3. 发送方收集所有 ACK，返回设备列表

安全边界：
  - 只传输 device_id / name / version / created_at
  - 不传输 workspace 路径 / 文件内容 / API keys
"""
from __future__ import annotations

import json
import socket
import struct
import threading
import time
from typing import Callable

from .device import DeviceInfo, load_or_create_device
from .protocol import (
    DISCOVERY_PORT,
    BUFFER_SIZE,
    DiscoverPacket,
    AckPacket,
    parse_packet,
)


def _get_broadcast_address() -> str:
    """获取局域网广播地址。

    简单实现：使用 255.255.255.255（受限广播）。
    """
    return "255.255.255.255"


def _create_broadcast_socket() -> socket.socket:
    """创建 UDP 广播 socket。"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(3.0)
    return sock


def _create_listen_socket(port: int = DISCOVERY_PORT) -> socket.socket:
    """创建 UDP 监听 socket。"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("", port))
    sock.settimeout(0.5)
    return sock


def discover_peers(
    device: DeviceInfo,
    port: int = DISCOVERY_PORT,
    timeout: float = 3.0,
    max_retries: int = 3,
) -> list[DeviceInfo]:
    """广播 DISCOVER 消息，收集局域网内响应的设备。

    Args:
        device: 本设备信息
        port: 发现端口
        timeout: 等待响应超时（秒）
        max_retries: 最大重试次数

    Returns:
        发现的设备列表（不含自身）
    """
    discovered: dict[str, DeviceInfo] = {}
    broadcast_addr = _get_broadcast_address()

    for attempt in range(max_retries):
        try:
            sock = _create_broadcast_socket()
            try:
                # 发送 DISCOVER
                packet = DiscoverPacket(sender=device)
                sock.sendto(packet.to_bytes(), (broadcast_addr, port))

                # 收集 ACK
                deadline = time.time() + timeout
                while time.time() < deadline:
                    try:
                        data, addr = sock.recvfrom(BUFFER_SIZE)
                        ack = parse_packet(data)
                        if isinstance(ack, AckPacket) and ack.sender:
                            # 忽略自身
                            if ack.sender.device_id != device.device_id:
                                discovered[ack.sender.device_id] = ack.sender
                    except socket.timeout:
                        continue
            finally:
                sock.close()
        except OSError:
            continue

    return list(discovered.values())


def start_discovery_listener(
    device: DeviceInfo,
    port: int = DISCOVERY_PORT,
    on_device_found: Callable[[DeviceInfo], None] | None = None,
) -> Callable[[], None]:
    """启动发现监听器，响应其他设备的 DISCOVER 消息。

    Args:
        device: 本设备信息
        port: 监听端口
        on_device_found: 发现新设备时的回调

    Returns:
        停止监听的函数
    """
    stop_event = threading.Event()

    def _listen():
        try:
            sock = _create_listen_socket(port)
        except OSError:
            return

        try:
            while not stop_event.is_set():
                try:
                    data, addr = sock.recvfrom(BUFFER_SIZE)
                    packet = parse_packet(data)
                    if isinstance(packet, DiscoverPacket):
                        # 回复 ACK
                        ack = AckPacket(sender=device)
                        sock.sendto(ack.to_bytes(), addr)

                        # 回调
                        if packet.sender and on_device_found:
                            on_device_found(packet.sender)
                except socket.timeout:
                    continue
                except OSError:
                    break
        finally:
            sock.close()

    thread = threading.Thread(target=_listen, daemon=True)
    thread.start()

    def stop():
        stop_event.set()
        thread.join(timeout=2.0)

    return stop


def ping_device(
    target_addr: tuple[str, int],
    device: DeviceInfo,
    timeout: float = 2.0,
) -> DeviceInfo | None:
    """向指定设备发送 PING，等待 PONG 响应。

    Args:
        target_addr: (ip, port) 目标地址
        device: 本设备信息
        timeout: 超时秒数

    Returns:
        目标设备信息，超时返回 None
    """
    from .protocol import PingPacket, PongPacket

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        try:
            ping = PingPacket()
            sock.sendto(ping.to_bytes(), target_addr)
            data, _ = sock.recvfrom(BUFFER_SIZE)
            pong = parse_packet(data)
            if isinstance(pong, PongPacket) and pong.sender:
                return pong.sender
        except (socket.timeout, OSError):
            return None
        finally:
            sock.close()
    except OSError:
        return None
