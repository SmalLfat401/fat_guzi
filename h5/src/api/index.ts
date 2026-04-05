/**
 * API 服务层
 * 封装所有后端接口调用
 */
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  GuziProduct,
  ProductFilter,
  CalendarEvent,
  CalendarFilter,
  GuziRelease,
  Notice,
  HomeData,
} from '@/types';

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8879',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const message = error.response?.data?.message || '网络请求失败';
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

/**
 * 首页数据
 */
export async function fetchHomeData(): Promise<HomeData> {
  // 模拟数据
  return {
    notices: [
      {
        id: '1',
        title: '🎉 漫展季来袭！精选谷子优惠等你来',
        type: 'activity',
        isTop: true,
        isRead: false,
        publishTime: '2026-04-01 10:00:00',
      },
      {
        id: '2',
        title: '新增抖音/支付宝小程序入口',
        type: 'info',
        isTop: false,
        isRead: true,
        publishTime: '2026-03-30 15:00:00',
      },
    ],
    events: [
      {
        id: '1',
        title: 'COMICUP30',
        subtitle: '第30届COMICUP漫展',
        type: 'convention',
        startDate: '2026-04-15',
        endDate: '2026-04-16',
        location: '上海新国际博览中心',
        city: '上海',
        cover: 'https://picsum.photos/400/200?random=1',
        status: 'upcoming',
        tags: ['漫展', '同人', '谷子'],
        description: '国内最大型同人漫展，汇集众多谷子周边和同人创作',
        price: 80,
        isFree: false,
      },
      {
        id: '2',
        title: 'BW2026',
        subtitle: 'BilibiliWorld 2026',
        type: 'convention',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        location: '国家会展中心（上海）',
        city: '上海',
        cover: 'https://picsum.photos/400/200?random=2',
        status: 'upcoming',
        tags: ['BW', '二次元', '演唱会'],
        price: 200,
        isFree: false,
      },
      {
        id: '3',
        title: 'CP30',
        subtitle: 'ChinaJoy 2026',
        type: 'exhibition',
        startDate: '2026-07-25',
        endDate: '2026-07-28',
        location: '上海新国际博览中心',
        city: '上海',
        cover: 'https://picsum.photos/400/200?random=3',
        status: 'upcoming',
        tags: ['CJ', '游戏', '展会'],
        price: 150,
        isFree: false,
      },
    ],
    releases: [
      {
        id: '1',
        title: '原神·甘雨 限定手办',
        brand: 'HOBBY',
        series: '原神',
        cover: 'https://picsum.photos/300/300?random=10',
        releaseDate: '2026-04-05 12:00',
        price: 899,
        type: 'physical',
        status: 'upcoming',
        platform: ['淘宝', '京东'],
        tags: ['手办', '限定', '甘雨'],
        description: '原神甘雨限定版手办，高度约22cm',
      },
      {
        id: '2',
        title: '明日方舟·年 粘土人',
        brand: 'GOOD SMILE',
        series: '明日方舟',
        cover: 'https://picsum.photos/300/300?random=11',
        releaseDate: '2026-04-10 10:00',
        price: 450,
        type: 'physical',
        status: 'upcoming',
        platform: ['淘宝', '天猫'],
        tags: ['粘土人', '年', '方舟'],
        description: '粘土人系列，明日方舟年角色',
      },
      {
        id: '3',
        title: '崩坏 星穹铁道 景元 Q版手办',
        brand: 'APEX',
        series: '崩坏：星穹铁道',
        cover: 'https://picsum.photos/300/300?random=12',
        releaseDate: '2026-04-15 10:00',
        price: 328,
        type: 'physical',
        status: 'upcoming',
        platform: ['淘宝', '拼多多'],
        tags: ['Q版', '景元', '铁道'],
        description: 'Q版设计，可爱造型，高度约10cm',
      },
    ],
    products: [
      {
        id: '1',
        name: '原神 派蒙 毛绒挂件',
        cover: 'https://picsum.photos/300/300?random=20',
        images: ['https://picsum.photos/300/300?random=20'],
        price: 49,
        originalPrice: 69,
        category: '挂件',
        tags: ['原神', '派蒙', '毛绒'],
        description: '原神派蒙同款毛绒挂件，柔软舒适',
        isHot: true,
        shopName: '原神旗舰店',
      },
      {
        id: '2',
        name: '明日方舟 阿米娅 毛绒玩偶',
        cover: 'https://picsum.photos/300/300?random=21',
        images: ['https://picsum.photos/300/300?random=21'],
        price: 128,
        originalPrice: 168,
        category: '玩偶',
        tags: ['明日方舟', '阿米娅', '玩偶'],
        description: '明日方舟阿米娅毛绒玩偶，40cm尺寸',
        isHot: true,
        shopName: '鹰角官方旗舰店',
      },
      {
        id: '3',
        name: '崩坏3 芽衣 女武神手办',
        cover: 'https://picsum.photos/300/300?random=22',
        images: ['https://picsum.photos/300/300?random=22'],
        price: 599,
        originalPrice: 799,
        category: '手办',
        tags: ['崩坏3', '芽衣', '女武神'],
        description: '崩坏3雷电芽衣女武神手办，精美涂装',
        isHot: true,
        shopName: '崩坏3旗舰店',
      },
      {
        id: '4',
        name: '咒术回战 五条悟 粘土人',
        cover: 'https://picsum.photos/300/300?random=23',
        images: ['https://picsum.photos/300/300?random=23'],
        price: 380,
        originalPrice: 450,
        category: '手办',
        tags: ['咒术回战', '五条悟', '粘土人'],
        description: '咒术回战五条悟粘土人，可动素体',
        isHot: false,
        shopName: '手办之城',
      },
    ],
  };
}

