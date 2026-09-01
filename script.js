// script.js — 우리동네홈트챌린지 (프론트/백엔드 경계 및 기술스택 안내는 이 파일 맨 아래 하단 요약과
// 각 섹션의 [백엔드 연동 필요 구간] 주석을 참고하세요.
/* ========================================================================
   상태 (STATE)
   ======================================================================== */
// [프론트엔드 목업 안내] 이 파일은 정적 프로토타입이라 아래 state 객체 하나가
// 서버·DB 역할을 전부 대신하고 있습니다. 실제 서비스 구현 시에는 이 state를
// 화면마다 필요한 API 응답으로 대체하면 됩니다.
//   프론트(JS/화면) 구간 > Java 서버(Spring Boot 등 API) 구간 > DB 연결 > SQL 사용
// 아래부터는 어느 화면(함수)이 이 파이프라인의 어느 지점과 이어지는지
// 섹션별 주석으로 표시해 두었습니다.
// 실시간 판정을 종목별로 하나씩 붙여나갈 예정이라, 우선 스쿼트만 노출한다.
// 다른 종목 추가 시 여기에 다시 항목을 넣으면 됨(id는 tools/extract-exercise-reference.html의
// EXERCISE_DEFS 키와 맞춰야 함): pushup, lunge, plank, burpee
const EXS = [
  {id:'squat', name:'스쿼트', target:'하체 · 둔근', level:'초급'},
];

// 스쿼트만 등록된 상태라 미션도 스쿼트 지표로만 구성한다. metric은 saveExerciseResult()에서
// 세션이 끝날 때마다 누적되는 공용 카운터(state.missions.counters)를 가리키고, 일간/주간/월간
// 미션이 전부 이 같은 카운터를 공유해서 스쿼트 한 번으로 세 기간 미션이 동시에 올라간다
// (기간별로 카운터가 따로 리셋되는 실제 날짜 배치는 없는 프론트 목업이라, "겹쳐서 카운트"되는
// 쪽이 오히려 지금 요구사항과 맞다).
const SQUAT_MISSION_TEMPLATES = [
  {metric:'reps', label:t=>`스쿼트 ${t}회 달성`, ranges:{daily:[15,30], weekly:[60,140], monthly:[200,450]}, rewardPerUnit:2.5},
  {metric:'perfect', label:t=>`스쿼트 퍼펙트 ${t}개 만들기`, ranges:{daily:[3,8], weekly:[15,40], monthly:[60,150]}, rewardPerUnit:4},
  {metric:'sessions', label:t=>`스쿼트 세트 ${t}회 완료`, ranges:{daily:[1,2], weekly:[3,6], monthly:[10,20]}, rewardPerUnit:35},
  {metric:'missFreeSession', label:t=>`MISS 0회 세트 ${t}회 달성`, ranges:{daily:[1,1], weekly:[2,3], monthly:[5,10]}, rewardPerUnit:45},
  {metric:'accSession', label:t=>`정확도 90% 이상 세트 ${t}회`, ranges:{daily:[1,2], weekly:[3,5], monthly:[8,15]}, rewardPerUnit:38},
];
function randInt(a,b){ return a+Math.floor(Math.random()*(b-a+1)); }
// 후보 템플릿 중 무작위로 count개를 뽑아 기간에 맞는 목표치를 굴려서 미션 인스턴스를 만든다.
// 템플릿(5개)보다 뽑아야 할 개수(주간 7개·월간 15개)가 많을 수 있어 중복 템플릿 허용(목표치는
// 매번 다시 굴리므로 완전히 같은 미션이 되진 않는다).
function generateSquatMissions(period, count){
  const list=[];
  for(let i=0;i<count;i++){
    const tpl=SQUAT_MISSION_TEMPLATES[Math.floor(Math.random()*SQUAT_MISSION_TEMPLATES.length)];
    const [lo,hi]=tpl.ranges[period];
    const target=randInt(lo,hi);
    const reward=Math.round(target*tpl.rewardPerUnit/10)*10;
    list.push({id:`${period}-${i}-${tpl.metric}`, period, metric:tpl.metric, target, label:tpl.label(target), reward});
  }
  return list;
}

// 아이디·닉네임·크루명 중복확인용 목업 데이터. 실제로는 DB 조회(SQL SELECT ... WHERE)로 대체된다.
const EXISTING_USERS = [
  {id:'hometrainer01', nickname:'써니핏'},
  {id:'runner99', nickname:'런닝수달'},
  {id:'proteinman', nickname:'단백질맨'},
];
const state = {
  screen: 'intro', // intro | signup | login | app
  signup: {
    id:'', pw:'', pw2:'', nickname:'', email:'',
    regionCity:'서울시', regionGu:'강남구', regionDong:'역삼동', gender:'male', calibrated:false,
    calModalOpen:false, calStage:'idle', calProfile:null, calError:'',
  },
  user: {nickname:'', avatar:0, gender:'male', points:1240, exp:62, level:7, region:'서울시 강남구 역삼동', retakeTickets:0, nicknameTickets:0, bio:''},
  menu: 'exercise',
  subtabs: {mission:0, profile:0, crew:0, ranking:0},
  exercise: {step:0, picked:null, camPhase:'idle', camStream:null, timerId:null, seconds:0, result:null, retakesUsed:0, liveReps:[]},
  missions: {
    period:'daily',
    list: {
      daily: generateSquatMissions('daily',3),
      weekly: generateSquatMissions('weekly',7),
      monthly: generateSquatMissions('monthly',15),
    },
    // 일간/주간/월간 미션이 공유하는 누적 카운터. saveExerciseResult()에서 스쿼트 세션이
    // 저장될 때마다 갱신된다.
    counters: {reps:0, perfect:0, sessions:0, missFreeSession:0, accSession:0},
    claimed: {}, // {missionId: true} — 보상 중복 수령 방지
  },
  shopItems: [
    {name:'다시찍기 티켓', price:80, owned:false, consumable:true, effect:'재촬영 1회 추가', effectDesc:'세션당 무료 재촬영 2회를 모두 쓴 뒤, 추가로 다시 촬영할 때 1장씩 소모됩니다. 결과를 확인하며 반복 재촬영으로 정확도를 올리는 것을 막기 위한 아이템이에요.'},
    {name:'네온 트레이닝복', price:300, owned:false, equipped:false, slot:'outfit', effect:'판정 관대도 +3%', effectDesc:'경계선 각도의 자세를 GOOD 이상으로 인정할 확률이 올라갑니다.'},
    {name:'금빛 뱃지 프레임', price:450, owned:false, equipped:false, slot:'badge', effect:'미션 포인트 +10%', effectDesc:'모든 미션 달성 보상 포인트에 10% 추가 지급됩니다.'},
    {name:'챔피언 왕관', price:900, owned:false, equipped:false, slot:'crown', effect:'랭킹 점수 +5%', effectDesc:'지역·종목 랭킹에 반영되는 점수가 5% 가산됩니다.'},
    {name:'프로필 배경 - 새벽 러닝', price:250, owned:true, equipped:true, slot:'background', effect:'출석 보너스 +5P/일', effectDesc:'연속 출석일마다 기본 출석 포인트에 5P가 추가됩니다.'},
    {name:'캐릭터 - 로봇 코치', price:600, owned:false, equipped:false, slot:'skin', effect:'준비 카운트다운 -1초', effectDesc:'촬영 시작 전 정렬 확인 후 나오는 카운트다운이 1초 짧아집니다.'},
    {name:'닉네임 컬러 이펙트', price:180, owned:true, equipped:true, slot:'nickname', effect:'능력치 없음 · 외형 전용', effectDesc:'랭킹에서 닉네임 색상만 강조되며 점수에는 영향이 없습니다.'},
    {name:'닉네임 변경권', price:150, owned:false, consumable:true, effect:'닉네임 변경 1회', effectDesc:'설정에서 닉네임을 한 번 변경할 수 있습니다. 무분별한 닉네임 변경으로 랭킹 혼선이 생기는 것을 막기 위한 아이템이에요.'},
  ],
  crew: {
    created:false, name:'', desc:'', region:'',
    members:[],
    notices:[
      {who:'써니핏', title:'우리 크루 단톡방 안내', body:"카카오톡 오픈채팅방에서 '123' 검색해서 들어와주세요!", date:'08.20'},
    ],
    joinRequests:[
      {n:'배드민턴킹', level:5, score:1800, msg:'매일 저녁 운동 인증하려고 합니다. 잘 부탁드려요!'},
      {n:'헬린이탈출', level:3, score:960, msg:'초보인데 열심히 하겠습니다!'},
    ],
    groupMission: {period:'daily', ex:'스쿼트', totalTarget:300},
    teamProgress:64,
    level:1, exp:0,
    rankCity:null, rankGu:null, rankDong:null, mapCity:null, mapGu:null,
  },
  history: [
    {date:'08.22', ex:'스쿼트', reps:32, acc:91, score:412, grade:'GREAT', gc:{PERFECT:14,GREAT:15,GOOD:3,MISS:2}},
    {date:'08.22', ex:'런지', reps:18, acc:84, score:250, grade:'GOOD', gc:{PERFECT:2,GREAT:8,GOOD:8,MISS:1}},
    {date:'08.20', ex:'플랭크', reps:1, acc:88, score:260, grade:'GOOD', gc:{PERFECT:0,GREAT:0,GOOD:1,MISS:0}},
    {date:'08.18', ex:'런지', reps:24, acc:95, score:388, grade:'PERFECT', gc:{PERFECT:20,GREAT:3,GOOD:1,MISS:1}},
  ],
  settings: {
    account:{nickname:'', regionCity:'서울시', regionGu:'강남구', regionDong:'역삼동'},
    notif:true, sound:true, camRes:'720p',
    privacy:{profile:'전체공개', history:'크루공개'},
  },
  support: {
    composerOpen:false,
    filter:'all',
    tickets:[
      {id:3,type:'Error',title:'웹캠 촬영 중 화면이 멈춰요',body:'스쿼트 촬영 20초쯤 지나면 화면이 멈추고 리플레이로 넘어가지 않습니다.',status:'답변완료',date:'08.21',
        reply:'브라우저 캐시 문제로 확인되었습니다. 카메라 권한을 껐다 켠 뒤 다시 시도해주세요. 동일 증상이 반복되면 다시 접수 부탁드립니다.'},
      {id:2,type:'기능제안',title:'홈크루 인원을 6명까지 늘려주세요',body:'현재 4명 제한인데 동네 모임 특성상 6명까지는 열어주시면 좋겠습니다.',status:'처리중',date:'08.22', reply:''},
      {id:1,type:'기타',title:'포인트 상점 아이템 효과가 안 보여요',body:'구매 전에 아이템 효과를 알 수 있으면 좋겠습니다.',status:'접수',date:'08.23', reply:''},
    ],
  },
  confirm: null,
  findIdModal: {open:false, result:null},
  findPwModal: {open:false, done:false},
  rankFilter: {city:null, gu:null, dong:null},
  exRankFilter: {city:null, gu:null, dong:null, ex:null},
};

const AVATAR_COLORS = ['#1B3A6B','#E8532B','#C98A00','#3E8FCF','#7A5CC9','#2AA9C9'];
function avatarColor(i){return AVATAR_COLORS[i % AVATAR_COLORS.length];}
function avatarInitial(name){return (name||'홈').trim().charAt(0) || 'H';}

// 프로필 캐릭터 픽셀아트 스프라이트. PNG 자체가 이미 검정 배경을 투명 처리해둔 컷아웃
// 이미지라, 배경 아이템(equip.background)을 씌워도 캐릭터 뒤로 비쳐 보인다.
// (주의) 원본 PNG는 검정 배경에 합성된 상태였는데, 그걸 브라우저에서 getImageData로 읽어
// 알파를 지우는 방식은 file:// 로 열었을 때 "canvas has been tainted by cross-origin data"
// 보안 오류로 막혀서 동작하지 않았다. 그래서 투명화는 스크립트 실행 전에 미리 처리해
// assets/avatar-*.png 자체를 투명 PNG로 만들어두고, 여기서는 단순히 그리기만 한다.
const CHAR_SPRITES = {male:null, female:null};
function loadCharSprite(gender, src){
  const img=new Image();
  img.onload=()=>{
    CHAR_SPRITES[gender]=img;
    drawAvatarCanvas(); drawTopbarAvatar(); drawPodiumChars();
  };
  img.src=src;
}
loadCharSprite('male','assets/avatar-male.png');
loadCharSprite('female','assets/avatar-female.png');

/* ========================================================================
   유틸
   ======================================================================== */
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(toast._tid);
  toast._tid=setTimeout(()=>t.classList.remove('show'),2200);
}
function askConfirm(title,desc,onYes,yesLabel='확인',danger=false){
  state.confirm={title,desc,onYes,yesLabel,danger};
  render();
}
function closeConfirm(){state.confirm=null;render();}

function gradeColor(g){
  if(g==='PERFECT') return 'var(--accent)';
  if(g==='GREAT') return 'var(--gold)';
  if(g==='GOOD') return '#4A7CFF';
  return 'var(--danger)';
}
function gradePill(g){
  const cls = g==='PERFECT'?'pill-accent':g==='GREAT'?'pill-gold':g==='GOOD'?'pill-muted':'pill-danger';
  return `<span class="pill ${cls}">${g}</span>`;
}

/* ========================================================================
   렌더 엔진 : 화면 라우팅
   ======================================================================== */
function render(){
  const root=document.getElementById('app');
  if(state.screen==='intro') root.innerHTML=renderIntro();
  else if(state.screen==='signup') root.innerHTML=renderSignup();
  else if(state.screen==='login') root.innerHTML=renderLogin();
  else root.innerHTML=renderApp();

  if(state.confirm) root.innerHTML += renderConfirm();
  if(state.findIdModal.open) root.innerHTML += renderFindIdModal();
  if(state.findPwModal.open) root.innerHTML += renderFindPwModal();
  // 캘리브레이션 모달은 회원가입 화면뿐 아니라, 운동 탭에서 "캘리브레이션 필수" 조건에 걸려
  // 열릴 수도 있으므로 화면(screen)과 무관하게 calModalOpen 플래그만 본다.
  if(state.signup.calModalOpen) root.innerHTML += renderCalibrationModal();

  if(state.signup.calModalOpen && state.signup.calStage==='done'){
    setTimeout(calSetupEditCanvas,0);
  }

  if(state.screen==='app' && state.menu==='exercise' && state.exercise.step===2){
    setTimeout(setupCamera,0);
  }
  if(state.screen==='app' && state.menu==='exercise' && state.exercise.step===3){
    setTimeout(setupReplayComparison,0);
  }
  if(state.screen==='app' && state.menu==='profile' && state.subtabs.profile===0){
    setTimeout(drawAvatarCanvas,0);
  }
  if(state.screen==='app'){
    setTimeout(drawTopbarAvatar,0);
    setTimeout(drawPodiumChars,0);
  }
}

/* ---------- 소개(랜딩) 페이지 ---------- */
// 로그인 전 첫 진입 화면. 비회원은 로그인/회원가입 창을 바로 보는 대신 여기서 서비스를
// 먼저 둘러본 뒤, 상단 버튼으로 회원가입 또는 로그인으로 이동한다.
// 같은 소개 콘텐츠(renderIntroFeatures/renderIntroSteps)는 로그인 후 좌측 상단 배너를
// 눌렀을 때 이동하는 앱 안 "메인" 카테고리(renderMain)에서도 재사용된다.
const INTRO_FEATURES = [
  {icon:'🎯', title:'AI 자세 판정', desc:'웹캠만으로 스쿼트 같은 운동 자세를 실시간으로 분석하고 정확도를 채점해요.'},
  {icon:'🏅', title:'미션 & 포인트', desc:'일간·주간·월간 미션을 달성하고 포인트를 모아 캐릭터를 꾸며보세요.'},
  {icon:'🏘️', title:'홈크루 & 랭킹', desc:'우리 동네 이웃과 크루를 만들고, 지역별 랭킹으로 함께 동기부여 받아요.'},
  {icon:'📋', title:'운동 히스토리', desc:'마이페이지에서 날짜별 운동 기록과 점수·정확도를 한눈에 관리해요.'},
];
const INTRO_STEPS = [
  '회원가입하고 웹캠으로 내 체형을 간단히 보정해요',
  '종목을 골라 웹캠 앞에서 운동하면 자세를 실시간으로 판정해줘요',
  '미션을 달성하고 포인트를 모아 캐릭터를 꾸미고 랭킹에 도전해요',
];
function renderIntroFeatures(){
  return `
  <div class="grid grid-3">
    ${INTRO_FEATURES.map(f=>`
      <div class="card" style="text-align:center;">
        <div class="ex-badge" style="margin:0 auto 10px;">${f.icon}</div>
        <h3 style="margin:0 0 6px;font-size:15px;">${f.title}</h3>
        <p class="desc" style="margin:0;">${f.desc}</p>
      </div>`).join('')}
  </div>`;
}
function renderIntroSteps(){
  return `
  <ol class="steplist" style="max-width:520px;margin:0 auto;">
    ${INTRO_STEPS.map((s,idx)=>`<li><span class="num">${idx+1}</span>${s}</li>`).join('')}
  </ol>`;
}
function renderIntro(){
  return `
  <div class="landing-shell">
    <div class="landing-topbar">
      <div class="brand" style="cursor:default;">
        <div class="brand-mark">홈</div>
        <div class="brand-name">우리동네<br>홈트챌린지<small>HOME TRAINING</small></div>
      </div>
    </div>
    <div class="landing-hero">
      <p class="auth-eyebrow" style="text-align:center;">우리동네 홈트챌린지</p>
      <h1>집에서, 우리 동네 사람들과 함께 운동해요</h1>
      <p>웹캠으로 자세를 실시간 판정하고, 미션과 랭킹으로 이웃과 함께 성장하는 홈트레이닝 서비스예요.</p>
      <div class="cta-row">
        <button class="btn btn-primary" style="padding:12px 28px;" onclick="goto('signup')">회원가입</button>
        <button class="btn btn-secondary" style="padding:12px 28px;" onclick="goto('login')">기존 계정 로그인</button>
      </div>
    </div>
    <div class="landing-body">
      <h2 class="landing-section-title">이런 걸 할 수 있어요</h2>
      ${renderIntroFeatures()}
      <h2 class="landing-section-title" style="margin-top:52px;">이용 흐름</h2>
      ${renderIntroSteps()}
    </div>
  </div>`;
}

/* ---------- 회원가입 ---------- */
// 시 -> 구 -> 동 순으로 좁혀가는 활동 지역 선택용 데이터. 랭킹 집계 단위는 기존과 동일하게
// 동(가장 마지막 값) 기준을 유지하고, 저장 시에는 세 값을 합쳐 기존과 같은 "시 구 동" 문자열로 만든다.
const REGION_DATA = {
  '서울시': { '강남구':['역삼동','삼성동'], '마포구':['합정동','망원동'], '성동구':['성수동'] },
  '부산시': { '해운대구':['우동','중동'] },
  '대전시': { '유성구':['봉명동'] },
  '전남광주통합특별시': { '북구':['오룡동'], '서구':['상무동'] },
};
// renderSignup ~ setSignupDong 구간: 화면(입력 폼) 렌더링만 담당하는 순수 프론트엔드 로직.
// (FR-AC-001) 실제 "가입 제출" 처리는 아래 doSignup() 지점에서 이어집니다.
function renderSignup(){
  return `
  <div class="center-shell">
    <div class="auth-card">
      <p class="auth-eyebrow">우리동네 홈트챌린지</p>
      <h1 class="auth-title">회원가입</h1>
      <p class="auth-sub">AI 자세 분석과 지역 랭킹으로 함께하는 홈트레이닝</p>

      <div class="field">
        <label for="su-id">아이디</label>
        <div class="field-row">
          <input id="su-id" type="text" placeholder="영문/숫자 4자 이상" style="flex:1;min-width:0;" value="${state.signup.id||''}" oninput="state.signup.id=this.value">
          <button type="button" class="btn btn-secondary btn-sm" style="flex:none;white-space:nowrap;" onclick="checkSignupIdDup()">중복확인</button>
        </div>
        <p class="hint" id="su-id-msg" style="display:none;"></p>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="su-pw">비밀번호</label>
          <input id="su-pw" type="password" placeholder="••••••••" value="${state.signup.pw||''}" oninput="state.signup.pw=this.value;checkSignupPwMatch();">
        </div>
        <div class="field">
          <label for="su-pw2">비밀번호 확인</label>
          <input id="su-pw2" type="password" placeholder="••••••••" value="${state.signup.pw2||''}" oninput="state.signup.pw2=this.value;checkSignupPwMatch();">
          <p class="hint" id="su-pw2-msg" style="display:none;color:var(--danger);">비밀번호가 일치하지 않습니다</p>
        </div>
      </div>
      <div class="field">
        <label for="su-nick">닉네임</label>
        <div class="field-row">
          <input id="su-nick" type="text" placeholder="홈트에서 사용할 닉네임" style="flex:1;min-width:0;" value="${state.signup.nickname||''}" oninput="state.signup.nickname=this.value">
          <button type="button" class="btn btn-secondary btn-sm" style="flex:none;white-space:nowrap;" onclick="checkSignupNickDup()">중복확인</button>
        </div>
        <p class="hint" id="su-nick-msg" style="display:none;"></p>
      </div>
      <div class="field">
        <label for="su-ref">추천인 아이디 (선택)</label>
        <input id="su-ref" type="text" placeholder="추천인 아이디 입력 시 포인트 지급">
        <p class="hint">가입자와 추천인 모두에게 포인트가 지급됩니다.</p>
      </div>
      <div class="field">
        <label for="su-email">이메일</label>
        <input id="su-email" type="email" placeholder="example@email.com" value="${state.signup.email||''}" oninput="state.signup.email=this.value">
      </div>
      <div class="field">
        <label>활동 지역 (랭킹 산정 기준)</label>
        <div class="field-row">
          <select onchange="setSignupCity(this.value)" style="flex:1;min-width:0;">
            ${Object.keys(REGION_DATA).map(c=>`<option ${c===state.signup.regionCity?'selected':''}>${c}</option>`).join('')}
          </select>
          <select onchange="setSignupGu(this.value)" style="flex:1;min-width:0;">
            ${Object.keys(REGION_DATA[state.signup.regionCity]).map(g=>`<option ${g===state.signup.regionGu?'selected':''}>${g}</option>`).join('')}
          </select>
          <select onchange="setSignupDong(this.value)" style="flex:1;min-width:0;">
            ${REGION_DATA[state.signup.regionCity][state.signup.regionGu].map(d=>`<option ${d===state.signup.regionDong?'selected':''}>${d}</option>`).join('')}
          </select>
        </div>
        <p class="hint">랭킹은 동 단위로 집계됩니다.</p>
      </div>
      <div class="field">
        <label>카메라 캘리브레이션</label>
        <button class="btn btn-secondary btn-block" onclick="openCalibrationModal()">
          ${state.signup.calibrated ? '✓ 체형 보정 완료 (다시 촬영하려면 클릭)' : '카메라로 체형 보정하기'}
        </button>
        <p class="hint">
          ${state.signup.calibrated && state.signup.calProfile && state.signup.calProfile.bodyInfo && state.signup.calProfile.bodyInfo.bmi ? `BMI ${state.signup.calProfile.bodyInfo.bmi} 기준으로 저장됨 · ` : ''}실제 웹캠으로 촬영 각도·거리·신체 비율을 미리 보정해 자세 분석 정확도를 높입니다.
        </p>
      </div>

      <button class="btn btn-primary btn-block" style="margin-top:6px;" onclick="doSignup()">가입하고 시작하기</button>
      <p class="switch-line">이미 계정이 있으신가요? <button onclick="goto('login')">로그인</button></p>
    </div>
  </div>`;
}
function setSignupCity(v){
  state.signup.regionCity=v;
  const gus=Object.keys(REGION_DATA[v]);
  state.signup.regionGu=gus[0];
  state.signup.regionDong=REGION_DATA[v][gus[0]][0];
  render();
}
function setSignupGu(v){
  state.signup.regionGu=v;
  state.signup.regionDong=REGION_DATA[state.signup.regionCity][v][0];
  render();
}
function setSignupDong(v){ state.signup.regionDong=v; render(); }
// (#8) 아이디·닉네임 중복확인 버튼 — 실제로는 SQL SELECT ... WHERE id=? / nickname=? 로 대체된다.
function checkSignupIdDup(){
  const id=document.getElementById('su-id').value.trim();
  const msg=document.getElementById('su-id-msg');
  if(!id){ msg.style.color='var(--danger)'; msg.textContent='아이디를 입력해주세요'; msg.style.display='block'; return; }
  const dup=EXISTING_USERS.some(u=>u.id===id);
  msg.style.color = dup ? 'var(--danger)' : 'var(--accent)';
  msg.textContent = dup ? '이미 사용중인 아이디입니다' : '사용 가능한 아이디입니다';
  msg.style.display='block';
}
function checkSignupNickDup(){
  const nick=document.getElementById('su-nick').value.trim();
  const msg=document.getElementById('su-nick-msg');
  if(!nick){ msg.style.color='var(--danger)'; msg.textContent='닉네임을 입력해주세요'; msg.style.display='block'; return; }
  const dup=EXISTING_USERS.some(u=>u.nickname===nick);
  msg.style.color = dup ? 'var(--danger)' : 'var(--accent)';
  msg.textContent = dup ? '이미 사용중인 닉네임입니다' : '사용 가능한 닉네임입니다';
  msg.style.display='block';
}
function checkSignupPwMatch(){
  const pw=document.getElementById('su-pw').value;
  const pw2=document.getElementById('su-pw2').value;
  const msg=document.getElementById('su-pw2-msg');
  msg.style.display = (pw2 && pw!==pw2) ? 'block' : 'none';
}
// [백엔드 연동 필요 구간] 여기 doSignup()부터: 지금은 state.user에 값만 옮겨 담는
// 목업이지만, 실제 구현에서는 이 지점에서 아래 파이프라인이 필요합니다.
//   회원가입 폼 제출(여기) > Java 서버 회원가입 API(비밀번호 해싱 포함) > DB 연결 > SQL INSERT(계정 테이블)
function doSignup(){
  const id=document.getElementById('su-id').value.trim();
  const pw=document.getElementById('su-pw').value;
  const pw2=document.getElementById('su-pw2').value;
  const nick=document.getElementById('su-nick').value.trim() || '홈트초보';
  const email=document.getElementById('su-email').value.trim();
  // (#8) 아이디·닉네임 중복 확인 — 실제로는 SQL SELECT ... WHERE id=? / nickname=? 로 대체된다.
  if(!id){ toast('아이디를 입력해주세요'); return; }
  if(pw!==pw2){ toast('비밀번호가 일치하지 않습니다'); return; }
  if(EXISTING_USERS.some(u=>u.id===id)){ toast('이미 사용중인 아이디입니다'); return; }
  if(EXISTING_USERS.some(u=>u.nickname===nick)){ toast('이미 사용중인 닉네임입니다'); return; }
  const region=`${state.signup.regionCity} ${state.signup.regionGu} ${state.signup.regionDong}`;
  state.user.nickname = nick;
  state.user.email = email;
  state.user.gender = state.signup.gender || 'male';
  state.user.region = region;
  state.user.calibration = state.signup.calProfile || null;
  state.settings.account.nickname = state.user.nickname;
  state.settings.account.regionCity = state.signup.regionCity;
  state.settings.account.regionGu = state.signup.regionGu;
  state.settings.account.regionDong = state.signup.regionDong;
  EXISTING_USERS.push({id, nickname:nick, email});
  toast('회원가입이 완료되었습니다');
  goto('login');
}

