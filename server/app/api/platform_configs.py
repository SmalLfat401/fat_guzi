"""
平台配置API路由
用于管理电商平台（阿里妈妈、京东联盟、多多客）的API配置
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from app.models.platform_config import (
    PlatformConfigCreate,
    PlatformConfigUpdate,
    PlatformConfigResponse,
    SUPPORTED_PLATFORMS
)
from app.database.platform_config_dao import platform_config_dao

router = APIRouter(prefix="/platform-configs", tags=["平台配置管理"])


@router.get("", response_model=List[PlatformConfigResponse])
async def get_platform_configs(
    platform_id: Optional[str] = Query(None, description="平台标识: alimama/jd/pdd，不传则返回所有")
):
    """
    获取平台配置

    - 不传 platform_id: 返回所有平台配置
    - 传 platform_id: 返回指定平台配置
    """
    if platform_id:
        config = platform_config_dao.find_by_platform_id(platform_id)
        if not config:
            raise HTTPException(status_code=404, detail=f"平台 '{platform_id}' 不存在")
        return [config]
    return platform_config_dao.find_all()


@router.get("/supported-platforms")
async def get_supported_platforms():
    """
    获取支持的平台列表

    返回系统支持的所有电商平台基本信息（不含配置）
    """
    return SUPPORTED_PLATFORMS


@router.get("/active", response_model=List[PlatformConfigResponse])
async def get_active_platforms():
    """
    获取已启用的平台配置

    只返回当前is_active=True的平台配置
    """
    configs = platform_config_dao.find_active()
    return configs


@router.get("/configured", response_model=List[PlatformConfigResponse])
async def get_configured_platforms():
    """
    获取已配置AppKey的平台

    返回已经填写过AppKey和AppSecret的平台
    """
    configs = platform_config_dao.find_configured()
    return configs


@router.post("", response_model=PlatformConfigResponse, status_code=201)
async def create_platform_config(config: PlatformConfigCreate):
    """
    创建平台配置

    - **platform_id**: 平台标识 (必填)
    - **platform_name**: 平台名称 (必填)
    - **app_key**: AppKey (可选)
    - **app_secret**: AppSecret (可选)
    - **is_active**: 是否启用 (默认False)
    """
    existing = platform_config_dao.find_by_platform_id(config.platform_id)
    if existing:
        raise HTTPException(status_code=400, detail=f"平台 '{config.platform_id}' 配置已存在")

    created_config = platform_config_dao.create(config)
    return created_config


@router.put("", response_model=PlatformConfigResponse)
async def update_platform_config(
    platform_id: str = Query(..., description="平台标识: alimama/jd/pdd"),
    config_update: PlatformConfigUpdate = None
):
    """
    更新平台配置

    - **platform_id**: 平台标识 (alimama/jd/pdd)
    - **app_key**: AppKey (可选)
    - **app_secret**: AppSecret (可选)
    - **is_active**: 是否启用 (可选)
    """
    existing = platform_config_dao.find_by_platform_id(platform_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"平台 '{platform_id}' 不存在")

    updated_config = platform_config_dao.update(platform_id, config_update)
    return updated_config


@router.patch("/active", response_model=PlatformConfigResponse)
async def toggle_platform_active(
    platform_id: str = Query(..., description="平台标识: alimama/jd/pdd"),
    is_active: bool = Query(..., description="是否启用")
):
    """
    切换平台启用状态

    - **platform_id**: 平台标识 (alimama/jd/pdd)
    - **is_active**: 是否启用
    """
    existing = platform_config_dao.find_by_platform_id(platform_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"平台 '{platform_id}' 不存在")

    from app.models.platform_config import PlatformConfigUpdate
    updated_config = platform_config_dao.update(platform_id, PlatformConfigUpdate(is_active=is_active))
    return updated_config


@router.delete("")
async def delete_platform_config(platform_id: str = Query(..., description="平台标识: alimama/jd/pdd")):
    """
    删除平台配置

    清空指定平台的AppKey和AppSecret，并禁用该平台
    - **platform_id**: 平台标识 (alimama/jd/pdd)
    """
    existing = platform_config_dao.find_by_platform_id(platform_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"平台 '{platform_id}' 不存在")

    success = platform_config_dao.delete(platform_id)
    if success:
        return {"message": f"平台 '{platform_id}' 配置已清空", "success": True}
    raise HTTPException(status_code=500, detail="删除失败")
