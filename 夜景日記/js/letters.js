// ナイトレター：今日の天気・日没・月に合わせて、「いつ・どこを・どう見るか」を具体的に届ける手紙
// 文面を増やすときは LETTERS に1件追加してください。
//   weather: 合う天気（null はどの天気でも）  when: 'dusk' | 'night' | 'any'
//   moon: true なら月が見える夜だけ  colors: 見つけやすい色（colors.js の色名）
//   build(s): s は sky.js の tonightSky() の結果。{ title, body, steps:[[見出し, 内容]...] } を返す

export const THEMES = ['夕暮れ', '夜空', '月', '星', '街灯', '窓明かり', '雨', '雨上がり', '反射', '建物の光'];

export const LETTERS = [
  {
    id: 'dusk-boundary', theme: '夕暮れ', weather: ['clear', 'cloudy', 'after-rain'], when: 'dusk', tag: '夕暮れ',
    colors: ['杏色', '藤色', '紺青'],
    build: s => ({
      title: '日没から20分後、西の空の「色の境目」を見る',
      body: `日が沈んだあとの空は、地平線に近いほどオレンジ、上にいくほど青と、高さによって色が変わります。その間に、紫やピンクがかった細い帯ができることがあります。今日は${s.t.blue}ごろが、いちばん色の差が大きく見える時間です。`,
      steps: [['いつ', `${s.t.afterSunset(10)}〜${s.t.blueEnd}`], ['どこを', '西の空。建物の屋根のすぐ上から、少し上まで'], ['どう見る', '地平線から真上へ、ゆっくり視線を上げていき、オレンジが紫に、紫が青に変わる高さを探す']],
    }),
  },
  {
    id: 'dusk-east', theme: '夕暮れ', weather: ['clear'], when: 'dusk', tag: '夕暮れ',
    colors: ['鴇色', '藤色', '薄花色'],
    build: s => ({
      title: '夕日と反対側、東の空のピンク色を見る',
      body: `晴れた日の日没直後、夕日と反対側の東の低い空が、薄いピンクや藤色に染まります。そのすぐ下には、地球の影が青灰色の帯になって見えます。見られるのは日没（${s.t.sunset}）から15分ほどの短い時間です。`,
      steps: [['いつ', `${s.t.sunset}〜${s.t.afterSunset(15)}`], ['どこを', '東の低い空。建物の切れ目や、駅のホーム、歩道橋の上から'], ['どう見る', '西の夕焼けを見たら、一度だけ振り返る。ピンクの帯と、その下の青灰色の帯の二段になっているか見る']],
    }),
  },
  {
    id: 'sky-bluehour', theme: '夜空', weather: ['clear', 'cloudy', 'after-rain'], when: 'dusk', tag: '夜空',
    colors: ['瑠璃色', '群青', '橙色'],
    build: s => ({
      title: `${s.t.blueStart}から約20分、空が青一色になる時間`,
      body: `日没から少しすると、空全体が深い青に変わる「青い時間」があります。ちょうど街灯がつき始めるころで、空の青と灯りのオレンジが同時に見える、一日でいちばん色の対比が強い時間です。${s.t.dark}を過ぎると、空は暗い紺に変わっていきます。`,
      steps: [['いつ', s.t.blue], ['どこを', '街灯や店の灯りがある通りの、真上の空'], ['どう見る', '空と灯りを一緒に視界に入れる。空の青が、灯りの近くでどんな色に見えるかを比べる']],
    }),
  },
  {
    id: 'sky-night', theme: '夜空', weather: ['clear', 'cloudy'], when: 'night', tag: '夜空',
    colors: ['濃紺', '鈍色', '琥珀色'],
    build: s => ({
      title: '夜空の色を、真上と地平線近くで比べる',
      body: `街の夜空は真っ黒ではありません。街の灯りを受けて、低いところほど明るい灰色や、オレンジがかった色になります。${s.weather && s.weather.cond === 'cloudy' ? '今夜のように雲が多い夜は、雲が街の灯りを映して、空全体がほんのり明るく見えます。' : '晴れた夜は、真上ほど深い紺色になります。'}`,
      steps: [['いつ', `${s.t.dark}以降の帰り道`], ['どこを', '真上の空と、ビルや屋根のすぐ上の空'], ['どう見る', '真上を3秒、地平線近くを3秒、交互に見る。二つの色の違いを言葉にしてみる']],
    }),
  },
  {
    id: 'moon-main', theme: '月', weather: ['clear', 'cloudy', 'after-rain'], when: 'any', moon: true, tag: '月',
    colors: ['卵色', '月白', 'クリーム色'],
    build: s => ({
      title: `今夜は月齢${s.moon.age}の${s.moon.name}`,
      body: `${s.moon.when}。月は高さによって色が変わって見えます。昇ったばかりの低い月はオレンジや黄色っぽく、高く昇るほど白っぽくなります。建物や電線と一緒に見ると、月の大きさや色の違いが分かりやすくなります。`,
      steps: [['いつ', s.moon.age >= 16.5 ? '月が昇ったあと' : `${s.t.dark}ごろから`], ['どこを', s.moon.dir || '月のある方角'], ['どう見る', '月そのものだけでなく、月のまわりの空の明るさや、月に照らされた雲の色も見る']],
    }),
  },
  {
    id: 'moon-cloud', theme: '月', weather: ['cloudy'], when: 'night', moon: true, tag: '月',
    colors: ['銀鼠', '薄花色', '卵色'],
    build: s => ({
      title: '雲の縁が、月の光で明るくなっているところを探す',
      body: `今夜は雲が多めです。薄い雲が月にかかると、雲の縁だけが白や淡い黄色に光り、月のまわりに虹色がかった小さな輪（光環）が見えることがあります。月が雲から出たり隠れたりする数分間で、雲の色はどんどん変わります。`,
      steps: [['いつ', s.moon.age >= 16.5 ? '月が昇ったあと' : '月が出ている時間'], ['どこを', `${s.moon.dir || '月のある方角'}。月のすぐまわりの雲`], ['どう見る', '月を直接ではなく、雲の縁を見る。白、黄色、青みのどれに近いか']],
    }),
  },
  {
    id: 'star', theme: '星', weather: ['clear'], when: 'night', tag: '星',
    colors: ['杏色', '月白', '濃紺'],
    build: s => ({
      title: '街灯を背にして、明るい星を2つ見つける',
      body: '街なかで見える星は数えるほどですが、明るい星ははっきり見えます。街灯の光が目に入らない向きに立って30秒ほど待つと、目が暗さに慣れて、見える星が少しずつ増えていきます。オレンジっぽい星と、青白い星が見つかることがあります。',
      steps: [['いつ', `${s.t.dark}以降`], ['どこを', '街灯を背にした方向の、高い空'], ['どう見る', '30秒待ってから、いちばん明るい星を2つ選び、色を比べる']],
    }),
  },
  {
    id: 'lamp-variety', theme: '街灯', weather: ['clear', 'cloudy', 'after-rain'], when: 'night', tag: '街灯',
    colors: ['橙色', '生成り色', '月白'],
    build: () => ({
      title: '帰り道の街灯を、3本続けて比べる',
      body: '昔ながらのナトリウム灯はオレンジ色、新しいLEDの街灯は白や青白い色など、同じ道に並んでいても灯りの色は揃っていません。古い灯りと新しい灯りが混ざっている通りでは、その違いがよく分かります。',
      steps: [['いつ', 'いつもの帰り道で'], ['どこを', '道の先に並ぶ街灯と、その真下の地面'], ['どう見る', '1本ずつ「オレンジ」「白」「少し青い」など色を言葉にしてみる。地面の照らされ方の違いも見る']],
    }),
  },
  {
    id: 'lamp-edge', theme: '街灯', weather: null, when: 'night', tag: '街灯',
    colors: ['琥珀色', '焦茶', '濃紺'],
    build: () => ({
      title: '街灯の光が届く「端っこ」の地面を見る',
      body: '街灯の真下は明るすぎて色が分かりにくいのですが、光が暗がりに変わっていく境目の地面には、オレンジから茶色、紺へと少しずつ色が移っていく場所があります。写真に撮るときも、この境目を入れると色を採集しやすくなります。',
      steps: [['いつ', 'いつもの帰り道で'], ['どこを', '街灯の光の輪の外側、1〜2メートルのあたり'], ['どう見る', '光の中心から外へ、地面の色の移り変わりを目で追う']],
    }),
  },
  {
    id: 'window-street', theme: '窓明かり', weather: null, when: 'night', tag: '窓明かり',
    colors: ['卵色', '杏色', '象牙色'],
    build: () => ({
      title: 'マンションの窓明かりの色を数える',
      body: 'カーテン越しの灯りは、電球の種類やカーテンの色によって、黄色、オレンジ、白、ときどき青やピンクと、一つひとつ違います。少し離れたところから建物全体を見ると、色の並びがよく分かります。',
      steps: [['いつ', '19時〜22時ごろ（灯りのついている窓が多い時間）'], ['どこを', '住宅街のマンションや団地。道の反対側など、少し離れた場所から'], ['どう見る', '黄色っぽい窓、白っぽい窓、それ以外の色の窓をそれぞれ探す']],
    }),
  },
  {
    id: 'window-first', theme: '窓明かり', weather: ['clear', 'cloudy', 'after-rain'], when: 'dusk', tag: '窓明かり',
    colors: ['群青', '卵色', '杏色'],
    build: s => ({
      title: '空がまだ明るいうちに灯る、最初の窓を見つける',
      body: `日没の${s.t.sunset}から${s.t.dark}ごろまでは、空の青と、灯りはじめた窓の黄色を同時に見られる短い時間です。暗くなってからの窓明かりとは違い、空の色と窓の色の両方を一枚の景色に入れられます。`,
      steps: [['いつ', `${s.t.sunset}〜${s.t.dark}`], ['どこを', '空が見える場所から、住宅やマンションの窓'], ['どう見る', '空の青と窓の黄色を、同じ視界に入れて比べる']],
    }),
  },
  {
    id: 'rain-glass', theme: '雨', weather: ['rain'], when: 'any', tag: '反射',
    colors: ['橙色', '朱色', '浅葱色'],
    build: () => ({
      title: '窓ガラスの雨粒越しに、街の灯りを見る',
      body: '電車やバスの窓、お店のガラスについた雨粒には、外の灯りが小さく映り込んでいます。手前の雨粒にピントを合わせると、奥の灯りが丸くぼやけて、色の玉のように見えます。スマートフォンのカメラでも、手前の雨粒をタップすると撮れます。',
      steps: [['いつ', '電車やバスに乗っているとき、雨宿りのとき'], ['どこを', '窓についた雨粒と、その向こうの信号や看板'], ['どう見る', '雨粒に目のピントを合わせて、後ろの灯りがどんな色の玉になるか見る']],
    }),
  },
  {
    id: 'rain-signal', theme: '雨', weather: ['rain'], when: 'night', tag: '反射',
    colors: ['紅色', '緑', '山吹色'],
    build: () => ({
      title: '雨の交差点で、信号の色が道路に伸びるのを見る',
      body: '雨の夜は、濡れた路面に信号の赤や緑、車のライトが長く伸びて映ります。信号が変わるたびに、道路の色も一斉に変わります。濡れたくない日は、屋根の下やお店の中から眺めるだけでも十分です。',
      steps: [['いつ', '雨が降っている夜'], ['どこを', '信号のある交差点。少し離れた屋根の下から'], ['どう見る', '信号が変わる瞬間に、路面の映り込みの色が切り替わるのを見る']],
    }),
  },
  {
    id: 'after-puddle', theme: '雨上がり', weather: ['after-rain'], when: 'night', tag: '雨上がり',
    colors: ['スレートブルー', '橙色', '濡羽色'],
    build: () => ({
      title: '水たまりに映る灯りを、しゃがんで見る',
      body: '今日は雨上がりです。水たまりは小さな鏡になっています。立ったままより、しゃがんで目線を低くすると、映り込みが長く大きく見えます。看板や信号など、色のある光の近くにある水たまりを探してみてください。',
      steps: [['いつ', '路面が乾く前の、今夜のうちに'], ['どこを', '看板、信号、街灯の近くの水たまり'], ['どう見る', '水たまりから2〜3歩離れて、目線を低くする']],
    }),
  },
  {
    id: 'after-asphalt', theme: '雨上がり', weather: ['after-rain'], when: 'any', tag: '雨上がり',
    colors: ['琥珀色', '群青', '藍鼠'],
    build: () => ({
      title: '濡れた道路に伸びる、光の帯を見る',
      body: '路面がまだ濡れているうちは、街灯や車のライトが、道路の上に縦長の帯になって映ります。乾くと消えてしまう、雨上がりの数時間だけの景色です。',
      steps: [['いつ', '雨がやんでから数時間のあいだ'], ['どこを', '街灯が並ぶ広めの道路や、駅前のロータリー'], ['どう見る', '光源から自分の足元へ向かって伸びる帯の、色の変化を見る']],
    }),
  },
  {
    id: 'after-clear', theme: '雨上がり', weather: ['after-rain'], when: 'dusk', tag: '雨上がり',
    colors: ['瑠璃色', '杏色', '藤色'],
    build: s => ({
      title: '雨上がりの夕方は、遠くの空までくっきり見える',
      body: `雨が空気中のちりを洗い流したあとは、遠くの空や建物の灯りが普段より鮮やかに見えます。雲の切れ間ができると、日没（${s.t.sunset}）のあとに雲が下から照らされて色づくこともあります。`,
      steps: [['いつ', `${s.t.sunset}〜${s.t.blueEnd}`], ['どこを', '歩道橋や駅のホームなど、少し高くて遠くまで見える場所から'], ['どう見る', '雲の下側の縁が、どんな色に照らされているか見る']],
    }),
  },
  {
    id: 'reflect-glass', theme: '反射', weather: null, when: 'night', tag: '反射',
    colors: ['月白', '橙色', '藍色'],
    build: () => ({
      title: 'ショーウィンドウに映る、二重の景色を見る',
      body: '暗くなると、お店のガラスや電車の窓には外の灯りが映り込み、ガラスの向こうの景色と重なって見えます。昼間には見られない、夜だけの二重写しです。',
      steps: [['いつ', 'お店が開いている夜'], ['どこを', 'ショーウィンドウ、電車の窓、停まっている車のボディ'], ['どう見る', '少し斜めの角度から見ると、映り込みが強くなる']],
    }),
  },
  {
    id: 'reflect-water', theme: '反射', weather: ['clear', 'cloudy'], when: 'night', tag: '反射',
    colors: ['山吹色', '濃紺', '藍鼠'],
    build: () => ({
      title: '川や池の水面に、灯りが縦に伸びるのを見る',
      body: '水面には、対岸の灯りが縦に長く伸びて映ります。風がないときはまっすぐに、風があるときは細かく揺れて、光の帯が切れ切れになります。近くに川や池がある人は、橋の上から眺めてみてください。',
      steps: [['いつ', `暗くなってから`], ['どこを', '橋の上や、川沿いの道'], ['どう見る', '灯りの色が水面でどれくらい長く伸びているか、風で形がどう変わるか']],
    }),
  },
  {
    id: 'bldg-box', theme: '建物の光', weather: null, when: 'night', tag: '建物',
    colors: ['月白', '浅葱色', '生成り色'],
    build: () => ({
      title: '暗い街に浮かぶ「光の箱」を探す',
      body: 'コンビニ、自動販売機、駅の改札など、白っぽい照明の場所は、まわりが暗いほど四角い光の箱のように浮かび上がって見えます。昼間は気にならない見慣れた建物の、夜だけの姿です。',
      steps: [['いつ', '帰り道で'], ['どこを', '暗い道の先に見える、いちばん明るい場所'], ['どう見る', '近づく前に、少し離れた場所から建物全体を見る。光の色が白か、青白いか、黄色いか']],
    }),
  },
  {
    id: 'bldg-stairs', theme: '建物の光', weather: null, when: 'night', tag: '建物',
    colors: ['卵色', '月白', '鉄紺'],
    build: () => ({
      title: 'マンションの外廊下の灯りが描く「線」を見る',
      body: 'マンションの外廊下や階段の灯りは、規則正しく並んで、建物の形を光の線で描きます。部屋の窓明かりとは色が違うことが多く、並び方と色の両方を楽しめます。',
      steps: [['いつ', '暗くなってから'], ['どこを', '大きめのマンションや団地の、廊下や階段のある面'], ['どう見る', '道の反対側から、光の並びを横・縦にたどってみる']],
    }),
  },
];