/* ---------- 회원가입 : 실제 웹캠 캘리브레이션 모달 (MediaPipe Pose) ---------- */
// (FR-AC-002) 이 구간(calStartCamera ~ calComputeProfile)은 브라우저 안에서 도는
// MediaPipe Pose(WASM) 계산이라 그대로 프론트엔드에 남습니다 — 백엔드가 필요 없는 부분.
//   웹캠 영상(JS) > MediaPipe Pose(WASM, 브라우저 내 실행) > 체형 프로필 계산(JS)
// 계산된 결과를 실제로 "저장"하는 시점(아래 calApply())부터만 서버 연동이 필요합니다.
const CAL_REQUIRED_HOLD_MS = 2000;
const CAL_VIS_THRESHOLD = 0.55;
const CAL_DIST_MIN = 0.45;
const CAL_DIST_MAX = 0.85;
const CAL_CENTER_TOL = 0.16;
const CAL_KEYPOINT_IDX = {
  nose:0, lsh:11, rsh:12, lelbow:13, relbow:14, lwrist:15, rwrist:16,
  lhip:23, rhip:24, lknee:25, rknee:26, lank:27, rank:28,
};
const CAL_CONNECTIONS = [
  [11,12],[11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],
  [23,25],[25,27],[27,29],[27,31],
  [24,26],[26,28],[28,30],[28,32],
];

let calMediaPipeMod = null;   // 동적 import로 로드한 MediaPipe 모듈 (한 번만 로드)
let calPoseLandmarker = null; // PoseLandmarker 인스턴스
let calVideoStream = null;    // getUserMedia 스트림
let calRunning = false;       // 캘리브레이션 루프 실행 여부
let calRAF = null;            // requestAnimationFrame id
let calLastVideoTime = -1;
let calHoldStart = null;      // 정렬 유지 시작 시각
let calFrameCount = 0, calFpsTs = 0;

function openCalibrationModal(){
  state.signup.calModalOpen = true;
  state.signup.calStage = state.signup.calProfile ? 'done' : 'idle';
  state.signup.calError = '';
  render();
}
function closeCalibrationModal(){
  calStopCamera();
  state.signup.calModalOpen = false;
  render();
}
function calRetake(){
  state.signup.calProfile = null;
  state.signup.calStage = 'idle';
  state.signup.calError = '';
  render();
}
// [백엔드 연동 필요 구간] calApply() 지점: 계산된 관절 좌표·체형 프로필(JSON)을 실제로 남기려면
//   calApply() 호출(여기) > Java 서버 캘리브레이션 저장 API > DB 연결 > SQL INSERT(캘리브레이션 테이블, 또는 JSON 컬럼)
function calApply(){
  state.signup.calibrated = true;
  state.signup.calModalOpen = false;
  toast('체형 보정이 저장되었습니다');
  // 이미 로그인된 상태(운동 탭에서 필수 캘리브레이션으로 진입한 경우)라면 여기서 바로
  // 계정에 보정값을 반영해서, 다시 회원가입을 거치지 않아도 곧장 튜토리얼로 넘어가게 한다.
  if(state.screen==='app'){
    state.user.calibration = state.signup.calProfile;
    if(state.menu==='exercise' && state.exercise.step===0 && state.exercise.picked){
      goExStep(1);
      return;
    }
  }
  render();
}

function calClamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

// 키/몸무게 입력값 → BMI. 가이드 실루엣 보정 및 저장되는 bodyInfo에 함께 쓰인다.
// 성별은 캘리브레이션 화면의 남성/여성 토글(setCalGender)에서 선택한 값을 그대로 담아,
// 이후 캐릭터 생성 시 남성/여성 캐릭터를 구분하는 기준으로 재사용한다.
function calGetBodyInfo(){
  const hEl = document.getElementById('cal-height-input');
  const wEl = document.getElementById('cal-weight-input');
  const heightCm = hEl ? (parseFloat(hEl.value) || null) : null;
  const weightKg = wEl ? (parseFloat(wEl.value) || null) : null;
  const bmi = heightCm && weightKg ? weightKg / ((heightCm/100) ** 2) : null;
  return { heightCm, weightKg, bmi: bmi ? +bmi.toFixed(1) : null, gender: state.signup.gender || 'male' };
}
// 성별 토글은 캘리브레이션 촬영이 진행 중일 수 있어 render()로 화면 전체를 다시 그리지 않고,
// 버튼 두 개의 active 클래스만 직접 바꾼다 (render()를 부르면 video 엘리먼트가 새로 만들어져
// 이미 연결된 카메라 스트림이 끊긴다).
function setCalGender(g){
  state.signup.gender=g;
  document.querySelectorAll('.cal-gender-tab').forEach(el=>{
    el.classList.toggle('active', el.dataset.gender===g);
  });
}
function calBmiCategory(bmi){
  if(bmi==null) return '';
  if(bmi<18.5) return '저체중';
  if(bmi<23) return '표준';
  if(bmi<25) return '과체중';
  return '비만';
}
function calUpdateBmiLabel(){
  const lbl=document.getElementById('cal-bmi-label');
  if(!lbl) return;
  const {heightCm,weightKg,bmi}=calGetBodyInfo();
  if(!heightCm || !weightKg){ lbl.textContent='체형 정보를 입력하면 가이드 실루엣이 내 체형에 맞게 조정돼요.'; return; }
  lbl.textContent = `BMI ${bmi.toFixed(1)} · ${calBmiCategory(bmi)} 기준으로 실루엣을 보정했어요.`;
}
// BMI가 높을수록 실루엣 폭을 넓게, 키가 클수록 하체 비중을 늘려 힙 위치를 살짝 올려준다.
// (회원가입 캘리브레이션 화면·운동 촬영 고스트 양쪽에서 재사용하도록 DOM 의존 없이 값만 받는다.)
function bodyShapeFactorsFromBmi(bmi, heightCm){
  const widthFactor = bmi ? calClamp(0.85 + (bmi-21)*0.012, 0.82, 1.25) : 1;
  const legShift = heightCm ? calClamp((heightCm-165)*0.0006, -0.03, 0.03) : 0;
  return { widthFactor, legShift };
}
function calGetBodyShapeFactors(){
  const {heightCm,bmi}=calGetBodyInfo();
  return bodyShapeFactorsFromBmi(bmi, heightCm);
}

async function loadMediaPipe(){
  if(calMediaPipeMod) return calMediaPipeMod;
  calMediaPipeMod = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14');
  return calMediaPipeMod;
}

async function calStartCamera(){
  const btn=document.getElementById('cal-start-btn');
  if(btn){ btn.disabled=true; btn.textContent='준비 중...'; }
  state.signup.calError='';
  try{
    const {PoseLandmarker, FilesetResolver} = await loadMediaPipe();
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    calPoseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions:{
        modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate:'GPU',
      },
      runningMode:'VIDEO', numPoses:1,
    });
    const stream = await navigator.mediaDevices.getUserMedia({video:{width:960,height:720,facingMode:'user'}, audio:false});
    calVideoStream = stream;
    const video=document.getElementById('cal-video');
    video.srcObject=stream;
    await new Promise(res=>{ video.onloadedmetadata=res; });
    video.play();
    const canvas=document.getElementById('cal-canvas');
    canvas.width=video.videoWidth;
    canvas.height=video.videoHeight;
    calRunning=true;
    calHoldStart=null;
    state.signup.calStage='running';
    if(btn) btn.style.display='none';
    calLoop();
  }catch(err){
    console.error(err);
    state.signup.calError = '카메라를 시작할 수 없습니다: '+err.message+' (권한 허용 여부, https 또는 localhost 환경인지 확인해주세요)';
    state.signup.calStage='error';
    render();
  }
}

function calStopCamera(){
  calRunning=false;
  if(calRAF) cancelAnimationFrame(calRAF);
  calRAF=null;
  if(calVideoStream){ calVideoStream.getTracks().forEach(t=>t.stop()); calVideoStream=null; }
}

function calSetCheck(id, ok){
  const el=document.getElementById(id);
  if(!el) return;
  el.classList.toggle('ok', ok===true);
  el.classList.toggle('bad', ok===false);
}

function calEvaluate(landmarks){
  const idx={nose:0,lsh:11,rsh:12,lhip:23,rhip:24,lank:27,rank:28};
  const need=[idx.nose,idx.lsh,idx.rsh,idx.lhip,idx.rhip,idx.lank,idx.rank];
  const bodyOk = need.every(i=>landmarks[i] && (landmarks[i].visibility ?? 1) >= CAL_VIS_THRESHOLD);
  let distOk=false, centerOk=false, bodyHeightRatio=null;
  if(bodyOk){
    const topY=landmarks[idx.nose].y;
    const botY=(landmarks[idx.lank].y+landmarks[idx.rank].y)/2;
    bodyHeightRatio=botY-topY;
    distOk = bodyHeightRatio>=CAL_DIST_MIN && bodyHeightRatio<=CAL_DIST_MAX;
    const hipCenterX=(landmarks[idx.lhip].x+landmarks[idx.rhip].x)/2;
    centerOk = Math.abs(hipCenterX-0.5) <= CAL_CENTER_TOL;
  }
  return { bodyOk, distOk, centerOk, all: bodyOk&&distOk&&centerOk, bodyHeightRatio };
}

// 키·몸무게(BMI) 입력값에 맞춰 크기·비율을 잡은 뒤, 얇은 점선 뼈대가 아니라 두꺼운 흰색
// 캡슐+원으로 채운 실루엣을 그린다(운동 촬영 화면의 고스트와 같은 스타일). 정렬이 되면 흰색은
// 그대로 두고 테두리 색만 파랗게 바꿔서 "채워진 흰색"이라는 느낌은 유지한다.
function calDrawGuideSilhouette(ctx, w, h, aligned){
  const totalH = ((CAL_DIST_MIN+CAL_DIST_MAX)/2) * h;
  const topY = 0.32*h; // 발끝이 화면 아래쪽에 거의 닿도록 실루엣 전체를 아래로 내림 (크기는 그대로, 위치만 이동)
  const cx = 0.5*w;
  const {widthFactor, legShift} = calGetBodyShapeFactors();

  const headR = totalH*0.085*widthFactor;
  const headCY = topY+headR;
  const shoulderY = topY+totalH*0.20;
  const hipY = topY+totalH*(0.52-legShift);
  const kneeY = topY+totalH*(0.76-legShift*0.6);
  const footY = topY+totalH;
  const handY = shoulderY+totalH*0.30;

  const shoulderHalfW = totalH*0.16*widthFactor;
  const hipHalfW = totalH*0.11*widthFactor;
  const handHalfW = totalH*0.30;
  const kneeHalfW = totalH*0.09*widthFactor;
  const footHalfW = totalH*0.11*widthFactor;
  const limbWidth = Math.max(10, totalH*0.05*widthFactor);

  ctx.save();
  ctx.globalAlpha = aligned ? 0.85 : 0.6;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = aligned ? '#6FBBEE' : '#FFFFFF';
  ctx.lineCap='round'; ctx.lineJoin='round';
  // 사용자 옷 색·배경 밝기와 상관없이 실루엣이 잘 보이도록 어두운 그림자를 깔아 대비를 높인다.
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 7;

  ctx.lineWidth = limbWidth;
  [-1,1].forEach(side=>{ // 팔: 어깨→손 곡선을 두꺼운 캡슐로
    ctx.beginPath();
    ctx.moveTo(cx+side*shoulderHalfW, shoulderY);
    ctx.quadraticCurveTo(cx+side*handHalfW*0.9, (shoulderY+handY)/2, cx+side*handHalfW, handY);
    ctx.stroke();
  });
  [-1,1].forEach(side=>{ // 다리: 엉덩이→무릎→발
    ctx.beginPath();
    ctx.moveTo(cx+side*hipHalfW*0.7, hipY);
    ctx.lineTo(cx+side*kneeHalfW, kneeY);
    ctx.lineTo(cx+side*footHalfW, footY);
    ctx.stroke();
  });

  ctx.beginPath(); // 몸통: 채운 사각형
  ctx.moveTo(cx-shoulderHalfW, shoulderY);
  ctx.lineTo(cx-hipHalfW, hipY);
  ctx.lineTo(cx+hipHalfW, hipY);
  ctx.lineTo(cx+shoulderHalfW, shoulderY);
  ctx.closePath(); ctx.fill();

  const jointR = limbWidth*0.5; // 관절 이음매를 원으로 채워 캡슐 연결부를 매끄럽게
  [[cx-shoulderHalfW,shoulderY],[cx+shoulderHalfW,shoulderY],
   [cx-hipHalfW*0.7,hipY],[cx+hipHalfW*0.7,hipY],
   [cx-kneeHalfW,kneeY],[cx+kneeHalfW,kneeY],
   [cx-footHalfW,footY],[cx+footHalfW,footY],
   [cx-handHalfW,handY],[cx+handHalfW,handY]].forEach(([x,y])=>{
    ctx.beginPath(); ctx.arc(x,y,jointR,0,Math.PI*2); ctx.fill();
  });

  ctx.beginPath(); ctx.arc(cx, headCY, headR, 0, Math.PI*2); ctx.fill(); // 머리

  ctx.globalAlpha=1;
  ctx.fillStyle = aligned ? '#6FBBEE' : '#FFFFFF';
  ctx.font = `700 ${Math.max(12, w*0.018)}px 'Pretendard', 'Malgun Gothic', sans-serif`;
  ctx.textAlign='center';
  // 캔버스가 CSS로 좌우 반전(셀카뷰)되어 있어 텍스트만 한 번 더 반전시켜 상쇄한다.
  ctx.translate(w,0);
  ctx.scale(-1,1);
  ctx.fillText(aligned ? '정렬 완료' : '이 실루엣 안에 맞춰 서주세요', cx, Math.max(18, topY-10));
  ctx.restore();
}

function calDraw(landmarks, checks){
  const canvas=document.getElementById('cal-canvas');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  calDrawGuideSilhouette(ctx, canvas.width, canvas.height, !!(checks && checks.all));
  if(!landmarks) return;
  const w=canvas.width, h=canvas.height;
  ctx.lineWidth=3;
  ctx.strokeStyle = checks.all ? '#6FBBEE' : '#FF8A5E';
  CAL_CONNECTIONS.forEach(([a,b])=>{
    const pa=landmarks[a], pb=landmarks[b];
    if(!pa||!pb) return;
    ctx.beginPath(); ctx.moveTo(pa.x*w, pa.y*h); ctx.lineTo(pb.x*w, pb.y*h); ctx.stroke();
  });
  ctx.fillStyle = checks.all ? '#6FBBEE' : '#FF8A5E';
  landmarks.forEach(p=>{
    if(p.visibility!==undefined && p.visibility<CAL_VIS_THRESHOLD) return;
    ctx.beginPath(); ctx.arc(p.x*w, p.y*h, 4, 0, Math.PI*2); ctx.fill();
  });
}

function calSnapshotDataUrl(){
  const video=document.getElementById('cal-video');
  const snap=document.createElement('canvas');
  snap.width=video.videoWidth; snap.height=video.videoHeight;
  snap.getContext('2d').drawImage(video,0,0,snap.width,snap.height);
  return snap.toDataURL('image/jpeg',0.7);
}
function calComputeMetrics(pts){
  const shoulderWidth=Math.hypot(pts.lsh.x-pts.rsh.x, pts.lsh.y-pts.rsh.y);
  const hipWidth=Math.hypot(pts.lhip.x-pts.rhip.x, pts.lhip.y-pts.rhip.y);
  const torsoLen=Math.hypot(
    (pts.lsh.x+pts.rsh.x)/2-(pts.lhip.x+pts.rhip.x)/2,
    (pts.lsh.y+pts.rsh.y)/2-(pts.lhip.y+pts.rhip.y)/2
  );
  const bodyHeight=((pts.lank.y+pts.rank.y)/2)-pts.nose.y;
  return {
    shoulderWidth:+shoulderWidth.toFixed(4), hipWidth:+hipWidth.toFixed(4),
    torsoLength:+torsoLen.toFixed(4), bodyHeightRatio:+bodyHeight.toFixed(4),
  };
}
function calComputeProfile(landmarks){
  const canvas=document.getElementById('cal-canvas');
  const pts={};
  for(const [key,idx] of Object.entries(CAL_KEYPOINT_IDX)){
    pts[key]={x:+landmarks[idx].x.toFixed(4), y:+landmarks[idx].y.toFixed(4)};
  }
  return {
    createdAt:new Date().toISOString(),
    frameWidth:canvas.width, frameHeight:canvas.height,
    bodyInfo:calGetBodyInfo(),
    snapshot:calSnapshotDataUrl(),
    landmarks:pts,
    normalized:calComputeMetrics(pts),
  };
}

function calLoop(){
  if(!calRunning) return;
  calRAF=requestAnimationFrame(calLoop);
  const video=document.getElementById('cal-video');
  if(!video || video.currentTime===calLastVideoTime) return;
  calLastVideoTime=video.currentTime;

  const ts=performance.now();
  const res=calPoseLandmarker.detectForVideo(video, ts);

  calFrameCount++;
  if(ts-calFpsTs>1000){
    const fpsEl=document.getElementById('cal-fps-badge');
    if(fpsEl) fpsEl.textContent=`${calFrameCount} fps`;
    calFrameCount=0; calFpsTs=ts;
  }

  if(!res.landmarks || res.landmarks.length===0){
    calDraw(null, {all:false});
    calSetCheck('cal-check-body', false);
    calSetCheck('cal-check-dist', false);
    calSetCheck('cal-check-center', false);
    calHoldStart=null;
    const bar=document.getElementById('cal-hold-bar'); if(bar) bar.style.width='0%';
    const lbl=document.getElementById('cal-hold-label'); if(lbl) lbl.textContent='보정 유지 시간 (사람이 인식되지 않았습니다)';
    return;
  }

  const landmarks=res.landmarks[0];
  const checks=calEvaluate(landmarks);
  calDraw(landmarks, checks);
  calSetCheck('cal-check-body', checks.bodyOk);
  calSetCheck('cal-check-dist', checks.bodyOk ? checks.distOk : null);
  calSetCheck('cal-check-center', checks.bodyOk ? checks.centerOk : null);

  const bar=document.getElementById('cal-hold-bar');
  const lbl=document.getElementById('cal-hold-label');
  if(checks.all){
    if(!calHoldStart) calHoldStart=ts;
    const elapsed=ts-calHoldStart;
    const pct=Math.min(100,(elapsed/CAL_REQUIRED_HOLD_MS)*100);
    if(bar) bar.style.width=pct+'%';
    if(lbl) lbl.textContent=`보정 유지 시간 (${(elapsed/1000).toFixed(1)}s / ${(CAL_REQUIRED_HOLD_MS/1000).toFixed(1)}s)`;
    if(elapsed>=CAL_REQUIRED_HOLD_MS){
      const profile=calComputeProfile(landmarks);
      calStopCamera();
      state.signup.calProfile=profile;
      state.signup.calStage='done';
      render();
    }
  } else {
    calHoldStart=null;
    if(bar) bar.style.width='0%';
    const reasons=[];
    if(!checks.bodyOk) reasons.push('전신이 프레임에 보이지 않습니다');
    else{
      if(!checks.distOk) reasons.push(checks.bodyHeightRatio<CAL_DIST_MIN ? '카메라와 더 가까이 서주세요' : '카메라와 더 멀리 떨어져주세요');
      if(!checks.centerOk) reasons.push('화면 중앙으로 이동해주세요');
    }
    if(lbl) lbl.textContent='보정 유지 시간 ('+reasons.join(' · ')+')';
  }
}

function renderCalibrationModal(){
  const s=state.signup;
  const stage=s.calStage||'idle';
  return `
  <div class="confirm-backdrop">
    <div class="confirm-box" style="max-width:min(1080px,94vw);width:100%;">
      <h3>카메라 캘리브레이션</h3>
      <p style="color:var(--ink-dim);font-size:13px;line-height:1.55;margin:0 0 16px;">전신이 화면에 들어오도록 서서, 화면의 점선 실루엣에 맞춰 2초간 자세를 유지하면 자동으로 체형이 저장됩니다.</p>
      ${stage==='done' ? renderCalDone(s) : renderCalLive(s)}
    </div>
  </div>`;
}

function renderCalLive(s){
  return `
  <div class="grid cal-grid">
    <div>
      <div class="cam-stage" style="aspect-ratio:3/4;max-height:70vh;">
        <video id="cal-video" autoplay playsinline muted style="transform:scaleX(-1);width:100%;height:100%;object-fit:cover;"></video>
        <canvas class="cam-overlay-canvas" id="cal-canvas" style="transform:scaleX(-1);"></canvas>
        <div class="cam-badge"><span class="rec-dot"></span><span id="cal-fps-badge">대기중</span></div>
      </div>
      <button class="btn btn-primary btn-block" id="cal-start-btn" style="margin-top:12px;" onclick="calStartCamera()">카메라 시작</button>
      ${s.calError ? `<p class="hint" style="color:var(--danger);margin-top:8px;">${s.calError}</p>` : ''}
    </div>
    <div>
      <div class="check" id="cal-check-body"><span class="dot"></span>전신 인식 (머리~발목)</div>
      <div class="check" id="cal-check-dist" style="margin-top:8px;"><span class="dot"></span>적정 거리</div>
      <div class="check" id="cal-check-center" style="margin-top:8px;"><span class="dot"></span>중앙 정렬</div>
      <div style="margin-top:12px;">
        <div class="hint" id="cal-hold-label">보정 유지 시간</div>
        <div class="progress" style="margin-top:6px;"><span id="cal-hold-bar" style="width:0%"></span></div>
      </div>
      <div class="field" style="margin-top:16px;">
        <label>캐릭터 성별</label>
        <div class="subtabs" style="margin-bottom:0;">
          <div class="tab cal-gender-tab ${s.gender!=='female'?'active':''}" data-gender="male" onclick="setCalGender('male')">남성 캐릭터</div>
          <div class="tab cal-gender-tab ${s.gender==='female'?'active':''}" data-gender="female" onclick="setCalGender('female')">여성 캐릭터</div>
        </div>
      </div>
      <div class="field-row" style="margin-top:16px;">
        <div class="field"><label>키 (cm)</label><input type="number" id="cal-height-input" placeholder="예: 170" oninput="calUpdateBmiLabel()"></div>
        <div class="field"><label>몸무게 (kg)</label><input type="number" id="cal-weight-input" placeholder="예: 65" oninput="calUpdateBmiLabel()"></div>
      </div>
      <p class="hint" id="cal-bmi-label">체형 정보를 입력하면 가이드 실루엣이 내 체형에 맞게 조정돼요.</p>
      <button class="btn btn-ghost btn-block" style="margin-top:14px;" onclick="closeCalibrationModal()">닫기</button>
    </div>
  </div>`;
}

function renderCalDone(s){
  const p=s.calProfile;
  const bi=p.bodyInfo||{};
  return `
  <div class="grid cal-grid">
    <div>
      <div class="cam-stage" style="aspect-ratio:3/4;max-height:70vh;">
        <canvas id="cal-edit-canvas" style="width:100%;height:100%;display:block;cursor:grab;"></canvas>
      </div>
      <p class="hint" style="margin-top:8px;">보정 완료 · ${new Date(p.createdAt).toLocaleString()} · 점을 드래그하면 관절 위치를 바로 수정할 수 있어요.</p>
      <div id="cal-edit-point-list" style="display:flex;flex-direction:column;gap:5px;margin-top:10px;max-height:210px;overflow-y:auto;"></div>
    </div>
    <div>
      <div class="stat-row" style="margin:0 0 12px;">
        <div class="stat-box"><div class="num mono" id="cal-edit-m-shoulder">${p.normalized.shoulderWidth}</div><div class="lbl">어깨너비</div></div>
        <div class="stat-box"><div class="num mono" id="cal-edit-m-height">${p.normalized.bodyHeightRatio}</div><div class="lbl">신장비율</div></div>
        ${bi.bmi ? `<div class="stat-box"><div class="num mono">${bi.bmi}</div><div class="lbl">BMI</div></div>` : ''}
      </div>
      <button class="btn btn-primary btn-block" onclick="calApply()">이 보정값 적용하기</button>
      <button class="btn btn-secondary btn-block" style="margin-top:8px;" onclick="calRetake()">다시 촬영</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px;" onclick="closeCalibrationModal()">닫기</button>
    </div>
  </div>`;
}

