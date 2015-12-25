var http = require('http'),
    fs = require('fs'),
    util = require('util'),
    express = require('express');

var app = express();

var server = http.Server(app);
var io = require('socket.io')(server);

io.on('connection', function(socket) {
  socket.on('play', function(data) {
    socket.broadcast.emit('play', data);
  });
  socket.on('pause', function(data) {
    socket.broadcast.emit('pause', data);
  });
  socket.on('taken_control', function(data) {
    socket.broadcast.emit('someone_else_controlling');
  });
  socket.on('time_update', function(data) {
    socket.broadcast.emit('time_update', data);
  });
  socket.on('caption_update', function(data) {
    socket.broadcast.emit('caption_update', data);
  });
  socket.on('ping', function() {
    socket.emit('pong');
  });
});

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

function serveVideo(req, res, filepath, videoType) {
  console.log(filepath);
  if (!fileExists(filepath)) {
    res.write('not found');
    res.end();
    return;
  }

  var stat = fs.statSync(filepath);
  var total = stat.size;

  if (req.headers['range']) {
    var range = req.headers.range;
    var parts = range.replace(/bytes=/, "").split("-");
    var partialstart = parts[0];
    var partialend = parts[1];

    var start = parseInt(partialstart, 10);
    var end = partialend ? parseInt(partialend, 10) : total-1;
    var chunksize = (end-start)+1;

    var file = fs.createReadStream(filepath, {start: start, end: end, autoClose: true});
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
    res.writeHead(200, { 'Content-Length': total, 'Content-Type': 'video/mp4' });
    fs.createReadStream(filepath).pipe(res);
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

// Serve entire directory
app.get('/v/samurai', function(req, res) {
  var loc = '/path/to/samurai/jack';
  showDirectory(req, res, loc, '/v/samurai/');
});

app.get('/v/samurai/:season', function(req, res) {
  var loc = '/path/to/samurai/jack/' + req.params.season;
  var linkPrefix = '/v/samurai/' + req.params.season + '/';
  showDirectory(req, res, loc, linkPrefix);
});

// Serve individual video
app.get('/v/samurai/:season/:filename', function(req, res) {
  var loc = '/path/to/samurai/jack/' + req.params.season + '/' + req.params.filename;
  serveVideo(req, res, filepath, 'video/webm');
});

var movies = {};

JSON.parse(fs.readFileSync('movies.json', 'utf8')).forEach(function(movie) {
  movies[movie.path] = movie;
});

console.log(movies);

app.get('/v/:id', function(req, res) {
  var movie = movies[req.params.id];
  var filepath = movie.filepath;
  var type = 'video/mp4';
  if(movie.type) {
    type = movie.type;
  }
  console.log(filepath);
  serveVideo(req, res, filepath, type);
});

app.get('/v', function(req, res) {
  var html = '<html><body>';
  for (var path in movies) {
    var url = '/v/' + path;
    html += '<a href="' + url + '">' + path + '</a><br/>';
  }
  html += '</body></html>';

  res.writeHeader(200, {'Content-Type': 'text/html'});
  res.write(html);
  res.end();
});

app.get('/video', function(req, res) {
  res.sendfile('index.html');
});
