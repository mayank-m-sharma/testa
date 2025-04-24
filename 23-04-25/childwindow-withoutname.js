
let childWindow = null;
let currentLocationId = null;
let observer = null;
let buttonInstance = null;


const allowedPatterns = [
    /\/v2\/location\/([a-zA-Z0-9]+)\//,  // Matches any subpath under a location
  ];
  
  function isAllowedUrl(url) {
    return allowedPatterns.some(pattern => pattern.test(url));
  }
  
  function getLocationIdFromUrl(url) {
    const match = url.match(/\/v2\/location\/([a-zA-Z0-9]+)\//);
    return match ? match[1] : null;
  }

function createChildWindow() {
  childWindow = window.open('', '_blank', `
    width=320,
    height=533,
    left=${window.screen.width - 320},
    top=50,
    resizable=no,
    scrollbars=no,
    status=no,
    location=no,
    menubar=no,
    toolbar=no
  `);
  // childWindow.name = locationId;
  childWindow.document.body.style.margin = '0';
  childWindow.document.body.style.padding = '0';
  childWindow.document.body.style.background = 'white';

  const reactContainer = childWindow.document.createElement('div');
  reactContainer.id = '__root__custom_react_app__';
  childWindow.document.body.appendChild(reactContainer);

  loadReactAppStyles();
  loadReactApp();
}

function loadReactAppStyles() {
  if (!childWindow) return;
  const cssUrl = 'https://ghlsdk.textgrid.com:613/js/react-app-build.css';
  const link = childWindow.document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssUrl;
  childWindow.document.head.appendChild(link);
}

function loadReactApp() {
  if (!childWindow) return;
  const scriptUrl = 'https://cdn.jsdelivr.net/gh/mayank-m-sharma/testa@refs/heads/main/23-04-25/fetch-locid-rb-01.js';
  const script = childWindow.document.createElement('script');
  script.src = scriptUrl;
  script.async = true;
  childWindow.document.head.appendChild(script);
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
  
        // User navigated to a non-matching location
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
  
        // User enters valid location for the first time or from invalid location
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
            onClick: () => customFunction()
          });
          buttonInstance.setPosition('85.43%', '6.4px');
        }
      }
    }, 1000);
  }

function customFunction() {
  if (!childWindow || childWindow.closed) {
    createChildWindow();
  } else {
    childWindow.close();
  }
}

// Initialize script only if URL is valid

if (isAllowedUrl(window.location.href)) {
    currentLocationId = getLocationIdFromUrl(window.location.href);
    buttonInstance = createFloatingCallButton({
      x: '85%',
      y: '20px',
      size: '32px',
      color: '#4CAF50',
      onClick: () => customFunction()
    });
    buttonInstance.setPosition('85.43%', '6.4px');
  }
  monitorUrlChanges();