/* ---------- 캘리브레이션 완료 후 관절 포인트 직접 편집 (calibrationeditor.html 로직을 모달 내로 이식) ---------- */
// (FR-AC-003) 이 구간(calSetupEditCanvas ~ calEditEndDrag)은 캔버스 위에서 점을 드래그해
// 좌표만 수정하는 순수 프론트엔드 로직입니다 — 별도 백엔드 호출 없이, 위 calApply()가
// 실행될 때 수정된 좌표까지 함께 저장 API로 넘어가면 됩니다.
const CAL_EDIT_POINTS=[
  {key:'nose', label:'코(머리)', color:'#6FBBEE'},
  {key:'lsh', label:'왼쪽 어깨', color:'#F0B93A'}, {key:'rsh', label:'오른쪽 어깨', color:'#F0B93A'},
  {key:'lelbow', label:'왼쪽 팔꿈치', color:'#C88CFF'}, {key:'relbow', label:'오른쪽 팔꿈치', color:'#C88CFF'},
  {key:'lwrist', label:'왼쪽 손목', color:'#8CD0FF'}, {key:'rwrist', label:'오른쪽 손목', color:'#8CD0FF'},
  {key:'lhip', label:'왼쪽 골반', color:'#FF8A5E'}, {key:'rhip', label:'오른쪽 골반', color:'#FF8A5E'},
  {key:'lknee', label:'왼쪽 무릎', color:'#4A7CFF'}, {key:'rknee', label:'오른쪽 무릎', color:'#4A7CFF'},
  {key:'lank', label:'왼쪽 발목', color:'#E5645A'}, {key:'rank', label:'오른쪽 발목', color:'#E5645A'},
];
const CAL_EDIT_BONES=[
  ['lsh','rsh'],['lsh','lhip'],['rsh','rhip'],['lhip','rhip'],
  ['lsh','lelbow'],['lelbow','lwrist'],['rsh','relbow'],['relbow','rwrist'],
  ['lhip','lknee'],['lknee','lank'],['rhip','rknee'],['rknee','rank'],
];
let calEditImg=null, calEditImgSrc=null, calEditSelectedKey=null, calEditDragKey=null;

function calSetupEditCanvas(){
  const canvas=document.getElementById('cal-edit-canvas');
  const profile=state.signup.calProfile;
  if(!canvas || !profile) return;
  canvas.width=profile.frameWidth||640;
  canvas.height=profile.frameHeight||480;

  if(calEditImgSrc!==profile.snapshot){
    calEditImg=new Image();
    calEditImgSrc=profile.snapshot;
    calEditImg.onload=calEditRender;
    calEditImg.src=profile.snapshot;
  } else {
    calEditRender();
  }

  canvas.onmousedown=calEditStartDrag;
  canvas.onmousemove=calEditMoveDrag;
  window.onmouseup=calEditEndDrag;
  canvas.ontouchstart=calEditStartDrag;
  canvas.ontouchmove=calEditMoveDrag;
  window.ontouchend=calEditEndDrag;
}
function calEditRender(){
  const canvas=document.getElementById('cal-edit-canvas');
  const profile=state.signup.calProfile;
  if(!canvas || !profile) return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(calEditImg && calEditImg.complete) ctx.drawImage(calEditImg,0,0,canvas.width,canvas.height);

  const pts=profile.landmarks;
  ctx.strokeStyle='rgba(111,187,238,0.75)'; ctx.lineWidth=3;
  CAL_EDIT_BONES.forEach(([a,b])=>{
    if(!pts[a]||!pts[b]) return;
    ctx.beginPath();
    ctx.moveTo(pts[a].x*canvas.width, pts[a].y*canvas.height);
    ctx.lineTo(pts[b].x*canvas.width, pts[b].y*canvas.height);
    ctx.stroke();
  });
  CAL_EDIT_POINTS.forEach(({key,color})=>{
    const p=pts[key]; if(!p) return;
    const isSel=key===calEditSelectedKey;
    ctx.beginPath();
    ctx.arc(p.x*canvas.width, p.y*canvas.height, isSel?10:7, 0, Math.PI*2);
    ctx.fillStyle=color; ctx.fill();
    if(isSel){ ctx.lineWidth=2; ctx.strokeStyle='#fff'; ctx.stroke(); }
  });
  calEditUpdatePointList();
}
function calEditUpdatePointList(){
  const list=document.getElementById('cal-edit-point-list');
  const profile=state.signup.calProfile;
  if(!list || !profile) return;
  const pts=profile.landmarks;
  list.innerHTML=CAL_EDIT_POINTS.map(({key,label,color})=>{
    const p=pts[key]; if(!p) return '';
    const sel=key===calEditSelectedKey;
    return `<div onclick="calEditSelectPoint('${key}')" style="display:flex;align-items:center;gap:8px;font-size:12px;padding:7px 10px;border-radius:8px;background:var(--surface-2);cursor:pointer;border:1px solid ${sel?'var(--accent)':'transparent'};color:${sel?'var(--accent)':'inherit'};">
      <span style="width:9px;height:9px;border-radius:50%;background:${color};flex:none;"></span>${label}
      <span class="mono" style="margin-left:auto;font-size:11px;color:var(--ink-faint);">${p.x.toFixed(3)}, ${p.y.toFixed(3)}</span>
    </div>`;
  }).join('');
  const m=profile.normalized;
  const shEl=document.getElementById('cal-edit-m-shoulder'); if(shEl) shEl.textContent=m.shoulderWidth;
  const htEl=document.getElementById('cal-edit-m-height'); if(htEl) htEl.textContent=m.bodyHeightRatio;
}
function calEditSelectPoint(key){ calEditSelectedKey=key; calEditRender(); }
function calEditCanvasPos(evt){
  const canvas=document.getElementById('cal-edit-canvas');
  const rect=canvas.getBoundingClientRect();
  const scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height;
  const clientX=evt.touches?evt.touches[0].clientX:evt.clientX;
  const clientY=evt.touches?evt.touches[0].clientY:evt.clientY;
  return { x:(clientX-rect.left)*scaleX, y:(clientY-rect.top)*scaleY };
}
function calEditHitTest(mx,my){
  const canvas=document.getElementById('cal-edit-canvas');
  const pts=state.signup.calProfile.landmarks;
  let best=null, bestDist=18;
  CAL_EDIT_POINTS.forEach(({key})=>{
    const p=pts[key]; if(!p) return;
    const d=Math.hypot(p.x*canvas.width-mx, p.y*canvas.height-my);
    if(d<bestDist){ bestDist=d; best=key; }
  });
  return best;
}
function calEditStartDrag(evt){
  const {x,y}=calEditCanvasPos(evt);
  const hit=calEditHitTest(x,y);
  if(hit){ calEditDragKey=hit; calEditSelectedKey=hit; calEditRender(); evt.preventDefault(); }
}
function calEditMoveDrag(evt){
  if(!calEditDragKey) return;
  const canvas=document.getElementById('cal-edit-canvas');
  const {x,y}=calEditCanvasPos(evt);
  const nx=Math.min(1,Math.max(0,x/canvas.width));
  const ny=Math.min(1,Math.max(0,y/canvas.height));
  const profile=state.signup.calProfile;
  profile.landmarks[calEditDragKey]={x:+nx.toFixed(4), y:+ny.toFixed(4)};
  profile.normalized=calComputeMetrics(profile.landmarks);
  calEditRender();
  evt.preventDefault();
}
function calEditEndDrag(){ calEditDragKey=null; }

/* ---------- 로그인 ---------- */
// renderLogin: 입력 폼 렌더링만 담당하는 프론트엔드 로직. 실제 인증 처리는 아래 doLogin() 지점 참고.
function renderLogin(){
  return `
  <div class="center-shell">
    <div class="auth-card">
      <p class="auth-eyebrow">우리동네홈트챌린지</p>
      <h1 class="auth-title">로그인</h1>
      <p class="auth-sub">${state.user.nickname ? state.user.nickname+'님, 다시 오신 것을 환영해요' : '계정 정보를 입력해 주세요'}</p>
      <div class="field">
        <label for="li-id">아이디</label>
        <input id="li-id" type="text" placeholder="아이디" value="${state.user.nickname ? 'hometrainer01' : ''}">
      </div>
      <div class="field">
        <label for="li-pw">비밀번호</label>
        <input id="li-pw" type="password" placeholder="••••••••" value="${state.user.nickname ? '········' : ''}">
      </div>
      <div class="flex-between" style="margin:2px 0 4px;">
        <button class="btn btn-ghost btn-sm" style="padding-left:0;" onclick="openFindIdModal()">아이디 찾기</button>
        <button class="btn btn-ghost btn-sm" onclick="openFindPwModal()">비밀번호 찾기</button>
      </div>
      <button class="btn btn-primary btn-block" onclick="doLogin()">로그인</button>
      <div class="flex-between" style="margin:16px 0;gap:10px;">
        <div style="flex:1;height:1px;background:var(--line);"></div>
        <span class="hint" style="margin:0;">SNS 계정으로 로그인</span>
        <div style="flex:1;height:1px;background:var(--line);"></div>
      </div>
      <button class="btn btn-block" style="background:#FEE500;border-color:var(--outline);color:#241A00;margin-bottom:8px;" onclick="doSocialLogin('카카오')">카카오로 계속하기</button>
      <button class="btn btn-block" style="background:#03C75A;border-color:var(--outline);color:#fff;margin-bottom:8px;" onclick="doSocialLogin('네이버')">네이버로 계속하기</button>
      <button class="btn btn-secondary btn-block" onclick="doSocialLogin('구글')">Google로 계속하기</button>
      <p class="switch-line">아직 계정이 없으신가요? <button onclick="goto('signup')">회원가입</button></p>
    </div>
  </div>`;
}
// [백엔드 연동 필요 구간] doLogin() 지점:
//   로그인 폼 제출(여기) > Java 서버 로그인 API(비밀번호 검증, 세션/JWT 발급) > DB 연결 > SQL SELECT(계정 조회)
function doLogin(){
  if(!state.user.nickname){state.user.nickname='홈트초보';}
  state.screen='app';
  state.menu='main';
  render();
}
// [백엔드 연동 필요 구간] doSocialLogin() — 실제로는 각 사(카카오/네이버/구글) OAuth 인가 코드를
// 받아 Java 서버로 넘기고 > 서버가 토큰 교환 + 사용자 조회/생성(DB 연결, SQL INSERT or SELECT)을
// 수행한 뒤 세션을 발급하는 흐름이 필요하다. 여기서는 버튼 클릭 시 바로 로그인된 것처럼 목업 처리.
function doSocialLogin(provider){
  if(!state.user.nickname){state.user.nickname='홈트초보';}
  toast(`${provider} 계정으로 로그인했습니다`);
  state.screen='app';
  state.menu='main';
  render();
}

/* ---------- 아이디/비밀번호 찾기 모달 ---------- */
function openFindIdModal(){ state.findIdModal={open:true, result:null}; render(); }
function closeFindIdModal(){ state.findIdModal.open=false; render(); }
// [백엔드 연동 필요 구간] submitFindId() — 이메일로 인증코드 발송 > 코드 검증 API 호출 > DB 연결 >
// SQL SELECT(이메일로 계정 조회)가 필요하다. 여기서는 목업으로 등록된 첫 계정을 바로 보여준다.
function submitFindId(){
  const email=document.getElementById('find-id-email').value.trim();
  if(!email){ toast('이메일을 입력해주세요'); return; }
  state.findIdModal.result = EXISTING_USERS[0].id;
  render();
}
function renderFindIdModal(){
  const m=state.findIdModal;
  return `
  <div class="confirm-backdrop" onclick="if(event.target===this)closeFindIdModal()">
    <div class="confirm-box" style="max-width:380px;">
      <h3>아이디 찾기</h3>
      ${m.result ? `
        <p style="color:var(--ink-dim);font-size:13px;line-height:1.6;margin:0 0 18px;">가입하신 아이디는 <b style="color:var(--ink);">${m.result}</b> 입니다.</p>
        <div class="confirm-actions"><button class="btn btn-primary btn-sm" onclick="closeFindIdModal()">확인</button></div>
      ` : `
        <p class="hint" style="margin:0 0 14px;">가입 시 등록한 이메일로 인증코드를 보내드립니다.</p>
        <div class="field"><label for="find-id-email">이메일</label><input id="find-id-email" type="email" placeholder="example@email.com"></div>
        <div class="confirm-actions"><button class="btn btn-ghost btn-sm" onclick="closeFindIdModal()">취소</button><button class="btn btn-primary btn-sm" onclick="submitFindId()">인증코드 받기</button></div>
      `}
    </div>
  </div>`;
}
function openFindPwModal(){ state.findPwModal={open:true, done:false}; render(); }
function closeFindPwModal(){ state.findPwModal.open=false; render(); }
// [백엔드 연동 필요 구간] submitFindPw() — 회원아이디+이메일로 본인 확인 > Java 계정 API > DB 연결 >
// SQL SELECT로 일치 여부 확인 후 임시 비밀번호 발급·이메일 발송이 필요하다. 여기서는 목업 처리.
function submitFindPw(){
  const id=document.getElementById('find-pw-id').value.trim();
  const email=document.getElementById('find-pw-email').value.trim();
  if(!id || !email){ toast('아이디와 이메일을 모두 입력해주세요'); return; }
  state.findPwModal.done = true;
  render();
}
function renderFindPwModal(){
  const m=state.findPwModal;
  return `
  <div class="confirm-backdrop" onclick="if(event.target===this)closeFindPwModal()">
    <div class="confirm-box" style="max-width:380px;">
      <h3>비밀번호 찾기</h3>
      ${m.done ? `
        <p style="color:var(--ink-dim);font-size:13px;line-height:1.6;margin:0 0 18px;">입력하신 이메일로 임시 비밀번호를 보내드렸습니다.</p>
        <div class="confirm-actions"><button class="btn btn-primary btn-sm" onclick="closeFindPwModal()">확인</button></div>
      ` : `
        <p class="hint" style="margin:0 0 14px;">회원아이디와 가입 시 등록한 이메일을 입력해주세요.</p>
        <div class="field"><label for="find-pw-id">회원아이디</label><input id="find-pw-id" placeholder="아이디"></div>
        <div class="field"><label for="find-pw-email">이메일</label><input id="find-pw-email" type="email" placeholder="example@email.com"></div>
        <div class="confirm-actions"><button class="btn btn-ghost btn-sm" onclick="closeFindPwModal()">취소</button><button class="btn btn-primary btn-sm" onclick="submitFindPw()">임시 비밀번호 받기</button></div>
      `}
    </div>
  </div>`;
}

/* ---------- 앱 셸 ---------- */
const MENUS = [
  {id:'exercise', label:'운동'},
  {id:'mission', label:'미션'},
  {id:'profile', label:'마이페이지'},
  {id:'shop', label:'포인트 상점'},
  {id:'crew', label:'홈크루'},
  {id:'ranking', label:'랭킹'},
  {id:'support', label:'고객센터'},
];
function renderApp(){
  return `
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand" onclick="goHome()" style="cursor:pointer;" title="메인으로 이동">
        <div class="brand-mark">홈</div>
        <div class="brand-name">우리동네<br>홈트챌린지<small>HOME TRAINING</small></div>
      </div>
      ${MENUS.map(m=>`
        <div class="navitem ${state.menu===m.id?'active':''}" onclick="setMenu('${m.id}')">
          <span class="navicon"></span>${m.label}
        </div>`).join('')}
    </aside>
    <div class="main">
      <div class="topbar">
        <div>
          <div class="topbar-title">${state.user.region}</div>
        </div>
        <div class="user-chip">
          <div class="points-pill">P <span class="mono">${state.user.points.toLocaleString()}</span></div>
          <span class="topbar-nick">${state.user.nickname||'홈트초보'}</span>
          <div class="topbar-avatar" onclick="setMenu('profile')" title="마이페이지">
            <canvas id="topbar-avatar-canvas"></canvas>
            <span class="mono">Lv.${state.user.level}</span>
          </div>
        </div>
      </div>
      <div class="view">
        ${state.menu==='main' ? renderMain() :
          state.menu==='exercise' ? renderExercise() :
          state.menu==='mission' ? renderMission() :
          state.menu==='profile' ? renderProfile() :
          state.menu==='shop' ? renderShop() :
          state.menu==='crew' ? renderCrew() :
          state.menu==='ranking' ? renderRanking() :
          renderSupport()}
      </div>
    </div>
  </div>`;
}
function setMenu(id){state.menu=id; render();}
// 좌측 상단 로고(배너) 클릭 시: 서비스 소개 콘텐츠를 담은 "메인" 카테고리로 이동한다.
function goHome(){ state.menu='main'; render(); }
function renderMain(){
  return `
  <div class="view-head"><p>우리동네 홈트챌린지가 어떤 서비스인지 한눈에 확인하세요.</p></div>
  <div class="card" style="text-align:center;margin-bottom:24px;">
    <h2 style="margin:0 0 8px;">집에서, 우리 동네 사람들과 함께 운동해요</h2>
    <p class="desc" style="max-width:56ch;margin:0 auto 16px;">웹캠으로 자세를 실시간 판정하고, 미션과 랭킹으로 이웃과 함께 성장하는 홈트레이닝 서비스예요.</p>
    <button class="btn btn-primary" onclick="setMenu('exercise')">운동 시작하기</button>
  </div>
  <p class="section-label">이런 걸 할 수 있어요</p>
  ${renderIntroFeatures()}
  <p class="section-label" style="margin-top:32px;">이용 흐름</p>
  ${renderIntroSteps()}`;
}
function goto(screen){state.screen=screen; render();}

/* ========================================================================
   1. 운동 (EXERCISE WIZARD)
   ======================================================================== */
// (FR-EX-001~004) 종목 선택 ~ 웹캠 촬영(startSkeletonLoop, toggleRecording)까지는
// 브라우저에서 도는 촬영·자세 인식 로직이라 프론트엔드에 그대로 남습니다.
//   웹캠 스트림(JS) > (실제 구현 시) MediaPipe Pose 실시간 분석(WASM) > 관절 각도·등급 계산(JS)
// generateResult()는 지금 랜덤 값으로 판정을 흉내만 낸 것이고, 실제로는 위 계산 결과를
// 그대로 써서 점수를 만들면 됩니다. 이 결과를 "저장"하는 순간(saveExerciseResult())부터
// 아래처럼 서버 연동이 필요합니다.
//   촬영 결과 저장(saveExerciseResult) > Java 운동기록 API > DB 연결 > SQL INSERT/UPDATE
//   (운동 기록 테이블 INSERT, 포인트·경험치는 계정 테이블 UPDATE — 트랜잭션 처리 권장)
const EX_STEPS=['종목 선택','튜토리얼','웹캠 촬영','리플레이 분석','결과 저장'];
// 스쿼트 실시간 판정 기준. tools/extract-exercise-reference.html(종목별 캡처 이미지로
// 관절 각도를 뽑는 공용 도구, 스쿼트 항목)로 분석해서 나온 값으로 교체한다
// (지금은 일반적인 스쿼트 각도로 잡은 임시값).
// standing = 서 있을 때 무릎 각도, bottom = 정자세 최저점 무릎 각도, 나머지는 bottom과의
// 오차(도) 허용범위.
const SQUAT_REFERENCE = {
  standingKneeAngle: 172, bottomKneeAngle: 88,
  perfectTol: 6, greatTol: 12, goodTol: 20,
};
const EXERCISE_REP_TARGET = 10; // 실시간 판정이 지원되는 운동(스쿼트)의 세션당 반복 횟수 제한
const CAM_FINAL_COUNTDOWN_SECONDS = 5; // 정렬이 완료된 뒤 실제 촬영 시작까지의 음성 카운트다운
const CAM_ALIGN_HOLD_MS = 700; // 정렬 조건이 이 시간 이상 계속 유지돼야 카운트다운 시작(흔들림 방지)
const CAM_GUIDE_SPEAK_INTERVAL_MS = 2500; // 같은 안내 음성이 너무 자주 반복되지 않도록 하는 간격
// 허리(상체) 각도 기준값. 튜토리얼 영상에서 별도로 뽑은 값이 아니라, 일반적인 스쿼트 안전
// 자세 기준으로 잡은 값이라 나중에 tools/extract-exercise-reference.html처럼 실측 보정 가능.
const TORSO_STANDING_MIN_ANGLE = 130; // 정렬(서있는) 단계에서 허리가 곧게 펴져 있다고 볼 최소 각도(완화됨)
const TORSO_LEAN_WARN_DEG = 60; // 렙 진행 중 "서 있을 때 허리 각도" 대비 이만큼 이상 더 숙여지면 위험으로 판단(완화됨)
function exerciseStepHead(){
  return `
  <div class="view-head">
    <h1>운동</h1>
    <p>운동 종목 선택 → 튜토리얼 → 웹캠 촬영 → 리플레이 자세 분석 → 결과·점수 저장</p>
  </div>
  <div class="subtabs">
    ${EX_STEPS.map((s,i)=>`<div class="tab ${state.exercise.step===i?'active':''}">${i+1}. ${s}</div>`).join('')}
  </div>`;
}
function renderExercise(){
  const st=state.exercise.step;
  let body='';
  if(st===0) body=renderExStepPick();
  else if(st===1) body=renderExStepTutorial();
  else if(st===2) body=renderExStepCam();
  else if(st===3) body=renderExStepReplay();
  else body=renderExStepSave();
  return exerciseStepHead()+body;
}

function renderExStepPick(){
  return `
  <div class="grid grid-3">
    ${EXS.map(e=>`
      <div class="card exercise-card ${state.exercise.picked===e.id?'selected':''}" onclick="pickExercise('${e.id}')">
        <div class="ex-badge">${e.name.charAt(0)}</div>
        <h3>${e.name}</h3>
        <p class="desc">타겟: ${e.target}</p>
        <span class="pill pill-accent">${e.level}</span>
      </div>`).join('')}
  </div>
  <div style="margin-top:20px;">
    <button class="btn btn-primary" ${state.exercise.picked?'':'disabled'} style="${state.exercise.picked?'':'opacity:.4;cursor:not-allowed;'}" onclick="goToTutorial()">운동 시작하기</button>
  </div>`;
}
function pickExercise(id){state.exercise.picked=id; render();}
function goExStep(n){state.exercise.step=n; render();}
// 회원가입 시점에는 캘리브레이션이 선택사항이었지만(그냥 둘러보는 사람도 있어서), 실제로
// 운동을 시작하려는 시점(튜토리얼 진입)부터는 필수로 막는다 — 자세 분석 정확도를 위해 체형
// 보정값이 반드시 있어야 하기 때문. 아직 보정을 안 했다면 캘리브레이션 모달부터 띄운다.
function goToTutorial(){
  if(!state.user.calibration){
    toast('운동을 시작하려면 체형 캘리브레이션이 먼저 필요해요');
    openCalibrationModal();
    return;
  }
  goExStep(1);
}

function renderExStepTutorial(){
  const ex=EXS.find(e=>e.id===state.exercise.picked) || EXS[0];
  const isSquat = ex.id==='squat';
  return `
  <div class="grid grid-2">
    <div class="card">
      <p class="section-label">${ex.name} 정자세 가이드</p>
      ${isSquat ? `
      <div class="cam-stage" style="aspect-ratio:1/1;margin-bottom:14px;">
        <img src="Bodyweight_Squats.gif" alt="스쿼트 정자세 레퍼런스" style="width:100%;height:100%;object-fit:cover;">
      </div>` : ''}
      <ul class="steplist">
        <li><span class="num">1</span>발을 어깨너비로 벌리고 무게중심을 뒤꿈치에 둡니다.</li>
        <li><span class="num">2</span>허리를 곧게 편 상태로 천천히 내려갑니다.</li>
        <li><span class="num">3</span>무릎이 발끝을 넘지 않도록 각도를 유지합니다.</li>
        <li><span class="num">4</span>동작 최저점에서 1초 정지 후 천천히 복귀합니다.</li>
      </ul>
    </div>
    ${isSquat ? renderTutorialMissionList() : ''}
  </div>
  <div style="margin-top:20px;display:flex;gap:8px;">
    <button class="btn btn-ghost" onclick="goExStep(0)">이전</button>
    <button class="btn btn-primary" onclick="goExStep(2)">웹캠 촬영 시작</button>
  </div>`;
}
// 튜토리얼 화면에서 정자세 가이드 옆에, 지금 진행 중인 스쿼트 미션들과 각각의 진행 개수를
// 같이 보여준다 — 튜토리얼을 보다가 바로 "아, 이만큼 더 하면 되는구나"를 알 수 있게.
function renderTutorialMissionList(){
  const missions=allMissions();
  return `
  <div class="card">
    <p class="section-label">진행 중인 스쿼트 미션</p>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:460px;overflow-y:auto;">
      ${missions.map(m=>{
        const cur=Math.min(state.missions.counters[m.metric]||0, m.target);
        const done=cur>=m.target;
        return `
        <div style="border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;">
          <div class="flex-between">
            <span class="pill pill-muted" style="font-size:10px;">${MISSION_PERIOD_LABEL[m.period]}</span>
            <span class="mono" style="font-size:12px;color:${done?'var(--accent)':'var(--ink-dim)'};">${cur}/${m.target}</span>
          </div>
          <p style="margin:6px 0 0;font-size:12.5px;">${m.label}</p>
          <div class="progress" style="margin-top:6px;height:6px;"><span style="width:${Math.min(100,cur/m.target*100)}%"></span></div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}
