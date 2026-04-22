"""
谷子分类初始化种子数据

运行方式：
    cd server
    python -m app.scripts.seed_guzi_categories

或直接：
    python -c "from app.scripts.seed_guzi_categories import seed; seed()"
"""
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))


# ═══════════════════════════════════════════════════════════════════
#  数据定义（一级 + 其下的二级分类嵌套结构）
# ═══════════════════════════════════════════════════════════════════

CATEGORIES = [
    {
        "name": "纸片类",
        "color": "#ff4d4f",
        "order": 1,
        "subs": [
            {"name": "色纸",       "aliases": ["色纸", "g券", "刮刮卡"],                              "exclude": [],                   "taobao_search_terms": ["动漫色纸", "正版色纸"],              "material_tags": ["硬卡纸"],       "match_weight": 85,  "remark": "方形硬卡纸，常带覆膜或特殊工艺"},
            {"name": "镭射票",    "aliases": ["镭射票", "票", "票根", "票夹", "票折"],             "exclude": ["电影票"],          "taobao_search_terms": ["镭射票", "动漫票", "限定票"],       "material_tags": ["镭射膜", "PVC"], "match_weight": 90,  "remark": "镭射膜覆面的小票/卡片形状周边"},
            {"name": "拍立得卡",  "aliases": ["拍立得", "拍立得卡", "富士卡"],                      "exclude": [],                   "taobao_search_terms": ["拍立得", "富士拍立得"],            "material_tags": ["相纸"],         "match_weight": 85,  "remark": "拍立得相纸尺寸的周边"},
            {"name": "明信片",    "aliases": ["明信片", "postcard", "片"],                           "exclude": ["实寄片", "原地封"], "taobao_search_terms": ["动漫明信片", "正版明信片"],        "material_tags": ["铜版纸"],       "match_weight": 80,  "remark": "标准明信片尺寸"},
            {"name": "小卡",      "aliases": ["小卡", "官卡", "卡片", "卡"],                        "exclude": ["卡套", "卡膜"],    "taobao_search_terms": ["动漫小卡", "官方小卡"],            "material_tags": ["白卡", "铜版纸"], "match_weight": 85, "remark": "小尺寸卡片，官周常见形式"},
            {"name": "透卡",      "aliases": ["透卡", "透明卡", "PVC卡", "磨砂卡"],                  "exclude": [],                   "taobao_search_terms": ["动漫透卡", "PVC透明卡"],           "material_tags": ["PVC", "磨砂"],   "match_weight": 88,  "remark": "透明或磨砂PVC材质"},
            {"name": "流沙票",    "aliases": ["流沙票", "流沙卡", "流沙麻将"],                      "exclude": [],                   "taobao_search_terms": ["流沙票", "流沙麻将"],             "material_tags": ["PVC", "油沙"],   "match_weight": 90,  "remark": "内有流沙效果的竖长形小票周边"},
            {"name": "海报",      "aliases": ["海报", "poster", "墙纸", "壁画"],                     "exclude": [],                   "taobao_search_terms": ["动漫海报", "正版海报"],             "material_tags": ["铜版纸", "艺术纸"], "match_weight": 75, "remark": "A3/A2尺寸或更大"},
            {"name": "杯垫",      "aliases": ["杯垫", " coaster"],                                  "exclude": ["保温杯"],           "taobao_search_terms": ["动漫杯垫"],                        "material_tags": ["纸板", "软木"],  "match_weight": 82,  "remark": "纸质或软木底衬的杯垫"},
            {"name": "便签",      "aliases": ["便签", "便签纸", "memo", "贴纸便签"],                "exclude": [],                   "taobao_search_terms": ["动漫便签"],                         "material_tags": ["纸"],           "match_weight": 78,  "remark": "小型纸质便签本/贴"},
            {"name": "胶带",      "aliases": ["胶带", "和纸胶带", "mt胶带", "文具胶带"],            "exclude": ["透明胶", "封箱带"], "taobao_search_terms": ["动漫胶带", "和纸胶带"],          "material_tags": ["和纸", "油墨印刷"], "match_weight": 80, "remark": "和纸胶带/装饰胶带"},
            {"name": "书签",      "aliases": ["书签", "书角", "书卡"],                               "exclude": [],                   "taobao_search_terms": ["动漫书签", "正版书签"],            "material_tags": ["纸板", "覆膜"],  "match_weight": 78,  "remark": "纸质或覆膜书签"},
        ],
    },
    {
        "name": "亚克力类",
        "color": "#1890ff",
        "order": 2,
        "subs": [
            {"name": "亚克力立牌",  "aliases": ["立牌", "立牌摆件", "Q版立牌", "大立牌"],          "exclude": ["立牌展示盒", "立牌架"], "taobao_search_terms": ["亚克力立牌", "动漫立牌"],          "material_tags": ["亚克力", "有机玻璃"], "match_weight": 90, "remark": "透明亚克力材质的站立式立牌"},
            {"name": "流麻",        "aliases": ["流麻", "流沙麻将", "麻将流沙"],                    "exclude": [],                   "taobao_search_terms": ["流麻", "流沙麻将"],              "material_tags": ["亚克力", "油沙"],  "match_weight": 92, "remark": "内有流沙效果的竖长亚克力立牌"},
            {"name": "流沙立牌",    "aliases": ["流沙立牌", "流沙摆件", "流沙砖"],                 "exclude": [],                   "taobao_search_terms": ["流沙立牌", "动漫流沙"],           "material_tags": ["亚克力", "油沙"],  "match_weight": 90, "remark": "正方形或长方形，内有流沙"},
            {"name": "亚克力挂件",  "aliases": ["亚克力挂件", "钥匙扣挂件", "PVC挂件"],            "exclude": ["金属挂件", "毛绒挂件"], "taobao_search_terms": ["动漫亚克力挂件"],                  "material_tags": ["亚克力", "金属扣"], "match_weight": 88, "remark": "带钥匙扣/挂绳孔的亚克力小挂件"},
            {"name": "亚克力砖",    "aliases": ["亚克力砖", "砖", "正方形亚克力", "大砖"],          "exclude": [],                   "taobao_search_terms": ["亚克力砖", "动漫正方形"],         "material_tags": ["亚克力"],        "match_weight": 85, "remark": "正方形厚亚克力块，常为吧唧大小"},
            {"name": "相框",        "aliases": ["相框", "亚克力相框", "小相框"],                   "exclude": [],                   "taobao_search_terms": ["动漫相框", "亚克力相框"],        "material_tags": ["亚克力", "PS"],   "match_weight": 82, "remark": "可摆放小卡的亚克力相框"},
            {"name": "PP夹",        "aliases": ["PP夹", "闪卡夹", "透明卡夹"],                    "exclude": [],                   "taobao_search_terms": ["PP夹", "闪卡夹"],                  "material_tags": ["PP板", "亚克力"], "match_weight": 80, "remark": "用于夹持闪卡/透卡的亚克力夹子"},
            {"name": "手机支架",    "aliases": ["手机支架", "支架", "立式支架"],                    "exclude": [],                   "taobao_search_terms": ["动漫手机支架"],                    "material_tags": ["亚克力"],        "match_weight": 80, "remark": "动漫主题手机支架"},
            {"name": "光栅卡",      "aliases": ["光栅卡", "3D卡", "动感卡", "变换卡"],            "exclude": [],                   "taobao_search_terms": ["光栅卡", "3D变换卡"],            "material_tags": ["光栅膜", "PVC"],  "match_weight": 88, "remark": "角度变化产生3D/动画效果"},
            {"name": "摇摇乐",      "aliases": ["摇摇乐", "晃晃卡", "动感摇摇"],                  "exclude": [],                   "taobao_search_terms": ["摇摇乐", "晃晃卡"],              "material_tags": ["亚克力", "内置液体"], "match_weight": 85, "remark": "内有液体/亮片效果，摇晃时有动感"},
        ],
    },
    {
        "name": "毛绒纺织类",
        "color": "#eb2f96",
        "order": 3,
        "subs": [
            {"name": "棉花娃娃",  "aliases": ["棉花娃娃", "娃", "崽", "棉花崽", "20cm娃娃"],      "exclude": ["BJD", "ob11"],     "taobao_search_terms": ["棉花娃娃", "20cm棉花娃娃"],      "material_tags": ["棉布", "PP棉"],  "match_weight": 95, "remark": "填充棉布娃娃，20cm左右"},
            {"name": "趴趴",      "aliases": ["趴趴", "papa", "扁平娃", "片状娃"],               "exclude": [],                   "taobao_search_terms": ["趴趴", "扁平棉花娃娃"],        "material_tags": ["棉布"],          "match_weight": 88, "remark": "扁平/片状棉花娃娃，可贴脸上"},
            {"name": "毛绒挂件",  "aliases": ["毛绒挂件", "毛绒公仔挂件", "球形挂件"],           "exclude": [],                   "taobao_search_terms": ["毛绒挂件", "动漫毛绒挂件"],     "material_tags": ["棉布", "PP棉", "挂绳"], "match_weight": 82, "remark": "小型毛绒挂件，通常5-15cm"},
            {"name": "手偶",      "aliases": ["手偶", "手指偶", "手搞"],                         "exclude": [],                   "taobao_search_terms": ["动漫手偶", "手指偶"],            "material_tags": ["棉布", "PP棉"],  "match_weight": 80, "remark": "可套在手上的毛绒玩偶"},
            {"name": "fufu",      "aliases": ["fufu", "芙芙", "中型毛绒", "35cm毛绒"],           "exclude": [],                   "taobao_search_terms": ["fufu", "35cm毛绒"],             "material_tags": ["棉布", "PP棉"],  "match_weight": 90, "remark": "中型毛绒玩偶，30-40cm"},
            {"name": "大毛绒",    "aliases": ["大毛绒", "抱枕娃", "大型玩偶", "50cm以上"],        "exclude": [],                   "taobao_search_terms": ["大型毛绒", "抱枕", "动漫大毛绒"], "material_tags": ["棉布", "PP棉"],  "match_weight": 85, "remark": "大型毛绒玩偶，50cm以上"},
        ],
    },
    {
        "name": "立体模型类",
        "color": "#722ed1",
        "order": 4,
        "subs": [
            {"name": "手办",      "aliases": ["手办", "figure", "粘土人", "figma"],              "exclude": ["景品手办", "祖国版"], "taobao_search_terms": ["正版手办", "动漫手办"],         "material_tags": ["PVC", "ABS"],    "match_weight": 95, "remark": "精细涂装PVC完成品手办"},
            {"name": "景品",      "aliases": ["景品", "区内品", "伴手礼"],                        "exclude": [],                   "taobao_search_terms": ["景品手办", "区内品"],            "material_tags": ["PVC"],           "match_weight": 88, "remark": "日本游乐场/便利店奖品手办"},
            {"name": "盒蛋",      "aliases": ["盒蛋", "盲盒", "系列盒蛋"],                       "exclude": [],                   "taobao_search_terms": ["盲盒", "盒蛋", "动漫盲盒"],      "material_tags": ["PVC"],           "match_weight": 85, "remark": "整盒购买，内有随机款式"},
            {"name": "可动手办",  "aliases": ["可动手办", "关节人", "素体", "可动模型"],         "exclude": [],                   "taobao_search_terms": ["可动手办", "关节人"],           "material_tags": ["PVC", "ABS"],    "match_weight": 82, "remark": "可动关节设计的手办/素体"},
            {"name": "BJD娃娃",   "aliases": ["BJD", "球关节娃娃", "SD娃娃"],                    "exclude": ["ob11"],             "taobao_search_terms": ["BJD娃娃", "SD娃娃"],            "material_tags": ["树脂"],          "match_weight": 90, "remark": "球关节可动树脂娃娃"},
            {"name": "机甲模型",  "aliases": ["机甲模型", "高达", "机娘", "robot"],               "exclude": [],                   "taobao_search_terms": ["高达模型", "机甲模型", "机娘"],  "material_tags": ["PS", "PE", "ABS"], "match_weight": 88, "remark": "高达/机甲类塑料拼装模型"},
            {"name": "兵人",      "aliases": ["兵人", "12寸人偶", "military figure"],             "exclude": [],                   "taobao_search_terms": ["12寸兵人", "动漫兵人"],         "material_tags": ["PVC", "布料"],   "match_weight": 80, "remark": "12寸可动人偶"},
        ],
    },
    {
        "name": "金属徽章类",
        "color": "#fa8c16",
        "order": 5,
        "subs": [
            {"name": "马口铁徽章",  "aliases": ["马口铁", "徽章", "吧唧", "胸针", "金属徽章"],  "exclude": ["吧唧托", "挂件徽章"], "taobao_search_terms": ["马口铁徽章", "动漫吧唧"],      "material_tags": ["马口铁", "金属"], "match_weight": 90, "remark": "马口铁材质圆形/异形徽章"},
            {"name": "吧唧",        "aliases": ["吧唧", "吧唧徽章", "闪底吧唧", "金边吧唧", "40吧唧", "58吧唧", "75吧唧"], "exclude": ["吧唧托", "亚克力吧唧"], "taobao_search_terms": ["40mm吧唧", "58mm吧唧"], "material_tags": ["马口铁", "金属", "闪底"], "match_weight": 92, "remark": "圆形徽章的昵称，不同尺寸不同工艺"},
            {"name": "闪卡",        "aliases": ["闪卡", "闪底卡", "金闪卡", "银闪卡", "镜面闪卡"], "exclude": ["PP夹", "卡套"], "taobao_search_terms": ["闪卡", "闪底金/银卡"],  "material_tags": ["马口铁", "闪底纸"], "match_weight": 88, "remark": "闪底工艺的徽章式小卡"},
            {"name": "透卡闪卡",    "aliases": ["透卡", "透明闪卡", "pvc闪卡", "磨砂闪卡"],      "exclude": [],                   "taobao_search_terms": ["透明闪卡", "PVC闪卡"],          "material_tags": ["PVC", "磨砂"],   "match_weight": 85, "remark": "PVC/磨砂材质的高端收藏闪卡"},
            {"name": "双闪",        "aliases": ["双闪", "双面闪", "正反闪"],                      "exclude": [],                   "taobao_search_terms": ["双闪徽章", "双面闪卡"],        "material_tags": ["马口铁"],        "match_weight": 82, "remark": "正反两面都有闪底工艺"},
            {"name": "徽章挂件",    "aliases": ["徽章挂件", "钥匙扣徽章", "马口铁挂件"],         "exclude": ["亚克力挂件"],       "taobao_search_terms": ["马口铁钥匙扣", "徽章挂件"],     "material_tags": ["马口铁", "金属扣"], "match_weight": 80, "remark": "带钥匙扣的马口铁徽章"},
        ],
    },
    {
        "name": "实用周边类",
        "color": "#13c2c2",
        "order": 6,
        "subs": [
            {"name": "谷美",        "aliases": ["谷美", "谷子美化", "展示架", "摆件"],           "exclude": [],                   "taobao_search_terms": ["谷美展示", "动漫摆件"],        "material_tags": ["亚克力", "木质"], "match_weight": 80, "remark": "用于装饰/展示谷子的物品"},
            {"name": "痛包",        "aliases": ["痛包", "动漫包", "IP包", "扎包"],              "exclude": [],                   "taobao_search_terms": ["痛包", "动漫双肩包"],        "material_tags": ["帆布", "涤纶"],  "match_weight": 90, "remark": "包体上扎满徽章的二次元主题包"},
            {"name": "磁吸类",      "aliases": ["磁吸", "冰箱贴", "磁性贴"],                     "exclude": [],                   "taobao_search_terms": ["动漫冰箱贴", "磁吸贴"],        "material_tags": ["马口铁", "磁铁"], "match_weight": 82, "remark": "带磁性的冰箱贴/展示贴"},
            {"name": "卡套",        "aliases": ["卡套", "吧唧套", "闪卡套"],                    "exclude": [],                   "taobao_search_terms": ["动漫卡套", "吧唧卡套"],        "material_tags": ["PVC", "EVA"],    "match_weight": 80, "remark": "用于收纳保护徽章/小卡的套子"},
            {"name": "挂绳",        "aliases": ["挂绳", "手机挂绳", "斜挎绳", "手绳"],          "exclude": [],                   "taobao_search_terms": ["动漫挂绳", "IP挂绳"],          "material_tags": ["尼龙", "涤纶"],   "match_weight": 75, "remark": "带动漫元素的挂绳/手腕绳"},
            {"name": "扇子",        "aliases": ["扇子", "折扇", "团扇", "动漫扇"],              "exclude": [],                   "taobao_search_terms": ["动漫扇子", "正版折扇"],        "material_tags": ["纸", "竹"],      "match_weight": 78, "remark": "动漫主题折扇/团扇"},
            {"name": "鼠标垫",      "aliases": ["鼠标垫", "桌垫", "大鼠标垫", "电竞垫"],         "exclude": [],                   "taobao_search_terms": ["动漫鼠标垫", "IP桌垫"],        "material_tags": ["布料", "橡胶"],   "match_weight": 75, "remark": "动漫图案桌垫/鼠标垫"},
            {"name": "抱枕",        "aliases": ["抱枕", "靠垫", "腰枕", "40抱枕", "60抱枕"],    "exclude": ["fufu"],             "taobao_search_terms": ["动漫抱枕", "正版抱枕"],        "material_tags": ["棉布", "PP棉"],  "match_weight": 85, "remark": "动漫图案抱枕/靠垫"},
        ],
    },
    {
        "name": "布艺纺织类",
        "color": "#52c41a",
        "order": 7,
        "subs": [
            {"name": "棉花娃娃娃衣", "aliases": ["娃衣", "棉花娃衣", "20cm娃衣", "分体娃衣"],  "exclude": ["手办衣服"],        "taobao_search_terms": ["棉花娃衣", "20cm娃衣"],       "material_tags": ["棉布", "蕾丝"],  "match_weight": 90, "remark": "专门给棉花娃娃穿的服装"},
            {"name": "手账本",      "aliases": ["手账本", "手账", "计划本", "日记本"],          "exclude": [],                   "taobao_search_terms": ["动漫手账本", "IP手账"],       "material_tags": ["纸", "皮面"],    "match_weight": 78, "remark": "动漫主题手账本/日记本"},
            {"name": "笔袋",        "aliases": ["笔袋", "笔盒", "文具袋", "笔包"],              "exclude": [],                   "taobao_search_terms": ["动漫笔袋", "IP文具袋"],       "material_tags": ["棉布", "尼龙"],   "match_weight": 75, "remark": "动漫图案笔袋/笔盒"},
            {"name": "眼罩",        "aliases": ["眼罩", "睡眠眼罩", "遮光眼罩"],                "exclude": [],                   "taobao_search_terms": ["动漫眼罩", "正版眼罩"],       "material_tags": ["棉布", "海绵"],   "match_weight": 72, "remark": "动漫图案眼罩"},
            {"name": "毯子",        "aliases": ["毯子", "空调毯", "毛毯", "珊瑚绒毯", "盖毯"], "exclude": [],                   "taobao_search_terms": ["动漫毯子", "IP毛毯"],         "material_tags": ["珊瑚绒", "棉"],   "match_weight": 75, "remark": "动漫图案毛毯/空调毯"},
        ],
    },
    {
        "name": "箱包类",
        "color": "#faad14",
        "order": 8,
        "subs": [
            {"name": "零钱包",    "aliases": ["零钱包", "小钱包", "硬币包"],                    "exclude": [],                   "taobao_search_terms": ["动漫零钱包", "正版零钱包"],   "material_tags": ["帆布", "PU"],     "match_weight": 78, "remark": "动漫图案小钱包"},
            {"name": "斜挎包",    "aliases": ["斜挎包", "单肩包", "小包"],                      "exclude": [],                   "taobao_search_terms": ["动漫斜挎包", "IP单肩包"],    "material_tags": ["帆布", "PU"],     "match_weight": 80, "remark": "动漫主题斜挎/单肩包"},
            {"name": "双肩包",    "aliases": ["双肩包", "书包", "背包"],                         "exclude": ["痛包"],             "taobao_search_terms": ["动漫双肩包", "正版书包"],      "material_tags": ["帆布", "涤纶"],   "match_weight": 80, "remark": "动漫主题双肩包/书包"},
            {"name": "胸包",      "aliases": ["胸包", "腰包", "腰挎包"],                        "exclude": [],                   "taobao_search_terms": ["动漫胸包", "IP腰包"],        "material_tags": ["PU", "尼龙"],     "match_weight": 75, "remark": "动漫主题胸包/腰包"},
        ],
    },
    {
        "name": "书写文具类",
        "color": "#2f54eb",
        "order": 9,
        "subs": [
            {"name": "马克笔",    "aliases": ["马克笔", "水彩笔", "双头马克笔", "动漫马克笔"],  "exclude": [],                   "taobao_search_terms": ["动漫马克笔", "IP文具套装"],   "material_tags": ["酒精墨水"],       "match_weight": 70, "remark": "动漫主题画笔套装"},
            {"name": "线圈本",    "aliases": ["线圈本", "笔记本", "大学笔记本", "B5本"],        "exclude": [],                   "taobao_search_terms": ["动漫笔记本", "IP线圈本"],    "material_tags": ["纸"],             "match_weight": 72, "remark": "动漫图案线圈笔记本"},
            {"name": "文件夹",    "aliases": ["文件夹", "资料夹", "风琴夹"],                     "exclude": [],                   "taobao_search_terms": ["动漫文件夹", "IP文具收纳"],  "material_tags": ["PP", "牛皮纸"],   "match_weight": 68, "remark": "动漫图案文件夹/资料夹"},
        ],
    },
    {
        "name": "卡牌收藏类",
        "color": "#eb2f96",
        "order": 10,
        "subs": [
            {"name": "收藏卡",    "aliases": ["收藏卡", "IP收藏卡", "官周卡"],                   "exclude": [],                   "taobao_search_terms": ["IP收藏卡", "动漫收藏卡"],   "material_tags": ["PVC", "白卡"],    "match_weight": 85, "remark": "IP官方发行的收藏卡片"},
            {"name": "闪卡",      "aliases": ["闪卡", "金闪卡", "银闪卡", "镭射闪卡"],          "exclude": ["PP夹"],             "taobao_search_terms": ["金闪卡", "银闪卡", "镭射闪卡"], "material_tags": ["马口铁", "闪底纸"], "match_weight": 88, "remark": "带闪光/镭射工艺的收藏卡"},
            {"name": "卡砖",      "aliases": ["卡砖", "亚克力卡砖", "闪卡砖", "展示砖"],        "exclude": [],                   "taobao_search_terms": ["卡砖", "亚克力卡砖"],       "material_tags": ["亚克力"],         "match_weight": 85, "remark": "用于展示和保护闪卡/收藏卡的亚克力砖"},
            {"name": "卡册",      "aliases": ["卡册", "收藏册", "闪卡册", "收纳册"],            "exclude": [],                   "taobao_search_terms": ["动漫卡册", "收藏册", "闪卡收纳册"], "material_tags": ["PVC", "活页夹"], "match_weight": 78, "remark": "用于收纳收藏卡/闪卡的活页册"},
        ],
    },
    {
        "name": "拼装积木类",
        "color": "#722ed1",
        "order": 11,
        "subs": [
            {"name": "拼装模型",  "aliases": ["拼装模型", "高达模型", "机甲拼装", "拼装人偶"],  "exclude": [],                   "taobao_search_terms": ["拼装模型", "动漫拼装"],      "material_tags": ["PS", "PE"],       "match_weight": 85, "remark": "需要自己拼装的塑料模型"},
            {"name": "拼图",      "aliases": ["拼图", "动漫拼图", "500片拼图", "1000片拼图"],  "exclude": [],                   "taobao_search_terms": ["动漫拼图", "正版拼图"],      "material_tags": ["纸质"],           "match_weight": 75, "remark": "动漫主题拼图"},
        ],
    },
    {
        "name": "钟表家居类",
        "color": "#13c2c2",
        "order": 12,
        "subs": [
            {"name": "挂钟/闹钟",  "aliases": ["挂钟", "闹钟", "小闹钟", "桌面钟"],             "exclude": [],                   "taobao_search_terms": ["动漫挂钟", "IP闹钟"],       "material_tags": ["塑料", "玻璃"],   "match_weight": 75, "remark": "动漫图案挂钟/桌面闹钟"},
            {"name": "摆件",      "aliases": ["摆件", "桌面摆件", "装饰品", "手办摆件"],        "exclude": ["手办"],             "taobao_search_terms": ["动漫摆件", "桌面摆件"],      "material_tags": ["树脂", "PVC"],     "match_weight": 80, "remark": "动漫主题桌面装饰摆件"},
            {"name": "香薰蜡烛",  "aliases": ["香薰", "蜡烛", "香薰蜡烛", "扩香"],              "exclude": [],                   "taobao_search_terms": ["动漫香薰", "IP蜡烛"],       "material_tags": ["大豆蜡", "香精"], "match_weight": 70, "remark": "动漫主题香薰蜡烛"},
            {"name": "钥匙扣",    "aliases": ["钥匙扣", "钥匙链", "扣环", "金属扣"],            "exclude": ["亚克力挂件"],       "taobao_search_terms": ["动漫钥匙扣", "正版钥匙扣"], "material_tags": ["金属", "合金"],   "match_weight": 78, "remark": "动漫图案钥匙扣"},
        ],
    },
]


