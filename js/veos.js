/*jshint browser: true, devel: true */

window.veos = (function(veos) {
    var self = veos;

    var locSuccess = function(current_position) {
        var lat_lng = new google.maps.LatLng(current_position.coords.latitude,current_position.coords.longitude);

        var myOptions = {
            center: lat_lng,
            zoom: 14,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        var map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

        // adding a marker for the current location as determined by the browser/phone
        var marker = new google.maps.Marker({
            position: lat_lng,
            title:"Your position"
        });

        // To add the marker to the map, call setMap();
        marker.setMap(map);
    };
    var locFail = function() {
        alert('Unable to retrieve your current GPS location, please enable GPS and reload!');
    };

    self.initmap = function() {
        // retrieve the current position of the phone
        navigator.geolocation.getCurrentPosition(locSuccess, locFail);
        // var myOptions = {
        // center: new google.maps.LatLng(43.656,-79.381),
        // zoom: 14,
        // mapTypeId: google.maps.MapTypeId.ROADMAP
        // };
        // var map = new google.maps.Map(document.getElementById("map_canvas"),
        // myOptions);
    }            

    return self;
})(window.veos || {});



/* index.html */

jQuery(document).ready(function(){
	veos.initmap();

	jQuery('#add-report-button').click(function() {
		document.location = "/report.html";
	});
	jQuery('#view-list-button').click(function() {
		document.location = "/installations.html";
	});
//    better to use href for all of these, or do it this way?
jQuery('#cancel-report').click(function() {
        document.location = "/overview-map.html";
    });


});