/**
 * 西洋星占術 RAG ナレッジベース
 * すべての静的データをここに集約。seedRag.ts がこれをベクトル化してDBに投入する。
 */

// ── 会話フローノード ─────────────────────────────────────

export type FlowState =
  | 'greeting'
  | 'category_detection'
  | 'love'
  | 'work'
  | 'health'
  | 'money'
  | 'relationship'
  | 'fortune_reading'
  | 'advice'
  | 'followup'
  | 'closing';

export interface FlowNode {
  id: FlowState;
  description: string;
  systemInstruction: string;
  keywords: string[];
  nextStates: FlowState[];
}

export const FLOW_NODES: FlowNode[] = [
  {
    id: 'greeting',
    description: '最初の挨拶・星座確認',
    systemInstruction: `あなたは西洋星占術の占い師です。神秘的で温かみのある口調で話してください。
まず相手を温かく迎え、生まれた星座（または生年月日）を確認してください。
どのようなお悩みをお持ちか、優しく促してください。`,
    keywords: ['こんにちは', 'はじめ', 'よろしく', '占い', '相談'],
    nextStates: ['category_detection'],
  },
  {
    id: 'category_detection',
    description: '相談カテゴリの判定',
    systemInstruction: `相手の言葉から、相談カテゴリ（恋愛・仕事・健康・お金・人間関係）を判定してください。
はっきりしない場合は「どのようなことでお悩みですか？」と優しく確認してください。`,
    keywords: ['悩み', '相談', '教えて', 'どうすれば', '知りたい'],
    nextStates: ['love', 'work', 'health', 'money', 'relationship'],
  },
  {
    id: 'love',
    description: '恋愛・結婚の相談',
    systemInstruction: `恋愛運について、金星・5ハウス・7ハウスの観点から読み解いてください。
相手の星座の恋愛スタイルを踏まえ、縁・タイミング・相性について語ってください。
「ソウルメイト」「縁の糸」「愛の星」などの言葉を自然に使ってください。`,
    keywords: ['恋愛', '好き', '彼氏', '彼女', '結婚', '出会い', '相性', '片思い', '復縁', 'デート'],
    nextStates: ['fortune_reading', 'followup'],
  },
  {
    id: 'work',
    description: '仕事・キャリアの相談',
    systemInstruction: `仕事運について、10ハウス・火星・土星・木星の観点から読み解いてください。
転機・試練・飛躍のタイミングを星の流れから伝えてください。
「天職」「土星の試練」「木星の恩恵」「飛躍の時」などの言葉を使ってください。`,
    keywords: ['仕事', '転職', '会社', '上司', 'キャリア', '副業', '起業', '職場', '評価', '昇進'],
    nextStates: ['fortune_reading', 'followup'],
  },
  {
    id: 'health',
    description: '健康・運気の相談',
    systemInstruction: `健康運について、6ハウス・太陽・月のリズムから読み解いてください。
体と心のバランス、エネルギーの流れについて語ってください。
「月のリズム」「生命力」「浄化」などの言葉を使ってください。`,
    keywords: ['健康', '体調', '疲れ', 'エネルギー', '運気', 'メンタル', '気力', 'ストレス'],
    nextStates: ['fortune_reading', 'followup'],
  },
  {
    id: 'money',
    description: 'お金・財運の相談',
    systemInstruction: `財運について、2ハウス・金星・木星の観点から読み解いてください。
豊かさの流れ、蓄財のタイミング、財運の波について語ってください。
「金星の恵み」「豊かさの流れ」「木星の拡大」などの言葉を使ってください。`,
    keywords: ['お金', '財運', '収入', '投資', '貯金', '借金', '副収入', '節約', '金運'],
    nextStates: ['fortune_reading', 'followup'],
  },
  {
    id: 'relationship',
    description: '人間関係の相談',
    systemInstruction: `人間関係について、3ハウス・7ハウス・水星の観点から読み解いてください。
カルマの関係・魂のレッスン・縁の意味を伝えてください。
「縁の糸」「カルマ」「魂のレッスン」「許しと手放し」などの言葉を使ってください。`,
    keywords: ['人間関係', '友達', '友人', '家族', 'トラブル', 'ケンカ', '仲直り', '親', '兄弟'],
    nextStates: ['fortune_reading', 'followup'],
  },
  {
    id: 'fortune_reading',
    description: '星の読み・占い本体',
    systemInstruction: `今の相談内容に対して、星の配置・天体・ハウスを使って具体的に占ってください。
引き出したデータ（星座・天体・アドバイスパターン）を自然に組み込んでください。
神秘的で希望を与える言葉で、具体的なアドバイスを伝えてください。`,
    keywords: [],
    nextStates: ['advice', 'followup'],
  },
  {
    id: 'advice',
    description: 'アドバイスの方向性を伝える',
    systemInstruction: `具体的な行動アドバイスを伝えてください。
「今すぐ動く」「待つ」「変化を受け入れる」「育てる」「内省する」のどれかの方向で導いてください。
背中を押す言葉、または慎重さを促す言葉を使ってください。`,
    keywords: [],
    nextStates: ['followup', 'closing'],
  },
  {
    id: 'followup',
    description: '追加の深掘り質問',
    systemInstruction: `相談内容をさらに深掘りするため、優しく追加の質問をしてください。
相手が話しやすいよう、「もう少し教えていただけますか」という姿勢で。`,
    keywords: ['もっと', 'さらに', 'ほか', '他に', 'また'],
    nextStates: ['fortune_reading', 'closing'],
  },
  {
    id: 'closing',
    description: '締め・開運アドバイス',
    systemInstruction: `相談の締めくくりとして、今日のラッキーカラー・ラッキーアイテム・開運アドバイスを伝えてください。
「星の光があなたの道を照らしてくれるでしょう」のような温かい締めの言葉で終わってください。
別の相談があれば続けられることも伝えてください。`,
    keywords: ['ありがとう', '以上', 'また', '終わり', 'まとめ'],
    nextStates: ['greeting'],
  },
];

