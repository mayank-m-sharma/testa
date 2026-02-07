console.log("TextGrid dialer loaded");

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
let oldChildElement = null; // Store reference to oldChild element
let socket = null;
const allowedPatterns = [
    /\/v2\/location\/([a-zA-Z0-9]+)\//,
    /\/v2\/location\/([a-zA-Z0-9]+)\/contacts\/detail\/([a-zA-Z0-9]+)/,
];


function closeChildWindow() {
    if (childWindow) {
        childWindow.remove();
        childWindow = null;
    }
}

function isChildWindowOpen() {
    return !!childWindow && document.body.contains(childWindow);
}

// Helper function to show oldChild and hide textgrid button
function showOldChildHideTextgrid() {
    if (oldChildElement) {
        oldChildElement.style.display = "";
    }
    const textgridButton = document.getElementById("textgrid-floating-call-button");
    if (textgridButton) {
        textgridButton.style.display = "none";
    }
}

// Helper function to hide oldChild and show textgrid button
function hideOldChildShowTextgrid() {
    if (oldChildElement) {
        oldChildElement.style.display = "none";
    }
    const textgridButton = document.getElementById("textgrid-floating-call-button");
    if (textgridButton) {
        textgridButton.style.display = "flex";
    }
}

function disconnectSocket() {
    if (socket) {
        console.log("Disconnecting existing socket:", socket.id);
        // Remove all listeners to prevent memory leaks
        socket.off("connect");
        socket.off("disconnect");
        socket.off("inbound-call-received");
        // Disconnect the socket
        socket.disconnect();
        socket = null;
        socketId = "";
    }
}


function connectSocket() {
    disconnectSocket();
    const socket = io(API_BASE_URL, {
        transports: ["websocket"],
    });

    socket.on("connect", () => {
        console.log("Socket connected with id:", socket.id);
        socketId = socket.id;
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


socket = connectSocket();
initChildWindow();


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
        if (contactId) {
            inboundParams = `&contactId=${encodeURIComponent(contactId)}`;
        }
        const { directCallContactNumber } = directCallMetaData;
        if (directCallContactNumber) {
            inboundParams += `&directCallContactNumber=${encodeURIComponent(directCallContactNumber)}`;
        }
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
            remove: () => {
                existingButton?.remove?.();
                // Show oldChild when textgrid button is removed
                showOldChildHideTextgrid();
            },
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
                // Store reference to oldChild
                oldChildElement = oldChild;
                parent.insertBefore(container, oldChild);
                // Hide oldChild and show textgrid button
                hideOldChildShowTextgrid();
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
                // Show oldChild when textgrid button is removed
                showOldChildHideTextgrid();
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
    const data = await response.json();
    if (data.voice_takeover === false) {
        console.log("🟠 attempt to reject location mapping")
        throw new Error("Cannot verify location mapping with Textgrid due to voice takeover being false");
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
            socket = connectSocket();
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
                // Show oldChild when location is invalid
                showOldChildHideTextgrid();
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
                registerSocketEvents(true);
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
    console.log("Initialized Child window")
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
                // If verification fails, show oldChild
                showOldChildHideTextgrid();
            });
    } else {
        // If initial URL is not allowed, make sure oldChild is visible
        showOldChildHideTextgrid();
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

function initGhlOpportunityCallHook({
    onCall,
    root = document,
    // Only run when the pathname ends with this:
    onlyOnPathEndsWith = "opportunities/list",
} = {}) {
    console.log("initGhlOpportunityCallHook called");
    if (typeof onCall !== "function") {
        throw new Error("initGhlOpportunityCallHook: onCall callback is required");
    }

    // ---- URL guard
    const path = (window.location && window.location.pathname) || "";
    if (!path.endsWith("/" + onlyOnPathEndsWith) && !path.endsWith(onlyOnPathEndsWith)) {
        // Not the opportunities list page; do nothing.
        return { disconnect() { }, rescan() { } };
    }

    // ---- selectors
    const CARD_SELECTOR = ".opportunitiesCard";
    const DRAG_CARD_SELECTOR = ".cardWrapper.mb-2.cursor-move";
    const PHONE_PATH_SELECTOR = 'svg path[d^="M14.05 6A5 5 0 0118 9.95"]';

    function findCallSvg(opCardEl) {
        // 1) robust: match by phone icon path fingerprint
        const pathEl = opCardEl.querySelector(PHONE_PATH_SELECTOR);
        if (pathEl) return pathEl.closest("svg");

        // 2) fallback: first icon in the icon row
        return opCardEl.querySelector('.ui-card-content > .flex > .inline-flex:first-child svg');
    }

    function getContactId(opCardEl) {
        const el = opCardEl.querySelector("[data-contact-id]");
        return el ? el.getAttribute("data-contact-id") : null;
    }

    const MARK_ATTR = "data-tg-call-hooked";
    const isHooked = (el) => el && el.getAttribute(MARK_ATTR) === "1";
    const markHooked = (el) => el && el.setAttribute(MARK_ATTR, "1");

    function scanAndMark(container) {
        const opCards = Array.from(container.querySelectorAll(CARD_SELECTOR));
        for (const opCard of opCards) {
            const callSvg = findCallSvg(opCard);
            if (callSvg && !isHooked(callSvg)) markHooked(callSvg);
        }
    }

    function delegatedClickHandler(e) {
        // Ensure click is inside an opportunities card
        const opCard = e.target.closest(CARD_SELECTOR);
        if (!opCard) return;

        // Ensure click is on the phone icon (path or the matching svg)
        const clickedSvg = e.target.closest("svg");
        if (!clickedSvg) return;

        const hasPhonePath =
            e.target.matches(PHONE_PATH_SELECTOR) ||
            !!clickedSvg.querySelector(PHONE_PATH_SELECTOR);

        if (!hasPhonePath) return;

        // Ensure it's THE call icon for this card (not some other svg)
        const callSvg = findCallSvg(opCard);
        if (!callSvg || callSvg !== clickedSvg) return;

        e.preventDefault();
        e.stopPropagation();

        onCall({
            contactId: getContactId(opCard),
            cardEl: opCard,
            svgEl: callSvg,
            event: e,
        });
    }

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (!(node instanceof Element)) continue;

                if (node.matches?.(CARD_SELECTOR) || node.querySelector?.(CARD_SELECTOR)) {
                    scanAndMark(node);
                } else if (node.matches?.(DRAG_CARD_SELECTOR) || node.querySelector?.(DRAG_CARD_SELECTOR)) {
                    scanAndMark(node);
                }
            }
        }
    });

    // init
    scanAndMark(root);
    document.addEventListener("click", delegatedClickHandler, true);

    observer.observe(root === document ? document.body : root, {
        childList: true,
        subtree: true,
    });

    return {
        disconnect() {
            observer.disconnect();
            document.removeEventListener("click", delegatedClickHandler, true);
        },
        rescan() {
            scanAndMark(root);
        },
    };
}