/**
 * 获取活动日历列表
 */
export async function fetchCalendarEvents(filter?: CalendarFilter): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [
    {
      id: '1',
      title: 'COMICUP30',
      subtitle: '第30届COMICUP漫展',
      type: 'convention',
      startDate: '2026-04-15',
      endDate: '2026-04-16',
      location: '上海新国际博览中心',
      city: '上海',
      cover: 'https://picsum.photos/400/200?random=1',
      status: 'upcoming',
      tags: ['漫展', '同人', '谷子'],
      description: '国内最大型同人漫展',
      price: 80,
      isFree: false,
    },
    {
      id: '2',
      title: 'BW2026',
      subtitle: 'BilibiliWorld 2026',
      type: 'convention',
      startDate: '2026-05-01',
      endDate: '2026-05-03',
      location: '国家会展中心（上海）',
      city: '上海',
      cover: 'https://picsum.photos/400/200?random=2',
      status: 'upcoming',
      tags: ['BW', '二次元'],
      price: 200,
      isFree: false,
    },
    {
      id: '3',
      title: '萤火虫漫展',
      subtitle: '广州萤火虫动漫游戏嘉年华',
      type: 'convention',
      startDate: '2026-06-10',
      endDate: '2026-06-13',
      location: '广州保利世贸博览馆',
      city: '广州',
      cover: 'https://picsum.photos/400/200?random=4',
      status: 'upcoming',
      tags: ['漫展', '广州'],
      price: 60,
      isFree: false,
    },
    {
      id: '4',
      title: 'BML 2026',
      subtitle: 'Bilibili Macro Link',
      type: 'activity',
      startDate: '2026-08-15',
      endDate: '2026-08-17',
      location: '梅赛德斯奔驰文化中心',
      city: '上海',
      cover: 'https://picsum.photos/400/200?random=5',
      status: 'upcoming',
      tags: ['BML', '演唱会'],
      price: 680,
      isFree: false,
    },
  ];

  return events;
}

/**
 * 获取谷子上新日历
 */
