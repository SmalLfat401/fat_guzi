"""
谷子黑话术语API路由
用于管理员管理谷子（动漫/游戏周边）领域的术语和黑话
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.guzi_term import GuziTermCreate, GuziTermUpdate, GuziTermResponse
from app.database.guzi_term_dao import guzi_term_dao


class GuziTermListResponse(BaseModel):
    """谷子术语列表响应模型（含分页信息）"""
    items: List[GuziTermResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


router = APIRouter(prefix="/guzi-terms", tags=["谷子黑话管理"])


@router.post("", response_model=GuziTermResponse, status_code=201)
async def create_term(term: GuziTermCreate):
    """
    创建谷子术语

    - **term**: 术语名称 (必填)，如: 谷子、吧唧
    - **meaning**: 含义解释 (必填)
    - **usage_scenario**: 使用场景 (必填)
    - **category**: 分类 (可选)，如: 周边类型、交易术语、圈内黑话
    - **example**: 使用示例 (可选)
    """
    existing = guzi_term_dao.find_by_term(term.term)
    if existing:
        raise HTTPException(status_code=400, detail=f"术语名称 '{term.term}' 已存在")

    created_term = guzi_term_dao.create(term)
    return GuziTermResponse(
        id=created_term.id,
        term=created_term.term,
        meaning=created_term.meaning,
        usage_scenario=created_term.usage_scenario,
        category=created_term.category,
        example=created_term.example,
        is_active=created_term.is_active,
        ai_copywriting=created_term.ai_copywriting,
        ai_script=created_term.ai_script,
        video_generated=created_term.video_generated,
        video_published=created_term.video_published,
        created_at=created_term.created_at,
        updated_at=created_term.updated_at,
    )


@router.get("", response_model=GuziTermListResponse)
async def get_terms(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(20, ge=1, le=500, description="返回记录数"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    category: Optional[str] = Query(None, description="分类筛选"),
    search: Optional[str] = Query(None, description="搜索术语或含义")
):
    """
    获取谷子术语列表

    - **skip**: 跳过记录数，用于分页
    - **limit**: 返回记录数，最大500
    - **is_active**: 筛选启用状态
    - **category**: 筛选分类
    - **search**: 搜索术语名称或含义
    """
    terms = guzi_term_dao.find_all(
        skip=skip,
        limit=limit,
        is_active=is_active,
        category=category,
        search=search
    )
    
    # 获取总数（考虑筛选条件）
    total = guzi_term_dao.count(is_active=is_active, category=category, search=search)
    
    page = skip // limit + 1 if limit > 0 else 1
    total_pages = (total + limit - 1) // limit if limit > 0 else 1

    return GuziTermListResponse(
        items=[
            GuziTermResponse(
                id=t.id,
                term=t.term,
                meaning=t.meaning,
                usage_scenario=t.usage_scenario,
                category=t.category,
                example=t.example,
                is_active=t.is_active,
                ai_copywriting=t.ai_copywriting,
                ai_script=t.ai_script,
                video_generated=t.video_generated,
                video_published=t.video_published,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
            for t in terms
        ],
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages
    )


class GuziTermStatsResponse(BaseModel):
    """谷子术语统计响应模型"""
    total: int
    active: int
    inactive: int
    category_stats: dict  # 按分类统计


@router.get("/stats", response_model=GuziTermStatsResponse)
async def get_term_stats(
    category: Optional[str] = Query(None, description="分类筛选")
):
    """
    获取谷子术语统计数据
    """
    total = guzi_term_dao.count(category=category)
    active = guzi_term_dao.count(is_active=True, category=category)
    inactive = guzi_term_dao.count(is_active=False, category=category)
    
    # 按分类统计
    category_stats = {}
    categories = guzi_term_dao.get_all_categories()
    for cat in categories:
        category_stats[cat] = guzi_term_dao.count(category=cat)
    
    return GuziTermStatsResponse(
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
    获取谷子术语总数
    """
    count = guzi_term_dao.count(is_active=is_active, category=category)
    return {"total": count}


