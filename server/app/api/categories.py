"""
类别管理API路由
用于管理员手动新增和管理微博账户类型
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List

from app.models.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.database.category_dao import category_dao

router = APIRouter(prefix="/categories", tags=["类别管理"])


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(category: CategoryCreate):
    """
    创建类别

    添加一个新的微博账户类别

    - **name**: 类别名称 (必填)，如: 娱乐、科技、体育等
    - **description**: 类别描述 (可选)
    """
    existing = category_dao.find_by_name(category.name)
    if existing:
        raise HTTPException(status_code=400, detail=f"类别名称 '{category.name}' 已存在")

    created_category = category_dao.create(category)
    return created_category


@router.get("", response_model=List[CategoryResponse])
async def get_categories(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=500, description="返回记录数"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取类别列表

    - **skip**: 跳过记录数，用于分页
    - **limit**: 返回记录数，最大500
    - **is_active**: 筛选启用状态
    """
    categories = category_dao.find_all(skip=skip, limit=limit, is_active=is_active)
    return categories


@router.get("/count")
async def get_category_count(is_active: Optional[bool] = Query(None, description="是否启用")):
    """
    获取类别总数
    """
    count = category_dao.count(is_active=is_active)
    return {"total": count}


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: str):
    """
    根据ID获取类别详情
    """
    category = category_dao.find_by_id(category_id)
    if not category:
        raise HTTPException(status_code=404, detail=f"类别 ID {category_id} 不存在")
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, category_update: CategoryUpdate):
    """
    更新类别信息
    """
    existing = category_dao.find_by_id(category_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"类别 ID {category_id} 不存在")

    updated_category = category_dao.update(category_id, category_update)
    return updated_category


@router.delete("/{category_id}")
async def delete_category(category_id: str):
    """
    删除类别
    """
    existing = category_dao.find_by_id(category_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"类别 ID 不存在")

    deleted = category_dao.delete(category_id)
    if deleted:
        return {"message": f"类别 ID {category_id} 已删除", "success": True}
    raise HTTPException(status_code=500, detail="删除失败")
