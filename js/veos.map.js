/*jshint browser: true, devel: true */

window.veos = (function(veos) {
  var self = {};

  var createMap = function(currentLocation, map) {
    var currentLatLng = new google.maps.LatLng(currentLocation.coords.latitude,currentLocation.coords.longitude);
    
    if (!map)
      map = "#map-canvas";

    var myOptions = {
      center: currentLatLng,
      zoom: 14,
      mapTypeId: google.maps.MapTypeId.ROADMAP //HYBRID is also an option?
    };

    var map = new google.maps.Map(jQuery(map)[0], myOptions);

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

  // I have a feeling someone else (Matt) is working on the same thing here... will continue once this is determined
  self.createRefiningMap = function (lat, lon, collection) {
    console.log("Initializing Google Map...");

    var currentLatLng = new google.maps.LatLng(lat, lon);

    var myOptions = {
      center: currentLatLng,
      zoom: 14,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    var map = new google.maps.Map(document.getElementById("refining-map-canvas"), myOptions);

    // adding a marker for the current location as determined by the browser/phone
    var marker = new google.maps.Marker({
      position: currentLatLng,
      draggable: true,
      icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      title:"Current position"
    }); 

    // adding an event listener to retrieve location once marker is dragged
    google.maps.event.addListener(marker, 'dragend', function (event) {
      console.log('Pin dragged to latitude: ' + event.latLng.lat() + ' longitude: ' + event.latLng.lng());
      //alert('lat ' + event.latLng.lat() + ' lng ' + event.latLng.lng());
      userDefinedLat = event.latLng.lat();
      userDefinedLon = event.latLng.lng();
    });

    jQuery('#refine-location-button').click(function() {
      report.createDynamicPageElements(userDefinedLat, userDefinedLon, true);
      jQuery.mobile.changePage("report.html", { transition: "slideup"})
    });

    // adding the marker to the map
    marker.setMap(map);

    //adding other installation markers drawn from DB
    addInstallationMarkers(map);
  };

  var addInstallationMarkers = function(map) {
      // adding markers for each point in the DB (we'll want to limit this at some point to decrease load time)
    var r = new veos.model.Reports();
    // I'm not sure it makes sense to do this here (it will never be reset, ie). Just doing for consistency
    r.on('reset', function(collection) {
      r.each(function(report) {
        var latLng = new google.maps.LatLng(report.get('loc_lat_from_gps'),report.get('loc_lng_from_gps'));
        var marker = new google.maps.Marker({
          position: latLng,
          title: report.get('owner_name')
        });
        // creating a new popup window that contains the location_name string (TODO: change to more relevant info)
        var infowindow = new google.maps.InfoWindow({
          content: '<b><p>' + report.get('owner_name') + '</b></p>'    // we might want to pretty thisup at some point
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

  self.createMap = createMap;
  self.addInstallationMarkers = addInstallationMarkers;

  veos.map = self;
  return veos;
})(window.veos || {});