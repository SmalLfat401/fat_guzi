"""
类别关键词数据模型
用于规则预筛和AI关键词库闭环学习
集合名称: category_keywords
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

from app.models.weibo_intel import IntelCategory


class CategoryKeywords(BaseModel):
    """
    按类别分组的关键词库

    设计思路：
    - 前期为空，完全依赖 AI
    - AI 提取成功后，从结果中学习触发词
    - 管理端可人工添加/编辑/删除
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str = Field(description="关联的 IntelCategory 值")
    keywords: List[str] = Field(
        default_factory=list,
        description="触发关键词列表（AND 逻辑：满足任一关键词即命中）"
    )
    exclude_keywords: List[str] = Field(
        default_factory=list,
        description="排除关键词列表（命中有触发词但同时命中排除词则过滤）"
    )
    # 统计
    usage_count: int = Field(default=0, description="被命中的次数（用于排序）")
    hit_count_today: int = Field(default=0, description="今日命中次数")
    # 置信度加成
    ai_confidence_override: float = Field(
        default=0.0,
        ge=0.0,
        le=0.3,
        description="命中该类别关键词时的置信度加成（最多+0.3）"
    )
    # 来源
    source: str = Field(default="ai", description="关键词来源: ai / manual / approved")
    source_intel_id: Optional[str] = Field(default=None, description="如果来自AI学习，记录来源intel id")
    approved_by: Optional[str] = Field(default=None, description="人工审核人")
    approved_at: Optional[datetime] = Field(default=None)
    is_active: bool = Field(default=True, description="是否启用")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class KeywordCandidate(BaseModel):
    """
    AI 提取出的候选关键词（待审核）
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str = Field(description="建议归属的类别")
    keyword: str = Field(description="候选关键词")
    source_intel_id: str = Field(description="来源 intel id")
    source_text_snippet: str = Field(
        default="",
        description="该关键词在原文中出现的片段（用于人工判断）"
    )
    confidence: float = Field(default=0.0, description="该关键词的置信度")
    status: str = Field(default="pending", description="pending / approved / rejected")
    reviewed_by: Optional[str] = Field(default=None)
    reviewed_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CategoryKeywordsCreate(BaseModel):
    """创建关键词组的请求模型"""
    category: str
    keywords: List[str] = Field(default_factory=list)
    exclude_keywords: List[str] = Field(default_factory=list)
    ai_confidence_override: float = Field(default=0.0, ge=0.0, le=0.3)
    source: str = Field(default="manual")


class CategoryKeywordsUpdate(BaseModel):
    """更新关键词组的请求模型"""
    keywords: Optional[List[str]] = None
    exclude_keywords: Optional[List[str]] = None
    ai_confidence_override: Optional[float] = Field(default=None, ge=0.0, le=0.3)
    is_active: Optional[bool] = None


class CategoryKeywordsResponse(BaseModel):
    """关键词库响应模型"""
    id: str
    category: str
    category_display: str
    keywords: List[str] = []
    exclude_keywords: List[str] = []
    usage_count: int = 0
    hit_count_today: int = 0
    ai_confidence_override: float = 0.0
    source: str
    is_active: bool = True
    created_at: str
    updated_at: str


class KeywordCandidateResponse(BaseModel):
    """候选关键词响应模型"""
    id: str
    category: str
    category_display: str
    keyword: str
    source_intel_id: str
    source_text_snippet: str
    confidence: float
    status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: str
