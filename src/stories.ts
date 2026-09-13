export type StoryAction = {
  target: 'hero' | 'bush' | 'branches' | 'path-0' | 'path-1' | 'path-2' | 'light' | 'cloud' | 'bell' | 'walnut' | 'friend' | 'bark' | 'umbrella';
  hint: string;
  after: string;
  label: string;
};

export type StoryScene = {
  title: string;
  text: string;
  actions: [StoryAction, ...StoryAction[]];
};

export type Story = {
  id: string;
  title: string;
  subtitle: string;
  theme: 'forest' | 'sea' | 'sky' | 'autumn' | 'rain';
  color: string;
  cover: { color: string; lines: [string, string] };
  tag: string;
  duration: string;
  description: string;
  character: string;
  reward: string;
  keepsake: string;
  scenes: [StoryScene, StoryScene, StoryScene, StoryScene];
  quiz: {
    question: string;
    options: string[];
    answer: number;
    explanation: string;
    hint: string;
  };
};

export const stories: Story[] = [
  {
    id: 'forest',
    title: '迷路的小星星',
    subtitle: '一点点光，够不够走出黑黑的森林？',
    theme: 'forest',
    color: '#cbd7b6',
    cover: { color: '#a7bfaa', lines: ['迷路的', '小星星'] },
    tag: '森林故事',
    duration: '约4分钟',
    description: '怕黑的露露答应送小星星去山顶。可它越着急，越走不出森林……',
    character: '露露',
    reward: '星光书签',
    keepsake: '夹住这一页，记住那一点刚好够走下一步的光。',
    scenes: [
      {
        title: '答应了一件难事',
        text: '“山顶的晚风能送我回家。”灌木里的小星星说。露露刚伸出脚，又缩了回来：“可是……树林好黑呀。”',
        actions: [{
          target: 'bush',
          hint: '轻触星星旁的灌木，把枝叶分开',
          after: '露露还是伸出了手：“我陪你去。”枝叶分开，星光只照亮脚边一小块。',
          label: '拨开枝叶，接住星星',
        }],
      },
      {
        title: '又是这棵歪树',
        text: '“跑快点，就不怕了！”露露一口气跑出去，又绕回那棵歪树。树后还有两个摇晃的“角”……',
        actions: [{
          target: 'branches',
          hint: '轻触树后的影子，让露露照一照',
          after: '露露停住脚，把星光照过去。哪有什么怪兽，只有两根弯弯的树枝！',
          label: '照一照树后的影子',
        }],
      },
      {
        title: '先走这么一点点',
        text: '“我只能照亮这么一点点。”星星小声说。露露看看脚边：“那我们就先走这么一点点。”',
        actions: [
          {
            target: 'path-0',
            hint: '轻触小石头旁的路，一次走一小段',
            after: '露露走到小石头旁，停了停：“原来这里有个转弯。”',
            label: '先走到小石头旁',
          },
          {
            target: 'path-1',
            hint: '轻触转弯后的路，让星光再往前一点',
            after: '转过弯，一朵蘑菇露了出来。“下一步，走到你那里。”',
            label: '沿着转弯再走一步',
          },
          {
            target: 'path-2',
            hint: '轻触蘑菇旁的路，陪露露继续走',
            after: '一步，又一步。风吹动露露的耳朵，树梢变矮了——山顶就在前面！',
            label: '走到蘑菇旁边',
          },
        ],
      },
      {
        title: '在天空中再见',
        text: '山顶的晚风托起了小星星。“到家啦！”露露望着回去的路，耳朵又抖了抖。',
        actions: [{
          target: 'hero',
          hint: '轻触露露，陪它迈出回家的第一步',
          after: '“先走到那朵蘑菇旁边。”露露迈出一步。天上的小星星也眨了眨眼。',
          label: '陪露露迈出第一步',
        }],
      },
    ],
    quiz: {
      question: '露露后来为什么能走出森林？',
      options: ['看清脚边，一次走一小段', '闭上眼睛，一口气跑到底', '等小星星照亮整片森林'],
      answer: 0,
      explanation: '星光没有变多。露露换了办法，看清下一步，再慢慢往前走。',
      hint: '想想那棵又遇见的歪树：跑得快没有走出去，露露后来怎样走的？',
    },
  },
  {
    id: 'sea',
    title: '鲸鱼与海的彼岸',
    subtitle: '带不走的亮光，怎样送给朋友？',
    theme: 'sea',
    color: '#a9ced9',
    cover: { color: '#9dbbc8', lines: ['鲸鱼与', '海的彼岸'] },
    tag: '海洋故事',
    duration: '约3分钟',
    description: '妮可想把浪花里的亮光送给伙伴，可亮光一碰就散。她得想个新办法。',
    character: '妮可',
    reward: '海洋书签',
    keepsake: '夹住这一页，记住大家一起看见的小彩虹。',
    scenes: [
      {
        title: '抓不住的礼物',
        text: '浪花上跳着一片亮光。妮可想带回去送给伙伴，便甩着尾巴追过去：“抓住啦？”',
        actions: [{
          target: 'light',
          hint: '轻触水面上的亮光，陪妮可靠近它',
          after: '哗啦！亮光碎成小点，从妮可的鳍边溜走。她慢下来，前面的浪花却又亮了。',
          label: '试着接住浪花里的光',
        }],
      },
      {
        title: '亮光躲到哪里了',
        text: '“用珊瑚围住你呢？”妮可刚游过去，一朵云飘来，亮光忽然不见了。她抬起头……',
        actions: [{
          target: 'cloud',
          hint: '轻触云朵，看看云缝里漏下的光',
          after: '云一飘开，阳光落在水面上，亮光又回来了。“原来是太阳！可怎么把它带回去呢？”',
          label: '看看云后面',
        }],
      },
      {
        title: '鼻尖上的主意',
        text: '带不走亮光，妮可有点失望。刚叹了口气，鼻尖的小水珠竟闪出颜色。“再喷高一点呢？”',
        actions: [{
          target: 'hero',
          hint: '轻触妮可，把水花喷到阳光里',
          after: '噗——阳光穿过水珠，弯出一道小彩虹。“有办法了！我要请伙伴们来看。”',
          label: '朝阳光喷一口水',
        }],
      },
      {
        title: '一起看见的礼物',
        text: '妮可把伙伴们叫到有阳光的海面。“礼物在哪儿？”大家东张西望。妮可鼓起腮帮子。',
        actions: [{
          target: 'hero',
          hint: '轻触妮可，让伙伴们也看看水花里的颜色',
          after: '小彩虹又挂在水珠上。“我带不走太阳，可是能请你们一起看！”一只小鲸鱼也学着喷了一小滴水。',
          label: '给伙伴们看小彩虹',
        }],
      },
    ],
    quiz: {
      question: '妮可为什么能让伙伴看到小彩虹？',
      options: ['她游得比亮光快', '阳光照进了她喷出的水珠', '珊瑚把亮光围了起来'],
      answer: 1,
      explanation: '妮可发现阳光能照出水花里的颜色，就请伙伴们一起来看。亮光带不走，这个办法却做到了。',
      hint: '想想妮可鼻尖的小水珠：它遇见了什么，才出现颜色？',
    },
  },
  {
    id: 'sky',
    title: '云端的失物',
    subtitle: '远处的叮铃声，真的能带路吗？',
    theme: 'sky',
    color: '#d8c6de',
    cover: { color: '#e6b19a', lines: ['云端的', '失物'] },
    tag: '天空故事',
    duration: '约3分钟',
    description: '可可捡到一只小铃铛，跟着叮铃声寻找主人。可那声音怎么总在学它？',
    character: '可可',
    reward: '云朵书签',
    keepsake: '夹住这一页，记住可可停下来听见的那句话。',
    scenes: [
      {
        title: '捡到一声叮铃',
        text: '可可最喜欢叮铃声。云朵上躺着一只小铃铛，绿丝带断了一头。“主人一定在找你。”',
        actions: [{
          target: 'bell',
          hint: '轻触铃铛，听听远处有没有回应',
          after: '可可摇了两下，远处也响了两下。“在那边！”它抱着铃铛跑过去。',
          label: '摇两下，听听回应',
        }],
      },
      {
        title: '谁在学我说话',
        text: '可可追到云海边，又摇了三下。那边也一模一样地响了三下，连一句话都没有。',
        actions: [{
          target: 'hero',
          hint: '轻触可可，让铃铛安静下来',
          after: '“原来是我自己的回声。”可可不摇了。风里传来一句：“我的绿丝带铃铛呢？”',
          label: '先停下来听一听',
        }],
      },
      {
        title: '两截绿丝带',
        text: '可可循着说话声，找到一颗着急的小星星。它手上也系着半截绿丝带。“你丢的是这只吗？”',
        actions: [{
          target: 'bell',
          hint: '轻触铃铛，把两截绿丝带放在一起看看',
          after: '两截丝带刚好对上。可可把铃铛递过去：“我差点跟着回声找了一整夜呢！”',
          label: '把两截丝带凑一凑',
        }],
      },
      {
        title: '摇响夜晚的铃铛',
        text: '小星星系好铃铛：“有了它，我就能叫醒值夜班的星星。你愿意帮我摇第一声吗？”',
        actions: [{
          target: 'bell',
          hint: '轻触铃铛，看看这次谁会回应',
          after: '叮铃！远处亮起一颗，又一颗。“这回可不是回声。”可可笑了，也轻轻说了一声：“晚安。”',
          label: '一起摇响晚安铃',
        }],
      },
    ],
    quiz: {
      question: '可可后来为什么找到了铃铛的主人？',
      options: ['它摇得更响，回声就带路了', '它让每朵云都试戴了铃铛', '它停下摇铃，听见了说话声'],
      answer: 2,
      explanation: '回声只会学铃铛响。可可停下来，才听见主人在找铃铛；两截绿丝带又帮它认对了主人。',
      hint: '叮铃声总在重复可可的动作。铃铛安静以后，它听到了什么？',
    },
  },
  {
    id: 'autumn',
    title: '大核桃滚呀滚',
    subtitle: '这么大的核桃，怎样带到野餐的树桩旁？',
    theme: 'autumn',
    color: '#dfb674',
    cover: { color: '#dcb477', lines: ['大核桃', '滚呀滚'] },
    tag: '秋日故事',
    duration: '约4分钟',
    description: '松松找到一颗大核桃，想请朋友一起吃。可核桃一滚起来，就不听话了！',
    character: '松松',
    reward: '核桃书签',
    keepsake: '夹住这一页，记住三双小爪子一起推过树根的大核桃。',
    scenes: [
      {
        title: '抱不动的好东西',
        text: '秋叶沙沙响，松鼠松松找到一颗大核桃。“带到树桩旁，够我们三个吃！”它抱了又抱，核桃纹丝不动。',
        actions: [{
          target: 'walnut',
          hint: '轻触大核桃，和松松试着推一推',
          after: '咕噜，核桃滚了一小段。“原来可以推！”松松追着它，跑上了铺满落叶的小路。',
          label: '和松松推一推核桃',
        }],
      },
      {
        title: '等一等，大核桃',
        text: '小路往下斜，核桃越滚越快。“等等我！”松松急得尾巴都竖起来了。前面就是水洼！',
        actions: [{
          target: 'friend',
          hint: '轻触前面的露露，请它帮忙挡住核桃',
          after: '露露从前面扶住，刺刺从旁边顶住。呼，停下了！松松喘着气：“你们能陪我一起运吗？”',
          label: '请朋友一起扶住核桃',
        }],
      },
      {
        title: '一推，一扶，慢慢走',
        text: '一条树根拦住了路。松松看看脚边的宽树皮：“铺上它呢？露露在前面扶，我和刺刺在后面推。”',
        actions: [
          {
            target: 'bark',
            hint: '轻触宽树皮，把它铺到树根上',
            after: '树皮搭成了一个缓缓的小坡。松松把爪子贴住核桃：“这次听我数，一、二——”',
            label: '把宽树皮铺上树根',
          },
          {
            target: 'walnut',
            hint: '轻触核桃，和三个朋友一起慢慢推',
            after: '“三！”后面推一点，前面扶一点。大核桃稳稳地越过树根，再也没有乱跑。',
            label: '一起把核桃推过树根',
          },
        ],
      },
      {
        title: '还有一个大碗',
        text: '终于到了野餐的树桩旁。核桃壳上有一道细缝，三双小爪子凑过去：“一、二、三！”',
        actions: [{
          target: 'walnut',
          hint: '轻触核桃，和朋友一起沿着细缝掰开',
          after: '咔！一人一块，嚼得香香的。松松抱起空壳：“这个大碗……也得请你们搭把手！”',
          label: '一起掰开大核桃',
        }],
      },
    ],
    quiz: {
      question: '大核桃后来为什么不乱跑了？',
      options: ['松松在后面追得更快了', '朋友们一边推，一边扶着控制方向', '落叶把核桃变轻了'],
      answer: 1,
      explanation: '树皮帮核桃越过树根，朋友们分好工、一起慢慢运，才把它稳稳送到树桩旁。',
      hint: '想想下坡时和过树根时，核桃前面、后面各有谁在做什么？',
    },
  },
  {
    id: 'rain',
    title: '小熊的树叶伞',
    subtitle: '一把大树叶伞，怎样才能护住小小的朋友？',
    theme: 'rain',
    color: '#a7c6b5',
    cover: { color: '#acc5ba', lines: ['小熊的', '树叶伞'] },
    tag: '雨天故事',
    duration: '约3分钟',
    description: '小熊举着树叶伞往家走，听见灌木后面一声喷嚏。它停下了脚步。',
    character: '阿棕',
    reward: '树叶书签',
    keepsake: '夹住这一页，记住那把跟着小兔走过水洼的树叶伞。',
    scenes: [
      {
        title: '雨里的一声阿嚏',
        text: '啪嗒，啪嗒。小熊阿棕举着大树叶，快到家了。灌木后忽然响起一声：“阿嚏！”',
        actions: [{
          target: 'bush',
          hint: '轻触灌木，陪阿棕看看谁在淋雨',
          after: '原来是露露！它抱着一袋种子，湿耳朵贴着脑袋。“我还要走过那片水洼呢。”',
          label: '看看谁躲在灌木后',
        }],
      },
      {
        title: '伞要矮一点',
        text: '“快到伞下来！”阿棕把树叶举得高高的。可风一吹，雨丝还是落在露露的耳尖上。',
        actions: [{
          target: 'umbrella',
          hint: '轻触树叶伞，往露露那边放低一点',
          after: '阿棕弯下腰，伞也矮下来。雨珠沿着叶尖滴落，露露终于能把耳朵竖起来了。',
          label: '把树叶伞放低一点',
        }],
      },
      {
        title: '让伞跟着你走',
        text: '“我家就在这棵树里，这把伞给你。”阿棕递过叶柄。露露刚接住，长长的叶柄就碰到了地面。',
        actions: [{
          target: 'umbrella',
          hint: '轻触叶伞，帮露露握住叶柄中间',
          after: '阿棕托住叶子，露露把爪子往上挪了挪。“这样举得稳！”阿棕慢慢松开了手。',
          label: '帮露露握稳树叶伞',
        }],
      },
      {
        title: '一把走远的小绿伞',
        text: '露露举着叶伞，护着种子袋，走到水洼边。阿棕站在树洞里，朝它挥了挥爪子。',
        actions: [{
          target: 'friend',
          hint: '轻触露露，陪它从石头上走过水洼',
          after: '一步，又一步，小绿伞到了小屋前。“种子一颗也没淋湿！”啪嗒，啪嗒，阿棕拍着肚皮，学雨点给它伴奏。',
          label: '陪露露撑伞走过水洼',
        }],
      },
    ],
    quiz: {
      question: '阿棕怎样让露露走在雨里也不淋湿？',
      options: ['把伞举得越高越好', '让露露抱紧种子袋跑过去', '放低叶伞，再帮露露握稳、带着走'],
      answer: 2,
      explanation: '阿棕看见露露还在淋雨，就调整了叶伞的位置，又把伞交到露露手里，让它一路都有遮挡。',
      hint: '伞举得很高时，露露的耳尖还在滴水。后来，伞的位置和拿伞的人有什么变化？',
    },
  },
];