export async function fetchGuziReleases(filter?: any): Promise<GuziRelease[]> {
  const releases: GuziRelease[] = [
    {
      id: '1',
      title: '原神·甘雨 限定手办',
      brand: 'HOBBY',
      series: '原神',
      cover: 'https://picsum.photos/300/300?random=10',
      releaseDate: '2026-04-05 12:00',
      price: 899,
      type: 'physical',
      status: 'upcoming',
      platform: ['淘宝', '京东'],
      tags: ['手办', '限定'],
      description: '原神甘雨限定版手办',
    },
    {
      id: '2',
      title: '明日方舟·年 粘土人',
      brand: 'GOOD SMILE',
      series: '明日方舟',
      cover: 'https://picsum.photos/300/300?random=11',
      releaseDate: '2026-04-10 10:00',
      price: 450,
      type: 'physical',
      status: 'upcoming',
      platform: ['淘宝', '天猫'],
      tags: ['粘土人', '年'],
      description: '粘土人系列，明日方舟年角色',
    },
    {
      id: '3',
      title: '崩坏 星穹铁道 景元 Q版手办',
      brand: 'APEX',
      series: '崩坏：星穹铁道',
      cover: 'https://picsum.photos/300/300?random=12',
      releaseDate: '2026-04-15 10:00',
      price: 328,
      type: 'physical',
      status: 'upcoming',
      platform: ['淘宝', '拼多多'],
      tags: ['Q版', '景元'],
      description: 'Q版设计，可爱造型',
    },
  ];

  return releases;
}

/**
 * 获取商品列表
 */
export async function fetchProducts(filter?: ProductFilter): Promise<GuziProduct[]> {
  const products: GuziProduct[] = [
    {
      id: '1',
      name: '原神 派蒙 毛绒挂件',
      cover: 'https://picsum.photos/300/300?random=20',
      images: ['https://picsum.photos/300/300?random=20'],
      price: 49,
      originalPrice: 69,
      category: '挂件',
      tags: ['原神', '派蒙', '毛绒'],
      description: '原神派蒙同款毛绒挂件',
      isHot: true,
      shopName: '原神旗舰店',
    },
    {
      id: '2',
      name: '明日方舟 阿米娅 毛绒玩偶',
      cover: 'https://picsum.photos/300/300?random=21',
      images: ['https://picsum.photos/300/300?random=21'],
      price: 128,
      originalPrice: 168,
      category: '玩偶',
      tags: ['明日方舟', '阿米娅', '玩偶'],
      description: '明日方舟阿米娅毛绒玩偶',
      isHot: true,
      shopName: '鹰角官方旗舰店',
    },
    {
      id: '3',
      name: '崩坏3 芽衣 女武神手办',
      cover: 'https://picsum.photos/300/300?random=22',
      images: ['https://picsum.photos/300/300?random=22'],
      price: 599,
      originalPrice: 799,
      category: '手办',
      tags: ['崩坏3', '芽衣', '女武神'],
      description: '崩坏3雷电芽衣女武神手办',
      isHot: true,
      shopName: '崩坏3旗舰店',
    },
    {
      id: '4',
      name: '咒术回战 五条悟 粘土人',
      cover: 'https://picsum.photos/300/300?random=23',
      images: ['https://picsum.photos/300/300?random=23'],
      price: 380,
      originalPrice: 450,
      category: '手办',
      tags: ['咒术回战', '五条悟', '粘土人'],
      description: '咒术回战五条悟粘土人',
      isHot: false,
      shopName: '手办之城',
    },
    {
      id: '5',
      name: '蓝锁 凪诚士郎 趴趴玩偶',
      cover: 'https://picsum.photos/300/300?random=24',
      images: ['https://picsum.photos/300/300?random=24'],
      price: 98,
      originalPrice: 128,
      category: '玩偶',
      tags: ['蓝色监狱', '凪诚士郎', '趴趴'],
      description: '蓝色监狱凪诚士郎趴趴玩偶',
      isHot: true,
      shopName: '二次元周边店',
    },
    {
      id: '6',
      name: '初音未来 演唱会限定徽章',
      cover: 'https://picsum.photos/300/300?random=25',
      images: ['https://picsum.photos/300/300?random=25'],
      price: 88,
      originalPrice: 120,
      category: '徽章',
      tags: ['初音', '演唱会', '限定'],
      description: '初音未来2026年巡回演唱会限定徽章',
      isHot: false,
      shopName: '初音官方店',
    },
  ];

  return products;
}

/**
 * 获取商品详情
 */
