let childWindow = null;
let currentLocationId = "";
let observer = null;
let buttonInstance = null;
let childWindowOpenTrigger = "click";
let inboundCallMetaData = {};
let directCallMetaData = {};
let socketId = "";
const API_BASE_URL = "https://ghlsdk.textgrid.com";
let directCallButtonInstance = null;
const textgridEnv = 'PROD';

function closeChildWindow() {
  if (childWindow) {
    childWindow.remove();
    childWindow = null;
  }
}

function isChildWindowOpen() {
  return !!childWindow && document.body.contains(childWindow);
}


function connectSocket() {
  const socket = io(API_BASE_URL, {
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log("Socket connected with id:", socket.id);
    socketId = socket.id;
    initChildWindow();
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected.");
  });

  return socket;
}
function registerSocketEvents(isActive) {
  socket.emit("register-location", { locationId: currentLocationId, isActive });
  console.log("Location registered ", currentLocationId);

  socket.on("inbound-call-received", ({ locationId, metadata }) => {
    console.log("📞 Incoming call received at parent:");
    inboundCallMetaData = metadata;
    customFunction("socket");
  });
}

const socket = connectSocket();

const allowedPatterns = [
  /\/v2\/location\/([a-zA-Z0-9]+)\//,
  /\/v2\/location\/([a-zA-Z0-9]+)\/contacts\/detail\/([a-zA-Z0-9]+)/,
];

function isAllowedUrl(url) {
  return allowedPatterns.some((pattern) => pattern.test(url));
}

function getLocationIdFromUrl(url) {
  const match = url.match(/\/v2\/location\/([a-zA-Z0-9]+)\//);
  return match ? match[1] : null;
}

function getFrontendAppBaseUrl() {
  let inboundParams = "";
  if (Object.keys(inboundCallMetaData).length) {
    const { to, from, callId, historyId } = inboundCallMetaData;
    inboundParams = `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(
      to
    )}&callId=${encodeURIComponent(callId)}&historyId=${encodeURIComponent(historyId)}`;
  }
  if (Object.keys(directCallMetaData).length) {
    const { contactId } = directCallMetaData;
    inboundParams = `&contactId=${encodeURIComponent(contactId)}`;
  }
  let frontendBaseUrl = `${API_BASE_URL}/app/ui`;
  let frontendParams = `?locationId=${encodeURIComponent(
    currentLocationId
  )}&childWindowOpenTrigger=${encodeURIComponent(
    childWindowOpenTrigger
  )}&socketId=${encodeURIComponent(socketId)}&textgridEnv=${textgridEnv}`;
  if (inboundParams !== "") {
    frontendParams += inboundParams;
  }

  directCallMetaData = {};

  const url = frontendBaseUrl + frontendParams;
  return url;
}

function createChildWindow() {
  const frontendBaseUrl = getFrontendAppBaseUrl();

  if (document.getElementById("floating-child-window")) return;

  const container = document.createElement("div");
  container.id = "floating-child-window";
  container.style.position = "fixed";
  container.style.top = "50px";
  container.style.left = window.innerWidth - 347 - 20 + "px"; // mimic original left calc
  container.style.width = "347px";
  container.style.height = "630px";
  container.style.zIndex = "9999";
  container.style.border = "1px solid #ccc";
  container.style.borderRadius = "8px";
  container.style.boxShadow = "0 0 15px rgba(0,0,0,0.2)";
  container.style.background = "white";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  childWindow = container;
  // Draggable header
  const header = document.createElement("div");
  header.style.height = "30px";
  header.style.background = "#f2f2f2";
  header.style.cursor = "move";
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.padding = "0 10px";
  header.style.fontWeight = "bold";
  header.innerText = "TextGrid Dialer";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.border = "none";
  closeBtn.style.background = "transparent";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "18px";
  closeBtn.style.marginLeft = "auto";
  closeBtn.addEventListener("click", () => {
    container.remove();
  });

  header.appendChild(closeBtn);

  const iframe = document.createElement("iframe");
  iframe.src = frontendBaseUrl;
  iframe.style.flex = "1";
  iframe.style.border = "none";
  iframe.allow = "microphone; autoplay;";

  container.appendChild(header);
  container.appendChild(iframe);
  document.body.appendChild(container);

  // Drag logic
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - container.getBoundingClientRect().left;
    offsetY = e.clientY - container.getBoundingClientRect().top;
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      container.style.left = e.clientX - offsetX + "px";
      container.style.top = e.clientY - offsetY + "px";
      container.style.right = "auto"; // reset right so left applies
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    document.body.style.userSelect = "";
  });
}