export function letterById(id) { return LETTERS.find(l => l.id === id); }

/** 手紙の冒頭：今日の空のこと（天気・日没・月） */
export function openingLine(s, bucket) {
  const w = s.weather;
  const wtxt = w ? `${w.label}${w.temp != null ? `、気温は${w.temp}℃ほど` : ''}` : '';
  const head = bucket === 'night' ? `今夜の${s.city}は` : `今日の${s.city}は`;
  const parts = [];
  if (wtxt) parts.push(`${head}${wtxt}。`);
  if (bucket !== 'night') parts.push(`日没は${s.t.sunset}、空が青く染まるのは${s.t.blue}ごろです。`);
  else if (s.moon.visible) parts.push(`月齢${s.moon.age}の${s.moon.name}が出ています。`);
  else parts.push('月の見えない夜なので、街の灯りの色がいちばん目立ちます。');
  if (!parts.length) parts.push(`今日の日没は${s.t.sunset}です。`);
  return parts.join('');
}

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** 今日の空に合う手紙を選ぶ */
export function pickLetter(dateKey, s, bucket, recentIds = []) {
  const cond = s.weather ? s.weather.cond : null;
  const timeOk = l => l.when === 'any' || (bucket === 'day' ? l.when === 'dusk' : l.when === bucket);
  const weatherOk = l => cond ? (!l.weather || l.weather.includes(cond)) : (!l.weather || l.weather.includes('clear') || l.weather.includes('cloudy'));
  const moonOk = l => !l.moon || s.moon.visible;
  let pool = LETTERS.filter(l => timeOk(l) && weatherOk(l) && moonOk(l));
  // 雨・雨上がりの日は、その天気ならではの手紙を優先
  if (cond === 'rain' || cond === 'after-rain') {
    const special = pool.filter(l => l.weather && l.weather.includes(cond) && l.weather.length <= 2);
    if (special.length) pool = special;
  }
  // 満月前後は月の手紙を優先
  if (s.moon.visible && s.moon.age >= 13.5 && s.moon.age < 16.5 && cond !== 'rain') {
    const m = pool.filter(l => l.theme === '月');
    if (m.length && hashStr(dateKey) % 2 === 0) pool = m;
  }
  if (!pool.length) pool = LETTERS.filter(l => !l.weather && moonOk(l));
  const fresh = pool.filter(l => !recentIds.includes(l.id));
  const list = fresh.length ? fresh : pool;
  return list[hashStr(dateKey + (cond || '') + bucket) % list.length];
}
