/*jshint browser: true, devel: true */

window.veos = (function(veos) {
  var self = {};

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

    // creating a new popup window (we can add way more formatting here, see https://developers.google.com/maps/documentation/javascript/overlays#InfoWindows)
    var infowindow = new google.maps.InfoWindow({
      content: "<p><b>You are here</b></p>"
    });    

    // adding the listener for the previously created marker that binds the popup window
    google.maps.event.addListener(marker, 'click', function() {
      infowindow.open(map,marker);
    });

    // adding an event listener to retrieve location once marker is dragged - CURRENT DISABLED (draggable != true) AND WILL NOT BE USED ON THIS PAGE
    google.maps.event.addListener(marker, 'dragend', function (event) {
      console.log('Pin dragged to latitude: ' + event.latLng.lat() + ' longitude: ' + event.latLng.lng());
      //alert('lat ' + event.latLng.lat() + ' lng ' + event.latLng.lng());
    });  

    // To add the marker to the map, call setMap();
    marker.setMap(map);

    addInstallationMarkers(map);

  };

  var addInstallationMarkers = function(map) {
      // adding markers for each point in the DB (we'll want to limit this at some point to decrease load time)
    var r = new veos.model.Reports();
    // I'm not sure it makes sense to do this here (it will never be reset, ie). Just doing for consistency
    r.on('reset', function(collection) {
      r.each(function(report) {
        var latLng = new google.maps.LatLng(report.get('latitude'),report.get('longitude'));
        var marker = new google.maps.Marker({
          position: latLng,
          title: report.get('location_name')
        });
        // creating a new popup window that contains the location_name string (TODO: change to more relevant info)
        var infowindow = new google.maps.InfoWindow({
          content: '<b><p>' + report.get('location_name') + '</b></p>'    // we might want to pretty thisup at some point
        });
        // binding a popup click event to the marker
        google.maps.event.addListener(marker, 'click', function() {
          infowindow.open(map,marker);
        });        
        marker.setMap(map);
      });
    });
    // @triggers reset on the collection
    r.fetch();
  }

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