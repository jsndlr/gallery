(function () {
  const init = () => {
    const track = document.getElementById("image-track");
    if (!track) return;
    const letters = document.querySelectorAll(".letter");
    let currentLetterIndex = 0;

    // Ensure initial state
    if (!track.dataset.percentage) track.dataset.percentage = "0";
    track.style.transform = `translate(${track.dataset.percentage}%, -50%)`;
    for (const image of track.getElementsByClassName("image")) {
      image.style.objectPosition = `${
        100 + parseFloat(track.dataset.percentage)
      }% center`;
    }
    // Visible nudge so autoplay is obvious right away
    setTimeout(() => {
      const start = -2; // small shift left
      track.dataset.percentage = String(start);
      track.style.transform = `translate(${start}%, -50%)`;
      for (const image of track.getElementsByClassName("image")) {
        image.style.objectPosition = `${100 + start}% center`;
      }
    }, 100);

    // ----- Message rotation -----
    const showParagraph = (index) => {
      letters.forEach((letter, i) => {
        letter.style.display = i === index ? "block" : "none";
      });
    };

    const changeParagraph = () => {
      currentLetterIndex = (currentLetterIndex + 1) % letters.length;
      showParagraph(currentLetterIndex);
    };

    showParagraph(currentLetterIndex);
    setInterval(changeParagraph, 5000);

    // ----- Drag/Swipe interaction -----
    let isPointerDown = false;
    // Start autoplay immediately after load
    let lastInteraction = performance.now() - 2000;

    // Drag tuning: lower sensitivity and add a small deadzone (in px)
    const DRAG_SENSITIVITY = 0.25; // 25% of previous sensitivity
    const DRAG_DEADZONE = 8; // ignore very small moves to avoid jitter

    const handleOnDown = (e) => {
      track.dataset.mouseDownAt = e.clientX;
      // Anchor to current position to avoid jumps after autoplay moved it
      track.dataset.prevPercentage = track.dataset.percentage || "0";
      isPointerDown = true;
      lastInteraction = performance.now();
    };

    const handleOnUp = () => {
      track.dataset.mouseDownAt = "0";
      track.dataset.prevPercentage = track.dataset.percentage || "0";
      isPointerDown = false;
      lastInteraction = performance.now();
    };

    const applyTransform = (nextPercentage, smoothMs = 3200) => {
      // Animate track to new position
      track.animate(
        {
          transform: `translate(${nextPercentage}%, -50%)`,
        },
        { duration: smoothMs, fill: "forwards" }
      );

      // Animate images' object-position to keep parallax feel
      for (const image of track.getElementsByClassName("image")) {
        image.animate(
          {
            objectPosition: `${100 + nextPercentage}% center`,
          },
          { duration: smoothMs, fill: "forwards" }
        );
      }
    };

    const handleOnMove = (e) => {
      if (track.dataset.mouseDownAt === "0") return;

      const mouseDelta = parseFloat(track.dataset.mouseDownAt) - e.clientX;
      if (Math.abs(mouseDelta) < DRAG_DEADZONE) return;

      // Make dragging less sensitive by increasing denominator and scaling
      const maxDelta = window.innerWidth; // less sensitive than /2
      const percentage = (mouseDelta / maxDelta) * -100 * DRAG_SENSITIVITY;

      const nextPercentageUnconstrained = parseFloat(track.dataset.prevPercentage) + percentage;
      const nextPercentage = Math.max(Math.min(nextPercentageUnconstrained, 0), -100);

      track.dataset.percentage = nextPercentage;
      applyTransform(nextPercentage);
    };

    window.onmousedown = (e) => handleOnDown(e);
    window.ontouchstart = (e) => handleOnDown(e.touches[0]);
    window.onmouseup = () => handleOnUp();
    window.ontouchend = () => handleOnUp();
    window.onmousemove = (e) => handleOnMove(e);
    window.ontouchmove = (e) => handleOnMove(e.touches[0]);

    // ----- Gentle autoplay when idle (CSS-driven) -----
    const AUTO_IDLE_DELAY = 800; // ms to wait after interaction before resuming autoplay
    const AUTO_DURATION_SEC = 50; // full sweep duration (0%<->-100%)

    const getCurrentPercentFromTransform = () => {
      const style = window.getComputedStyle(track);
      const t = style.transform;
      if (!t || t === "none")
        return parseFloat(track.dataset.percentage || "0");
      const m = t.match(/matrix\(([^)]+)\)/);
      if (!m) return parseFloat(track.dataset.percentage || "0");
      const parts = m[1].split(",").map((v) => parseFloat(v));
      const tx = parts[4] || 0; // pixels moved on X
      const w = track.clientWidth || 1;
      return (tx / w) * 100; // convert px back to % of self width
    };

    let autoTimer = null;
    const startAutoplay = () => {
      // Sync dataset with current visual position before starting
      const current = getCurrentPercentFromTransform();
      track.dataset.percentage = String(Math.max(Math.min(current, 0), -100));

      // Set duration and negative delay to continue from current position
      const progress = -parseFloat(track.dataset.percentage || "0") / 100; // 0..1
      const delay = -(progress * AUTO_DURATION_SEC);

      track.style.setProperty("--auto-duration", `${AUTO_DURATION_SEC}s`);
      track.classList.add("autoplaying");
      track.style.animationDelay = `${delay}s`;
      for (const img of track.getElementsByClassName("image")) {
        img.style.animationDelay = `${delay}s`;
      }

      // Fallback: ensure dataset stays roughly in sync every second
      clearInterval(autoTimer);
      autoTimer = setInterval(() => {
        // Recompute from computed style periodically
        track.dataset.percentage = String(getCurrentPercentFromTransform());
      }, 1000);
    };

    const stopAutoplay = () => {
      // Freeze at current animated position
      const current = getCurrentPercentFromTransform();
      const clamped = Math.max(Math.min(current, 0), -100);
      track.dataset.percentage = String(clamped);
      track.style.transform = `translate(${clamped}%, -50%)`;
      for (const img of track.getElementsByClassName("image")) {
        img.style.objectPosition = `${100 + clamped}% center`;
      }

      track.classList.remove("autoplaying");
      track.style.animationDelay = "";
      for (const img of track.getElementsByClassName("image"))
        img.style.animationDelay = "";
      clearInterval(autoTimer);
      autoTimer = null;
    };

    // Pause autoplay on interaction and resume after idle
    const queueResume = () => {
      setTimeout(() => {
        // If user hasn't started dragging again, restart autoplay
        if (!isPointerDown) startAutoplay();
      }, AUTO_IDLE_DELAY);
    };

    // Hook into existing handlers
    const originalHandleOnDown = handleOnDown;
    const originalHandleOnUp = handleOnUp;

    // Override wrappers to stop/resume autoplay
    window.onmousedown = (e) => {
      stopAutoplay();
      originalHandleOnDown(e);
    };
    window.ontouchstart = (e) => {
      stopAutoplay();
      originalHandleOnDown(e.touches[0]);
    };
    window.onmouseup = () => {
      originalHandleOnUp();
      queueResume();
    };
    window.ontouchend = () => {
      originalHandleOnUp();
      queueResume();
    };

    // Start autoplay after initial render
    setTimeout(startAutoplay, 300);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