function renderExStepCam(){
  const isSquat = state.exercise.picked==='squat';
  return `
  <div class="grid cal-grid">
    <div>
      <div class="cam-stage" id="cam-stage" style="max-height:85vh;">
        <div class="cam-placeholder" id="cam-placeholder">카메라를 확인하는 중...<br>브라우저의 카메라 권한을 허용해주세요.</div>
        <video id="cam-video" autoplay playsinline muted style="display:none;"></video>
        <canvas class="cam-overlay-canvas" id="cam-canvas"></canvas>
        <div class="cam-badge"><span class="rec-dot"></span><span id="cam-status">대기중</span></div>
        <div class="cam-timer mono" id="cam-timer">00:00</div>
        <div id="cam-grade-flash" class="cam-grade-flash"></div>
        <div id="cam-ready-overlay" class="cam-ready-overlay">
          <div class="count" id="cam-ready-count"></div>
          <div class="msg" id="cam-ready-msg">화면 속 스켈레톤에 맞춰 자리를 잡아주세요</div>
        </div>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px;">
        <button class="btn btn-primary" id="cam-toggle" onclick="toggleRecording()">촬영 시작</button>
        <button class="btn btn-ghost" onclick="goExStep(1)">이전</button>
      </div>
    </div>
    <div class="card">
      <p class="section-label">촬영 안내</p>
      <ul class="steplist">
        <li><span class="num">·</span>전신이 프레임에 들어오도록 카메라와 2~3m 거리를 둡니다.</li>
        ${isSquat
          ? `<li><span class="num">·</span><strong>카메라는 12시 방향에 두고, 다리 방향은 2시 방향을 향하도록 살짝 틀어 서주세요.</strong> (각도 판정 정확도를 위해 정면보다는 대각선 자세가 필요해요)</li>
             <li><span class="num">·</span>"촬영 시작"을 누르면 바로 측정되지 않고, 거리·방향·자세를 맞추라는 음성 안내가 나와요. 다 맞으면 자동으로 ${CAM_FINAL_COUNTDOWN_SECONDS}초 카운트다운 후 측정이 시작됩니다.</li>
             <li><span class="num">·</span>내 체형 캘리브레이션 실루엣이 화면에 고스트로 표시됩니다.</li>
             <li><span class="num">·</span>무릎 각도뿐 아니라 <strong>허리(상체) 각도</strong>도 함께 판정해 부상 위험이 있으면 알려드려요.</li>
             <li><span class="num">·</span>동작마다 PERFECT/GREAT/GOOD/MISS가 실시간으로 표시됩니다.</li>
             <li><span class="num">·</span>${EXERCISE_REP_TARGET}회를 채우면 자동으로 촬영이 종료됩니다.</li>`
          : `<li><span class="num">·</span>YOLO-Pose가 관절 keypoint를 실시간 추적합니다.</li>
             <li><span class="num">·</span>촬영 종료 시 자동으로 리플레이 분석이 시작됩니다.</li>`}
      </ul>
      <p class="section-label" style="margin-top:18px;">실시간 인식 상태</p>
      <div class="stat-row" style="margin:0;">
        <div class="stat-box"><div class="num mono" id="live-reps">0${isSquat?` / ${EXERCISE_REP_TARGET}`:''}</div><div class="lbl">인식 횟수</div></div>
        <div class="stat-box"><div class="num mono" id="live-acc">--%</div><div class="lbl">추정 정확도</div></div>
      </div>
    </div>
  </div>`;
}

function setupCamera(){
  const video=document.getElementById('cam-video');
  const placeholder=document.getElementById('cam-placeholder');
  if(!video) return;
  if(state.exercise.camStream){video.srcObject=state.exercise.camStream; video.style.display='block'; if(placeholder)placeholder.style.display='none';}
  if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
    navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false}).then(stream=>{
      state.exercise.camStream=stream;
      const v=document.getElementById('cam-video');
      if(v){v.srcObject=stream; v.style.display='block';}
      const ph=document.getElementById('cam-placeholder');
      if(ph) ph.style.display='none';
      startPoseFeedback();
    }).catch(()=>{
      const ph=document.getElementById('cam-placeholder');
      if(ph) ph.innerHTML='카메라를 사용할 수 없습니다.<br>웹캠 프리뷰 없이 모의 자세 인식으로 진행합니다.';
      startPoseFeedback();
    });
  } else {
    const ph=document.getElementById('cam-placeholder');
    if(ph) ph.innerHTML='이 브라우저에서는 카메라를 지원하지 않습니다.<br>모의 자세 인식으로 진행합니다.';
    startPoseFeedback();
  }
}
// 스쿼트는 실제 MediaPipe 판정 루프로, 나머지 운동(아직 학습 데이터 없음)은 기존 모의
// 스켈레톤 애니메이션으로 분기한다.
function startPoseFeedback(){
  if(state.exercise.picked==='squat' && state.exercise.camStream) exStartPoseLoop();
  else startSkeletonLoop();
}
function startSkeletonLoop(){
  const canvas=document.getElementById('cam-canvas');
  if(!canvas) return;
  const stage=document.getElementById('cam-stage');
  function resize(){canvas.width=stage.clientWidth; canvas.height=stage.clientHeight;}
  resize();
  const ctx=canvas.getContext('2d');
  let t=0;
  cancelAnimationFrame(startSkeletonLoop._raf);
  function draw(){
    if(!document.getElementById('cam-canvas')) return; // view changed
    t+=0.05;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const cx=canvas.width/2, cy=canvas.height/2, sway=Math.sin(t)*10;
    const bob = state.exercise.camPhase==='recording' ? Math.abs(Math.sin(t*1.6))*canvas.height*0.10 : 0;
    const joints={
      head:[cx+sway*0.3, cy-canvas.height*0.28+bob*0.2],
      neck:[cx+sway*0.3, cy-canvas.height*0.18+bob*0.2],
      lsh:[cx-30+sway*0.3, cy-canvas.height*0.15+bob*0.2], rsh:[cx+30+sway*0.3, cy-canvas.height*0.15+bob*0.2],
      lel:[cx-46+sway, cy-canvas.height*0.02+bob*0.3], rel:[cx+46+sway, cy-canvas.height*0.02+bob*0.3],
      lwr:[cx-52+sway, cy+canvas.height*0.10+bob*0.4], rwr:[cx+52+sway, cy+canvas.height*0.10+bob*0.4],
      hip:[cx+sway*0.2, cy+canvas.height*0.06+bob*0.5],
      lhip:[cx-22+sway*0.2, cy+canvas.height*0.08+bob*0.5], rhip:[cx+22+sway*0.2, cy+canvas.height*0.08+bob*0.5],
      lkn:[cx-24+sway*0.1, cy+canvas.height*0.24+bob], rkn:[cx+24+sway*0.1, cy+canvas.height*0.24+bob],
      lft:[cx-26, cy+canvas.height*0.40], rft:[cx+26, cy+canvas.height*0.40],
    };
    const bones=[['head','neck'],['neck','lsh'],['neck','rsh'],['lsh','lel'],['lel','lwr'],['rsh','rel'],['rel','rwr'],
      ['lsh','hip'],['rsh','hip'],['hip','lhip'],['hip','rhip'],['lhip','lkn'],['lkn','lft'],['rhip','rkn'],['rkn','rft']];
    ctx.strokeStyle='rgba(111,187,238,0.85)'; ctx.lineWidth=3; ctx.lineCap='round';
    bones.forEach(([a,b])=>{ctx.beginPath();ctx.moveTo(...joints[a]);ctx.lineTo(...joints[b]);ctx.stroke();});
    ctx.fillStyle='#6FBBEE';
    Object.values(joints).forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,4,0,7);ctx.fill();});
    startSkeletonLoop._raf=requestAnimationFrame(draw);
  }
  draw();
}
/* ---------- 스쿼트 실시간 자세 판정 (MediaPipe Pose, 실제 웹캠) ---------- */
// calStartCamera ~ calComputeProfile과 같은 방식으로 loadMediaPipe()를 재사용해 별도의
// PoseLandmarker(VIDEO 모드) 인스턴스를 만들고, cam-video에 대해 detectForVideo 루프를 돈다.
let exPoseLandmarker=null;
let exRAF=null;
let exLastVideoTime=-1;
let exRepPhase='up';       // 'up'(서있음) | 'down'(스쿼트 진행중) 2단계 히스테리시스 상태머신
let exMinAngleThisRep=null;
let exTorsoStandingAngle=null; // 이번 렙이 'up'이었을 때 마지막으로 측정된 허리(상체) 각도 — 사람마다 다른 기준 자세를 보정하기 위한 개인 기준선
let exMinTorsoAngleThisRep=null; // 이번 렙 동안 허리가 가장 많이 숙여졌을 때의 각도
let exMediaRecorder=null;
let exRecordedChunks=[];
// 정렬(ready) 단계 상태
let exAlignedSince=null;      // 모든 정렬 조건을 처음으로 만족한 시각(performance.now())
let exLastGuideSpeakTs=0;     // 마지막으로 안내 음성을 말한 시각(반복 스팸 방지)
let exFinalCountdownActive=false;

function exAngleAt(a,b,c){
  const v1x=a.x-b.x, v1y=a.y-b.y, v2x=c.x-b.x, v2y=c.y-b.y;
  const m1=Math.hypot(v1x,v1y), m2=Math.hypot(v2x,v2y);
  if(!m1||!m2) return null;
  let cos=(v1x*v2x+v1y*v2y)/(m1*m2);
  cos=Math.max(-1,Math.min(1,cos));
  return Math.acos(cos)*180/Math.PI;
}
function exKneeAngle(landmarks){
  const idx=CAL_KEYPOINT_IDX;
  const need=[idx.lhip,idx.rhip,idx.lknee,idx.rknee,idx.lank,idx.rank];
  if(need.some(i=>!landmarks[i] || (landmarks[i].visibility??1)<CAL_VIS_THRESHOLD)) return null;
  const l=exAngleAt(landmarks[idx.lhip],landmarks[idx.lknee],landmarks[idx.lank]);
  const r=exAngleAt(landmarks[idx.rhip],landmarks[idx.rknee],landmarks[idx.rank]);
  if(l==null && r==null) return null;
  if(l==null) return r;
  if(r==null) return l;
  return (l+r)/2;
}
// 허리(상체) 각도: 어깨-엉덩이-무릎 사이 각도로, 상체가 얼마나 앞으로 숙여졌는지의 근사치.
// 척추 굴곡 자체를 재는 건 아니지만(landmark가 어깨·엉덩이·무릎뿐이라), 렙 시작 시점(서있는
// 자세) 각도를 개인 기준선으로 잡고 거기서 얼마나 더 숙여졌는지를 보는 상대적 방식이라
// 사람마다 다른 체형·가동범위 차이는 어느 정도 상쇄된다.
function exTorsoAngle(landmarks){
  const idx=CAL_KEYPOINT_IDX;
  const need=[idx.lsh,idx.rsh,idx.lhip,idx.rhip,idx.lknee,idx.rknee];
  if(need.some(i=>!landmarks[i] || (landmarks[i].visibility??1)<CAL_VIS_THRESHOLD)) return null;
  const l=exAngleAt(landmarks[idx.lsh],landmarks[idx.lhip],landmarks[idx.lknee]);
  const r=exAngleAt(landmarks[idx.rsh],landmarks[idx.rhip],landmarks[idx.rknee]);
  if(l==null && r==null) return null;
  if(l==null) return r;
  if(r==null) return l;
  return (l+r)/2;
}
// 저장된 내 체형 캘리브레이션 실루엣을 캠 화면 위에 고정 오버레이해서 자리 잡을 때 맞춰 서는
// 기준으로 쓴다. 얇은 뼈대선(해골 모양)이라 잘 안 보인다는 피드백에 흰색 캡슐+원으로 채운
// 실루엣으로 바꿨었는데, 두께가 실제 체형보다 두꺼워 "뚱뚱해 보인다"는 피드백이 다시 있어
// 두께 배율을 슬림하게 낮추고, 회원가입 때 입력한 키·몸무게(BMI)로 두께를 보정한다.
function exDrawCalibrationGhost(ctx,w,h){
  const profile=state.user.calibration;
  if(!profile || !profile.landmarks) return;
  const pts=profile.landmarks;
  const shoulderPx = pts.lsh&&pts.rsh ? Math.hypot((pts.lsh.x-pts.rsh.x)*w,(pts.lsh.y-pts.rsh.y)*h) : Math.min(w,h)*0.22;
  const bi=profile.bodyInfo||{};
  const {widthFactor} = bodyShapeFactorsFromBmi(bi.bmi, bi.heightCm);
  const limbWidth = Math.max(10, shoulderPx*0.16*widthFactor);
  const headR = Math.max(14, shoulderPx*0.28*widthFactor);

  ctx.save();
  ctx.globalAlpha=0.55;
  ctx.fillStyle='#FFFFFF';
  ctx.strokeStyle='#FFFFFF';
  ctx.lineCap='round'; ctx.lineJoin='round';

  // 팔다리: 두꺼운 선(캡슐)으로 채워서 뭉실하게
  const limbBones=[['lsh','lelbow'],['lelbow','lwrist'],['rsh','relbow'],['relbow','rwrist'],
                    ['lhip','lknee'],['lknee','lank'],['rhip','rknee'],['rknee','rank']];
  ctx.lineWidth=limbWidth;
  limbBones.forEach(([a,b])=>{
    if(!pts[a]||!pts[b]) return;
    ctx.beginPath(); ctx.moveTo(pts[a].x*w, pts[a].y*h); ctx.lineTo(pts[b].x*w, pts[b].y*h); ctx.stroke();
  });

  // 몸통: 어깨-엉덩이 사각형을 채움
  if(pts.lsh&&pts.rsh&&pts.lhip&&pts.rhip){
    ctx.beginPath();
    ctx.moveTo(pts.lsh.x*w, pts.lsh.y*h);
    ctx.lineTo(pts.rsh.x*w, pts.rsh.y*h);
    ctx.lineTo(pts.rhip.x*w, pts.rhip.y*h);
    ctx.lineTo(pts.lhip.x*w, pts.lhip.y*h);
    ctx.closePath(); ctx.fill();
  }

  // 관절 부위를 원으로 채워 이음매를 매끄럽게 이어붙인다
  const jointR = limbWidth*0.5;
  ['lsh','rsh','lelbow','relbow','lwrist','rwrist','lhip','rhip','lknee','rknee','lank','rank'].forEach(key=>{
    const p=pts[key]; if(!p) return;
    ctx.beginPath(); ctx.arc(p.x*w, p.y*h, jointR, 0, Math.PI*2); ctx.fill();
  });

  // 머리: 눈사람 윗덩이처럼 큰 원 하나
  if(pts.nose){
    ctx.beginPath(); ctx.arc(pts.nose.x*w, pts.nose.y*h, headR, 0, Math.PI*2); ctx.fill();
  }

  ctx.restore();
}
// 촬영 시작 직후 'ready' 단계에서 매 프레임 호출: 튜토리얼 촬영 각도(카메라 12시, 몸 2시 방향)와
// 비슷한 조건으로 설 때까지 사람이 뭘 고쳐야 하는지 하나씩 안내한다. 우선순위대로 검사해서
// 가장 먼저 걸리는 문제 하나만 반환 — 한 번에 여러 지적을 쏟아내면 오히려 헷갈리기 때문.
function exCheckAlignment(landmarks){
  const idx=CAL_KEYPOINT_IDX;
  const need=[idx.nose,idx.lsh,idx.rsh,idx.lhip,idx.rhip,idx.lknee,idx.rknee,idx.lank,idx.rank];
  if(need.some(i=>!landmarks[i] || (landmarks[i].visibility??1)<CAL_VIS_THRESHOLD)){
    return {ok:false, msg:'화면에 머리부터 발끝까지 전신이 다 나오게 서주세요'};
  }
  const topY=landmarks[idx.nose].y;
  const botY=(landmarks[idx.lank].y+landmarks[idx.rank].y)/2;
  const bodyHeightRatio=botY-topY;
  if(bodyHeightRatio>CAL_DIST_MAX) return {ok:false, msg:'카메라에서 한 걸음 뒤로 물러나주세요'};
  if(bodyHeightRatio<CAL_DIST_MIN) return {ok:false, msg:'카메라 쪽으로 조금 더 다가와주세요'};

  const hipCenterX=(landmarks[idx.lhip].x+landmarks[idx.rhip].x)/2;
  if(Math.abs(hipCenterX-0.5)>CAL_CENTER_TOL) return {ok:false, msg:'화면 중앙으로 자리를 옮겨주세요'};

  // (2시 방향 회전 자동 체크는 뺐다 — 어깨너비 축소 비율만으로는 "왼쪽으로 돌았는지 오른쪽으로
  // 돌았는지"를 구분할 수 없어서, 반대 방향으로 서도 통과되는 문제가 있었다. 방향은 위쪽 안내
  // 문구로만 알려주고, 자동 판정은 거리·중앙·다리너비·허리자세만 본다.)
  const shoulderW=Math.hypot(landmarks[idx.lsh].x-landmarks[idx.rsh].x, landmarks[idx.lsh].y-landmarks[idx.rsh].y);
  const ankleDist=Math.hypot(landmarks[idx.lank].x-landmarks[idx.rank].x, landmarks[idx.lank].y-landmarks[idx.rank].y);
  if(ankleDist < shoulderW*0.7) return {ok:false, msg:'다리를 어깨너비로 벌려주세요'};

  const torsoAngle=exTorsoAngle(landmarks);
  if(torsoAngle!=null && torsoAngle<TORSO_STANDING_MIN_ANGLE) return {ok:false, msg:'허리를 곧게 펴고 서주세요'};

  return {ok:true, msg:'좋아요! 이 자세를 유지해주세요', torsoAngle};
}
const GRADE_VOICE_LINES = { PERFECT:'퍼펙트!', GREAT:'그레이트!', GOOD:'굿!' };
// 무릎 각도(깊이)와 허리(상체) 각도를 함께 본다. 허리가 기준보다 많이 숙여졌으면(부상 위험)
// 무릎 각도가 아무리 좋아도 안전을 우선해 MISS로 처리하고 교정 멘트를 준다.
function exGradeRep(bottomAngle, torsoDrop){
  if(torsoDrop!=null && torsoDrop>TORSO_LEAN_WARN_DEG){
    return {
      grade:'MISS', angle:Math.round(bottomAngle),
      reason:`허리가 서있을 때보다 ${Math.round(torsoDrop)}° 더 숙여짐(부상 위험, ${TORSO_LEAN_WARN_DEG}° 이내로 유지 필요)`,
      failedJoint:'torso', voice:'허리가 너무 숙여졌어요, 가슴을 펴주세요',
    };
  }
  const ref=SQUAT_REFERENCE;
  const diff=Math.abs(bottomAngle-ref.bottomKneeAngle);
  const angle=Math.round(bottomAngle);
  let grade = diff<=ref.perfectTol ? 'PERFECT' : diff<=ref.greatTol ? 'GREAT' : diff<=ref.goodTol ? 'GOOD' : 'MISS';
  if(grade!=='MISS') return {grade, angle, voice:GRADE_VOICE_LINES[grade]};
  const tooShallow = bottomAngle>ref.bottomKneeAngle; // 무릎이 목표보다 덜 굽혀짐(각도가 큼)
  const reason = tooShallow
    ? `무릎 각도 부족(${angle}°, 기준 ${Math.round(ref.bottomKneeAngle)}° 이하)`
    : `너무 깊게 앉음(${angle}°, 기준 ${Math.round(ref.bottomKneeAngle)}° 근처)`;
  const voice = tooShallow ? '무릎을 더 굽혀주세요' : '너무 깊이 앉았어요';
  return {grade, angle, reason, failedJoint:'knee', voice};
}
// 브라우저 내장 TTS로 판정 멘트를 읽어준다. 빠르게 연속 판정될 때 이전 멘트가 밀리지 않도록
// 새로 말하기 전에 진행 중인 발화를 취소한다.
function speakFeedback(text){
  if(!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const utter=new SpeechSynthesisUtterance(text);
  utter.lang='ko-KR';
  utter.rate=1.05;
  window.speechSynthesis.speak(utter);
}
function exFlashGrade(grade){
  const el=document.getElementById('cam-grade-flash');
  if(!el) return;
  el.textContent=grade;
  el.style.color=gradeColor(grade);
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(exFlashGrade._tid);
  exFlashGrade._tid=setTimeout(()=>el.classList.remove('show'),900);
}
// 한 렙(스쿼트 1회)이 끝났을 때: 판정하고 실시간 통계·플래시를 갱신한 뒤, 목표 횟수에
// 도달하면 촬영을 자동 종료한다.
function exRegisterRep(bottomAngle, torsoDrop){
  const result=exGradeRep(bottomAngle, torsoDrop);
  result.atSeconds=state.exercise.seconds; // 리플레이 화면에서 이 렙 순간의 촬영 영상 프레임을 다시 찾기 위한 타임스탬프
  state.exercise.liveReps.push(result);
  const rEl=document.getElementById('live-reps'); if(rEl) rEl.textContent=`${state.exercise.liveReps.length} / ${EXERCISE_REP_TARGET}`;
  const weight={PERFECT:100,GREAT:85,GOOD:70,MISS:0};
  const acc=Math.round(state.exercise.liveReps.reduce((s,r)=>s+weight[r.grade],0)/state.exercise.liveReps.length);
  const aEl=document.getElementById('live-acc'); if(aEl) aEl.textContent=acc+'%';
  exFlashGrade(result.grade);
  speakFeedback(result.voice);
  if(state.exercise.liveReps.length>=EXERCISE_REP_TARGET) toggleRecording();
}
async function exStartPoseLoop(){
  const canvas=document.getElementById('cam-canvas');
  const stage=document.getElementById('cam-stage');
  const video=document.getElementById('cam-video');
  if(!canvas || !stage || !video) return;
  function resize(){canvas.width=stage.clientWidth; canvas.height=stage.clientHeight;}
  resize();
  if(!exPoseLandmarker){
    const {PoseLandmarker, FilesetResolver} = await loadMediaPipe();
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    exPoseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions:{
        modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate:'GPU',
      },
      runningMode:'VIDEO', numPoses:1,
    });
  }
  exRepPhase='up'; exMinAngleThisRep=null; exLastVideoTime=-1;
  exTorsoStandingAngle=null; exMinTorsoAngleThisRep=null;
  const ctx=canvas.getContext('2d');
  function loop(){
    if(!document.getElementById('cam-canvas')) return; // 화면 이동 시 자연 종료
    exRAF=requestAnimationFrame(loop);
    if(video.readyState<2 || video.currentTime===exLastVideoTime) return;
    exLastVideoTime=video.currentTime;
    const res=exPoseLandmarker.detectForVideo(video, performance.now());
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // 자리 잡을 때(대기·정렬 단계)만 가이드 실루엣을 보여주고, 실제 측정이 시작되면(recording)
    // 화면을 가리지 않도록 치운다 — 이미 자리를 맞췄으니 더 필요 없다.
    if(state.exercise.camPhase!=='recording') exDrawCalibrationGhost(ctx, canvas.width, canvas.height);
    const landmarks=res.landmarks && res.landmarks[0];
    if(landmarks){
      ctx.strokeStyle='#6FBBEE'; ctx.lineWidth=3;
      CAL_CONNECTIONS.forEach(([a,b])=>{
        const pa=landmarks[a], pb=landmarks[b];
        if(!pa||!pb) return;
        ctx.beginPath(); ctx.moveTo(pa.x*canvas.width, pa.y*canvas.height); ctx.lineTo(pb.x*canvas.width, pb.y*canvas.height); ctx.stroke();
      });
      ctx.fillStyle='#6FBBEE';
      landmarks.forEach(p=>{
        if(p.visibility!==undefined && p.visibility<CAL_VIS_THRESHOLD) return;
        ctx.beginPath(); ctx.arc(p.x*canvas.width, p.y*canvas.height, 4, 0, Math.PI*2); ctx.fill();
      });

      if(state.exercise.camPhase==='recording'){
        const angle=exKneeAngle(landmarks);
        const torsoAngle=exTorsoAngle(landmarks);
        if(angle!=null){
          const standing=SQUAT_REFERENCE.standingKneeAngle;
          if(exRepPhase==='up'){
            if(torsoAngle!=null) exTorsoStandingAngle=torsoAngle; // 서있는 동안 계속 갱신 → 렙 시작 직전 값이 개인 기준선이 됨
            if(angle < standing-20){
              exRepPhase='down';
              exMinAngleThisRep=angle;
              exMinTorsoAngleThisRep=torsoAngle;
            }
          } else {
            if(angle<exMinAngleThisRep) exMinAngleThisRep=angle;
            if(torsoAngle!=null && (exMinTorsoAngleThisRep==null || torsoAngle<exMinTorsoAngleThisRep)) exMinTorsoAngleThisRep=torsoAngle;
            if(angle > standing-10){
              const torsoDrop = (exTorsoStandingAngle!=null && exMinTorsoAngleThisRep!=null)
                ? exTorsoStandingAngle-exMinTorsoAngleThisRep : null;
              exRegisterRep(exMinAngleThisRep, torsoDrop);
              exRepPhase='up'; exMinAngleThisRep=null; exMinTorsoAngleThisRep=null;
            }
          }
        }
      } else if(state.exercise.camPhase==='ready' && !exFinalCountdownActive){
        // 카운트다운이 이미 시작된 뒤엔 다시 검사·안내하지 않는다 — 안 그러면 "5,4,3..." 발화 중간에
        // 미세한 흔들림 때문에 교정 멘트가 끼어들어 카운트다운이 끊길 수 있다.
        const result=exCheckAlignment(landmarks);
        const msgEl=document.getElementById('cam-ready-msg');
        if(result.ok){
          if(msgEl) msgEl.textContent=result.msg;
          if(exAlignedSince==null) exAlignedSince=performance.now();
          if(!exFinalCountdownActive && performance.now()-exAlignedSince>=CAM_ALIGN_HOLD_MS){
            exFinalCountdownActive=true;
            startFinalCountdown();
          }
        } else {
          exAlignedSince=null;
          if(msgEl) msgEl.textContent=result.msg;
          const now=performance.now();
          if(now-exLastGuideSpeakTs>CAM_GUIDE_SPEAK_INTERVAL_MS){
            exLastGuideSpeakTs=now;
            speakFeedback(result.msg);
          }
        }
      }
    }
  }
  loop();
}

