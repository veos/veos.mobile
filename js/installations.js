/*jshint browser: true, devel: true, debug: true, forin: true, noempty: true, eqeqeq: true, boss: true,
loopfunc: true, bitwise: true, curly: true, indent: 2, maxerr:50, white:false */

// are we doing 2 or 4? report.js seems to be both. Also, this doesn't even remotely pass linting... but neither does report.js. What are we doing about this? Are we just using jshint?

window.installations = (function (installations) {
  var self = installations;

  var r = new veos.model.Reports();  // creates the "reports" collection proxy object
	
	// this way works as well. Implement everywhere?
/*	r.on('reset', function(collection) {
	  createGrid();
	  someOtherFunction();
	});
	r.fetch();
*/


  // retrieves all of the reports from the server TODO: should I restrict this to certain conditions? Reload on a subpage would reload this unnecessarily
  r.fetch({
    success: function () {

      // filling the installation-page.html grid
      // TODO: limit this to just <2 km?
      r.each(function(report) {
        //console.log(report.get('media'));
        var installationGrid = jQuery('#installations-page .ui-grid-a');

/*        if (distanceBtwPoints(currentLocation.coords.latitude, currentLocation.coords.longitude, report.get('latitude'), report.get('longitude')) < 2) { WAITING ON THIS till distanceBtwPoints and getCurrentPosition work right*/
		      // creating the HTML for the jQuery button to be filled with returned content. Why are you so ugly jQuery?
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
		      	alert('pass some info');
		      });
		      // TODO: bind some data in here so that the click event knows what data to fill on the next page. Something like:
		      // installationOuterButton.attr(report.get('location_name'));
		      // or should just pull the .text and use that?


		      // creating the HTML for the returned thumbnail
		      // NOTE: I'm assuming the thumbnail is always in the same place (media[1])
		      if (_.isEmpty(report.attributes.media[1])) {
		      	console.log('no picture');
			    }
			    else {
			      var divB = jQuery('<div class="ui-block-b">')
			      var installationThumbnail = jQuery('<img class="photo-thumbnail" />');
			      installationThumbnail.attr('src', r.get(report).attributes.media[1].link_url);   // thumb_url may look better, check on phone
			      divB.append(installationThumbnail);
			      installationGrid.append(divB);		    	
			    }

      });

    },
    error: function () {
      // is there an actual error code I should be using here?
      alert('Unable to access database. Please confirm you are connected to the internet and try again. Alternatively, the VEOS server may be down')
    }
  });
	

/* Why you no work?
	navigator.geolocation.getCurrentPosition(
		geolocationSuccess(function(currentLocation){console.log('distance: ' + distanceBtwPoints(currentLocation.coords.latitude, currentLocation.coords.longitude, 53.656176, -78.380931));}), geolocationFailure);
		Otherwise we need a callback or something, this is way too awkward.
*/

	navigator.geolocation.getCurrentPosition(geolocationSuccess, geolocationFailure);

	function geolocationSuccess(currentLocation) {
		console.log('distance: ' + distanceBtwPoints(currentLocation.coords.latitude, currentLocation.coords.longitude, 53.656176, -78.380931));
	}

	function geolocationFailure (errorMessage) {
		alert('There was a problem determining your location due to: ' + error.message);
	}	

  function distanceBtwPoints(lat1, lon1, lat2, lon2) {
		if (typeof(Number.prototype.toRad) === "undefined") {
  		Number.prototype.toRad = function() {
		    return this * Math.PI / 180;
		  }
		}

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











  // function distanceBtwPoints(lat, lon) {
  // 	var d = 10;
		// navigator.geolocation.getCurrentPosition(geolocationSuccess, geolocationFailure);
		
		// function geolocationSuccess (currentLocation) {
		// 	console.log('current location is:' + currentLocation.coords.latitude + ',' + currentLocation.coords.longitude);

		// 	if (typeof(Number.prototype.toRad) === "undefined") {
	 //  		Number.prototype.toRad = function() {
		// 	    return this * Math.PI / 180;
		// 	  }
		// 	}

		// 	var lat1 = currentLocation.coords.latitude;
		// 	var lon1 = currentLocation.coords.longitude;
		// 	var lat2 = lat;
		// 	var lon2 = lon;
		// 	var R = 6371; // km
		// 	var dLat = (lat2-lat1).toRad();
		// 	var dLon = (lon2-lon1).toRad();
		// 	lat1 = lat1.toRad();
		// 	lat2 = lat2.toRad();

		// 	var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
		// 	        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
		// 	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
		// 	d = R * c;
		// 	console.log('d:' + d);
		// 	//return d;
		// }

		// function geolocationFailure (errorMessage) {
		// 	alert('There was a problem determining your location due to: ' + error.message);
		// }
  // }