@router.get("/{term_id}", response_model=GuziTermResponse)
async def get_term(term_id: str):
    """
    根据ID获取谷子术语详情
    """
    term = guzi_term_dao.find_by_id(term_id)
    if not term:
        raise HTTPException(status_code=404, detail=f"术语 ID {term_id} 不存在")
    return GuziTermResponse(
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


@router.put("/{term_id}", response_model=GuziTermResponse)
async def update_term(term_id: str, term_update: GuziTermUpdate):
    """
    更新谷子术语信息
    """
    existing = guzi_term_dao.find_by_id(term_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"术语 ID {term_id} 不存在")

    updated_term = guzi_term_dao.update(term_id, term_update)
    return GuziTermResponse(
        id=updated_term.id,
        term=updated_term.term,
        meaning=updated_term.meaning,
        usage_scenario=updated_term.usage_scenario,
        category=updated_term.category,
        example=updated_term.example,
        is_active=updated_term.is_active,
        ai_copywriting=updated_term.ai_copywriting,
        ai_script=updated_term.ai_script,
        video_generated=updated_term.video_generated,
        video_published=updated_term.video_published,
        created_at=updated_term.created_at,
        updated_at=updated_term.updated_at,
    )


class UpdateAIContentRequest(BaseModel):
    """更新 AI 生成内容请求模型"""
    ai_copywriting: Optional[str] = Field(default=None, description="AI口播文案")
    ai_script: Optional[str] = Field(default=None, description="AI镜头脚本")


@router.delete("/{term_id}")
async def delete_term(term_id: str):
    """
    删除谷子术语
    """
    existing = guzi_term_dao.find_by_id(term_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"术语 ID 不存在")

    deleted = guzi_term_dao.delete(term_id)
    if deleted:
        return {"message": f"术语 ID {term_id} 已删除", "success": True}
    raise HTTPException(status_code=500, detail="删除失败")


@router.patch("/{term_id}/toggle-video-generated", response_model=GuziTermResponse)
async def toggle_video_generated(term_id: str):
    """
    切换视频生成状态
    取反当前状态（启用→禁用，禁用→启用）
    """
    existing = guzi_term_dao.find_by_id(term_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"术语 ID {term_id} 不存在")

    updated_term = guzi_term_dao.toggle_field(term_id, "video_generated")
    return GuziTermResponse(
        id=updated_term.id,
        term=updated_term.term,
        meaning=updated_term.meaning,
        usage_scenario=updated_term.usage_scenario,
        category=updated_term.category,
        example=updated_term.example,
        is_active=updated_term.is_active,
        ai_copywriting=updated_term.ai_copywriting,
        ai_script=updated_term.ai_script,
        video_generated=updated_term.video_generated,
        video_published=updated_term.video_published,
        created_at=updated_term.created_at,
        updated_at=updated_term.updated_at,
    )


@router.patch("/{term_id}/toggle-video-published", response_model=GuziTermResponse)
async def toggle_video_published(term_id: str):
    """
    切换视频发布状态
    取反当前状态（启用→禁用，禁用→启用）
    """
    existing = guzi_term_dao.find_by_id(term_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"术语 ID {term_id} 不存在")

    updated_term = guzi_term_dao.toggle_field(term_id, "video_published")
    return GuziTermResponse(
        id=updated_term.id,
        term=updated_term.term,
        meaning=updated_term.meaning,
        usage_scenario=updated_term.usage_scenario,
        category=updated_term.category,
        example=updated_term.example,
        is_active=updated_term.is_active,
        ai_copywriting=updated_term.ai_copywriting,
        ai_script=updated_term.ai_script,
        video_generated=updated_term.video_generated,
        video_published=updated_term.video_published,
        created_at=updated_term.created_at,
        updated_at=updated_term.updated_at,
    )


@router.patch("/{term_id}/ai-content", response_model=GuziTermResponse)
async def update_ai_content(term_id: str, data: UpdateAIContentRequest):
    """
    更新术语的 AI 生成内容（口播文案 / 镜头脚本）
    生成完成后自动调用，保存 AI 产出的内容
    """
    existing = guzi_term_dao.find_by_id(term_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"术语 ID {term_id} 不存在")

    updated_term = guzi_term_dao.update_ai_content(
        term_id,
        ai_copywriting=data.ai_copywriting,
        ai_script=data.ai_script,
    )
    return GuziTermResponse(
        id=updated_term.id,
        term=updated_term.term,
        meaning=updated_term.meaning,
        usage_scenario=updated_term.usage_scenario,
        category=updated_term.category,
        example=updated_term.example,
        is_active=updated_term.is_active,
        ai_copywriting=updated_term.ai_copywriting,
        ai_script=updated_term.ai_script,
        video_generated=updated_term.video_generated,
        video_published=updated_term.video_published,
        created_at=updated_term.created_at,
        updated_at=updated_term.updated_at,
    )


