/*jshint browser: true, devel: true, debug: true, forin: true, noempty: true, eqeqeq: true, boss: true,
  loopfunc: true, bitwise: true, curly: true, indent: 2, maxerr:50, white:false */

window.report = (function(report) {
  var self = report;
  var currentLat = null;
  var currentLng = null;
  var userDefinedLat = null;
  var userDefinedLng = null;


  function createMapThumbnail (lat, lng, reportsCollection) {
    // passing in lat/lng here - this function is used to create initial map, and whenever the user defines their location (with pin or address)
    // creating static map that is centered around the current location
    var myTemp = veos.map.generateStaticMap(lat, lng, reportsCollection);

    var mapThumbnail = jQuery('<img class="map-thumbnail" />');
    mapThumbnail.attr('src', myTemp);
    
    var thumbnailContainer = jQuery('#report-page .map-thumbnail-container');
    thumbnailContainer.empty();
    thumbnailContainer.append(mapThumbnail);

    // add listener which leads to overlay map (for refining location)
    mapThumbnail.click(function() {
      jQuery.mobile.changePage("#refine-location-page", { transition: "slideup"});    // is this the right way to do this?
    });
  }

  // perform a reverse geolocation lookup (convert latitude and longitude into a street address)
  function lookupAddressForLatLng (lat, lng) {
    var geocoder = new google.maps.Geocoder();
    var latlng = new google.maps.LatLng(lat, lng);
    
    geocoder.geocode({'latLng': latlng}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        if (results[0]) {
          console.log("Reverse geocoding for lat: " + lat + " lng: " + lng + " returned this address: " + results[0].formatted_address);
          jQuery('#location-address').val(results[0].formatted_address);
        }
      } else {
        console.error("Geocoder failed due to: " + status);
      }
    });
  }

  // lookup longitude and latitude for a given street address
  self.lookupLatLngForAddress = function(address) {
    var geocoder = new google.maps.Geocoder();
    
    geocoder.geocode({'address': address}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        userDefinedLat = results[0].geometry.location.lat();
        userDefinedLng = results[0].geometry.location.lng();

        console.log("Reverse geocoding for address: " + address + " returned this latitute: " + userDefinedLat + " and longitude: " + userDefinedLng);        

        var r = new veos.model.Reports();
        // adding listener for backbone.js reset event
        r.on('reset', function(collection) {
          createMapThumbnail(userDefinedLat, userDefinedLng, collection);
        });
        // fetching will trigger reset event
        r.fetch();

      } else {
        console.error("Geocoder failed due to: " + status);
      }
    });
  };

  self.submitReport = function() {
    // should we do another check for location with getCurrentPosition here?
    var r = new veos.model.Report();

    if (currentLat && currentLng) {
      r.set('loc_lat_from_gps', currentLat);
      r.set('loc_lng_from_gps', currentLng);
    } else {
      alert('Your GPS could not be determined');
      console.log('missing GPS');
      return true;
    }
    if (jQuery('input:radio[name=point-type-radio]:checked').val() === "Camera") {          // TODO do the advanced details
        r.set('camera', {pointed_at: []});  
    } else if (jQuery('input:radio[name=point-type-radio]:checked').val() === "Sign") {
        r.set('sign', {text: "I'm a sign", visibility: "can you see me?"});
    } else {
      alert('Enter type of report before submitting - is this a camera or a sign?');
      return true;
    }
    r.set('loc_description_from_google', jQuery('#location-address').val());
    r.set('loc_lat_from_user', userDefinedLat);
    r.set('loc_lng_from_user', userDefinedLng);
    r.set('loc_description_from_user', 'this is our initial testing with the new backend');
    r.set('owner_name', jQuery('#owner').val());    // this will need a if/else wrapper eventually

    r.save(null, {
      success: function () {
        jQuery('#image-list img').each(function () {
          var photo = jQuery(this).data('photo');
          console.log("Attaching photo to report.", photo)
          r.attachPhoto(photo);
        });
        veos.alert('Report submitted');
      }
    });
  };

  self.createDynamicPageElements = function(lat, lng, userDefined) {
    // if this function is called with userDefined = true, update the userDefinedLat/Lng vars
    if (userDefined === true) {
      userDefinedLat = lat;
      userDefinedLng = lng;
    } else {
      currentLat = lat;
      currentLng = lng;
    }

    // do reverse geolocation address lookup with lat-lng
    lookupAddressForLatLng(lat, lng);

    var r = new veos.model.Reports();

    // adding listener for backbone.js reset event
    r.on('reset', function(collection) {
      // create static map for reports page
      createMapThumbnail(lat, lng, collection);
      // create the live map where the user can refine their location
      veos.map.createMap(lat, lng, "#refining-map-canvas");
      jQuery('#refine-location-button').click(function() {
        report.createDynamicPageElements(userDefinedLat, userDefinedLng, true);
        jQuery.mobile.changePage("report.html", { transition: "slideup"})
      });      
    });
    // fetching will trigger reset event
    r.fetch();    
  };  

  self.init = function() {
    // retrieve the current position of the phone
    navigator.geolocation.getCurrentPosition(function geolocationSuccess (currentLocation) {
      currentLat = currentLocation.coords.latitude;
      currentLng = currentLocation.coords.longitude;
      self.createDynamicPageElements(currentLat, currentLng, false);
    },
      function geolocationFailure () {
        alert('There was a problem determining your location due to: ' + error.message);
    });
  };

  return self;
})(window.report || {});



// TODO: decide what we want to clear on page load/reload/submit - keeping some info might actually be right. Maybe the radio buttons?




// Google Maps notes:
/*  
-parameters static for now, but to be pulled from DB
-types of params we might want to use: lat/long, string (ie, "Toronto, On")
-markers are pins that we want to insert for each installation. We may want to set marker styles if there are multiple types of locations, ie src="http://maps.googleapis.com/maps/api/staticmap?center=43.668135,-79.398347&markers=size:small%7Ccolor:blue%7C43.669135,-79.399347&markers=43.658135,-79.388347&zoom=13&size=200x200&scale=2&sensor=true"
-set 'scale=2' for mobile devices
-docs claim we need 'sensor=true', but I doubt it
-for more details, see https://developers.google.com/maps/documentation/staticmaps/

 variables defined in the string for now, abstract and move when ready
<img src="http://maps.googleapis.com/maps/api/staticmap?zoom=13&size=200x200&scale=2&sensor=true" + 
center=current_position + &
markers=installation_1_ll + &
markers=installation_2_ll" />
etc.



Marker icon notes:
http://www.geocodezip.com/v3_markers_colored.html
http://www.geocodezip.com/v3_markers_normal_colored.html
http://www.geocodezip.com/v3_markers_normal_colored_infowindows.html

    var marker = new google.maps.Marker({
        position: currentLatLng,
        draggable: true,
        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        title:"Current position"
    });

We may need vectors or something, these icons are shite - even the standard maps icon is jagged. Maybe Janette?
*/