def seed():
    from app.database.mongo_pool import mongo_pool
    from app.database.guzi_category_dao import guzi_category_dao
    from app.database.guzi_sub_category_dao import guzi_sub_category_dao
    from app.models.guzi_category import GuziCategoryCreate, GuziSubCategoryCreate

    mongo_pool.initialize()

    print("=" * 50)
    print("谷子分类数据初始化")
    print("=" * 50)

    # 清理已有数据（仅开发环境）
    print("\n[1/3] 清理已有数据...")
    guzi_category_dao.collection.drop()
    guzi_sub_category_dao.collection.drop()
    print("  ✓ 已清空 guzi_categories 和 guzi_sub_categories")

    # 插入一级分类
    print(f"\n[2/3] 插入一级分类 ({len(CATEGORIES)} 个)...")
    cat_id_map = {}
    for cat_data in CATEGORIES:
        cat = guzi_category_dao.create(GuziCategoryCreate(
            name=cat_data["name"],
            color=cat_data["color"],
            order=cat_data["order"],
        ))
        cat_id_map[cat_data["name"]] = cat.id
        print(f"  ✓ {cat_data['name']} (id={cat.id[:8]}...)")

    # 插入二级分类
    total_subs = sum(len(c["subs"]) for c in CATEGORIES)
    print(f"\n[3/3] 插入二级分类 ({total_subs} 个)...")
    for cat_data in CATEGORIES:
        parent_id = cat_id_map[cat_data["name"]]
        for idx, sub_data in enumerate(cat_data["subs"]):
            sub = guzi_sub_category_dao.create(GuziSubCategoryCreate(
                parent_id=parent_id,
                name=sub_data["name"],
                aliases=sub_data.get("aliases", []),
                exclude=sub_data.get("exclude", []),
                taobao_search_terms=sub_data.get("taobao_search_terms", []),
                material_tags=sub_data.get("material_tags", []),
                match_weight=sub_data.get("match_weight", 80),
                order=idx,
                is_active=True,
            ))
            print(f"  ✓ {cat_data['name']} > {sub.name}")

    # 打印汇总
    print("\n" + "=" * 50)
    print("初始化完成！")
    print("=" * 50)
    for cat_data in CATEGORIES:
        subs = cat_data["subs"]
        print(f"\n{cat_data['name']} ({len(subs)} 个二级分类):")
        for s in subs:
            print(f"  - {s['name']}")

    mongo_pool.close()


if __name__ == "__main__":
    seed()