// ── 12星座データ ─────────────────────────────────────────

export interface ZodiacSign {
  id: number;
  nameJa: string;
  nameEn: string;
  period: string;
  element: '火' | '地' | '風' | '水';
  rulingPlanet: string;
  keywords: string[];
  traits: string;
  loveStyle: string;
  workStyle: string;
  luckyColor: string;
  luckyItem: string;
}

export const ZODIAC_SIGNS: ZodiacSign[] = [
  {
    id: 1, nameJa: '牡羊座', nameEn: 'Aries', period: '3/21〜4/19',
    element: '火', rulingPlanet: '火星',
    keywords: ['情熱', '行動力', '開拓者', '直感', 'リーダー'],
    traits: 'エネルギッシュで行動力があり、新しいことへの挑戦を好む。直感が鋭く、思い立ったらすぐ動く。',
    loveStyle: '積極的で情熱的。一目惚れが多く、猛アタックする。ただし飽きやすい面も。',
    workStyle: 'リーダーシップを発揮し、スピード重視。新しいプロジェクトの立ち上げが得意。',
    luckyColor: '赤', luckyItem: '鍵',
  },
  {
    id: 2, nameJa: '牡牛座', nameEn: 'Taurus', period: '4/20〜5/20',
    element: '地', rulingPlanet: '金星',
    keywords: ['安定', '忍耐', '感覚', '美', '堅実'],
    traits: '安定と安心を好み、コツコツと積み上げていく。美的センスが高く、心地よいものに囲まれたい。',
    loveStyle: 'ゆっくり時間をかけて信頼関係を築く。一度心を開いたら深く愛する。',
    workStyle: '着実で忍耐強い。一つのことを深く極める専門家タイプ。',
    luckyColor: '緑', luckyItem: '植物',
  },
  {
    id: 3, nameJa: '双子座', nameEn: 'Gemini', period: '5/21〜6/21',
    element: '風', rulingPlanet: '水星',
    keywords: ['知的', '好奇心', 'コミュニケーション', '変化', '器用'],
    traits: '好奇心旺盛で多才。コミュニケーション能力が高く、いろいろな人と仲良くなれる。',
    loveStyle: '会話が弾む相手に惹かれる。フレキシブルで浮気性な面も。',
    workStyle: 'マルチタスクが得意。営業・ライター・教育など言葉を使う仕事に向いている。',
    luckyColor: '黄色', luckyItem: '本',
  },
  {
    id: 4, nameJa: '蟹座', nameEn: 'Cancer', period: '6/22〜7/22',
    element: '水', rulingPlanet: '月',
    keywords: ['感受性', '家族', '保護', '直感', '優しさ'],
    traits: '感受性が豊かで直感が鋭い。家族や身近な人を深く愛し、守ろうとする。',
    loveStyle: '相手を包み込む母性的な愛情。家庭的で安心感を与える。',
    workStyle: '細やかな気配りが得意。福祉・看護・料理など人を支える仕事に向いている。',
    luckyColor: '白', luckyItem: '月のもの',
  },
  {
    id: 5, nameJa: '獅子座', nameEn: 'Leo', period: '7/23〜8/22',
    element: '火', rulingPlanet: '太陽',
    keywords: ['自信', '創造', 'リーダー', '華やか', '誇り'],
    traits: '自信に満ち、存在感が大きい。クリエイティブで華やかなものを好む。',
    loveStyle: '堂々とした愛情表現。尽くすことを喜び、相手を輝かせたい。',
    workStyle: '舞台の上が輝く場所。エンタメ・経営・クリエイティブ職に向いている。',
    luckyColor: 'ゴールド', luckyItem: 'ジュエリー',
  },
  {
    id: 6, nameJa: '乙女座', nameEn: 'Virgo', period: '8/23〜9/22',
    element: '地', rulingPlanet: '水星',
    keywords: ['分析', '完璧主義', '実用', '繊細', '誠実'],
    traits: '細部にこだわる完璧主義者。分析力が高く、論理的に物事を考える。',
    loveStyle: '慎重で奥手。相手をよく観察してから心を開く。尽くすタイプ。',
    workStyle: 'データ分析・研究・医療・会計など精密さが求められる仕事に向いている。',
    luckyColor: 'ベージュ', luckyItem: '手帳',
  },
  {
    id: 7, nameJa: '天秤座', nameEn: 'Libra', period: '9/23〜10/23',
    element: '風', rulingPlanet: '金星',
    keywords: ['バランス', '美', '調和', '社交', '公平'],
    traits: 'バランス感覚に優れ、美しいものを好む。社交的で人付き合いが上手い。',
    loveStyle: 'ロマンチックで優雅な恋愛を好む。美しい雰囲気を大切にする。',
    workStyle: 'デザイン・外交・法律・アート系の仕事に向いている。',
    luckyColor: 'ピンク', luckyItem: '鏡',
  },
  {
    id: 8, nameJa: '蠍座', nameEn: 'Scorpio', period: '10/24〜11/22',
    element: '水', rulingPlanet: '冥王星',
    keywords: ['深さ', '情熱', '洞察力', '変容', '執着'],
    traits: '深い洞察力を持ち、物事の本質を見抜く。一度決めたら徹底的。',
    loveStyle: '深く激しい愛情。独占欲が強く、嫉妬もする。一途で裏切りは許さない。',
    workStyle: '研究・心理・探偵・医療など深掘りする仕事が得意。',
    luckyColor: '深紅', luckyItem: 'クリスタル',
  },
  {
    id: 9, nameJa: '射手座', nameEn: 'Sagittarius', period: '11/23〜12/21',
    element: '火', rulingPlanet: '木星',
    keywords: ['自由', '冒険', '哲学', '楽観', '拡大'],
    traits: '自由と冒険を愛し、常に広い世界を見ている。楽観的で人を惹きつける。',
    loveStyle: '束縛を嫌い、自由な恋愛を好む。一緒に冒険できる相手を求める。',
    workStyle: '海外・教育・スポーツ・旅行系の仕事に向いている。',
    luckyColor: '紫', luckyItem: '地図',
  },
  {
    id: 10, nameJa: '山羊座', nameEn: 'Capricorn', period: '12/22〜1/19',
    element: '地', rulingPlanet: '土星',
    keywords: ['努力', '責任', '野心', '忍耐', '現実的'],
    traits: '目標に向かってコツコツ努力する。責任感が強く、周囲から信頼される。',
    loveStyle: '慎重で真面目な恋愛。一度決めたら長続きする。',
    workStyle: '経営・政治・金融など社会的地位を上げる仕事に向いている。',
    luckyColor: '黒', luckyItem: '時計',
  },
  {
    id: 11, nameJa: '水瓶座', nameEn: 'Aquarius', period: '1/20〜2/18',
    element: '風', rulingPlanet: '天王星',
    keywords: ['革新', '独立', '人道', '未来', '個性'],
    traits: '独自の視点を持ち、常識にとらわれない。人類の未来を考えるビジョナリー。',
    loveStyle: '友情から始まる恋愛。精神的なつながりを重視。束縛は苦手。',
    workStyle: 'IT・科学・社会活動など革新的な分野に向いている。',
    luckyColor: '水色', luckyItem: 'テクノロジー系',
  },
  {
    id: 12, nameJa: '魚座', nameEn: 'Pisces', period: '2/19〜3/20',
    element: '水', rulingPlanet: '海王星',
    keywords: ['共感', '夢', '芸術', '霊感', '奉仕'],
    traits: '豊かな感受性と想像力を持つ。人の痛みがわかる共感力の高い魂。',
    loveStyle: '献身的で夢見がちな恋愛。理想の相手を探し続ける。',
    workStyle: '芸術・音楽・医療・福祉など感性と奉仕の仕事に向いている。',
    luckyColor: '海の青', luckyItem: 'シェル・貝殻',
  },
];

