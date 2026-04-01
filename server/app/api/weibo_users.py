"""
微博用户管理API路由
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from app.models.weibo_user import WeiboUserCreate, WeiboUserUpdate, WeiboUserResponse
from app.database.weibo_user_dao import weibo_user_dao

router = APIRouter(prefix="/weibo-users", tags=["微博用户管理"])


class WeiboUserListResponse(BaseModel):
    """微博用户列表响应模型（含分页信息）"""
    items: List[WeiboUserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class WeiboUserStatsResponse(BaseModel):
    """微博用户统计响应模型"""
    total: int
    active: int
    inactive: int


@router.post("", response_model=WeiboUserResponse, status_code=201)
async def create_weibo_user(user: WeiboUserCreate):
    """
    创建微博用户

    添加一个新的目标微博用户到监控列表

    - **uid**: 微博用户ID (必填)
    - **nickname**: 用户昵称 (必填)
    - **profile_url**: 主页链接 (可选，不填则自动生成)
    - **followers_count**: 粉丝数 (可选)
    - **notes**: 备注 (可选)
    """
    existing = weibo_user_dao.find_by_uid(user.uid)
    if existing:
        raise HTTPException(status_code=400, detail=f"用户 {user.uid} 已存在")
    
    created_user = weibo_user_dao.create(user)
    return created_user


@router.get("", response_model=WeiboUserListResponse)
async def get_weibo_users(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(20, ge=1, le=500, description="返回记录数"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    nickname: Optional[str] = Query(None, description="昵称模糊搜索"),
    category_ids: Optional[str] = Query(None, description="标签ID列表，逗号分隔")
):
    """获取微博用户列表"""
    # 解析标签ID列表
    cat_ids = None
    if category_ids:
        cat_ids = [c.strip() for c in category_ids.split(",") if c.strip()]

    users = weibo_user_dao.find_all(
        skip=skip, limit=limit, is_active=is_active,
        nickname=nickname, category_ids=cat_ids
    )
    total = weibo_user_dao.count(
        is_active=is_active, nickname=nickname, category_ids=cat_ids
    )
    page = skip // limit + 1 if limit > 0 else 1
    total_pages = (total + limit - 1) // limit if limit > 0 else 1

    return WeiboUserListResponse(
        items=[WeiboUserResponse(**user.model_dump()) for user in users],
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages
    )


@router.get("/count")
async def get_weibo_user_count(is_active: Optional[bool] = Query(None, description="是否启用")):
    """
    获取微博用户总数
    """
    count = weibo_user_dao.count(is_active=is_active)
    return {"total": count}


@router.get("/stats", response_model=WeiboUserStatsResponse)
async def get_weibo_user_stats():
    """获取微博用户统计数据"""
    total = weibo_user_dao.count()
    active = weibo_user_dao.count(is_active=True)
    inactive = weibo_user_dao.count(is_active=False)
    return WeiboUserStatsResponse(total=total, active=active, inactive=inactive)


@router.get("/{uid}", response_model=WeiboUserResponse)
async def get_weibo_user(uid: str):
    """
    根据UID获取微博用户详情
    """
    user = weibo_user_dao.find_by_uid(uid)
    if not user:
        raise HTTPException(status_code=404, detail=f"用户 {uid} 不存在")
    return user


@router.put("/{uid}", response_model=WeiboUserResponse)
async def update_weibo_user(uid: str, user_update: WeiboUserUpdate):
    """
    更新微博用户信息
    """
    existing = weibo_user_dao.find_by_uid(uid)
    if not existing:
        raise HTTPException(status_code=404, detail=f"用户 {uid} 不存在")

    updated_user = weibo_user_dao.update(uid, user_update)
    return updated_user


@router.delete("/{uid}")
async def delete_weibo_user(uid: str):
    """
    删除微博用户
    """
    existing = weibo_user_dao.find_by_uid(uid)
    if not existing:
        raise HTTPException(status_code=404, detail=f"用户 {uid} 不存在")

    deleted = weibo_user_dao.delete(uid)
    if deleted:
        return {"message": f"用户 {uid} 已删除", "success": True}
    raise HTTPException(status_code=500, detail="删除失败")
