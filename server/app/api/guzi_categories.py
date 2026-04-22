"""
谷子商品分类 API 路由
用于管理员管理谷子商品的一级分类和二级分类
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel

from app.models.guzi_category import (
    GuziCategoryCreate,
    GuziCategoryUpdate,
    GuziCategoryResponse,
    GuziSubCategoryCreate,
    GuziSubCategoryUpdate,
    GuziSubCategoryResponse,
    GuziCategoryWithSubsResponse,
)
from app.database.guzi_category_dao import guzi_category_dao
from app.database.guzi_sub_category_dao import guzi_sub_category_dao


# ──────────────────────────────────────────────
#  响应模型
# ──────────────────────────────────────────────

class GuziCategoryListResponse(BaseModel):
    items: List[GuziCategoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class GuziSubCategoryListResponse(BaseModel):
    items: List[GuziSubCategoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class CategoryWithSubsListResponse(BaseModel):
    items: List[GuziCategoryWithSubsResponse]
    total: int


router = APIRouter(prefix="/guzi-categories", tags=["谷子分类管理"])


# ──────────────────────────────────────────────
#  二级分类路由（必须放在 /{category_id} 前面！）
# ──────────────────────────────────────────────

@router.post("/subs", response_model=GuziSubCategoryResponse, status_code=201)
async def create_sub_category(sub: GuziSubCategoryCreate):
    """创建二级分类"""
    parent = guzi_category_dao.find_by_id(sub.parent_id)
    if not parent:
        raise HTTPException(status_code=400, detail=f"所属一级分类 ID {sub.parent_id} 不存在")

    existing = guzi_sub_category_dao.find_by_name_and_parent(sub.name, sub.parent_id)
    if existing:
        raise HTTPException(status_code=400, detail=f"二级分类 '{sub.name}' 在该一级分类下已存在")

    created = guzi_sub_category_dao.create(sub)
    return GuziSubCategoryResponse(**created.model_dump()).model_dump(by_alias=True, exclude_none=True)


@router.get("/subs", response_model=GuziSubCategoryListResponse)
async def get_sub_categories(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    parent_id: Optional[str] = Query(None, description="一级分类ID筛选"),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None, description="搜索名称或别名"),
):
    """获取二级分类列表"""
    subs = guzi_sub_category_dao.find_all(
        skip=skip,
        limit=limit,
        parent_id=parent_id,
        is_active=is_active,
        search=search,
    )
    total = guzi_sub_category_dao.count(
        parent_id=parent_id,
        is_active=is_active,
        search=search,
    )

    page = skip // limit + 1 if limit > 0 else 1
    total_pages = (total + limit - 1) // limit if limit > 0 else 1

    return GuziSubCategoryListResponse(
        items=[GuziSubCategoryResponse(**s.model_dump()).model_dump(by_alias=True, exclude_none=True) for s in subs],
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages,
    )


@router.get("/subs/{sub_id}", response_model=GuziSubCategoryResponse)
async def get_sub_category(sub_id: str):
    """根据ID获取二级分类详情"""
    sub = guzi_sub_category_dao.find_by_id(sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail=f"二级分类 ID {sub_id} 不存在")
    return GuziSubCategoryResponse(**sub.model_dump()).model_dump(by_alias=True, exclude_none=True)


@router.put("/subs/{sub_id}", response_model=GuziSubCategoryResponse)
async def update_sub_category(sub_id: str, update_data: GuziSubCategoryUpdate):
    """更新二级分类"""
    existing = guzi_sub_category_dao.find_by_id(sub_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"二级分类 ID {sub_id} 不存在")

    parent_id = update_data.parent_id or existing.parent_id

    if update_data.name and update_data.name != existing.name:
        dup = guzi_sub_category_dao.find_by_name_and_parent(update_data.name, parent_id)
        if dup:
            raise HTTPException(status_code=400, detail=f"二级分类 '{update_data.name}' 在该一级分类下已存在")

    updated = guzi_sub_category_dao.update(sub_id, update_data)
    return GuziSubCategoryResponse(**updated.model_dump()).model_dump(by_alias=True, exclude_none=True)


@router.delete("/subs/{sub_id}")
async def delete_sub_category(sub_id: str):
    """删除二级分类"""
    existing = guzi_sub_category_dao.find_by_id(sub_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"二级分类 ID {sub_id} 不存在")

    deleted = guzi_sub_category_dao.delete(sub_id)
    if deleted:
        return {"message": f"二级分类 ID {sub_id} 已删除", "success": True}
    raise HTTPException(status_code=500, detail="删除失败")


# ──────────────────────────────────────────────
#  一级分类路由
# ──────────────────────────────────────────────

@router.post("", response_model=GuziCategoryResponse, status_code=201)
async def create_category(category: GuziCategoryCreate):
    """创建一级分类"""
    existing = guzi_category_dao.find_by_name(category.name)
    if existing:
        raise HTTPException(status_code=400, detail=f"一级分类 '{category.name}' 已存在")

    created = guzi_category_dao.create(category)
    return GuziCategoryResponse(**created.model_dump()).model_dump(by_alias=True, exclude_none=True)


@router.get("", response_model=GuziCategoryListResponse)
async def get_categories(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
):
    """获取一级分类列表"""
    categories = guzi_category_dao.find_all(
        skip=skip,
        limit=limit,
        is_active=is_active,
        search=search,
    )
    total = guzi_category_dao.count(is_active=is_active, search=search)

    page = skip // limit + 1 if limit > 0 else 1
    total_pages = (total + limit - 1) // limit if limit > 0 else 1

    return GuziCategoryListResponse(
        items=[GuziCategoryResponse(**c.model_dump()).model_dump(by_alias=True, exclude_none=True) for c in categories],
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages,
    )


@router.get("/with-subs", response_model=CategoryWithSubsListResponse)
async def get_categories_with_subs(
    is_active: Optional[bool] = Query(None),
):
    """
    获取所有一级分类（含二级分类列表）
    用于管理端级联选择器
    """
    categories = guzi_category_dao.find_all(
        skip=0,
        limit=100,
        is_active=is_active,
    )
    total = guzi_category_dao.count(is_active=is_active)

    items = []
    for cat in categories:
        subs = guzi_sub_category_dao.find_by_parent(
            parent_id=cat.id,
            skip=0,
            limit=200,
            is_active=is_active,
        )
        cat_dict = cat.model_dump()
        sub_responses = [
            GuziSubCategoryResponse(**s.model_dump()).model_dump(by_alias=True, exclude_none=True)
            for s in subs
        ]
        cat_dict["sub_categories"] = sub_responses
        items.append(GuziCategoryWithSubsResponse(**cat_dict).model_dump(by_alias=True, exclude_none=True))

    return CategoryWithSubsListResponse(items=items, total=total)


@router.get("/stats")
async def get_category_stats():
    """获取分类统计数据"""
    total_cats = guzi_category_dao.count()
    active_cats = guzi_category_dao.count(is_active=True)
    total_subs = guzi_sub_category_dao.count()
    active_subs = guzi_sub_category_dao.count(is_active=True)

    return {
        "category_count": total_cats,
        "category_active": active_cats,
        "sub_category_count": total_subs,
        "sub_category_active": active_subs,
    }


@router.get("/{category_id}", response_model=GuziCategoryResponse)
async def get_category(category_id: str):
    """根据ID获取一级分类详情"""
    category = guzi_category_dao.find_by_id(category_id)
    if not category:
        raise HTTPException(status_code=404, detail=f"一级分类 ID {category_id} 不存在")
    return GuziCategoryResponse(**category.model_dump()).model_dump(by_alias=True, exclude_none=True)


@router.put("/{category_id}", response_model=GuziCategoryResponse)
async def update_category(category_id: str, update_data: GuziCategoryUpdate):
    """更新一级分类"""
    existing = guzi_category_dao.find_by_id(category_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"一级分类 ID {category_id} 不存在")

    if update_data.name and update_data.name != existing.name:
        dup = guzi_category_dao.find_by_name(update_data.name)
        if dup:
            raise HTTPException(status_code=400, detail=f"一级分类 '{update_data.name}' 已存在")

    updated = guzi_category_dao.update(category_id, update_data)
    return GuziCategoryResponse(**updated.model_dump()).model_dump(by_alias=True, exclude_none=True)


@router.delete("/{category_id}")
async def delete_category(category_id: str):
    """删除一级分类（同时删除其下所有二级分类）"""
    existing = guzi_category_dao.find_by_id(category_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"一级分类 ID {category_id} 不存在")

    deleted_subs = guzi_sub_category_dao.delete_by_parent(category_id)
    deleted = guzi_category_dao.delete(category_id)
    return {
        "message": f"一级分类 ID {category_id} 已删除",
        "deleted_sub_categories": deleted_subs,
        "success": True,
    }
