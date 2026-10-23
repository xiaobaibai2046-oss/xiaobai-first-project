const supply=(id,name,note)=>({id,name,note});
const risk=(title,prevention,action)=>({title,prevention,action});
const commonGroups=[
{title:'证件与行程',items:[supply('identity','身份证、驾驶证、行驶证','确认有效期；证件备份单独保存。'),supply('insurance','保险与道路救援联系方式','确认车辆保险、救援范围、拖车距离及偏远地区是否覆盖。'),supply('booking','住宿、预约及通行确认记录','按实际行程核实证件或通行手续；离线保存地址、电话和退改条件。'),supply('offline','离线地图、纸质备份和行程共享','出发前下载沿线地图，向可信联系人说明计划与约定报平安时间。')]},
{title:'车辆与故障应对',items:[supply('inspection','轮胎、制动、油液及电池检查','出发前检修；胎压按车辆手册与载荷调整，不凭经验统一放气。'),supply('spare','可用备胎、千斤顶和拆轮工具','确认工具匹配车辆，提前了解操作；不在危险路肩强行换胎。'),supply('inflator','胎压表、充气泵及适配搭电设备','确认设备适用和电量；不会操作时联系救援。'),supply('visibility','三角警示牌、反光背心和灭火器','检查有效状态；故障时先保障人员安全，按当地道路规则警示与求助。')]},
{title:'饮食、衣物与健康',items:[supply('water','饮用水与额外储备','按人数、天气和最长补给间隔准备，另留延误余量；不可只依赖地图上的补给标记。'),supply('food','耐储存食物与简易餐具','准备即食主食、能量补充和备用餐，注意保质期与饮食禁忌。'),supply('clothing','保暖层、防风防雨外套及替换衣物','山区和荒漠昼夜温差大，按季节加带手套、帽子和保温用品。'),supply('firstaid','急救包、个人常用药与处方备份','按个人病史和医生建议备药，不随意使用他人的处方药；记录过敏与紧急联系人。'),supply('sun','防晒、遮阳帽、太阳镜和润唇用品','高原及荒漠紫外线强，按实际日照和产品说明补涂。')]},
{title:'通讯、照明与环保',items:[supply('power','车充、充电宝和备用线','出发前充满电，检查适配和安全状态。'),supply('light','头灯或手电及备用电源','用于应急照明，不以此作为夜间穿越偏远路段的理由。'),supply('cash','适量现金与备用支付方式','偏远地区可能断网，现金与证件分开放置。'),supply('waste','垃圾袋、湿巾及个人卫生用品','垃圾随车带走，遵守保护区与用火规定。')]}
];
const highland={title:'高原专项',items:[supply('altitude-plan','高原适应与必要的健康咨询','循序上升、安排休整；有心肺等基础疾病者出发前咨询医生。'),supply('warmth','额外防寒衣物和保温毯','为山口天气突变、交通延误准备，保持衣物干燥。'),supply('oxygen-check','按专业建议评估应急供氧需求','如携带须确认设备安全、使用方法及运输要求；供氧不能替代下降海拔或就医。')]};
const desert={title:'荒漠专项',items:[supply('desert-water','增加饮水、备用餐和遮阳用品','按最高气温、人数、最长补给间隔与可能延误规划储备，不把沿途餐馆当作已确认补给。'),supply('fuel-plan','燃油续航与已确认营业的加油点','根据油耗和绕行余量规划；不携带或存放不符合当地规定的散装燃油。'),supply('dust','防尘用品及车辆滤芯检查','核实冷却、空滤和车内用品固定；沙尘天气优先延后出发。')]};
const remote={title:'偏远路段专项',items:[supply('remote-confirm','逐段通行、接待、燃油与救援确认','未落实关键补给与合法停靠条件前不出发，不能用露营代替未落实的住宿。'),supply('communication','可靠的通讯与失联应对计划','核实信号盲区，必要时配置符合当地规定且已测试的卫星通讯；不要默认普通手机可用卫星功能。'),supply('reserve-day','机动日期与折返方案','明确出发、折返和延后条件，向联系人约定失联后的核查方式。')]};
const commonRisks=[risk('疲劳驾驶与夜间风险','按驾驶状态分段休息；避免连续赶路和夜间驶入陌生偏远道路。','困倦、注意力下降时在合法安全地点停车休息；无法安全继续就延后行程。'),risk('故障、断网与补给中断','出发前检查车辆，核实加油、住宿和救援，不将已记录里程当作通行保证。','先确保人员远离车流及其他危险，保留定位与电量；有信号时联系救援或当地警方。')];
const highRisks=[risk('高原反应与快速升高海拔','逐步适应，避免初到高原即剧烈活动；身体不适时停止继续上升。','头痛等不适持续或加重应及时就医；出现静息气促、意识异常或步态不稳等情况立即求助，在安全条件下尽快降低海拔，不独自留守。'),risk('山口冰雪、落石及滑坡','核实天气、交管和公路信息，避免雨雪后冒险通过；不在落石带停留。','遇封闭、落石或积雪遵从现场指挥，停留在安全区域或折返，不自行绕过封控。')];
const sandRisks=[risk('沙尘、积沙与低能见度','核实沙尘预警，保持在允许道路内，不越野、不追逐沙丘拍摄。','能见度不足时遵从交管指引，尽可能驶入安全停靠点；不要停在行车道或盲弯处。'),risk('高温脱水与车辆过热','避开极端高温，落实饮水、遮阳和燃油；关注车辆仪表。','身体出现热相关不适时及时降温求助；车辆高温报警安全停车处理，不贸然打开高温冷却系统。')];
const restrictedRisk=risk('通行限制、保护区与生产作业区','先核实社会车辆准入、证件和开放道路；不得将地图轨迹当作通行许可。','遇限制立即服从现场要求并调整或折返，不穿越湖盆、保护区、油田作业道或无人区捷径。');
const yunnanSupplies={title:'云南山地专项',items:[supply('yn-rain','防雨层、防滑鞋与车窗除雾用品','山区雨雾与弯道较多，按季节备好雨具、替换衣物并检查雨刷。'),supply('yn-parking','古城停车与住宿行李转运确认','核实古城、生态廊道及景区机动车限制，避免误入步行街。'),supply('yn-food','食品与个人防护准备','选择正规餐饮，不食用不明野生菌；防晒、驱蚊用品按地区与说明使用。')]};
const yunnanRisks=[risk('雨季落石、滑坡与浓雾','出发前核实山区天气、道路公告和雨刷制动，避免暴雨时段赶山路。','遇积水、落石、塌方或低能见度，按交管指引安全等待或改期，不试探涉水和擅自绕行。'),risk('古城、景区与生态道路限制','提前确认停车、预约和接驳，不将地图连线当作车辆准入。','无法到店时按正规停车点与住宿方协商转运，不驶入封闭步行街、湿地和生态廊道。'),risk('野生菌、生食与食品中毒','选择正规商家和熟食，不采食不明野生菌，不依赖网络鉴菌。','出现疑似中毒或严重不适立即就医或拨打 120，保存可疑食物及就餐信息供医护参考。')];

