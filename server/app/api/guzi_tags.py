"""
谷子商品标签 API 路由
用于管理员管理谷子商品的 IP 标签和类别标签
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel

from app.models.guzi_tag import GuziTagCreate, GuziTagUpdate, GuziTagResponse, TagType, IpCategory
from app.database.guzi_tag_dao import guzi_tag_dao


class GuziTagListResponse(BaseModel):
    """谷子标签列表响应模型（含分页信息）"""
    model_config = {"by_alias": True}

    items: List[GuziTagResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class GuziTagStatsResponse(BaseModel):
    """谷子标签统计响应模型"""
    ip_count: int
    ip_active: int
    category_count: int
    category_active: int


router = APIRouter(prefix="/guzi-tags", tags=["谷子标签管理"])


@router.post("", response_model=GuziTagResponse, status_code=201)
async def create_tag(tag: GuziTagCreate):
    """
    创建谷子标签

    - **tag_type**: 标签类型，ip=IP标签，category=类别标签
    - **name**: 标签名称（必填），同类型下不可重复
    - **color**: 标签颜色（可选），如: #ff6b6b
    - **remark**: 备注说明（可选）
    - **ip_category**: IP类别（仅对IP标签有效），animation=动漫，game=游戏，other=其他
    """
    existing = guzi_tag_dao.find_by_name_and_type(tag.name, tag.tag_type)
    if existing:
        type_name = "IP" if tag.tag_type == TagType.IP else "类别"
        raise HTTPException(status_code=400, detail=f"{type_name}标签 '{tag.name}' 已存在")

    created_tag = guzi_tag_dao.create(tag)
    return GuziTagResponse(**created_tag.model_dump()).model_dump(by_alias=True, exclude_none=True)


@router.get("", response_model=GuziTagListResponse)
async def get_tags(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(50, ge=1, le=500, description="返回记录数"),
    tag_type: Optional[TagType] = Query(None, description="标签类型筛选"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    show_on_h5: Optional[bool] = Query(None, description="是否在H5端显示"),
    search: Optional[str] = Query(None, description="搜索标签名称"),
    ip_category: Optional[IpCategory] = Query(None, description="IP类别筛选（仅对IP标签有效）"),
):
    """
    获取谷子标签列表

    - **skip**: 跳过记录数，用于分页
    - **limit**: 返回记录数，最大500
    - **tag_type**: 筛选标签类型（ip 或 category）
    - **is_active**: 筛选启用状态（管理端用）
    - **show_on_h5**: 筛选H5显示状态
    - **search**: 搜索标签名称
    - **ip_category**: 筛选IP类别（animation=动漫，game=游戏，other=其他）
    """
    tags = guzi_tag_dao.find_all(
        skip=skip,
        limit=limit,
        tag_type=tag_type,
        is_active=is_active,
        show_on_h5=show_on_h5,
        search=search,
        ip_category=ip_category,
    )
    total = guzi_tag_dao.count(
        tag_type=tag_type,
        is_active=is_active,
        show_on_h5=show_on_h5,
        search=search,
        ip_category=ip_category,
    )

    page = skip // limit + 1 if limit > 0 else 1
    total_pages = (total + limit - 1) // limit if limit > 0 else 1

    return GuziTagListResponse(
        items=[GuziTagResponse(**tag.model_dump()).model_dump(by_alias=True, exclude_none=True) for tag in tags],
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages,
    )


@router.get("/stats", response_model=GuziTagStatsResponse)
async def get_tag_stats():
    """
    获取谷子标签统计数据
    """
    return GuziTagStatsResponse(
        ip_count=guzi_tag_dao.count(tag_type=TagType.IP),
        ip_active=guzi_tag_dao.count(tag_type=TagType.IP, is_active=True),
        category_count=guzi_tag_dao.count(tag_type=TagType.CATEGORY),
        category_active=guzi_tag_dao.count(tag_type=TagType.CATEGORY, is_active=True),
    )


@router.get("/{tag_id}", response_model=GuziTagResponse)
async def get_tag(tag_id: str):
    """
    根据ID获取标签详情
    """
    tag = guzi_tag_dao.find_by_id(tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail=f"标签 ID {tag_id} 不存在")
    return GuziTagResponse(**tag.model_dump()).model_dump(by_alias=True, exclude_none=True)


@router.put("/{tag_id}", response_model=GuziTagResponse)
async def update_tag(tag_id: str, tag_update: GuziTagUpdate):
    """
    更新标签信息
    """
    existing = guzi_tag_dao.find_by_id(tag_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"标签 ID {tag_id} 不存在")

    # 如果更新了名称，检查同类型下是否重名
    if tag_update.name and tag_update.name != existing.name:
        # 需要查新名字 + 原有类型
        dup = guzi_tag_dao.find_by_name_and_type(tag_update.name, existing.tag_type)
        if dup:
            type_name = "IP" if existing.tag_type == TagType.IP else "类别"
            raise HTTPException(status_code=400, detail=f"{type_name}标签 '{tag_update.name}' 已存在")

    updated_tag = guzi_tag_dao.update(tag_id, tag_update)
    return GuziTagResponse(**updated_tag.model_dump()).model_dump(by_alias=True, exclude_none=True)


@router.delete("/{tag_id}")
async def delete_tag(tag_id: str):
    """
    删除标签
    """
    existing = guzi_tag_dao.find_by_id(tag_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"标签 ID {tag_id} 不存在")

    deleted = guzi_tag_dao.delete(tag_id)
    if deleted:
        return {"message": f"标签 ID {tag_id} 已删除", "success": True}
    raise HTTPException(status_code=500, detail="删除失败")
