// 发布渠道类型
export interface PublishChannel {
  id: string;
  name: string;
  icon: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublishChannelCreate {
  name: string;
  icon?: string;
  is_active?: boolean;
}

export interface PublishChannelUpdate {
  name?: string;
  icon?: string;
  is_active?: boolean;
}
