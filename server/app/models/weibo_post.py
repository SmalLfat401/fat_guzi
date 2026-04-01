"""
微博帖子数据模型 - 用于存储微博API获取的帖子数据
集合名称: weibo_userNew
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import IntEnum


class IntelStatus(IntEnum):
    """
    情报分析状态枚举

    0 - 未处理      : 待规则提取
    1 - 提取成功    : 规则提取直接命中，无需AI
    2 - AI待介入    : 规则置信度不足，等待AI批次处理
    3 - 确认不相关  : 规则判定为非漫展内容，正常排除
    4 - 处理异常    : 提取过程中发生错误，需要排查或重试
    """
    UNPROCESSED = 0   # 未处理（默认值）
    SUCCESS = 1       # 提取成功
    AI_PENDING = 2     # 等待AI介入
    NOT_RELATED = 3    # 确认不相关
    FAILED = 4         # 处理异常


class WeiboUserInfo(BaseModel):
    """微博用户信息（嵌套在帖子中）"""
    id: int = Field(..., description="用户ID")
    idstr: str = Field(..., description="用户ID字符串")
    screen_name: str = Field(..., description="用户昵称")
    profile_url: Optional[str] = Field(default=None, description="主页链接")
    profile_image_url: Optional[str] = Field(default=None, description="头像URL")
    avatar_large: Optional[str] = Field(default=None, description="大头像URL")
    avatar_hd: Optional[str] = Field(default=None, description="高清头像URL")
    verified: bool = Field(default=False, description="是否认证")
    verified_type: Optional[int] = Field(default=None, description="认证类型")
    domain: Optional[str] = Field(default=None, description="用户域名")
    mbrank: Optional[int] = Field(default=None, description="会员等级")
    mbtype: Optional[int] = Field(default=None, description="会员类型")
    follower_count: Optional[int] = Field(default=None, description="粉丝数")


class WeiboVisible(BaseModel):
    """可见性信息"""
    type: int = Field(default=0, description="类型")
    list_id: int = Field(default=0, description="列表ID")


class WeiboPicInfo(BaseModel):
    """图片信息"""
    pic_id: Optional[str] = Field(default=None, description="图片ID")
    thumbnail: Optional[Dict[str, Any]] = Field(default=None, description="缩略图")
    bmiddle: Optional[Dict[str, Any]] = Field(default=None, description="中等图")
    large: Optional[Dict[str, Any]] = Field(default=None, description="大图")
    original: Optional[Dict[str, Any]] = Field(default=None, description="原图")
    largest: Optional[Dict[str, Any]] = Field(default=None, description="最大图")


class WeiboPost(BaseModel):
    """微博帖子模型 - 对应 weibo_userNew 集合

    注意：pic_infos 字段已废弃，如需图片详细信息可从 pic_ids 拼接URL:
    - 缩略图: https://wx{s}.sinaimg.cn/wap180/{pic_id}.jpg
    - 中图: https://wx{s}.sinaimg.cn/wap360/{pic_id}.jpg
    - 大图: https://wx{s}.sinaimg.cn/orj960/{pic_id}.jpg
    - 原图: https://wx{s}.sinaimg.cn/orj1080/{pic_id}.jpg
    其中 s 为服务器编号(1-4)
    """
    # 主键 - 使用微博的mid作为主键
    mid: str = Field(..., description="微博MID，唯一标识")
    mblogid: Optional[str] = Field(default=None, description="微博mblogid（用于详情跳转/查询）")

    # 用户信息
    user_id: int = Field(..., description="发布用户ID")
    user_idstr: str = Field(..., description="发布用户ID字符串")
    user_nickname: str = Field(..., description="发布用户昵称")

    # 微博内容
    text: Optional[str] = Field(default=None, description="微博内容（HTML）")
    text_raw: Optional[str] = Field(default=None, description="微博内容（纯文本）")

    # 时间信息
    created_at: str = Field(..., description="创建时间（原始格式）")
    created_at_dt: Optional[datetime] = Field(default=None, description="创建时间（解析后）")

    # 互动数据
    reposts_count: int = Field(default=0, description="转发数")
    comments_count: int = Field(default=0, description="评论数")
    attitudes_count: int = Field(default=0, description="点赞数")

    # 来源信息
    source: Optional[str] = Field(default=None, description="发布来源")
    region_name: Optional[str] = Field(default=None, description="发布地区")

    # 图片信息（已废弃，如需图片可从 continue_tag scheme 获取）
    # pic_ids: List[str] = Field(default_factory=list, description="图片ID列表")
    # pic_num: int = Field(default=0, description="图片数量")

    # 继续阅读标签（用于获取长文本全文）
    continue_tag: Optional[Dict[str, Any]] = Field(default=None, description="全文标签，用于获取完整正文")

    # 关联的微博用户UID（爬取的来源）
    source_uid: str = Field(..., description="来源微博用户UID")

    # 元数据
    crawled_at: datetime = Field(default_factory=datetime.utcnow, description="爬取时间")
    crawl_source: str = Field(default="weibo_api", description="爬取来源")

    # 置顶状态
    is_top: bool = Field(default=False, description="是否置顶")

    # 长文本内容（通过longtext接口获取的完整正文）
    long_text: Optional[str] = Field(default=None, description="长文本内容")

    # ========== 情报分析相关字段 ==========
    # 用于热点追踪系统，避免重复分析
    # intel_analyzed 已废弃，迁移至 intel_status
    intel_analyzed: bool = Field(default=False, description="[已废弃]兼容旧字段，优先读取intel_status")
    intel_status: Optional[int] = Field(
        default=IntelStatus.UNPROCESSED,
        description="情报分析状态: 0未处理/1提取成功/2AI待介入/3确认不相关/4处理异常"
    )
    intel_confidence: float = Field(
        default=0.0,
        description="规则匹配置信度 0.0-1.0"
    )
    intel_analyzed_at: Optional[datetime] = Field(default=None, description="情报分析时间")
    intel_extracted_info: Optional[Dict[str, Any]] = Field(
        default=None,
        description="从帖子中提取的情报信息（活动名称、时间、地点等）"
    )

    # ========== 以下字段已废弃，保留字段定义以兼容旧数据 ==========
    # pic_infos: Optional[Dict[str, Any]] = Field(default=None, description="[已废弃]图片详细信息")
    # visible: Optional[Dict[str, Any]] = Field(default=None, description="[已废弃]可见性信息")
    # is_long_text: bool = Field(default=False, description="[已废弃]是否长文本")
    # is_top: bool = Field(default=False, description="[已废弃]是否置顶")
    # text_length: Optional[int] = Field(default=None, description="[已废弃]内容长度")
    # id: int = Field(..., description="[已废弃]微博ID，与mid重复")
    # idstr: str = Field(..., description="[已废弃]微博ID字符串，与mid重复")
    # mblogid: Optional[str] = Field(default=None, description="[已废弃]微博mblogid，与mid重复")


class WeiboPostResponse(BaseModel):
    """微博帖子响应模型"""
    mid: str
    user_id: int
    user_nickname: str
    text_raw: Optional[str] = None
    created_at: str
    reposts_count: int = 0
    comments_count: int = 0
    attitudes_count: int = 0
    pic_num: int = 0
    source_uid: str
    crawled_at: datetime