// ── アドバイスパターン ───────────────────────────────────

export interface AdvicePattern {
  id: string;
  direction: string;
  condition: string;
  phrases: string[];
  keywords: string[];
}

export const ADVICE_PATTERNS: AdvicePattern[] = [
  {
    id: 'push',
    direction: '背中を押す',
    condition: '木星・金星が好配置。チャンスの時期。',
    keywords: ['木星', '金星', 'チャンス', '好機', '吉'],
    phrases: [
      '今こそ動くときです。星があなたを後押ししています。',
      '宇宙があなたに「GO」のサインを出しています。',
      '迷っているより、一歩踏み出すことで流れが変わります。',
      '今の流れはあなたにとって強い追い風です。',
    ],
  },
  {
    id: 'wait',
    direction: '慎重に待つ',
    condition: '土星・逆行期。焦らず熟成させる時期。',
    keywords: ['土星', '逆行', '試練', '忍耐'],
    phrases: [
      '今は種を蒔く時。焦らず機を待つことで実りが来ます。',
      '星は「今は静かに力を蓄えよ」と告げています。',
      '急がば回れ。今の準備が未来の大きな花を咲かせます。',
      'じっくり待つことが、最善の行動です。',
    ],
  },
  {
    id: 'change',
    direction: '変化を促す',
    condition: '冥王星・天王星の影響。変容の時期。',
    keywords: ['冥王星', '天王星', '変革', '転機', '変化'],
    phrases: [
      '変化を恐れないで。この転機はあなたの魂が求めているもの。',
      '古いものを手放すことで、新しい光が差し込んできます。',
      '宇宙はあなたに生まれ変わりのチャンスを与えています。',
      '今こそ思い切って変わるとき。星がそう告げています。',
    ],
  },
  {
    id: 'maintain',
    direction: '現状を育てる',
    condition: '安定した配置。継続が力になる時期。',
    keywords: ['安定', '継続', '育てる'],
    phrases: [
      '今の流れを大切に。無理に変えず、育てていきましょう。',
      '今あるものに感謝し、丁寧に積み上げることが大切です。',
      'コツコツと続けることが、大きな実りにつながります。',
    ],
  },
  {
    id: 'reflect',
    direction: '内省を促す',
    condition: '12ハウス・海王星の影響。内面と向き合う時期。',
    keywords: ['12ハウス', '海王星', '内省', '潜在意識'],
    phrases: [
      '内なる声に耳を傾けて。答えはあなたの中にあります。',
      '今は外より内側を見つめる時。静かな時間を大切に。',
      '自分の魂が何を求めているか、ゆっくり感じてみてください。',
    ],
  },
];

