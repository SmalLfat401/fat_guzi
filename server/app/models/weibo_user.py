"""
微博用户数据模型
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class WeiboUser(BaseModel):
    """微博用户模型"""
    uid: str = Field(..., description="用户ID，唯一标识")
    nickname: str = Field(..., description="用户昵称")
    profile_url: Optional[str] = Field(default=None, description="主页链接，格式: https://weibo.com/u/xxx")
    followers_count: Optional[int] = Field(default=None, description="粉丝数")
    is_active: bool = Field(default=True, description="是否启用监控")
    notes: Optional[str] = Field(default=None, description="备注")
    categories: List[str] = Field(default_factory=list, description="关联的标签ID列表")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="添加时间")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="更新时间")
    last_crawled_at: Optional[datetime] = Field(default=None, description="最后抓取时间")

    def model_post_init(self, __context) -> None:
        """自动填充缺失字段"""
        if not self.profile_url:
            self.profile_url = f"https://weibo.com/u/{self.uid}"


class WeiboUserCreate(BaseModel):
    """创建微博用户请求模型"""
    uid: str = Field(..., description="用户ID，唯一标识")
    nickname: str = Field(..., description="用户昵称")
    profile_url: Optional[str] = Field(default=None, description="主页链接")
    followers_count: Optional[int] = Field(default=None, description="粉丝数")
    notes: Optional[str] = Field(default=None, description="备注")
    categories: List[str] = Field(default_factory=list, description="关联的标签ID列表")

    def to_user(self) -> WeiboUser:
        """转换为WeiboUser模型"""
        profile_url = self.profile_url
        if not profile_url:
            profile_url = f"https://weibo.com/u/{self.uid}"

        return WeiboUser(
            uid=self.uid,
            nickname=self.nickname,
            profile_url=profile_url,
            followers_count=self.followers_count,
            notes=self.notes,
            categories=self.categories
        )


class WeiboUserUpdate(BaseModel):
    """更新微博用户请求模型"""
    nickname: Optional[str] = Field(default=None, description="用户昵称")
    profile_url: Optional[str] = Field(default=None, description="主页链接")
    followers_count: Optional[int] = Field(default=None, description="粉丝数")
    is_active: Optional[bool] = Field(default=None, description="是否启用监控")
    notes: Optional[str] = Field(default=None, description="备注")
    categories: Optional[List[str]] = Field(default=None, description="关联的标签ID列表")


class WeiboUserResponse(BaseModel):
    """微博用户响应模型"""
    uid: str
    nickname: str
    profile_url: Optional[str] = None
    followers_count: Optional[int] = None
    is_active: bool = True
    notes: Optional[str] = None
    categories: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    last_crawled_at: Optional[datetime] = None

    def model_post_init(self, __context) -> None:
        """自动填充缺失字段"""
        if not self.profile_url:
            self.profile_url = f"https://weibo.com/u/{self.uid}"