function createFloatingCallButton({
  size = "32px",
  color = "#4CAF50",
  hoverColor = "#45a049",
  onClick = () => alert("Call button clicked!"),
  injectIntoFlexContainer = false,
} = {}) {
  // Check if button already exists
  const existingButton = document.getElementById(
    "textgrid-floating-call-button"
  );
  if (existingButton) {
    console.log("Floating call button already exists");
    return {
      remove: () => existingButton?.remove?.(),
    };
  }

  // Create button and its styles
  const callButton = document.createElement("button");
  const container = document.createElement("div");

  // Add unique ID to container
  container.id = "textgrid-floating-call-button";
  container.style.display = "flex";
  container.style.alignItems = "center";

  // Create button and its styles
  Object.assign(callButton.style, {
    width: size,
    height: size,
    borderRadius: "50%",
    backgroundColor: color,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    transition: "all 0.3s ease",
  });

  // Create phone icon (keeping existing SVG code)
  const phoneIcon = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );
  phoneIcon.setAttribute("viewBox", "0 0 24 24");
  phoneIcon.setAttribute("width", "60%");
  phoneIcon.setAttribute("height", "60%");

  const phonePath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );
  phonePath.setAttribute(
    "d",
    "M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"
  );
  phonePath.setAttribute("fill", "white");

  phoneIcon.appendChild(phonePath);
  callButton.appendChild(phoneIcon);

  // Add event listeners
  callButton.addEventListener(
    "mouseover",
    () => (callButton.style.backgroundColor = hoverColor)
  );
  callButton.addEventListener(
    "mouseout",
    () => (callButton.style.backgroundColor = color)
  );
  callButton.addEventListener(
    "mousedown",
    () => (callButton.style.transform = "scale(0.95)")
  );
  callButton.addEventListener(
    "mouseup",
    () => (callButton.style.transform = "scale(1)")
  );
  callButton.addEventListener("click", onClick);

  container.appendChild(callButton);

  if (injectIntoFlexContainer) {
    const waitForElements = () => {
      return new Promise((resolve) => {
        const checkElements = () => {
          const parent = document.querySelector(".hl_header--controls");
          const oldChild = document.getElementById("template-power-dialer");

          if (parent && oldChild) {
            resolve({ parent, oldChild });
          } else {
            setTimeout(checkElements, 100);
          }
        };
        checkElements();
      });
    };

    const handleDOMChanges = () => {
      // Check again if button exists before inserting
      if (document.getElementById("textgrid-floating-call-button")) {
        return;
      }

      waitForElements().then(({ parent, oldChild }) => {
        parent.insertBefore(container, oldChild);
        oldChild.style.display = "none";
      });
    };

    handleDOMChanges();

    const observer = new MutationObserver(() => {
      const existingButton = document.getElementById(
        "textgrid-floating-call-button"
      );
      if (!existingButton && document.querySelector(".hl_header--controls")) {
        handleDOMChanges();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return {
      remove: () => {
        observer.disconnect();
        container?.remove?.();
      },
    };
  } else {
    // Fallback to fixed position
    Object.assign(container.style, {
      position: "fixed",
      left: "20px",
      top: "20px",
      zIndex: "999999",
    });
    document.body.appendChild(container);
    return {
      remove: () => container?.remove?.(),
    };
  }
}

function createDirectCallContactCta({
  size = "32px",
  color = "#4CAF50",
  hoverColor = "#45a049",
  onClick = () => alert("Direct call button clicked!"),
} = {}) {
  // Check if button already exists
  const existingButton = document.getElementById("textgrid-direct-call-button");
  if (existingButton) {
    console.log("Direct call button already exists");
    return {
      remove: () => existingButton?.remove?.(),
    };
  }

  const container = document.createElement("div");
  container.id = "textgrid-direct-call-button";

  // Create button
  const callButton = document.createElement("button");
  Object.assign(callButton.style, {
    width: size,
    height: size,
    borderRadius: "50%",
    backgroundColor: color,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    transition: "all 0.3s ease",
    margin: "0 8px", // Add some margin for spacing
  });

  // Create phone icon
  const phoneIcon = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );
  phoneIcon.setAttribute("viewBox", "0 0 24 24");
  phoneIcon.setAttribute("width", "60%");
  phoneIcon.setAttribute("height", "60%");

  const phonePath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );
  phonePath.setAttribute(
    "d",
    "M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"
  );
  phonePath.setAttribute("fill", "white");

  phoneIcon.appendChild(phonePath);
  callButton.appendChild(phoneIcon);

  // Add event listeners
  callButton.addEventListener(
    "mouseover",
    () => (callButton.style.backgroundColor = hoverColor)
  );
  callButton.addEventListener(
    "mouseout",
    () => (callButton.style.backgroundColor = color)
  );
  callButton.addEventListener(
    "mousedown",
    () => (callButton.style.transform = "scale(0.95)")
  );
  callButton.addEventListener(
    "mouseup",
    () => (callButton.style.transform = "scale(1)")
  );
  callButton.addEventListener("click", onClick);

  container.appendChild(callButton);

  const waitForParentElement = () => {
    return new Promise((resolve) => {
      const checkElement = () => {
        const parent = document.querySelector(
          ".message-header-actions.contact-detail-actions"
        );
        if (parent) {
          resolve(parent);
        } else {
          setTimeout(checkElement, 100);
        }
      };
      checkElement();
    });
  };

  const handleDOMChanges = async () => {
    if (document.getElementById("textgrid-direct-call-button")) {
      return;
    }

    const parent = await waitForParentElement();
    // Clear existing children
    while (parent.firstChild) {
      parent.removeChild(parent.firstChild);
    }
    parent.appendChild(container);
  };

  const observer = new MutationObserver(() => {
    const existingButton = document.getElementById(
      "textgrid-direct-call-button"
    );
    if (
      !existingButton &&
      document.querySelector(".message-header-actions.contact-detail-actions")
    ) {
      handleDOMChanges();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  handleDOMChanges();

  return {
    remove: () => {
      observer.disconnect();
      container?.remove?.();
    },
  };
}

async function verifyLocationMappingWithTextgrid(locationId) {
  const response = await fetch(
    `${API_BASE_URL}/api/ghl/get-ghl-token-by-location/${locationId}?textgridEnv=${textgridEnv}`
  );
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  return true;
}

function monitorUrlChanges() {
  let lastUrl = location.href;

  setInterval(() => {
    const currentUrl = location.href;
    const isValidNow = isAllowedUrl(currentUrl);
    const newLocationId = getLocationIdFromUrl(currentUrl);
    const contactDetailMatch = currentUrl.match(
      /\/v2\/location\/([a-zA-Z0-9]+)\/contacts\/detail\/([a-zA-Z0-9]+)/
    );
    const isContactDetailPage = !!contactDetailMatch;
    const contactId = contactDetailMatch ? contactDetailMatch[2] : null;

    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      const locationChanged = newLocationId !== currentLocationId;

      if (isContactDetailPage) {
        if (!directCallButtonInstance) {
          verifyLocationMappingWithTextgrid(newLocationId).then(() => {
            directCallButtonInstance = createDirectCallContactCta({
              size: "32px",
              color: "#4CAF50",
              onClick: () => {
                directCallMetaData = {
                  locationId: newLocationId,
                  contactId: contactId,
                };
                customFunction("click");
              },
            });
          });
        }
      } else if (directCallButtonInstance) {
        directCallButtonInstance.remove();
        directCallButtonInstance = null;
      }

      if (!isValidNow) {
        if (buttonInstance) {
          buttonInstance.remove();
          buttonInstance = null;
        }
        if (isChildWindowOpen()) {
          closeChildWindow();
        }
        currentLocationId = null;
        return;
      }

      if (isValidNow && (!buttonInstance || locationChanged)) {
        if (isChildWindowOpen()) {
          closeChildWindow();
        }

        if (buttonInstance) {
          buttonInstance.remove();
        }

        currentLocationId = newLocationId;
        verifyLocationMappingWithTextgrid(currentLocationId).then(() => {
          buttonInstance = createFloatingCallButton({
            size: "32px",
            color: "#4CAF50",
            injectIntoFlexContainer: true,
            onClick: () => customFunction("click"),
          });
          buttonInstance.setPosition("85.43%", "6.4px");
        });
      }
    }
  }, 1000);
}

function customFunction(triggerMethod) {
  if (!isChildWindowOpen()) {
    childWindowOpenTrigger = triggerMethod;
    createChildWindow();
  } else if (triggerMethod === 'click') {
    closeChildWindow();
  }
}

function initChildWindow() {
  if (isAllowedUrl(window.location.href)) {
    currentLocationId = getLocationIdFromUrl(window.location.href);
    // Check if it's a contact detail page
    const contactDetailMatch = window.location.href.match(
      /\/v2\/location\/([a-zA-Z0-9]+)\/contacts\/detail\/([a-zA-Z0-9]+)/
    );
    const isContactDetailPage = !!contactDetailMatch;
    const contactId = contactDetailMatch ? contactDetailMatch[2] : null;

    verifyLocationMappingWithTextgrid(currentLocationId)
      .then(() => {
        // Create floating button
        buttonInstance = createFloatingCallButton({
          size: "32px",
          color: "#4CAF50",
          injectIntoFlexContainer: true,
          onClick: () => customFunction("click"),
        });

        // If it's a contact detail page, create the direct call button
        if (isContactDetailPage) {
          directCallButtonInstance = createDirectCallContactCta({
            size: "32px",
            color: "#4CAF50",
            onClick: () => {
              directCallMetaData = {
                locationId: currentLocationId,
                contactId: contactId,
              };
              customFunction("click");
            },
          });
        }

        registerSocketEvents(true);
      })
      .catch((error) => {
        console.log("error creating buttons", error);
      });
  }

  monitorUrlChanges();
}

exitFullscreenIfNeeded;

async function exitFullscreenIfNeeded() {
  // Check if browser is in fullscreen mode
  if (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  ) {
    try {
      // Exit fullscreen
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }

      // Small delay to ensure fullscreen exit is complete
      await new Promise((resolve) => setTimeout(resolve, 100));
      return true;
    } catch (error) {
      console.error("Error exiting fullscreen:", error);
      return false;
    }
  }
  return false;
}
