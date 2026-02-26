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
      
      // Replace fallback 'http://127.0.0.1:5001' with `http://${window.location.hostname || 'localhost'}:5001`
      content = content.replace(/'http:\/\/127\.0\.0\.1:5001'/g, "`http://${window.location.hostname || 'localhost'}:5001`");
      content = content.replace(/"http:\/\/127\.0\.0\.1:5001"/g, "`http://${window.location.hostname || 'localhost'}:5001`");

      fs.writeFileSync(f, content);
      console.log('Fixed ' + f);
    }
  });
} catch (error) {
  console.error(error);
}
