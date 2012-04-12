/*jshint browser: true, devel: true */

window.veos = (function(veos) {
  var self = {};

  // adding an event listener to retrieve location once marker is dragged - CURRENT DISABLED (draggable != true in createMap function) AND WILL NOT BE USED ON THIS PAGE
  google.maps.event.addListener(marker, 'dragend', function (event) {
    console.log('Pin dragged to latitude: ' + event.latLng.lat() + ' longitude: ' + event.latLng.lng());
    //alert('lat ' + event.latLng.lat() + ' lng ' + event.latLng.lng());
  });  

  var createMap = function(currentLocation) {
    var currentLatLng = new google.maps.LatLng(currentLocation.coords.latitude,currentLocation.coords.longitude);

    var myOptions = {
        center: currentLatLng,
        zoom: 14,
        mapTypeId: google.maps.MapTypeId.ROADMAP //HYBRID is also an option?
    };
    var map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

    // adding a marker for the current location as determined by the browser/phone
    var marker = new google.maps.Marker({
        position: currentLatLng,
        //draggable: true,
        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        title:"Current position"
    });

    // To add the marker to the map, call setMap();
    marker.setMap(map);

    // add markers for each point in the DB (we'll want to limit this at some point to decrease load time)
    var r = new veos.model.Reports();

    // I'm not sure it makes sense to do this here (it will never be reset, ie). Just doing for consistency
    r.on('reset', function(collection) {
      r.each(function(report) {
        var latLng = new google.maps.LatLng(report.get('latitude'),report.get('longitude'));
        var marker = new google.maps.Marker({
          position: latLng,
          title: report.get('location_name')
        });
        marker.setMap(map);
      });
    });

    // @triggers reset on the collection
    r.fetch();
  };

  var geolocationFailureHandler = function() {
    alert('Unable to retrieve your current GPS location, please enable GPS and reload!');
  };

  self.init = function() {
    console.log("Initializing Google Map...")

    // retrieve the current position of the phone
    navigator.geolocation.getCurrentPosition(createMap, geolocationFailureHandler);

  } 

  veos.map = self;
  return veos;
})(window.veos || {});