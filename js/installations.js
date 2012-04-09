/*jshint browser: true, devel: true, debug: true, forin: true, noempty: true, eqeqeq: true, boss: true,
loopfunc: true, bitwise: true, curly: true, indent: 2, maxerr:50, white:false */

window.installations = (function (installations) {
  var self = installations;

  MAX_DISTANCE_FROM_CURRENT_LOCATION = 2;


  var r = new veos.model.Reports(); // creates the "reports" collection proxy object

	r.on('reset', function(collection) {
    navigator.geolocation.getCurrentPosition(function(currentLocation) {
        var collectionFilter = function(installation) {
          return isCloseBy(installation, currentLocation);
        }
        var filteredReports = collection.filter(collectionFilter);

        createInstallationGrid(filteredReports, currentLocation);

      },
      geolocationFailureHandler
    )
	});

	// @triggers reset on the collection
	r.fetch();

	// check if an installation is within X (currently 2) km from user's location
	function isCloseBy(installation, currentLocation) {
		if (distanceBetweenPoints(installation.get('latitude'), installation.get('longitude'), currentLocation.coords.latitude, currentLocation.coords.longitude) < MAX_DISTANCE_FROM_CURRENT_LOCATION) {
			return true;
		}
		else {
			return false;
		}
	}

  // retrieves all of the reports from the server TODO: should I restrict this to certain conditions? Reload on a subpage would reload this unnecessarily
	function createInstallationGrid (filteredReports, currentLocation) {
    _.each(filteredReports, function(report) {
      // filles the installation-page.html grid
      var installationGrid = jQuery('#installations-page .ui-grid-a');
      jQuery('#installation-page .ui-grid-a').empty(); // clear out previous grids. May not be necessary
      // creates the HTML for the jQuery button to be filled with returned content. Why are you so ugly jQuery?
      var divA = jQuery('<div class="ui-block-a">')
      var installationOuterButton = jQuery('<a data-role="button" data-transition="fade" href="#installation-details-page"	data-icon="arrow-r" data-iconpos="left" data-theme="c" class="ui-btn ui-btn-icon-left ui-btn-corner-all ui-shadow ui-btn-up-c"></a>');
      var installationInnerButton = jQuery('<span class="ui-btn-inner ui-btn-corner-all">');
      var installationButtonIcon = jQuery('<span class="ui-icon ui-icon-arrow-r ui-icon-shadow">');
      installationOuterButton.append(installationInnerButton);
      installationOuterButton.append(installationButtonIcon);
      divA.append(installationOuterButton);
      installationInnerButton.text(report.get('location_name'));
      installationGrid.append(divA);
      installationOuterButton.click(function() {
      	// this can't be right. Ask Armin/Matt how to unspaghetti this
      	populateInstallationDetailsContent(report);
      	createInstallationDetailsMapThumbnail(filteredReports, currentLocation);
      	createInstallationDetailsGrid(report, currentLocation);
      });

      // creates the HTML for the returned thumbnail
      // NOTE: I'm assuming the thumbnail is always in the same place (media[1])
	    if (report.get('media')[1] && report.get('media')[1].link_url) {
	      var divB = jQuery('<div class="ui-block-b">')
	      var installationThumbnail = jQuery('<img class="photo-thumbnail" />');
	      installationThumbnail.attr('src', report.get('media')[1].link_url);   // thumb_url may look better, check on phone
	      divB.append(installationThumbnail);
	      installationGrid.append(divB);
			} else {
				console.log('no picture');
			}
    });
  }

  function populateInstallationDetailsContent(report) {
  	// replace all this with non-static data, of the form .text(report.get('title'))
  	jQuery('#installation-details-page .installation-title').text('Eaton Centre');
  	jQuery('#installation-details-page .city-location').text('Toronto');
		jQuery('#installation-details-page .installation-owner').text('Chubb');
		jQuery('#installation-details-page .installation-type').text('Private');

		jQuery('#installation-details-page .compliance').removeClass('colorMeRed colorMeGreen');
		if (report.get('compliance') === 'Compliant') {
			jQuery('#installation-details-page .compliance').addClass('colorMeRed');
			jQuery('#installation-details-page .compliance').text('non-compliant');
		} else {
			jQuery('#installation-details-page .compliance').addClass('colorMeGreen');
			jQuery('#installation-details-page .compliance').text('compliant');
		}
  }

  function createInstallationDetailsMapThumbnail (filteredReports, currentLocation) {
  	var lat = currentLocation.coords.latitude;
  	var lon = currentLocation.coords.longitude;
    var staticMapCriteria = "http://maps.googleapis.com/maps/api/staticmap?zoom=13&size=200x200&scale=2&sensor=true&center=" + lat + "," + lon;

    // TODO: remove when we switch off Ush, replace with the _.each below
    staticMapCriteria += "&markers=" + lat + ',' + lon;
    
    // TODO: can't get this working without a better idea of the data model
/*    _.each(report.get('media'), function(point) {
      staticMapCriteria += "&markers=" + report.get('latitude') + ',' + report.get('longitude');
    });*/

		//_.each(filteredReports, function()

    var mapThumbnail = jQuery('<img class="map-thumbnail" />');
    mapThumbnail.attr('src', staticMapCriteria);
    
    var thumbnailContainer = jQuery('#installation-details-page .map-thumbnail-container');
    thumbnailContainer.append(mapThumbnail);
  }

  // will need to massively rewrite this later, also modularize the html grid creation code 
  function createInstallationDetailsGrid (report, currentLocation) {
		var installationGrid = jQuery('#installation-details-page .ui-grid-a');
		// clear out all child elements (if it's users second time to the page)
		jQuery('#installation-details-page .ui-grid-a').empty();

		// for each camera/sign in the report, create a row in the grid
		_.each(report.get('incident_category'), function (point) {
		  // creates the HTML for the jQuery button to be filled with returned content. Why are you so ugly jQuery?
		  var divA = jQuery('<div class="ui-block-a">')
		  var installationOuterButton = jQuery('<a data-role="button" data-transition="fade" href="#point-details-page" data-icon="arrow-r" data-iconpos="left" data-theme="c" class="ui-btn ui-btn-icon-left ui-btn-corner-all ui-shadow ui-btn-up-c"></a>');
		  var installationInnerButton = jQuery('<span class="ui-btn-inner ui-btn-corner-all">');
		  var installationButtonIcon = jQuery('<span class="ui-icon ui-icon-arrow-r ui-icon-shadow">');
		  installationOuterButton.append(installationInnerButton);
		  installationOuterButton.append(installationButtonIcon);
		  divA.append(installationOuterButton);
		  installationGrid.append(divA);

		  installationInnerButton.text(point.category.title);
		  installationOuterButton.click(function() {
      	populatePointDetailsContent(point);
      	createPointDetailsThumbnail(currentLocation);
		  });

		  // I'm not even going to bother to rewrite this, as it will change
/*		  if (report.get('media')[1] && report.get('media')[1].link_url) {
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
	
  function populatePointDetailsContent(point) {
  	// replace all this with non-static data, of the form .text(report.get('title'))
  	jQuery('#point-details-page .installation-title').text('Eaton Centre');

  	if (point.category.title === "Camera") {
  		jQuery('#point-details-page .point-type').text('Camera');
  		jQuery('#point-details-page .point-title-1').text('Type of space surveilled: ');
  		jQuery('#point-details-page .point-content-1').text('parking lot');
  		jQuery('#point-details-page .point-title-2').text('Camera\'s location: ');
  		jQuery('#point-details-page .point-content-2').text('Accessible private space');
  		jQuery('#point-details-page .point-title-3').text('Camera type: ');
  		jQuery('#point-details-page .point-content-3').text('bullet');
  	} else if (point.category.title === "Sign") {
  		jQuery('#point-details-page .point-type').text('Sign');
  		jQuery('#point-details-page .point-title-1').text('Visibility: ');
  		jQuery('#point-details-page .point-content-1').text('Obscure/High');
  		jQuery('#point-details-page .point-title-2').text('Stated Purpose: ');
  		jQuery('#point-details-page .point-content-2').text('Public Safety');
  		jQuery('#point-details-page .point-title-3').text('Stated Properties: ');
  		jQuery('#point-details-page .point-content-3').text('Live monitoring');
  		jQuery('#point-details-page .point-title-4').text('Text of Sign: ');
  		jQuery('#point-details-page .point-content-4').text('loridium loripus ipsorino this could be a *lot* of text');
  		jQuery('#point-details-page .point-content-4').append(jQuery('<br />'))
  	} else {
  		console.log ('not sure if this is a camera or a sign');
  	}
  }

  // TODO: fix this so that it centers on the point, not the current location
  function createPointDetailsThumbnail(currentLocation) {
    var lat = currentLocation.coords.latitude;
  	var lon = currentLocation.coords.longitude;
  	// higher zoom level
    var staticMapCriteria = "http://maps.googleapis.com/maps/api/staticmap?zoom=15&size=200x200&scale=2&sensor=true&center=" + lat + "," + lon;
    staticMapCriteria += "&markers=" + lat + ',' + lon;
    var mapThumbnail = jQuery('<img class="map-thumbnail" />');
    mapThumbnail.attr('src', staticMapCriteria);    
    var thumbnailContainer = jQuery('#point-details-page .map-thumbnail-container');
    thumbnailContainer.append(mapThumbnail);	
  }

	function geolocationFailureHandler (errorMessage) {
		alert('There was a problem determining your location due to: ' + error.message);
	}	

  function distanceBetweenPoints(lat1, lon1, lat2, lon2) {
		if (typeof(Number.prototype.toRad) === "undefined") {
  		Number.prototype.toRad = function() {
		    return this * Math.PI / 180;
		  }
		}

		lat1 = parseFloat(lat1);
		lon1 = parseFloat(lon1);
		lat2 = parseFloat(lat2);
		lon2 = parseFloat(lon2);

		var R = 6371; // km
		var dLat = (lat2-lat1).toRad();
		var dLon = (lon2-lon1).toRad();
		lat1 = lat1.toRad();
		lat2 = lat2.toRad();

		var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
		        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
		d = R * c;
		return d;
	}

  return self;
})(window.installations || {});
