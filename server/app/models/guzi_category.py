"""
谷子商品分类模型
包含一级分类（GuziCategory）和二级分类（GuziSubCategory）

商品表里引用的是二级分类的 _id
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
#  一级分类模型
# ──────────────────────────────────────────────

class GuziCategory(BaseModel):
    """一级分类模型（MongoDB 文档格式）"""
    id: str = Field(..., alias="_id", description="分类ID")
    name: str = Field(..., description="一级分类名称，如：纸片类、亚克力类、毛绒类")
    color: Optional[str] = Field(default=None, description="分类颜色，如：#ff4d4f")
    order: int = Field(default=0, description="排序权重，数字越小越靠前")
    is_active: bool = Field(default=True, description="是否启用")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="更新时间")

    class Config:
        populate_by_name = True


class GuziCategoryCreate(BaseModel):
    """创建一级分类请求模型"""
    name: str = Field(..., min_length=1, max_length=50, description="一级分类名称")
    color: Optional[str] = Field(default=None, description="分类颜色")
    order: int = Field(default=0, description="排序权重")
    is_active: bool = Field(default=True, description="是否启用")


class GuziCategoryUpdate(BaseModel):
    """更新一级分类请求模型"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=50, description="一级分类名称")
    color: Optional[str] = Field(default=None, description="分类颜色")
    order: Optional[int] = Field(default=None, description="排序权重")
    is_active: Optional[bool] = Field(default=None, description="是否启用")


class SubCategoryStats(BaseModel):
    """一级分类下二级分类统计"""
    total: int = Field(description="二级分类总数")
    active: int = Field(description="已启用的二级分类数量")
    inactive: int = Field(description="已禁用的二级分类数量")


class GuziCategoryResponse(BaseModel):
    """一级分类响应模型"""
    model_config = {"populate_by_name": True, "by_alias": True}

    id: str = Field(..., alias="_id", description="分类ID")
    name: str
    color: Optional[str] = None
    order: int = 0
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    sub_category_stats: SubCategoryStats = Field(
        default_factory=lambda: SubCategoryStats(total=0, active=0, inactive=0),
        description="二级分类统计"
    )


# ──────────────────────────────────────────────
#  二级分类模型
# ──────────────────────────────────────────────

class GuziSubCategory(BaseModel):
    """二级分类模型（MongoDB 文档格式）"""
    id: str = Field(..., alias="_id", description="二级分类ID")
    parent_id: str = Field(..., description="所属一级分类ID（引用 guzi_categories）")
    name: str = Field(..., description="二级分类名称，如：镭射票、拍立得卡、流麻、棉花娃娃")
    color: Optional[str] = Field(default=None, description="分类颜色（用于前端展示）")
    order: int = Field(default=0, description="排序权重，数字越小越靠前")
    is_active: bool = Field(default=True, description="是否启用")
    taobao_search_terms: List[str] = Field(
        default_factory=list,
        description="淘宝搜索关键词列表，用于向用户展示该分类搜什么"
    )
    aliases: List[str] = Field(
        default_factory=list,
        description="用户搜索黑话/别名列表，如：徽章、吧唧、马口铁、双闪"
    )
    match_weight: int = Field(
        default=80, ge=0, le=100,
        description="匹配权重 0-100，用于搜索结果排序加分"
    )
    exclude: List[str] = Field(
        default_factory=list,
        description="排除词列表，防止误判，如：吧唧托、卡套、流沙立牌"
    )
    material_tags: List[str] = Field(
        default_factory=list,
        description="材质属性参考，如：马口铁、亚克力、相纸、PP棉"
    )
    remark: Optional[str] = Field(default=None, description="备注说明")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="更新时间")

    class Config:
        populate_by_name = True


class GuziSubCategoryCreate(BaseModel):
    """创建二级分类请求模型"""
    parent_id: str = Field(..., description="所属一级分类ID")
    name: str = Field(..., min_length=1, max_length=50, description="二级分类名称")
    color: Optional[str] = Field(default=None, description="分类颜色")
    order: int = Field(default=0, description="排序权重")
    is_active: bool = Field(default=True, description="是否启用")
    taobao_search_terms: List[str] = Field(default_factory=list, description="淘宝搜索关键词")
    aliases: List[str] = Field(default_factory=list, description="用户搜索黑话/别名")
    match_weight: int = Field(default=80, ge=0, le=100, description="匹配权重")
    exclude: List[str] = Field(default_factory=list, description="排除词")
    material_tags: List[str] = Field(default_factory=list, description="材质标签")
    remark: Optional[str] = Field(default=None, description="备注说明")


class GuziSubCategoryUpdate(BaseModel):
    """更新二级分类请求模型"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=50, description="二级分类名称")
    parent_id: Optional[str] = Field(default=None, description="所属一级分类ID（可迁移）")
    color: Optional[str] = Field(default=None, description="分类颜色")
    order: Optional[int] = Field(default=None, description="排序权重")
    is_active: Optional[bool] = Field(default=None, description="是否启用")
    taobao_search_terms: Optional[List[str]] = Field(default=None, description="淘宝搜索关键词")
    aliases: Optional[List[str]] = Field(default=None, description="用户搜索黑话/别名")
    match_weight: Optional[int] = Field(default=None, ge=0, le=100, description="匹配权重")
    exclude: Optional[List[str]] = Field(default=None, description="排除词")
    material_tags: Optional[List[str]] = Field(default=None, description="材质标签")
    remark: Optional[str] = Field(default=None, description="备注说明")


class GuziSubCategoryResponse(BaseModel):
    """二级分类响应模型"""
    model_config = {"populate_by_name": True, "by_alias": True}

    id: str = Field(..., alias="_id", description="二级分类ID")
    parent_id: str
    name: str
    color: Optional[str] = None
    order: int = 0
    is_active: bool = True
    taobao_search_terms: List[str] = Field(default_factory=list)
    aliases: List[str] = Field(default_factory=list)
    match_weight: int = 80
    exclude: List[str] = Field(default_factory=list)
    material_tags: List[str] = Field(default_factory=list)
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class GuziCategoryWithSubsResponse(BaseModel):
    """一级分类（含二级分类列表）响应模型"""
    model_config = {"populate_by_name": True, "by_alias": True}

    id: str = Field(..., alias="_id", description="一级分类ID")
    name: str
    color: Optional[str] = None
    order: int = 0
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    sub_categories: List[GuziSubCategoryResponse] = Field(default_factory=list)
