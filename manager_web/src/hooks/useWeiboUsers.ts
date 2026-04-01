import { useState } from 'react';
import type { WeiboUser, WeiboUserCreate, WeiboUserUpdate } from '../types/weibo';
import { weiboUserApi } from '../api/weiboUser';

export const useWeiboUsers = () => {
  const [users, setUsers] = useState<WeiboUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchUsers = async (skip = 0, limit = 100, isActive?: boolean, nickname?: string, categoryIds?: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const data = await weiboUserApi.getUsers(skip, limit, isActive, nickname, categoryIds);
      setUsers(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (
    user: WeiboUserCreate,
    fetchParams?: { skip?: number; limit?: number; isActive?: boolean; nickname?: string; categoryIds?: string[] }
  ) => {
    setLoading(true);
    setError(null);
    try {
      await weiboUserApi.createUser(user);
      await fetchUsers(
        fetchParams?.skip ?? 0,
        fetchParams?.limit ?? 20,
        fetchParams?.isActive,
        fetchParams?.nickname,
        fetchParams?.categoryIds
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (
    uid: string,
    user: WeiboUserUpdate,
    fetchParams?: { skip?: number; limit?: number; isActive?: boolean; nickname?: string; categoryIds?: string[] }
  ) => {
    setLoading(true);
    setError(null);
    try {
      await weiboUserApi.updateUser(uid, user);
      await fetchUsers(
        fetchParams?.skip ?? 0,
        fetchParams?.limit ?? 20,
        fetchParams?.isActive,
        fetchParams?.nickname,
        fetchParams?.categoryIds
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (
    uid: string,
    fetchParams?: { skip?: number; limit?: number; isActive?: boolean; nickname?: string; categoryIds?: string[] }
  ) => {
    setLoading(true);
    setError(null);
    try {
      await weiboUserApi.deleteUser(uid);
      await fetchUsers(
        fetchParams?.skip ?? 0,
        fetchParams?.limit ?? 20,
        fetchParams?.isActive,
        fetchParams?.nickname,
        fetchParams?.categoryIds
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    users,
    loading,
    error,
    total,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  };
};
