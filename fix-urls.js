const fs = require('fs');
const files = [
  'd:/sagar/anything/ynme/ynme-web/src/components/SearchInterface.jsx',
  'd:/sagar/anything/ynme/ynme-web/src/components/PlaylistList.jsx',
  'd:/sagar/anything/ynme/ynme-web/src/components/PlaylistDetail.jsx',
  'd:/sagar/anything/ynme/ynme-web/src/components/MediaBridge.jsx',
  'd:/sagar/anything/ynme/ynme-web/src/components/ListeningRoom.jsx',
  'd:/sagar/anything/ynme/ynme-web/src/components/Dashboard.jsx'
];

try {
  files.forEach(f => {
    if (fs.existsSync(f)) {
      let content = fs.readFileSync(f, 'utf8');
      
      // Replace single quotes: 'http://127.0.0.1:5001...' -> (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001') + '/...'
      content = content.replace(/'http:\/\/127\.0\.0\.1:5001(\/[^']*)'/g, "(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001') + '$1'");
      
      // Replace double quotes: "http://127.0.0.1:5001..." -> (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001') + "/..."
      content = content.replace(/"http:\/\/127\.0\.0\.1:5001(\/[^"]*)"/g, '(import.meta.env.VITE_API_URL || "http://127.0.0.1:5001") + "$1"');
      
      // Replace backticks: `http://127.0.0.1:5001...` -> `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001'}...`
      content = content.replace(/`http:\/\/127\.0\.0\.1:5001/g, "`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001'}");

      // Replace Socket.io initialization: io('http://127.0.0.1:5001', ...) -> io(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001', ...)
      content = content.replace(/io\('http:\/\/127\.0\.0\.1:5001'/g, "io(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001'");

      fs.writeFileSync(f, content);
      console.log('Fixed ' + f);
    }
  });
} catch (error) {
  console.error(error);
}
