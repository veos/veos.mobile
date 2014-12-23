/*jshint node: true, sub:true */

var config = require('./config').config;
var BACKEND_URL = config.backend_url || "http://backend.dev.surveillancerights.ca";
console.log(BACKEND_URL);

var http = require('http');
var httpProxy = require('http-proxy');
var httpStatic = require('node-static');
var url = require('url');
var util = require('util');
var fs = require('fs');

var proxy = httpProxy.createProxyServer({});
//
// var file = new(httpStatic.Server)('.', {
//     cache: 0,
//     headers: {
//         "Pragma-directive": "no-cache",
//         "Cache-directive": "no-cache",
//         "Cache-control": "no-cache",
//         "Pragma": "no-cache",
//         "Expires": "0"
//     }
// });
var file = new httpStatic.Server('.');


var server = http.createServer(function (req, res) {
    var i;
    for (i = 0; i <= server.proxyMap.length; i++) {
        var map = server.proxyMap[i];

        if (map.match(req)) {
            map.proxy(req, res);
            break;
        }
    }
});

server.proxy = proxy;

server.start = function(port) {
    this.listen(port, function() {
        //console.log("\nGoogle Maps URL is:\n", url.parse(gmaps), "\n");
        console.log("Sail server listening on http://localhost:" + port + "...");
    });
};


server.proxyMap  = [
    {
        name: "BACKEND",
        match: function(req) { return url.parse(req.url).pathname.match(/^\/backend/); },
        proxy: function(req, res) {
            var veos = BACKEND_URL;
            var veosURL = url.parse(veos);
            console.log("PROXY " + req.url + " ==> " + veos);
            req.headers['host'] = veosURL.hostname;
            req.url = url.parse(req.url).path.replace(/^\/backend/,'');
            //console.log(req);
            proxy.web(req, res, {
                target: "http://"+veosURL.hostname+":"+(veosURL.port||80)
            });
        }
    },

    {
        name: "home STATIC",
        match: function(req) {
            var reqPath = url.parse(req.url).pathname;
            return reqPath === '/' || reqPath === '';
        },
        proxy: function(req, res) {
            req.addListener('end', function() {
                req.url = "/app.html";
                console.log("home STATIC "+req.url);
                file.serve(req, res);
            }).resume();
        }
    },

    {
        name: "STATIC",
        match: function(req) { return true; },
        proxy: function(req, res) {
            req.addListener('end', function(){
                console.log("STATIC "+req.url);
                file.serve(req, res);
            }).resume();
        }
    }
];

server.start(8000);
