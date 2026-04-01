"""
Coser圈黑话术语API路由
用于管理员管理Coser（角色扮演）领域的术语和黑话
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.coser_term import CoserTermCreate, CoserTermUpdate, CoserTermResponse
from app.database.coser_term_dao import coser_term_dao

router = APIRouter(prefix="/coser-terms", tags=["Coser圈黑话管理"])


def _term_to_response(term) -> CoserTermResponse:
    return CoserTermResponse(
        id=term.id,
        term=term.term,
        meaning=term.meaning,
        usage_scenario=term.usage_scenario,
        category=term.category,
        example=term.example,
        is_active=term.is_active,
        ai_copywriting=term.ai_copywriting,
        ai_script=term.ai_script,
        video_generated=term.video_generated,
        video_published=term.video_published,
        created_at=term.created_at,
        updated_at=term.updated_at,
    )


class CoserTermListResponse(BaseModel):
    """Coser术语列表响应模型（含分页信息）"""
    items: List[CoserTermResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class CoserTermStatsResponse(BaseModel):
    """Coser术语统计响应模型"""
    total: int
    active: int
    inactive: int
    category_stats: dict


@router.post("", response_model=CoserTermResponse, status_code=201)
async def create_term(term: CoserTermCreate):
    """
    创建Coser术语

    - **term**: 术语名称 (必填)，如: COS、C服、妆面
    - **meaning**: 含义解释 (必填)
    - **usage_scenario**: 使用场景 (必填)
    - **category**: 分类 (可选)，如: 基础术语、装备术语、化妆术语
    - **example**: 使用示例 (可选)
    """
    existing = coser_term_dao.find_by_term(term.term)
    if existing:
        raise HTTPException(status_code=400, detail=f"术语名称 '{term.term}' 已存在")

    created_term = coser_term_dao.create(term)
    return _term_to_response(created_term)


@router.get("", response_model=CoserTermListResponse)
async def get_terms(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(20, ge=1, le=500, description="返回记录数"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    category: Optional[str] = Query(None, description="分类筛选"),
    search: Optional[str] = Query(None, description="搜索术语或含义")
):
    """获取Coser术语列表"""
    terms = coser_term_dao.find_all(
        skip=skip,
        limit=limit,
        is_active=is_active,
        category=category,
        search=search
    )
    
    total = coser_term_dao.count(is_active=is_active, category=category, search=search)
    page = skip // limit + 1 if limit > 0 else 1
    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    
    return CoserTermListResponse(
        items=[_term_to_response(term) for term in terms],
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages
    )


@router.get("/stats", response_model=CoserTermStatsResponse)
async def get_term_stats(
    category: Optional[str] = Query(None, description="分类筛选")
):
    """获取Coser术语统计数据"""
    total = coser_term_dao.count(category=category)
    active = coser_term_dao.count(is_active=True, category=category)
    inactive = coser_term_dao.count(is_active=False, category=category)
    
    category_stats = {}
    categories = coser_term_dao.get_all_categories()
    for cat in categories:
        category_stats[cat] = coser_term_dao.count(category=cat)
    
    return CoserTermStatsResponse(
        total=total,
        active=active,
        inactive=inactive,
        category_stats=category_stats
    )


@router.get("/count")
async def get_term_count(
    is_active: Optional[bool] = Query(None, description="是否启用"),
    category: Optional[str] = Query(None, description="分类筛选")
):
    """
    获取Coser术语总数
    """
    count = coser_term_dao.count(is_active=is_active, category=category)
    return {"total": count}


@router.get("/{term_id}", response_model=CoserTermResponse)
async def get_term(term_id: str):
    """
    根据ID获取Coser术语详情
    """
    term = coser_term_dao.find_by_id(term_id)
    if not term:
        raise HTTPException(status_code=404, detail=f"术语 ID {term_id} 不存在")
    return _term_to_response(term)


@router.put("/{term_id}", response_model=CoserTermResponse)
async def update_term(term_id: str, term_update: CoserTermUpdate):
    """
    更新Coser术语信息
    """
    existing = coser_term_dao.find_by_id(term_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"术语 ID {term_id} 不存在")

    updated_term = coser_term_dao.update(term_id, term_update)
    return _term_to_response(updated_term)


class UpdateAIContentRequest(BaseModel):
    """更新 AI 生成内容请求模型"""
    ai_copywriting: Optional[str] = Field(default=None, description="AI口播文案")
    ai_script: Optional[str] = Field(default=None, description="AI镜头脚本")


@router.patch("/{term_id}/ai-content", response_model=CoserTermResponse)
async def update_ai_content(term_id: str, data: UpdateAIContentRequest):
    """
    更新术语的 AI 生成内容（口播文案 / 镜头脚本）
    生成完成后自动调用，保存 AI 产出的内容
    """
    existing = coser_term_dao.find_by_id(term_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"术语 ID {term_id} 不存在")

    updated_term = coser_term_dao.update_ai_content(
        term_id,
        ai_copywriting=data.ai_copywriting,
        ai_script=data.ai_script,
    )
    return _term_to_response(updated_term)


@router.patch("/{term_id}/toggle-video-generated", response_model=CoserTermResponse)
async def toggle_video_generated(term_id: str):
    """
    切换视频生成状态
    """
    existing = coser_term_dao.find_by_id(term_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"术语 ID {term_id} 不存在")

    updated_term = coser_term_dao.toggle_field(term_id, "video_generated")
    return _term_to_response(updated_term)


@router.patch("/{term_id}/toggle-video-published", response_model=CoserTermResponse)
async def toggle_video_published(term_id: str):
    """
    切换视频发布状态
    """
    existing = coser_term_dao.find_by_id(term_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"术语 ID {term_id} 不存在")

    updated_term = coser_term_dao.toggle_field(term_id, "video_published")
    return _term_to_response(updated_term)


@router.delete("/{term_id}")
async def delete_term(term_id: str):
    """
    删除Coser术语
    """
    existing = coser_term_dao.find_by_id(term_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"术语 ID {term_id} 不存在")

    deleted = coser_term_dao.delete(term_id)
    if deleted:
        return {"message": f"术语 ID {term_id} 已删除", "success": True}
    raise HTTPException(status_code=500, detail="删除失败")
