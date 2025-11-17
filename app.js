/*
  app.js — Single Page Quiz App (Option A)
  Features:
  - Login with SHA-256 (compares against users.json)
  - Loads quiz.json (sections + questions)
  - Timer: 1 minute per question (total computed)
  - Auto moves to next section after last question in a section
  - Results page shows selected and correct answers
  - Stores result in localStorage (optional)
*/

// UTIL: SHA-256 using SubtleCrypto, returns hex
async function sha256hex(message){
  const enc = new TextEncoder();
  const data = enc.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

let usersDB = {};
let quizData = null;
let state = {
  username: null,
  sectionIndex: 0,
  questionIndex: 0,
  answers: {}, // { "q1": selectedIndex }
  remainingSeconds: 0,
  timerInterval: null
};

document.addEventListener('DOMContentLoaded', init);

async function init(){
  // fetch users and quiz
  usersDB = await fetch('users.json').then(r => r.json());
  quizData = await fetch('quiz.json').then(r => r.json());
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('prevBtn').addEventListener('click', prevQuestion);
  document.getElementById('nextBtn').addEventListener('click', nextQuestion);
  document.getElementById('finishBtn').addEventListener('click', finishQuiz);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  renderLoginHints();
}

function renderLoginHints(){
  const h = document.querySelector('.hint');
  h.innerText = "Sample users: JCV001 → Pass@01, JCV002 → Abc@12 (for testing). After deploy, replace users.json with your hashed list.";
}

// LOGIN
async function doLogin(){
  const user = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value;
  const msg = document.getElementById('loginMessage');
  msg.innerText = '';
  if(!user || !pass){ msg.innerText = 'Enter username and password'; return; }
  if(!usersDB[user]){ msg.innerText = 'User not found'; return; }
  const hash = await sha256hex(pass);
  if(hash === usersDB[user]){
    state.username = user;
    showQuizScreen();
    startQuiz();
  } else {
    msg.innerText = 'Invalid username or password!';
  }
}

function showQuizScreen(){
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('quiz-screen').classList.remove('hidden');
  document.getElementById('result-screen').classList.add('hidden');
  document.getElementById('quiz-title').innerText = quizData.title || 'Quiz';
}

// QUIZ FLOW
function startQuiz(){
  // compute total time: 1 minute per question (60 sec)
  const totalQuestions = quizData.sections.reduce((acc,s)=>acc + s.questions.length, 0);
  state.remainingSeconds = totalQuestions * 60;
  updateTimerDisplay();
  state.sectionIndex = 0;
  state.questionIndex = 0;
  state.answers = {};
  renderCurrentQuestion();
  // start timer
  if(state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(()=>{
    state.remainingSeconds--;
    updateTimerDisplay();
    if(state.remainingSeconds <= 0){
      clearInterval(state.timerInterval);
      finishQuiz();
    }
  }, 1000);
}

function updateTimerDisplay(){
  const el = document.getElementById('time-remaining');
  const s = state.remainingSeconds;
  const mm = Math.floor(s/60).toString().padStart(2,'0');
  const ss = Math.floor(s%60).toString().padStart(2,'0');
  el.innerText = `${mm}:${ss}`;
}

function renderCurrentQuestion(){
  const section = quizData.sections[state.sectionIndex];
  const q = section.questions[state.questionIndex];
  const container = document.getElementById('quiz-container');
  container.innerHTML = '';
  const header = document.createElement('div');
  header.innerHTML = `<h3>${section.title}</h3><small class="muted">Question ${state.questionIndex+1} of ${section.questions.length} in this section</small>`;
  container.appendChild(header);

  const card = document.createElement('div');
  card.className = 'question-card';
  const qtext = document.createElement('p');
  qtext.innerHTML = '<strong>' + q.text + '</strong>';
  card.appendChild(qtext);

  q.options.forEach((opt, idx)=>{
    const op = document.createElement('div');
    op.className = 'option';
    op.dataset.idx = idx;
    op.innerText = opt;
    // mark selected if available
    if(state.answers[q.id] === idx) op.classList.add('selected');
    op.addEventListener('click', ()=> {
      state.answers[q.id] = idx;
      // visually update options
      card.querySelectorAll('.option').forEach(el=>el.classList.remove('selected'));
      op.classList.add('selected');
    });
    card.appendChild(op);
  });

  container.appendChild(card);

  // update navigation buttons
  document.getElementById('prevBtn').disabled = (state.sectionIndex === 0 && state.questionIndex === 0);
  // if last section and last question -> show finish
  const isLast = (state.sectionIndex === quizData.sections.length -1) && (state.questionIndex === section.questions.length -1);
  document.getElementById('finishBtn').classList.toggle('hidden', !isLast);
}

function nextQuestion(){
  const section = quizData.sections[state.sectionIndex];
  if(state.questionIndex < section.questions.length -1){
    state.questionIndex++;
  } else {
    // move to next section automatically
    if(state.sectionIndex < quizData.sections.length -1){
      state.sectionIndex++;
      state.questionIndex = 0;
    } else {
      // already at last question
      finishQuiz();
      return;
    }
  }
  renderCurrentQuestion();
}

function prevQuestion(){
  if(state.questionIndex > 0){
    state.questionIndex--;
  } else if(state.sectionIndex > 0){
    state.sectionIndex--;
    const prevSection = quizData.sections[state.sectionIndex];
    state.questionIndex = prevSection.questions.length -1;
  }
  renderCurrentQuestion();
}

function finishQuiz(){
  // stop timer
  if(state.timerInterval) clearInterval(state.timerInterval);
  // compute score and display results
  const results = [];
  let correctCount = 0;
  quizData.sections.forEach(section=>{
    section.questions.forEach(q=>{
      const sel = state.answers[q.id];
      const isCorrect = (typeof sel !== 'undefined') && (sel === q.answer);
      if(isCorrect) correctCount++;
      results.push({
        id: q.id,
        text: q.text,
        options: q.options,
        selected: (typeof sel === 'undefined') ? null : sel,
        correct: q.answer
      });
    });
  });

  // save to localStorage
  const record = {
    username: state.username,
    timestamp: new Date().toISOString(),
    total: results.length,
    correct: correctCount,
    remainingSeconds: state.remainingSeconds,
    details: results
  };
  const key = 'jcvquiz_results_' + Date.now();
  localStorage.setItem(key, JSON.stringify(record));

  showResults(record);
}

function showResults(record){
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('quiz-screen').classList.add('hidden');
  document.getElementById('result-screen').classList.remove('hidden');

  const sum = document.getElementById('result-summary');
  sum.innerHTML = `<p><strong>User:</strong> ${record.username}</p>
                   <p><strong>Score:</strong> ${record.correct} / ${record.total}</p>
                   <p><strong>Time left:</strong> ${Math.floor(record.remainingSeconds/60)}m ${record.remainingSeconds%60}s</p>`;

  const details = document.getElementById('result-details');
  details.innerHTML = '';
  record.details.forEach(r=>{
    const row = document.createElement('div');
    row.className = 'result-row';
    let html = `<strong>${r.text}</strong><br/>`;
    r.options.forEach((opt, idx)=>{
      const mark = (idx === r.correct) ? ' (Correct)' : '';
      const usermark = (r.selected === idx) ? ' — Your choice' : '';
      // highlight correct and wrong choices visually
      if(r.selected === idx && idx === r.correct){
        html += `<div class="option correct">${opt}${mark}${usermark}</div>`;
      } else if(r.selected === idx && idx !== r.correct){
        html += `<div class="option wrong">${opt}${usermark}</div>`;
      } else if(idx === r.correct){
        html += `<div class="option correct">${opt}${mark}</div>`;
      } else {
        html += `<div class="option">${opt}</div>`;
      }
    });
    row.innerHTML = html;
    details.appendChild(row);
  });
}

function logout(){
  // clear state and go back to login
  state = { username: null, sectionIndex:0, questionIndex:0, answers:{}, remainingSeconds:0, timerInterval:null};
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('loginMessage').innerText = '';
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('quiz-screen').classList.add('hidden');
  document.getElementById('result-screen').classList.add('hidden');
}