const grassSupplies={title:'草原林地专项',items:[supply('grass-weather','防风防雨衣物、防滑鞋及保暖层','草原昼夜温差大，雷雨、强风与降温时减少露天活动。'),supply('grass-permit','草原与边境通行、接待及停车确认','核实允许道路、边境相关要求及住宿接待，不进入牧场、林地或受限区域。'),supply('grass-insect','个人防蚊用品与正规骑乘防护','按说明防蚊；骑乘选正规服务并戴护具，不投喂、追逐动物。')]};
const grassRisks=[risk('雷雨、强风与夜间降温','关注天气，备防寒防雨层，不在雷雨时停留开阔草原或孤立高处。','遇雷雨结束露天活动，按现场指引进入安全场所；不要为日出、日落在陌生道路赶夜车。'),risk('牧场边界、牲畜与林草防火','只走允许道路，不驶入草场湿地，不违规用火，不追逐野生动物。','发现牲畜提前减速；遇禁行、火险或道路管制服从指挥，不寻找土路绕行。')];
const waterRisk=risk('黄河、湖区与峡谷水域','只在允许区域活动，乘正规船只穿救生衣，不野泳、涉水或进入未开放河岸。','强风、暴雨或水域关闭时停止活动；遇险及时求助，不盲目下水施救。');

