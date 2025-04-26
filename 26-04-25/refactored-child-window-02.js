let childWindow = null;
let currentLocationId = "hqD2EpUwBJg1nEBWr4jT";
let observer = null;
let buttonInstance = null;
let childWindowOpenTrigger = 'click';
let hasChildWindowRendered = false;
let inboundCallMetaData = {};
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
        const {to, from, callId} =  inboundCallMetaData;
        inboundParams = `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&callId=${encodeURIComponent(callId)}`
    }
    let frontendBaseUrl = "https://ghlsdk.textgrid.com/app/ui";
    let frontendParams = `?locationId=${encodeURIComponent(currentLocationId)}&childWindowOpenTrigger=${encodeURIComponent(childWindowOpenTrigger)}`;
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
  x = '20px',
  y = '20px',
  size = '48px',
  color = '#4CAF50',
  hoverColor = '#45a049',
  onClick = () => alert('Call button clicked!')
} = {}) {
  const buttonContainer = document.createElement('div');
  Object.assign(buttonContainer.style, {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: '999999'
  });

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

  buttonContainer.appendChild(callButton);
  document.body.appendChild(buttonContainer);

  return {
    setPosition: (newX, newY) => {
      buttonContainer.style.left = newX;
      buttonContainer.style.top = newY;
    },
    remove: () => buttonContainer.remove()
  };
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
          buttonInstance = createFloatingCallButton({
            x: '85%',
            y: '20px',
            size: '32px',
            color: '#4CAF50',
            onClick: () => customFunction('click')
          });
          buttonInstance.setPosition('85.43%', '6.4px');
        }
      }
    }, 1000);
  }

function customFunction(triggerMethod) {
  if (!childWindow || childWindow.closed) {
    childWindowOpenTrigger = triggerMethod;
    hasChildWindowRendered = true;
    createChildWindow();
  } else {
    hasChildWindowRendered = false;
    childWindow.close();
  }
}


if (isAllowedUrl(window.location.href)) {
    currentLocationId = getLocationIdFromUrl(window.location.href);
    buttonInstance = createFloatingCallButton({
      x: '85%',
      y: '20px',
      size: '32px',
      color: '#4CAF50',
      onClick: () => customFunction('click')
    });
    buttonInstance.setPosition('85.43%', '6.4px');
}

function connectSocket() {
    const socket = io("http://localhost:3000", {
      transports: ["websocket"],
    });
  
    socket.on("connect", () => {
      console.log("Socket connected with id:", socket.id);
    });
  
    socket.on("disconnect", () => {
      console.log("Socket disconnected.");
    });
  
    return socket;
}

monitorUrlChanges();
const socket = connectSocket();
socket.on("connect", () => {

    socket.emit("register-location", { locationId: currentLocationId });
    console.log('Location registered ')
    socket.on('inbound-call-received', ({locationId, metadata}) => {
      console.log("📞 Incoming call received at parent:");
      inboundCallMetaData = metadata;
      if (!hasChildWindowRendered) {
          customFunction('socket');
      }
    })
  });
