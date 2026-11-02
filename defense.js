// ===== 守りの自動配置（作戦ボードと3D画面で共通） =====
// 攻め5人の位置とボールから、守り5人の立ち位置を決める。単位はメートル（コート左上が 0,0）
// マンツーマン：ボールマンにはゴールとの間で約1m（JBA 基準規則の「ボールとリングの間・1.5m以内」）
//   ワンパス先の相手にはパスコースへ半身出て（ディナイ）、遠い相手からはゴール寄りに絞る（ヘルプ）
// ゾーン：決まった持ち場を守り、ボールの方へ全体がずれ、いちばん近い人がボールに出る
(function () {
  const BASKETS = [[1.575, 7.5], [26.425, 7.5]];
  const OFF = ['o1', 'o2', 'o3', 'o4', 'o5'], DEF = ['x1', 'x2', 'x3', 'x4', 'x5'];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const toward = (a, b, m) => { const d = dist(a, b); if (d < 1e-6) return a.slice(); const k = Math.min(m, d) / d; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
  const frac = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const inCourt = p => [Math.max(.3, Math.min(27.7, p[0])), Math.max(.3, Math.min(14.7, p[1]))];

  const MODES = [
    { id: 'man', name: 'マンツーマン' },
    { id: 'z23', name: '2-3ゾーン' },
    { id: 'z122', name: '1-2-2ゾーン' },
    { id: 'z131', name: '1-3-1ゾーン' },
    { id: 'manual', name: '手動' },
  ];
  const isZone = mode => mode[0] === 'z';

  // 攻めているゴール：攻め5人のまん中に近いほう
  function goalOf(pos) {
    const c = OFF.reduce((s, o) => [s[0] + pos[o][0] / 5, s[1] + pos[o][1] / 5], [0, 0]);
    return dist(c, BASKETS[0]) < dist(c, BASKETS[1]) ? BASKETS[0] : BASKETS[1];
  }

  function man(pos, ball, holder, goal) {
    const out = {};
    OFF.forEach((o, i) => {
      const p = pos[o];
      if (o === holder) { out[DEF[i]] = toward(p, goal, 1.0); return; }
      const dBall = dist(p, ball);
      if (dBall < 6.5) {
        // ディナイ：ボールの方へ1歩、少しゴール寄り（パスコースに手を出す位置）
        out[DEF[i]] = toward(toward(p, ball, Math.min(1.1, dBall * .35)), goal, .5);
      } else {
        // ヘルプ：ボールと相手の間をゴール寄りに絞る（ボール・相手・自分の三角形）
        out[DEF[i]] = frac(frac(p, ball, .3), goal, .38);
      }
    });
    return out;
  }

  // ゾーンの持ち場：[ゴールからコートの奥への距離, 横のずれ]。x1 から順に
  const ZONES = {
    z23: [[5.6, -2.3], [5.6, 2.3], [2.3, -3.6], [2.3, 3.6], [1.4, 0]],
    z122: [[7.0, 0], [5.0, -3.4], [5.0, 3.4], [1.9, -2.1], [1.9, 2.1]],
    z131: [[7.2, 0], [4.6, -4.4], [4.6, 4.4], [4.3, 0], [1.2, 0]],
  };
  function zone(mode, pos, ball, goal) {
    const s = goal[0] < 14 ? 1 : -1;
    const spots = ZONES[mode].map(([d, l]) => {
      const home = [goal[0] + s * d, goal[1] + l];
      // ボールの側へ全体がずれる
      const shifted = [home[0], home[1] + (ball[1] - goal[1]) * .35];
      return frac(shifted, ball, .15);
    });
    // ボールがシュート圏内なら、持ち場がいちばん近い人がボールへ出る（シュートしたボールは追わない）
    if (dist(ball, goal) < 9.5 && dist(ball, goal) > 1.5) {
      let j = 0;
      spots.forEach((p, k) => { if (dist(p, ball) < dist(spots[j], ball)) j = k; });
      spots[j] = toward(ball, goal, 1.0);
    }
    const out = {};
    DEF.forEach((x, i) => out[x] = inCourt(spots[i]));
    return out;
  }

  // ある瞬間の立ち位置
  function at(mode, pos, ball, holder) {
    const goal = goalOf(pos);
    return isZone(mode) ? zone(mode, pos, ball, goal) : man(pos, ball, holder, goal);
  }
  // 再生中：少し前の瞬間を何回か見て平均する（守りは一瞬遅れて動き、急に飛ばない）
  const LAGS = [120, 240, 360, 480];
  function smooth(mode, sample, t) {
    const acc = {};
    DEF.forEach(x => acc[x] = [0, 0]);
    for (const lag of LAGS) {
      const s = sample(Math.max(0, t - lag)), p = at(mode, s.pos, s.ball, s.holder);
      DEF.forEach(x => { acc[x][0] += p[x][0] / LAGS.length; acc[x][1] += p[x][1] / LAGS.length; });
    }
    return acc;
  }
  // 作戦の守り方：決めていなければ、守りの動きを録画してある作戦は「手動」、それ以外はマンツーマン
  function modeOf(play) {
    if (play.defense) return play.defense;
    return play.steps.some(s => s.moves.some(m => m.id && m.id[0] === 'x')) ? 'manual' : 'man';
  }

  window.PBDefense = { MODES, isZone, at, smooth, modeOf };
})();
