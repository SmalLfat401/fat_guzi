"""
系统配置数据模型
用于存储全局开关和系统参数
集合名称: system_config
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class IntelFeatureConfig(BaseModel):
    """情报系统功能配置"""
    keyword_library_enabled: bool = Field(
        default=False,
        description="关键词库规则匹配开关（开启后先用关键词库过滤，再用AI）"
    )
    rule_confidence_threshold: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="规则匹配置信度阈值"
    )
    batch_size: int = Field(
        default=20,
        ge=1,
        le=100,
        description="每批次处理条数"
    )
    max_batches_per_run: int = Field(
        default=0,
        ge=0,
        description="每次运行最大批次限制（0=不限，全量跑）"
    )


class SystemConfig(BaseModel):
    """系统配置（单文档模式）"""
    config_key: str = Field(default="global", description="配置键")
    # 情报系统配置
    intel_config: IntelFeatureConfig = Field(
        default_factory=IntelFeatureConfig,
        description="情报系统功能配置"
    )
    # 时间戳
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class IntelConfigUpdate(BaseModel):
    """情报配置更新模型"""
    keyword_library_enabled: Optional[bool] = None
    rule_confidence_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    batch_size: Optional[int] = Field(default=None, ge=1, le=100, description="每批次处理条数")
    max_batches_per_run: Optional[int] = Field(default=None, ge=0, description="每次运行最大批次限制（0=不限）")