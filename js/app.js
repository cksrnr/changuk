/* =====================================================================
 * 실시간 통역 통화 (Korean Live Interpreter)
 * - 브라우저 내장 Web Speech API 로 음성 인식(STT) / 음성 합성(TTS)
 * - 무료 공개 번역 API (MyMemory, 키 불필요) 로 번역
 * - 한국어 ↔ 영어 양방향
 *
 * 사용법: 통화를 "스피커폰"으로 켠 뒤,
 *   - 내가 한국어로 말할 때  → [한국어 듣기]
 *   - 상대가 영어로 말할 때  → [English 듣기]
 * ===================================================================== */

(() => {
  "use strict";

  // ---- 언어 설정 (한↔영) --------------------------------------------
  const LANGS = {
    ko: { stt: "ko-KR", tts: "ko-KR", code: "ko", name: "한국어", flag: "🇰🇷" },
    en: { stt: "en-US", tts: "en-US", code: "en", name: "English", flag: "🇺🇸" },
  };

  // ---- DOM ----------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const koBtn = $("koBtn");
  const enBtn = $("enBtn");
  const logEl = $("log");
  const statusEl = $("status");
  const clearBtn = $("clearBtn");
  const autoSpeakEl = $("autoSpeak");
  const continuousEl = $("continuous");

  // ---- 음성 인식 지원 여부 확인 --------------------------------------
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setStatus(
      "이 브라우저는 음성 인식을 지원하지 않습니다. Chrome(안드로이드/PC) 또는 Safari(iOS)를 사용하세요.",
      "error"
    );
    koBtn.disabled = true;
    enBtn.disabled = true;
    return;
  }

  // ---- 상태 ---------------------------------------------------------
  let recognition = null;
  let listeningFrom = null; // 'ko' | 'en' | null
  let manuallyStopped = false;
  let currentInterimBubble = null;

  showEmpty();

  // ---- 버튼 이벤트 --------------------------------------------------
  koBtn.addEventListener("click", () => toggleListen("ko"));
  enBtn.addEventListener("click", () => toggleListen("en"));
  clearBtn.addEventListener("click", () => {
    logEl.innerHTML = "";
    showEmpty();
  });

  /** 듣기 시작/중지 토글 */
  function toggleListen(from) {
    if (listeningFrom === from) {
      stopListening();
      return;
    }
    startListening(from);
  }

  function startListening(from) {
    stopListening(); // 진행 중인 인식 정리
    window.speechSynthesis && window.speechSynthesis.cancel(); // TTS 중단

    const src = LANGS[from];
    recognition = new SpeechRecognition();
    recognition.lang = src.stt;
    recognition.interimResults = true;
    recognition.continuous = false; // 한 발화 단위로 처리 (모바일 호환성 ↑)
    recognition.maxAlternatives = 1;

    manuallyStopped = false;
    listeningFrom = from;
    currentInterimBubble = null;
    updateButtons();
    setStatus(`${src.flag} ${src.name} 듣는 중…`, "listening");

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }

      if (interim) showInterim(from, interim);
      if (finalText.trim()) {
        clearInterim();
        handleFinal(from, finalText.trim());
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setStatus("마이크 권한이 필요합니다. 브라우저 설정에서 허용해 주세요.", "error");
        manuallyStopped = true;
      } else {
        setStatus("인식 오류: " + e.error, "error");
      }
    };

    recognition.onend = () => {
      // 연속 모드면 같은 방향으로 자동 재시작
      if (!manuallyStopped && continuousEl.checked && listeningFrom === from) {
        try {
          recognition.start();
          setStatus(`${src.flag} ${src.name} 듣는 중…(연속)`, "listening");
          return;
        } catch (_) { /* 재시작 실패 시 아래로 */ }
      }
      if (listeningFrom === from) {
        listeningFrom = null;
        updateButtons();
        setStatus("준비됨");
      }
    };

    try {
      recognition.start();
    } catch (err) {
      setStatus("시작 실패: " + err.message, "error");
      listeningFrom = null;
      updateButtons();
    }
  }

  function stopListening() {
    manuallyStopped = true;
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
    listeningFrom = null;
    clearInterim();
    updateButtons();
  }

  // ---- 최종 발화 처리: 번역 + 표시 + TTS ----------------------------
  async function handleFinal(from, text) {
    const to = from === "ko" ? "en" : "ko";
    const bubble = addBubble(from, text, "…");
    try {
      const translated = await translate(text, from, to);
      setBubbleTranslation(bubble, translated, to);
      if (autoSpeakEl.checked) speak(translated, to);
    } catch (err) {
      setBubbleTranslation(bubble, "(번역 실패: " + err.message + ")", to, true);
    }
  }

  // ---- 번역 (MyMemory 무료 공개 API, 키 불필요) ---------------------
  // 문서: https://mymemory.translated.net/doc/spec.php
  async function translate(text, from, to) {
    const pair = `${LANGS[from].code}|${LANGS[to].code}`;
    const url =
      "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(text) +
      "&langpair=" +
      encodeURIComponent(pair);

    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const out = data && data.responseData && data.responseData.translatedText;
    if (!out) throw new Error("빈 응답");
    // MyMemory는 한도 초과 시 안내 문구를 본문에 담아 보내기도 함
    if (/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) {
      throw new Error("일일 번역 한도 초과");
    }
    return decodeHTML(out);
  }

  // ---- 음성 합성 (TTS) ----------------------------------------------
  let voicesCache = [];
  function loadVoices() {
    if (!window.speechSynthesis) return;
    voicesCache = window.speechSynthesis.getVoices() || [];
  }
  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  function speak(text, lang) {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANGS[lang].tts;
    const want = LANGS[lang].tts.toLowerCase();
    const voice =
      voicesCache.find((v) => v.lang && v.lang.toLowerCase() === want) ||
      voicesCache.find((v) => v.lang && v.lang.toLowerCase().startsWith(lang));
    if (voice) u.voice = voice;
    u.rate = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  // ---- UI 헬퍼 ------------------------------------------------------
  function updateButtons() {
    koBtn.classList.toggle("active", listeningFrom === "ko");
    enBtn.classList.toggle("active", listeningFrom === "en");
    koBtn.querySelector(".label").textContent =
      listeningFrom === "ko" ? "듣는 중… (탭하여 정지)" : "한국어 듣기";
    enBtn.querySelector(".label").textContent =
      listeningFrom === "en" ? "Listening… (tap to stop)" : "English 듣기";
  }

  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = "status" + (cls ? " " + cls : "");
  }

  function showEmpty() {
    if (logEl.children.length) return;
    const d = document.createElement("div");
    d.className = "empty";
    d.innerHTML =
      "통화를 스피커폰으로 켜고<br>아래 언어 버튼을 눌러 말해보세요.<br><br>" +
      "🇰🇷 한국어 → 영어로 번역·읽기<br>🇺🇸 English → 한국어로 번역·읽기";
    logEl.appendChild(d);
  }
  function removeEmpty() {
    const e = logEl.querySelector(".empty");
    if (e) e.remove();
  }

  function addBubble(from, orig, transPlaceholder) {
    removeEmpty();
    const b = document.createElement("div");
    b.className = "bubble " + from;
    const src = LANGS[from];
    b.innerHTML =
      '<div class="meta">' + src.flag + " " + src.name + " · " +
      new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) +
      "</div>" +
      '<div class="orig"></div>' +
      '<div class="trans"></div>';
    b.querySelector(".orig").textContent = orig;
    b.querySelector(".trans").textContent = transPlaceholder;
    logEl.appendChild(b);
    scrollToBottom();
    return b;
  }

  function setBubbleTranslation(bubble, text, toLang, isError) {
    const trans = bubble.querySelector(".trans");
    trans.textContent = text;
    if (isError) { trans.style.color = "var(--danger)"; return; }
    // 다시 듣기 버튼
    const btn = document.createElement("button");
    btn.className = "replay";
    btn.textContent = "🔊 다시 듣기";
    btn.addEventListener("click", () => speak(text, toLang));
    bubble.appendChild(btn);
    scrollToBottom();
  }

  function showInterim(from, text) {
    removeEmpty();
    if (!currentInterimBubble) {
      currentInterimBubble = document.createElement("div");
      currentInterimBubble.className = "bubble interim " + from;
      currentInterimBubble.innerHTML =
        '<div class="meta">' + LANGS[from].flag + ' 인식 중…</div><div class="orig"></div>';
      logEl.appendChild(currentInterimBubble);
    }
    currentInterimBubble.querySelector(".orig").textContent = text;
    scrollToBottom();
  }
  function clearInterim() {
    if (currentInterimBubble) {
      currentInterimBubble.remove();
      currentInterimBubble = null;
    }
  }

  function scrollToBottom() {
    logEl.scrollTop = logEl.scrollHeight;
  }

  function decodeHTML(s) {
    const t = document.createElement("textarea");
    t.innerHTML = s;
    return t.value;
  }

  // ---- 서비스 워커 등록 (PWA) ---------------------------------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
