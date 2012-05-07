/* jshint browser: true, devel: true, debug: true, forin: true, noempty: true, eqeqeq: true, boss: true,
loopfunc: true, bitwise: true, curly: true, indent: 2, maxerr:50, white:false */


// some of the terminology here referring to installations is obviously a bit of a misnomer, but leaving it since we'll need it for phase 2

window.installations = (function (installations) {
  var self = installations;

  MAX_DISTANCE_FROM_CURRENT_LOCATION = 10;

  self.init = function() {
    var r = new veos.model.Reports(); // creates the "reports" collection proxy object

    r.on('reset', function(collection) {
      navigator.geolocation.getCurrentPosition(function(currentLocation) {
        var collectionFilter = function(report) {
          return isCloseBy(report, currentLocation);
        };
        var filteredReports = collection.filter(collectionFilter);

        createPointsGrid(filteredReports, currentLocation);

      },geolocationFailureHandler);
    });

    // @triggers reset on the collection
    r.fetch();
  };

  function createPointsGrid (filteredReports, currentLocation) {
    _.each(filteredReports, function(report) {
      // fills the installation-page.html grid (although as of now they points, not installations)
      var installationGrid = jQuery('#installations-page .ui-grid-a');
      jQuery('#installation-page .ui-grid-a').empty(); // clear out previous grids. May not be necessary
      var buttonText = '';

      // creates the HTML for the jQuery button to be filled with returned content. Why are you so ugly jQuery?
      if (report.get('sign')) {
        buttonText =  "Sign @ " + report.get('owner_name') + "<br/>" + report.get('loc_description_from_google');
      } else if (report.get('camera')) {
        buttonText = "Camera @ " + report.get('owner_name') + "<br/>" + report.get('loc_description_from_google');
      }
      var divA = jQuery('<div class="ui-block-a">');
      var installationOuterButton = jQuery('<a data-role="button" data-transition="fade" href="#point-details-page" data-icon="arrow-r" data-iconpos="left" data-theme="c" class="ui-btn ui-btn-icon-left ui-btn-corner-all ui-shadow ui-btn-up-c" />');
      var installationInnerButton = jQuery('<span class="ui-btn-inner ui-btn-corner-all">' + buttonText + '</span>');
      var installationButtonIcon = jQuery('<span class="ui-icon ui-icon-arrow-r ui-icon-shadow" />');
      installationOuterButton.append(installationInnerButton);
      installationOuterButton.append(installationButtonIcon);
      divA.append(installationOuterButton);
      //installationInnerButton.text(report.get('location_name') + &#10; + report.get('latitude'));
      installationGrid.append(divA);
      installationOuterButton.click(function() {
        // this can't be right. Ask Armin/Matt how to unspaghetti this
        populatePointDetailsContent(report);
        createPointDetailsMap(report);         // stopped here cause there's something wrong with reports.js
      });

      // creates the HTML for the returned thumbnail
      // NOTE: I'm assuming the thumbnail is always in the same place (media[1])
/*      if (report.get('media')[1] && report.get('media')[1].link_url) {
        var divB = jQuery('<div class="ui-block-b">')
        var installationThumbnail = jQuery('<img class="photo-thumbnail" />');
        installationThumbnail.attr('src', report.get('media')[1].link_url);   // thumb_url may look better, check on phone
        divB.append(installationThumbnail);
        installationGrid.append(divB);
      } else {
        console.log('no picture');
      }*/
    });
  }


	
  function populatePointDetailsContent(report) {
    jQuery('#point-details-page .installation-title').text('Eaton Centre');

    // TODO: replace with Matt's stuff
/*    var photoThumbnail = jQuery('<img class="photo-thumbnail" />');
    photoThumbnail.attr('src', I'M GOING TO BE A PHOTO);
    var photoContainer = jQuery('#point-details-page .photo-thumbnail-container');
    photoContainer.append(photoThumbnail); */ 

    if (report.attributes.camera) {
      jQuery('#point-details-page .point-type').text('Camera');
      jQuery('#point-details-page .point-title-1').text('Type of space surveilled: ');
      jQuery('#point-details-page .point-content-1').text('parking lot');
      jQuery('#point-details-page .point-title-2').text('Camera\'s location: ');
      jQuery('#point-details-page .point-content-2').text('Accessible private space');
      jQuery('#point-details-page .point-title-3').text('Camera type: ');
      jQuery('#point-details-page .point-content-3').text('bullet');
    } else if (report.attributes.sign) {
      jQuery('#point-details-page .point-type').text('Sign');
      jQuery('#point-details-page .point-title-1').text('Visibility: ');
      jQuery('#point-details-page .point-content-1').text('Obscure/High');
      jQuery('#point-details-page .point-title-2').text('Stated Purpose: ');
      jQuery('#point-details-page .point-content-2').text('Public Safety');
      jQuery('#point-details-page .point-title-3').text('Stated Properties: ');
      jQuery('#point-details-page .point-content-3').text('Live monitoring');
      jQuery('#point-details-page .point-title-4').text('Text of Sign: ');
      jQuery('#point-details-page .point-content-4').text('loridium loripus ipsorino this could be a *lot* of text');
      jQuery('#point-details-page .point-content-4').append(jQuery('<br />'));
    } else {
      console.log ('neither a camera or a sign');
    }
  }

  function createPointDetailsMap(report) {
    var latLng = veos.map.retrieveLatLng(report);
    // note: higher zoom level
    var staticMapCriteria = "http://maps.googleapis.com/maps/api/staticmap?zoom=17&size=150x150&scale=2&sensor=true&center=" + latLng.lat + "," + latLng.lng;
    staticMapCriteria += "&markers=size:small%7C" + latLng.lat + ',' + latLng.lng;
    
    var mapThumbnail = jQuery('<img class="map-thumbnail" />');
    mapThumbnail.attr('src', staticMapCriteria);    
    var thumbnailContainer = jQuery('#point-details-page .map-thumbnail-container');
    thumbnailContainer.append(mapThumbnail);	
  }

  function geolocationFailureHandler (errorMessage) {
    alert('There was a problem determining your location due to: ' + error.message);
  }

  function isCloseBy(report, currentLocation) {
    var latLng = veos.map.retrieveLatLng(report);
    if (distanceBetweenPoints(latLng.lat, latLng.lng, currentLocation.coords.latitude, currentLocation.coords.longitude) < MAX_DISTANCE_FROM_CURRENT_LOCATION) {
      return true;
    }
    else {
      return false;
    }    
  }

  function distanceBetweenPoints(lat1, lng1, lat2, lng2) {
    if (typeof(Number.prototype.toRad) === "undefined") {
      Number.prototype.toRad = function() {
        return this * Math.PI / 180;
      };
    }

    lat1 = parseFloat(lat1);
    lng1 = parseFloat(lng1);
    lat2 = parseFloat(lat2);
    lng2 = parseFloat(lng2);

    var R = 6371; // km
    var dLat = (lat2-lat1).toRad();
    var dLng = (lng2-lng1).toRad();
    lat1 = lat1.toRad();
    lat2 = lat2.toRad();

    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.sin(dLng/2) * Math.sin(dLng/2) * Math.cos(lat1) * Math.cos(lat2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    d = R * c;
    return d;
  }

  return self;
})(window.installations || {});
