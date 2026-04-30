/**
 * 商品列表页 Context
 * 缓存列表数据，从详情页返回时不重新请求
 */
import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { fetchProducts, fetchCategories, fetchTags } from '@/api';
import type { GuziProductH5, GuziCategoryWithSubs, GuziTag } from '@/types';

const PAGE_SIZE = 40;

interface ProductsContextValue {
  products: GuziProductH5[];
  setProducts: React.Dispatch<React.SetStateAction<GuziProductH5[]>>;
  /** filteredProducts 由 useMemo 实时从 products 推导，无需 setter */
  filteredProducts: GuziProductH5[];
  loading: boolean;
  loadingMore: boolean;
  setLoadingMore: React.Dispatch<React.SetStateAction<boolean>>;
  total: number;
  setTotal: React.Dispatch<React.SetStateAction<number>>;
  categories: GuziCategoryWithSubs[];
  ipTags: GuziTag[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchValue: string;
  setSearchValue: (v: string) => void;
  selectedIpTag: string | null;
  setSelectedIpTag: (tagId: string | null) => void;
  cascadeValue: [string, string] | null;
  setCascadeValue: (v: [string, string] | null) => void;
  selectedSubCatId: string | null;
  ipTagIdToName: Map<string, string>;
  subCatIdToName: Map<string, string>;
  ensureLoaded: () => Promise<void>;
  scrollTop: number;
  setScrollTop: (top: number) => void;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<GuziProductH5[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [ipTags, setIpTags] = useState<GuziTag[]>([]);
  const [categories, setCategories] = useState<GuziCategoryWithSubs[]>([]);
  const [selectedIpTag, setSelectedIpTag] = useState<string | null>(null);
  const [cascadeValue, setCascadeValue] = useState<[string, string] | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const loadedRef = useRef(false);

  // 用 ref 持有最新 categories/ipTags，保证 map 在异步回调中是最新的
  const categoriesRef = useRef<GuziCategoryWithSubs[]>([]);
  const ipTagsRef = useRef<GuziTag[]>([]);

  const selectedSubCatId = cascadeValue?.[1] || null;

  // 从 categories/ipTags 实时构建 Map（useMemo 依赖 categories/ipTags 数组）
  const subCatIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      for (const sub of cat.sub_categories || []) {
        map.set(sub._id, sub.name);
      }
    }
    categoriesRef.current = categories;
    return map;
  }, [categories]);

  const ipTagIdToName = useMemo(() => {
    const map = new Map(ipTags.map(t => [t._id, t.name]));
    ipTagsRef.current = ipTags;
    return map;
  }, [ipTags]);

  // filteredProducts 由 useMemo 实时推导，无需额外 setter
  const filteredProducts = useMemo(() => {
    let filtered = [...products];
    if (activeTab === 'hot') {
      filtered = filtered.filter(p => p.isHot);
    }
    if (searchValue) {
      const lower = searchValue.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(lower) ||
        p.description?.toLowerCase().includes(lower)
      );
    }
    return filtered;
  }, [products, activeTab, searchValue]);

  // 初始化加载（保证只执行一次）
  const loadInitialData = useCallback(async () => {
    if (loadedRef.current) return;
    setLoading(true);
    try {
      const [categoriesData, ipTagsData] = await Promise.all([
        fetchCategories(true),
        fetchTags('ip'),
      ]);
      setCategories(categoriesData);
      setIpTags(ipTagsData);

      const result = await fetchProducts(
        { is_active: true, page: 1, pageSize: PAGE_SIZE },
        subCatIdToName,
        ipTagIdToName
      );
      setProducts(result.items);
      setTotal(result.total);
      loadedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 切换 IP 标签 → 重新请求
  const handleSetSelectedIpTag = useCallback((tagId: string | null) => {
    setSelectedIpTag(tagId);
    setLoading(true);
    setProducts([]);
    fetchProducts({
      is_active: true,
      ipTag: tagId || undefined,
      categoryTag: cascadeValue?.[1] || undefined,
      page: 1,
      pageSize: PAGE_SIZE,
    }, subCatIdToName, ipTagIdToName)
      .then(result => {
        setProducts(result.items);
        setTotal(result.total);
      })
      .finally(() => setLoading(false));
  }, [cascadeValue, subCatIdToName, ipTagIdToName]); // eslint-disable-line react-hooks/exhaustive-deps

  // 切换级联分类 → 重新请求
  const handleSetCascadeValue = useCallback((value: [string, string] | null) => {
    setCascadeValue(value);
    setLoading(true);
    setProducts([]);
    fetchProducts({
      is_active: true,
      ipTag: selectedIpTag || undefined,
      categoryTag: value?.[1] || undefined,
      page: 1,
      pageSize: PAGE_SIZE,
    }, subCatIdToName, ipTagIdToName)
      .then(result => {
        setProducts(result.items);
        setTotal(result.total);
      })
      .finally(() => setLoading(false));
  }, [selectedIpTag, subCatIdToName, ipTagIdToName]); // eslint-disable-line react-hooks/exhaustive-deps

  const value: ProductsContextValue = {
    products, setProducts,
    filteredProducts,
    loading, loadingMore, setLoadingMore, total, setTotal,
    categories, ipTags,
    activeTab, setActiveTab,
    searchValue, setSearchValue,
    selectedIpTag, setSelectedIpTag: handleSetSelectedIpTag,
    cascadeValue, setCascadeValue: handleSetCascadeValue,
    selectedSubCatId,
    ipTagIdToName, subCatIdToName,
    ensureLoaded: loadInitialData,
    scrollTop, setScrollTop,
  };

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider');
  return ctx;
}

export { PAGE_SIZE };
