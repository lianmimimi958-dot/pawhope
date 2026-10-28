const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'pawlog_db.json');

const FREE_ALBUM_QUOTA_BYTES = 524 * 1024 * 1024; // 524 MB (手绘稿明确指定免费 524MB)

const initialSeedData = {
  currentUser: {
    id: 'usr_1001',
    nickname: '林深见鹿与猫',
    phone: '13819283746',
    signature: '家里一猫一柴，记录每日三餐与四季溜达。',
    city: '杭州市 · 西湖区',
    avatarSeed: 'user-lin',
    vipLevel: 'LV.3 琥珀金卡会员',
    vipPoints: 2680,
    vipNextPoints: 3000,
    vipExpireDate: '2027-06-30',
    vipBenefits: [
      { id: 'b1', title: '商城严选 95 折', desc: '全品类口粮/用品自动折上折', active: true },
      { id: 'b2', title: '每月 2 次免费图文问诊', desc: '三甲级执业兽医 10 分钟响应', active: true },
      { id: 'b3', title: '云相册扩容 8 折特权', desc: '基础免费 524MB，升级享专属价', active: true },
      { id: 'b4', title: '宠物托运极速检疫通道', desc: '代办动物检疫合格证明优先排期', active: true }
    ],
    settings: {
      pushReminder: true,
      feedingAlert: true,
      fenceAlert: true,
      weightUnit: 'kg',
      tempUnit: '°C',
      strictSecuritySign: true
    }
  },

  currentPetId: 'pet_momo',

  pets: [
    {
      id: 'pet_momo',
      name: '年糕',
      species: '猫',
      breed: '英国短毛猫 · 金渐层 NY12',
      gender: '弟弟 (已绝育)',
      birthday: '2024-03-18',
      ageText: '2岁7个月',
      weightKg: 4.85,
      bodyTempC: 38.5,
      chipNo: '900118002948102',
      allergy: '对禽类软骨粉轻度软便，禁食百合科植物',
      dailyStatus: '今日精神饱满 · 便便成型度健康 · 饮水达标',
      personality: '傲娇主子',
      avatarType: 'cat_gold',
      nextVaccineDate: '2027-03-15',
      nextDewormDate: '2026-11-10'
    },
    {
      id: 'pet_doudou',
      name: '芝麻糊',
      species: '狗',
      breed: '赤柴 · 豆柴体型',
      gender: '妹妹 (已绝育)',
      birthday: '2023-08-09',
      ageText: '3岁2个月',
      weightKg: 8.4,
      bodyTempC: 38.6,
      chipNo: '900118007381920',
      allergy: '无明显食物过敏，换季草地花粉轻微抓挠',
      dailyStatus: '早间已溜达 2.6km · 食欲极佳 · 睡眠安稳',
      personality: '粘人小狗',
      avatarType: 'dog_shiba',
      nextVaccineDate: '2027-05-20',
      nextDewormDate: '2026-11-05'
    },
    {
      id: 'pet_putao',
      name: '糯米团',
      species: '异宠',
      breed: '蜜袋鼯 · 白化蜜',
      gender: '弟弟',
      birthday: '2025-05-01',
      ageText: '1岁5个月',
      weightKg: 0.12,
      bodyTempC: 36.8,
      chipNo: 'EXOTIC-2025-088',
      allergy: '忌高脂肪坚果过量、忌柑橘果皮',
      dailyStatus: '夜间活动活跃 · 钙磷比摄入正常',
      personality: '贪吃憨憨',
      avatarType: 'exotic_glider',
      nextVaccineDate: '无需常规联苗(半年体检)',
      nextDewormDate: '2026-12-01'
    }
  ],

  // ① 健康档案（疫苗、驱虫、体重记录、体温记录、看病/医疗记录）
  healthRecords: [
    {
      id: 'hr_101',
      petId: 'pet_momo',
      category: '疫苗',
      title: '妙三多 (猫三联灭活疫苗) 年度加强针',
      date: '2026-03-15',
      nextDate: '2027-03-15',
      hospital: '杭州瑞鹏宠物医院 (西湖总院)',
      doctor: '周明远 主任兽医师',
      valueText: '抗体滴度 S5 (高保护)',
      notes: '接种后留观30分钟无不良反应，体重 4.75kg'
    },
    {
      id: 'hr_102',
      petId: 'pet_momo',
      category: '驱虫',
      title: '海乐妙 + 大宠爱 体内外同驱',
      date: '2026-10-10',
      nextDate: '2026-11-10',
      hospital: '居家自主滴剂/口服',
      doctor: '林深见鹿与猫',
      valueText: '体内+体外全谱',
      notes: '后颈滴剂吸收良好，已戴伊丽莎白圈防舔 2 小时'
    },
    {
      id: 'hr_103',
      petId: 'pet_momo',
      category: '体重',
      title: '十月例行称重记录',
      date: '2026-10-20',
      nextDate: '2026-11-20',
      hospital: '智能食碗联动体脂秤',
      doctor: '系统自动同步',
      valueText: '4.85 kg',
      notes: '较上月微增 0.05kg，BCS体况评分 5/9 理想体型'
    },
    {
      id: 'hr_104',
      petId: 'pet_momo',
      category: '体温',
      title: '耳温枪日常监测',
      date: '2026-10-22',
      nextDate: '',
      hospital: '居家日常护理',
      doctor: '林深见鹿与猫',
      valueText: '38.5 °C',
      notes: '猫咪正常体温区间 (38.0°C ~ 39.2°C)，耳道清爽无分泌物'
    },
    {
      id: 'hr_105',
      petId: 'pet_momo',
      category: '看病记录',
      title: '换季轻度软便及肠道菌群调理',
      date: '2026-09-04',
      nextDate: '已痊愈',
      hospital: '芭比堂动物医院 (文三路院)',
      doctor: '陈知夏 主治医师',
      valueText: '粪检阴性 · 益生菌调理',
      notes: '显微镜粪检未见球虫与滴虫，开具布拉迪酵母益生菌连服7天，已完全恢复正常香蕉便。'
    },
    {
      id: 'hr_201',
      petId: 'pet_doudou',
      category: '疫苗',
      title: '卫佳捌 (犬八联) + 锐必威狂犬疫苗',
      date: '2026-05-20',
      nextDate: '2027-05-20',
      hospital: '杭州瑞鹏宠物医院',
      doctor: '周明远 主任兽医师',
      valueText: '犬证年审已备案',
      notes: '芯片扫描核验通过，免疫证号 HZ-2026-88412'
    },
    {
      id: 'hr_202',
      petId: 'pet_doudou',
      category: '体重',
      title: '十月运动后称重',
      date: '2026-10-21',
      nextDate: '2026-11-21',
      hospital: '居家称重',
      doctor: '林深见鹿与猫',
      valueText: '8.40 kg',
      notes: '肌肉线条紧实，每日保持早晚各 30 分钟慢跑'
    }
  ],

  // ② 记账：支出、收入（饮食口粮、医疗疫苗、体内外驱虫、零食营养品、玩具服饰、洗护美容）
  ledgerEntries: [
    {
      id: 'led_1',
      petId: 'pet_momo',
      type: '支出',
      category: '饮食口粮',
      title: '法米娜 N&D 石榴鸡肉全价成猫粮 5kg',
      amount: 398.0,
      date: '2026-10-18',
      note: '防伪溯源码已验真，够吃约 2.5 个月'
    },
    {
      id: 'led_2',
      petId: 'pet_momo',
      type: '支出',
      category: '体内外驱虫',
      title: '大宠爱外驱 3支装 + 海乐妙内驱',
      amount: 215.0,
      date: '2026-10-10',
      note: '秋冬季每月定期驱虫储备'
    },
    {
      id: 'led_3',
      petId: 'pet_momo',
      type: '支出',
      category: '零食营养品',
      title: 'K9 Natural 主食冻干鸡肉味 + 鱼油胶囊',
      amount: 168.5,
      date: '2026-10-12',
      note: '美毛护肤补充 Omega-3'
    },
    {
      id: 'led_4',
      petId: 'pet_doudou',
      type: '支出',
      category: '洗护美容',
      title: '柴犬去底绒精细SPA洗护+剪指甲清耳道',
      amount: 128.0,
      date: '2026-10-16',
      note: '木森宠物生活馆会员卡扣减'
    },
    {
      id: 'led_5',
      petId: 'pet_momo',
      type: '支出',
      category: '医疗疫苗',
      title: '年度生化全套体检 + 心超筛查',
      amount: 560.0,
      date: '2026-09-28',
      note: '宠物医保已直赔报销 65%，此处记自付额'
    },
    {
      id: 'led_6',
      petId: 'pet_doudou',
      type: '支出',
      category: '玩具服饰',
      title: '剑麻耐咬发声飞盘 + 反光冲锋衣雨衣',
      amount: 89.0,
      date: '2026-10-08',
      note: '阴雨天出门遛狗必备'
    },
    {
      id: 'led_7',
      petId: 'pet_momo',
      type: '收入',
      category: '宠拍/补贴',
      title: '社区【秋日晒宠大赏】优胜稿费与罐头礼盒折现',
      amount: 300.0,
      date: '2026-10-19',
      note: '年糕自己赚的罐头基金'
    },
    {
      id: 'led_8',
      petId: 'pet_doudou',
      type: '收入',
      category: '闲置回血',
      title: '同城转让闲置小号航空箱',
      amount: 120.0,
      date: '2026-10-05',
      note: '宠友自提已收款'
    }
  ],

  // ⑥ 待办提醒（自由设置提醒）
  reminders: [
    {
      id: 'rem_1',
      petId: 'pet_momo',
      title: '喂深海鱼油 1 粒 + 化毛膏 3cm',
      time: '每日 20:00',
      cycle: '每日重复',
      category: '日常护理',
      done: false,
      urgent: true
    },
    {
      id: 'rem_2',
      petId: 'pet_momo',
      title: '清洗智能饮水机并更换椰壳活性炭滤芯',
      time: '2026-10-25 10:30',
      cycle: '每15天',
      category: '设备维护',
      done: false,
      urgent: true
    },
    {
      id: 'rem_3',
      petId: 'pet_doudou',
      title: '心丝虫预防咀嚼片 (犬心保) 投喂',
      time: '2026-11-05 09:00',
      cycle: '每月5日',
      category: '驱虫免疫',
      done: false,
      urgent: false
    },
    {
      id: 'rem_4',
      petId: 'pet_momo',
      title: '修剪前后爪尖 + 擦拭下巴预防黑下巴',
      time: '今日 18:30',
      cycle: '每周五',
      category: '洗护卫生',
      done: true,
      urgent: false
    }
  ],

  // ⑤ 宠物 AI 对话历史
  aiChatHistories: {
    pet_momo: [
      {
        id: 'msg_1',
        sender: 'pet',
        personality: '傲娇主子',
        text: '哼，总算想起打开本喵的档案本了？今天智能食碗12点准时出了25克法米娜，勉强算你及格。有什么问题快问，本喵允许你采访三分钟。',
        time: '10:12'
      }
    ],
    pet_doudou: [
      {
        id: 'msg_2',
        sender: 'pet',
        personality: '粘人小狗',
        text: '汪！你终于来看芝麻糊啦！今天早上我们跑了2.6公里，我的小飞盘还放在玄关呢，晚上我们再去草坪找好朋友玩好不好呀？',
        time: '10:15'
      }
    ],
    pet_putao: [
      {
        id: 'msg_3',
        sender: 'pet',
        personality: '贪吃憨憨',
        text: '吱吱~ 昨晚的桉树蜜和面包虫冻干太香啦，我还在树洞睡袋里打盹呢，有好吃的记得叫醒我！',
        time: '10:18'
      }
    ]
  },

  // 宠物服务（医院查询、美容寄养、宠物托运、线上询诊/好物）+ 宠物保险
  servicesData: {
    hospitals: [
      {
        id: 'hosp_1',
        name: '杭州瑞鹏中心宠物医院 (24h转诊中心)',
        distance: '1.2 km',
        rating: 4.9,
        tags: ['24小时急诊', '猫科专科金标', '医保定点直赔', 'CT/核磁影像'],
        address: '西湖区天目山路 218 号一楼',
        phone: '0571-88293120',
        status: '营业中 · 当前候诊 1 位'
      },
      {
        id: 'hosp_2',
        name: '木森猫科动物专科医院',
        distance: '2.4 km',
        rating: 4.8,
        tags: ['独立猫诊室零应激', '老年病/肾病管理', '疫苗官方授权'],
        address: '西湖区文二西路 96 号',
        phone: '0571-87654321',
        status: '营业中 · 无需排队'
      },
      {
        id: 'hosp_3',
        name: '云栖异宠与伴侣动物诊疗中心',
        distance: '3.8 km',
        rating: 4.9,
        tags: ['异宠专科(蜜袋鼯/兔/爬宠)', '气体麻醉外科', '住院恒温舱'],
        address: '拱墅区莫干山路 512 号',
        phone: '0571-85119090',
        status: '营业中 · 可预约专家号'
      }
    ],
    groomingBoarding: [
      {
        id: 'srv_gb_1',
        type: '宠物美容',
        shopName: '爪印森林日式洗护工坊',
        title: '碳酸泉深层蓬松SPA + 8步精细护理',
        price: 118,
        distance: '850 m',
        highlights: '全程透明玻璃房 · 42°C静音柔风烘干 · 一客一消毒'
      },
      {
        id: 'srv_gb_2',
        type: '寄养预约',
        shopName: '森屿猫犬家庭式独栋寄养酒店',
        title: '阳光独卫实木别墅房 (24h高清云监控)',
        price: 158,
        distance: '1.9 km',
        highlights: '新风除菌系统 · 每日2次户外草坪溜达 · 专人陪玩记录'
      }
    ],
    transportPlans: [
      {
        id: 'trans_1',
        mode: '航空有氧舱门到门托运',
        route: '全国主要空港城市当日达',
        priceFrom: 580,
        includes: '含官方《动物检疫合格证明》代办 + 航司有氧舱预订 + 专车恒温接驳'
      },
      {
        id: 'trans_2',
        mode: '一对一宠物的士专车护送',
        route: '江浙沪跨城 / 同城搬家随行',
        priceFrom: 260,
        includes: '主人可免费同乘 · 独立航空箱固定 · 途中饮水喂食照料 · 全程GPS共享'
      }
    ],
    onlineDoctors: [
      {
        id: 'doc_1',
        name: '周明远 主任兽医师',
        title: '国家执业兽医师 · 14年临床经验',
        specialty: '擅长：犬猫消化道软便呕吐、皮肤真菌癣症、疫苗驱虫解读、体检报告分析',
        replyTime: '平均 3 分钟内接诊',
        fee: '会员免费 (原价 ¥29)'
      },
      {
        id: 'doc_2',
        name: '林知微 异宠与猫科主治医师',
        title: '农大兽医硕士 · 异宠临床专科',
        specialty: '擅长：猫咪泌尿道闭尿防治、蜜袋鼯/侏儒兔营养配比与应激急救',
        replyTime: '平均 5 分钟内接诊',
        fee: '会员免费 (原价 ¥39)'
      }
    ],
    insurancePlans: [
      {
        id: 'ins_1',
        name: '爪印守护 · 定点医院直赔尊享版',
        company: '众安宠物医疗险联名',
        monthlyPrice: 36,
        annualCoverage: 20000,
        reimburseRate: '定点医院直赔 75% (0免赔额)',
        coveredPetId: 'pet_momo',
        policyStatus: '保障生效中 · 保单号 PAW-INS-20260918',
        highlights: ['覆盖传染病/肠胃炎/骨折外伤/误食异物手术', '全国 8,500+ 定点医院刷芯片直接结算']
      },
      {
        id: 'ins_2',
        name: '汪星人户外运动意外与三者责任险',
        company: '太保伴侣动物保障计划',
        monthlyPrice: 19.9,
        annualCoverage: 50000,
        reimburseRate: '医疗报销 80% + 含 5万第三者误伤责任',
        coveredPetId: 'pet_doudou',
        policyStatus: '可一键加保',
        highlights: ['遛狗意外扭伤/草地蜱虫叮咬全包', '含误伤路人或其它犬只医疗赔付']
      }
    ],
    bookings: [
      {
        id: 'bk_1001',
        serviceType: '美容寄养',
        title: '爪印森林日式洗护工坊 · 碳酸泉SPA',
        petName: '芝麻糊',
        date: '2026-10-26 14:00',
        status: '已预约确认'
      }
    ]
  },

  // ④ 宠物相册：免费 524MB，额外付费升级
  albumState: {
    freeQuotaBytes: FREE_ALBUM_QUOTA_BYTES, // 524 MB = 549,453,824 Bytes
    extraQuotaBytes: 0,
    planName: '基础免费云空间 (524 MB)',
    photos: [
      {
        id: 'pho_1',
        petId: 'pet_momo',
        title: '午后阳台晒肚皮的年糕',
        date: '2026-10-22',
        tag: '日常治愈',
        sizeBytes: 128 * 1024 * 1024, // 128 MB (4K LivePhoto 合集)
        aspect: 'landscape',
        palette: '#E8C59B',
        illustration: 'cat_sunbath'
      },
      {
        id: 'pho_2',
        petId: 'pet_doudou',
        title: '西湖草坪接飞盘高速连拍 RAW',
        date: '2026-10-19',
        tag: '户外溜达',
        sizeBytes: 156 * 1024 * 1024, // 156 MB
        aspect: 'square',
        palette: '#C4D7B2',
        illustration: 'dog_frisbee'
      },
      {
        id: 'pho_3',
        petId: 'pet_momo',
        title: '两周岁生日三文鱼蛋糕纪念',
        date: '2026-09-30',
        tag: '成长里程碑',
        sizeBytes: 94 * 1024 * 1024, // 94 MB
        aspect: 'portrait',
        palette: '#F2D0C4',
        illustration: 'birthday_cake'
      },
      {
        id: 'pho_4',
        petId: 'pet_putao',
        title: '糯米团第一次跳上手掌心视频原片',
        date: '2026-10-08',
        tag: '破冰瞬间',
        sizeBytes: 64 * 1024 * 1024, // 64 MB
        aspect: 'square',
        palette: '#D8D2E1',
        illustration: 'glider_jump'
      }
    ]
  },

  // 设备页：智能食碗、饮水机 <-> 喂食；监控、定位项圈 <-> 找宠 + 遛宠路线记录
  devicesState: {
    feeder: {
      deviceId: 'DEV-FEEDER-01',
      name: 'PawLink 陶瓷称重智能食碗 Pro',
      online: true,
      bowlRemainGrams: 42,
      hopperRemainGrams: 1680,
      todayFedCount: 3,
      todayFedGrams: 65,
      todayEatenGrams: 58,
      lastFeedTime: '12:30',
      schedules: [
        { id: 'sch_1', time: '07:30', grams: 20, enabled: true, label: '晨间元气餐' },
        { id: 'sch_2', time: '12:30', grams: 20, enabled: true, label: '午间加餐' },
        { id: 'sch_3', time: '18:30', grams: 25, enabled: true, label: '晚间主餐' },
        { id: 'sch_4', time: '22:30', grams: 10, enabled: false, label: '夜宵防饿' }
      ]
    },
    fountain: {
      deviceId: 'DEV-WATER-02',
      name: 'PawLink 湧泉净滤恒温饮水机',
      online: true,
      waterLevelPercent: 78,
      filterLifePercent: 64,
      waterTempC: 24.5,
      todayDrinkCount: 8,
      todayDrinkMl: 185,
      mode: '间歇感应涌泉模式'
    },
    collar: {
      deviceId: 'DEV-COLLAR-03',
      name: 'PawLink 北斗/GPS双模定位与云台监控项圈',
      online: true,
      batteryPercent: 86,
      signalStrength: '5G + 北斗四星满格',
      locationName: '杭州市西湖区 · 桂花城中心草坪东南角 (安全围栏内)',
      lat: 30.2741,
      lng: 120.1258,
      inSafeFence: true,
      fenceRadiusMeters: 300,
      buzzerActive: false,
      cameraOnline: true,
      cameraSnapshotTag: '实时画面：正在草地嗅闻落叶 · 心率 92 bpm'
    },
    walkRoutes: [
      {
        id: 'walk_1',
        petId: 'pet_doudou',
        petName: '芝麻糊',
        date: '2026-10-23 07:40',
        distanceKm: 2.64,
        durationMin: 38,
        caloriesKcal: 142,
        routeSummary: '桂花城北门 → 余杭塘河绿道 → 银杏林草坪环线',
        pointsCount: 186,
        markers: ['饮水补给点×1', '便便打卡×1', '偶遇宠友豆包×1']
      },
      {
        id: 'walk_2',
        petId: 'pet_doudou',
        petName: '芝麻糊',
        date: '2026-10-22 19:15',
        distanceKm: 3.12,
        durationMin: 46,
        caloriesKcal: 168,
        routeSummary: '文二西路街心花园 → 湿地公园外围步道',
        pointsCount: 224,
        markers: ['飞盘训练15分钟', '便便打卡×1']
      }
    ]
  },

  // ③ 宠物社交（推荐、关注、食谱[能吃/不能吃]、找朋友、文章/动态发布）
  socialPosts: [
    {
      id: 'post_1',
      tab: '推荐',
      type: '文章',
      author: '周明远兽医师',
      authorBadge: '认证执业兽医',
      petTag: '犬猫通用 · 换季护理',
      title: '入秋早晚温差超 10°C，做好这 3 件事让毛孩子远离软便与喷嚏',
      content: '每年十月是猫咪下泌尿道综合征与狗狗换季肠胃炎的高发期。第一：饮水机建议开启 25°C 微温模式，保证每日每公斤体重 45-60ml 饮水量；第二：更换新粮务必遵循 7 日换粮法；第三：早晚遛狗回家擦干脚垫，避免舔舐潮湿草地残留的露水与虫卵。',
      likes: 428,
      comments: 56,
      liked: true,
      time: '2小时前',
      coverTheme: 'autumn_care'
    },
    {
      id: 'post_2',
      tab: '推荐',
      type: '动态',
      author: '阿泽与金毛麦芽',
      authorBadge: '西湖区 · 1.1km',
      petTag: '金毛寻回犬 · 3岁',
      title: '秋日桂花雨下的捡树枝冠军',
      content: '今天带麦芽去余杭塘河绿道跑了 4 公里，满地都是桂花香。这家伙硬是叼了一根比它还宽的树枝一路走回家，路过的小朋友都在给它鼓掌哈哈！',
      likes: 189,
      comments: 24,
      liked: false,
      time: '4小时前',
      coverTheme: 'golden_walk'
    },
    {
      id: 'post_3',
      tab: '关注',
      type: '动态',
      author: '布偶猫小雪球',
      authorBadge: '已互相关注',
      petTag: '海双布偶 · 1岁半',
      title: '自制三文鱼南瓜蒸鸡胸肉丸，光盘行动达成！',
      content: '按食谱频道里的低敏配方做的周末鲜食加餐：鸡胸肉 150g + 挪威三文鱼 50g + 贝贝南瓜泥 30g，不加一粒盐，出锅后淋半颗鱼油，两只小猫埋头苦干 3 分钟清空食碗。',
      likes: 312,
      comments: 41,
      liked: true,
      time: '昨天 19:20',
      coverTheme: 'homemade_food'
    }
  ],

  // 食谱百科（能吃 / 慎吃 / 不能吃 + 营养自制食谱）
  foodRecipes: [
    {
      id: 'fd_1',
      name: '熟鸡胸肉 / 鸭胸肉 (去皮无盐)',
      safetyLevel: '能吃', // 能吃 | 慎吃 | 不能吃
      suitableFor: '猫 / 狗 / 蜜袋鼯',
      category: '肉禽蛋白',
      summary: '高蛋白低脂肪的优质肉源，适合作为日常鲜食主料或训练奖励冻干。',
      detail: '必须彻底煮熟或蒸熟（或经过零下40度辐照杀菌的生骨肉），切忌添加洋葱、大蒜、食盐及黑胡椒调味。'
    },
    {
      id: 'fd_2',
      name: '贝贝南瓜 / 胡萝卜 (蒸熟压泥)',
      safetyLevel: '能吃',
      suitableFor: '猫 / 狗',
      category: '果蔬膳食纤维',
      summary: '富含植物膳食纤维与 β-胡萝卜素，温和双向调理猫咪与狗狗软便及轻微便秘。',
      detail: '建议去皮去籽蒸熟后压成泥，混入主食罐头或肉泥中，占比不超过当餐总量的 10%。'
    },
    {
      id: 'fd_3',
      name: '蓝莓 / 去核熟苹果肉',
      safetyLevel: '能吃',
      suitableFor: '狗 / 猫(少量)',
      category: '花青素水果',
      summary: '天然抗氧化花青素与维生素C来源，护眼美毛。',
      detail: '苹果必须彻底去除果核与果籽（苹果籽含氰化物前体），每次喂食 2~3 颗蓝莓即可。'
    },
    {
      id: 'fd_4',
      name: '猪肝 / 鸡肝 (内脏类)',
      safetyLevel: '慎吃',
      suitableFor: '猫 / 狗',
      category: '动物内脏',
      summary: '富含铁质与维生素A，但长期过量食用会导致维生素A中毒及骨骼畸形。',
      detail: '每周喂食不宜超过 1~2 次，每次占当餐比例不超过 5%，不可将鸡肝作为单一主食。'
    },
    {
      id: 'fd_5',
      name: '无糖希腊酸奶 / 舒化奶',
      safetyLevel: '慎吃',
      suitableFor: '狗 / 猫',
      category: '乳制品',
      summary: '普通牛奶含高乳糖易引发剧烈腹泻；无乳糖舒化奶或无糖纯酸奶可少量尝鲜。',
      detail: '务必确认配料表不含【木糖醇 (Xylitol)】代糖！木糖醇对犬只具有极高致死性。'
    },
    {
      id: 'fd_6',
      name: '葡萄 / 葡萄干 / 提子',
      safetyLevel: '不能吃',
      suitableFor: '绝对禁食 (狗/猫)',
      category: '高危剧毒禁忌',
      summary: '极少量即可引发犬猫急性肾功能衰竭、无尿与休克，致死率极高！',
      detail: '急救指南：若发现误食葡萄或葡萄干，黄金 2 小时内立即送往24h宠物医院催吐并监测肌酐(CREA)与尿素氮(BUN)指标。'
    },
    {
      id: 'fd_7',
      name: '洋葱 / 大葱 / 韭菜 / 大蒜',
      safetyLevel: '不能吃',
      suitableFor: '绝对禁食 (猫/狗/异宠)',
      category: '高危剧毒禁忌',
      summary: '含有正丙基二硫化物，会破坏红细胞引发急性溶血性贫血、血尿与黄疸。',
      detail: '包括含有洋葱粉的儿童肉松、人类外卖肉汤、披萨馅料均严禁投喂。'
    },
    {
      id: 'fd_8',
      name: '巧克力 / 可可制品 / 咖啡茶饮',
      safetyLevel: '不能吃',
      suitableFor: '绝对禁食 (全宠类)',
      category: '高危剧毒禁忌',
      summary: '可可碱与咖啡因无法被犬猫代谢，会导致心律失常、癫痫抽搐乃至心力衰竭。',
      detail: '黑巧克力的可可碱含量最高，误食后需立即就医进行催吐与活性炭吸附治疗。'
    },
    {
      id: 'fd_9',
      name: '百合花 (全株及花粉/花瓶水)',
      safetyLevel: '不能吃',
      suitableFor: '对猫剧毒致死',
      category: '高危植物禁忌',
      summary: '猫咪哪怕仅舔舐沾在毛上的几粒百合花粉，也会在 24-72 小时内引发不可逆急性肾衰。',
      detail: '养猫家庭严禁摆放香水百合、水仙、郁金香、滴水观音等植物。'
    }
  ],

  // 找朋友（同城宠友搭子）
  petFriends: [
    {
      id: 'fr_1',
      ownerName: '陈小满',
      petName: '豆包 (柯基 · 2岁)',
      distance: '450 m · 桂花城大草坪常客',
      intro: '性格超好从不护食，每天傍晚 18:30 准时出门溜达，求约飞盘搭子！',
      followed: true
    },
    {
      id: 'fr_2',
      ownerName: '苏苏',
      petName: '橘座 (德文卷毛猫 · 1岁)',
      distance: '1.3 km · 文二西路',
      intro: '喜欢穿针织小毛衣出门晒太阳的社牛小猫，欢迎同城猫友交流自制熟自制配方。',
      followed: false
    },
    {
      id: 'fr_3',
      ownerName: '林木木',
      petName: '闪电 (蜜袋鼯 · 8个月)',
      distance: '2.1 km · 城西银泰附近',
      intro: '异宠家长互助，家里常备桉树叶和杜比亚，可共享异宠专科医院避坑笔记。',
      followed: false
    }
  ],

  // 商城（全部、关注、狗、猫、异宠）
  mallProducts: [
    {
      id: 'prd_101',
      category: '猫',
      shopName: '法米娜 Farmina 海外旗舰店',
      followedShop: true,
      title: '法米娜 N&D 石榴鸡肉无谷全价猫粮',
      subtitle: '94%动物蛋白 · 意大利原装进口 · 防伪双码溯源',
      price: 398,
      originPrice: 468,
      salesText: '已售 1.2万+',
      specs: ['1.5kg 尝鲜装', '5kg 家庭囤货装'],
      badge: '金卡95折'
    },
    {
      id: 'prd_102',
      category: '猫',
      shopName: '帕特 Partner 官方自营店',
      followedShop: true,
      title: '帕特生骨肉主食冻干 鹿肉+乳鸽配方 240g',
      subtitle: '8:1:1 黄金生骨肉配比 · 0肉粉0谷物 · 复水秒变鲜肉罐',
      price: 158,
      originPrice: 189,
      salesText: '已售 8500+',
      specs: ['鹿肉配方 240g', '乳鸽配方 240g'],
      badge: '复购榜第1'
    },
    {
      id: 'prd_103',
      category: '狗',
      shopName: '渴望 Orijen 授权专营店',
      followedShop: true,
      title: '渴望 Orijen 原味鸡肉全犬期无谷狗粮 6kg',
      subtitle: '85%高含肉量 · 鲜鸡肉/火鸡/全蛋 · 紧实肌肉亮泽被毛',
      price: 549,
      originPrice: 620,
      salesText: '已售 9300+',
      specs: ['2kg 便携装', '6kg 标准装', '11.4kg 大包装'],
      badge: '海关溯源'
    },
    {
      id: 'prd_104',
      category: '狗',
      shopName: '大宠爱 Zoetis 动保大药房',
      followedShop: false,
      title: '犬心保 + 尼可信 犬用体内外同驱礼盒装',
      subtitle: '牛肉味可口咀嚼片 · 预防心丝虫+强效杀灭蜱虫跳蚤',
      price: 238,
      originPrice: 280,
      salesText: '已售 3.4万+',
      specs: ['小型犬 (2-11kg) 3粒装', '中型犬 (11-22kg) 3粒装'],
      badge: '兽医推荐'
    },
    {
      id: 'prd_105',
      category: '异宠',
      shopName: '森野异宠营养实验室',
      followedShop: false,
      title: '蜜袋鼯 HPW 高蛋白综合果蔬蜜粮 + 树胶钙粉套组',
      subtitle: '澳洲兽医配方科学钙磷比 2:1 · 预防后肢麻痹症',
      price: 86,
      originPrice: 108,
      salesText: '已售 2100+',
      specs: ['HPW综合粮 300g + 钙粉', '黑水虻果泥营养膏 120g'],
      badge: '异宠严选'
    },
    {
      id: 'prd_106',
      category: '异宠',
      shopName: '森野异宠营养实验室',
      followedShop: true,
      title: '天然苹果木站架 + 恒温羊羔绒树洞睡袋',
      subtitle: '无漆原木高温烘干 · 可拆洗防勾爪内胆',
      price: 68,
      originPrice: 85,
      salesText: '已售 1600+',
      specs: ['M码 (单只适用)', 'L码 (双只家庭适用)'],
      badge: '手作原木'
    }
  ],

  // 购物车（点进去界面类似淘宝：按店铺分组、规格选择、勾选结算）
  cartItems: [
    {
      id: 'cart_1',
      productId: 'prd_101',
      shopName: '法米娜 Farmina 海外旗舰店',
      title: '法米娜 N&D 石榴鸡肉无谷全价猫粮',
      spec: '5kg 家庭囤货装',
      price: 398,
      qty: 1,
      checked: true,
      promoTag: '跨店满300减30 · 金卡再享95折'
    },
    {
      id: 'cart_2',
      productId: 'prd_102',
      shopName: '帕特 Partner 官方自营店',
      title: '帕特生骨肉主食冻干 鹿肉+乳鸽配方 240g',
      spec: '乳鸽配方 240g',
      price: 158,
      qty: 2,
      checked: true,
      promoTag: '满2件赠试吃包50g'
    },
    {
      id: 'cart_3',
      productId: 'prd_104',
      shopName: '大宠爱 Zoetis 动保大药房',
      title: '犬心保 + 尼可信 犬用体内外同驱礼盒装',
      spec: '小型犬 (2-11kg) 3粒装',
      price: 238,
      qty: 1,
      checked: false,
      promoTag: '兽药GSP正品保障'
    }
  ],

  // 我的订单（待付款、待使用、已完成、退款/售后）
  orders: [
    {
      id: 'ORD-20261023-891',
      status: '待付款',
      shopName: '渴望 Orijen 授权专营店',
      items: [{ title: '渴望 Orijen 原味鸡肉全犬期无谷狗粮', spec: '6kg 标准装', qty: 1, price: 549 }],
      totalAmount: 521.55,
      createdAt: '2026-10-23 09:40',
      note: '金卡会员已自动抵扣 ¥27.45'
    },
    {
      id: 'ORD-20261021-642',
      status: '待使用',
      shopName: '爪印森林日式洗护工坊',
      items: [{ title: '柴犬去底绒碳酸泉精细SPA套餐 (电子核销券)', spec: '中型犬通用', qty: 1, price: 118 }],
      totalAmount: 118.0,
      createdAt: '2026-10-21 15:20',
      verifyCode: '8829-4102-99',
      note: '到店出示核销码即可使用，过期自动退'
    },
    {
      id: 'ORD-20261015-310',
      status: '已完成',
      shopName: '法米娜 Farmina 海外旗舰店',
      items: [{ title: '法米娜 N&D 石榴鸡肉无谷全价猫粮', spec: '5kg 家庭囤货装', qty: 1, price: 398 }],
      totalAmount: 368.0,
      createdAt: '2026-10-15 20:11',
      note: '顺丰送货上门已签收 · 防伪码验真通过'
    },
    {
      id: 'ORD-20261009-105',
      status: '退款/售后',
      shopName: '森野异宠营养实验室',
      items: [{ title: '恒温羊羔绒树洞睡袋 (尺码拍小换货)', spec: 'M码', qty: 1, price: 68 }],
      totalAmount: 68.0,
      createdAt: '2026-10-09 11:05',
      note: '极速退款已原路退回至微信零钱'
    }
  ],

  // 共享宠物（家庭共同管理）
  sharedMembers: [
    {
      id: 'shm_1',
      name: '周先生 (家属)',
      role: '协同管理员',
      sharedPets: ['年糕', '芝麻糊'],
      permissions: '可远程喂食、记账、上传相册、查看定位',
      joinedAt: '2026-01-15'
    },
    {
      id: 'shm_2',
      name: '木森寄养管家-小唐',
      role: '临时照护员 (限时授权)',
      sharedPets: ['芝麻糊'],
      permissions: '仅可查看饮食过敏档案与添加日常喂食记录',
      joinedAt: '2026-10-20 (有效期7天)'
    }
  ],

  // 收货地址（设置 -> 收货地址）
  addresses: [
    {
      id: 'addr_1',
      name: '林宇宸',
      phone: '13819283746',
      region: '浙江省 杭州市 西湖区',
      detail: '文二西路桂花城沁园 6 幢 2 单元 501 室',
      tag: '家 (默认)',
      isDefault: true
    },
    {
      id: 'addr_2',
      name: '林宇宸',
      phone: '13819283746',
      region: '浙江省 杭州市 西湖区',
      detail: '天目山路国际科创园 A 座 12 楼',
      tag: '公司',
      isDefault: false
    }
  ],

  // 底部合规信息：关于我们、用户协议、联系客服、公告
  complianceDocs: {
    aboutUs: {
      title: '关于我们 · 爪印日记 (PawLog)',
      version: 'v2.4.0 (Build 20261023)',
      content: '爪印日记是一款专为养宠家庭打造的全生命周期手账与智能硬件中枢。我们坚持克制、温暖、无广告打扰的产品哲学，将健康病历档案、科学收支记账、524MB加密云相册、红绿灯食材安全百科与PawLink智能硬件融为一体，陪伴每一只毛孩子健康长大。'
    },
    userAgreement: {
      title: '用户服务协议与隐私数据保护声明',
      version: '2026年10月修订版',
      content: '1. 数据主权：您上传的宠物健康档案、定位轨迹与相册原图均归您本人所有，采用端到端传输签名（HMAC-SHA256）与防重放保护。\n2. 医疗免责声明：宠物AI对话与食谱红绿灯百科基于兽医学文献整理，仅供日常养护参考；如遇急性呕吐、误食毒物等紧急情况，请立即前往24小时线下动物医院就诊。\n3. 商城与服务保障：平台自营口粮与药品均执行GSP溯源验真，支持假一赔十与未拆封7天无理由退换。'
    },
    customerService: {
      title: '联系客服与执业兽医值班台',
      hotline: '400-882-9527 (每日 08:00 - 24:00)',
      wechat: 'PawLog_Care',
      faq: [
        'Q: 智能食碗断网后还会按时出粮吗？ -> A: 会，食碗内置RTC时钟芯片与备用电池，断网断电均按已下发的计划准时出粮。',
        'Q: 免费 524MB 相册满了怎么办？ -> A: 已上传照片永久保留，可随时清理重复视频或一键升级 10GB/50GB 家庭共享云空间。',
        'Q: 宠物保险如何在定点医院直赔？ -> A: 在瑞鹏/芭比堂等定点医院前台出示本APP内的电子保单二维码与芯片号，结算时自动抵扣报销额度。'
      ]
    },
    announcements: [
      {
        id: 'ann_1',
        date: '2026-10-22',
        title: '【系统公告】PawLink 定位项圈固件 v1.2.8 升级：新增电子围栏越界秒级推送',
        summary: '本次更新优化了林荫道与高楼区域的北斗双频定位精度，功耗降低 18%。'
      },
      {
        id: 'ann_2',
        date: '2026-10-15',
        title: '【社区公报】秋季犬猫狂犬免疫定点补贴医院名单已更新',
        summary: '新增主城区 26 家官方定点免疫服务站，可在【首页 -> 服务 -> 医院查询】中筛选查看。'
      }
    ]
  }
};

function ensureDbFile() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialSeedData, null, 2), 'utf8');
  }
}

function loadDb() {
  ensureDbFile();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return JSON.parse(JSON.stringify(initialSeedData));
  }
}

function saveDb(data) {
  ensureDbFile();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

module.exports = {
  FREE_ALBUM_QUOTA_BYTES,
  loadDb,
  saveDb
};