initGhlOpportunityCallHook({
    onCall: ({ contactId }) => {
        console.log("Custom dial:", contactId);
        console.log("Current Location ID:", currentLocationId);
        directCallMetaData = {
            locationId: currentLocationId,
            contactId: contactId,
        };
        customFunction("click");
    }
});

function initGhlConversationsCallHook({
    onCall,
} = {}) {
    console.log("initGhlConversationsCallHook called");
    if (typeof onCall !== "function") {
        throw new Error("initGhlConversationsCallHook: onCall callback is required");
    }

    const PHONE_PATH_D = "M8.38 8.853a14.603 14.603 0 002.847 4.01 14.603 14.603 0 004.01 2.847c.124.06.187.09.265.112.28.082.625.023.862-.147.067-.048.124-.105.239-.219.35-.35.524-.524.7-.639a2 2 0 012.18 0c.176.115.35.29.7.64l.195.194c.532.531.797.797.942 1.082a2 2 0 010 1.806c-.145.285-.41.551-.942 1.082l-.157.158c-.53.53-.795.794-1.155.997-.4.224-1.02.386-1.478.384-.413-.001-.695-.081-1.26-.241a19.038 19.038 0 01-8.283-4.874A19.039 19.039 0 013.17 7.761c-.16-.564-.24-.846-.241-1.26a3.377 3.377 0 01.384-1.477c.202-.36.467-.625.997-1.155l.157-.158c.532-.53.798-.797 1.083-.941a2 2 0 011.805 0c.286.144.551.41 1.083.942l.195.194c.35.35.524.525.638.7a2 2 0 010 2.18c-.114.177-.289.352-.638.701-.115.114-.172.172-.22.238-.17.238-.228.582-.147.862.023.08.053.142.113.266z";

    function getPhoneNumber(container) {
        const spans = Array.from(container.querySelectorAll('span.truncate-text'));
        for (const span of spans) {
            const text = span.textContent.trim();
            // Basic check for phone number pattern (10+ digits, has parens or dash)
            const digits = text.replace(/\D/g, '');
            if (digits.length >= 10 && (text.includes('-') || text.includes('('))) {
                return text;
            }
        }
        return null;
    }

    function isConversationUrl() {
        return /\/v2\/location\/[^/]+\/conversations\/conversations\/[^/]+/.test(window.location.href);
    }

    function checkAndHook() {
        if (!isConversationUrl()) return;

        const container = document.getElementById("new-crp--contacts");
        if (!container) return;

        const svgs = Array.from(container.querySelectorAll('svg'));
        const callSvg = svgs.find(svg => {
            const path = svg.querySelector('path');
            return path && path.getAttribute('d') === PHONE_PATH_D;
        });

        if (!callSvg) return;
        if (callSvg.getAttribute('data-tg-conv-hooked') === '1') return;

        console.log("Found conversation call button, attaching hook...");

        callSvg.addEventListener('click', (e) => {
            console.log("Conversation call button clicked");
            e.preventDefault();
            e.stopPropagation();

            const phone = getPhoneNumber(container);
            if (phone) {
                console.log("Extracted phone:", phone);
                onCall({ phoneNumber: phone });
            } else {
                console.warn("Could not find phone number in conversation view");
            }
        }, true);

        // Optional: Add a subtle indicator
        // callSvg.style.outline = "2px solid #4CAF50"; 

        callSvg.setAttribute('data-tg-conv-hooked', '1');
    }

    const observer = new MutationObserver(() => {
        checkAndHook();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial check
    checkAndHook();
}

initGhlConversationsCallHook({
    onCall: ({ phoneNumber }) => {
        console.log("Custom conversation dialer triggered for:", phoneNumber);
        directCallMetaData = {
            locationId: currentLocationId,
            directCallContactNumber: phoneNumber,
        };
        customFunction("click");
    }
});

function initGhlSmartListCallHook({
    onCall,
} = {}) {
    console.log("initGhlSmartListCallHook called");
    if (typeof onCall !== "function") {
        throw new Error("initGhlSmartListCallHook: onCall callback is required");
    }

    // The user provided SVG path for smart list trigger
    const PHONE_PATH_D = "M8.38 8.853a14.603 14.603 0 002.847 4.01 14.603 14.603 0 004.01 2.847c.124.06.187.09.265.112.28.082.625.023.862-.147.067-.048.124-.105.239-.219.35-.35.524-.524.7-.639a2 2 0 012.18 0c.176.115.35.29.7.64l.195.194c.532.531.797.797.942 1.082a2 2 0 010 1.806c-.145.285-.41.551-.942 1.082l-.157.158c-.53.53-.795.797-1.155.997-.4.224-1.02.386-1.478.384-.413-.001-.695-.081-1.26-.241a19.038 19.038 0 01-8.283-4.874A19.039 19.039 0 013.17 7.761c-.16-.564-.24-.846-.241-1.26a3.377 3.377 0 01.384-1.477c.202-.36.467-.625.997-1.155l.157-.158c.532-.53.798-.797 1.083-.941a2 2 0 011.805 0c.286.144.551.41 1.083.942l.195.194c.35.35.524.525.638.7a2 2 0 010 2.18c-.114.177-.289.352-.638.701-.115.114-.172.172-.22.238-.17.238-.228.582-.147.862.023.08.053.142.113.266z";

    function getPhoneNumber(cell) {

        // Let's look for divs that have 10+ digits.
        const divs = Array.from(cell.querySelectorAll('div'));
        for (const div of divs) {
            // skip the icon container
            if (div.classList.contains('phone-call-icon')) continue;

            const text = div.textContent.trim();
            const digits = text.replace(/\D/g, '');
            if (digits.length >= 10 && (text.includes('-') || text.includes('('))) {
                return text;
            }
        }
        return null;
    }

    function isSmartListUrl() {
        return /\/v2\/location\/[^/]+\/contacts\/smart_list/.test(window.location.href);
    }

    function scanAndHook(root) {
        if (!isSmartListUrl()) return;

        // Selector for phone cells
        const CELL_SELECTOR = '.tabulator-cell[tabulator-field="phone"]';
        const cells = Array.from(root.querySelectorAll(CELL_SELECTOR));

        cells.forEach(cell => {
            // Find the call icon wrapper
            const iconWrapper = cell.querySelector('.phone-call-icon');
            if (!iconWrapper) return;

            // Check if already hooked
            if (iconWrapper.getAttribute('data-tg-sl-hooked') === '1') return;

            const svg = iconWrapper.querySelector('svg');
            if (!svg) return;

            console.log("Found smart list call button, attaching hook...");

            iconWrapper.addEventListener('click', (e) => {
                console.log("Smart list call button clicked");
                e.preventDefault();
                e.stopPropagation();

                const phone = getPhoneNumber(cell);
                if (phone) {
                    console.log("Extracted phone from smart list:", phone);
                    onCall({ phoneNumber: phone });
                } else {
                    console.warn("Could not find phone number in smart list cell");
                }
            }, true); // capturing phase to preempt GHL handler

            iconWrapper.setAttribute('data-tg-sl-hooked', '1');
        });
    }

    const observer = new MutationObserver((mutations) => {
        // Debounce or just run?
        // Since it's a mutation observer, we can potentially look at addedNodes but easier to just scan valid containers.
        // Smart list loads rows dynamically.
        scanAndHook(document.body);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial scan
    scanAndHook(document.body);
}

initGhlSmartListCallHook({
    onCall: ({ phoneNumber }) => {
        console.log("Custom smart list dialer triggered for:", phoneNumber);
        directCallMetaData = {
            locationId: currentLocationId,
            directCallContactNumber: phoneNumber,
        };
        customFunction("click");
    }
});