const humidSupplies={title:'湿热山地专项',items:[supply('humid-rain','雨具、防滑鞋、替换衣物与车窗除雾检查','南方降雨与山路较多，确认雨刷、轮胎和制动状态，步道以当日开放为准。'),supply('humid-health','饮水、防晒与个人防蚊用品','按产品说明使用，注意湿热环境食品保存，个人常用药按医生建议准备。'),supply('humid-parking','景区预约、停车与接驳确认','古城、村寨和景区不默认允许车辆到店，提前核实行李转运及晚到接待。')]};
const wetRoadRisk=risk('强降雨、山路落石与湿滑','核实具体选路天气、交管和景区公告，避免暴雨进山或入峡谷，不在危险路肩停车。','遇积水、滑坡、浓雾或步道关闭按现场指引等待或折返，不试探涉水、不自行绕过封控。');
const tropicalRisk=risk('台风、雷暴与高温','出发前关注当地气象、海事及景区公告，准备防晒饮水和可取消住宿，不依赖固定预订赶路。','出现台风、雷暴或强风预警时停止海滨与雨林户外活动，服从停航、停运和疏散要求，及时调整住宿及路线。');
const coastRisk=risk('离岸流、潮汐与海岛船班','只在正式开放且有救生服务的海域按现场条件活动；海滨看点不等于可下水，船班和项目先核实。','海况恶化或现场禁止下水就取消活动；遇险呼叫专业救援，不盲目下水救人，乘船穿救生衣。');
const foodRisk=risk('生食、野生菌与餐饮计价','选择正规餐饮，不采食不明野生菌，海鲜等先确认计价、重量与过敏原，驾驶者不饮酒。','出现严重不适或疑似中毒及时就医或拨打 120，并说明食物及近期旅行地；保留就餐信息。');
const borderSouthRisk=risk('边境与保护区域准入','德天、东兴等核实通行和可参观范围，不越过边境设施或进入作业区域；自然保护区仅进明确开放区域。','遇检查、封闭或限制按现场要求调整，不找土路绕行，不擅用无人机或进入保护核心区。');
const mountainCultureRisk=risk('古镇、村寨与宗教参观规则','核实停车和接驳，尊重居民生活、拍摄和宗教参观规则，不擅入私人院落及未开放山地。','无法到店或接驳停运先联系住宿方调整，不闯步行街、不为赶夜景在陌生山路夜行。');
const chongqingRisk=risk('立体道路、坡道停车与高温','出发前确认目的地停车入口和道路层级，按导航与现场标志驾驶；停车拉好驻车制动，夏季安排补水休息。','错过出口就按合法路线重新规划，不临时倒车或横切；炎热不适及时降温求助，不把人或宠物留在熄火封闭车内。');

const heritageSupplies={title:'古建与山地专项',items:[supply('heritage-ticket','博物馆、古建和索道预约记录','核实官方入口、时段、停车与接驳，石窟、古城、陵寝不代表同一票务或同一参观区域。'),supply('heritage-warm','分层衣物、防风层与防滑鞋','北方温差、高山降温与雨后湿滑都需兼顾，按季节增加保暖用品。'),supply('heritage-access','台阶强度、限行与停车确认','按个人体力选择路线，古城与村落先落实外围停车及行李转运。')]};
const heritageRisk=risk('古建预约、台阶与文物保护','按官方场次和步道游览，寺院尊重参观拍摄规定，不触摸、攀爬或刻画文物；台阶多时量力而行。','满额、关闭、强风或身体不适就调整参观，不越过护栏、不绕行进入未开放空间。');
const seasonalMountainRisk=risk('高山低温、雨雪与索道停运','山顶天气与城区不同，确认当地预警、索道接驳、步道和山区公路开放，备防寒防雨层。','雷暴、结冰、浓雾或设施停运时停止登高并按指引调整，不走未开放山路或冒险赶夜路。');