export async function fetchProductDetail(id: string): Promise<GuziProduct> {
  const products: GuziProduct[] = [
    {
      id: '1',
      name: '原神 派蒙 毛绒挂件',
      cover: 'https://picsum.photos/300/300?random=20',
      images: [
        'https://picsum.photos/300/300?random=20',
        'https://picsum.photos/300/300?random=201',
        'https://picsum.photos/300/300?random=202',
        'https://picsum.photos/300/300?random=203',
      ],
      price: 49,
      originalPrice: 69,
      category: '挂件',
      tags: ['原神', '派蒙', '毛绒'],
      description: '【官方正版】原神派蒙同款毛绒挂件，柔软舒适，采用优质面料，适合挂在包上或钥匙上，是你外出必备的可爱搭档！',
      isHot: true,
      shopName: '原神旗舰店',
      createdAt: '2026-03-20',
      stock: 156,
      sales: 2340,
      rating: 4.8,
      platform: 'taobao',
      productUrl: 'https://shop.taobao.com',
    },
    {
      id: '2',
      name: '明日方舟 阿米娅 毛绒玩偶',
      cover: 'https://picsum.photos/300/300?random=21',
      images: [
        'https://picsum.photos/300/300?random=21',
        'https://picsum.photos/300/300?random=211',
      ],
      price: 128,
      originalPrice: 168,
      category: '玩偶',
      tags: ['明日方舟', '阿米娅', '玩偶'],
      description: '明日方舟阿米娅毛绒玩偶，40cm尺寸，优质短毛绒面料，手感细腻柔软。',
      isHot: true,
      shopName: '鹰角官方旗舰店',
      createdAt: '2026-03-18',
      stock: 89,
      sales: 1560,
      rating: 4.9,
      platform: 'taobao',
      productUrl: 'https://shop.taobao.com',
    },
    {
      id: '3',
      name: '崩坏3 芽衣 女武神手办',
      cover: 'https://picsum.photos/300/300?random=22',
      images: [
        'https://picsum.photos/300/300?random=22',
        'https://picsum.photos/300/300?random=221',
      ],
      price: 599,
      originalPrice: 799,
      category: '手办',
      tags: ['崩坏3', '芽衣', '女武神'],
      description: '崩坏3雷电芽衣女武神手办，精美涂装，高度约22cm，收藏价值极高。',
      isHot: true,
      shopName: '崩坏3旗舰店',
      createdAt: '2026-03-15',
      stock: 23,
      sales: 456,
      rating: 4.7,
      platform: 'jd',
      productUrl: 'https://shop.jd.com',
    },
    {
      id: '4',
      name: '咒术回战 五条悟 粘土人',
      cover: 'https://picsum.photos/300/300?random=23',
      images: [
        'https://picsum.photos/300/300?random=23',
      ],
      price: 380,
      originalPrice: 450,
      category: '手办',
      tags: ['咒术回战', '五条悟', '粘土人'],
      description: '咒术回战五条悟粘土人，可动素体，细节精致，高度约10cm。',
      isHot: false,
      shopName: '手办之城',
      createdAt: '2026-03-10',
      stock: 45,
      sales: 789,
      rating: 4.6,
      platform: 'taobao',
      productUrl: 'https://shop.taobao.com',
    },
  ];

  const product = products.find((p) => p.id === id);
  if (!product) {
    throw new Error('商品不存在');
  }
  return product;
}

/**
 * 获取公告列表
 */
export async function fetchNotices(): Promise<Notice[]> {
  return [
    {
      id: '1',
      title: '🎉 漫展季来袭！精选谷子优惠等你来',
      type: 'activity',
      isTop: true,
      isRead: false,
      publishTime: '2026-04-01 10:00:00',
    },
    {
      id: '2',
      title: '新增抖音/支付宝小程序入口',
      type: 'info',
      isTop: false,
      isRead: true,
      publishTime: '2026-03-30 15:00:00',
    },
  ];
}

export default {
  fetchHomeData,
  fetchCalendarEvents,
  fetchGuziReleases,
  fetchProducts,
  fetchProductDetail,
  fetchNotices,
};
