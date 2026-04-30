/**
 * 求谷表单页面
 * 用户可以提交想要的谷子信息
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Form, Input, TextArea, Button, Popup, Toast } from 'antd-mobile';
import { fetchCategories, fetchTags, submitWantGuzi } from '@/api';
import { tracker } from '@/utils/tracker';
import type { GuziCategoryWithSubs, GuziTag } from '@/types';
import './index.scss';

const WantGuziPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<GuziCategoryWithSubs[]>([]);
  const [ipTags, setIpTags] = useState<GuziTag[]>([]);
  const [categoryVisible, setCategoryVisible] = useState(false);
  const [ipSelectorVisible, setIpSelectorVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState<'first' | 'second'>('first');
  const [selectedFirstLevel, setSelectedFirstLevel] = useState<GuziCategoryWithSubs | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedIpTag, setSelectedIpTag] = useState<GuziTag | null>(null);
  const [form] = Form.useForm();

  // 加载分类和IP标签
  useEffect(() => {
    const loadData = async () => {
      try {
        const [catData, tagData] = await Promise.all([
          fetchCategories(true),
          fetchTags('ip'),
        ]);
        setCategories(catData);
        setIpTags(tagData);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  // 过滤显示的IP标签（只显示在H5显示的）
  const displayIpTags = useMemo(() => {
    return ipTags.filter((tag) => tag.isActive !== false);
  }, [ipTags]);

  // 分类选项
  const categoryOptions = categories.map((cat) => ({
    label: cat.name,
    value: cat._id,
    children: (cat.sub_categories || []).map((sub) => ({
      label: sub.name,
      value: sub._id,
    })),
  }));

  // 获取已选分类的显示名称
  const getSelectedCategoryLabel = () => {
    if (selectedCategory.length === 0) return '请选择分类（可不选）';
    const firstLevel = categories.find((c) => c._id === selectedCategory[0]);
    const secondLevel = firstLevel?.sub_categories?.find((s) => s._id === selectedCategory[1]);
    if (firstLevel && secondLevel) {
      return `${firstLevel.name} / ${secondLevel.name}`;
    }
    return '已选择';
  };

  // 分类选择
  const handleFirstLevelClick = (cat: GuziCategoryWithSubs) => {
    setSelectedFirstLevel(cat);
    setCurrentStep('second');
  };

  const handleSecondLevelClick = (subId: string) => {
    if (selectedFirstLevel) {
      setSelectedCategory([selectedFirstLevel._id, subId]);
      setCategoryVisible(false);
      setCurrentStep('first');
    }
  };

  const handleCategoryBack = () => {
    setCurrentStep('first');
    setSelectedFirstLevel(null);
  };

  const handleCategoryClear = () => {
    setSelectedCategory([]);
    setCategoryVisible(false);
    setCurrentStep('first');
    setSelectedFirstLevel(null);
  };

  // IP标签选择
  const handleIpTagSelect = (tag: GuziTag) => {
    setSelectedIpTag(tag);
    setInputValue(tag.name);
    setIpSelectorVisible(false);
  };

  const handleIpTagRemove = () => {
    setSelectedIpTag(null);
    setInputValue('');
  };

  // 提交表单
  const handleSubmit = async (values: { remark?: string }) => {
    // 优先使用选中的IP标签，其次使用手动输入
    const ipName = selectedIpTag ? selectedIpTag.name : inputValue.trim();

    if (!ipName) {
      Toast.show({
        content: '请输入或选择IP名称',
        icon: 'fail',
      });
      return;
    }

    setLoading(true);
    try {
      await submitWantGuzi({
        ip_name: ipName,
        category_tags: selectedCategory.length === 2 ? [selectedCategory[1]] : [],
        remark: values.remark,
      });

      Toast.show({
        content: '谷菌收到了你的需求，马上开始找',
        icon: 'success',
      });

      tracker.submit({
        action: 'want_guzi_submit',
        extra: {
          ip_name: ipName,
          category_count: selectedCategory.length > 0 ? 1 : 0,
          has_remark: !!values.remark,
        },
      });

      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (error) {
      Toast.show({
        content: '提交失败，请重试',
        icon: 'fail',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="want-guzi-page">
      <NavBar onBack={() => navigate(-1)}>
        求谷表单
      </NavBar>

      <div className="want-guzi-content">
        <div className="form-intro">
          <div className="intro-icon">🎁</div>
          <h2>没有谷？告诉我！</h2>
          <p>说出你想要的谷子，我来帮你找~</p>
        </div>

        <Form
          form={form}
          layout='vertical'
          onFinish={handleSubmit}
          className="want-guzi-form"
          footer={
            <Button
              block
              color='primary'
              size='large'
              loading={loading}
              className="submit-btn"
              type="submit"
            >
              提交求谷
            </Button>
          }
        >
          {/* IP名称输入 */}
          <Form.Item
            label='IP名称'
            className="ip-input-item"
          >
            <div className="ip-input-wrapper">
              <Input
                placeholder='输入或选择IP名称'
                value={inputValue}
                onChange={(val) => {
                  setInputValue(val);
                  // 如果输入的文字和已选标签名不一致，清除选中状态
                  if (selectedIpTag && val !== selectedIpTag.name) {
                    setSelectedIpTag(null);
                  }
                }}
                className="ip-input"
              />
              {selectedIpTag && (
                <div className="ip-tag-selected" onClick={handleIpTagRemove}>
                  <span>{selectedIpTag.name}</span>
                  <span className="remove-icon">×</span>
                </div>
              )}
              <div
                className="ip-selector-btn"
                onClick={() => setIpSelectorVisible(true)}
              >
                选择IP
              </div>
            </div>
          </Form.Item>

          {/* 分类选择 */}
          <Form.Item
            name='category'
            label='谷子类别（可不填）'
          >
            <div
              className={`category-trigger ${selectedCategory.length > 0 ? 'has-value' : ''}`}
              onClick={() => setCategoryVisible(true)}
            >
              <span>{getSelectedCategoryLabel()}</span>
              <span className="arrow">›</span>
            </div>
          </Form.Item>

          {/* 备注 */}
          <Form.Item
            name='remark'
            label='备注（可不填）'
          >
            <TextArea
              placeholder='可以说说具体想要什么类型的周边、预算等...'
              maxLength={200}
              rows={3}
              showCount
            />
          </Form.Item>
        </Form>
      </div>

      {/* IP标签选择弹窗 */}
      <Popup
        visible={ipSelectorVisible}
        onMaskClick={() => setIpSelectorVisible(false)}
        position='bottom'
        bodyStyle={{
          height: '70vh',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        <div className="ip-selector-popup">
          <div className="popup-header">
            <span className="popup-title">选择IP</span>
            <span className="popup-close" onClick={() => setIpSelectorVisible(false)}>完成</span>
          </div>
          <div className="popup-search">
            <Input
              placeholder='搜索IP名称...'
              value={inputValue}
              onChange={(val) => {
                setInputValue(val);
                if (selectedIpTag && val !== selectedIpTag.name) {
                  setSelectedIpTag(null);
                }
              }}
              clearable
            />
          </div>
          <div className="popup-content">
            {displayIpTags.length > 0 ? (
              <div className="ip-tag-grid">
                {displayIpTags
                  .filter((tag) =>
                    !inputValue || tag.name.toLowerCase().includes(inputValue.toLowerCase())
                  )
                  .map((tag) => (
                    <div
                      key={tag._id}
                      className={`ip-tag-item ${selectedIpTag?._id === tag._id ? 'selected' : ''}`}
                      onClick={() => handleIpTagSelect(tag)}
                      style={tag.color ? { borderColor: tag.color } : {}}
                    >
                      <span className="tag-dot" style={tag.color ? { background: tag.color } : {}} />
                      <span className="tag-name">{tag.name}</span>
                      {selectedIpTag?._id === tag._id && <span className="tag-check">✓</span>}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="popup-empty">暂无IP标签</div>
            )}
          </div>
        </div>
      </Popup>

      {/* 分类选择弹窗 */}
      <Popup
        visible={categoryVisible}
        onMaskClick={() => setCategoryVisible(false)}
        position='bottom'
        bodyStyle={{
          height: '70vh',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        <div className="category-picker">
          <div className="picker-header">
            {currentStep === 'second' ? (
              <>
                <span className="header-back" onClick={handleCategoryBack}>
                  <span className="back-icon">‹</span>
                  <span>返回</span>
                </span>
                <span className="header-title">{selectedFirstLevel?.name}</span>
                <span className="header-clear" onClick={handleCategoryClear}>清除</span>
              </>
            ) : (
              <>
                <span className="header-title">选择分类</span>
                <span className="header-close" onClick={() => setCategoryVisible(false)}>完成</span>
              </>
            )}
          </div>

          {currentStep === 'first' && (
            <div className="picker-content">
              <div className="first-level-grid">
                {categories.map((cat) => (
                  <div
                    key={cat._id}
                    className="first-level-item"
                    onClick={() => handleFirstLevelClick(cat)}
                  >
                    <div className="item-icon">{getCategoryEmoji(cat.name)}</div>
                    <div className="item-name">{cat.name}</div>
                    <div className="item-count">
                      {cat.sub_categories?.length || 0} 个分类
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 'second' && selectedFirstLevel && (
            <div className="picker-content second-level-content">
              <div className="second-level-header">
                <span className="second-level-title">选择{categoryName(selectedFirstLevel.name)}类型</span>
              </div>
              <div className="second-level-list">
                {(selectedFirstLevel.sub_categories || []).map((sub) => (
                  <div
                    key={sub._id}
                    className={`second-level-item ${selectedCategory[1] === sub._id ? 'selected' : ''}`}
                    onClick={() => handleSecondLevelClick(sub._id)}
                  >
                    <div className="sub-info">
                      <div className="sub-name">{sub.name}</div>
                      {sub.description && (
                        <div className="sub-desc">{sub.description}</div>
                      )}
                    </div>
                    <div className="sub-check">
                      {selectedCategory[1] === sub._id && '✓'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Popup>
    </div>
  );
};

function getCategoryEmoji(name: string): string {
  const emojiMap: Record<string, string> = {
    '手办': '🎭',
    '周边': '🎀',
    '立牌': '🏷️',
    '挂件': '🔑',
    '明信片': '💌',
    '海报': '🖼️',
    '抱枕': '🛏️',
    '亚克力': '💎',
    '徽章': '🎖️',
    '贴纸': '📝',
    '文具': '✏️',
    '服饰': '👕',
    '毛绒': '🧸',
    '卡片': '🃏',
    '模型': '🏗️',
    '玩具': '🎮',
  };

  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (name.includes(key)) return emoji;
  }
  return '📦';
}

function categoryName(name: string): string {
  return name || '商品';
}

export default WantGuziPage;
