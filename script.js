document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();

  // Custom UTC Clock in Header
  setInterval(() => {
    const now = new Date();
    document.getElementById("utc-indicator").textContent =
      "UTC: " + now.toISOString().substring(11, 19);
  }, 1000);

  // --- Global State ---
  let is24HourFormat = true;
  let clockUpdateInterval;
  let activeTimezone = null;
  let selectedTimezoneToAdd = null;

  // --- DOM Elements ---
  const formatToggle = document.getElementById("format-toggle");
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const alarmModal = document.getElementById("alarm-modal");
  const alarmModalMessage = document.getElementById("alarm-modal-message");
  const alarmModalClose = document.getElementById("alarm-modal-close");
  const authorWatermark = document.getElementById("author-watermark");
  const authorModal = document.getElementById("author-modal");
  const authorModalClose = document.getElementById("author-modal-close");

  // --- Audio Initialization ---
  let alarmSynth;
  const alarmSounds = {};

  function initializeAudio() {
    if (Tone.context.state !== "running") Tone.start();

    if (!alarmSynth) {
      alarmSounds.default = new Tone.MembraneSynth().toDestination();

      alarmSounds.bell = new Tone.MetalSynth({
        frequency: 200,
        envelope: { attack: 0.001, decay: 1.4, release: 0.2 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      }).toDestination();

      alarmSounds.harp = new Tone.PluckSynth().toDestination();

      alarmSounds.classic = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 },
      }).toDestination();

      document.getElementById("audio-status").textContent = "Active";
      document
        .getElementById("audio-status")
        .classList.replace("text-primary", "text-accent");
    }
  }

  document.body.addEventListener("click", initializeAudio, { once: true });
  document.body.addEventListener("touchstart", initializeAudio, { once: true });

  // --- Format Management ---
  formatToggle.addEventListener("click", () => {
    is24HourFormat = !is24HourFormat;
    formatToggle.textContent = is24HourFormat ? "24H FORMAT" : "12H FORMAT";
    renderAlarms();
  });

  // --- Tab Navigation ---
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetTab = button.dataset.tab;
      tabButtons.forEach((btn) => btn.classList.remove("tab-active"));
      button.classList.add("tab-active");

      tabPanes.forEach((pane) => {
        if (pane.id === targetTab) {
          pane.classList.remove("hidden");
          pane.classList.add("fade-in");
        } else {
          pane.classList.add("hidden");
          pane.classList.remove("fade-in");
        }
      });
    });
  });

  document
    .querySelector('.tab-btn[data-tab="world-clock"]')
    .classList.add("tab-active");

  // --- World Clock Data ---
  const addClockBtn = document.getElementById("add-clock-btn");
  const clocksContainer = document.getElementById("clocks-container");
  const trackedCount = document.getElementById("tracked-count");
  let displayedTimezones = new Set();
  const mainCanvas = document.getElementById("main-canvas");
  const customSelectContainer = document.getElementById(
    "custom-select-container",
  );
  const customSelectButton = document.getElementById("custom-select-button");
  const customSelectValue = document.getElementById("custom-select-value");
  const customSelectOptions = document.getElementById("custom-select-options");

  const popularTimezones = [
    { city: "New York", country: "US", timezone: "America/New_York" },
    { city: "London", country: "UK", timezone: "Europe/London" },
    { city: "Tokyo", country: "JP", timezone: "Asia/Tokyo" },
    { city: "Jakarta", country: "ID", timezone: "Asia/Jakarta" },
    { city: "Paris", country: "FR", timezone: "Europe/Paris" },
    { city: "Sydney", country: "AU", timezone: "Australia/Sydney" },
    { city: "Dubai", country: "AE", timezone: "Asia/Dubai" },
    { city: "Singapore", country: "SG", timezone: "Asia/Singapore" },
    { city: "Hong Kong", country: "CN", timezone: "Asia/Hong_Kong" },
    { city: "Frankfurt", country: "DE", timezone: "Europe/Berlin" },
    { city: "Los Angeles", country: "US", timezone: "America/Los_Angeles" },
    { city: "Chicago", country: "US", timezone: "America/Chicago" },
    { city: "Toronto", country: "CA", timezone: "America/Toronto" },
    { city: "São Paulo", country: "BR", timezone: "America/Sao_Paulo" },
  ];

  const updateTimezoneDropdown = () => {
    customSelectOptions.innerHTML = "";
    let availableOptions = 0;

    popularTimezones
      .sort((a, b) => a.city.localeCompare(b.city))
      .forEach((tz) => {
        if (!displayedTimezones.has(tz.timezone)) {
          availableOptions++;
          const option = document.createElement("div");
          option.className =
            "p-3 cursor-pointer hover:bg-surface border-b border-border last:border-0 text-xs font-mono text-muted hover:text-primary transition-colors";
          option.dataset.value = tz.timezone;
          option.textContent = `${tz.city} (${tz.country})`;

          option.addEventListener("click", () => {
            selectedTimezoneToAdd = tz.timezone;
            customSelectValue.textContent = tz.city;
            toggleDropdown(false);
          });

          customSelectOptions.appendChild(option);
        }
      });

    if (availableOptions > 0) {
      const firstOption = customSelectOptions.firstChild;
      if (
        !selectedTimezoneToAdd ||
        displayedTimezones.has(selectedTimezoneToAdd)
      ) {
        selectedTimezoneToAdd = firstOption.dataset.value;
        customSelectValue.textContent = firstOption.textContent.split(" ")[0];
      }
    } else {
      customSelectValue.textContent = "ALL NODES ACTIVE";
    }

    addClockBtn.disabled = availableOptions === 0;
  };

  const createClockCard = (timezone, displayName) => {
    const card = document.createElement("div");
    card.className =
      "clock-card bg-surface border border-border p-4 flex flex-col justify-between cursor-pointer relative group transition-colors min-h-[120px]";
    card.dataset.timezone = timezone;

    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <h4 class="text-[10px] font-bold tracking-widest text-primary uppercase">${
            displayName.split(",")[0]
          }</h4>
          <p class="text-[9px] font-mono text-muted gmt-offset mt-1 uppercase"></p>
        </div>
        <button class="remove-clock-btn text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none">
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>
      </div>
      <div class="mt-auto">
        <div class="text-2xl font-mono text-primary tracking-tight card-time leading-none">--:--</div>
        <div class="text-[9px] text-muted uppercase tracking-widest mt-1 card-date">--</div>
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (!e.target.closest(".remove-clock-btn")) activeTimezone = timezone;
    });

    card.querySelector(".remove-clock-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      displayedTimezones.delete(timezone);
      clocksContainer.removeChild(card);

      if (activeTimezone === timezone && displayedTimezones.size > 0) {
        activeTimezone = displayedTimezones.values().next().value;
      } else if (displayedTimezones.size === 0) {
        activeTimezone = null;
      }

      trackedCount.textContent = String(displayedTimezones.size).padStart(
        2,
        "0",
      );
      updateTimezoneDropdown();
    });

    return card;
  };

  const getGmtOffsetString = (timezone) => {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "shortOffset",
      });
      const parts = formatter.formatToParts(new Date());
      return parts.find((part) => part.type === "timeZoneName")?.value || "";
    } catch (e) {
      return "";
    }
  };

  function updateFeatureClock() {
    // Update Main Clock
    if (!activeTimezone) {
      document.getElementById("feature-clock-city").textContent =
        "NO NODE SELECTED";
      document.getElementById("feature-clock-time").textContent = "--:--:--";
      document.getElementById("feature-clock-date").textContent = "---";
      const ctx = mainCanvas.getContext("2d");
      ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    } else {
      document.querySelectorAll(".clock-card").forEach((el) => {
        el.classList.toggle(
          "active-tz",
          el.dataset.timezone === activeTimezone,
        );
      });

      const tzObj = popularTimezones.find(
        (tz) => tz.timezone === activeTimezone,
      );
      const displayName = tzObj
        ? `${tzObj.city}, ${tzObj.country}`
        : activeTimezone;

      const now = new Date();
      const timeString = now.toLocaleTimeString("en-US", {
        timeZone: activeTimezone,
        hour12: !is24HourFormat,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const dateString = now.toLocaleDateString("en-GB", {
        timeZone: activeTimezone,
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "2-digit",
      });

      const localTime = new Date(
        now.toLocaleString("en-US", { timeZone: activeTimezone }),
      );

      document.getElementById("feature-clock-city").textContent =
        `NODE // ${displayName}`;
      document.getElementById("feature-clock-time").textContent = timeString;
      document.getElementById("feature-clock-date").textContent = dateString;

      drawAnalogClock(mainCanvas, localTime);
    }

    // Update Mini Clock Cards Real-time
    document.querySelectorAll(".clock-card").forEach((el) => {
      const tz = el.dataset.timezone;
      const now = new Date();

      const timeStr = now.toLocaleTimeString("en-US", {
        timeZone: tz,
        hour12: !is24HourFormat,
        hour: "2-digit",
        minute: "2-digit",
      });

      const dateStr = now.toLocaleDateString("en-GB", {
        timeZone: tz,
        month: "short",
        day: "2-digit",
      });

      el.querySelector(".card-time").textContent = timeStr;
      el.querySelector(".card-date").textContent = dateStr;
    });
  }

  function drawAnalogClock(canvas, date) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const radius = canvas.width / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Editorial Colors
    const dialColor = "rgba(229, 231, 235, 0.2)";
    const handColor = "rgba(229, 231, 235, 0.9)";
    const secondHandColor = "#c8a96a";

    ctx.translate(radius, radius);
    const scale = radius * 0.9;
    ctx.scale(scale / 100, scale / 100);

    // Center dot
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, 2 * Math.PI);
    ctx.fillStyle = secondHandColor;
    ctx.fill();

    // Dial marks
    for (let i = 0; i < 12; i++) {
      const angle = ((i - 3) * (Math.PI * 2)) / 12;
      ctx.lineWidth = i % 3 === 0 ? 3 : 1;
      ctx.beginPath();
      const x1 = Math.cos(angle) * (i % 3 === 0 ? 80 : 88);
      const y1 = Math.sin(angle) * (i % 3 === 0 ? 80 : 88);
      const x2 = Math.cos(angle) * 95;
      const y2 = Math.sin(angle) * 95;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = i % 3 === 0 ? handColor : dialColor;
      ctx.stroke();
    }

    const hour = date.getHours() % 12;
    const minute = date.getMinutes();
    const second = date.getSeconds();
    const ms = date.getMilliseconds();

    ctx.lineCap = "square";

    // Hour
    const hourAngle = (hour * Math.PI) / 6 + (minute * Math.PI) / (6 * 60);
    drawHand(ctx, hourAngle, 50, 4, handColor);

    // Minute
    const minuteAngle =
      (minute * Math.PI) / 30 + (second * Math.PI) / (30 * 60);
    drawHand(ctx, minuteAngle, 75, 2, handColor);

    // Second
    const secondAngle = (second * Math.PI) / 30 + (ms * Math.PI) / (30 * 1000);
    drawHand(ctx, secondAngle, 85, 1, secondHandColor);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawHand(ctx, pos, length, width, color) {
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.moveTo(0, 0);
    ctx.rotate(pos);
    ctx.lineTo(0, -length);
    ctx.stroke();
    ctx.rotate(-pos);
  }

  const setupMainCanvas = () => {
    const container = mainCanvas.parentElement;
    if (!container) return;
    const size = container.offsetWidth;
    mainCanvas.width = size * 2;
    mainCanvas.height = size * 2;
  };

  const startClockUpdates = () => {
    if (clockUpdateInterval) cancelAnimationFrame(clockUpdateInterval);

    function tick() {
      updateFeatureClock();
      clockUpdateInterval = requestAnimationFrame(tick);
    }

    tick();
  };

  function addClock(timezoneValue) {
    if (!timezoneValue || displayedTimezones.has(timezoneValue)) return;

    const tzObj = popularTimezones.find((tz) => tz.timezone === timezoneValue);
    const displayName = tzObj
      ? `${tzObj.city}, ${tzObj.country}`
      : timezoneValue;

    displayedTimezones.add(timezoneValue);
    const newCard = createClockCard(timezoneValue, displayName);
    newCard.querySelector(".gmt-offset").textContent =
      getGmtOffsetString(timezoneValue);
    clocksContainer.appendChild(newCard);
    lucide.createIcons();

    if (displayedTimezones.size === 1) activeTimezone = timezoneValue;
    trackedCount.textContent = String(displayedTimezones.size).padStart(2, "0");

    updateTimezoneDropdown();
  }

  const toggleDropdown = (force) => {
    const isOpen = customSelectOptions.classList.contains("hidden");
    const icon = customSelectButton.querySelector("i");

    if (force === true || (force !== false && isOpen)) {
      customSelectOptions.classList.remove("hidden");
      if (icon) icon.style.transform = "rotate(180deg)";
    } else {
      customSelectOptions.classList.add("hidden");
      if (icon) icon.style.transform = "rotate(0deg)";
    }
  };

  customSelectButton.addEventListener("click", () => toggleDropdown());
  addClockBtn.addEventListener("click", () => addClock(selectedTimezoneToAdd));

  window.addEventListener("click", (e) => {
    if (!customSelectContainer.contains(e.target)) toggleDropdown(false);
  });

  // --- STOPWATCH LOGIC ---
  const swDisplay = document.getElementById("stopwatch-display");
  const swStartBtn = document.getElementById("sw-start-btn");
  const swLapBtn = document.getElementById("sw-lap-btn");
  const swResetBtn = document.getElementById("sw-reset-btn");
  const lapsList = document.getElementById("laps-list");

  let swState = {
    running: false,
    startTime: 0,
    elapsedTime: 0,
    interval: null,
    laps: [],
  };

  const formatSWTime = (ms) => {
    const d = new Date(ms);
    return `${String(d.getUTCMinutes()).padStart(2, "0")}:${String(
      d.getUTCSeconds(),
    ).padStart(2, "0")}.${String(d.getUTCMilliseconds()).padStart(3, "0")}`;
  };

  swStartBtn.addEventListener("click", () => {
    if (swState.running) {
      swState.running = false;
      swState.elapsedTime += performance.now() - swState.startTime;
      clearInterval(swState.interval);
      swStartBtn.textContent = "RESUME";
      swStartBtn.classList.remove("btn-danger");
      swStartBtn.classList.add("btn-accent");
      swLapBtn.disabled = true;
    } else {
      swState.running = true;
      swState.startTime = performance.now();
      swState.interval = setInterval(() => {
        swDisplay.textContent = formatSWTime(
          swState.elapsedTime + (performance.now() - swState.startTime),
        );
      }, 10);

      swStartBtn.textContent = "HALT";
      swStartBtn.classList.remove("btn-accent");
      swStartBtn.classList.add("btn-danger");
      swLapBtn.disabled = false;
      swResetBtn.disabled = false;
    }
  });

  swResetBtn.addEventListener("click", () => {
    clearInterval(swState.interval);
    swState = {
      running: false,
      startTime: 0,
      elapsedTime: 0,
      interval: null,
      laps: [],
    };
    swDisplay.textContent = "00:00:00.000";
    swStartBtn.textContent = "START";
    swStartBtn.classList.remove("btn-danger");
    swStartBtn.classList.add("btn-accent");
    swLapBtn.disabled = true;
    swResetBtn.disabled = true;
    lapsList.innerHTML = "";
  });

  swLapBtn.addEventListener("click", () => {
    if (!swState.running) return;

    const totalElapsed =
      swState.elapsedTime + (performance.now() - swState.startTime);
    const lastLap = swState.laps.reduce((a, b) => a + b, 0);
    const lapTime = totalElapsed - lastLap;
    swState.laps.push(lapTime);

    const li = document.createElement("li");
    li.className =
      "flex justify-between p-3 border-b border-border last:border-0 hover:bg-surface transition-colors";
    li.innerHTML = `<span class="uppercase tracking-widest text-primary">Lap ${String(
      swState.laps.length,
    ).padStart(2, "0")}</span><span class="text-accent">${formatSWTime(
      lapTime,
    )}</span>`;
    lapsList.prepend(li);
  });

  // --- TIMER LOGIC ---
  const timerStartBtn = document.getElementById("timer-start-btn");
  const timerResetBtn = document.getElementById("timer-reset-btn");
  const timerDisplay = document.getElementById("timer-display");
  const timerSetterContainer = document.getElementById(
    "timer-setter-container",
  );
  const timerDisplayContainer = document.getElementById(
    "timer-display-container",
  );
  const tHrs = document.getElementById("timer-hours-input");
  const tMins = document.getElementById("timer-minutes-input");
  const tSecs = document.getElementById("timer-seconds-input");

  let timerState = { running: false, totalSeconds: 0, interval: null };

  const formatInputValue = (input) => {
    let val = parseInt(input.value, 10) || 0;
    if (val < parseInt(input.min, 10)) val = parseInt(input.min, 10);
    if (val > parseInt(input.max, 10)) val = parseInt(input.max, 10);
    input.value = String(val).padStart(2, "0");
  };

  [tHrs, tMins, tSecs].forEach((input) => {
    input.addEventListener("blur", () => formatInputValue(input));
  });

  timerStartBtn.addEventListener("click", () => {
    if (timerState.running) {
      timerState.running = false;
      clearInterval(timerState.interval);
      timerStartBtn.textContent = "RESUME";
      timerStartBtn.classList.remove("btn-danger");
      timerStartBtn.classList.add("btn-accent");
    } else {
      if (timerState.totalSeconds <= 0) {
        timerState.totalSeconds =
          (parseInt(tHrs.value) || 0) * 3600 +
          (parseInt(tMins.value) || 0) * 60 +
          (parseInt(tSecs.value) || 0);
      }

      if (timerState.totalSeconds > 0) {
        timerState.running = true;
        timerSetterContainer.classList.add("hidden");
        timerDisplayContainer.classList.remove("hidden");
        timerStartBtn.textContent = "HALT";
        timerStartBtn.classList.remove("btn-accent");
        timerStartBtn.classList.add("btn-danger");
        timerResetBtn.classList.remove("hidden");

        timerState.interval = setInterval(() => {
          if (timerState.totalSeconds > 0 && timerState.running) {
            timerState.totalSeconds--;
            const h = Math.floor(timerState.totalSeconds / 3600);
            const m = Math.floor((timerState.totalSeconds % 3600) / 60);
            const s = timerState.totalSeconds % 60;
            timerDisplay.textContent = `${String(h).padStart(2, "0")}:${String(
              m,
            ).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
          } else {
            timerResetBtn.click();
            showAlarmModal("COUNTDOWN SEQUENCE COMPLETE", "default");
          }
        }, 1000);
      }
    }
  });

  timerResetBtn.addEventListener("click", () => {
    clearInterval(timerState.interval);
    timerState = { running: false, totalSeconds: 0, interval: null };
    timerSetterContainer.classList.remove("hidden");
    timerDisplayContainer.classList.add("hidden");
    timerStartBtn.textContent = "START";
    timerStartBtn.classList.remove("btn-danger");
    timerStartBtn.classList.add("btn-accent");
    timerResetBtn.classList.add("hidden");
  });

  // --- ALARM LOGIC ---
  const addAlarmBtn = document.getElementById("add-alarm-btn");
  const alarmLabelInput = document.getElementById("alarm-label-input");
  const alarmsList = document.getElementById("alarms-list");
  const aHrs = document.getElementById("alarm-hours-input");
  const aMins = document.getElementById("alarm-minutes-input");
  const aSound = document.getElementById("alarm-sound-select");

  let alarms = JSON.parse(localStorage.getItem("editorial_alarms")) || [];

  [aHrs, aMins].forEach((i) =>
    i.addEventListener("blur", () => formatInputValue(i)),
  );

  const renderAlarms = () => {
    alarmsList.innerHTML = "";

    if (alarms.length === 0) {
      alarmsList.innerHTML = `<div class="text-xs font-mono text-muted p-4 border border-border border-dashed text-center">NO SCHEDULED ALERTS</div>`;
      return;
    }

    alarms
      .sort((a, b) => a.time.localeCompare(b.time))
      .forEach((alarm) => {
        const el = document.createElement("div");
        el.className =
          "flex items-center justify-between p-4 border border-border bg-surface";
        el.dataset.id = alarm.id;

        const [h, m] = alarm.time.split(":");
        let displayTime = `${h}:${m}`;

        if (!is24HourFormat) {
          let hours = parseInt(h);
          const ampm = hours >= 12 ? "PM" : "AM";
          hours = hours % 12 || 12;
          displayTime = `${String(hours).padStart(
            2,
            "0",
          )}:${m} <span class="text-xs text-muted ml-1">${ampm}</span>`;
        }

        el.innerHTML = `
          <div>
            <p class="text-xl font-mono text-primary mb-1">${displayTime}</p>
            <p class="text-[10px] text-muted tracking-widest uppercase">${
              alarm.label || "SYSTEM ALERT"
            }</p>
          </div>
          <div class="flex items-center gap-4">
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer alarm-toggle" ${
                alarm.enabled ? "checked" : ""
              }>
              <div class="w-9 h-4 bg-base border border-border peer-focus:outline-none peer-checked:bg-accent peer-checked:border-accent after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-muted peer-checked:after:bg-base after:w-3 after:h-3 after:transition-all peer-checked:after:translate-x-[20px]"></div>
            </label>
            <button class="remove-alarm-btn text-muted hover:text-red-500 transition-colors focus:outline-none">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        `;

        alarmsList.appendChild(el);
      });

    lucide.createIcons();
    localStorage.setItem("editorial_alarms", JSON.stringify(alarms));
  };

  addAlarmBtn.addEventListener("click", () => {
    const time = `${String(parseInt(aHrs.value) || 0).padStart(
      2,
      "0",
    )}:${String(parseInt(aMins.value) || 0).padStart(2, "0")}`;

    alarms.push({
      id: Date.now(),
      time,
      label: alarmLabelInput.value,
      sound: aSound.value,
      enabled: true,
    });

    alarmLabelInput.value = "";
    renderAlarms();
  });

  alarmsList.addEventListener("click", (e) => {
    const el = e.target.closest("[data-id]");
    if (!el) return;

    const id = parseInt(el.dataset.id);

    if (e.target.closest(".remove-alarm-btn")) {
      alarms = alarms.filter((a) => a.id !== id);
    } else if (e.target.matches(".alarm-toggle")) {
      const a = alarms.find((a) => a.id === id);
      if (a) a.enabled = e.target.checked;
    }

    renderAlarms();
  });

  const showAlarmModal = (msg, sound) => {
    alarmModalMessage.textContent = msg;
    alarmModal.classList.remove("hidden");
    setTimeout(() => alarmModal.classList.remove("opacity-0"), 10);

    if (alarmSounds[sound] && Tone.context.state === "running") {
      if (sound === "bell") {
        alarmSounds[sound].triggerAttackRelease("C5", "4n", Tone.now());
      } else if (sound === "harp") {
        alarmSounds[sound].triggerAttackRelease("C4", "8n", Tone.now());
      } else if (sound === "classic") {
        alarmSounds[sound].triggerAttackRelease("A4", "8n", Tone.now());
      } else {
        alarmSounds.default.triggerAttackRelease("C2", "8n", Tone.now());
      }
    }
  };

  const hideAlarmModal = () => {
    alarmModal.classList.add("opacity-0");
    setTimeout(() => alarmModal.classList.add("hidden"), 200);
  };

  alarmModalClose.addEventListener("click", hideAlarmModal);

  setInterval(() => {
    const now = new Date();
    const currentStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;

    alarms.forEach((a) => {
      if (
        a.enabled &&
        a.time === currentStr &&
        now.getSeconds() === 0 &&
        !a.triggered
      ) {
        showAlarmModal(
          a.label || "SYSTEM ALERT EXECUTED",
          a.sound || "default",
        );
        a.triggered = true;
      }
      if (a.time !== currentStr) a.triggered = false;
    });
  }, 1000);

  // --- CONVERTER LOGIC ---
  const cvFromSel = document.getElementById("converter-from-select");
  const cvToSel = document.getElementById("converter-to-select");
  const cvFromTime = document.getElementById("converter-from-time");
  const cvToTime = document.getElementById("converter-to-time");

  function populateConverter() {
    [cvFromSel, cvToSel].forEach((sel) => {
      sel.innerHTML = "";
      popularTimezones
        .sort((a, b) => a.city.localeCompare(b.city))
        .forEach((tz) => {
          sel.add(
            new Option(
              `${tz.city} (${tz.timezone.split("/")[1].replace("_", " ")})`,
              tz.timezone,
            ),
          );
        });
    });

    cvFromSel.value = "Asia/Jakarta";
    cvToSel.value = "America/New_York";

    const now = new Date();
    cvFromTime.value = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;
  }

  function runConversion() {
    const parts = cvFromTime.value.split(":");
    if (parts.length < 2) return;

    const d = new Date();
    const utc = new Date(
      Date.UTC(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        parseInt(parts[0]),
        parseInt(parts[1]),
      ),
    );

    const offset =
      new Date(
        utc.toLocaleString("en-US", { timeZone: cvFromSel.value }),
      ).getTime() - utc.getTime();

    const finalUTC = new Date(utc.getTime() - offset);

    cvToTime.textContent = new Intl.DateTimeFormat("en-US", {
      timeZone: cvToSel.value,
      hour12: !is24HourFormat,
      hour: "2-digit",
      minute: "2-digit",
    }).format(finalUTC);
  }

  [cvFromSel, cvToSel, cvFromTime].forEach((el) =>
    el.addEventListener("change", runConversion),
  );

  // --- MODAL AUTHOR ---
  authorWatermark.addEventListener("click", () => {
    authorModal.classList.remove("hidden");
    setTimeout(() => authorModal.classList.remove("opacity-0"), 10);
  });

  authorModalClose.addEventListener("click", () => {
    authorModal.classList.add("opacity-0");
    setTimeout(() => authorModal.classList.add("hidden"), 200);
  });

  // --- INITIALIZATION ---
  function debounce(func, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Set init data
  addClock("Europe/London");
  addClock("America/New_York");
  addClock("Asia/Tokyo");
  addClock("Asia/Jakarta");

  updateTimezoneDropdown();
  setupMainCanvas();
  startClockUpdates();
  renderAlarms();
  populateConverter();
  runConversion();

  window.addEventListener("resize", debounce(setupMainCanvas, 250));
});
