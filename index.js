var http = require('http'),
    fs = require('fs'),
    util = require('util'),
    express = require('express');

var app = express();

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (err) {
      return false;
  }
}

function serveVideo(req, res, filepath, videoType) {
  console.log(req.ip);
  if (!fileExists(filepath)) {
    res.write('not found');
    res.end();
    return;
  }

  var path = filepath;
  var stat = fs.statSync(path);
  var total = stat.size;

  if (req.headers['range']) {
    var range = req.headers.range;
    var parts = range.replace(/bytes=/, "").split("-");
    var partialstart = parts[0];
    var partialend = parts[1];

    var start = parseInt(partialstart, 10);
    var end = partialend ? parseInt(partialend, 10) : total-1;
    var chunksize = (end-start)+1;
    console.log('RANGE: ' + start + ' - ' + end + ' = ' + chunksize);

    var file = fs.createReadStream(path, {start: start, end: end, autoClose: true});
    res.writeHead(206, {
       'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': videoType,
        'Transfer-Encoding': 'chunked',
        'Connection': 'close'
    });
    file.pipe(res);
  } else {
    console.log('ALL: ' + total);
    res.writeHead(200, { 'Content-Length': total, 'Content-Type': 'video/mp4' });
    fs.createReadStream(path).pipe(res);
  }
}

function showDirectory(req, res, dir, linkPrefix) {
  var dirs = fs.readdirSync(dir);
  var html = '<html><body>';
  for (var i in dirs) {
    var path = dirs[i];
    var url = linkPrefix + path;
    html += '<a href="' + url + '">' + path + '</a><br/>';
  }
  html += '</body></html>';

  res.writeHeader(200, {'Content-Type': 'text/html'});
  res.write(html);
  res.end();
}

function showPaths(req, res) {
  var html = '<html><body>';
  for (var i in app._router.stack) {
    var layer = app._router.stack[i];
    if (layer.route && layer.route.path) {
      var path = layer.route.path;
      html += '<a href="' + path + '">' + path + '</a><br/>';
    }
  }
  html += '</body></html>';

  res.writeHeader(200, {'Content-Type': 'text/html'});
  res.write(html);
  res.end();
}

app.get('/', showPaths);

app.get('/v/samurai', function(req, res) {
  var loc = '/path/to/samurai/jack';
  var linkPrefix = '/v/samurai/'
  showDirectory(req, res, loc, linkPrefix);
});

app.get('/v/samurai/:season', function(req, res) {
  var loc = '/path/to/samurai/jack' + req.params.season;
  var linkPrefix = '/v/samurai/' + req.params.season + '/';
  showDirectory(req, res, loc, linkPrefix);
});

app.get('/v/samurai/:season/:filename', function(req, res) {
  var filepath = '/path/to/samurai/jack'+ req.params.season + '/' + req.params.filename;
  serveVideo(req, res, filepath, 'video/webm');
});

app.listen(8081);
