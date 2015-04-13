/*jshint debug:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, undef:true, curly:true, browser: true, devel: true, jquery:true */
/*globals jQuery, _,google */

(function(veos) {
  var geo = {};

  // Default location is the middle of the U of T campus
  geo.DEFAULT_POS = {
    coords: {
      latitude: 43.6621614579938,
      longitude: -79.39527873417967
    }
  };

  geo.startFollowing = function () {
    if (geo.locWatchId !== undefined) {
      throw "We are already following the user's location!";
    }

    var haveloc = function (geoloc) {
      console.log("Got updated gps location: ", geoloc);
      veos.geo.lastLoc = geoloc;
      jQuery(geo).trigger('haveloc', geoloc);
    };

    var error = function (err) {
      console.warn('ERROR(' + err.code + '): ' + err.message);
      if (err.code === 1) { // PERMISSION_DENIED
        veos.alert("We are unable to locate you, because you declined to grant access to your geolocation (PERMISSION_DENIED)");
      } else if (err.code === 2) { // POSITION_UNAVAILABLE
        // currently unhandled (we can't produce this with our phones)
        console.warn("Your device is currently unable to determine location (POSITION_UNAVAILABLE)");
      } else if (err.code === 3) { // TIMEOUT
        veos.alert("Your device is currently unable to determine location (TIMEOUT)");
      } else {
        console.warn("Unknown watchPosition error code: "+err.code);
      }

      // Can't figure out the user's real position, so use the default.
      haveloc(geo.DEFAULT_POS);
    };

    veos.locWatchId = navigator.geolocation.watchPosition(haveloc, error, {
      enableHighAccuracy: true, // ask for exact location
      timeout: 5000, // time out after 5 seconds
      maximumAge: Infinity // allow using cached location
    });
  };

  geo.stopFollowing = function () {
    if (geo.locWatchId !== undefined) {
      throw "We are not following the user's location!";
    }

    navigator.geolocation.clearWatch(veos.locWatchId);
    // Matt: Looks to me like there is a typo here since navigator.geolo is undefined
    // And deleting the navigator.geolocation object means we cna never follow the location afte this
    delete navigator.geolo;

    console.log("Stopped following user...");
  };

  veos.geo = geo;
})(window.veos);
