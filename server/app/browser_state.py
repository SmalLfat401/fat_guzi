"""
浏览器状态管理模块
用于持久化保存浏览器启动状态
"""
import json
import os
from pathlib import Path
from typing import Optional


# 状态文件路径（相对于 backend/ 目录）
_STATE_FILE = Path(__file__).parent.parent / "browser_state.json"


class BrowserState:
    """浏览器状态管理类"""

    _instance: Optional['BrowserState'] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._state = self._load()

    def _load(self) -> dict:
        """从文件加载状态"""
        if _STATE_FILE.exists():
            try:
                with open(_STATE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "chrome_running": False,
            "page_open": False,
            "updated_at": None
        }

    def _save(self):
        """保存状态到文件"""
        try:
            with open(_STATE_FILE, 'w', encoding='utf-8') as f:
                json.dump(self._state, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存浏览器状态失败: {e}")

    def get_chrome_running(self) -> bool:
        """获取Chrome运行状态"""
        return self._state.get("chrome_running", False)

    def set_chrome_running(self, running: bool):
        """设置Chrome运行状态"""
        from datetime import datetime
        self._state["chrome_running"] = running
        self._state["updated_at"] = datetime.utcnow().isoformat()
        self._save()

    def get_page_open(self) -> bool:
        """获取页面打开状态"""
        return self._state.get("page_open", False)

    def set_page_open(self, open: bool):
        """设置页面打开状态"""
        from datetime import datetime
        self._state["page_open"] = open
        self._state["updated_at"] = datetime.utcnow().isoformat()
        self._save()

    def get_state(self) -> dict:
        """获取完整状态"""
        return self._state.copy()

    def reset(self):
        """重置状态为未启动"""
        from datetime import datetime
        self._state = {
            "chrome_running": False,
            "page_open": False,
            "updated_at": datetime.utcnow().isoformat()
        }
        self._save()


# 全局单例
browser_state = BrowserState()
