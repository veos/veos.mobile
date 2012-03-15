/*jshint node: true */

var http = require('http');
var httpProxy = require('http-proxy');
var httpStatic = require('node-static');
var url = require('url');
var util = require('util');
var fs = require('fs');


var proxy = new httpProxy.RoutingProxy();
var file = new(httpStatic.Server)('.', {cache: false});


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
    // {
    //     name: 'GoogleMaps',
    //     match: function(req) { return url.parse(req.url).pathname.match(/^\/gmaps/); },
    //     proxy: function(req, res) {
    //         console.log("PROXY "+req.url+" ==> "+gmaps);
    //         var gmapsUrl = url.parse(gmaps);
    //         req.headers['host'] = gmapsUrl.hostname;
    //         console.log(req);
    //         req.url = gmapsUrl.path;
    //         console.log(req);
    //         proxy.proxyRequest(req, res, {
    //             host: gmapsUrl.hostname,
    //             port: gmapsUrl.port || 80
    //         });
    //     }
    // },

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
