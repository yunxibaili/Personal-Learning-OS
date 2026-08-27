"""AI Tutor 错误类型（M4-C）。

统一错误处理：用户看到友好消息，不泄露内部细节。
"""
from __future__ import annotations


class TutorError(Exception):
    """Tutor 基类错误。"""
    user_message = "Tutor temporarily unavailable."


class ProviderTimeout(TutorError):
    """LLM Provider 超时。"""
    user_message = "Tutor is taking too long. Please try again."


class ProviderError(TutorError):
    """LLM Provider 返回错误。"""
    user_message = "Tutor encountered an error. Please try again."


class ProviderUnavailable(TutorError):
    """LLM Provider 不可用（未配置 / 网络问题）。"""
    user_message = "Tutor is not configured. Please check settings."
