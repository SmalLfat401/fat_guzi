"""
发布渠道配置API路由
用于管理内容发布的目标平台（抖音、小红书等）
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from app.models.publish_channel import (
    PublishChannelCreate,
    PublishChannelUpdate,
    PublishChannelResponse,
)
from app.database.publish_channel_dao import publish_channel_dao

router = APIRouter(prefix="/publish-channels", tags=["发布渠道管理"])


@router.get("", response_model=List[PublishChannelResponse])
async def get_channels(
    is_active: Optional[bool] = Query(None, description="筛选启用状态")
):
    """
    获取所有发布渠道

    - 不传 is_active: 返回所有
    - is_active=True: 只返回已启用的
    - is_active=False: 只返回已禁用的
    """
    if is_active is True:
        return [PublishChannelResponse(**c.model_dump()) for c in publish_channel_dao.find_active()]
    return [PublishChannelResponse(**c.model_dump()) for c in publish_channel_dao.find_all()]


@router.get("/{channel_id}", response_model=PublishChannelResponse)
async def get_channel(channel_id: str):
    channel = publish_channel_dao.find_by_id(channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail=f"渠道 ID {channel_id} 不存在")
    return PublishChannelResponse(**channel.model_dump())


@router.post("", response_model=PublishChannelResponse, status_code=201)
async def create_channel(channel: PublishChannelCreate):
    """创建发布渠道"""
    existing = publish_channel_dao.find_by_name(channel.name)
    if existing:
        raise HTTPException(status_code=400, detail=f"渠道名称 '{channel.name}' 已存在")
    created = publish_channel_dao.create(channel)
    return PublishChannelResponse(**created.model_dump())


@router.put("/{channel_id}", response_model=PublishChannelResponse)
async def update_channel(channel_id: str, update: PublishChannelUpdate):
    """更新发布渠道"""
    existing = publish_channel_dao.find_by_id(channel_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"渠道 ID {channel_id} 不存在")
    updated = publish_channel_dao.update(channel_id, update)
    return PublishChannelResponse(**updated.model_dump())


@router.delete("/{channel_id}")
async def delete_channel(channel_id: str):
    """删除发布渠道"""
    existing = publish_channel_dao.find_by_id(channel_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"渠道 ID {channel_id} 不存在")
    success = publish_channel_dao.delete(channel_id)
    if success:
        return {"message": f"渠道 '{existing.name}' 已删除", "success": True}
    raise HTTPException(status_code=500, detail="删除失败")
