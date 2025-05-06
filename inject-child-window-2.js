
let childWindow = null;
let currentLocationId = "";
let observer = null;
let buttonInstance = null;
let childWindowOpenTrigger = 'click';
let inboundCallMetaData = {};
let socketId = "";
const API_BASE_URL = "https://ghlsdk.textgrid.com"

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
    console.log('Location registered ', currentLocationId);

    socket.on('inbound-call-received', ({ locationId, metadata }) => {
        console.log("📞 Incoming call received at parent:");
        inboundCallMetaData = metadata;
        customFunction('socket');

    })
}

const socket = connectSocket();


const allowedPatterns = [
    /\/v2\/location\/([a-zA-Z0-9]+)\//,
];

function isAllowedUrl(url) {
    return allowedPatterns.some(pattern => pattern.test(url));
}

function getLocationIdFromUrl(url) {
    const match = url.match(/\/v2\/location\/([a-zA-Z0-9]+)\//);
    return match ? match[1] : null;
}

function getFrontendAppBaseUrl() {
    let inboundParams = "";
    if (Object.keys(inboundCallMetaData).length) {
        const { to, from, callId } = inboundCallMetaData;
        inboundParams = `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&callId=${encodeURIComponent(callId)}`;
    }
    let frontendBaseUrl = `${API_BASE_URL}/app/ui`;
    let frontendParams = `?locationId=${encodeURIComponent(currentLocationId)}&childWindowOpenTrigger=${encodeURIComponent(childWindowOpenTrigger)}&socketId=${encodeURIComponent(socketId)}`;
    if (inboundParams !== "") {
        frontendParams += inboundParams;
    }

    const url = frontendBaseUrl + frontendParams;
    return url;
}

function createChildWindow() {
    const frontendBaseUrl = getFrontendAppBaseUrl();
    childWindow = window.open(frontendBaseUrl, '_blank', `
      width=320,
      height=533,
      left=${window.screen.width - 320},
      top=50,
      resizable=no
      scrollbars=no,
      status=no,
      location=no,
      menubar=no,
      toolbar=no
    `);
}


function createFloatingCallButton({
    size = '32px',
    color = '#4CAF50',
    hoverColor = '#45a049',
    onClick = () => alert('Call button clicked!'),
    injectIntoFlexContainer = false
} = {}) {
    const callButton = document.createElement('button');
    Object.assign(callButton.style, {
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease'
    });

    const phoneIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    phoneIcon.setAttribute("viewBox", "0 0 24 24");
    phoneIcon.setAttribute("width", "60%");
    phoneIcon.setAttribute("height", "60%");

    const phonePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    phonePath.setAttribute("d", "M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z");
    phonePath.setAttribute("fill", "white");

    phoneIcon.appendChild(phonePath);
    callButton.appendChild(phoneIcon);

    callButton.addEventListener('mouseover', () => callButton.style.backgroundColor = hoverColor);
    callButton.addEventListener('mouseout', () => callButton.style.backgroundColor = color);
    callButton.addEventListener('mousedown', () => callButton.style.transform = 'scale(0.95)');
    callButton.addEventListener('mouseup', () => callButton.style.transform = 'scale(1)');
    callButton.addEventListener('click', onClick);

    let container = null;

    if (injectIntoFlexContainer) {
        const parent = document.querySelector('.hl_header--controls');
        const oldChild = document.getElementById('template-power-dialer');

        if (parent && oldChild) {
            container = document.createElement('div');
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.appendChild(callButton);

            parent.replaceChild(container, oldChild);
        } else {
            console.warn('Parent or template-power-dialer not found.');
        }
    } else {
        // fallback to fixed position
        container = document.createElement('div');
        Object.assign(container.style, {
            position: 'fixed',
            left: '20px',
            top: '20px',
            zIndex: '999999'
        });
        container.appendChild(callButton);
        document.body.appendChild(container);
    }

    return {
        remove: () => container?.remove?.()
    };
}

async function verifyLocationMappingWithTextgrid(locationId) {
    const response = await fetch(`${API_BASE_URL}/api/ghl/get-ghl-token-by-location/${locationId}`);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return true;
}

function monitorUrlChanges() {
    let lastUrl = location.href;

    setInterval(() => {
        const currentUrl = location.href;
        const isValidNow = isAllowedUrl(currentUrl);
        const newLocationId = getLocationIdFromUrl(currentUrl);
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;

            const locationChanged = newLocationId !== currentLocationId;
            if (!isValidNow) {
                if (buttonInstance) {
                    buttonInstance.remove();
                    buttonInstance = null;
                }
                if (childWindow && !childWindow.closed) {
                    childWindow.close();
                    childWindow = null;
                }
                currentLocationId = null;
                return;
            }

            if (isValidNow && (!buttonInstance || locationChanged)) {
                if (childWindow && !childWindow.closed) {
                    childWindow.close();
                    childWindow = null;
                }

                if (buttonInstance) {
                    buttonInstance.remove();
                }

                currentLocationId = newLocationId;
                verifyLocationMappingWithTextgrid(currentLocationId).then(() => {
                    buttonInstance = createFloatingCallButton({
                        x: '85.8%',
                        y: '20px',
                        size: '32px',
                        color: '#4CAF50',
                        onClick: () => customFunction('click')
                    });
                    buttonInstance.setPosition('85.43%', '6.4px');
                })
            }
        }
    }, 1000);
}

function customFunction(triggerMethod) {
    if (!childWindow || childWindow.closed) {
        childWindowOpenTrigger = triggerMethod;
        createChildWindow();
    } else if (triggerMethod === 'click') {
        childWindow.close();
    }
}


function initChildWindow() {
    if (isAllowedUrl(window.location.href)) {
        currentLocationId = getLocationIdFromUrl(window.location.href);
        verifyLocationMappingWithTextgrid(currentLocationId).then(() => {
            buttonInstance = createFloatingCallButton({
                size: '32px',
                color: '#4CAF50',
                injectIntoFlexContainer: true,
                onClick: () => customFunction('click')
            });
            registerSocketEvents(true);
        }).catch((error) => {   
            console.log('error creating floating button', error);
        })
    }

    monitorUrlChanges();
}