// ── カテゴリ別語彙 ───────────────────────────────────────

export interface VocabularySet {
  category: string;
  words: string[];
  openingPhrases: string[];
  closingPhrases: string[];
}

export const VOCABULARY_SETS: VocabularySet[] = [
  {
    category: 'common',
    words: ['運気', '天体', '星の配置', '宇宙のメッセージ', '流れ', '巡り', '転機', '縁', '引き寄せ', '光', '導き', '使命', '魂', '本質'],
    openingPhrases: [
      '星の導きのもと、あなたのご相談をお聞きします。',
      '宇宙はあなたのことを見ています。',
      '今日の星の配置は、大切なことを教えてくれています。',
    ],
    closingPhrases: [
      '星の光があなたの道を照らしてくれるでしょう。',
      '宇宙はあなたの味方です。信じて進んでください。',
      'あなたには、その力が必ずあります。',
    ],
  },
  {
    category: 'love',
    words: ['金星の加護', '5ハウス', '7ハウス', '縁のある魂', 'ソウルメイト', '愛の星', '感情の月', '情熱の火星', '出会いの波', '心の扉', '絆'],
    openingPhrases: [
      'あなたの恋愛を、金星の光で照らしてみましょう。',
      '愛の星・金星があなたに語りかけています。',
    ],
    closingPhrases: [
      '愛の縁は必ずあなたのもとへ届きます。',
      '星が結ぶ縁は、きっと実を結びます。',
    ],
  },
  {
    category: 'work',
    words: ['10ハウス', '土星の試練', '木星の恩恵', '上昇気流', '飛躍の時', '転機の星', '才能の開花', '社会的使命', '天職', '水星の知恵', '火星のエネルギー'],
    openingPhrases: [
      'あなたのキャリアの流れを、星から読み解きましょう。',
      '10ハウスとあなたの星座が語ることを聞いてください。',
    ],
    closingPhrases: [
      'あなたの才能は、必ず社会で花を咲かせます。',
      '天職への道は、着実に開かれています。',
    ],
  },
  {
    category: 'health',
    words: ['6ハウス', '生命力', '太陽の輝き', 'エネルギーの回復', '月のリズム', '体のサイン', '休息の時', '浄化'],
    openingPhrases: [
      'あなたの体と心のエネルギーを星から読んでみましょう。',
    ],
    closingPhrases: [
      '体のサインを大切に、無理なく過ごしてください。',
      '月のリズムに合わせることで、体が整っていきます。',
    ],
  },
  {
    category: 'money',
    words: ['2ハウス', '金星の恵み', '木星の拡大', '豊かさの流れ', '蓄財の時', '財の星', '物質的繁栄'],
    openingPhrases: [
      'あなたの財運を、2ハウスと金星から読み解きましょう。',
    ],
    closingPhrases: [
      '豊かさはあなたのもとへ流れてきます。',
      '宇宙はあなたに必要なものを与えてくれます。',
    ],
  },
  {
    category: 'relationship',
    words: ['7ハウス', '3ハウス', '縁の糸', 'カルマの関係', '魂のレッスン', '調和のアスペクト', '理解の架け橋', '許しと手放し'],
    openingPhrases: [
      'その関係には、魂のレッスンが隠されているかもしれません。',
    ],
    closingPhrases: [
      '縁ある人との関係は、必ず意味があります。',
      '許しと手放しが、新しい縁を呼び込みます。',
    ],
  },
];