export const preparationProfiles={
'sichuan':{tags:['高原','连续山路'],groups:[highland],risks:[...highRisks,risk('涉水与山区暴雨','关注沿途降雨和道路中断，预留交通管制机动时间。','不驾车试探水深，不穿越漫水路段，听从当地交管并改期或折返。')]},
'ili':{tags:['草原山地','季节性道路'],groups:[],risks:[risk('山区天气与季节性封路','景区道路和独库等可选支线需逐段核实开放，不按往年日期推定。','遇封路调整路线；大风、降温或降雨时停止不具备条件的山地游览。'),risk('牲畜、湿地与景区行车','遵守限速和景区交通规则，不驶入草场、湿地或牧民私人区域。','发现牲畜或野生动物提前减速，不鸣笛追赶，不突然转向进入危险路肩。')]},
'south':{tags:['荒漠长途','高温沙尘'],groups:[desert],risks:[...sandRisks,risk('超长转场与日程压缩','和田至库尔勒等转场应拆分多日，提前落实途中住宿。','延误后顺延行程，不把多日路段压进单日驾驶。')]},
'lhasa-gaize':{tags:['高海拔住宿','偏远补给'],groups:[highland,remote],risks:[...highRisks,restrictedRisk]},
'gaize-minfeng':{tags:['高原','偏远荒漠','通行待核实'],groups:[highland,desert,remote],risks:[...highRisks,...sandRisks,restrictedRisk]},
'minfeng-luntai':{tags:['沙漠公路','补给间隔长'],groups:[desert,remote],risks:[...sandRisks,risk('塔中接待与中途补给不确定','出发前电话确认塔中住宿、加油和实际接待，不承诺沿途随时有服务。','无法落实落脚或燃油时留在有服务的城镇，调整出发日或选路。')]},
'qiemo-tazhong':{tags:['沙漠公路','需确认落脚点'],groups:[desert,remote],risks:[...sandRisks,restrictedRisk]},
'lopnur-loop':{tags:['罗布泊段通行待核实','荒漠长途'],groups:[desert,remote],risks:[restrictedRisk,...sandRisks,risk('环线不能按原顺序完成','哈密—罗布泊镇—米兰需分别确认道路准入、住宿、燃油与救援覆盖。','任何关键条件无法落实就改变计划，不为完成环线进入受限道路；米兰遗址参观需单独确认开放。')]},
'north-xinjiang':{tags:['阿勒泰山地','景区换乘','秋季早雪'],groups:[{title:'北疆山地专项',items:[supply('north-warm','防寒防雨层、手套与防滑鞋','喀纳斯、禾木昼夜温差大，秋季可能早雪；日出观景也需足量保暖。'),supply('north-transfer','景区停车、区间车和行李转运确认','分别核实喀纳斯、禾木当日自驾限制、换乘时段、门区与住宿衔接。'),supply('north-booking','旺季住宿预订和机动日期','按预算确认真实房态与退改政策，不因固定预订在山路赶夜车。')]}],risks:[risk('早雪、低温与山区湿滑','关注阿勒泰山区天气、道路和景区公告，备好保暖和防雨用品。','遇结冰、积雪或管制按现场指引调整，不自行驶入封闭路段；需要防滑设备时按车辆手册及当地要求处理。'),risk('景区私家车限制与换乘延误','喀纳斯、禾木提前确认停车与区间车，不凭酒店位置判断车辆准入。','错过接驳或遇临时管制就联系景区和住宿方调整，不闯入限制道路或压缩休息。'),risk('山路弯道、牲畜与野生动物','控制车速，按规定停车拍照，禁止驶入草场与私人牧场。','发现动物提前减速，不追逐或投喂；不能为避让突然驶向危险路肩。'),risk('戈壁大风与高温','乌尔禾、克拉玛依路段留意横风和高温预警，补足饮水并检查车辆。','强风或低能见度时遵从交管，在安全位置停留，不在雅丹区离开允许游览线路。')]},
'yunnan-northwest':{tags:['雪山高原','古城限行','山区雨雪'],groups:[yunnanSupplies,highland],risks:[...yunnanRisks,...highRisks]},
'yunnan-south':{tags:['茶山雨林','高温蚊虫','山路长途'],groups:[yunnanSupplies,{title:'滇南热带专项',items:[supply('yn-insect','驱蚊用品、长袖及个人防晒','按产品说明使用，结合当地卫生提示准备，避免在蚊虫密集时段无遮护活动。'),supply('yn-heat','额外饮水与轻便透气衣物','按人数与天气准备延误储备，充分休息，不把气温低的高原经验套用到热带。')]}],risks:[...yunnanRisks,risk('高温、蚊虫与森林野生动物','关注当地卫生与天气提示，做好防蚊、防晒；森林游览按开放线路，不投喂或接近野生动物。','出现发热、持续不适或严重热相关症状及时就医，主动说明近期旅行地；遇野生动物听从现场人员指引，不下车围观。')]},
'yunnan-southeast':{tags:['梯田弯道','湖滨深水','景观季节差异'],groups:[yunnanSupplies],risks:[...yunnanRisks,risk('梯田湿滑与湖区深水','观景只走开放步道，不进入梯田田埂；不在抚仙湖等未开放水域游泳或野划。','湿滑或浓雾时停止冒险拍摄；乘正规船只穿救生衣，遇水上险情及时求助，不盲目下水施救。')]},
'qinghai-lake':{tags:['高原湖泊','草原湿地','山区温差'],groups:[highland],risks:[...highRisks,risk('湖区深水与保护区限制','只在允许湖岸和步道活动，不下水游泳、不驶入草场，不投喂野生动物或购买保护鱼类。','遇大风、雷雨或湖岸封闭离开危险区域，按现场指引调整，不绕过围栏或封控。'),risk('花期与山地天气变化','门源观花按当年实际花期安排，提前确认山区天气和住宿。','花期不符或天气转差就调整游览，不为拍摄在国道或危险路肩停车。')]},
'qinghai-gansu':{tags:['高原与戈壁','盐湖强日照','跨省长途'],groups:[highland,desert,remote],risks:[...highRisks,...sandRisks,risk('盐湖及生产作业区域限制','盐湖按官方步道、停车和接驳安排，做足眼部与皮肤防晒，不进入矿区和未开放盐池。','遇封闭或天气预警停止游览，不为拍照离开允许区域或驾车驶入盐田。'),risk('预约与长途转场挤压休息','莫高窟等按官方渠道提前预约，柴达木转场落实燃油、住宿与休息点。','行程延误时改签或增加一天，不为赶场次夜间穿越陌生偏远道路。')]},
'qinghai-south':{tags:['高海拔住宿','偏远山路','宗教与文化参观'],groups:[highland,remote],risks:[...highRisks,risk('雨季塌方与偏远救援','核实贵德、共和、玛沁、同仁之间的具体道路、燃油和救援覆盖，不走无人区捷径。','遇落石、塌方、暴雨或管制在安全位置等待或折返，不强行涉水或自行清障通过。'),risk('雪山与宗教场所边界','雪山仅在允许道路远眺，不把远眺点当登山路线；寺院遵守开放、着装和拍摄规则。','发现道路受限、身体不适或天气恶化及时结束支线，按现场要求调整参观和行车。')]},
'gansu-hexi':{tags:['河西戈壁','跨省高原','石窟预约'],groups:[desert,highland,remote],risks:[...sandRisks,...highRisks,risk('长途补给与石窟预约','敦煌至大柴旦逐段落实燃油、住宿、休息点；莫高窟按官方渠道预约。','延误后调整预约或增加住宿，不为赶场次夜间穿越陌生偏远路段。'),risk('盐湖及生产区边界','青海段只走开放道路和景区，确认机动车准入，不进入盐田、矿区或无人区捷径。','遇封闭、沙尘或通行限制遵从指引，安全等待或调整选路，不绕过封控。')]},
'gansu-gannan':{tags:['甘南高原','寺院与村落','雨季山路'],groups:[highland,{title:'甘南山地专项',items:[supply('gn-rain','防雨防滑鞋与替换衣物','扎尕那、官鹅沟及山地步道易湿滑，按开放线路游览。'),supply('gn-booking','寺院与景区预约、停车确认','尊重宗教与居民习俗，核实古村停车、接驳、行李转运及晚到接待。')]}],risks:[...highRisks,risk('暴雨、峡谷关闭与滑坡','核实山地公路、官鹅沟及扎尕那的天气和开放，不擅走未开放步道。','遇落石、积水或封闭停止前进，按现场指引等待或折返，不强行涉水。'),risk('草场牲畜与宗教文化边界','不驶入草场，不投喂或追逐动物；寺院按着装、拍摄及开放规定参观。','遇牲畜提前减速；受限区域服从现场要求，拒绝违规捷径和未许可活动。')]},
'gansu-southeast':{tags:['石窟栈道','陇南山地','雨季落石'],groups:[{title:'陇东南山地专项',items:[supply('gs-rain','防雨层、防滑鞋及车窗除雾检查','雨后石窟栈道和峡谷步道湿滑，检查雨刷与制动。'),supply('gs-ticket','石窟与峡谷预约、开放确认','麦积山及官鹅沟按当日公告，准备关闭时的室内或休整方案。')]}],risks:[risk('暴雨、落石和漫水路段','核实陇南山区天气与公路信息，避免强降雨时段赶山路。','遇积水、塌方或落石安全等待或折返，不试探水深或擅自清障通行。'),risk('石窟栈道与峡谷步行','按个人体力选择开放步道，雨天谨慎，遵守文物保护和游客容量规定。','步道关闭就调整参观；身体不适、路滑或雷雨时及时停止登高，不越过护栏拍照。'),risk('城市人流与餐饮计价','天水等热门街区停车后步行，点单前确认分量、价格和饮食禁忌。','遇拥挤调整时段，行程延误顺延，不通过压缩驾驶休息赶下一站。')]},
'ningxia-north':{tags:['贺兰山','湖滨湿地','温差与日照'],groups:[desert],risks:[...sandRisks,waterRisk,risk('文物和山地活动边界','岩画、遗址只按开放步道参观，不触摸或攀爬，不进入保护区未开放道路。','遇封闭或山地天气变差及时调整，禁止绕过围栏或临时越野。')]},
'ningxia-yellowriver':{tags:['黄河峡谷','正规沙漠游览','高温沙尘'],groups:[desert],risks:[...sandRisks,waterRisk]},
'ningxia-south':{tags:['六盘山','雨雾山路','石窟与森林'],groups:[{title:'六盘山专项',items:[supply('liupan-rain','防雨层、防滑鞋与替换衣物','山区比平原凉，雨雾路段检查雨刷和制动，步道开放以当日为准。'),supply('liupan-open','森林、峡谷和石窟开放确认','提前核实入口、接驳及参观预约，准备天气变化时的休整方案。')]}],risks:[risk('雨雾、落石与山路湿滑','核实六盘山天气和道路，不在强降雨时段赶山路。','遇浓雾、积水或落石按现场指引安全等待或折返，不试探涉水。'),risk('森林步道与峡谷限制','仅走开放步道，不采食不明野生菌，不违规用火。','步道关闭就调整行程；雷雨或身体不适时停止登高，及时求助。'),waterRisk]},
'inner-central':{tags:['草原','火山支线','风雨温差'],groups:[grassSupplies],risks:[...grassRisks,risk('火山与景区自驾边界','乌兰哈达等支线先确认准入和道路，禁止驶入受限火山及私人草场。','遇禁行、松散路面或天气恶化结束支线，不用未确认土路绕行。')]},
'inner-east':{tags:['边境小镇','林草防火','低温蚊虫'],groups:[grassSupplies,remote],risks:[...grassRisks,risk('边境道路与活动限制','室韦、满洲里等核实证件、通行和拍摄要求，不进入隔离设施、口岸作业或受限区域。','遇检查及限制服从现场要求，不越过边境设施、不擅用无人机，不为完成环线绕行受限土路。'),waterRisk]},
'inner-west':{tags:['阿拉善长途','戈壁补给','秋季温差'],groups:[desert,remote],risks:[...sandRisks,risk('长距离转场与补给中断','阿左旗—额济纳和额济纳—乌海逐段落实燃油、休息及途中住宿，按实际选路拆分多日。','关键补给或落脚点未落实先不出发；延误就增加天数，不夜间冒险或用荒漠露营替代未确认住宿。'),risk('胡杨季房源与保护区域','秋色随当年天气变化，提前核实接待、价格及退改，只走开放景区。','旺季无房或景观不符时调整计划，不驶入胡杨林、湿地、边境或生产作业限制区。')]},
'hainan-east':{tags:['海岛海湾','山区雨林','跨海轮渡另计'],groups:[humidSupplies,{title:'海南上岛专项',items:[supply('hn-ferry','跨海轮渡预约与车辆运输确认','如从岛外自驾，单独核实车票、证件、车辆类型运输要求和停航公告；环线天数及里程不含上岛过海。'),supply('hn-flex','台风季机动住宿与备选日期','关注海事和气象公告，保留调整余地，不为赶船冒险驾驶。')]}],risks:[tropicalRisk,coastRisk,wetRoadRisk,foodRisk]},
'hainan-west':{tags:['西部海岸','森林保护','轮渡另计'],groups:[humidSupplies],risks:[tropicalRisk,coastRisk,wetRoadRisk,foodRisk,risk('雨林与生产区域边界','霸王岭、尖峰岭等只进允许开放游览区域，盐场不进入生产设施；上岛轮渡另行预约并预留停航余量。','未开放就取消支线，不擅自登山、雨林穿越或进入保护核心区。')]},
'hainan-central':{tags:['热带雨林','黎苗文化','山区湿滑'],groups:[humidSupplies],risks:[tropicalRisk,wetRoadRisk,foodRisk,risk('雨林步道与国家公园限制','五指山等核实具体开放步道，不默认可登主峰或穿越雨林；如需跨海上岛，轮渡单独核实预约和天气。','遇关闭、雷暴、落水风险或体力不支及时结束游览，不走未开放便道。')]},
'guangxi-north':{tags:['漓江山水','梯田与村寨','雨季水域'],groups:[humidSupplies],risks:[wetRoadRisk,waterRisk,mountainCultureRisk,foodRisk]},
'guangxi-border':{tags:['边境田园','瀑布峡谷','保护区域'],groups:[humidSupplies],risks:[wetRoadRisk,waterRisk,borderSouthRisk,foodRisk]},
'guangxi-coast':{tags:['北部湾','潮汐台风','边境城镇'],groups:[humidSupplies],risks:[tropicalRisk,coastRisk,borderSouthRisk,foodRisk]},
'guizhou-west':{tags:['瀑布峡谷','连续山路','湿滑洞穴'],groups:[humidSupplies],risks:[wetRoadRisk,waterRisk,foodRisk,risk('瀑布、洞穴与观景步道','黄果树、马岭河、织金洞按开放线路和接驳游览，强降雨关注临时关闭，准备防滑鞋。','遇雷雨、洪水预警、步道关闭或不适及时停止游览，不越过护栏拍照或深入未开放洞穴。')]},
'guizhou-east':{tags:['苗寨古城','远郊登高','雨季山路'],groups:[humidSupplies],risks:[wetRoadRisk,mountainCultureRisk,foodRisk,risk('梵净山预约与步行强度','梵净山属于铜仁地区远郊支线，先确认入口、索道、门票及当日开放，量力安排登高。','遇雷暴、停运或身体不适取消登高，不能为固定预订强行翻越或走未开放路线。')]},
'guizhou-north':{tags:['红色人文','赤水山水','品酒不驾车'],groups:[humidSupplies],risks:[wetRoadRisk,waterRisk,foodRisk,risk('品酒与花期安排','仁怀酒文化参观如涉及品酒，必须安排不驾车的后续行程；百里杜鹃按当年花期与开放安排。','饮酒后不得驾驶，也不以休息短时间判断已可开车；花期或天气不符就改休整或室内游览。')]},
'sichuan-west':{tags:['川西高原','雪山山口','村寨支线'],groups:[humidSupplies,highland,remote],risks:[...highRisks,wetRoadRisk,mountainCultureRisk,foodRisk]},
'sichuan-south':{tags:['峨眉山高处','雅安雨雾','石刻与森林'],groups:[humidSupplies,{title:'峨眉山专项',items:[supply('emei-warm','登高保暖与高处身体评估','城区海拔低不代表金顶低；确认索道、接驳、雨雪与身体适应，必要时取消高处游览。'),supply('emei-shoe','防滑鞋与按当日要求准备的防滑用品','山地台阶多，听从现场开放和交通要求，避免为日出赶夜路。')]}],risks:[wetRoadRisk,mountainCultureRisk,foodRisk,risk('高处天气与野生动物','峨眉山高处关注低温、海拔适应和索道运营，不投喂或招惹野生猴群。','出现明显不适及时停止上升并求助，天气恶化或设施停运时调整路线，勿擅走封闭山道。')]},
'sichuan-north':{tags:['蜀道石刻','古城步行','山地支线'],groups:[humidSupplies],risks:[wetRoadRisk,mountainCultureRisk,foodRisk,risk('剑门栈道与远郊支线','按体力选择开放步道，不擅入关闭栈道；南充至仪陇等支线单独计算时间和燃油。','天气恶化、路滑或身体不适停止登高，远郊行程来不及时顺延，禁止压缩休息赶夜路。')]},
'chongqing-east':{tags:['山城立体道路','峡谷洞穴','土苗古镇'],groups:[humidSupplies],risks:[chongqingRisk,wetRoadRisk,waterRisk,mountainCultureRisk]},
'chongqing-south':{tags:['高山森林','峡谷水域','山区温差'],groups:[humidSupplies],risks:[chongqingRisk,wetRoadRisk,waterRisk,risk('高山天气与索道运营','金佛山等高处温度与主城不同，核实雨雪、索道和步道开放，带保暖层。','遇停运、结冰或雷暴停止登高，不为拍摄日出进入封闭山路或赶夜车。')]},
'chongqing-west':{tags:['石刻文物','古镇慢游','花期变化'],groups:[humidSupplies],risks:[chongqingRisk,wetRoadRisk,mountainCultureRisk,risk('文物参观与季节景观','大足石刻按官方预约、开放和保护规则参观；潼南油菜花海以实际花期为准。','遇满额或关闭调整场次，不触摸攀爬文物，不为赶花期或夜景压缩驾驶休息。')]},
'shanxi-north':{tags:['晋北古建','山区温差','预约与台阶'],groups:[heritageSupplies],risks:[heritageRisk,seasonalMountainRisk,wetRoadRisk]},
'shanxi-central':{tags:['晋中古城','晋南文物','支线车程'],groups:[heritageSupplies],risks:[heritageRisk,wetRoadRisk,risk('壶口及黄河临水边界','壶口等远郊支线单独计算车程，核实洪水、汛期与景区开放，只走允许区域。','遇汛情、封闭或强风遵从指挥，不翻越护栏、靠近危险岸边或为赶场次疲劳驾驶。')]},
'shanxi-southeast':{tags:['太行峡谷','石阶栈道','山区雨雾'],groups:[heritageSupplies],risks:[heritageRisk,wetRoadRisk,seasonalMountainRisk]},
'shaanxi-guanzhong':{tags:['周秦文化','帝陵博物馆','太白山可选支线'],groups:[heritageSupplies],risks:[heritageRisk,foodRisk,seasonalMountainRisk]},
'shaanxi-north':{tags:['陕北长途','黄土沟谷','风沙温差'],groups:[heritageSupplies,desert],risks:[heritageRisk,...sandRisks,risk('丹霞与黄土沟谷活动范围','波浪谷和统万城仅进允许开放区域，降雨前后留意沟谷洪水与滑坡，不沿未开放土路探险。','遇积水、塌方或封闭就调整，不自行翻越丹霞、穿越沟谷或夜行陌生土路。')]},
'shaanxi-south':{tags:['秦岭山路','保护区边界','汉江水域'],groups:[humidSupplies],risks:[wetRoadRisk,waterRisk,foodRisk,risk('秦岭保护区与野生动物','佛坪、洋县等仅参观正规开放区域，不将熊猫或朱鹮保护地视为可自由进入景点，不投喂或干扰动物。','未开放、道路封闭或遇野生动物按现场指引停留或折返，不进林区捷径。')]},
'jiangxi-north':{tags:['庐山与三清山','古村瓷都','花期变化'],groups:[humidSupplies],risks:[seasonalMountainRisk,wetRoadRisk,mountainCultureRisk,foodRisk]},
'jiangxi-east':{tags:['龙虎山丹霞','古村书院','山水雨季'],groups:[humidSupplies],risks:[wetRoadRisk,waterRisk,heritageRisk,mountainCultureRisk]},
'jiangxi-south':{tags:['红色纪念地','客家古城','安福山地支线'],groups:[humidSupplies],risks:[heritageRisk,wetRoadRisk,seasonalMountainRisk,risk('武功山支线与体力评估','安福侧只走明确开放景区，不默认含跨山穿越或山顶露营，按官方入口和接驳安排。','雷暴、强风、封闭或体力不足时取消登高，不依赖未许可营地和便道。')]},
'hunan-west':{tags:['张家界预约','湘西村寨','雨季山路'],groups:[humidSupplies],risks:[seasonalMountainRisk,wetRoadRisk,mountainCultureRisk,waterRisk]},
'hunan-east':{tags:['洞庭湖','大围山支线','红色人文'],groups:[humidSupplies],risks:[waterRisk,wetRoadRisk,heritageRisk,risk('远郊景区与接驳','平江、浏阳、株洲的远郊看点分别核实车程与预约，不能按城市相邻就默认顺路串完。','延误后删减支线或顺延，不为赶场次、日出或返程压缩休息。')]},
'hunan-south':{tags:['衡山登高','丹霞步道','东江湖水域'],groups:[humidSupplies],risks:[seasonalMountainRisk,wetRoadRisk,waterRisk,risk('丹霞观景边界与野生菌','崀山、高椅岭等只走正规开放步道，不越过护栏或攀爬未开放岩壁，不采食不明野生菌。','雨后湿滑、雷暴或身体不适及时结束游览；遇疑似食物中毒立即就医并说明就餐信息。')]},
'hubei-west':{tags:['三峡水域','神农架高山','武当山步道'],groups:[humidSupplies,heritageSupplies],risks:[wetRoadRisk,waterRisk,seasonalMountainRisk,risk('神农架保护区与特殊天气','只进开放景区，不擅自穿越林区、不采食野生菌；木鱼镇海拔低不代表神农顶等高处没有低温或缺氧风险。','遇冰雪、火险、封闭或身体不适按现场要求调整；严重不适及时求助，不强行上升或绕行林区。')]},
'hubei-northeast':{tags:['大别山','森林防火','红色文化'],groups:[humidSupplies],risks:[wetRoadRisk,seasonalMountainRisk,heritageRisk,risk('山地花期与未开放步道','麻城花海按当年花期，天堂寨、薄刀峰等按明确开放入口和线路游览，不默认允许跨省穿越。','封闭、雷暴、火险或花期不符就调整，不违规用火、不走林区便道赶路。')]},
'hubei-south':{tags:['九宫山','正规休整体验','水库观景'],groups:[humidSupplies],risks:[waterRisk,wetRoadRisk,seasonalMountainRisk,risk('温泉与个人健康条件','如安排温泉，先核实正规商家水质、营业与个人健康适宜性，饮酒后不泡汤也不驾驶。','出现头晕或其他不适立即停止活动并求助；不将野外水域或不明泉池作为温泉体验。')]}
};
export function getPreparation(route){const profile=preparationProfiles[route.id];if(!profile)throw Error(`Missing preparation: ${route.id}`);return {tags:profile.tags,groups:[...commonGroups,...profile.groups],risks:[...commonRisks,...profile.risks]};}
export function preparationText(route,checked=[]){const p=getPreparation(route),done=new Set(checked);return '自驾物资清单（'+p.tags.join(' / ')+'）\n'+p.groups.map(g=>g.title+'\n'+g.items.map(i=>`[${done.has(i.id)?'x':' '}] ${i.name}：${i.note}`).join('\n')).join('\n\n')+'\n\n风险防范与应对\n'+p.risks.map((r,i)=>`${i+1}. ${r.title}\n防范：${r.prevention}\n应对：${r.action}`).join('\n')+'\n紧急情况：报警 110，急救 120，交通事故报警 122；无信号地区不能保证可拨通，提前确认通讯及救援方案。以上为一般准备建议，不代替实时天气、通行信息、专业医疗或救援判断。';}
