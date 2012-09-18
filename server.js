/*jshint node: true */

//var BACKEND_URL = "http://backend.dev.surveillancerights.ca";
var BACKEND_URL = "http://192.168.222.114:3000";
//var BACKEND_URL = "http://192.168.43.221:3000";


var http = require('http');
var httpProxy = require('http-proxy');
var httpStatic = require('node-static');
var url = require('url');
var util = require('util');
var fs = require('fs');


var proxy = new httpProxy.RoutingProxy();
var file = new(httpStatic.Server)('.', {
    cache: 0, 
    headers: {
        "Pragma-directive": "no-cache",
        "Cache-directive": "no-cache",
        "Cache-control": "no-cache",
        "Pragma": "no-cache",
        "Expires": "0"
    }
});


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
            proxy.proxyRequest(req, res, {
                host: veosURL.hostname,
                port: veosURL.port || 80
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
            });
        }
    },

    {
        name: "STATIC",
        match: function(req) { return true; },
        proxy: function(req, res) {
            req.addListener('end', function(){ 
                console.log("STATIC "+req.url);
                file.serve(req, res);     
            });
        }
    }
];

server.start(8000);