// "촬영 시작"을 눌러도 곧바로 판정하지 않는다. exStartPoseLoop의 'ready' 분기(exCheckAlignment)가
// 매 프레임 거리·중앙정렬·방향(2시)·다리너비·허리자세를 확인하면서 음성으로 안내하고, 그 조건이
// CAM_ALIGN_HOLD_MS 이상 계속 유지되면 startFinalCountdown()이 5초 음성 카운트다운을 한 뒤
// beginRecording()으로 넘어간다. (준비 안 된 상태에서 바로 판정을 시작하면 첫 렙이 무조건
// MISS로 잘못 찍히는 문제 때문에 추가)
function toggleRecording(){
  const isSquat = state.exercise.picked==='squat';
  if(state.exercise.camPhase==='idle'){
    if(isSquat) startAlignmentGuide();
    else beginRecording();
    return;
  }
  if(state.exercise.camPhase!=='recording') return; // 'ready' 중엔 버튼이 비활성화돼 있어 여기 안 옴
  stopRecording();
}
function startAlignmentGuide(){
  const btn=document.getElementById('cam-toggle');
  const statusEl=document.getElementById('cam-status');
  const overlay=document.getElementById('cam-ready-overlay');
  const countEl=document.getElementById('cam-ready-count');
  const msgEl=document.getElementById('cam-ready-msg');
  state.exercise.camPhase='ready';
  exAlignedSince=null; exLastGuideSpeakTs=0; exFinalCountdownActive=false;
  if(btn){ btn.disabled=true; btn.textContent='준비중...'; btn.style.opacity='.5'; btn.style.cursor='not-allowed'; }
  if(statusEl) statusEl.textContent='준비중';
  if(overlay) overlay.classList.add('show');
  if(countEl) countEl.textContent='';
  if(msgEl) msgEl.textContent='화면 속 스켈레톤에 맞춰 자리를 잡아주세요';
  speakFeedback('카메라 각도와 거리에 맞춰 자리를 잡아주세요');
}
// 정렬이 완료된 뒤 호출: "5,4,3,2,1,시작!"을 화면·음성으로 동시에 보여주고 beginRecording()으로
// 넘어간다. 아라비아 숫자를 그대로 읽히면 TTS 엔진에 따라 발음이 흔들릴 수 있어 한글 숫자로 읽는다.
const CAM_COUNTDOWN_WORDS = ['오','사','삼','이','일'];
function startFinalCountdown(){
  const msgEl=document.getElementById('cam-ready-msg');
  if(msgEl) msgEl.textContent='자세가 완벽해요! 이대로 유지해주세요';
  let left=CAM_FINAL_COUNTDOWN_SECONDS;
  const tick=()=>{
    if(!document.getElementById('cam-ready-overlay')) return; // 화면 이동 시 자연 종료
    const countEl=document.getElementById('cam-ready-count');
    if(left>0){
      if(countEl) countEl.textContent=left;
      speakFeedback(CAM_COUNTDOWN_WORDS[CAM_FINAL_COUNTDOWN_SECONDS-left] || String(left));
      left--;
      setTimeout(tick,1000);
    } else {
      if(countEl) countEl.textContent='START!';
      speakFeedback('시작!');
      const overlay=document.getElementById('cam-ready-overlay'); if(overlay) overlay.classList.remove('show');
      const btn=document.getElementById('cam-toggle');
      if(btn){ btn.disabled=false; btn.style.opacity='1'; btn.style.cursor='pointer'; }
      beginRecording();
    }
  };
  tick();
}
function beginRecording(){
  const btn=document.getElementById('cam-toggle');
  const statusEl=document.getElementById('cam-status');
  const timerEl=document.getElementById('cam-timer');
  const isSquat = state.exercise.picked==='squat';
  state.exercise.camPhase='recording';
  state.exercise.seconds=0;
  state.exercise.liveReps=[];
  exRepPhase='up'; exMinAngleThisRep=null; exTorsoStandingAngle=null; exMinTorsoAngleThisRep=null; // 준비 시간 동안 잘못 쌓였을 수 있는 렙 상태 초기화
  if(btn) btn.textContent='촬영 종료';
  if(statusEl) statusEl.textContent='촬영중';
  let reps=0, accBase=82;
  if(isSquat && state.exercise.camStream && window.MediaRecorder){
    exRecordedChunks=[];
    try{
      exMediaRecorder=new MediaRecorder(state.exercise.camStream);
      exMediaRecorder.ondataavailable=e=>{ if(e.data && e.data.size>0) exRecordedChunks.push(e.data); };
      exMediaRecorder.start();
    }catch(err){ console.error('MediaRecorder 시작 실패', err); exMediaRecorder=null; }
  }
  clearInterval(state.exercise.timerId);
  state.exercise.timerId=setInterval(()=>{
    state.exercise.seconds++;
    const m=String(Math.floor(state.exercise.seconds/60)).padStart(2,'0');
    const s=String(state.exercise.seconds%60).padStart(2,'0');
    if(timerEl) timerEl.textContent=`${m}:${s}`;
    if(!isSquat && state.exercise.seconds%3===0){
      reps++;
      const rEl=document.getElementById('live-reps'); if(rEl) rEl.textContent=reps;
      const acc=Math.min(99, accBase + Math.round(Math.random()*14-4));
      const aEl=document.getElementById('live-acc'); if(aEl) aEl.textContent=acc+'%';
    }
  },1000);
}
function stopRecording(){
  const isSquat = state.exercise.picked==='squat';
  clearInterval(state.exercise.timerId);
  const finish=()=>{
    state.exercise.camPhase='idle';
    if(state.exercise.camStream){state.exercise.camStream.getTracks().forEach(t=>t.stop()); state.exercise.camStream=null;}
    generateResult();
    goExStep(3);
  };
  if(isSquat && exMediaRecorder && exMediaRecorder.state!=='inactive'){
    exMediaRecorder.onstop=()=>{
      if(state.exercise.result && state.exercise.result.myVideoUrl) URL.revokeObjectURL(state.exercise.result.myVideoUrl);
      state.exercise._pendingVideoUrl = exRecordedChunks.length ? URL.createObjectURL(new Blob(exRecordedChunks,{type:'video/webm'})) : null;
      finish();
    };
    exMediaRecorder.stop();
  } else {
    finish();
  }
}
function generateResult(){
  if(state.exercise.picked==='squat' && state.exercise.liveReps.length>0){
    const reps=state.exercise.liveReps.map((r,i)=>({idx:i+1, grade:r.grade, angle:r.angle, atSeconds:r.atSeconds, failedJoint:r.failedJoint||null}));
    const missCount=reps.filter(r=>r.grade==='MISS').length;
    const total=reps.length;
    const valid=total-missCount;
    const weight={PERFECT:100,GREAT:85,GOOD:70,MISS:0};
    const acc=Math.round(reps.reduce((s,r)=>s+weight[r.grade],0)/total);
    const score=valid*10 + acc*3;
    const dur=Math.max(state.exercise.seconds,1);
    const ex=EXS.find(e=>e.id==='squat');
    // 리플레이 비교에 쓸 렙 하나를 고른다: 문제가 있었던 렙(MISS)을 우선하고, 없으면 첫 렙으로.
    const compareRep = reps.find(r=>r.grade==='MISS') || reps[0] || null;
    state.exercise.result={ex:ex.name, dur, total, valid, missCount, acc, score, reps, compareRep, myVideoUrl: state.exercise._pendingVideoUrl||null};
    state.exercise._pendingVideoUrl=null;
    return;
  }
  const dur=Math.max(state.exercise.seconds,9);
  const total=Math.max(6, Math.round(dur/3));
  const reps=[];
  let missCount=0;
  for(let i=0;i<total;i++){
    const roll=Math.random();
    let grade, angle;
    if(roll<0.06){grade='MISS'; angle=Math.round(60+Math.random()*15); missCount++;}
    else if(roll<0.4){grade='PERFECT'; angle=Math.round(88+Math.random()*6);}
    else if(roll<0.75){grade='GREAT'; angle=Math.round(80+Math.random()*8);}
    else {grade='GOOD'; angle=Math.round(72+Math.random()*8);}
    reps.push({idx:i+1,grade,angle});
  }
  const valid=total-missCount;
  const acc=Math.round((reps.reduce((s,r)=>s+(r.grade==='PERFECT'?100:r.grade==='GREAT'?85:r.grade==='GOOD'?70:0),0))/total);
  const score=valid*10 + acc*3;
  const ex=EXS.find(e=>e.id===state.exercise.picked)||EXS[0];
  state.exercise.result={ex:ex.name, dur, total, valid, missCount, acc, score, reps};
}

/* ---------- 리플레이 화면: 내 영상 vs 레퍼런스 정자세 스켈레톤 비교 ---------- */
let exImageLandmarker=null; // 정지 프레임 1장씩 분석하는 용도(IMAGE 모드) — 실시간 루프의 VIDEO 모드 인스턴스와 별개
async function loadImageLandmarker(){
  if(exImageLandmarker) return exImageLandmarker;
  const {PoseLandmarker, FilesetResolver} = await loadMediaPipe();
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  exImageLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions:{
      modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate:'GPU',
    },
    runningMode:'IMAGE', numPoses:1,
  });
  return exImageLandmarker;
}
// 판정에서 문제가 된 관절(무릎/허리) 쪽 뼈대만 빨갛게, 나머지는 기본색으로 그린다.
const REP_HIGHLIGHT_BONES = {
  knee: [[23,25],[25,27],[24,26],[26,28]],
  torso: [[11,23],[12,24]],
};
function replayDrawSkeleton(ctx, w, h, landmarks, highlightBones){
  const highlightSet=new Set((highlightBones||[]).map(b=>b.join('-')));
  ctx.lineCap='round';
  CAL_CONNECTIONS.forEach(([a,b])=>{
    const pa=landmarks[a], pb=landmarks[b];
    if(!pa||!pb) return;
    const isBad=highlightSet.has(a+'-'+b)||highlightSet.has(b+'-'+a);
    ctx.strokeStyle=isBad?'#E5645A':'#6FBBEE';
    ctx.lineWidth=isBad?5:3;
    ctx.beginPath(); ctx.moveTo(pa.x*w,pa.y*h); ctx.lineTo(pb.x*w,pb.y*h); ctx.stroke();
  });
  ctx.fillStyle='#fff';
  landmarks.forEach(p=>{
    if(p.visibility!==undefined && p.visibility<CAL_VIS_THRESHOLD) return;
    ctx.beginPath(); ctx.arc(p.x*w,p.y*h,4,0,Math.PI*2); ctx.fill();
  });
}
// 내 영상 쪽 실시간 추적용 인스턴스(VIDEO 모드) — exPoseLandmarker(실시간 촬영용)와는 별개 인스턴스.
let replayMyLandmarker=null;
let replayRAF=null;
let replayLastVideoTime=-1;
async function loadReplayVideoLandmarker(){
  if(replayMyLandmarker) return replayMyLandmarker;
  const {PoseLandmarker, FilesetResolver} = await loadMediaPipe();
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  replayMyLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions:{
      modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate:'GPU',
    },
    runningMode:'VIDEO', numPoses:1,
  });
  return replayMyLandmarker;
}
// 촬영이 끝나고 리플레이 화면에 들어오면: 내 촬영 영상은 재생되는 동안(또는 스크럽할 때마다)
// 계속 스켈레톤이 프레임을 따라가도록 매 프레임 추적한다(레퍼런스 GIF 쪽은 스켈레톤 없이
// 원본만 보여준다). 문제가 있었던 렙 시점 근처(±0.4초)에서는 걸렸던 관절(무릎/허리)만
// 빨간 선으로 표시한다.
async function setupReplayComparison(){
  const r=state.exercise.result;
  if(!r || !r.myVideoUrl) return;
  cancelAnimationFrame(replayRAF);

  const video=document.getElementById('replay-my-video');
  const myCanvas=document.getElementById('replay-my-canvas');
  const myStatus=document.getElementById('replay-my-status');
  if(video && myCanvas){
    let landmarker;
    try{ landmarker=await loadReplayVideoLandmarker(); }catch(err){ console.error('리플레이 자세 분석 로딩 실패', err); return; }
    if(!document.getElementById('replay-my-canvas')) return; // 로딩 중 화면 이동했을 수 있음
    replayLastVideoTime=-1;
    const resizeMy=()=>{ myCanvas.width=video.videoWidth||myCanvas.clientWidth; myCanvas.height=video.videoHeight||myCanvas.clientHeight; };
    resizeMy();
    video.addEventListener('loadedmetadata', resizeMy);

    function loopMy(){
      if(!document.getElementById('replay-my-canvas')) return; // 화면 이동 시 자연 종료
      replayRAF=requestAnimationFrame(loopMy);
      if(video.readyState<2 || video.currentTime===replayLastVideoTime) return;
      replayLastVideoTime=video.currentTime;
      const res=landmarker.detectForVideo(video, performance.now());
      const ctx=myCanvas.getContext('2d');
      ctx.clearRect(0,0,myCanvas.width,myCanvas.height);
      const landmarks=res.landmarks && res.landmarks[0];
      if(!landmarks){ if(myStatus) myStatus.textContent='자세가 인식되지 않는 구간이에요'; return; }
      const nearRep = r.compareRep && Math.abs(video.currentTime-(r.compareRep.atSeconds||0))<0.4;
      const highlight = (nearRep && r.compareRep.failedJoint) ? (REP_HIGHLIGHT_BONES[r.compareRep.failedJoint]||[]) : [];
      replayDrawSkeleton(ctx, myCanvas.width, myCanvas.height, landmarks, highlight);
      if(myStatus){
        myStatus.textContent = nearRep
          ? (r.compareRep.failedJoint
              ? `#${r.compareRep.idx}번 자세 · ${r.compareRep.grade} — 빨간 선이 기준과 어긋난 관절이에요`
              : `#${r.compareRep.idx}번 자세 · ${r.compareRep.grade} — 기준과 잘 맞았어요`)
          : '영상을 재생하면 스켈레톤이 계속 따라갑니다';
      }
    }
    loopMy();
    if(r.compareRep){ // 처음 들어왔을 때 문제 됐던 지점으로 자동으로 이동해서 보여준다
      const seekTo=Math.max(0, (r.compareRep.atSeconds||0)-0.15);
      try{ video.currentTime=video.duration ? Math.min(seekTo, video.duration) : seekTo; }catch(e){}
    }
  }

  // 레퍼런스 쪽은 스켈레톤 오버레이 없이 GIF 원본만 보여준다 — "정답"인 원본 영상 그대로 보는 게
  // 더 명확하다는 피드백에 따라 뺐다. (내 촬영 영상 쪽만 스켈레톤/빨간 표시로 비교해준다.)
}

function renderExStepReplay(){
  const r=state.exercise.result;
  if(!r) return `<div class="empty-note">촬영 데이터가 없습니다.</div>`;
  return `
  ${r.myVideoUrl ? `
  <div class="grid grid-2" style="margin-bottom:8px;">
    <div>
      <p class="section-label">레퍼런스 정자세</p>
      <div class="cam-stage" style="aspect-ratio:1/1;">
        <img src="Bodyweight_Squats.gif" alt="레퍼런스 스쿼트" style="width:100%;height:100%;object-fit:cover;">
      </div>
    </div>
    <div>
      <p class="section-label">내 촬영 영상</p>
      <div class="cam-stage" style="aspect-ratio:1/1;">
        <video id="replay-my-video" src="${r.myVideoUrl}" controls style="width:100%;height:100%;object-fit:cover;"></video>
        <canvas id="replay-my-canvas" class="cam-overlay-canvas" style="pointer-events:none;"></canvas>
      </div>
      <p class="hint" id="replay-my-status" style="margin-top:6px;">자세 비교 분석 중...</p>
    </div>
  </div>
  <p class="hint" style="margin-bottom:20px;">빨간 선으로 표시된 관절이 기준과 어긋난 부분이에요. 영상을 재생하면 그 시점 스켈레톤은 사라지니, 다시 보려면 새로고침해주세요.</p>` : ''}
  <div class="grid grid-2">
    <div class="card">
      <p class="section-label">${r.ex} · 리플레이 분석 결과</p>
      <div class="stat-row">
        <div class="stat-box"><div class="num mono">${r.total}</div><div class="lbl">총 횟수</div></div>
        <div class="stat-box"><div class="num mono" style="color:var(--accent)">${r.valid}</div><div class="lbl">유효 횟수</div></div>
        <div class="stat-box"><div class="num mono" style="color:var(--danger)">${r.missCount}</div><div class="lbl">MISS</div></div>
        <div class="stat-box"><div class="num mono">${r.acc}%</div><div class="lbl">정확도</div></div>
      </div>
      <p class="section-label">관절 각도 오차 구간</p>
      <div class="progress" style="height:14px;margin-bottom:6px;">
        <span style="width:${r.acc}%;background:${r.acc>85?'var(--accent)':r.acc>70?'var(--gold)':'var(--danger)'}"></span>
      </div>
      <p class="desc">촬영 시간 ${Math.floor(r.dur/60)}분 ${r.dur%60}초 · 평균 정확도 ${r.acc}%</p>
    </div>
    <div class="card">
      <p class="section-label">반복별 판정 (${r.reps.length}회)</p>
      <div class="rep-list">
        ${r.reps.map(rp=>`
          <div class="rep-row">
            <span class="idx">#${rp.idx}</span>
            ${gradePill(rp.grade)}
            <div class="bar-track"><span style="width:${rp.angle}%;background:${gradeColor(rp.grade)}"></span></div>
            <span class="angle">${rp.angle}°</span>
          </div>`).join('')}
      </div>
    </div>
  </div>
  <div style="margin-top:20px;display:flex;gap:8px;align-items:center;">
    ${renderRetakeButton()}
    <button class="btn btn-primary" onclick="goExStep(4)">결과 저장하기</button>
  </div>`;
}
const FREE_RETAKES = 2;
function renderRetakeButton(){
  const freeLeft = state.exercise.retakesUsed < FREE_RETAKES;
  const freeRemain = FREE_RETAKES - state.exercise.retakesUsed;
  const tickets = state.user.retakeTickets||0;
  const canRetake = freeLeft || tickets>0;
  const label = freeLeft ? `다시 촬영 (무료 ${freeRemain}회 남음)` : (tickets>0 ? `다시 촬영 (티켓 사용 · 보유 ${tickets}장)` : '다시 촬영 (티켓 필요)');
  return `<button class="btn btn-ghost" ${canRetake?'':'disabled style="opacity:.5;cursor:not-allowed;"'} onclick="retakeExercise()">${label}</button>`;
}
function retakeExercise(){
  const ex = state.exercise;
  if(ex.retakesUsed < FREE_RETAKES){
    ex.retakesUsed++;
    toast(`무료 재촬영을 사용합니다 (남은 무료 횟수 ${FREE_RETAKES-ex.retakesUsed}회)`);
  } else if(state.user.retakeTickets>0){
    state.user.retakeTickets--;
    ex.retakesUsed++;
    toast(`다시찍기 티켓을 사용합니다 (남은 티켓 ${state.user.retakeTickets}장)`);
  } else {
    toast('무료 재촬영을 모두 사용했습니다. 포인트 상점에서 다시찍기 티켓을 구매해주세요');
    return;
  }
  if(ex.result && ex.result.myVideoUrl) URL.revokeObjectURL(ex.result.myVideoUrl);
  ex.result = null;
  ex.liveReps = [];
  goExStep(2);
}

function renderExStepSave(){
  const r=state.exercise.result;
  if(!r) return `<div class="empty-note">저장할 결과가 없습니다.</div>`;
  return `
  <div class="card" style="max-width:520px;">
    <p class="section-label">획득 요약</p>
    <h3 style="font-size:20px;">${r.ex} 세션 완료 ${gradePill(r.acc>90?'PERFECT':r.acc>78?'GREAT':r.acc>60?'GOOD':'MISS')}</h3>
    <div class="stat-row">
      <div class="stat-box"><div class="num mono" style="color:var(--gold)">+${r.score}</div><div class="lbl">획득 점수</div></div>
      <div class="stat-box"><div class="num mono" style="color:var(--gold)">+${Math.round(r.score*0.4)}</div><div class="lbl">포인트</div></div>
      <div class="stat-box"><div class="num mono">${r.acc}%</div><div class="lbl">정확도</div></div>
    </div>
    <button class="btn btn-primary btn-block" onclick="saveExerciseResult()">기록 저장</button>
  </div>`;
}
// [백엔드 연동 필요 구간] saveExerciseResult() — 위 섹션 헤더 주석의 파이프라인이
// 실제로 이어지는 지점입니다.
function saveExerciseResult(){
  const r=state.exercise.result;
  const pts=Math.round(r.score*0.4);
  state.user.points += pts;
  const gc={PERFECT:0,GREAT:0,GOOD:0,MISS:0};
  r.reps.forEach(rp=>gc[rp.grade]++);
  state.history.unshift({date:'오늘', ex:r.ex, reps:r.valid, acc:r.acc, score:r.score, grade:r.acc>90?'PERFECT':r.acc>78?'GREAT':r.acc>60?'GOOD':'MISS', gc});
  // 일간/주간/월간 미션이 공유하는 누적 카운터 갱신 (스쿼트 세션 기준)
  if(r.ex==='스쿼트'){
    const c=state.missions.counters;
    c.reps += r.valid;
    c.perfect += gc.PERFECT;
    c.sessions += 1;
    if(gc.MISS===0) c.missFreeSession += 1;
    if(r.acc>=90) c.accSession += 1;
  }
  toast(`저장 완료! +${pts}P 획득`);
  if(r.myVideoUrl) URL.revokeObjectURL(r.myVideoUrl);
  state.exercise={step:0, picked:null, camPhase:'idle', camStream:null, timerId:null, seconds:0, result:null, retakesUsed:0, liveReps:[]};
  render();
}

/* ========================================================================
   2. 미션·포인트
   ======================================================================== */
// (FR-MS-001) claimMission()에서 보상을 지급하는 지점부터 서버 연동이 필요합니다.
//   세션 저장(saveExerciseResult) > Java 미션 API > DB 연결 > SQL UPDATE(미션 진행 카운터)
//   보상 수령(claimMission) > Java 미션 API > DB 연결 > SQL UPDATE(포인트 잔액, 수령 여부)
function renderMission(){
  return `
  <div class="view-head"><h1>미션</h1><p>일간/주간/월간 미션 선택 → 스쿼트로 달성하고 포인트를 모아보세요</p></div>
  ${renderMissionPick()}`;
}
const PROFILE_TABS=['프로필·캐릭터 꾸미기','미션 달성 현황','운동 히스토리','계정·프로필 관리','캘리브레이션 재설정','카메라·알림 설정','개인정보·공개범위','로그아웃·회원탈퇴'];
function renderProfile(){
  const i=state.subtabs.profile;
  return `
  <div class="view-head"><h1>마이페이지</h1><p>캐릭터 꾸미기·미션·운동 기록부터 계정·설정 관리까지 한 곳에서 확인하세요.</p></div>
  <div class="subtabs">
    ${PROFILE_TABS.map((t,idx)=>`<div class="tab ${i===idx?'active':''}" onclick="setSub('profile',${idx})">${t}</div>`).join('')}
  </div>
  ${i===0?renderMissionAvatar():
    i===1?renderMissionProgress():
    i===2?renderHistory():
    i===3?renderSetAccount():
    i===4?renderSetCalib():
    i===5?renderSetCamera():
    i===6?renderSetPrivacy():
    renderSetLogout()}`;
}
function renderShop(){
  return `
  <div class="view-head"><h1>포인트 상점</h1><p>포인트로 아이템을 구매해 캐릭터에 착용하거나 능력치를 얻어보세요</p></div>
  ${renderMissionShop()}`;
}
function setSub(key,idx){state.subtabs[key]=idx; render();}

