"""
求谷表单 API 路由
H5端提交接口 + 管理端查看接口
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel

from app.models.want_guzi import (
    WantGuziCreate,
    WantGuziUpdate,
    WantGuziResponse,
    WantGuziListResponse,
    WantGuziStatus,
)
from app.database.want_guzi_dao import want_guzi_dao


class WantGuziStatsResponse(BaseModel):
    """求谷统计响应模型"""
    total: int
    pending: int
    processing: int
    completed: int
    closed: int


router = APIRouter(prefix="/want-guzi", tags=["求谷管理"])


# ====================
# H5 端接口
# ====================

@router.post("", response_model=WantGuziResponse, status_code=201)
async def create_want_guzi(form: WantGuziCreate):
    """
    H5端：提交求谷表单

    - **ip_name**: IP名称（必填）
    - **category_tags**: 谷子类别标签ID列表（可选）
    - **remark**: 备注说明（可选）
    """
    created_form = want_guzi_dao.create(form)
    return WantGuziResponse(**created_form.model_dump()).model_dump(by_alias=True, exclude_none=True)


# ====================
# 管理端接口
# ====================

@router.get("", response_model=WantGuziListResponse)
async def get_want_guzi_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    status: Optional[WantGuziStatus] = Query(None, description="筛选状态"),
    search: Optional[str] = Query(None, description="搜索IP名称"),
):
    """
    管理端：获取求谷表单列表

    - **page**: 页码（默认1）
    - **page_size**: 每页数量（默认20，最大100）
    - **status**: 筛选状态（pending/processing/completed/closed）
    - **search**: 搜索IP名称
    """
    skip = (page - 1) * page_size
    forms = want_guzi_dao.find_all(
        skip=skip,
        limit=page_size,
        status=status,
        search=search,
    )
    total = want_guzi_dao.count(status=status, search=search)

    page = skip // page_size + 1 if page_size > 0 else 1
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1

    return WantGuziListResponse(
        items=[WantGuziResponse(**form.model_dump()).model_dump(by_alias=True, exclude_none=True) for form in forms],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/stats", response_model=WantGuziStatsResponse)
async def get_want_guzi_stats():
    """
    管理端：获取求谷统计信息

    返回各状态的表单数量统计
    """
    total = want_guzi_dao.count()
    pending = want_guzi_dao.count(status=WantGuziStatus.PENDING)
    processing = want_guzi_dao.count(status=WantGuziStatus.PROCESSING)
    completed = want_guzi_dao.count(status=WantGuziStatus.COMPLETED)
    closed = want_guzi_dao.count(status=WantGuziStatus.CLOSED)

    return WantGuziStatsResponse(
        total=total,
        pending=pending,
        processing=processing,
        completed=completed,
        closed=closed,
    )


@router.get("/{form_id}", response_model=WantGuziResponse)
async def get_want_guzi_detail(form_id: str):
    """
    管理端：获取求谷表单详情

    - **form_id**: 表单ID
    """
    form = want_guzi_dao.find_by_id(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="表单不存在")
    return WantGuziResponse(**form.model_dump()).model_dump(by_alias=True, exclude_none=True)


@router.patch("/{form_id}", response_model=WantGuziResponse)
async def update_want_guzi(form_id: str, update_data: WantGuziUpdate):
    """
    管理端：更新求谷表单状态和处理信息

    - **form_id**: 表单ID
    - **status**: 处理状态（pending/processing/completed/closed）
    - **reply**: 管理员回复
    - **admin_remark**: 管理员备注
    """
    form = want_guzi_dao.find_by_id(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="表单不存在")

    updated_form = want_guzi_dao.update(form_id, update_data)
    return WantGuziResponse(**updated_form.model_dump()).model_dump(by_alias=True, exclude_none=True)


@router.delete("/{form_id}")
async def delete_want_guzi(form_id: str):
    """
    管理端：删除求谷表单

    - **form_id**: 表单ID
    """
    form = want_guzi_dao.find_by_id(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="表单不存在")

    success = want_guzi_dao.delete(form_id)
    if not success:
        raise HTTPException(status_code=500, detail="删除失败")

    return {"success": True, "message": "删除成功"}
