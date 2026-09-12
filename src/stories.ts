export type StoryScene = {
  title: string;
  text: string;
  hint: string;
  after: string;
  actionLabel: string;
};

export type Story = {
  id: string;
  title: string;
  subtitle: string;
  theme: 'forest' | 'sea' | 'sky';
  color: string;
  tag: string;
  duration: string;
  description: string;
  character: string;
  reward: string;
  scenes: [StoryScene, StoryScene, StoryScene, StoryScene];
  quiz: {
    question: string;
    options: string[];
    answer: number;
    explanation: string;
  };
};

export const stories: Story[] = [
  {
    id: 'forest',
    title: '迷路的小星星',
    subtitle: '和小兔子一起，走进夜晚的森林。',
    theme: 'forest',
    color: '#cbd7b6',
    tag: '森林故事',
    duration: '约3分钟',
    description: '一颗小星星落进了森林。和小兔露露一起，送它回到天空吧。',
    character: '露露',
    reward: '星光书签',
    scenes: [
      {
        title: '森林里的微光',
        text: '“你还好吗？”露露发现了一颗迷路的小星星。',
        hint: '轻轻点一下小星星',
        after: '“我想回到天上。”露露牵起小星星，一起出发了。',
        actionLabel: '给小星星打打气',
      },
      {
        title: '蘑菇点亮了小路',
        text: '林间的小路黑漆漆的。蘑菇说：“我把一点光借给你们吧！”',
        hint: '轻轻点一下蘑菇',
        after: '噗！一团微光飘进小星星的怀里，脚下的小路亮了。',
        actionLabel: '借一点蘑菇的光',
      },
      {
        title: '大树的礼物',
        text: '“再加一点光就好啦！”大树的枝头，挂着闪闪发亮的小露珠。',
        hint: '轻轻点一下大树',
        after: '叮！露珠化成光，落在小星星身上。它终于有力气飞起来了！',
        actionLabel: '收下大树的光',
      },
      {
        title: '在天空中再见',
        text: '他们来到山坡上。“露露，谢谢你！”小星星笑着挥了挥手。',
        hint: '点一下小星星，送它回家',
        after: '小星星飞回天空，洒下柔柔的光，照着露露回家的路。',
        actionLabel: '送小星星回家',
      },
    ],
    quiz: {
      question: '小星星最后回到了哪里？',
      options: ['天空', '海底', '泥土里'],
      answer: 0,
      explanation: '是天空！露露的一点点善意，变成了夜空里暖暖的星光。',
    },
  },
  {
    id: 'sea',
    title: '鲸鱼与海的彼岸',
    subtitle: '跟着闪光的浪花，游向远方。',
    theme: 'sea',
    color: '#a9ced9',
    tag: '海洋故事',
    duration: '约3分钟',
    description: '一道微光在海面上跳跃。和鲸鱼妮可一起，看看海的那边有什么。',
    character: '妮可',
    reward: '海洋书签',
    scenes: [
      {
        title: '浪花里的亮光',
        text: '鲸鱼妮可看见浪花里有一团亮光。“你要去哪里呀？”',
        hint: '轻轻点一下亮光',
        after: '亮光指向海的那边。妮可摆摆尾巴，慢慢跟了上去。',
        actionLabel: '追上浪花里的光',
      },
      {
        title: '珊瑚小森林',
        text: '亮光藏进珊瑚丛里。“躲到哪里啦？”妮可探着脑袋找了起来。',
        hint: '轻轻点一下珊瑚',
        after: '找到了！亮光从珊瑚间跳出来，像是在说：“快跟我来！”',
        actionLabel: '找找珊瑚里的光',
      },
      {
        title: '云后面的惊喜',
        text: '一朵大云遮住了天空。妮可抬起头，深深吸了一口气。',
        hint: '轻轻点一下妮可',
        after: '噗——一串水花喷向天空！亮光穿过水珠，变成了一道彩虹。',
        actionLabel: '和妮可一起喷水',
      },
      {
        title: '海那边的早晨',
        text: '彩虹的另一头，太阳露出了笑脸。原来，亮光是清晨送来的礼物。',
        hint: '轻轻点一下太阳',
        after: '“早上好！”海面闪闪发亮，妮可也笑着迎来了新的一天。',
        actionLabel: '和太阳说早安',
      },
    ],
    quiz: {
      question: '妮可跟着亮光，最后见到了谁？',
      options: ['月亮', '太阳', '雪人'],
      answer: 1,
      explanation: '是太阳！清晨的阳光照亮了大海，也照亮了妮可的笑脸。',
    },
  },
  {
    id: 'sky',
    title: '云端的失物',
    subtitle: '叮铃，是谁的小铃铛在响？',
    theme: 'sky',
    color: '#d8c6de',
    tag: '天空故事',
    duration: '约3分钟',
    description: '云朵上躺着一只小铃铛。和狐狸可可一起，帮它找到主人吧。',
    character: '可可',
    reward: '云朵书签',
    scenes: [
      {
        title: '捡到一声叮铃',
        text: '狐狸可可在云朵上捡到一只小铃铛。“这是谁的呀？”',
        hint: '轻轻点一下铃铛',
        after: '叮铃，叮铃。远处的云层里，传来了一声轻轻的回应。',
        actionLabel: '摇一摇小铃铛',
      },
      {
        title: '软绵绵的云朵桥',
        text: '声音来自云海的对面。可可问：“云朵，你们能帮帮我吗？”',
        hint: '轻轻点一下云朵',
        after: '云朵排成一座软绵绵的桥。“谢谢！”可可小心地走了过去。',
        actionLabel: '搭一座云朵桥',
      },
      {
        title: '小星星的心事',
        text: '小星星垂着头：“铃铛不见了，我没法告诉大家，夜晚来啦。”',
        hint: '轻轻点一下小星星',
        after: '“是这只吗？”小星星一下笑了：“对！这就是我的铃铛！”',
        actionLabel: '问问小星星',
      },
      {
        title: '摇响夜晚的铃铛',
        text: '可可把铃铛还给小星星。“谢谢你，我们一起摇响它吧！”',
        hint: '轻轻点一下铃铛',
        after: '叮铃，叮铃。满天星光亮起来，轻轻对可可说：“晚安。”',
        actionLabel: '一起摇响晚安铃',
      },
    ],
    quiz: {
      question: '小铃铛原来是谁的？',
      options: ['鲸鱼', '蘑菇', '小星星'],
      answer: 2,
      explanation: '是小星星的！帮铃铛找到了主人，整个夜空都开心地亮了起来。',
    },
  },
];