const MISSION_PERIOD_LABEL={daily:'일간',weekly:'주간',monthly:'월간'};
function renderMissionPick(){
  const p=state.missions.period;
  const list=state.missions.list[p];
  return `
  <div class="filter-bar">
    ${['daily','weekly','monthly'].map(k=>`
      <button class="btn ${p===k?'btn-primary':'btn-secondary'} btn-sm" onclick="setMissionPeriod('${k}')">${MISSION_PERIOD_LABEL[k]} 미션 (${state.missions.list[k].length}개)</button>`).join('')}
  </div>
  <div class="grid grid-2" style="margin-top:14px;">
    ${list.map(m=>renderMissionCard(m)).join('')}
  </div>`;
}
function setMissionPeriod(k){state.missions.period=k; render();}
// 미션 카드 하나: 달성 전엔 "미션하러가기"로 바로 스쿼트 촬영으로 보내고, 달성했으면 보상 받기
// 버튼으로 바뀐다. 진행도는 퍼센트가 아니라 실제 개수(cur/target)로 보여준다.
function renderMissionCard(m){
  const cur=Math.min(state.missions.counters[m.metric]||0, m.target);
  const done=cur>=m.target;
  const claimed=!!state.missions.claimed[m.id];
  return `
  <div class="card">
    <div class="flex-between"><span class="pill pill-muted">${MISSION_PERIOD_LABEL[m.period]}</span><span class="pill ${done?'pill-accent':'pill-muted'}">${claimed?'수령완료':done?'달성':'진행중'}</span></div>
    <h3 style="margin-top:8px;">${m.label}</h3>
    <div class="progress" style="margin:10px 0;"><span style="width:${Math.min(100,cur/m.target*100)}%"></span></div>
    <div class="flex-between">
      <p class="desc mono" style="margin:0;">${cur}/${m.target} <span style="color:var(--gold);font-weight:700;">· +${m.reward}P</span></p>
      ${done
        ? `<button class="btn btn-sm ${claimed?'btn-ghost':'btn-primary'}" ${claimed?'disabled style="opacity:.4;cursor:not-allowed;"':''} onclick="claimMission('${m.id}')">${claimed?'수령완료':'보상 받기'}</button>`
        : `<button class="btn btn-sm btn-secondary" onclick="goToMissionExercise()">미션하러가기</button>`}
    </div>
  </div>`;
}
// 모든 기간의 미션을 하나의 배열로 합쳐서 조회할 때 쓴다(미션 달성 현황 탭, 튜토리얼 옆 리스트 등).
function allMissions(){
  return [...state.missions.list.daily, ...state.missions.list.weekly, ...state.missions.list.monthly];
}
function goToMissionExercise(){
  state.menu='exercise';
  state.exercise.picked='squat';
  state.exercise.step=0;
  goToTutorial();
}
function renderMissionProgress(){
  return `
  <div class="grid grid-2">
    ${allMissions().map(m=>renderMissionCard(m)).join('')}
  </div>`;
}
function claimMission(id){
  if(state.missions.claimed[id]) return;
  const m=allMissions().find(x=>x.id===id);
  if(!m) return;
  const cur=state.missions.counters[m.metric]||0;
  if(cur<m.target) return;
  state.missions.claimed[id]=true;
  state.user.points += m.reward;
  toast(`'${m.label}' 보상으로 +${m.reward}P 받았습니다`);
  render();
}
const EXP_PER_LEVEL=1000;
function getProfileStats(){
  const gc={PERFECT:0,GREAT:0,GOOD:0,MISS:0};
  state.history.forEach(h=>{ if(h.gc) Object.keys(gc).forEach(k=>gc[k]+=h.gc[k]||0); });
  const gcTotal=Object.values(gc).reduce((a,b)=>a+b,0)||1;
  const exCounts={};
  state.history.forEach(h=>{ exCounts[h.ex]=(exCounts[h.ex]||0)+h.reps; });
  const activeEffects=state.shopItems
    .filter(it=>it.slot && it.owned && it.equipped && !it.effect.startsWith('능력치 없음'))
    .map(it=>`${it.name} · ${it.effect}`);
  return {
    total: totalScore(),
    expToNext: Math.round((100-state.user.exp)/100*EXP_PER_LEVEL),
    myRank: getRegionRanking(state.user.region.trim().split(/\s+/).pop()).find(r=>r.isMe).rank,
    perfectPct: Math.round(gc.PERFECT/gcTotal*100),
    greatPct: Math.round(gc.GREAT/gcTotal*100),
    missPct: Math.round(gc.MISS/gcTotal*100),
    exCounts: Object.entries(exCounts),
    activeEffects,
  };
}
// (FR-PF-001~003) renderMissionAvatar: 캐릭터·아이템 꾸미기 화면. 그리기 자체(drawPixelCharacter)는
// 캔버스로 그리는 순수 프론트엔드 로직이고, "저장이 필요한 동작"만 아래 두 함수에서 이어집니다.
//   자기소개 저장(saveProfileBio) > Java 프로필 API > DB 연결 > SQL UPDATE(계정 테이블 bio 컬럼)
//   아이템 착용/해제(toggleEquip) > Java 프로필 API > DB 연결 > SQL UPDATE(보유 아이템 테이블 equipped 여부)
function renderCosmeticCard(it){
  const idx = state.shopItems.indexOf(it);
  return `
  <div style="border:1px solid var(--line);border-radius:10px;padding:12px;">
    <img src="${itemIconDataURL(it.name)}" style="width:48px;height:48px;image-rendering:pixelated;border-radius:6px;display:block;margin:0 auto 8px;">
    <div class="flex-between"><b style="font-size:12.5px;">${it.name}</b>
      ${it.owned?(it.equipped?'<span class="pill pill-accent">착용중</span>':'<span class="pill pill-muted">보유</span>'):'<span class="pill pill-gold">'+it.price+'P</span>'}
    </div>
    <span class="pill ${it.effect.startsWith('능력치 없음')?'pill-muted':'pill-accent'}" style="margin-top:6px;">효과 · ${it.effect}</span>
    <p class="desc" style="margin-top:6px;font-size:11.5px;">${it.effectDesc}</p>
    <button class="btn btn-sm ${it.owned?'btn-ghost':'btn-secondary'}" style="margin-top:8px;width:100%;" onclick="${it.owned?`toggleEquip(${idx})`:`goToShopFor(${idx})`}">${it.owned?(it.equipped?'착용 해제':'착용하기'):'상점에서 구매'}</button>
  </div>`;
}
function goToShopFor(idx){
  setMenu('shop');
  toast(`${state.shopItems[idx].name}은(는) 포인트 상점에서 구매할 수 있어요`);
}
function renderMissionAvatar(){
  const cosmetics = state.shopItems.filter(it=>it.slot);
  const nickColor = getEquipState().nickname ? 'var(--gold)' : 'inherit';
  const stats = getProfileStats();
  return `
  <div class="grid grid-2">
    <div class="card" style="text-align:center;">
      <p class="section-label">내 캐릭터</p>
      <canvas id="avatar-char-canvas" style="width:144px;height:176px;margin:10px auto;display:block;border-radius:10px;image-rendering:pixelated;"></canvas>
      <h3 style="color:${nickColor};">${state.user.nickname || '홈트초보'}</h3>
      <span class="pill pill-gold">Lv.${state.user.level}</span>
      <div class="field" style="margin-top:14px;text-align:left;">
        <label for="profile-bio-input">자기소개</label>
        <textarea id="profile-bio-input" rows="3" maxlength="80" placeholder="나를 소개하는 한마디를 남겨보세요">${state.user.bio||''}</textarea>
        <button class="btn btn-sm btn-secondary" style="margin-top:6px;width:100%;" onclick="saveProfileBio()">자기소개 저장</button>
      </div>
      <div style="text-align:left;margin-top:18px;">
        <p class="section-label">누적 성과</p>
        <div class="stat-row">
          <div class="stat-box"><div class="num mono">${stats.total.toLocaleString()}</div><div class="lbl">누적 점수</div></div>
          <div class="stat-box"><div class="num mono">#${stats.myRank}</div><div class="lbl">동네 랭킹</div></div>
          <div class="stat-box"><div class="num mono">${stats.expToNext.toLocaleString()}</div><div class="lbl">레벨업까지 남은 점수</div></div>
        </div>
        <div class="progress" style="margin-top:12px;"><span style="width:${state.user.exp}%"></span></div>
        <p class="hint" style="margin-top:4px;">Lv.${state.user.level} 진행도 ${state.user.exp}%</p>
        <p class="section-label" style="margin-top:16px;">등급 비율 (전체 세션 기준)</p>
        <div class="stat-row">
          <div class="stat-box"><div class="num mono" style="color:var(--accent)">${stats.perfectPct}%</div><div class="lbl">PERFECT</div></div>
          <div class="stat-box"><div class="num mono" style="color:var(--gold)">${stats.greatPct}%</div><div class="lbl">GREAT</div></div>
          <div class="stat-box"><div class="num mono" style="color:var(--danger)">${stats.missPct}%</div><div class="lbl">MISS</div></div>
        </div>
        <p class="section-label" style="margin-top:16px;">운동 종류별 누적 횟수</p>
        ${stats.exCounts.length ? stats.exCounts.map(([ex,cnt])=>`
          <div class="rep-row" style="justify-content:space-between;"><span>${ex}</span><span class="mono">${cnt}회</span></div>
        `).join('') : '<div class="empty-note">아직 기록이 없습니다.</div>'}
        <p class="section-label" style="margin-top:16px;">장착 아이템 보정 효과</p>
        ${stats.activeEffects.length ? stats.activeEffects.map(e=>`<span class="pill pill-accent" style="margin:0 6px 6px 0;display:inline-block;">${e}</span>`).join('') : '<p class="hint">착용 중인 능력치 아이템이 없습니다.</p>'}
      </div>
    </div>
    <div class="card">
      <p class="section-label">보유 아이템</p>
      <div class="grid" style="grid-template-columns:repeat(2,1fr);">
        ${cosmetics.filter(it=>it.owned).map(it=>renderCosmeticCard(it)).join('') || '<p class="empty-note" style="grid-column:1/-1;">아직 보유한 꾸미기 아이템이 없어요.</p>'}
      </div>
      <p class="section-label" style="margin-top:18px;">미보유 아이템</p>
      <div class="grid" style="grid-template-columns:repeat(2,1fr);">
        ${cosmetics.filter(it=>!it.owned).map(it=>renderCosmeticCard(it)).join('') || '<p class="empty-note" style="grid-column:1/-1;">모든 아이템을 보유하고 있어요!</p>'}
      </div>
      <p class="hint" style="margin-top:14px;">보유 아이템을 착용/해제하면 캐릭터에 바로 반영됩니다.</p>
    </div>
  </div>`;
}
function saveProfileBio(){
  const el=document.getElementById('profile-bio-input');
  if(!el) return;
  state.user.bio=el.value.trim();
  toast('자기소개를 저장했습니다');
  render();
}
function getEquipState(){
  const bySlot={};
  state.shopItems.forEach(it=>{ if(it.slot && it.owned && it.equipped) bySlot[it.slot]=true; });
  return bySlot;
}
function toggleEquip(idx){
  const it=state.shopItems[idx];
  if(!it.owned){ toast('포인트 상점에서 구매해주세요'); return; }
  it.equipped=!it.equipped;
  toast(it.equipped?`${it.name} 착용했습니다`:`${it.name} 착용 해제했습니다`);
  render();
}
function drawAvatarCanvas(){
  const canvas=document.getElementById('avatar-char-canvas');
  if(!canvas) return;
  drawPixelCharacter(canvas, getEquipState(), state.user.gender);
}
// 상단바의 작은 프로필 캐릭터 미리보기. drawPixelCharacter가 내부적으로 캔버스 해상도를
// 144x176으로 고정하지만, CSS에서 36x36 원형으로 축소 표시한다.
function drawTopbarAvatar(){
  const canvas=document.getElementById('topbar-avatar-canvas');
  if(!canvas) return;
  drawPixelCharacter(canvas, getEquipState(), state.user.gender);
}
// gender: 'male' | 'female' — 회원가입 캘리브레이션에서 고른 값(state.user.gender)을 그대로 받아
// 머리 모양만 구분한다. 로봇 스킨 아이템을 장착하면 성별과 무관하게 로봇 얼굴이 우선한다.
function drawPixelCharacter(canvas, equip, gender){
  const U=8, W=18, H=22;
  canvas.width=W*U; canvas.height=H*U;
  const ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=true;

  if(equip.background){
    const g=ctx.createLinearGradient(0,0,0,H*U);
    g.addColorStop(0,'#3b2f63'); g.addColorStop(0.55,'#c06b4f'); g.addColorStop(1,'#f0b35c');
    ctx.fillStyle=g; ctx.fillRect(0,0,W*U,H*U);
  } else {
    ctx.fillStyle='#241C12'; ctx.fillRect(0,0,W*U,H*U);
  }

  const sprite=CHAR_SPRITES[gender==='female'?'female':'male'];
  if(sprite){
    ctx.save();
    // '네온 트레이닝복'을 장착하면 실루엣 주위에 네온 림라이트를 추가로 씌운다 (원본 아트를
    // 다시 그리는 대신, 착용 여부를 알아볼 수 있는 신호로 그림자 발광을 사용).
    if(equip.outfit){ ctx.shadowColor='#3ED598'; ctx.shadowBlur=U*1.6; }
    // '로봇 코치' 스킨은 전용 아트가 없어서, 대신 캔버스 필터로 금속/청록 톤 보정을 준다.
    if(equip.skin){ ctx.filter='grayscale(0.6) sepia(0.35) hue-rotate(165deg) saturate(2.4)'; }
    const sw=sprite.naturalWidth||sprite.width, sh=sprite.naturalHeight||sprite.height;
    const scale=Math.min((W*U)/sw, (H*U)/sh);
    const dw=sw*scale, dh=sh*scale;
    ctx.drawImage(sprite, (W*U-dw)/2, H*U-dh, dw, dh);
    ctx.restore();
  }

  if(equip.crown){
    const xL=W*U*0.30, xR=W*U*0.70, baseY=U*1.5, topY=U*0.15, midY=U*0.85;
    ctx.fillStyle='#D9A226';
    ctx.beginPath();
    ctx.moveTo(xL, baseY);
    ctx.lineTo(xL, midY);
    ctx.lineTo(xL+(xR-xL)*0.2, topY);
    ctx.lineTo(xL+(xR-xL)*0.5, midY);
    ctx.lineTo(xL+(xR-xL)*0.8, topY);
    ctx.lineTo(xR, midY);
    ctx.lineTo(xR, baseY);
    ctx.closePath();
    ctx.fill();
  }

  if(equip.badge){
    ctx.strokeStyle='#D9A226'; ctx.lineWidth=U*0.6;
    ctx.strokeRect(ctx.lineWidth/2, ctx.lineWidth/2, W*U-ctx.lineWidth, H*U-ctx.lineWidth);
  }
}
const _itemIconCache={};
function itemIconDataURL(name){
  if(_itemIconCache[name]) return _itemIconCache[name];
  let seed=2166136261;
  for(let i=0;i<name.length;i++){ seed^=name.charCodeAt(i); seed=Math.imul(seed,16777619); }
  seed=seed>>>0;
  const rnd=()=>{ seed=(seed+0x6D2B79F5)|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  const U=6, N=8;
  const c=document.createElement('canvas'); c.width=N*U; c.height=N*U;
  const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const hue=Math.floor(rnd()*360);
  ctx.fillStyle=`hsl(${hue},40%,18%)`; ctx.fillRect(0,0,N*U,N*U);
  const fg1=`hsl(${hue},70%,55%)`, fg2=`hsl(${(hue+40)%360},80%,65%)`;
  for(let y=0;y<N;y++){
    for(let x=0;x<N/2;x++){
      if(rnd()<0.45){
        ctx.fillStyle=rnd()<0.5?fg1:fg2;
        ctx.fillRect(x*U,y*U,U,U);
        ctx.fillRect((N-1-x)*U,y*U,U,U);
      }
    }
  }
  const url=c.toDataURL();
  _itemIconCache[name]=url;
  return url;
}
// (FR-SH-001) 아래 buyItem()에서 실제 결제/포인트 차감이 필요합니다.
//   아이템 구매(buyItem) > Java 상점 API > DB 연결 > SQL UPDATE(포인트 잔액) + INSERT(보유 아이템 테이블)
//   — 포인트 차감과 아이템 지급은 하나의 트랜잭션으로 묶어야 중간 실패 시 포인트만 깎이는 사고를 막을 수 있습니다.
function renderMissionShop(){
  return `
  <p class="hint" style="margin-bottom:14px;">아이템마다 적용되는 능력치가 다릅니다. 구매 전 효과를 확인하세요.</p>
  <div class="grid grid-3">
    ${state.shopItems.map((it,idx)=>`
      <div class="card">
        <div class="feed-media" style="height:88px;">${it.name}</div>
        <div class="flex-between" style="margin-top:10px;">
          <h3 style="margin:0;">${it.name}</h3>
        </div>
        <span class="pill ${it.effect.startsWith('능력치 없음')?'pill-muted':'pill-accent'}" style="margin-top:8px;">효과 · ${it.effect}</span>
        ${it.consumable?`<p class="desc" style="margin-top:4px;color:var(--accent);">보유 수량: ${it.name==='닉네임 변경권'?(state.user.nicknameTickets||0):state.user.retakeTickets}장</p>`:''}
        <p class="desc" style="margin-top:8px;">${it.effectDesc}</p>
        <div class="flex-between" style="margin-top:6px;">
          <span class="shop-price">P ${it.price}</span>
          <button class="btn btn-sm ${(it.owned && !it.consumable)?'btn-ghost':'btn-primary'}" ${(it.owned && !it.consumable)?'disabled style="opacity:.5;"':''} onclick="buyItem(${idx})">${(it.owned && !it.consumable)?'보유중':'구매하기'}</button>
        </div>
      </div>`).join('')}
  </div>`;
}
function buyItem(idx){
  const it=state.shopItems[idx];
  if(it.owned && !it.consumable){toast('이미 보유한 아이템입니다'); return;}
  if(state.user.points<it.price){toast('포인트가 부족합니다'); return;}
  state.user.points -= it.price;
  if(it.consumable){
    if(it.name==='닉네임 변경권'){
      state.user.nicknameTickets = (state.user.nicknameTickets||0) + 1;
      toast(`${it.name} 구매 완료 (보유 ${state.user.nicknameTickets}장)`);
    } else {
      state.user.retakeTickets = (state.user.retakeTickets||0) + 1;
      toast(`${it.name} 구매 완료 (보유 ${state.user.retakeTickets}장)`);
    }
  } else {
    it.owned=true;
    toast(`${it.name} 구매 완료`);
  }
  render();
}

/* ========================================================================
   3. 홈크루
   ======================================================================== */
// (FR-CR-001~005) 크루 생성/가입/배분/강퇴/공지/가입승인은 모두 아래 파이프라인이 필요한 구간입니다.
//   크루 생성(createCrew) / 가입(joinCrew) > Java 크루 API > DB 연결 > SQL INSERT(크루 테이블, 크루원 테이블)
//   단체 미션 배분(setCrewMissionEx 등) > Java 크루 API > DB 연결 > SQL UPDATE(미션 배분 테이블)
//   가입 요청 승인(approveJoinRequest) > Java 크루 API > DB 연결 > SQL INSERT(크루원) + DELETE(가입요청)
//   크루원 강퇴(kickMember) > Java 크루 API > DB 연결 > SQL DELETE(크루원 테이블)
//   크루공지 작성(postCrewNotice, 팀장 전용) > Java 크루 API(권한 확인) > DB 연결 > SQL INSERT(공지 테이블)
// 참고: 기존에 있던 실시간 크루 채팅 기능은 삭제되었습니다 — 대신 크루공지에서 팀장이
// 외부 메신저 채팅방 정보를 안내하는 방식으로 대체했습니다.
const CREW_ENTRY_TABS=['크루 생성','우리동네 크루 가입하기'];
const CREW_MISSION_EX_OPTIONS = EXS.map(e=>e.name);
// 팀장일 때만 '크루원관리' 탭이 추가로 붙는다 (가입요청 승인·강퇴는 팀장 전용 화면으로 분리).
function getCrewPageTabs(){
  const tabs=['크루 메인','크루공지','오늘의 단체 미션','크루원 정보'];
  if(getMyCrewRole()==='팀장') tabs.push('크루원관리');
  return tabs;
}
// 우리동네 크루 가입하기 목록. 검색·지역 필터·페이지네이션 데모를 위해 여러 지역에 걸쳐 구성했다.
const JOINABLE_CREWS=[
  {name:'역삼동 러너스', level:11, score:4820, leader:'써니핏', regionCity:'서울시', regionGu:'강남구', regionDong:'역삼동', desc:'매일 아침 6시 인증 러닝 크루입니다.'},
  {name:'삼성동 스쿼트클럽', level:6, score:2400, leader:'헬스왕', regionCity:'서울시', regionGu:'강남구', regionDong:'삼성동', desc:'스쿼트 하나만 파는 크루예요.'},
  {name:'합정 플랭커즈', level:9, score:3990, leader:'런닝수달', regionCity:'서울시', regionGu:'마포구', regionDong:'합정동', desc:'플랭크 최강자를 가립니다.'},
  {name:'망원 버피팀', level:7, score:2950, leader:'버피장인', regionCity:'서울시', regionGu:'마포구', regionDong:'망원동', desc:'버피로 체지방 태우는 크루.'},
  {name:'성수 스쿼트단', level:8, score:3650, leader:'단백질맨', regionCity:'서울시', regionGu:'성동구', regionDong:'성수동', desc:'단백질 챙겨먹고 스쿼트하는 사람들.'},
  {name:'해운대 러너스', level:10, score:4100, leader:'바다사나이', regionCity:'부산시', regionGu:'해운대구', regionDong:'우동', desc:'해변 따라 뛰는 부산 크루.'},
  {name:'중동 조깅클럽', level:5, score:1800, leader:'조깅요정', regionCity:'부산시', regionGu:'해운대구', regionDong:'중동', desc:'가볍게 조깅부터 시작해요.'},
  {name:'봉명 홈트팀', level:4, score:1300, leader:'대전홈트', regionCity:'대전시', regionGu:'유성구', regionDong:'봉명동', desc:'대전 유성구 홈트 초보 모임.'},
  {name:'오룡 파워워커즈', level:9, score:3800, leader:'파워워커', regionCity:'전남광주통합특별시', regionGu:'북구', regionDong:'오룡동', desc:'빠르게 걷기부터 파워워킹까지.'},
  {name:'상무 헬스메이트', level:8, score:3400, leader:'헬스메이트', regionCity:'전남광주통합특별시', regionGu:'서구', regionDong:'상무동', desc:'헬스 초보 환영하는 크루.'},
  {name:'역삼 런지크루', level:6, score:2200, leader:'런지킹', regionCity:'서울시', regionGu:'강남구', regionDong:'역삼동', desc:'런지 100개 챌린지 진행중.'},
  {name:'오룡 조깅단', level:5, score:1900, leader:'조깅단장', regionCity:'전남광주통합특별시', regionGu:'북구', regionDong:'오룡동', desc:'주말마다 함께 조깅해요.'},
];
function renderCrew(){
  const i=state.subtabs.crew;
  if(!state.crew.created){
    return `
    <div class="view-head"><h1>홈크루</h1><p>크루를 새로 만들거나 우리동네 크루에 가입해보세요</p></div>
    <div class="subtabs">
      ${CREW_ENTRY_TABS.map((t,idx)=>`<div class="tab ${i===idx?'active':''}" onclick="setSub('crew',${idx})">${t}</div>`).join('')}
    </div>
    ${i===0?renderCrewCreate():renderCrewJoin()}`;
  }
  const tabs=getCrewPageTabs();
  const activeTab=tabs[i]||tabs[0];
  return `
  <div class="view-head"><h1>${state.crew.name}</h1><p>크루 메인 → 크루공지 → 오늘의 단체 미션 → 크루원 정보</p></div>
  <div class="subtabs">
    ${tabs.map((t,idx)=>`<div class="tab ${i===idx?'active':''}" onclick="setSub('crew',${idx})">${t}</div>`).join('')}
  </div>
  ${activeTab==='크루 메인'?renderCrewOverview()
    :activeTab==='크루공지'?renderCrewNotice()
    :activeTab==='오늘의 단체 미션'?renderCrewAssign()
    :activeTab==='크루원 정보'?renderCrewMembers()
    :renderCrewManage()}`;
}
function renderCrewCreate(){
  return `
  <div class="card" style="max-width:480px;">
    <p class="section-label">새 크루 만들기 (포인트 100 소모)</p>
    <div class="field">
      <label>활동 지역</label>
      <div class="hint" style="padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);">${state.user.region} <span style="color:var(--ink-faint);">(캘리브레이션 시 등록된 활동 지역)</span></div>
    </div>
    <div class="field"><label for="cr-name">크루 이름</label><input id="cr-name" placeholder="예: 역삼동 스쿼트단"></div>
    <div class="field"><label for="cr-desc">크루 소개</label><textarea id="cr-desc" rows="3" placeholder="어떤 크루인지 소개해주세요"></textarea></div>
    <button class="btn btn-primary btn-block" onclick="createCrew()">100P로 크루 생성</button>
  </div>`;
}
function createCrew(){
  if(state.user.points<100){toast('포인트가 부족합니다'); return;}
  const name=document.getElementById('cr-name').value.trim() || '역삼동 스쿼트단';
  const desc=document.getElementById('cr-desc').value.trim() || '함께 성장하는 홈트 크루입니다.';
  // (#8) 중복된 크루명 방지 — 실제로는 DB에 SQL SELECT로 존재 여부를 물어야 한다.
  if(JOINABLE_CREWS.some(c=>c.name===name)){ toast('이미 사용중인 크루 이름입니다'); return; }
  state.user.points -= 100;
  state.crew.created=true;
  state.crew.name=name;
  state.crew.desc=desc;
  state.crew.region=state.user.region;
  state.crew.level=1;
  state.crew.exp=120;
  state.crew.members=[
    {n:'나', role:'팀장', level:state.user.level, score:totalScore()},
    {n:'써니핏', role:'팀원', level:8, score:3200},
    {n:'런닝수달', role:'팀원', level:9, score:3800},
    {n:'단백질맨', role:'팀원', level:6, score:2100},
  ];
  state.subtabs.crew=0;
  toast('크루가 생성되었습니다');
  render();
}
const CREW_JOIN_PAGE_SIZE=8;
function renderCrewJoin(){
  const s=state.crew;
  const cities=Object.keys(REGION_DATA);
  const fCity = s.joinCity && REGION_DATA[s.joinCity] ? s.joinCity : null;
  const gus = fCity ? Object.keys(REGION_DATA[fCity]) : [];
  const fGu = fCity && s.joinGu && REGION_DATA[fCity][s.joinGu] ? s.joinGu : null;
  const dongs = fGu ? REGION_DATA[fCity][fGu] : [];
  const fDong = fGu && s.joinDong && dongs.includes(s.joinDong) ? s.joinDong : null;

  const list = JOINABLE_CREWS.filter(c=>{
    if(s.joinSearch && !c.name.includes(s.joinSearch)) return false;
    if(fCity && c.regionCity!==fCity) return false;
    if(fGu && c.regionGu!==fGu) return false;
    if(fDong && c.regionDong!==fDong) return false;
    return true;
  });
  const totalPages=Math.max(1, Math.ceil(list.length/CREW_JOIN_PAGE_SIZE));
  const page=Math.min(s.joinPage||1, totalPages);
  const pageItems=list.slice((page-1)*CREW_JOIN_PAGE_SIZE, page*CREW_JOIN_PAGE_SIZE);

  return `
  <div class="field" style="max-width:360px;"><label for="crew-search-input">크루명 검색</label><input id="crew-search-input" placeholder="크루 이름으로 검색" value="${s.joinSearch||''}"
    oninput="if(!this.dataset.composing) setCrewJoinSearch(this.value)"
    oncompositionstart="this.dataset.composing='1'"
    oncompositionend="this.dataset.composing=''; setCrewJoinSearch(this.value)"></div>
  <div class="filter-bar">
    <select onchange="setCrewJoinCity(this.value)">
      <option value="">시 전체</option>
      ${cities.map(c=>`<option ${c===fCity?'selected':''}>${c}</option>`).join('')}
    </select>
    <select onchange="setCrewJoinGu(this.value)" ${fCity?'':'disabled'}>
      <option value="">구 전체</option>
      ${gus.map(g=>`<option ${g===fGu?'selected':''}>${g}</option>`).join('')}
    </select>
    <select onchange="setCrewJoinDong(this.value)" ${fGu?'':'disabled'}>
      <option value="">동 전체</option>
      ${dongs.map(d=>`<option ${d===fDong?'selected':''}>${d}</option>`).join('')}
    </select>
  </div>
  <div class="grid grid-3">
    ${pageItems.length ? pageItems.map(c=>`
      <div class="card">
        <div class="flex-between"><h3 style="margin:0;">${c.name}</h3><span class="pill pill-gold">Lv.${c.level}</span></div>
        <p class="desc" style="margin-top:8px;">${c.desc}</p>
        <p class="hint" style="margin:0 0 10px;">${c.regionCity} ${c.regionGu} ${c.regionDong}</p>
        <div class="stat-row" style="margin-top:0;">
          <div class="stat-box"><div class="num mono">${c.score.toLocaleString()}</div><div class="lbl">누적 점수</div></div>
          <div class="stat-box"><div class="num mono">${c.leader}</div><div class="lbl">크루장</div></div>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="joinCrew('${c.name}')">가입하기</button>
      </div>`).join('') : '<div class="empty-note" style="grid-column:1/-1;">조건에 맞는 크루가 없어요.</div>'}
  </div>
  ${totalPages>1?`
  <div class="flex-between" style="margin-top:16px;justify-content:center;gap:14px;">
    <button class="btn btn-sm btn-ghost" ${page<=1?'disabled style="opacity:.4;cursor:not-allowed;"':''} onclick="setCrewJoinPage(${page-1})">이전</button>
    <span class="hint" style="margin:0;">${page} / ${totalPages} 페이지</span>
    <button class="btn btn-sm btn-ghost" ${page>=totalPages?'disabled style="opacity:.4;cursor:not-allowed;"':''} onclick="setCrewJoinPage(${page+1})">다음</button>
  </div>`:''}`;
}
function setCrewJoinSearch(v){
  state.crew.joinSearch=v; state.crew.joinPage=1; render();
  setTimeout(()=>{ const el=document.getElementById('crew-search-input'); if(el){ el.focus(); el.selectionStart=el.selectionEnd=el.value.length; } },0);
}
function setCrewJoinCity(v){ state.crew.joinCity=v||null; state.crew.joinGu=null; state.crew.joinDong=null; state.crew.joinPage=1; render(); }
function setCrewJoinGu(v){ state.crew.joinGu=v||null; state.crew.joinDong=null; state.crew.joinPage=1; render(); }
function setCrewJoinDong(v){ state.crew.joinDong=v||null; state.crew.joinPage=1; render(); }
function setCrewJoinPage(p){ state.crew.joinPage=p; render(); }
function joinCrew(name){
  const c=JOINABLE_CREWS.find(c=>c.name===name);
  if(!c) return;
  state.crew.created=true;
  state.crew.name=c.name;
  state.crew.desc=c.desc;
  state.crew.region=`${c.regionCity} ${c.regionGu} ${c.regionDong}`;
  state.crew.level=c.level;
  state.crew.exp=Math.round(c.score*0.3);
  state.crew.members=[
    {n:c.leader, role:'팀장', level:c.level, score:c.score},
    {n:'나', role:'팀원', level:state.user.level, score:totalScore()},
  ];
  state.subtabs.crew=0;
  toast(`${c.name}에 가입했습니다`);
  render();
}
function getMyCrewRole(){
  const me=state.crew.members.find(m=>m.n==='나');
  return me?me.role:'팀원';
}
function toggleMyCrewRole(){
  const me=state.crew.members.find(m=>m.n==='나');
  if(!me) return;
  me.role = me.role==='팀장' ? '팀원' : '팀장';
  toast(`내 역할이 '${me.role}'(으)로 바뀌었습니다 (테스트용 전환)`);
  state.subtabs.crew=0;
  render();
}
// 크루원 레벨 비율에 맞춰 전체 목표 횟수를 개인별 목표로 나눈다. (#9)
function getCrewMissionTargets(){
  const totalLevel = state.crew.members.reduce((s,m)=>s+m.level,0)||1;
  const gm=state.crew.groupMission;
  return state.crew.members.map(m=>({
    ...m,
    target: Math.max(5, Math.round(gm.totalTarget * (m.level/totalLevel))),
  }));
}
// 실제로는 오늘 촬영한 운동 기록과 연동돼야 할 진행률이지만, 이 프로토타입에는 그 연결이
// 없으므로 이름을 시드로 한 결정론적 값으로 흉내낸다.
function getCrewMemberProgress(name, target){
  const seed=hashStr(name+state.crew.groupMission.ex+state.crew.groupMission.period);
  return Math.round(target * ((seed%70)+15)/100);
}
function renderCrewOverview(){
  const members=state.crew.members;
  const contribTotal=members.reduce((s,m)=>s+m.score,0)||1;
  const ranked=[...members].sort((a,b)=>b.score-a.score).map((m,i)=>({...m, rank:i+1, pct:Math.round(m.score/contribTotal*100)}));
  const dongRank=getMyDongCrewRank();
  const gm=state.crew.groupMission;
  const targets=getCrewMissionTargets();
  const mine=targets.find(m=>m.n==='나');
  const myPct=mine?Math.min(100, Math.round(getCrewMemberProgress('나',mine.target)/mine.target*100)):0;
  return `
  <div class="grid grid-2" style="align-items:start;">
    <div class="card">
      <p class="section-label">크루 레벨 · 누적 경험치</p>
      <div class="stat-row">
        <div class="stat-box"><div class="num mono">Lv.${state.crew.level}</div><div class="lbl">크루 레벨</div></div>
        <div class="stat-box"><div class="num mono">${(state.crew.exp||0).toLocaleString()}</div><div class="lbl">누적 경험치</div></div>
        <div class="stat-box"><div class="num mono">#${dongRank.rank}</div><div class="lbl">${dongRank.dong} 순위</div></div>
      </div>
    </div>
    <div class="card">
      <p class="section-label">크루 미션 누적점수</p>
      ${ranked.map(m=>`
        <div class="rep-row">
          <span class="rank-num ${m.rank===1?'top':''}" style="min-width:24px;height:22px;">${m.rank}</span>
          <span class="user-avatar" style="width:22px;height:22px;font-size:10px;flex:none;background:${avatarColor(m.rank-1)}">${avatarInitial(m.n)}</span>
          <span style="width:64px;">${m.n}${m.n==='나'?' <span class="pill pill-accent">나</span>':''}</span>
          <div class="bar-track"><span style="width:${m.pct}%;background:var(--accent)"></span></div>
          <span class="angle mono">${m.score.toLocaleString()}점</span>
        </div>`).join('')}
    </div>
  </div>
  <div class="grid grid-2" style="align-items:start;margin-top:14px;">
    <div class="card">
      <p class="section-label">팀미션 진행률</p>
      <div class="progress" style="height:14px;margin:10px 0;"><span style="width:${state.crew.teamProgress}%"></span></div>
      <p class="desc">전체 목표 대비 ${state.crew.teamProgress}% 달성</p>
    </div>
    <div class="card">
      <p class="section-label">내게 배분된 미션</p>
      <div class="flex-between"><h3 style="margin:0;">${mine?(mine.assignedEx||gm.ex):gm.ex}</h3><span class="pill pill-accent">${gm.period==='daily'?'일일':'주간'}</span></div>
      <p class="desc" style="margin:8px 0;">목표 ${mine?mine.target:'-'}회</p>
      <div class="progress" style="margin:6px 0;"><span style="width:${myPct}%"></span></div>
      <p class="hint" style="margin:0;">진행률 ${myPct}% · 자세한 배분 현황은 '오늘의 단체 미션' 탭에서 확인하세요.</p>
    </div>
  </div>`;
}
/* ---------- 크루공지: 팀장만 작성 가능 ---------- */
function renderCrewNotice(){
  const isLeader=getMyCrewRole()==='팀장';
  return `
  ${isLeader?`
  <div class="card" style="max-width:520px;margin-bottom:16px;">
    <p class="section-label">공지 작성</p>
    <div class="field"><label for="notice-title">제목</label><input id="notice-title" placeholder="예: 우리 크루 단톡방 안내"></div>
    <div class="field"><label for="notice-body">내용</label><textarea id="notice-body" rows="3" placeholder="크루원에게 전달할 내용을 입력하세요 (예: 카카오톡 오픈채팅 '123' 검색)"></textarea></div>
    <button class="btn btn-primary" onclick="postCrewNotice()">공지 등록</button>
  </div>`:''}
  <div style="display:flex;flex-direction:column;gap:10px;">
    ${state.crew.notices.length ? [...state.crew.notices].reverse().map(n=>`
      <div class="card">
        <div class="flex-between"><h3 style="margin:0;">${n.title}</h3><span class="hint" style="margin:0;">${n.date}</span></div>
        <p class="desc" style="margin-top:8px;white-space:pre-wrap;">${n.body}</p>
        <p class="hint" style="margin:0;">작성자 · ${n.who}</p>
      </div>`).join('') : '<div class="empty-note">아직 등록된 공지가 없어요.</div>'}
  </div>`;
}
function postCrewNotice(){
  if(getMyCrewRole()!=='팀장'){ toast('공지 작성 권한이 없습니다'); return; }
  const title=document.getElementById('notice-title').value.trim();
  const body=document.getElementById('notice-body').value.trim();
  if(!title || !body){ toast('제목과 내용을 입력해주세요'); return; }
  state.crew.notices.push({who:state.user.nickname||'팀장', title, body, date:'오늘'});
  toast('공지를 등록했습니다');
  render();
}
/* ---------- 오늘의 단체 미션: 종목 1개 + 총목표를 레벨 비례로 개인 배분 ---------- */
function renderCrewAssign(){
  const isLeader=getMyCrewRole()==='팀장';
  const gm=state.crew.groupMission;
  const targets=getCrewMissionTargets();
  return `
  <div class="card" style="max-width:560px;margin-bottom:16px;">
    <p class="section-label">${gm.period==='daily'?'크루 일일미션':'크루 주간미션'}</p>
    <div class="filter-bar">
      ${['daily','weekly'].map(p=>`<button class="btn btn-sm ${gm.period===p?'btn-primary':'btn-secondary'}" ${isLeader?`onclick="setCrewMissionPeriod('${p}')"`:'disabled style="opacity:.6;"'}>${p==='daily'?'일일':'주간'}</button>`).join('')}
    </div>
    <p class="desc">종목 <b style="color:var(--ink);">${gm.ex}</b> · 팀 전체 목표 <b style="color:var(--ink);">${gm.totalTarget}회</b> — 크루원 레벨에 맞춰 개인 목표가 자동으로 조정됩니다.</p>
    ${isLeader?`
    <div class="field"><label for="cm-ex-select">종목 선택</label><select id="cm-ex-select" onchange="setCrewMissionEx(this.value)">${CREW_MISSION_EX_OPTIONS.map(e=>`<option ${e===gm.ex?'selected':''}>${e}</option>`).join('')}</select></div>`:''}
  </div>
  <p class="section-label">배분 현황</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>팀원</th><th>역할</th><th>배분된 종목</th><th>진행률</th></tr></thead>
      <tbody>
        ${targets.map(m=>{
          const done=getCrewMemberProgress(m.n, m.target);
          const pct=Math.min(100, Math.round(done/m.target*100));
          const ex=m.assignedEx||gm.ex;
          return `
          <tr>
            <td>${m.n}${m.n==='나'?' <span class="pill pill-accent">나</span>':''}</td>
            <td><span class="pill ${m.role==='팀장'?'pill-gold':'pill-muted'}">${m.role}</span></td>
            <td>${isLeader
              ? `<select onchange="setMemberMissionEx('${m.n}', this.value)" style="width:auto;padding:5px 8px;font-size:12px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);">${CREW_MISSION_EX_OPTIONS.map(e=>`<option ${ex===e?'selected':''}>${e}</option>`).join('')}</select>`
              : `<span class="pill pill-accent">${ex}</span>`}</td>
            <td style="min-width:130px;">
              <div class="bar-track"><span style="width:${pct}%;background:${pct>=100?'var(--accent)':'var(--gold)'}"></span></div>
              <span class="hint" style="margin:3px 0 0;">${pct}%${pct>=100?' · 완료':''}</span>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
  <p class="hint" style="margin-top:10px;">테스트용 — <button class="btn btn-sm btn-ghost" onclick="toggleMyCrewRole()">내 역할(${getMyCrewRole()}) 전환해보기</button></p>`;
}
function setCrewMissionPeriod(p){
  if(getMyCrewRole()!=='팀장'){ toast('미션 설정 권한이 없습니다'); return; }
  state.crew.groupMission.period=p; render();
}
function setCrewMissionEx(v){
  if(getMyCrewRole()!=='팀장'){ toast('미션 설정 권한이 없습니다'); return; }
  state.crew.groupMission.ex=v; render();
}
function setMemberMissionEx(name, ex){
  if(getMyCrewRole()!=='팀장'){ toast('배분 변경 권한이 없습니다'); return; }
  const m=state.crew.members.find(m=>m.n===name);
  if(m){ m.assignedEx=ex; toast(`${name}님의 배분 종목을 ${ex}(으)로 변경했습니다`); }
  render();
}
/* ---------- 크루원 정보: 조회 전용 (강퇴 기능은 크루원관리 탭으로 이동) ---------- */
function renderCrewMembers(){
  return `
  <div class="table-wrap">
    <table>
      <thead><tr><th>이름</th><th>역할</th><th>레벨</th></tr></thead>
      <tbody>
        ${state.crew.members.map(m=>`
          <tr>
            <td>${m.n}${m.n==='나'?' <span class="pill pill-accent">나</span>':''}</td>
            <td><span class="pill ${m.role==='팀장'?'pill-gold':'pill-muted'}">${m.role}</span></td>
            <td class="mono">Lv.${m.level}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}
/* ---------- 크루원관리: 팀장 전용 — 크루 소개 수정 + 가입요청 승인 + 강퇴 ---------- */
function renderCrewManage(){
  if(getMyCrewRole()!=='팀장'){ return '<div class="empty-note">팀장만 접근할 수 있는 메뉴입니다.</div>'; }
  const reqs=state.crew.joinRequests;
  return `
  <div class="card" style="max-width:520px;margin-bottom:20px;">
    <p class="section-label">크루 소개 수정</p>
    <div class="field"><textarea id="crew-desc-edit" rows="3">${state.crew.desc}</textarea></div>
    <button class="btn btn-secondary" onclick="updateCrewDesc()">소개 저장</button>
  </div>
  <p class="section-label">가입 요청 (${reqs.length})</p>
  <div class="grid grid-2" style="margin-bottom:24px;">
    ${reqs.length ? reqs.map((r,idx)=>`
      <div class="card">
        <div class="flex-between"><h3 style="margin:0;">${r.n}</h3><span class="pill pill-gold">Lv.${r.level}</span></div>
        <p class="desc" style="margin-top:8px;">${r.msg}</p>
        <p class="hint">누적 점수 ${r.score.toLocaleString()}점</p>
        <div class="flex-between" style="margin-top:10px;gap:8px;">
          <button class="btn btn-sm btn-secondary" style="flex:1;" onclick="rejectJoinRequest(${idx})">거절</button>
          <button class="btn btn-sm btn-primary" style="flex:1;" onclick="approveJoinRequest(${idx})">승인</button>
        </div>
      </div>`).join('') : '<div class="empty-note" style="grid-column:1/-1;">대기중인 가입 요청이 없어요.</div>'}
  </div>
  <p class="section-label">크루원 강퇴</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>이름</th><th>역할</th><th>레벨</th><th>관리</th></tr></thead>
      <tbody>
        ${state.crew.members.map(m=>`
          <tr>
            <td>${m.n}${m.n==='나'?' <span class="pill pill-accent">나</span>':''}</td>
            <td><span class="pill ${m.role==='팀장'?'pill-gold':'pill-muted'}">${m.role}</span></td>
            <td class="mono">Lv.${m.level}</td>
            <td>${m.n!=='나'?`<button class="btn btn-sm btn-danger" onclick="kickMember('${m.n}')">강퇴</button>`:''}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}
function updateCrewDesc(){
  const v=document.getElementById('crew-desc-edit').value.trim();
  if(!v){ toast('소개글을 입력해주세요'); return; }
  state.crew.desc=v;
  toast('크루 소개를 저장했습니다');
  render();
}
function approveJoinRequest(idx){
  const r=state.crew.joinRequests[idx];
  if(!r) return;
  state.crew.members.push({n:r.n, role:'팀원', level:r.level, score:r.score});
  state.crew.joinRequests.splice(idx,1);
  toast(`${r.n}님의 가입을 승인했습니다`);
  render();
}
function rejectJoinRequest(idx){
  const r=state.crew.joinRequests[idx];
  if(!r) return;
  state.crew.joinRequests.splice(idx,1);
  toast(`${r.n}님의 가입 요청을 거절했습니다`);
  render();
}
function kickMember(name){
  if(getMyCrewRole()!=='팀장'){ toast('강퇴 권한이 없습니다'); return; }
  state.crew.members=state.crew.members.filter(m=>m.n!==name);
  toast(`${name}님을 크루에서 강퇴했습니다`);
  render();
}

/* ---------- 크루 랭킹: 시/구/동 드롭다운 랭킹 + 시/구 드롭다운 지도 (#18, #19) ---------- */
const CREW_NAME_POOL=['역삼동 러너스','합정 플랭커즈','성수 스쿼트단','오룡 파워워커즈','상무 헬스메이트','망원 버피팀','잠실 런지크루','봉선 조깅단'];
function hashStr(s){
  let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0;
}
function getDongCrewRanking(dong){
  const seed=hashStr(dong);
  const names=[];
  let idx=seed;
  while(names.length<3){
    idx=(idx*48271+1)%2147483647;
    const name=CREW_NAME_POOL[idx%CREW_NAME_POOL.length];
    if(!names.includes(name)) names.push(name);
  }
  return names.map((name,i)=>({
    rank:i+1, name,
    level:Math.max(1, 12-i*2-(seed%3)),
    score:5200-i*430-(seed%100),
  }));
}
function getMyCrewDong(){
  const region=state.crew.region || state.user.region || '';
  return region.trim().split(/\s+/).pop();
}
function getMyDongCrewRank(){
  const dong=getMyCrewDong();
  const myScore=state.crew.members.reduce((s,m)=>s+m.score,0);
  const others=getDongCrewRanking(dong).filter(c=>c.name!==state.crew.name);
  const rows=[...others, {name:state.crew.name, score:myScore}].sort((a,b)=>b.score-a.score);
  return { dong, rank: rows.findIndex(r=>r.name===state.crew.name)+1 };
}
function renderCrewRegionRank(){
  const cities=Object.keys(REGION_DATA);
  const rankCity=REGION_DATA[state.crew.rankCity]?state.crew.rankCity:cities[0];
  const rankGus=Object.keys(REGION_DATA[rankCity]);
  const rankGu=REGION_DATA[rankCity][state.crew.rankGu]?state.crew.rankGu:rankGus[0];
  const dongs=REGION_DATA[rankCity][rankGu];
  const rankDong=dongs.includes(state.crew.rankDong)?state.crew.rankDong:dongs[0];
  const rows=getDongCrewRanking(rankDong);
  const mapCity=REGION_DATA[state.crew.mapCity]?state.crew.mapCity:cities[0];
  const mapGus=Object.keys(REGION_DATA[mapCity]);
  const mapGu=REGION_DATA[mapCity][state.crew.mapGu]?state.crew.mapGu:mapGus[0];
  return `
  <div class="grid grid-2" style="align-items:start;">
    <div>
      <p class="section-label">동네별 크루 랭킹</p>
      <div class="filter-bar">
        <select onchange="setCrewRankCity(this.value)">
          ${cities.map(c=>`<option ${c===rankCity?'selected':''}>${c}</option>`).join('')}
        </select>
        <select onchange="setCrewRankGu(this.value)">
          ${rankGus.map(g=>`<option ${g===rankGu?'selected':''}>${g}</option>`).join('')}
        </select>
        <select onchange="setCrewRankDong(this.value)">
          ${dongs.map(d=>`<option ${d===rankDong?'selected':''}>${d}</option>`).join('')}
        </select>
      </div>
      ${renderPodium(rows)}
    </div>
    <div>
      <p class="section-label">동네별 1위 크루 지도</p>
      <div class="filter-bar">
        <select onchange="setCrewMapCity(this.value)">
          ${cities.map(c=>`<option ${c===mapCity?'selected':''}>${c}</option>`).join('')}
        </select>
        <select onchange="setCrewMapGu(this.value)">
          ${mapGus.map(g=>`<option ${g===mapGu?'selected':''}>${g}</option>`).join('')}
        </select>
      </div>
      ${renderCrewMap(mapCity, mapGu)}
    </div>
  </div>`;
}
function renderCrewMap(city, gu){
  const dongs=REGION_DATA[city][gu];
  return `
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
    ${dongs.map(d=>{
      const top=getDongCrewRanking(d)[0];
      return `
      <div style="border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--surface-2);">
        <div class="flex-between"><b style="font-size:13px;">${d}</b><span class="pill pill-gold">1위</span></div>
        <p class="desc" style="margin:6px 0 0;">${top.name}</p>
        <p class="hint" style="margin-top:2px;">Lv.${top.level} · ${top.score.toLocaleString()}점</p>
      </div>`;
    }).join('')}
  </div>`;
}
function setCrewRankCity(v){ state.crew.rankCity=v; state.crew.rankGu=null; state.crew.rankDong=null; render(); }
function setCrewRankGu(v){ state.crew.rankGu=v; state.crew.rankDong=null; render(); }
function setCrewRankDong(v){ state.crew.rankDong=v; render(); }
function setCrewMapCity(v){ state.crew.mapCity=v; state.crew.mapGu=null; render(); }
function setCrewMapGu(v){ state.crew.mapGu=v; render(); }

/* ========================================================================
   4. 랭킹
   ======================================================================== */
// (FR-RK-001~002) 지금은 getRegionRanking()/getDongCrewRanking()처럼 화면에서 정렬만 흉내내고
// 있지만, 실제로는 순위를 매기는 연산 자체를 DB에 맡기는 편이 안전합니다.
//   랭킹 조회(지역/종목/크루) > Java 랭킹 API > DB 연결 > SQL SELECT ... ORDER BY 점수 DESC (필요 시 캐싱)
const RANK_TABS=['지역별 랭킹','운동 종목별 랭킹','크루 랭킹'];
function renderRanking(){
  const i=state.subtabs.ranking;
  return `
  <div class="view-head"><h1>랭킹</h1><p>지역별 랭킹 → 운동 종목별 랭킹 → 크루 랭킹</p></div>
  <div class="subtabs">
    ${RANK_TABS.map((t,idx)=>`<div class="tab ${i===idx?'active':''}" onclick="setSub('ranking',${idx})">${t}</div>`).join('')}
  </div>
  ${i===0?renderRankRegion(): i===1?renderRankExercise(): renderCrewRegionRank()}`;
}
// (#7) 1~3등은 캐릭터를 올림픽 단상 형태로, 4등부터는 기존 리스트로 보여주는 공용 포디움 컴포넌트.
// rows는 이미 순위(rank)가 매겨진 배열이어야 하며, name/level/score 필드를 사용한다.
// (#2) 1~3위는 아바타 원이 아니라 실제 픽셀 캐릭터를 단상 위에 세운다. 랭킹에 오른 다른
// 사용자의 실제 장착 아이템·성별 데이터는 없으므로, 이름을 시드로 한 결정론적 값으로
// 캐릭터 외형(성별·의상 유무)만 살짝 다르게 흉내낸다.
function renderPodium(rows){
  const byRank=r=>rows.find(x=>x.rank===r);
  const first=byRank(1), second=byRank(2), third=byRank(3);
  const step=(r,cls,size)=>{
    if(!r) return '<div class="podium-step" style="visibility:hidden;"></div>';
    const cid=`podium-char-${cls}-${Math.abs(hashStr(r.name+cls))}`;
    return `
    <div class="podium-step ${cls}">
      <canvas class="podium-canvas" id="${cid}" data-seed="${r.name}" style="width:${size}px;height:${Math.round(size*1.22)}px;"></canvas>
      <div class="podium-name">${r.name}${r.isMe?' <span class="pill pill-accent">나</span>':''}</div>
      ${r.level!=null?`<div class="podium-lv mono">Lv.${r.level}</div>`:''}
      <div class="podium-score mono">${r.isMe?'내 점수 ':''}${r.score.toLocaleString()}</div>
      <div class="podium-stand">${r.rank}</div>
    </div>`;
  };
  return `<div class="podium">${step(second,'rank2',52)}${step(first,'rank1',66)}${step(third,'rank3',52)}</div>`;
}
// 화면에 존재하는 모든 포디움 캔버스를 그린다. (render() 끝에서 매번 호출 — 포디움이 없는
// 화면에서는 querySelectorAll 결과가 비어 있어 아무 일도 하지 않는다.)
function drawPodiumChars(){
  document.querySelectorAll('canvas.podium-canvas').forEach(canvas=>{
    const seed=canvas.dataset.seed||'x';
    const h=hashStr(seed);
    const equip={ outfit:h%2===0, crown:false, badge:false, background:false, skin:false };
    const gender=h%3===0?'female':'male';
    drawPixelCharacter(canvas, equip, gender);
  });
}
const PERSON_NAME_POOL=['런닝수달','써니핏','단백질맨','헬스왕','조깅요정','버피장인','파워워커','헬스메이트','런지킹','조깅단장','바다사나이','배드민턴킹'];
// 동(dong)을 시드로 결정론적인 이웃 랭킹을 만든다. 실제로는 SQL SELECT ... ORDER BY 점수로 대체될 자리.
function getDongPersonRanking(dong){
  const seed=hashStr(dong+'person');
  const names=[];
  let idx=seed;
  while(names.length<4){
    idx=(idx*48271+1)%2147483647;
    const nm=PERSON_NAME_POOL[idx%PERSON_NAME_POOL.length];
    if(!names.includes(nm)) names.push(nm);
  }
  return names.map((name,i)=>({ name, level:Math.max(1, 11-i*2-(seed%3)), score:5100-i*380-(seed%90) }));
}
function totalScore(){ return state.history.reduce((s,h)=>s+h.score,0); }
// (#16) 지역별 랭킹: 시/구/동 드롭다운으로 좁히고, 순위 집계는 동 기준을 유지한다.
function getRegionRanking(dong){
  const myDong = state.user.region.trim().split(/\s+/).pop();
  const neighbors = getDongPersonRanking(dong).map(n=>({...n, isMe:false}));
  const rows = dong===myDong
    ? [...neighbors.slice(0,3), {name:state.user.nickname||'홈트초보', score:totalScore(), level:state.user.level, isMe:true}]
    : neighbors;
  return rows.sort((a,b)=>b.score-a.score).map((r,i)=>({...r, rank:i+1}));
}
function renderRankRegion(){
  const f=state.rankFilter;
  const cities=Object.keys(REGION_DATA);
  const city=REGION_DATA[f.city]?f.city:cities[0];
  const gus=Object.keys(REGION_DATA[city]);
  const gu=REGION_DATA[city][f.gu]?f.gu:gus[0];
  const dongs=REGION_DATA[city][gu];
  const dong=dongs.includes(f.dong)?f.dong:dongs[0];
  const rows=getRegionRanking(dong);
  const rest=rows.filter(r=>r.rank>3);
  return `
  <div class="filter-bar">
    <select onchange="setRankCity(this.value)">${cities.map(c=>`<option ${c===city?'selected':''}>${c}</option>`).join('')}</select>
    <select onchange="setRankGu(this.value)">${gus.map(g=>`<option ${g===gu?'selected':''}>${g}</option>`).join('')}</select>
    <select onchange="setRankDong(this.value)">${dongs.map(d=>`<option ${d===dong?'selected':''}>${d}</option>`).join('')}</select>
  </div>
  ${renderPodium(rows)}
  ${rest.length?`
  <div class="table-wrap">
    <table>
      <thead><tr><th>순위</th><th>닉네임</th><th>레벨</th><th>누적 점수</th></tr></thead>
      <tbody>
        ${rest.map(r=>`
          <tr>
            <td><span class="rank-num">${r.rank}</span></td>
            <td><span class="name-cell"><span class="user-avatar" style="background:${avatarColor(r.rank-1)}">${avatarInitial(r.name)}</span>${r.name}${r.isMe?' <span class="pill pill-accent">나</span>':''}</span></td>
            <td class="mono">Lv.${r.level}</td>
            <td class="mono">${r.score.toLocaleString()}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`:''}`;
}
function setRankCity(v){ state.rankFilter={city:v, gu:null, dong:null}; render(); }
function setRankGu(v){ state.rankFilter.gu=v; state.rankFilter.dong=null; render(); }
function setRankDong(v){ state.rankFilter.dong=v; render(); }

// (#17) 운동 종목별 랭킹: 시/구/동 + 운동종목 드롭다운. 점수는 해당 종목의 누적 점수를 의미한다.
function getExerciseRanking(dong, ex){
  const seed=hashStr(dong+ex);
  const names=[];
  let idx=seed;
  while(names.length<4){
    idx=(idx*48271+1)%2147483647;
    const nm=PERSON_NAME_POOL[idx%PERSON_NAME_POOL.length];
    if(!names.includes(nm)) names.push(nm);
  }
  const rows = names.map((name,i)=>({ name, level:Math.max(1, 10-i*2-(seed%3)), score:420-i*35-(seed%40) }));
  const myDong = state.user.region.trim().split(/\s+/).pop();
  if(dong===myDong){
    const myScore = state.history.filter(h=>h.ex===ex).reduce((s,h)=>s+h.score,0);
    rows[rows.length-1] = {name:state.user.nickname||'홈트초보', level:state.user.level, score:myScore, isMe:true};
  }
  return rows.sort((a,b)=>b.score-a.score).map((r,i)=>({...r, rank:i+1}));
}
function renderRankExercise(){
  const f=state.exRankFilter;
  const cities=Object.keys(REGION_DATA);
  const city=REGION_DATA[f.city]?f.city:cities[0];
  const gus=Object.keys(REGION_DATA[city]);
  const gu=REGION_DATA[city][f.gu]?f.gu:gus[0];
  const dongs=REGION_DATA[city][gu];
  const dong=dongs.includes(f.dong)?f.dong:dongs[0];
  const ex=EXS.some(e=>e.name===f.ex)?f.ex:EXS[0].name;
  const rows=getExerciseRanking(dong, ex);
  const rest=rows.filter(r=>r.rank>3);
  return `
  <div class="filter-bar">
    <select onchange="setExRankCity(this.value)">${cities.map(c=>`<option ${c===city?'selected':''}>${c}</option>`).join('')}</select>
    <select onchange="setExRankGu(this.value)">${gus.map(g=>`<option ${g===gu?'selected':''}>${g}</option>`).join('')}</select>
    <select onchange="setExRankDong(this.value)">${dongs.map(d=>`<option ${d===dong?'selected':''}>${d}</option>`).join('')}</select>
    <select onchange="setExRankEx(this.value)">${EXS.map(e=>`<option ${e.name===ex?'selected':''}>${e.name}</option>`).join('')}</select>
  </div>
  <p class="hint" style="margin:-6px 0 14px;">점수는 ${ex} 종목의 누적 점수 기준입니다.</p>
  ${renderPodium(rows)}
  ${rest.length?`
  <div class="table-wrap">
    <table>
      <thead><tr><th>순위</th><th>닉네임</th><th>${ex} 누적점수</th></tr></thead>
      <tbody>${rest.map(r=>`<tr><td><span class="rank-num">${r.rank}</span></td><td>${r.name}${r.isMe?' <span class="pill pill-accent">나</span>':''}</td><td class="mono">${r.score.toLocaleString()}</td></tr>`).join('')}</tbody>
    </table>
  </div>`:''}`;
}
function setExRankCity(v){ state.exRankFilter={...state.exRankFilter, city:v, gu:null, dong:null}; render(); }
function setExRankGu(v){ state.exRankFilter.gu=v; state.exRankFilter.dong=null; render(); }
function setExRankDong(v){ state.exRankFilter.dong=v; render(); }
function setExRankEx(v){ state.exRankFilter.ex=v; render(); }
function groupHistoryByDate(){
  const map={};
  state.history.forEach(h=>{ (map[h.date]=map[h.date]||[]).push(h); });
  return Object.entries(map);
}
function getScoreBonusPct(){
  const badge=state.shopItems.find(it=>it.slot==='badge');
  if(!badge || !badge.owned || !badge.equipped) return 0;
  const m=badge.effect.match(/\+(\d+)/);
  return m ? +m[1] : 0;
}
function renderHistory(){
  const groups=groupHistoryByDate();
  const bonusPct=getScoreBonusPct();
  if(!groups.length) return `<div class="empty-note">아직 운동 기록이 없습니다.</div>`;
  return `
  <div style="display:flex;flex-direction:column;gap:16px;">
    ${groups.map(([date,entries])=>`
      <div class="card">
        <div class="flex-between" style="margin-bottom:10px;">
          <p class="section-label" style="margin:0;">${date}</p>
          <span class="pill pill-muted">${entries.length}개 종목</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${entries.map(h=>{
            const gc=h.gc||{PERFECT:0,GREAT:0,GOOD:0,MISS:0};
            const gcTotal=Object.values(gc).reduce((a,b)=>a+b,0)||1;
            const pct=k=>Math.round((gc[k]||0)/gcTotal*100);
            const bonus=Math.round(h.score*bonusPct/100);
            const finalScore=h.score+bonus;
            return `
            <div style="border:1px solid var(--line);border-radius:10px;padding:12px;">
              <div class="flex-between">
                <b>${h.ex}</b>
                ${gradePill(h.grade)}
              </div>
              <p class="desc" style="margin:6px 0;">유효 횟수 ${h.reps}회 · 전체 정확도 ${h.acc}%</p>
              <div class="stat-row" style="margin:0;">
                <div class="stat-box"><div class="num mono" style="color:var(--accent)">${pct('PERFECT')}%</div><div class="lbl">PERFECT</div></div>
                <div class="stat-box"><div class="num mono" style="color:var(--gold)">${pct('GREAT')}%</div><div class="lbl">GREAT</div></div>
                <div class="stat-box"><div class="num mono">${pct('GOOD')}%</div><div class="lbl">GOOD</div></div>
              </div>
              <p class="desc mono" style="margin-top:8px;">획득 점수 : ${h.score}${bonusPct>0?` + 아이템효과 ${bonusPct}% = ${finalScore}`:''}</p>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('')}
  </div>`;
}
/* ========================================================================
   고객센터 · 불편사항접수
   ======================================================================== */
// (FR-CS-001) 티켓 접수/조회, 신고 처리(삭제·기각)는 모두 관리자용 API가 함께 필요한 구간입니다.
//   불편사항 접수(submitTicket) > Java 고객센터 API > DB 연결 > SQL INSERT(티켓 테이블)
//   신고 처리(삭제/기각 버튼) > Java 관리자 API(운영팀 권한 확인) > DB 연결 > SQL UPDATE/DELETE(게시글, 신고 테이블)
//   운영팀 답변 등록도 같은 API에서 SQL UPDATE(티켓 테이블 reply, status 컬럼)로 처리하면 됩니다.
function renderSupport(){
  const s=state.support;
  const list = s.filter==='all' ? s.tickets : s.tickets.filter(t=>t.status===s.filter);
  return `
  <div class="view-head"><h1>고객센터</h1><p>불편사항접수 게시판 — Error 신고 및 추후 추가사항 의견을 접수하고 처리 현황을 확인합니다.</p></div>
  <div class="card" style="margin-bottom:20px;">
    <p class="section-label">신고 관리</p>
    <div class="table-wrap"><table>
      <thead><tr><th>게시물</th><th>사유</th><th>처리</th></tr></thead>
      <tbody>
        <tr><td>플랭크 3분 인증</td><td>부적절한 이미지</td><td><button class="btn btn-sm btn-danger" onclick="toast('게시물이 삭제되었습니다')">삭제</button></td></tr>
        <tr><td>버피 20회 인증</td><td>스팸성 홍보</td><td><button class="btn btn-sm btn-ghost" onclick="toast('신고가 기각되었습니다')">기각</button></td></tr>
      </tbody>
    </table></div>
  </div>
  <div class="flex-between" style="margin-bottom:14px;">
    <div class="filter-bar" style="margin:0;">
      ${['all','접수','처리중','답변완료'].map(f=>`
        <button class="btn btn-sm ${s.filter===f?'btn-primary':'btn-secondary'}" onclick="setSupportFilter('${f}')">${f==='all'?'전체':f}</button>`).join('')}
    </div>
    <button class="btn btn-primary btn-sm" onclick="toggleComposer()">${s.composerOpen?'접기':'불편사항 접수하기'}</button>
  </div>

  ${s.composerOpen ? `
  <div class="card" style="max-width:560px;margin-bottom:20px;">
    <p class="section-label">새 불편사항 접수</p>
    <div class="field"><label for="sp-type">유형</label>
      <select id="sp-type"><option>Error</option><option>기능제안</option><option>기타</option></select>
    </div>
    <div class="field"><label for="sp-title">제목</label><input id="sp-title" placeholder="어떤 문제인지 한 줄로 요약해주세요"></div>
    <div class="field"><label for="sp-body">내용</label><textarea id="sp-body" rows="4" placeholder="언제, 어떤 화면에서, 어떤 문제가 발생했는지 알려주세요"></textarea></div>
    <button class="btn btn-primary" onclick="submitTicket()">접수하기</button>
  </div>` : ''}

  <div class="grid grid-2">
    ${list.length===0 ? `<div class="empty-note">해당하는 접수 내역이 없습니다.</div>` : list.map(t=>`
      <div class="card">
        <div class="flex-between">
          <span class="pill ${t.type==='Error'?'pill-danger':t.type==='기능제안'?'pill-accent':'pill-muted'}">${t.type}</span>
          <span class="pill ${t.status==='답변완료'?'pill-accent':t.status==='처리중'?'pill-gold':'pill-muted'}">${t.status}</span>
        </div>
        <h3 style="margin-top:10px;">${t.title}</h3>
        <p class="desc">${t.body}</p>
        <p class="hint" style="margin-bottom:${t.reply?'10px':'0'};">접수일 ${t.date}</p>
        ${t.reply ? `
        <div style="background:var(--surface-2);border-radius:10px;padding:10px 12px;">
          <p class="hint" style="margin:0 0 4px;color:var(--accent);font-weight:700;">운영팀 답변</p>
          <p class="desc" style="margin:0;">${t.reply}</p>
        </div>` : ''}
      </div>`).join('')}
  </div>`;
}
function setSupportFilter(f){state.support.filter=f; render();}
function toggleComposer(){state.support.composerOpen=!state.support.composerOpen; render();}
function submitTicket(){
  const type=document.getElementById('sp-type').value;
  const title=document.getElementById('sp-title').value.trim();
  const body=document.getElementById('sp-body').value.trim();
  if(!title || !body){toast('제목과 내용을 입력해주세요'); return;}
  state.support.tickets.unshift({id:Date.now(), type, title, body, status:'접수', date:'오늘', reply:''});
  state.support.composerOpen=false;
  state.support.filter='all';
  toast('불편사항이 접수되었습니다');
  render();
}

/* ========================================================================
   5. 설정
   ======================================================================== */
// (FR-ST-001) 계정 정보 수정, 공개범위 설정, 회원탈퇴는 각각 DB에 실제로 반영돼야 하는 지점입니다.
//   프로필 저장(saveAccount) > Java 계정 API > DB 연결 > SQL UPDATE(계정 테이블)
//   공개범위 저장(renderSetPrivacy 안의 토글/셀렉트) > Java 계정 API > DB 연결 > SQL UPDATE(공개범위 컬럼)
//   회원 탈퇴(doWithdraw) > Java 계정 API > DB 연결 > SQL DELETE(계정 및 연관 테이블 — 운동기록/포인트/크루 등)
// 카메라·알림 설정(renderSetCamera)은 기기/브라우저 설정에 가까워 로컬 저장(localStorage)만으로도
// 충분하며, 반드시 서버까지 갈 필요는 없습니다.
function renderSetAccount(){
  const a=state.settings.account;
  const cities=Object.keys(REGION_DATA);
  const city=REGION_DATA[a.regionCity]?a.regionCity:cities[0];
  const gus=Object.keys(REGION_DATA[city]);
  const gu=REGION_DATA[city][a.regionGu]?a.regionGu:gus[0];
  const dongs=REGION_DATA[city][gu];
  const dong=dongs.includes(a.regionDong)?a.regionDong:dongs[0];
  const canEditNick = (state.user.nicknameTickets||0) > 0;
  return `
  <div class="card" style="max-width:460px;">
    <p class="section-label">프로필</p>
    <div class="field">
      <label for="acc-nick">닉네임</label>
      <input id="acc-nick" value="${state.user.nickname}" ${canEditNick?'':'disabled'}>
      <p class="hint">${canEditNick ? `닉네임 변경권 보유중 · 저장 시 1장이 사용됩니다 (남은 수량 ${state.user.nicknameTickets}장)` : `닉네임 변경은 포인트 상점에서 '닉네임 변경권'을 구매한 뒤 가능합니다.`}</p>
      ${canEditNick?'':'<button class="btn btn-sm btn-secondary" style="margin-top:6px;" onclick="setMenu(\'shop\')">포인트 상점으로 이동</button>'}
    </div>
    <div class="field">
      <label>활동 지역</label>
      <div class="field-row">
        <select onchange="setAccountCity(this.value)" style="flex:1;min-width:0;">${cities.map(c=>`<option ${c===city?'selected':''}>${c}</option>`).join('')}</select>
        <select onchange="setAccountGu(this.value)" style="flex:1;min-width:0;">${gus.map(g=>`<option ${g===gu?'selected':''}>${g}</option>`).join('')}</select>
        <select onchange="setAccountDong(this.value)" style="flex:1;min-width:0;">${dongs.map(d=>`<option ${d===dong?'selected':''}>${d}</option>`).join('')}</select>
      </div>
    </div>
    <button class="btn btn-primary" onclick="saveAccount()">저장</button>
  </div>`;
}
function setAccountCity(v){ state.settings.account.regionCity=v; state.settings.account.regionGu=null; state.settings.account.regionDong=null; render(); }
function setAccountGu(v){ state.settings.account.regionGu=v; state.settings.account.regionDong=null; render(); }
function setAccountDong(v){ state.settings.account.regionDong=v; render(); }
function saveAccount(){
  const a=state.settings.account;
  let nickMsg='';
  const nickEl=document.getElementById('acc-nick');
  if(nickEl && !nickEl.disabled){
    const newNick=nickEl.value.trim();
    if(newNick && newNick!==state.user.nickname){
      if(EXISTING_USERS.some(u=>u.nickname===newNick)){ toast('이미 사용중인 닉네임입니다'); return; }
      state.user.nicknameTickets--;
      state.user.nickname=newNick;
      a.nickname=newNick;
      nickMsg = ` · 닉네임 변경 (남은 변경권 ${state.user.nicknameTickets}장)`;
    }
  }
  state.user.region = `${a.regionCity} ${a.regionGu} ${a.regionDong}`;
  toast(`프로필이 저장되었습니다${nickMsg}`);
  render();
}
function renderSetCalib(){
  return `
  <div class="card" style="max-width:460px;">
    <p class="section-label">카메라 캘리브레이션</p>
    <p class="desc">촬영 각도·거리·신체 비율을 다시 측정하여 분석 정확도를 갱신합니다.</p>
    <button class="btn btn-secondary btn-block" onclick="toast('체형 보정을 다시 진행했습니다')">캘리브레이션 다시 진행</button>
  </div>`;
}
function renderSetCamera(){
  return `
  <div class="card" style="max-width:520px;">
    <div class="toggle-row"><div><div class="t-label">운동 알림</div><div class="t-desc">미션·팀 활동 알림 수신</div></div>
      <div class="switch ${state.settings.notif?'on':''}" onclick="this.classList.toggle('on')"><span class="knob"></span></div></div>
    <div class="toggle-row"><div><div class="t-label">촬영 효과음</div><div class="t-desc">촬영 시작·종료 알림음</div></div>
      <div class="switch ${state.settings.sound?'on':''}" onclick="this.classList.toggle('on')"><span class="knob"></span></div></div>
    <div class="toggle-row"><div><div class="t-label">카메라 해상도</div><div class="t-desc">촬영 품질 설정</div></div>
      <select><option ${state.settings.camRes==='720p'?'selected':''}>720p</option><option ${state.settings.camRes==='1080p'?'selected':''}>1080p</option></select></div>
  </div>`;
}
function renderSetPrivacy(){
  return `
  <div class="card" style="max-width:520px;">
    <div class="toggle-row"><div><div class="t-label">프로필 공개 범위</div><div class="t-desc">랭킹에서 프로필 노출 대상</div></div>
      <select><option>전체공개</option><option>크루공개</option><option>비공개</option></select></div>
    <div class="toggle-row"><div><div class="t-label">운동 기록 공개 범위</div><div class="t-desc">운동 히스토리 노출 대상</div></div>
      <select><option>전체공개</option><option selected>크루공개</option><option>비공개</option></select></div>
    <div class="toggle-row"><div><div class="t-label">촬영 영상 공개</div><div class="t-desc">리플레이 영상 자동 공개 여부</div></div>
      <div class="switch" onclick="this.classList.toggle('on')"><span class="knob"></span></div></div>
  </div>`;
}
function renderSetLogout(){
  return `
  <div class="grid grid-2">
    <div class="card">
      <p class="section-label">로그아웃</p>
      <p class="desc">현재 계정에서 로그아웃합니다.</p>
      <button class="btn btn-secondary" onclick="doLogout()">로그아웃</button>
    </div>
    <div class="card">
      <p class="section-label">회원 탈퇴</p>
      <p class="desc">모든 운동 기록과 포인트가 삭제되며 복구할 수 없습니다.</p>
      <button class="btn btn-danger" onclick="askConfirm('정말 탈퇴하시겠어요?','모든 운동 기록, 포인트, 홈크루 정보가 영구히 삭제됩니다.',doWithdraw,'탈퇴하기',true)">회원 탈퇴</button>
    </div>
  </div>`;
}
function doLogout(){state.screen='login'; render();}
function doWithdraw(){
  closeConfirm();
  toast('회원 탈퇴가 완료되었습니다');
  setTimeout(()=>{
    location.reload();
  },900);
}

/* ---------- confirm dialog ---------- */
function renderConfirm(){
  const c=state.confirm;
  return `
  <div class="confirm-backdrop" onclick="if(event.target===this)closeConfirm()">
    <div class="confirm-box">
      <h3>${c.title}</h3>
      <p>${c.desc}</p>
      <div class="confirm-actions">
        <button class="btn btn-ghost btn-sm" onclick="closeConfirm()">취소</button>
        <button class="btn ${c.danger?'btn-danger':'btn-primary'} btn-sm" id="confirm-yes">${c.yesLabel}</button>
      </div>
    </div>
  </div>`;
}
document.addEventListener('click', e=>{
  if(e.target && e.target.id==='confirm-yes' && state.confirm){ state.confirm.onYes(); }
});

render();

/* ============================================================================
   [파일 하단 요약] 프론트/백엔드 경계 & 기술스택 정리
   ----------------------------------------------------------------------------
   이 script.js 전체는 지금은 순수 프론트엔드 목업입니다. state 객체 하나가
   서버·DB 역할을 대신하고 있고, 화면은 render()가 매번 통째로 다시 그립니다.

   [프론트엔드 — 그대로 유지]
     - 기술스택: HTML5 / CSS3 / JavaScript(ES6+, 바닐라)
     - 자세 인식: MediaPipe Pose (Tasks Vision, WASM) — calStartCamera ~ calComputeProfile,
       setupCamera ~ toggleRecording 구간. 전부 브라우저 안에서 실행되고 서버로 영상을
       보내지 않으므로 백엔드가 필요 없습니다.
     - 캔버스 드로잉(픽셀 캐릭터 drawPixelCharacter, 관절 포인트 편집 calEditRender 등)도
       전부 클라이언트 전용 로직입니다.

   [백엔드 — 새로 구현해야 하는 부분]
     - 제안 기술스택: Java 17+ / Spring Boot(Spring MVC) REST API, Spring Security(인증/JWT)
     - 코드 안에 "// [백엔드 연동 필요 구간]"이라고 표시된 곳들이 전부 여기에 해당합니다.
       (회원가입/로그인/소셜로그인, 캘리브레이션 저장, 운동기록 저장, 미션 보상 지급,
        상점 구매, 크루 생성/가입/공지/가입승인/강퇴, 랭킹 조회, 고객센터, 계정설정 등)
     - 실시간(WebSocket) 서버는 필요 없습니다 — 크루 채팅 기능은 삭제되었고 나머지 기능은
       모두 REST(요청-응답)로 충분합니다.

   [데이터베이스 — 새로 구현해야 하는 부분]
     - 제안 기술스택: MySQL 8 + Spring Data JPA(또는 MyBatis)
     - "DB 연결 > SQL ..." 로 표시된 부분이 실제 테이블 CRUD가 필요한 지점입니다.
     - 최소한으로 필요한 테이블 예시: 계정, 캘리브레이션 프로필, 운동기록, 미션, 미션진행도,
       상점아이템, 보유아이템, 크루, 크루원, 크루공지, 크루가입요청, 게시글, 좋아요/신고,
       고객센터티켓

   위 스택 이름(Java/Spring Boot/MySQL 등)은 팀 표준에 맞게 자유롭게 바꿔서 읽으면 됩니다 —
   이 주석의 목적은 "정확한 제품명 고정"이 아니라 프론트/백엔드/DB 경계 자체를 표시하는 것입니다.
   ============================================================================ */
